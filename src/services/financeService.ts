import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase/client';
import {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  Expense,
  Transaction,
} from '../types/finance';
import { handleFirestoreError, OperationType } from './firebase/firestoreErrors';
import { logAuditEvent } from './audit/auditService';

export interface CreateInvoiceInput {
  clientId: string;
  clientName: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    serviceCategory?: string;
  }>;
  taxRate?: number; // e.g. 5 for 5%
  tax?: number; // fixed tax amount if taxRate is omitted
  discount?: number;
  currency?: 'USD' | 'BDT';
  notes?: string;
  status?: InvoiceStatus;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentDate?: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

export interface CreateExpenseInput {
  category: string;
  description: string;
  vendor: string;
  amount: number;
  currency?: 'USD' | 'BDT';
  date?: string;
  receiptUrl?: string;
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BG-INV-${year}-${rand}`;
}

export type FinanceActor = {
  id?: string;
  uid?: string;
  email?: string | null;
  role: 'admin' | 'team' | 'client';
  name?: string;
  clientId?: string;
};

/**
 * 1. Create an invoice with line items and auto-calculate subtotal, tax, and totalAmount
 */
export async function createInvoice(
  input: CreateInvoiceInput,
  actor: FinanceActor
): Promise<Invoice> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can create invoices.');
  }

  if (!input.clientId || !input.clientName) {
    throw new Error('Client organization is required.');
  }

  if (!input.dueDate) {
    throw new Error('Invoice due date is required.');
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('At least one invoice line item is required.');
  }

  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const invoiceRef = doc(db, 'invoices', invoiceId);
  const now = new Date().toISOString();

  // 1. Process line items and compute item amounts
  const items: InvoiceItem[] = input.items.map((item, index) => {
    const qty = Math.max(1, item.quantity || 1);
    const unitPrice = Math.max(0, item.unitPrice || 0);
    const amount = Math.round(qty * unitPrice * 100) / 100;
    return {
      id: `item_${index + 1}_${Math.random().toString(36).substring(2, 6)}`,
      description: item.description.trim() || 'Service deliverable',
      quantity: qty,
      unitPrice,
      amount,
      serviceCategory: item.serviceCategory,
    };
  });

  // 2. Auto-calculate subtotal
  const subtotal = Math.round(items.reduce((sum, it) => sum + it.amount, 0) * 100) / 100;

  // 3. Auto-calculate tax (percentage or explicit amount)
  let tax = 0;
  if (input.taxRate !== undefined && input.taxRate >= 0) {
    tax = Math.round(((subtotal * input.taxRate) / 100) * 100) / 100;
  } else if (input.tax !== undefined && input.tax >= 0) {
    tax = Math.round(input.tax * 100) / 100;
  }

  // 4. Auto-calculate discount
  const discount = Math.max(0, input.discount ? Math.round(input.discount * 100) / 100 : 0);

  // 5. Auto-calculate totalAmount
  const totalAmount = Math.max(0, Math.round((subtotal + tax - discount) * 100) / 100);

  // Initial balance and paid status
  const paidAmount = 0;
  const balanceDue = totalAmount;

  const invoiceData: Invoice = {
    id: invoiceId,
    invoiceNumber: input.invoiceNumber?.trim() || generateInvoiceNumber(),
    clientId: input.clientId,
    clientName: input.clientName,
    status: input.status || 'issued',
    issueDate: input.issueDate || now.split('T')[0],
    dueDate: input.dueDate,
    items,
    subtotal,
    tax,
    taxRate: input.taxRate,
    discount,
    totalAmount,
    paidAmount,
    balanceDue,
    currency: input.currency || 'USD',
    notes: input.notes?.trim() || '',
    createdAt: now,
    updatedAt: now,
  };

  const actorUid = actor.uid || actor.id || auth?.currentUser?.uid || 'admin';

  try {
    await setDoc(invoiceRef, invoiceData);

    await logAuditEvent({
      actorUserId: actorUid,
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'invoice_issued',
      entityType: 'invoice',
      entityId: invoiceId,
      details: `Created invoice ${invoiceData.invoiceNumber} for ${invoiceData.clientName} (Total: ${invoiceData.currency} ${invoiceData.totalAmount})`,
      status: 'success',
    });

    return invoiceData;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${invoiceId}`);
    throw err;
  }
}

/**
 * 2. Record a partial or full payment against an invoice
 * 3. Automatically update the paidAmount and balanceDue of the invoice
 * 4. Prevent overpayment using an atomic Firestore transaction
 */
