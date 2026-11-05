export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'voided';
export type PaymentMethod = 'bank_transfer' | 'stripe' | 'bkash' | 'nagad' | 'wise' | 'other';

export interface InvoiceItem {
  id: string;
  description: string;
  serviceCategory?: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
  discount: number;
  totalAmount: number;
  currency: 'BDT' | 'USD';
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyExpense {
  id: string;
  category: 'tool_subscription' | 'contractor' | 'server_hosting' | 'office' | 'marketing' | 'other';
  description: string;
  vendor: string;
  amount: number;
  currency: 'BDT' | 'USD';
  date: string;
  recordedByUserId: string;
  receiptUrl?: string;
  // STRICT: Internal agency only. Never exposed to clients.
}
