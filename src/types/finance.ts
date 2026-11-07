export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'voided';

export type PaymentMethod =
  | 'bank_transfer'
  | 'stripe'
  | 'bkash'
  | 'nagad'
  | 'wise'
  | 'cash'
  | 'other';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  serviceCategory?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. BG-INV-2026-001
  clientId: string;
  clientName: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  taxRate?: number; // e.g. 5 for 5%
  discount?: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: 'USD' | 'BDT';
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  clientName?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  recordedBy: string; // Admin UID
  recordedByName?: string;
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  vendor: string;
  amount: number;
  currency: 'USD' | 'BDT';
  date: string;
  recordedByUserId: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

// Backward compatibility alias
export type AgencyExpense = Expense;

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: 'USD' | 'BDT';
  category: string;
  description: string;
  referenceId?: string; // invoiceId, paymentId, or expenseId
  referenceType?: 'invoice' | 'payment' | 'expense';
  date: string;
  recordedBy: string;
  createdAt: string;
}
