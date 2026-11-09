import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Tabs } from '../../components/common/Tabs';
import { Table, Column } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import {
  DollarSign,
  Plus,
  Lock,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Receipt,
  Trash2,
  Calendar,
  AlertCircle,
  FileText,
  Building,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  Invoice,
  Payment,
  Expense,
  Transaction,
  PaymentMethod,
} from '../../types/finance';
import {
  createInvoice,
  recordPayment,
  createExpense,
  subscribeInvoices,
  subscribePayments,
  subscribeExpenses,
  subscribeTransactions,
  deleteInvoice,
  voidInvoice,
  deleteExpense,
} from '../../services/financeService';
import { subscribeClients } from '../../services/clients/clientService';
import { ClientProfile } from '../../types/client';

export function FinancePage() {
  const { currentUser, currentRole, firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices');

  // Firestore Live State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

  // Create Invoice Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState<'USD' | 'BDT'>('BDT');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceTaxRate, setInvoiceTaxRate] = useState<number>(0);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [lineItems, setLineItems] = useState<
    Array<{ description: string; quantity: number; unitPrice: number; serviceCategory?: string }>
  >([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceFormError, setInvoiceFormError] = useState('');

  // Record Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Record Expense Form State
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseCurrency, setExpenseCurrency] = useState<'USD' | 'BDT'>('BDT');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  // Delete & Void State
  const [isDeleteInvoiceModalOpen, setIsDeleteInvoiceModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);

  const [isDeleteExpenseModalOpen, setIsDeleteExpenseModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);

  const handleDeleteInvoiceConfirm = async () => {
    if (!invoiceToDelete || !currentUser) return;
    try {
      setIsDeletingInvoice(true);
      await deleteInvoice(invoiceToDelete.id, invoiceToDelete.invoiceNumber, {
        role: 'admin',
        uid: firebaseUser?.uid || currentUser.id,
        email: firebaseUser?.email || currentUser.email,
      });
      setIsDeleteInvoiceModalOpen(false);
      setInvoiceToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete invoice');
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  const handleVoidInvoiceConfirm = async (inv: Invoice) => {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to void invoice ${inv.invoiceNumber}?`)) return;
    try {
      await voidInvoice(inv.id, inv.invoiceNumber, {
        role: 'admin',
        uid: firebaseUser?.uid || currentUser.id,
        email: firebaseUser?.email || currentUser.email,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to void invoice');
    }
  };

  const handleDeleteExpenseConfirm = async () => {
    if (!expenseToDelete || !currentUser) return;
    try {
      setIsDeletingExpense(true);
      await deleteExpense(expenseToDelete.id, expenseToDelete.category, {
        role: 'admin',
        uid: firebaseUser?.uid || currentUser.id,
        email: firebaseUser?.email || currentUser.email,
      });
      setIsDeleteExpenseModalOpen(false);
      setExpenseToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    } finally {
      setIsDeletingExpense(false);
    }
  };

  // Subscribe to real-time data
  useEffect(() => {
    if (currentRole !== 'admin' || !currentUser) {
      setLoading(false);
      return;
    }

    const unsubClients = subscribeClients(
      (data) => setClients(data),
      (err) => console.error(err)
    );

    const unsubInvoices = subscribeInvoices(
      undefined,
      (data) => {
        setInvoices(data);
        setLoading(false);
      },
      currentUser
    );

    const unsubPayments = subscribePayments(
      undefined,
      (data) => setPayments(data),
      currentUser
    );

    const unsubExpenses = subscribeExpenses(
      (data) => setExpenses(data),
      currentUser
    );

    const unsubTransactions = subscribeTransactions(
      (data) => setTransactions(data),
      currentUser
    );

    return () => {
      unsubClients();
      unsubInvoices();
      unsubPayments();
      unsubExpenses();
      unsubTransactions();
    };
  }, [currentRole, currentUser]);

  // Invoice calculations
  const invoiceCalculations = useMemo(() => {
    const subtotal = lineItems.reduce((acc, item) => {
      const qty = Math.max(1, item.quantity || 1);
      const price = Math.max(0, item.unitPrice || 0);
      return acc + qty * price;
    }, 0);
    const tax = invoiceTaxRate > 0 ? (subtotal * invoiceTaxRate) / 100 : 0;
    const discount = Math.max(0, invoiceDiscount || 0);
    const total = Math.max(0, subtotal + tax - discount);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [lineItems, invoiceTaxRate, invoiceDiscount]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const outstandingTotal = invoices
      .filter((inv) => inv.status !== 'voided' && inv.status !== 'paid')
      .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

    const collectedTotal = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);

    const expensesTotal = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const unpaidCount = invoices.filter(
      (inv) => inv.status === 'issued' || inv.status === 'partially_paid' || inv.status === 'overdue'
    ).length;

    return {
      outstandingTotal: Math.round(outstandingTotal * 100) / 100,
      collectedTotal: Math.round(collectedTotal * 100) / 100,
      expensesTotal: Math.round(expensesTotal * 100) / 100,
      unpaidCount,
    };
  }, [invoices, payments, expenses]);

  if (currentRole !== 'admin') {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl my-6">
        <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">Restricted Administrative Area</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Agency finance, invoices, expenses, and profit figures are restricted strictly to Founder / Admin role.
        </p>
      </div>
    );
  }

  // Handle invoice submission
  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvoiceFormError('');

    if (!selectedClientId) {
      setInvoiceFormError('Please select a client organization.');
      return;
    }

    const selectedClient = clients.find((c) => c.id === selectedClientId);
    if (!selectedClient) {
      setInvoiceFormError('Selected client not found.');
      return;
    }

    if (!invoiceDueDate) {
      setInvoiceFormError('Due date is required.');
      return;
    }

    if (lineItems.length === 0 || lineItems.some((i) => !i.description.trim())) {
      setInvoiceFormError('All line items must have a clear description.');
      return;
    }

    if (!currentUser) return;

    setInvoiceSubmitting(true);
    try {
      await createInvoice(
        {
          clientId: selectedClient.id,
          clientName: selectedClient.businessName,
          dueDate: invoiceDueDate,
          currency: invoiceCurrency,
          items: lineItems.map((item) => ({
            description: item.description?.trim() || 'Service deliverable',
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            ...(item.serviceCategory ? { serviceCategory: item.serviceCategory } : {}),
          })),
          taxRate: Number(invoiceTaxRate) || 0,
          discount: Number(invoiceDiscount) || 0,
          notes: invoiceNotes?.trim() || '',
          status: 'issued',
        },
        {
          uid: firebaseUser?.uid || currentUser.id,
          email: firebaseUser?.email || currentUser.email,
          role: 'admin',
          name: firebaseUser?.displayName || currentUser.displayName,
        }
      );

      setIsInvoiceModalOpen(false);
      // Reset form
      setSelectedClientId('');
      setInvoiceDueDate('');
      setInvoiceTaxRate(0);
      setInvoiceDiscount(0);
      setInvoiceNotes('');
      setLineItems([{ description: '', quantity: 1, unitPrice: 0 }]);
    } catch (err: any) {
      setInvoiceFormError(err.message || 'Failed to create invoice.');
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  // Open Payment modal
  const handleOpenPaymentModal = (invoice: Invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentAmount(invoice.balanceDue);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('bank_transfer');
    setPaymentRefNumber('');
    setPaymentNotes('');
    setPaymentError('');
    setIsPaymentModalOpen(true);
  };

  // Handle payment submission
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');

    if (!selectedInvoiceForPayment) return;

    if (!paymentAmount || paymentAmount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    // Client-side guard against overpayment
    if (paymentAmount > selectedInvoiceForPayment.balanceDue) {
      setPaymentError(
        `Overpayment rejected: Entered amount ($${paymentAmount}) exceeds the remaining balance due ($${selectedInvoiceForPayment.balanceDue}).`
      );
      return;
    }

    if (!currentUser) return;

    setPaymentSubmitting(true);
    try {
      await recordPayment(
        {
          invoiceId: selectedInvoiceForPayment.id,
          amount: paymentAmount,
          paymentDate: paymentDate || undefined,
          paymentMethod,
          referenceNumber: paymentRefNumber,
          notes: paymentNotes,
        },
        {
          uid: currentUser.id,
          email: currentUser.email,
          role: 'admin',
          name: currentUser.displayName,
        }
      );

      setIsPaymentModalOpen(false);
      setSelectedInvoiceForPayment(null);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Handle expense submission
  const handleCreateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');

    if (!expenseVendor.trim() || !expenseDescription.trim()) {
      setExpenseError('Vendor and description are required.');
      return;
    }

    if (!expenseAmount || expenseAmount <= 0) {
      setExpenseError('Expense amount must be greater than zero.');
      return;
    }

    if (!currentUser) return;

    setExpenseSubmitting(true);
    try {
      await createExpense(
        {
          category: expenseCategory,
          vendor: expenseVendor,
          description: expenseDescription,
          amount: expenseAmount,
          currency: expenseCurrency,
          date: expenseDate || new Date().toISOString().split('T')[0],
        },
        {
          uid: currentUser.id,
          email: currentUser.email,
          role: 'admin',
        }
      );

      setIsExpenseModalOpen(false);
      setExpenseVendor('');
      setExpenseDescription('');
      setExpenseAmount(0);
      setExpenseDate('');
    } catch (err: any) {
      setExpenseError(err.message || 'Failed to record expense.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  // Invoice Columns
  const invoiceColumns: Column<Invoice>[] = [
    {
      header: 'Invoice #',
      cell: (inv) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{inv.invoiceNumber}</div>
          <div className="text-[11px] text-slate-500">Issued: {inv.issueDate}</div>
        </div>
      ),
    },
    {
      header: 'Client Organization',
      cell: (inv) => (
        <div>
          <div className="font-medium text-slate-900 text-xs">{inv.clientName}</div>
          <div className="text-[11px] text-slate-400">Due: {inv.dueDate}</div>
        </div>
      ),
    },
    {
      header: 'Total Amount',
      cell: (inv) => (
        <span className="font-bold text-slate-900 text-xs">
          {inv.currency} {inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Paid / Balance',
      cell: (inv) => (
        <div>
          <div className="text-xs text-emerald-700 font-medium">
            Paid: {inv.currency} {(inv.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-semibold text-rose-600">
            Due: {inv.currency} {(inv.balanceDue ?? inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (inv) => {
        const variants: Record<string, 'neutral' | 'blue' | 'green' | 'amber' | 'red'> = {
          draft: 'neutral',
          issued: 'blue',
          partially_paid: 'amber',
          paid: 'green',
          overdue: 'red',
          voided: 'neutral',
        };
        const labels: Record<string, string> = {
          draft: 'Draft',
          issued: 'Issued',
          partially_paid: 'Partially Paid',
          paid: 'Paid in Full',
          overdue: 'Overdue',
          voided: 'Voided',
        };
        return (
          <Badge variant={variants[inv.status] || 'neutral'}>
            {labels[inv.status] || inv.status}
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (inv) => (
        <div className="flex items-center justify-end gap-1.5">
          {inv.status !== 'paid' && inv.status !== 'voided' && (inv.balanceDue ?? inv.totalAmount) > 0 ? (
            <Button
              size="sm"
              variant="outline"
              icon={<CreditCard className="w-3.5 h-3.5 text-blue-600" />}
              onClick={() => handleOpenPaymentModal(inv)}
            >
              Record Payment
            </Button>
          ) : (
            <span className="text-[11px] text-emerald-700 font-semibold px-2 py-1 bg-emerald-50 rounded">
              Settled
            </span>
          )}

          {inv.status !== 'voided' && inv.status !== 'paid' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleVoidInvoiceConfirm(inv)}
              className="text-xs text-amber-600 hover:bg-amber-50"
              title="Void Invoice"
            >
              Void
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setInvoiceToDelete(inv);
              setIsDeleteInvoiceModalOpen(true);
            }}
            icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
            className="text-xs hover:bg-red-50"
            title="Delete Invoice"
          />
        </div>
      ),
    },
  ];

  // Payment Columns
  const paymentColumns: Column<Payment>[] = [
    {
      header: 'Payment ID',
      cell: (p) => <span className="font-mono text-xs text-slate-700">{p.id}</span>,
    },
    {
      header: 'Client / Invoice',
      cell: (p) => (
        <div>
          <div className="font-medium text-slate-900 text-xs">{p.clientName || 'Client'}</div>
          <div className="text-[11px] text-slate-400 font-mono">Invoice: {p.invoiceId}</div>
        </div>
      ),
    },
    {
      header: 'Amount Collected',
      cell: (p) => (
        <span className="font-bold text-emerald-700 text-xs">
          ${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Method & Reference',
      cell: (p) => (
        <div>
          <span className="capitalize text-xs font-medium text-slate-800">
            {p.paymentMethod.replace('_', ' ')}
          </span>
          {p.referenceNumber && (
            <div className="text-[11px] text-slate-500 font-mono">Ref: {p.referenceNumber}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Date Recorded',
      cell: (p) => <span className="text-xs text-slate-600">{p.paymentDate}</span>,
    },
  ];

  // Expense Columns
  const expenseColumns: Column<Expense>[] = [
    {
      header: 'Vendor / Provider',
      cell: (exp) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{exp.vendor}</div>
          <div className="text-[11px] text-slate-500">{exp.description}</div>
        </div>
      ),
    },
    {
      header: 'Category',
      cell: (exp) => <Badge variant="neutral">{exp.category}</Badge>,
    },
    {
      header: 'Amount',
      cell: (exp) => (
        <span className="font-bold text-rose-700 text-xs">
          {exp.currency} {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Date',
      cell: (exp) => <span className="text-xs text-slate-600">{exp.date}</span>,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (exp) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setExpenseToDelete(exp);
            setIsDeleteExpenseModalOpen(true);
          }}
          icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
          className="text-xs hover:bg-red-50"
          title="Delete Expense"
        />
      ),
    },
  ];

  // Transaction Ledger Columns
  const transactionColumns: Column<Transaction>[] = [
    {
      header: 'Type',
      cell: (txn) => (
        <Badge variant={txn.type === 'income' ? 'green' : 'red'}>
          {txn.type === 'income' ? '+ Revenue' : '- Expense'}
        </Badge>
      ),
    },
    {
      header: 'Description',
      cell: (txn) => (
        <div>
          <div className="text-xs font-medium text-slate-900">{txn.description}</div>
          <div className="text-[11px] text-slate-400 capitalize">{txn.category.replace('_', ' ')}</div>
        </div>
      ),
    },
    {
      header: 'Amount',
      cell: (txn) => (
        <span
          className={`font-bold text-xs ${
            txn.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {txn.type === 'income' ? '+' : '-'}${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Date',
      cell: (txn) => <span className="text-xs text-slate-600">{txn.date}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance, Invoicing & Agency Expenses"
        description="Issue client invoices with automated itemization & tax calculations, record partial/full payments with overpayment prevention, and track internal operational costs."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowDownRight className="w-3.5 h-3.5" />}
              onClick={() => {
                setExpenseDate(new Date().toISOString().split('T')[0]);
                setExpenseError('');
                setIsExpenseModalOpen(true);
              }}
            >
              Record Expense
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setInvoiceDueDate(
                  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                );
                setInvoiceFormError('');
                setIsInvoiceModalOpen(true);
              }}
            >
              Create Invoice
            </Button>
          </div>
        }
      />

      {/* Finance Stat Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Outstanding Invoices</span>
            <ArrowUpRight className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              ${stats.outstandingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {stats.unpaidCount} invoice(s) awaiting payment
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Collected Revenue (Total)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
              ${stats.collectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {payments.length} verified payment receipt(s)
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Agency Operating Costs</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-rose-700 tabular-nums">
              ${stats.expensesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {expenses.length} recorded expense item(s)
            </p>
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: 'invoices', label: 'Client Invoices', count: invoices.length },
          { id: 'payments', label: 'Payment Receipts', count: payments.length },
          { id: 'expenses', label: 'Agency Expenses', count: expenses.length },
          { id: 'ledger', label: 'Transaction Ledger', count: transactions.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab: Invoices */}
      {activeTab === 'invoices' && (
        <Card>
          <CardHeader
            title="Invoicing Ledger"
            subtitle="Manage client invoices with itemized deliverables, automatic tax calculation, and partial payment recording."
          />
          {invoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-6 h-6 text-slate-400" />}
              title="No invoices currently issued"
              description="Create structured retainer invoices with automated itemized services and payment instructions."
              actionLabel="Create Invoice"
              onAction={() => setIsInvoiceModalOpen(true)}
            />
          ) : (
            <Table
              columns={invoiceColumns}
              data={invoices}
              keyExtractor={(inv) => inv.id}
            />
          )}
        </Card>
      )}

      {/* Tab: Payments */}
      {activeTab === 'payments' && (
        <Card>
          <CardHeader
            title="Payment Receipts & Collections"
            subtitle="All verified client payments recorded against issued invoices."
          />
          {payments.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="w-6 h-6 text-slate-400" />}
              title="No payments recorded yet"
              description="Payments recorded against invoices will appear here in chronological order."
            />
          ) : (
            <Table
              columns={paymentColumns}
              data={payments}
              keyExtractor={(p) => p.id}
            />
          )}
        </Card>
      )}

      {/* Tab: Expenses */}
      {activeTab === 'expenses' && (
        <Card>
          <CardHeader
            title="Agency Operating Expenses"
            subtitle="Strictly internal agency costs (servers, proxies, software tools, freelancer fees)."
          />
          {expenses.length === 0 ? (
            <EmptyState
              icon={<ArrowDownRight className="w-6 h-6 text-slate-400" />}
              title="No operating expenses recorded"
              description="Record recurring infrastructure or operational costs to monitor agency net margin."
              actionLabel="Record Expense"
              onAction={() => setIsExpenseModalOpen(true)}
            />
          ) : (
            <Table
              columns={expenseColumns}
              data={expenses}
              keyExtractor={(exp) => exp.id}
            />
          )}
        </Card>
      )}

      {/* Tab: Ledger */}
      {activeTab === 'ledger' && (
        <Card>
          <CardHeader
            title="Financial Cashflow Ledger"
            subtitle="Combined ledger of inbound client payments and outbound operational expenses."
          />
          {transactions.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="w-6 h-6 text-slate-400" />}
              title="Ledger is empty"
              description="Income and expense records will automatically generate here when payments or expenses are logged."
            />
          ) : (
            <Table
              columns={transactionColumns}
              data={transactions}
              keyExtractor={(t) => t.id}
            />
          )}
        </Card>
      )}

      {/* MODAL 1: Create Invoice */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title="Issue New Client Invoice"
        description="Line items automatically calculate subtotal, tax percentage, discount, and balance due."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateInvoiceSubmit} autoComplete="off" className="space-y-4">
          {invoiceFormError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{invoiceFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Client Organization <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                value={invoiceCurrency}
                onChange={(e) => setInvoiceCurrency(e.target.value as 'USD' | 'BDT')}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="BDT">BDT (৳ - Bangladeshi Taka)</option>
                <option value="USD">USD ($ - United States Dollar)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              type="date"
              label="Due Date"
              value={invoiceDueDate}
              onChange={(e) => setInvoiceDueDate(e.target.value)}
              autoComplete="off"
              required
            />
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              label="Tax Rate (%)"
              value={invoiceTaxRate}
              onChange={(e) => setInvoiceTaxRate(parseFloat(e.target.value) || 0)}
              helperText="E.g. 5 for 5% VAT / Sales Tax"
              autoComplete="off"
            />
            <Input
              type="number"
              min="0"
              step="1"
              label={`Discount (${invoiceCurrency === 'BDT' ? '৳' : '$'})`}
              value={invoiceDiscount}
              onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
              autoComplete="off"
            />
          </div>

          {/* Line Items Builder */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Itemized Services & Deliverables</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus className="w-3 h-3" />}
                onClick={() =>
                  setLineItems([
                    ...lineItems,
                    { description: '', quantity: 1, unitPrice: 0 },
                  ])
                }
              >
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {lineItems.map((item, index) => {
                const rowAmount = Math.round((item.quantity || 1) * (item.unitPrice || 0) * 100) / 100;
                return (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-200">
                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Service description"
                        value={item.description}
                        autoComplete="off"
                        onChange={(e) => {
                          const updated = [...lineItems];
                          updated[index].description = e.target.value;
                          setLineItems(updated);
                        }}
                        className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        autoComplete="off"
                        onChange={(e) => {
                          const updated = [...lineItems];
                          updated[index].quantity = parseInt(e.target.value) || 1;
                          setLineItems(updated);
                        }}
                        className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none text-right"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        value={item.unitPrice}
                        autoComplete="off"
                        onChange={(e) => {
                          const updated = [...lineItems];
                          updated[index].unitPrice = parseFloat(e.target.value) || 0;
                          setLineItems(updated);
                        }}
                        className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none text-right"
                        required
                      />
                    </div>
                    <div className="col-span-1 text-right text-xs font-semibold text-slate-700">
                      {invoiceCurrency === 'BDT' ? '৳' : '$'}{rowAmount}
                    </div>
                    <div className="col-span-1 text-right">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setLineItems(lineItems.filter((_, i) => i !== index));
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calculations Breakdown */}
            <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800">
                  {invoiceCurrency} {invoiceCalculations.subtotal.toFixed(2)}
                </span>
              </div>
              {invoiceCalculations.tax > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({invoiceTaxRate}%):</span>
                  <span className="font-semibold text-slate-800">
                    +{invoiceCurrency} {invoiceCalculations.tax.toFixed(2)}
                  </span>
                </div>
              )}
              {invoiceCalculations.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-semibold">
                    -{invoiceCurrency} {invoiceCalculations.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Amount Due:</span>
                <span className="text-blue-700">
                  {invoiceCurrency} {invoiceCalculations.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <Input
            label="Payment Notes & Wire Instructions"
            value={invoiceNotes}
            onChange={(e) => setInvoiceNotes(e.target.value)}
            placeholder="E.g. Pay via Eastern Bank wire or bKash Merchant 01700000000"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsInvoiceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={invoiceSubmitting}
            >
              {invoiceSubmitting ? 'Generating Invoice...' : 'Issue Invoice'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Record Payment (Partial / Full with Overpayment Guard) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Payment Receipt"
        description="Records a partial or full payment against the selected invoice via an atomic Firestore transaction."
        maxWidth="md"
      >
        {selectedInvoiceForPayment && (
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
            {paymentError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Invoice Summary Banner */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-semibold text-slate-800">{selectedInvoiceForPayment.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client:</span>
                <span className="font-semibold text-slate-800">{selectedInvoiceForPayment.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Invoice Amount:</span>
                <span className="font-semibold text-slate-800">
                  {selectedInvoiceForPayment.currency} {selectedInvoiceForPayment.totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already Paid:</span>
                <span className="font-semibold text-emerald-700">
                  {selectedInvoiceForPayment.currency} {(selectedInvoiceForPayment.paidAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                <span className="text-rose-700">Remaining Balance Due:</span>
                <span className="text-rose-700">
                  {selectedInvoiceForPayment.currency} {selectedInvoiceForPayment.balanceDue.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(selectedInvoiceForPayment.balanceDue)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                >
                  Pay Full Balance (${selectedInvoiceForPayment.balanceDue})
                </button>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedInvoiceForPayment.balanceDue}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                required
                error={
                  paymentAmount > selectedInvoiceForPayment.balanceDue
                    ? 'Payment amount exceeds balance due (overpayment prohibited)'
                    : undefined
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="bank_transfer">Bank Wire / ACH</option>
                  <option value="stripe">Stripe</option>
                  <option value="bkash">bKash Merchant</option>
                  <option value="nagad">Nagad</option>
                  <option value="wise">Wise</option>
                  <option value="cash">Cash / Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <Input
                type="date"
                label="Payment Date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <Input
              label="Transaction / Reference ID"
              placeholder="E.g. TrxID 9K48LA or Wire Ref 00291"
              value={paymentRefNumber}
              onChange={(e) => setPaymentRefNumber(e.target.value)}
            />

            <Input
              label="Payment Notes"
              placeholder="Optional notes regarding confirmation receipt"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={
                  paymentSubmitting ||
                  paymentAmount <= 0 ||
                  paymentAmount > selectedInvoiceForPayment.balanceDue
                }
              >
                {paymentSubmitting ? 'Recording...' : 'Confirm Payment'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: Record Agency Operating Expense */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record Agency Operational Expense"
        description="Records internal operational overhead (servers, software tools, proxies) in the agency financial ledger."
        maxWidth="md"
      >
        <form onSubmit={handleCreateExpenseSubmit} className="space-y-4">
          {expenseError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{expenseError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Expense Category <span className="text-red-500">*</span>
            </label>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="Server & Tracking Infrastructure">Server & Tracking Infrastructure (Stape, Cloud Run)</option>
              <option value="Software & SaaS">Software & SaaS (Looker, Figma, Google Workspace)</option>
              <option value="Media & Ad Credits">Ad Credits & Agency Media Testing</option>
              <option value="Freelancer & Contractors">Freelancer & Contractor Fees</option>
              <option value="Office & Miscellaneous">Office & Miscellaneous</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Vendor / Provider"
              placeholder="E.g. Stape.io or Google Cloud"
              value={expenseVendor}
              onChange={(e) => setExpenseVendor(e.target.value)}
              required
            />
            <Input
              type="date"
              label="Date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              label="Amount"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                value={expenseCurrency}
                onChange={(e) => setExpenseCurrency(e.target.value as 'USD' | 'BDT')}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="USD">USD ($)</option>
                <option value="BDT">BDT (৳)</option>
              </select>
            </div>
          </div>

          <Input
            label="Description / Purpose"
            placeholder="E.g. Monthly server-side tagging hosting for client containers"
            value={expenseDescription}
            onChange={(e) => setExpenseDescription(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpenseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={expenseSubmitting}
            >
              {expenseSubmitting ? 'Recording...' : 'Record Expense'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Invoice Confirmation Modal */}
      <Modal
        isOpen={isDeleteInvoiceModalOpen}
        onClose={() => {
          setIsDeleteInvoiceModalOpen(false);
          setInvoiceToDelete(null);
        }}
        title="Permanently Delete Invoice"
        description="Are you sure you want to permanently delete this invoice? This action cannot be undone."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteInvoiceModalOpen(false);
                setInvoiceToDelete(null);
              }}
              disabled={isDeletingInvoice}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteInvoiceConfirm}
              loading={isDeletingInvoice}
            >
              Permanently Delete Invoice
            </Button>
          </>
        }
      >
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-800 space-y-1">
          <p className="font-semibold">{invoiceToDelete?.invoiceNumber} - {invoiceToDelete?.clientName}</p>
          <p className="text-slate-600">Total: {invoiceToDelete?.currency} {invoiceToDelete?.totalAmount}</p>
          <p className="text-red-700 font-medium mt-2">
            Warning: This action deletes the invoice document from Cloud Firestore.
          </p>
        </div>
      </Modal>

      {/* Delete Expense Confirmation Modal */}
      <Modal
        isOpen={isDeleteExpenseModalOpen}
        onClose={() => {
          setIsDeleteExpenseModalOpen(false);
          setExpenseToDelete(null);
        }}
        title="Permanently Delete Expense Record"
        description="Are you sure you want to permanently delete this operating expense?"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteExpenseModalOpen(false);
                setExpenseToDelete(null);
              }}
              disabled={isDeletingExpense}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteExpenseConfirm}
              loading={isDeletingExpense}
            >
              Delete Expense
            </Button>
          </>
        }
      >
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-800 space-y-1">
          <p className="font-semibold">{expenseToDelete?.vendor} - {expenseToDelete?.category}</p>
          <p className="text-slate-600">Amount: {expenseToDelete?.currency} {expenseToDelete?.amount}</p>
        </div>
      </Modal>
    </div>
  );
}