export async function recordPayment(
  input: RecordPaymentInput,
  actor: FinanceActor
): Promise<{ payment: Payment; invoice: Invoice }> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can record invoice payments.');
  }

  if (!input.invoiceId) {
    throw new Error('Invoice ID is required.');
  }

  if (!input.amount || input.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const actorUid = actor.uid || actor.id || auth?.currentUser?.uid || 'admin';
  const invoiceRef = doc(db, 'invoices', input.invoiceId);
  const now = new Date().toISOString();
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const paymentRef = doc(db, 'payments', paymentId);
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const transactionRef = doc(db, 'transactions', transactionId);

  try {
    const result = await runTransaction(db, async (txn) => {
      const invoiceSnap = await txn.get(invoiceRef);
      if (!invoiceSnap.exists()) {
        throw new Error(`Invoice with ID ${input.invoiceId} does not exist.`);
      }

      const invoice = invoiceSnap.data() as Invoice;

      if (invoice.status === 'voided') {
        throw new Error('Cannot record payments against a voided invoice.');
      }

      if (invoice.status === 'paid' || invoice.balanceDue <= 0) {
        throw new Error('This invoice is already fully paid. No balance remains.');
      }

      // 4. PREVENT OVERPAYMENT
      const paymentAmount = Math.round(input.amount * 100) / 100;
      if (paymentAmount > invoice.balanceDue) {
        throw new Error(
          `Overpayment rejected: Payment amount (${invoice.currency} ${paymentAmount}) exceeds the remaining balance due (${invoice.currency} ${invoice.balanceDue}).`
        );
      }

      // 3. AUTOMATICALLY UPDATE paidAmount and balanceDue
      const newPaidAmount = Math.round((invoice.paidAmount + paymentAmount) * 100) / 100;
      const newBalanceDue = Math.max(0, Math.round((invoice.totalAmount - newPaidAmount) * 100) / 100);
      const newStatus: InvoiceStatus = newBalanceDue === 0 ? 'paid' : 'partially_paid';

      const paymentRecord: Payment = {
        id: paymentId,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        amount: paymentAmount,
        paymentDate: input.paymentDate || now.split('T')[0],
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber?.trim() || '',
        recordedBy: actorUid,
        recordedByName: actor.name || 'Admin',
        notes: input.notes?.trim() || '',
        createdAt: now,
      };

      const transactionRecord: Transaction = {
        id: transactionId,
        type: 'income',
        amount: paymentAmount,
        currency: invoice.currency,
        category: 'invoice_payment',
        description: `Payment for Invoice ${invoice.invoiceNumber} (${invoice.clientName})`,
        referenceId: invoice.id,
        referenceType: 'payment',
        date: input.paymentDate || now.split('T')[0],
        recordedBy: actorUid,
        createdAt: now,
      };

      const updatedInvoice: Invoice = {
        ...invoice,
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
        paidAt: newStatus === 'paid' ? now : invoice.paidAt,
        paymentMethod: input.paymentMethod,
        paymentReference: input.referenceNumber || invoice.paymentReference,
        updatedAt: now,
      };

      // Write payment and transaction records, update invoice
      txn.set(paymentRef, paymentRecord);
      txn.set(transactionRef, transactionRecord);
      txn.update(invoiceRef, {
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
        paidAt: newStatus === 'paid' ? now : (invoice.paidAt || ''),
        paymentMethod: input.paymentMethod,
        paymentReference: input.referenceNumber || invoice.paymentReference || '',
        updatedAt: now,
      });

      return { payment: paymentRecord, invoice: updatedInvoice };
    });

    await logAuditEvent({
      actorUserId: actorUid,
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: result.invoice.status === 'paid' ? 'invoice_paid' : 'payment_recorded',
      entityType: 'payment',
      entityId: paymentId,
      details: `Recorded payment of ${result.invoice.currency} ${input.amount} against Invoice ${result.invoice.invoiceNumber}. Balance remaining: ${result.invoice.currency} ${result.invoice.balanceDue}`,
      status: 'success',
    });

    return result;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${input.invoiceId}/payments`);
    throw err;
  }
}

/**
 * Read single invoice by ID
 */
export async function getInvoiceById(
  invoiceId: string,
  actor?: FinanceActor
): Promise<Invoice | null> {
  const invoiceRef = doc(db, 'invoices', invoiceId);
  try {
    const snap = await getDoc(invoiceRef);
    if (!snap.exists()) return null;
    const inv = snap.data() as Invoice;

    // Client authorization check
    if (actor && actor.role === 'client' && inv.clientId !== actor.clientId) {
      throw new Error('Access denied: You can only view invoices for your own organization.');
    }

    return inv;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `invoices/${invoiceId}`);
    return null;
  }
}

/**
 * Real-time subscription to invoices with RBAC filtering
 */
export function subscribeInvoices(
  options: { clientId?: string; status?: string } | undefined,
  callback: (invoices: Invoice[]) => void,
  actor: FinanceActor,
  onError?: (error: Error) => void
): () => void {
  const actorUid = actor.uid || actor.id;
  if (!auth?.currentUser || !actorUid) {
    callback([]);
    return () => {};
  }

  const invoicesRef = collection(db, 'invoices');
  let q = query(invoicesRef);

  if (actor.role === 'client') {
    const targetClientId = actor.clientId || options?.clientId;
    if (!targetClientId) {
      callback([]);
      return () => {};
    }
    // Clients only read non-draft invoices matching their clientId
    q = query(invoicesRef, where('clientId', '==', targetClientId));
  } else if (options?.clientId && options.clientId !== 'all') {
    q = query(invoicesRef, where('clientId', '==', options.clientId));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Invoice[];

      // Clients never see draft invoices
      if (actor.role === 'client') {
        items = items.filter((inv) => inv.status !== 'draft');
      }

      // In-memory status filter if provided
      if (options?.status && options.status !== 'all') {
        items = items.filter((inv) => inv.status === options.status);
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (err) => {
      console.error('[subscribeInvoices error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'invoices');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

/**
 * Real-time subscription to payments
 */
export function subscribePayments(
  options: { invoiceId?: string; clientId?: string } | undefined,
  callback: (payments: Payment[]) => void,
  actor?: FinanceActor,
  onError?: (error: Error) => void
): () => void {
  if (!auth?.currentUser) {
    callback([]);
    return () => {};
  }

  const paymentsRef = collection(db, 'payments');
  let q = query(paymentsRef);

  if (actor && actor.role === 'client') {
    const targetClientId = actor.clientId || options?.clientId;
    if (!targetClientId) {
      callback([]);
      return () => {};
    }
    q = query(paymentsRef, where('clientId', '==', targetClientId));
  } else if (options?.invoiceId) {
    q = query(paymentsRef, where('invoiceId', '==', options.invoiceId));
  } else if (options?.clientId && options.clientId !== 'all') {
    q = query(paymentsRef, where('clientId', '==', options.clientId));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const payments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Payment[];

      payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(payments);
    },
    (err) => {
      console.error('[subscribePayments error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'payments');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

/**
 * Agency expense recording (Internal only)
 */
export async function createExpense(
  input: CreateExpenseInput,
  actor: FinanceActor
): Promise<Expense> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can record agency operating expenses.');
  }

  const actorUid = actor.uid || actor.id || 'admin';
  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const expenseRef = doc(db, 'expenses', expenseId);
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const transactionRef = doc(db, 'transactions', transactionId);
  const now = new Date().toISOString();

  const expenseData: Expense = {
    id: expenseId,
    category: input.category,
    description: input.description.trim(),
    vendor: input.vendor.trim(),
    amount: Math.round(input.amount * 100) / 100,
    currency: input.currency || 'USD',
    date: input.date || now.split('T')[0],
    recordedByUserId: actorUid,
    receiptUrl: input.receiptUrl,
    createdAt: now,
  };

  const transactionData: Transaction = {
    id: transactionId,
    type: 'expense',
    amount: expenseData.amount,
    currency: expenseData.currency,
    category: expenseData.category,
    description: `${expenseData.vendor}: ${expenseData.description}`,
    referenceId: expenseId,
    referenceType: 'expense',
    date: expenseData.date,
    recordedBy: actorUid,
    createdAt: now,
  };

  try {
    const batch = writeBatch(db);
    batch.set(expenseRef, expenseData);
    batch.set(transactionRef, transactionData);
    await batch.commit();

    await logAuditEvent({
      actorUserId: actorUid,
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'expense_recorded',
      entityType: 'expense',
      entityId: expenseId,
      details: `Recorded agency expense: ${expenseData.vendor} - ${expenseData.currency} ${expenseData.amount}`,
      status: 'success',
    });

    return expenseData;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `expenses/${expenseId}`);
    throw err;
  }
}

/**
 * Real-time subscription to agency expenses (Admin only)
 */
export function subscribeExpenses(
  callback: (expenses: Expense[]) => void,
  actor: FinanceActor,
  onError?: (error: Error) => void
): () => void {
  if (!auth?.currentUser || actor.role !== 'admin') {
    callback([]);
    return () => {};
  }

  const expensesRef = collection(db, 'expenses');
  const q = query(expensesRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const expenses = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Expense[];

      expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(expenses);
    },
    (err) => {
      console.error('[subscribeExpenses error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'expenses');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

/**
 * Real-time subscription to agency transactions (Admin only)
 */
export function subscribeTransactions(
  callback: (transactions: Transaction[]) => void,
  actor: FinanceActor,
  onError?: (error: Error) => void
): () => void {
  if (!auth?.currentUser || actor.role !== 'admin') {
    callback([]);
    return () => {};
  }

  const transactionsRef = collection(db, 'transactions');
  const q = query(transactionsRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const transactions = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Transaction[];

      transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(transactions);
    },
    (err) => {
      console.error('[subscribeTransactions error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'transactions');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}
