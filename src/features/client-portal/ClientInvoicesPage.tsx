import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import {
  Receipt,
  Download,
  Eye,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Lock,
  Search,
  Filter,
  FileText,
  DollarSign,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../auth/AuthContext';
import { Invoice, InvoiceItem } from '../../types/finance';
import { subscribeInvoices } from '../../services/financeService';
import { formatDate, formatCurrency } from '../../utils/formatters';

export function ClientInvoicesPage() {
  const { currentUser, currentRole } = useAuth();
  const clientId = currentUser?.clientId;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');

  // ---------------------------------------------------------------------------
  // Real-time Firestore Subscription Strictly Filtered by clientId
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Strict tenant isolation guard
    if (!currentUser || currentRole !== 'client' || !clientId) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = subscribeInvoices(
      { clientId: clientId },
      (data) => {
        // Enforce that only non-draft invoices matching the client's own clientId are kept
        const clientInvoices = data.filter(
          (inv) => inv.clientId === clientId && inv.status !== 'draft'
        );
        setInvoices(clientInvoices);
        setLoading(false);
      },
      currentUser,
      (err) => {
        console.error('[ClientInvoices subscription error]', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, currentRole, currentUser]);

  // ---------------------------------------------------------------------------
  // PDF Generation with jsPDF
  // ---------------------------------------------------------------------------
  const handleDownloadPDF = (invoice: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor: [number, number, number] = [37, 99, 235]; // #2563EB Blue
    const textColor: [number, number, number] = [30, 41, 59]; // #1E293B Dark Slate
    const mutedColor: [number, number, number] = [100, 116, 139]; // #64748B Slate-500
    const lightBg: [number, number, number] = [248, 250, 252]; // #F8FAFC

    // Top Header Banner
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('BOUNCE GROWTH', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Digital Growth & Tracking Agency — Client Invoice', 14, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('OFFICIAL RECEIPT', 196, 17, { align: 'right' });

    // Invoice Meta Information
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 14, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text(`Issue Date: ${invoice.issueDate || '—'}`, 14, 46);
    doc.text(`Due Date: ${invoice.dueDate || '—'}`, 14, 52);

    const isPaid = invoice.status === 'paid' || invoice.balanceDue <= 0;
    const isPartial = invoice.status === 'partially_paid' || (invoice.paidAmount > 0 && invoice.balanceDue > 0);
    const statusLabel = isPaid ? 'PAID IN FULL' : isPartial ? 'PARTIALLY PAID' : 'PAYMENT DUE';

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(
      isPaid ? 16 : isPartial ? 217 : 225,
      isPaid ? 185 : isPartial ? 119 : 29,
      isPaid ? 129 : isPartial ? 6 : 72
    );
    doc.text(`Status: ${statusLabel}`, 14, 58);

    // Billed To (Client info)
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BILLED TO:', 125, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(invoice.clientName || currentUser?.displayName || 'Client Organization', 125, 46);
    doc.setTextColor(...mutedColor);
    doc.text(`Client ID: ${invoice.clientId}`, 125, 52);

    // Line Items Table Header
    let y = 68;
    doc.setFillColor(...lightBg);
    doc.rect(14, y, 182, 8, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 8, 196, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...textColor);
    doc.text('DESCRIPTION', 18, y + 5.5);
    doc.text('QTY', 125, y + 5.5, { align: 'right' });
    doc.text('UNIT PRICE', 155, y + 5.5, { align: 'right' });
    doc.text('AMOUNT', 192, y + 5.5, { align: 'right' });

    // Line Items Content
    y += 13;
    const items = invoice.items || [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    items.forEach((item) => {
      doc.setTextColor(...textColor);
      doc.text(item.description || 'Deliverable Item', 18, y);
      doc.text(String(item.quantity || 1), 125, y, { align: 'right' });
      doc.text(`${invoice.currency} ${(item.unitPrice || 0).toFixed(2)}`, 155, y, { align: 'right' });
      doc.text(`${invoice.currency} ${(item.amount || 0).toFixed(2)}`, 192, y, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 3, 196, y + 3);
      y += 8;
    });

    // Financial Breakdown Summary
    y += 4;
    const summaryX = 125;
    const summaryValX = 192;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedColor);
    doc.text('Subtotal:', summaryX, y);
    doc.setTextColor(...textColor);
    doc.text(`${invoice.currency} ${(invoice.subtotal || invoice.totalAmount).toFixed(2)}`, summaryValX, y, {
      align: 'right',
    });

    if (invoice.tax && invoice.tax > 0) {
      y += 5.5;
      doc.setTextColor(...mutedColor);
      doc.text(`Tax / VAT${invoice.taxRate ? ` (${invoice.taxRate}%)` : ''}:`, summaryX, y);
      doc.setTextColor(...textColor);
      doc.text(`+${invoice.currency} ${invoice.tax.toFixed(2)}`, summaryValX, y, { align: 'right' });
    }

    if (invoice.discount && invoice.discount > 0) {
      y += 5.5;
      doc.setTextColor(...mutedColor);
      doc.text('Discount:', summaryX, y);
      doc.setTextColor(16, 185, 129);
      doc.text(`-${invoice.currency} ${invoice.discount.toFixed(2)}`, summaryValX, y, { align: 'right' });
    }

    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(summaryX - 5, y, 196, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textColor);
    doc.text('Total Amount:', summaryX, y);
    doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, summaryValX, y, { align: 'right' });

    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(5, 150, 105);
    doc.text('Paid Amount:', summaryX, y);
    doc.text(`${invoice.currency} ${(invoice.paidAmount || 0).toFixed(2)}`, summaryValX, y, { align: 'right' });

    y += 6;
    doc.setFillColor(254, 242, 242);
    doc.rect(summaryX - 6, y - 4, 78, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(225, 29, 72);
    doc.text('Balance Due:', summaryX, y + 2);
    doc.text(`${invoice.currency} ${(invoice.balanceDue ?? invoice.totalAmount).toFixed(2)}`, summaryValX, y + 2, {
      align: 'right',
    });

    // Payment Instructions & Wire Notes
    y += 18;
    if (invoice.notes) {
      doc.setFillColor(...lightBg);
      doc.roundedRect(14, y, 182, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...textColor);
      doc.text('Payment Instructions / Wire Notes:', 18, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...mutedColor);
      doc.text(invoice.notes, 18, y + 12);
    }

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(
      'Thank you for partnering with Bounce Growth. For questions, contact finance@bouncegrowth.com.',
      105,
      285,
      { align: 'center' }
    );

    doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
  };

  // Status mapping
  const renderStatusBadge = (invoice: Invoice) => {
    if (invoice.status === 'paid' || invoice.balanceDue <= 0) {
      return <Badge variant="green">Paid in Full</Badge>;
    }
    if (invoice.status === 'partially_paid' || (invoice.paidAmount > 0 && invoice.balanceDue > 0)) {
      return <Badge variant="amber">Partially Paid</Badge>;
    }
    return <Badge variant="red">Unpaid / Due</Badge>;
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        searchQuery === '' ||
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'paid') return inv.status === 'paid' || inv.balanceDue <= 0;
      if (statusFilter === 'partial')
        return inv.status === 'partially_paid' || (inv.paidAmount > 0 && inv.balanceDue > 0);
      if (statusFilter === 'unpaid')
        return inv.status !== 'paid' && inv.status !== 'partially_paid' && inv.paidAmount === 0;

      return true;
    });
  }, [invoices, searchQuery, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalDue = invoices.reduce((sum, inv) => sum + (inv.balanceDue ?? inv.totalAmount), 0);
    return { totalBilled, totalPaid, totalDue };
  }, [invoices]);

  // Role Guard
  if (currentRole !== 'client') {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl my-6">
        <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">Restricted Client Portal</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Client invoices are private and accessible exclusively by authenticated Client representatives.
        </p>
      </div>
    );
  }

  // Missing Client ID Guard
  if (!clientId) {
    return (
      <div className="p-8 text-center bg-white border border-rose-200 rounded-xl my-6">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">No Client Profile Associated</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Your account is not linked to an organization clientId. Please contact your account manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Invoices & Billing History"
        description="View issued retainer invoices, itemized deliverables, payment receipts, and download PDF statements for your records."
      />

      {/* Tenant Isolation Info Strip */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">{currentUser?.displayName || 'Client Account'}</span>
              <span className="font-mono text-[10px] text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
                Client ID: {clientId}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Secure client billing view. Internal agency profit margins and draft records are completely hidden. Read-only permissions enforced.
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Read-Only View
        </span>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Invoiced</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              ${stats.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{invoices.length} total invoice(s) on record</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Paid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
              ${stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Verified payments settled</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Outstanding Balance Due</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-rose-600 tabular-nums">
              ${stats.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {invoices.filter((i) => i.status !== 'paid' && (i.balanceDue ?? i.totalAmount) > 0).length} invoice(s)
              with pending balance
            </p>
          </div>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by invoice number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            {(['all', 'unpaid', 'partial', 'paid'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  statusFilter === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {key === 'all'
                  ? `All (${invoices.length})`
                  : key === 'unpaid'
                  ? `Unpaid (${invoices.filter((i) => i.status !== 'paid' && i.status !== 'partially_paid' && i.paidAmount === 0).length})`
                  : key === 'partial'
                  ? `Partial (${invoices.filter((i) => i.status === 'partially_paid' || (i.paidAmount > 0 && i.balanceDue > 0)).length})`
                  : `Paid (${invoices.filter((i) => i.status === 'paid' || i.balanceDue <= 0).length})`}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Invoices List / Table */}
      <Card>
        <CardHeader
          title="Account Invoices"
          subtitle="Click on any invoice row to inspect itemized deliverables, subtotal, and payment balance."
        />

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading your invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-6 h-6 text-slate-400" />}
            title="No invoices found"
            description={
              searchQuery || statusFilter !== 'all'
                ? 'No invoices match your current search or status filter.'
                : 'Invoices issued by Bounce Growth for retainers or custom setups will appear here.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => setSelectedInvoice(invoice)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    {/* Invoice Number & Date */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 font-mono flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>{invoice.invoiceNumber}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Issued: {formatDate(invoice.issueDate)}</div>
                    </td>

                    {/* Due Date */}
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-slate-700">{formatDate(invoice.dueDate)}</span>
                    </td>

                    {/* Total Amount */}
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      {invoice.currency} {invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Paid Amount */}
                    <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                      {invoice.currency} {(invoice.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Balance Due */}
                    <td className="px-4 py-3.5 text-right font-bold text-rose-600">
                      {invoice.currency}{' '}
                      {(invoice.balanceDue ?? invoice.totalAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 text-center">{renderStatusBadge(invoice)}</td>

                    {/* Actions: View & Download PDF */}
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedInvoice(invoice)}
                          className="h-7 text-xs"
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<Download className="w-3.5 h-3.5" />}
                          onClick={(e) => handleDownloadPDF(invoice, e)}
                          className="h-7 text-xs"
                        >
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* =========================================================================
          INVOICE DETAIL MODAL (Line Items, Total Amount, Paid Amount, Download PDF)
      ========================================================================= */}
      {selectedInvoice && (
        <Modal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title={`Invoice ${selectedInvoice.invoiceNumber}`}
          description={`Issued to ${selectedInvoice.clientName || currentUser?.displayName}. Strict read-only statement.`}
          maxWidth="lg"
        >
          <div className="space-y-5">
            {/* Top invoice badge strip */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Status</span>
                <div className="mt-1">{renderStatusBadge(selectedInvoice)}</div>
              </div>

              <div>
                <span className="text-slate-500 block">Issue Date</span>
                <span className="font-semibold text-slate-800">{formatDate(selectedInvoice.issueDate)}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Payment Due Date</span>
                <span className="font-semibold text-slate-800">{formatDate(selectedInvoice.dueDate)}</span>
              </div>

              <div className="sm:text-right">
                <span className="text-slate-500 block">Currency</span>
                <span className="font-bold text-slate-900">{selectedInvoice.currency}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Itemized Services</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedInvoice.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/40">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.description}</td>
                        <td className="py-2.5 px-3 text-right">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right">
                          {selectedInvoice.currency} {item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                          {selectedInvoice.currency} {item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">
                  {selectedInvoice.currency} {(selectedInvoice.subtotal || selectedInvoice.totalAmount).toFixed(2)}
                </span>
              </div>

              {selectedInvoice.tax && selectedInvoice.tax > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>Tax / VAT{selectedInvoice.taxRate ? ` (${selectedInvoice.taxRate}%)` : ''}:</span>
                  <span className="font-semibold text-slate-900">
                    +{selectedInvoice.currency} {selectedInvoice.tax.toFixed(2)}
                  </span>
                </div>
              ) : null}

              {selectedInvoice.discount && selectedInvoice.discount > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-semibold">
                    -{selectedInvoice.currency} {selectedInvoice.discount.toFixed(2)}
                  </span>
                </div>
              ) : null}

              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Total Amount:</span>
                <span className="text-blue-700">
                  {selectedInvoice.currency} {selectedInvoice.totalAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-xs font-semibold text-emerald-700">
                <span>Paid Amount:</span>
                <span>
                  {selectedInvoice.currency} {(selectedInvoice.paidAmount || 0).toFixed(2)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-rose-600">
                <span>Balance Due:</span>
                <span>
                  {selectedInvoice.currency} {(selectedInvoice.balanceDue ?? selectedInvoice.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Wire / Payment Instructions */}
            {selectedInvoice.notes && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs">
                <span className="font-bold text-amber-900 block mb-0.5">Payment Instructions / Wire Notes</span>
                <p className="text-amber-800">{selectedInvoice.notes}</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 italic">Read-only document</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                >
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
