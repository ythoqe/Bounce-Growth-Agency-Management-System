import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText,
  Plus,
  CreditCard,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ArrowUpDown,
  Building2,
  Calendar,
  X,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { useAuth } from '../auth/AuthContext';
import { Invoice, PaymentMethod } from '../../types/finance';
import { createInvoice, recordPayment, subscribeInvoices } from '../../services/financeService';
import { subscribeClients } from '../../services/clients/clientService';
import { ClientProfile } from '../../types/client';

// ---------------------------------------------------------------------------
// Zod Schemas for Type-Safe Form Validation
// ---------------------------------------------------------------------------

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required'),
  quantity: z.coerce.number().min(1, 'Qty must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Price must be 0 or greater'),
});

const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Please select a client organization'),
  dueDate: z.string().min(1, 'Due date is required'),
  currency: z.enum(['USD', 'BDT']),
  taxRate: z.coerce.number().min(0, 'Tax rate cannot be negative').max(100, 'Max tax rate is 100%'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative'),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
});

type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;

const addPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.enum(['bank_transfer', 'stripe', 'bkash', 'nagad', 'wise', 'cash', 'other']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

type AddPaymentFormData = z.infer<typeof addPaymentSchema>;

export function InvoicesPage() {
  const { currentUser, currentRole } = useAuth();

  // Firestore Real-time data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Submission messages
  const [serverError, setServerError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // React Hook Form: Create Invoice
  // ---------------------------------------------------------------------------
  const {
    register: registerInvoice,
    control: controlInvoice,
    handleSubmit: handleInvoiceSubmit,
    watch: watchInvoice,
    reset: resetInvoiceForm,
    formState: { errors: invoiceErrors, isSubmitting: isInvoiceSubmitting },
  } = useForm<CreateInvoiceFormData>({
    resolver: zodResolver(createInvoiceSchema) as any,
    defaultValues: {
      clientId: '',
      currency: 'USD',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      taxRate: 0,
      discount: 0,
      notes: '',
      items: [{ description: 'Performance Marketing & Retainer', quantity: 1, unitPrice: 1500 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: controlInvoice,
    name: 'items',
  });

  // Watch fields for live calculation inside modal
  const watchedItems = watchInvoice('items');
  const watchedTaxRate = watchInvoice('taxRate') || 0;
  const watchedDiscount = watchInvoice('discount') || 0;
  const watchedCurrency = watchInvoice('currency') || 'USD';

  const liveCalculations = useMemo(() => {
    const items = watchedItems || [];
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
    const tax = watchedTaxRate > 0 ? (subtotal * watchedTaxRate) / 100 : 0;
    const discount = Math.max(0, Number(watchedDiscount) || 0);
    const total = Math.max(0, subtotal + tax - discount);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [watchedItems, watchedTaxRate, watchedDiscount]);

  // ---------------------------------------------------------------------------
  // React Hook Form: Add Payment (Small Modal)
  // ---------------------------------------------------------------------------
  const {
    register: registerPayment,
    handleSubmit: handlePaymentSubmit,
    reset: resetPaymentForm,
    setValue: setPaymentValue,
    formState: { errors: paymentErrors, isSubmitting: isPaymentSubmitting },
  } = useForm<AddPaymentFormData>({
    resolver: zodResolver(addPaymentSchema) as any,
    defaultValues: {
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      referenceNumber: '',
      notes: '',
    },
  });

  // ---------------------------------------------------------------------------
  // Real-time Subscriptions
  // ---------------------------------------------------------------------------
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
      currentUser,
      (err) => console.error(err)
    );

    return () => {
      unsubClients();
      unsubInvoices();
    };
  }, [currentRole, currentUser]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const onSubmitCreateInvoice = async (data: CreateInvoiceFormData) => {
    setServerError(null);
    setActionSuccess(null);

    const client = clients.find((c) => c.id === data.clientId);
    if (!client) {
      setServerError('Selected client organization was not found.');
      return;
    }

    if (!currentUser) return;

    try {
      const created = await createInvoice(
        {
          clientId: client.id,
          clientName: client.businessName,
          dueDate: data.dueDate,
          currency: data.currency,
          taxRate: data.taxRate,
          discount: data.discount,
          notes: data.notes,
          items: data.items,
          status: 'issued',
        },
        currentUser
      );

      setIsCreateModalOpen(false);
      resetInvoiceForm();
      setActionSuccess(`Invoice #${created.invoiceNumber} successfully created.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to create invoice.');
    }
  };

  const onOpenAddPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setServerError(null);
    resetPaymentForm({
      amount: invoice.balanceDue,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      referenceNumber: '',
      notes: '',
    });
    setIsPaymentModalOpen(true);
  };

  const onSubmitAddPayment = async (data: AddPaymentFormData) => {
    if (!selectedInvoice) return;
    setServerError(null);

    // Overpayment guard
    if (data.amount > selectedInvoice.balanceDue) {
      setServerError(
        `Overpayment prohibited: Entered amount (${selectedInvoice.currency} ${data.amount}) exceeds remaining balance due (${selectedInvoice.currency} ${selectedInvoice.balanceDue}).`
      );
      return;
    }

    if (!currentUser) return;

    try {
      const result = await recordPayment(
        {
          invoiceId: selectedInvoice.id,
          amount: data.amount,
          paymentDate: data.paymentDate,
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
        },
        currentUser
      );

      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
      setActionSuccess(
        `Recorded ${result.invoice.currency} ${data.amount.toFixed(2)} payment against Invoice ${result.invoice.invoiceNumber}. Balance remaining: ${result.invoice.currency} ${result.invoice.balanceDue.toFixed(2)}.`
      );
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to record payment.');
    }
  };

  // ---------------------------------------------------------------------------
  // Status Badge Helper: Paid, Unpaid, Partial
  // ---------------------------------------------------------------------------
  const renderStatusBadge = (invoice: Invoice) => {
    if (invoice.status === 'paid' || invoice.balanceDue <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Paid
        </span>
      );
    }

    if (invoice.status === 'partially_paid' || (invoice.paidAmount > 0 && invoice.balanceDue > 0)) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          Partial
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        Unpaid
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // Filtered Invoices
  // ---------------------------------------------------------------------------
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.clientName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'all') return true;
      if (statusFilter === 'paid') return inv.status === 'paid' || inv.balanceDue <= 0;
      if (statusFilter === 'partial')
        return inv.status === 'partially_paid' || (inv.paidAmount > 0 && inv.balanceDue > 0);
      if (statusFilter === 'unpaid')
        return inv.status !== 'paid' && inv.status !== 'partially_paid' && inv.paidAmount === 0;

      return true;
    });
  }, [invoices, searchQuery, statusFilter]);

  if (currentRole !== 'admin') {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl my-6">
        <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">Restricted Administrative Area</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Client invoicing and billing ledger operations are restricted exclusively to Admin role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Client Invoices"
        description="Issue professional agency invoices, track real-time payments, and manage client billing balances."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setServerError(null);
              setIsCreateModalOpen(true);
            }}
          >
            Create Invoice
          </Button>
        }
      />

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {serverError && !isCreateModalOpen && !isPaymentModalOpen && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{serverError}</span>
          </div>
          <button onClick={() => setServerError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search invoice # or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            {(['all', 'unpaid', 'partial', 'paid'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  statusFilter === filterKey
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filterKey === 'all'
                  ? `All (${invoices.length})`
                  : filterKey === 'unpaid'
                  ? `Unpaid (${invoices.filter((i) => i.status !== 'paid' && i.status !== 'partially_paid' && i.paidAmount === 0).length})`
                  : filterKey === 'partial'
                  ? `Partial (${invoices.filter((i) => i.status === 'partially_paid' || (i.paidAmount > 0 && i.balanceDue > 0)).length})`
                  : `Paid (${invoices.filter((i) => i.status === 'paid' || i.balanceDue <= 0).length})`}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Data Table */}
      <Card>
        <CardHeader
          title="All Issued Invoices"
          subtitle="Real-time billing records showing invoice number, client, totals, paid amounts, remaining balances, and status."
        />

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading invoices from database...</div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6 text-slate-400" />}
            title="No invoices found"
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try modifying your search or status filter criteria.'
                : 'Click "Create Invoice" above to generate your first client retainer invoice.'
            }
            actionLabel={searchQuery || statusFilter !== 'all' ? undefined : 'Create Invoice'}
            onAction={searchQuery || statusFilter !== 'all' ? undefined : () => setIsCreateModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Client Name</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredInvoices.map((invoice) => {
                  const isSettled = invoice.status === 'paid' || invoice.balanceDue <= 0;

                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 1. Invoice Number */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 font-mono">{invoice.invoiceNumber}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> Due {invoice.dueDate}
                        </div>
                      </td>

                      {/* 2. Client Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{invoice.clientName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{invoice.items?.length || 0} line item(s)</div>
                      </td>

                      {/* 3. Total Amount */}
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                        {invoice.currency} {invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* 4. Paid Amount */}
                      <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                        {invoice.currency} {(invoice.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* 5. Balance Due */}
                      <td className="px-4 py-3.5 text-right font-bold text-rose-600">
                        {invoice.currency} {(invoice.balanceDue ?? invoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* 6. Status (Paid, Unpaid, Partial) */}
                      <td className="px-4 py-3.5 text-center">
                        {renderStatusBadge(invoice)}
                      </td>

                      {/* 7. Action: Add Payment */}
                      <td className="px-4 py-3.5 text-right">
                        {!isSettled ? (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                            onClick={() => onOpenAddPaymentModal(invoice)}
                          >
                            Add Payment
                          </Button>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-700 px-2.5 py-1 bg-emerald-50 rounded border border-emerald-200">
                            Fully Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* =========================================================================
          MODAL 1: Create Invoice (React Hook Form + Zod)
      ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setServerError(null);
        }}
        title="Create New Invoice"
        description="Itemize agency deliverables. Subtotal, tax, discount, and total are auto-calculated."
        maxWidth="lg"
      >
        <form onSubmit={handleInvoiceSubmit(onSubmitCreateInvoice)} className="space-y-4">
          {serverError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Client & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Client Organization <span className="text-red-500">*</span>
              </label>
              <select
                {...registerInvoice('clientId')}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.country})
                  </option>
                ))}
              </select>
              {invoiceErrors.clientId && (
                <p className="text-[11px] text-rose-600 mt-1">{invoiceErrors.clientId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                {...registerInvoice('currency')}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="USD">USD ($ - United States Dollar)</option>
                <option value="BDT">BDT (৳ - Bangladeshi Taka)</option>
              </select>
            </div>
          </div>

          {/* Due Date, Tax Rate, Discount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...registerInvoice('dueDate')}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {invoiceErrors.dueDate && (
                <p className="text-[11px] text-rose-600 mt-1">{invoiceErrors.dueDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                {...registerInvoice('taxRate')}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {invoiceErrors.taxRate && (
                <p className="text-[11px] text-rose-600 mt-1">{invoiceErrors.taxRate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Discount Amount
              </label>
              <input
                type="number"
                step="1"
                min="0"
                {...registerInvoice('discount')}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {invoiceErrors.discount && (
                <p className="text-[11px] text-rose-600 mt-1">{invoiceErrors.discount.message}</p>
              )}
            </div>
          </div>

          {/* Dynamic Line Items */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Itemized Services</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus className="w-3 h-3" />}
                onClick={() => append({ description: '', quantity: 1, unitPrice: 500 })}
              >
                Add Item
              </Button>
            </div>

            {invoiceErrors.items && (
              <p className="text-[11px] text-rose-600">{invoiceErrors.items.message}</p>
            )}

            <div className="space-y-2">
              {fields.map((field, index) => {
                const itemQty = Number(watchedItems?.[index]?.quantity) || 1;
                const itemPrice = Number(watchedItems?.[index]?.unitPrice) || 0;
                const lineAmount = Math.round(itemQty * itemPrice * 100) / 100;

                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-200">
                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Description (e.g. Server-Side GTM Setup)"
                        {...registerInvoice(`items.${index}.description` as const)}
                        className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                      {invoiceErrors.items?.[index]?.description && (
                        <span className="text-[10px] text-rose-600 block">
                          {invoiceErrors.items[index]?.description?.message}
                        </span>
                      )}
                    </div>

                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        {...registerInvoice(`items.${index}.quantity` as const)}
                        className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none text-right"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit Price"
                        {...registerInvoice(`items.${index}.unitPrice` as const)}
                        className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none text-right"
                      />
                    </div>

                    <div className="col-span-1 text-right text-xs font-semibold text-slate-800">
                      ${lineAmount}
                    </div>

                    <div className="col-span-1 text-right">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
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

            {/* Live Calculation Summary */}
            <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800">
                  {watchedCurrency} {liveCalculations.subtotal.toFixed(2)}
                </span>
              </div>
              {liveCalculations.tax > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({watchedTaxRate}%):</span>
                  <span className="font-semibold text-slate-800">
                    +{watchedCurrency} {liveCalculations.tax.toFixed(2)}
                  </span>
                </div>
              )}
              {liveCalculations.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-semibold">
                    -{watchedCurrency} {liveCalculations.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Amount Due:</span>
                <span className="text-blue-700">
                  {watchedCurrency} {liveCalculations.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Instructions / Wire Notes
            </label>
            <input
              type="text"
              placeholder="E.g. Pay via Eastern Bank Wire or bKash Merchant 01700000000"
              {...registerInvoice('notes')}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isInvoiceSubmitting}
            >
              {isInvoiceSubmitting ? 'Issuing Invoice...' : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: Add Payment (Small Modal to record partial payment)
      ========================================================================= */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
          setServerError(null);
        }}
        title="Add Payment"
        description="Record a partial or full payment receipt against this invoice."
        maxWidth="sm"
      >
        {selectedInvoice && (
          <form onSubmit={handlePaymentSubmit(onSubmitAddPayment)} className="space-y-4">
            {serverError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Quick summary strip */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-semibold text-slate-800">{selectedInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client:</span>
                <span className="font-semibold text-slate-800">{selectedInvoice.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total:</span>
                <span className="font-semibold text-slate-800">
                  {selectedInvoice.currency} {selectedInvoice.totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already Paid:</span>
                <span className="font-semibold text-emerald-700">
                  {selectedInvoice.currency} {(selectedInvoice.paidAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                <span className="text-rose-700">Balance Due:</span>
                <span className="text-rose-700">
                  {selectedInvoice.currency} {selectedInvoice.balanceDue.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPaymentValue('amount', selectedInvoice.balanceDue)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                >
                  Pay Full (${selectedInvoice.balanceDue})
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedInvoice.balanceDue}
                {...registerPayment('amount')}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {paymentErrors.amount && (
                <p className="text-[11px] text-rose-600 mt-1">{paymentErrors.amount.message}</p>
              )}
            </div>

            {/* Method & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Method <span className="text-red-500">*</span>
                </label>
                <select
                  {...registerPayment('paymentMethod')}
                  className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="bank_transfer">Bank Wire</option>
                  <option value="stripe">Stripe</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="wise">Wise</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  {...registerPayment('paymentDate')}
                  className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference / Transaction ID
              </label>
              <input
                type="text"
                placeholder="E.g. TrxID 9K48LA or Wire Ref"
                {...registerPayment('referenceNumber')}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setSelectedInvoice(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPaymentSubmitting}
              >
                {isPaymentSubmitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
