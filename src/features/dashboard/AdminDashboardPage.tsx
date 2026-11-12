import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Receipt,
  Users,
  UserCheck,
  Activity,
  Briefcase,
  ArrowUpRight,
  Plus,
  Server,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Calendar,
  X,
  FileDown,
  Loader2,
  SlidersHorizontal,
  Filter,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../auth/AuthContext';
import { exportDashboardPdfReport } from '../../services/reports/dashboardPdfService';
import { ClientProfile } from '../../types/client';
import { Project } from '../../types/project';
import { TrackingAsset } from '../../types/asset';
import { Invoice, Payment, Expense } from '../../types/finance';
import { subscribeClients } from '../../services/clients/clientService';
import { subscribeProjects } from '../../services/projects/projectService';
import { subscribeAssets } from '../../services/assets/assetService';
import {
  subscribeInvoices,
  subscribePayments,
  subscribeExpenses,
} from '../../services/financeService';
import { subscribePendingUsers } from '../../services/users/userService';
import { UserProfile } from '../../types/user';
import {
  calculateKPIs,
  calculateMonthlyRevenueVsExpenses,
  calculateLeadConversionStatus,
  MonthlyFinancialData,
  LeadConversionStatusData,
} from '../../services/dashboard/dashboardAnalyticsService';
import { formatCurrency } from '../../utils/formatters';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { currentRole, currentUser, firebaseStatus } = useAuth();

  // Firestore Real-Time State
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<TrackingAsset[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // PDF Export Feature State
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState('Executive Analytics & Performance Report');
  const [pdfCurrency, setPdfCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [pdfIncludeKPIs, setPdfIncludeKPIs] = useState(true);
  const [pdfIncludeMonthly, setPdfIncludeMonthly] = useState(true);
  const [pdfIncludeClients, setPdfIncludeClients] = useState(true);
  const [pdfIncludePipeline, setPdfIncludePipeline] = useState(true);
  const [pdfIncludeAssets, setPdfIncludeAssets] = useState(true);
  const [pdfNotes, setPdfNotes] = useState('');
  const [pdfNotification, setPdfNotification] = useState<string | null>(null);

  // Dashboard Filters State
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | '30d' | '90d' | 'ytd'>('all');
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);

  // Subscriptions
  useEffect(() => {

    const actor = {
      id: currentUser?.id || 'usr_admin_bounce',
      uid: currentUser?.id || 'usr_admin_bounce',
      email: currentUser?.email || 'founder@bouncegrowth.com',
      role: (currentRole || 'admin') as 'admin' | 'team' | 'client',
    };

    const unsubClients = subscribeClients(
      (data) => setClients(data),
      (err) => console.warn('[AdminDashboard clients warning]', err)
    );

    const unsubProjects = subscribeProjects(
      (data) => setProjects(data),
      (err) => console.warn('[AdminDashboard projects warning]', err)
    );

    const unsubAssets = subscribeAssets(
      (data) => setAssets(data),
      (err) => console.warn('[AdminDashboard assets warning]', err)
    );

    const unsubInvoices = subscribeInvoices(
      undefined,
      (data) => {
        setInvoices(data);
        setLoading(false);
      },
      actor,
      (err) => console.warn('[AdminDashboard invoices warning]', err)
    );

    const unsubPayments = subscribePayments(
      undefined,
      (data) => setPayments(data),
      actor,
      (err) => console.warn('[AdminDashboard payments warning]', err)
    );

    const unsubExpenses = subscribeExpenses(
      (data) => setExpenses(data),
      actor,
      (err) => console.warn('[AdminDashboard expenses warning]', err)
    );

    const unsubPending = subscribePendingUsers(
      (data) => setPendingUsers(data),
      (err) => console.warn('[AdminDashboard pending users note]', err)
    );

    return () => {
      unsubClients();
      unsubProjects();
      unsubAssets();
      unsubInvoices();
      unsubPayments();
      unsubExpenses();
      unsubPending();
    };
  }, [currentRole, currentUser]);

  // Filtered collections based on selected client & date range
  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (selectedClientFilter !== 'all') {
      result = result.filter((i) => i.clientId === selectedClientFilter);
    }
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      if (dateRangeFilter === '30d') cutoff.setDate(now.getDate() - 30);
      else if (dateRangeFilter === '90d') cutoff.setDate(now.getDate() - 90);
      else if (dateRangeFilter === 'ytd') cutoff = new Date(now.getFullYear(), 0, 1);
      result = result.filter((i) => new Date(i.issueDate || i.createdAt) >= cutoff);
    }
    return result;
  }, [invoices, selectedClientFilter, dateRangeFilter]);

  const filteredPayments = useMemo(() => {
    let result = payments;
    if (selectedClientFilter !== 'all') {
      result = result.filter((p) => p.clientId === selectedClientFilter);
    }
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      if (dateRangeFilter === '30d') cutoff.setDate(now.getDate() - 30);
      else if (dateRangeFilter === '90d') cutoff.setDate(now.getDate() - 90);
      else if (dateRangeFilter === 'ytd') cutoff = new Date(now.getFullYear(), 0, 1);
      result = result.filter((p) => new Date(p.paymentDate || p.createdAt) >= cutoff);
    }
    return result;
  }, [payments, selectedClientFilter, dateRangeFilter]);

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      if (dateRangeFilter === '30d') cutoff.setDate(now.getDate() - 30);
      else if (dateRangeFilter === '90d') cutoff.setDate(now.getDate() - 90);
      else if (dateRangeFilter === 'ytd') cutoff = new Date(now.getFullYear(), 0, 1);
      result = result.filter((e) => new Date(e.date || e.createdAt) >= cutoff);
    }
    return result;
  }, [expenses, dateRangeFilter]);

  const filteredClients = useMemo(() => {
    if (selectedClientFilter === 'all') return clients;
    return clients.filter((c) => c.id === selectedClientFilter);
  }, [clients, selectedClientFilter]);

  const filteredProjects = useMemo(() => {
    if (selectedClientFilter === 'all') return projects;
    return projects.filter((p) => p.clientId === selectedClientFilter);
  }, [projects, selectedClientFilter]);

  const filteredAssets = useMemo(() => {
    if (selectedClientFilter === 'all') return assets;
    return assets.filter((a) => a.clientId === selectedClientFilter);
  }, [assets, selectedClientFilter]);

  // Real-Time Calculations from Firestore using filtered telemetry
  const kpis = useMemo(() => {
    return calculateKPIs(filteredPayments, filteredInvoices, filteredExpenses, filteredClients);
  }, [filteredPayments, filteredInvoices, filteredExpenses, filteredClients]);

  const monthlyChartData = useMemo(() => {
    return calculateMonthlyRevenueVsExpenses(filteredPayments, filteredExpenses, filteredInvoices, 6);
  }, [filteredPayments, filteredExpenses, filteredInvoices]);

  const leadConversion = useMemo(() => {
    return calculateLeadConversionStatus(filteredClients);
  }, [filteredClients]);

  // Operational metrics
  const activeClients = useMemo(
    () => filteredClients.filter((c) => c.status === 'active' || c.status === 'onboarding'),
    [filteredClients]
  );
  const activeProjects = useMemo(
    () => filteredProjects.filter((p) => p.status !== 'completed' && p.status !== 'archived'),
    [filteredProjects]
  );
  const activeAssets = useMemo(
    () => filteredAssets.filter((a) => a.status !== 'archived'),
    [filteredAssets]
  );

  // Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const rev = payload.find((p: any) => p.dataKey === 'revenue')?.value || 0;
      const exp = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0;
      const profit = rev - exp;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[170px]">
          <p className="font-bold text-slate-300 border-b border-slate-800 pb-1">{label}</p>
          <div className="flex justify-between items-center text-emerald-400">
            <span>Revenue (Cash):</span>
            <span className="font-mono font-semibold">৳{rev.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-rose-400">
            <span>Total Expenses:</span>
            <span className="font-mono font-semibold">৳{exp.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-bold">
            <span className={profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>Net Profit:</span>
            <span className={`font-mono ${profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {profit >= 0 ? `+৳${profit.toLocaleString()}` : `-৳${Math.abs(profit).toLocaleString()}`}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as LeadConversionStatusData;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-xl border border-slate-700 text-xs">
          <p className="font-bold text-slate-200">{data.name}</p>
          <p className="text-slate-400 mt-0.5">
            <span className="font-mono font-semibold text-white">{data.value}</span> organizations ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const handleQuickExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfNotification(null);
    try {
      await exportDashboardPdfReport(
        {
          kpis,
          monthlyChartData,
          leadConversion,
          clients: filteredClients,
          projects: filteredProjects,
          assets: filteredAssets,
          invoices: filteredInvoices,
          payments: filteredPayments,
          expenses: filteredExpenses,
        },
        {
          reportTitle: 'Executive Analytics & Performance Report',
          currency: 'BDT',
          includeKPIs: true,
          includeMonthlyTrend: true,
          includeClientRoster: true,
          includeLeadFunnel: true,
          includeTrackingAssets: true,
          generatedByName: currentUser?.displayName || 'Agency Principal',
          generatedByEmail: currentUser?.email || 'founder@bouncegrowth.com',
        }
      );
      setPdfNotification('Executive PDF report generated and downloaded successfully!');
      setTimeout(() => setPdfNotification(null), 5000);
    } catch (err: any) {
      console.error('Quick PDF export error:', err);
      setPdfNotification(`PDF Generation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCustomExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await exportDashboardPdfReport(
        {
          kpis,
          monthlyChartData,
          leadConversion,
          clients: filteredClients,
          projects: filteredProjects,
          assets: filteredAssets,
          invoices: filteredInvoices,
          payments: filteredPayments,
          expenses: filteredExpenses,
        },
        {
          reportTitle: pdfTitle.trim() || 'Executive Analytics & Performance Report',
          currency: pdfCurrency,
          notes: pdfNotes.trim(),
          includeKPIs: pdfIncludeKPIs,
          includeMonthlyTrend: pdfIncludeMonthly,
          includeClientRoster: pdfIncludeClients,
          includeLeadFunnel: pdfIncludePipeline,
          includeTrackingAssets: pdfIncludeAssets,
          generatedByName: currentUser?.displayName || 'Agency Principal',
          generatedByEmail: currentUser?.email || 'founder@bouncegrowth.com',
        }
      );
      setIsPdfModalOpen(false);
      setPdfNotification('Custom Executive PDF report downloaded successfully!');
      setTimeout(() => setPdfNotification(null), 5000);
    } catch (err: any) {
      console.error('Custom PDF export error:', err);
      setPdfNotification(`PDF Generation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Agency Executive Dashboard"
        description="Real-time financial performance, revenue receivables, cashflow margins, and lead conversion telemetry streamed from Cloud Firestore."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={
                isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <FileDown className="w-3.5 h-3.5 text-blue-600" />
                )
              }
              onClick={() => setIsPdfModalOpen(true)}
              disabled={isExportingPdf}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              {isExportingPdf ? 'Generating PDF...' : 'Export PDF Report'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Receipt className="w-3.5 h-3.5 text-slate-600" />}
              onClick={() => navigate('/finance/invoices')}
            >
              Manage Invoices
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/admin/clients')}
            >
              New Client Lead
            </Button>
          </div>
        }
      />

      {/* Database Status Ribbon */}
      <div className="px-4 py-2.5 rounded-xl border border-emerald-200/90 bg-emerald-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-emerald-950">
            Cloud Firestore Live Financial Engine Active
          </span>
          <span className="hidden md:inline text-emerald-800">
            • Real-time calculations: Invoices ({invoices.length}), Payments ({payments.length}), Expenses ({expenses.length}), Clients ({clients.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-emerald-800 font-semibold bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
            Project: {firebaseStatus.projectId}
          </span>
        </div>
      </div>

      {pdfNotification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{pdfNotification}</span>
          </div>
          <button onClick={() => setPdfNotification(null)} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pendingUsers.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">
                  {pendingUsers.length} Client {pendingUsers.length === 1 ? 'Representative' : 'Representatives'} Awaiting Approval
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-bold">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                New contacts signed in via Google and need organization assignment to access their portal.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/clients')}
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-semibold cursor-pointer"
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Review & 1-Click Approve ({pendingUsers.length})
          </Button>
        </div>
      )}

      {/* Dashboard Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Dashboard Filter:</span>
          </div>

          {/* Client Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Client:</span>
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px]"
            >
              <option value="all">All Clients ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: '30d', label: 'Last 30 Days' },
                { id: '90d', label: 'Last 90 Days' },
                { id: 'ytd', label: 'YTD (This Year)' },
              ] as const
            ).map((rng) => (
              <button
                key={rng.id}
                type="button"
                onClick={() => setDateRangeFilter(rng.id)}
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
                  dateRangeFilter === rng.id
                    ? 'bg-white text-blue-600 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rng.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear Filter button if filters active */}
        {(selectedClientFilter !== 'all' || dateRangeFilter !== 'all') && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Filtered View Active
            </span>
            <button
              onClick={() => {
                setSelectedClientFilter('all');
                setDateRangeFilter('all');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. MANDATORY FINANCIAL KPI SECTION                                   */}
      {/* --------------------------------------------------------------------- */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Financial Key Performance Indicators (BDT ৳ Live)
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono">
              Collection Rate: <strong className="text-slate-900">{kpis.collectionRate}%</strong>
            </span>
            <button
              onClick={handleQuickExportPdf}
              disabled={isExportingPdf}
              title="Instantly generate and download Executive PDF Report"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors shadow-2xs"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>Quick PDF Report</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue (Cash Received) */}
          <Card className="p-5 border-l-4 border-l-emerald-500 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Revenue (Cash Received)</span>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                ৳{kpis.totalRevenue.toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold mt-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{payments.length} verified payment deposits</span>
              </div>
            </div>
          </Card>

          {/* Total Receivables (Outstanding Invoices) */}
          <Card className="p-5 border-l-4 border-l-blue-500 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Receivables (Outstanding)</span>
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                ৳{kpis.totalReceivables.toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-medium mt-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>{kpis.unpaidInvoicesCount} unpaid/partial invoices pending</span>
              </div>
            </div>
          </Card>

          {/* Total Expenses */}
          <Card className="p-5 border-l-4 border-l-rose-500 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Operating Expenses</span>
              <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                ৳{kpis.totalExpenses.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {expenses.length} tracked vendor & tool costs
              </p>
            </div>
          </Card>

          {/* Net Profit */}
          <Card
            className={`p-5 border-l-4 shadow-xs hover:shadow-md transition-shadow ${
              kpis.netProfit >= 0 ? 'border-l-teal-500' : 'border-l-amber-500'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Net Profit</span>
              <div
                className={`p-2 rounded-lg ${
                  kpis.netProfit >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl font-black tracking-tight font-mono ${
                  kpis.netProfit >= 0 ? 'text-teal-950' : 'text-rose-600'
                }`}
              >
                {kpis.netProfit >= 0
                  ? `৳${kpis.netProfit.toLocaleString()}`
                  : `-৳${Math.abs(kpis.netProfit).toLocaleString()}`}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 mt-1">
                <span className="font-mono text-teal-700">{kpis.profitMargin}%</span>
                <span>net agency margin</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. CHARTS SECTION (RECHARTS BAR & PIE)                               */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BAR CHART: Monthly Revenue vs Expenses (Last 6 Months) */}
        <Card className="lg:col-span-2 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  Monthly Revenue vs Expenses (Last 6 Months)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregated cash deposits vs operational expenditures from Cloud Firestore
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                  Last 6 Months
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/finance')}
                  className="text-xs h-7 text-blue-600"
                >
                  Finance Ledger
                </Button>
              </div>
            </div>

            {/* Recharts Bar Chart Container */}
            <div className="pt-4 w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 20, right: 15, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="monthName"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `৳${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 16, fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue (Cash Received)"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Operating Expenses"
                    fill="#F43F5E"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-[11px] text-slate-400">Avg Monthly Cash</p>
              <p className="font-bold text-slate-800 font-mono mt-0.5">
                ৳{Math.round(kpis.totalRevenue / 6).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Avg Monthly Expenses</p>
              <p className="font-bold text-slate-800 font-mono mt-0.5">
                ৳{Math.round(kpis.totalExpenses / 6).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">6-Month Net Run-Rate</p>
              <p className="font-bold text-emerald-600 font-mono mt-0.5">
                +৳{kpis.netProfit.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        {/* PIE CHART: Lead Conversion Status */}
        <Card className="p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-indigo-600" />
                  Lead Conversion Status
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client acquisition & conversion funnel
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/crm')}
                className="text-xs h-7 text-indigo-600"
              >
                CRM Leads
              </Button>
            </div>

            {/* Recharts Pie Chart Container */}
            <div className="relative pt-2 w-full h-[240px] flex items-center justify-center">
              {leadConversion.data.length === 0 ? (
                <div className="text-center text-xs text-slate-400">No leads recorded in Firestore</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leadConversion.data}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {leadConversion.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Metric Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-black text-slate-900 font-mono">
                      {leadConversion.conversionRate}%
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Conversion
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Breakdown Legend List */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            {leadConversion.data.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-slate-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 font-mono">{item.value}</span>
                  <span className="text-slate-400 font-mono text-[10px]">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. CORE AGENCY OPERATIONAL METRICS & OVERVIEWS                         */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Projects & Active Client Accounts */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Active Agency Projects & Sprints"
              subtitle="Meta Ads, Server-Side GTM, and GA4 telemetry deployments"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/projects')}
                  icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                >
                  View All ({projects.length})
                </Button>
              }
            />
            {projects.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="w-6 h-6 text-slate-400" />}
                title="No active projects logged yet"
                description="Create projects linked to clients to assign specialists, track progress percentages, and control client visibility."
                actionLabel="Create First Project"
                onAction={() => navigate('/admin/projects')}
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {projects.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {p.clientName} · <span className="uppercase font-semibold">{p.status}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="tabular-nums font-mono font-bold text-blue-600 block">
                          {p.progressPercentage || 0}%
                        </span>
                        <span className="text-[10px] text-slate-400">Completed</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/admin/projects')}
                        className="h-7 text-xs"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Client Retainers & Accounts"
              subtitle="Direct-to-consumer and retail accounts under active management"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/clients')}
                  icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                >
                  Manage Clients ({clients.length})
                </Button>
              }
            />
            {clients.length === 0 ? (
              <EmptyState
                icon={<Users className="w-6 h-6 text-slate-400" />}
                title="No clients currently registered"
                description="Add your first client business to start managing campaigns, tracking assets, and client portal access."
                actionLabel="Add Client Organization"
                onAction={() => navigate('/admin/clients')}
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {clients.slice(0, 4).map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{c.businessName}</p>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            c.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'onboarding'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {c.contactPerson} · {c.businessType || 'D2C Brand'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums font-mono font-bold text-slate-900">
                        {formatCurrency(c.monthlyRetainer || 0, c.currency)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/admin/clients')}
                        className="h-7 text-xs"
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Tracking Health & Quick Links */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Tracking Health Protocol"
              subtitle="Bounce Growth Core Telemetry"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/assets')}
                  icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                >
                  Assets ({assets.length})
                </Button>
              }
            />
            <div className="space-y-3 pt-2">
              {[
                {
                  name: 'Meta CAPI Redundancy',
                  desc: 'Server-to-server event deduplication',
                  count: assets.filter((a) => a.assetType === 'meta_capi').length,
                },
                {
                  name: 'Server-Side GTM',
                  desc: 'Stape / Cloud Run container health',
                  count: assets.filter(
                    (a) => a.assetType === 'gtm_server' || a.assetType === 'stape'
                  ).length,
                },
                {
                  name: 'GA4 Enhanced E-commerce',
                  desc: 'Purchase and funnel telemetry',
                  count: assets.filter((a) => a.assetType === 'ga4').length,
                },
                {
                  name: 'TikTok Events API',
                  desc: 'Web & server-side sync',
                  count: assets.filter((a) => a.assetType === 'tiktok_events_api').length,
                },
              ].map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between text-xs py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{svc.name}</p>
                    <p className="text-[11px] text-slate-500">{svc.desc}</p>
                  </div>
                  <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded tabular-nums font-semibold">
                    {svc.count} active
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Quick Financial Actions"
              subtitle="Speed shortcuts for agency directors"
            />
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => navigate('/finance/invoices')}
                className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex items-center justify-between text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block group-hover:text-blue-700">
                      Create & Issue Invoice
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Auto-calculates subtotal, tax & balance due
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/marketing/content')}
                className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all flex items-center justify-between text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block group-hover:text-emerald-700">
                      Marketing Content Calendar
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Plan ad hooks & multi-channel drops
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/documents')}
                className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all flex items-center justify-between text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block group-hover:text-purple-700">
                      Cloud Storage Documents
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Upload SLAs & client deliverables
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Export Executive PDF Report Modal */}
      <Modal
        isOpen={isPdfModalOpen}
        onClose={() => !isExportingPdf && setIsPdfModalOpen(false)}
        title="Export Executive Analytics & Performance PDF"
        description="Generate a formatted, publication-ready PDF audit containing live agency KPIs, financial trends, retainer rosters, and tracking infrastructure telemetry."
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500">
              Generated via <strong className="text-slate-700">jsPDF engine</strong> • Synchronized with live Firestore
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPdfModalOpen(false)}
                disabled={isExportingPdf}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={
                  isExportingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )
                }
                onClick={handleCustomExportPdf}
                disabled={isExportingPdf}
              >
                {isExportingPdf ? 'Compiling PDF...' : 'Download PDF Report'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5 text-xs text-slate-700">
          {/* Report Title */}
          <div>
            <label className="block font-semibold text-slate-900 mb-1">
              Document Header Title
            </label>
            <input
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="e.g. Executive Analytics & Performance Report"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Currency Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-900 mb-1">
                Display Currency
              </label>
              <select
                value={pdfCurrency}
                onChange={(e) => setPdfCurrency(e.target.value as 'BDT' | 'USD')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="BDT">BDT (৳ - Bangladeshi Taka)</option>
                <option value="USD">USD ($ - US Dollars)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Values will be formatted cleanly as official currency denominations.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-900 mb-1">
                Report Confidentiality & Signatory
              </label>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <p className="font-semibold text-slate-800">
                  {currentUser?.displayName || 'Agency Principal'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {currentUser?.email || 'founder@bouncegrowth.com'} • Verified Audit
                </p>
              </div>
            </div>
          </div>

          {/* Section Inclusion Checkboxes */}
          <div>
            <label className="block font-semibold text-slate-900 mb-2">
              Select Analytics Modules to Include
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfIncludeKPIs}
                  onChange={(e) => setPdfIncludeKPIs(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Financial KPI Scorecard
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Gross Cash, Receivables, Operating Burn, Net Profit
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfIncludeMonthly}
                  onChange={(e) => setPdfIncludeMonthly(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">
                    6-Month Financial Trend Table
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Monthly Cash Inflow vs Expenses & Operating Margins
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfIncludeClients}
                  onChange={(e) => setPdfIncludeClients(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Client Retainer Roster ({clients.length})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Retainer tier, industry, subscribed tracking services
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfIncludePipeline}
                  onChange={(e) => setPdfIncludePipeline(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">
                    CRM Pipeline & Conversion Funnel
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Win rate %, lead status breakdown, active projects
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={pdfIncludeAssets}
                  onChange={(e) => setPdfIncludeAssets(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Server-Side Tracking & Asset Infrastructure ({assets.length})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Meta CAPI, Google Tag Manager server containers, and GA4 telemetry health
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Executive Remarks / Notes */}
          <div>
            <label className="block font-semibold text-slate-900 mb-1">
              Executive Brief / Auditor Remarks (Optional)
            </label>
            <textarea
              rows={3}
              value={pdfNotes}
              onChange={(e) => setPdfNotes(e.target.value)}
              placeholder="Add contextual remarks, agency milestones, or strategic commentary to appear at the top of the report..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Format preview tag */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-blue-950">Publication-Ready Document Layout</p>
              <p className="text-[11px] text-blue-800">
                A4 portrait format with multi-page automatic pagination, running headers, confidentiality disclaimers, and agency attestation signature blocks.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
