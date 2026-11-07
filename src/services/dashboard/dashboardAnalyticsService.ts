import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/client';
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
 * Auto-seed initial realistic financial and lead records if Firestore is blank
 */
let isSeedingFinance = false;

export async function autoSeedInitialFinanceAndLeadsIfEmpty(): Promise<void> {
  if (isSeedingFinance) return;

  try {
    const invoicesSnap = await getDocs(collection(db, 'invoices'));
    if (!invoicesSnap.empty) {
      return; // Already populated
    }

    isSeedingFinance = true;
    console.log('[DashboardAnalytics] Auto-seeding initial 6-month financial & lead dataset into Firestore...');

    const now = new Date();

    // 1. Seed initial Clients if empty
    const clientsSnap = await getDocs(collection(db, 'clients'));
    if (clientsSnap.empty) {
      const seedClients: Partial<ClientProfile>[] = [
        {
          id: 'client_apex_01',
          businessName: 'Apex Retail BD',
          contactPerson: 'Zubair Ahmed',
          email: 'ceo@apexretailbd.com',
          status: 'active',
          businessType: 'E-commerce & Retail',
          monthlyRetainer: 2500,
          currency: 'USD',
          country: 'Bangladesh',
          createdAt: new Date(now.getFullYear(), now.getMonth() - 5, 10).toISOString(),
        },
        {
          id: 'client_aura_02',
          businessName: 'Aura Lifestyle BD',
          contactPerson: 'Nabila Karim',
          email: 'growth@auralifestyle.com',
          status: 'active',
          businessType: 'Fashion & Apparel',
          monthlyRetainer: 1800,
          currency: 'USD',
          country: 'Bangladesh',
          createdAt: new Date(now.getFullYear(), now.getMonth() - 4, 15).toISOString(),
        },
        {
          id: 'client_bengal_03',
          businessName: 'Bengal Organic Foods',
          contactPerson: 'Tanvir Hasan',
          email: 'tanvir@bengalorganics.com',
          status: 'onboarding',
          businessType: 'Direct-to-Consumer (D2C)',
          monthlyRetainer: 1500,
          currency: 'USD',
          country: 'Bangladesh',
          createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 20).toISOString(),
        },
        {
          id: 'client_dhaka_04',
          businessName: 'Dhaka Logistics Tech',
          contactPerson: 'Arif Chowdhury',
          email: 'arif@dhakalogistics.io',
          status: 'lead',
          businessType: 'B2B Logistics SaaS',
          monthlyRetainer: 2000,
          currency: 'USD',
          country: 'Bangladesh',
          createdAt: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
        },
        {
          id: 'client_artisan_05',
          businessName: 'Artisan Wear Dhaka',
          contactPerson: 'Farhana Hossain',
          email: 'farhana@artisanwear.com',
          status: 'lead',
          businessType: 'Handmade Apparel',
          monthlyRetainer: 1200,
          currency: 'USD',
          country: 'Bangladesh',
          createdAt: new Date(now.getFullYear(), now.getMonth(), 4).toISOString(),
        },
        {
          id: 'client_shwapno_06',
          businessName: 'Shwapno Express Partner',
          contactPerson: 'Mahmudul Islam',
          email: 'partner@shwapnoexpress.com',
          status: 'paused',
          businessType: 'Supermarket Fast Delivery',
          monthlyRetainer: 3000,
          currency: 'USD',
          country: 'Bangladesh',
          createdAt: new Date(now.getFullYear(), now.getMonth() - 3, 5).toISOString(),
        },
        {
          id: 'client_craft_07',
          businessName: 'Craft Leather BD',
          contactPerson: 'Imran Khan',
          email: 'imran@craftleatherbd.com',
          status: 'churned',
          businessType: 'Leather Goods Export',
          monthlyRetainer: 800,
          currency: 'USD',
          country: 'Bangladesh',
          createdAt: new Date(now.getFullYear(), now.getMonth() - 4, 1).toISOString(),
        },
      ];

      for (const client of seedClients) {
        await setDoc(doc(db, 'clients', client.id!), client);
      }
    }

    // 2. Seed 6 Months of Invoices, Payments, and Expenses
    const monthConfigs = [
      { offset: 5, rev: 4500, exp: 1200, client: 'Apex Retail BD', clientId: 'client_apex_01', desc: 'Meta Ads & GTM Setup' },
      { offset: 4, rev: 6200, exp: 1850, client: 'Aura Lifestyle BD', clientId: 'client_aura_02', desc: 'Full Funnel Ad Scale' },
      { offset: 3, rev: 7800, exp: 2100, client: 'Apex Retail BD', clientId: 'client_apex_01', desc: 'Server-Side CAPI Retainer' },
      { offset: 2, rev: 9400, exp: 2750, client: 'Aura Lifestyle BD', clientId: 'client_aura_02', desc: 'Performance Growth Retainer' },
      { offset: 1, rev: 11200, exp: 3200, client: 'Apex Retail BD', clientId: 'client_apex_01', desc: 'Omnichannel Tracking Retainer' },
      { offset: 0, rev: 12500, exp: 3450, client: 'Aura Lifestyle BD', clientId: 'client_aura_02', desc: 'Current Month Growth Retainer' },
    ];

    for (let i = 0; i < monthConfigs.length; i++) {
      const cfg = monthConfigs[i];
      const d = new Date(now.getFullYear(), now.getMonth() - cfg.offset, 15);
      const dateStr = d.toISOString();
      const monthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const invId = `inv_seed_${i + 1}`;
      const payId = `pay_seed_${i + 1}`;
      const expId = `exp_seed_${i + 1}`;

      // Paid Invoice
      await setDoc(doc(db, 'invoices', invId), {
        id: invId,
        invoiceNumber: `BG-INV-2026-00${i + 1}`,
        clientId: cfg.clientId,
        clientName: cfg.client,
        status: 'paid',
        issueDate: dateStr,
        dueDate: new Date(d.getTime() + 86400000 * 14).toISOString(),
        items: [
          {
            id: `item_${i + 1}`,
            description: cfg.desc,
            quantity: 1,
            unitPrice: cfg.rev,
            amount: cfg.rev,
          },
        ],
        subtotal: cfg.rev,
        tax: 0,
        discount: 0,
        totalAmount: cfg.rev,
        paidAmount: cfg.rev,
        balanceDue: 0,
        currency: 'USD',
        paidAt: dateStr,
        createdAt: dateStr,
        updatedAt: dateStr,
      });

      // Payment receipt
      await setDoc(doc(db, 'payments', payId), {
        id: payId,
        invoiceId: invId,
        clientId: cfg.clientId,
        clientName: cfg.client,
        amount: cfg.rev,
        paymentDate: `${monthPrefix}-16`,
        paymentMethod: 'bank_transfer',
        referenceNumber: `TRX-BG-${monthPrefix.replace('-', '')}-${i + 100}`,
        recordedBy: 'usr_admin_bounce',
        recordedByName: 'Founder & Head of Growth',
        createdAt: dateStr,
      });

      // Operational Expense
      await setDoc(doc(db, 'expenses', expId), {
        id: expId,
        category: 'Server & Tracking Infrastructure',
        description: 'Stape.io Cloud Run instances & BigQuery ETL',
        vendor: 'Google Cloud Platform & Stape',
        amount: cfg.exp,
        currency: 'USD',
        date: `${monthPrefix}-10`,
        recordedByUserId: 'usr_admin_bounce',
        createdAt: dateStr,
      });
    }

    // 3. Current Month Outstanding Receivables (Unpaid invoice)
    const unpaidInvId = 'inv_seed_outstanding_current';
    await setDoc(doc(db, 'invoices', unpaidInvId), {
      id: unpaidInvId,
      invoiceNumber: 'BG-INV-2026-007',
      clientId: 'client_apex_01',
      clientName: 'Apex Retail BD',
      status: 'issued',
      issueDate: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
      dueDate: new Date(now.getFullYear(), now.getMonth(), 25).toISOString(),
      items: [
        {
          id: 'item_out_1',
          description: 'Q4 Conversion Rate Optimization & GA4 BigQuery Pipeline',
          quantity: 1,
          unitPrice: 5400,
          amount: 5400,
        },
      ],
      subtotal: 5400,
      tax: 0,
      discount: 0,
      totalAmount: 5400,
      paidAmount: 0,
      balanceDue: 5400,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('[DashboardAnalytics] Auto-seed complete. 6 months of data ready in Firestore.');
  } catch (err) {
    console.warn('[DashboardAnalytics] Auto-seed check finished:', err);
  } finally {
    isSeedingFinance = false;
  }
}
