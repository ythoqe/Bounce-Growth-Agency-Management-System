import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../firebase/client';
import { Invoice, Payment, Expense } from '../../types/finance';
import { ClientProfile, ClientStatus } from '../../types/client';

export interface DashboardKPIs {
  totalRevenue: number; // Cash received
  totalReceivables: number; // Outstanding balance due
  totalExpenses: number;
  netProfit: number;
  collectionRate: number; // Percentage of billed revenue collected
  profitMargin: number; // Percentage
  totalInvoicesCount: number;
  unpaidInvoicesCount: number;
  activeClientsCount: number;
}

export interface MonthlyFinancialData {
  monthKey: string; // YYYY-MM
  monthName: string; // e.g. "Jun", "Jul", "Aug"
  fullLabel: string; // e.g. "Jun 2026"
  revenue: number;
  expenses: number;
  netProfit: number;
}

export interface LeadConversionStatusData {
  name: string;
  status: ClientStatus;
  value: number;
  color: string;
  percentage: number;
}

/**
 * Generate month buckets for the last N months (default 6 months)
 */
export function getLastNMonths(n = 6): { key: string; shortLabel: string; fullLabel: string }[] {
  const result: { key: string; shortLabel: string; fullLabel: string }[] = [];
  const now = new Date();

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const shortLabel = d.toLocaleDateString('en-US', { month: 'short' });
    const fullLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    result.push({ key, shortLabel, fullLabel });
  }

  return result;
}

/**
 * 1. KPI Calculations based on real Firestore records
 */
export function calculateKPIs(
  payments: Payment[],
  invoices: Invoice[],
  expenses: Expense[],
  clients: ClientProfile[]
): DashboardKPIs {
  // Cash received: sum of payments (or sum of paidAmount on invoices if payments empty)
  const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const invoicePaidTotal = invoices.reduce((sum, i) => sum + (Number(i.paidAmount) || 0), 0);
  const totalRevenue = Math.max(paymentsTotal, invoicePaidTotal);

  // Total receivables: sum of balanceDue on unpaid, partial, or issued invoices
  const totalReceivables = invoices
    .filter((inv) => inv.status !== 'paid' && inv.status !== 'voided')
    .reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);

  // Total expenses
  const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // Net Profit: Revenue - Expenses
  const netProfit = totalRevenue - totalExpenses;

  // Collection Rate
  const totalBilled = totalRevenue + totalReceivables;
  const collectionRate = totalBilled > 0 ? Math.round((totalRevenue / totalBilled) * 100) : 100;

  // Profit Margin
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // Counts
  const unpaidInvoicesCount = invoices.filter(
    (inv) => inv.status !== 'paid' && inv.status !== 'voided' && (inv.balanceDue || 0) > 0
  ).length;

  const activeClientsCount = clients.filter(
    (c) => c.status === 'active' || c.status === 'onboarding'
  ).length;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalReceivables: Math.round(totalReceivables * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    collectionRate,
    profitMargin,
    totalInvoicesCount: invoices.length,
    unpaidInvoicesCount,
    activeClientsCount,
  };
}

/**
 * 2. Bar Chart: Monthly Revenue vs Expenses for the last 6 months
 */
export function calculateMonthlyRevenueVsExpenses(
  payments: Payment[],
  expenses: Expense[],
  invoices: Invoice[],
  monthCount = 6
): MonthlyFinancialData[] {
  const buckets = getLastNMonths(monthCount);

  return buckets.map((bucket) => {
    // 1. Calculate Revenue for this month from payments or invoice paid dates
    const monthPayments = payments.filter((p) => {
      const dateStr = p.paymentDate || p.createdAt;
      return dateStr && dateStr.startsWith(bucket.key);
    });

    let monthRevenue = monthPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Fallback if payments collection has no entries for this month but invoices do
    if (monthRevenue === 0) {
      const monthInvoices = invoices.filter((i) => {
        const dateStr = i.paidAt || i.issueDate || i.createdAt;
        return dateStr && dateStr.startsWith(bucket.key);
      });
      monthRevenue = monthInvoices.reduce((sum, i) => sum + (Number(i.paidAmount) || 0), 0);
    }

    // 2. Calculate Expenses for this month
    const monthExpenses = expenses.filter((e) => {
      const dateStr = e.date || e.createdAt;
      return dateStr && dateStr.startsWith(bucket.key);
    });
    const expTotal = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    return {
      monthKey: bucket.key,
      monthName: bucket.shortLabel,
      fullLabel: bucket.fullLabel,
      revenue: Math.round(monthRevenue),
      expenses: Math.round(expTotal),
      netProfit: Math.round(monthRevenue - expTotal),
    };
  });
}

/**
 * 3. Pie Chart: Lead Conversion Status
 */
export const STATUS_COLOR_MAP: Record<ClientStatus, { label: string; color: string }> = {
  active: { label: 'Active Retainer', color: '#10B981' }, // Emerald
  onboarding: { label: 'In Onboarding', color: '#3B82F6' }, // Blue
  lead: { label: 'New Inquiries & Leads', color: '#6366F1' }, // Indigo
  paused: { label: 'Paused Accounts', color: '#F59E0B' }, // Amber
  churned: { label: 'Churned', color: '#EF4444' }, // Rose
  archived: { label: 'Archived', color: '#94A3B8' }, // Slate
};

export function calculateLeadConversionStatus(clients: ClientProfile[]): {
  data: LeadConversionStatusData[];
  totalLeads: number;
  conversionRate: number;
} {
  const total = clients.length;
  if (total === 0) {
    return { data: [], totalLeads: 0, conversionRate: 0 };
  }

  const counts: Partial<Record<ClientStatus, number>> = {};
  clients.forEach((c) => {
    const st = c.status || 'lead';
    counts[st] = (counts[st] || 0) + 1;
  });

  const orderedStatuses: ClientStatus[] = ['active', 'onboarding', 'lead', 'paused', 'churned'];

  const data: LeadConversionStatusData[] = orderedStatuses
    .filter((st) => (counts[st] || 0) > 0)
    .map((st) => {
      const val = counts[st] || 0;
      const cfg = STATUS_COLOR_MAP[st] || { label: st, color: '#64748B' };
      return {
        name: cfg.label,
        status: st,
        value: val,
        color: cfg.color,
        percentage: Math.round((val / total) * 100),
      };
    });

  const activeCount = counts['active'] || 0;
  const onboardingCount = counts['onboarding'] || 0;
  const conversionRate = Math.round(((activeCount + onboardingCount) / total) * 100);

  return {
    data,
    totalLeads: total,
    conversionRate,
  };
}

/**
 * Auto-seed initial realistic financial and lead records (Permanently turned off per user request)
 */
export async function autoSeedInitialFinanceAndLeadsIfEmpty(): Promise<void> {
  // Autofill and demo seeding permanently disabled.
  return;
}
