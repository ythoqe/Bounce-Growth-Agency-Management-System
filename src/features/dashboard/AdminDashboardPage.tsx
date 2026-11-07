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
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuth } from '../auth/AuthContext';
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
import {
  calculateKPIs,
  calculateMonthlyRevenueVsExpenses,
  calculateLeadConversionStatus,
  autoSeedInitialFinanceAndLeadsIfEmpty,
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

  // Subscriptions
  useEffect(() => {
    // 1. Trigger initial seed if Firestore finance collections are blank
    autoSeedInitialFinanceAndLeadsIfEmpty();

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

    return () => {
      unsubClients();
      unsubProjects();
      unsubAssets();
      unsubInvoices();
      unsubPayments();
      unsubExpenses();
    };
  }, [currentRole, currentUser]);

  // Real-Time Calculations from Firestore
  const kpis = useMemo(() => {
    return calculateKPIs(payments, invoices, expenses, clients);
  }, [payments, invoices, expenses, clients]);

  const monthlyChartData = useMemo(() => {
    return calculateMonthlyRevenueVsExpenses(payments, expenses, invoices, 6);
  }, [payments, expenses, invoices]);

  const leadConversion = useMemo(() => {
    return calculateLeadConversionStatus(clients);
  }, [clients]);

  // Operational metrics
  const activeClients = useMemo(
    () => clients.filter((c) => c.status === 'active' || c.status === 'onboarding'),
    [clients]
  );
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed' && p.status !== 'archived'),
    [projects]
  );
  const activeAssets = useMemo(
    () => assets.filter((a) => a.status !== 'archived'),
    [assets]
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
            <span className="font-mono font-semibold">${rev.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-rose-400">
            <span>Total Expenses:</span>
            <span className="font-mono font-semibold">${exp.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-bold">
            <span className={profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>Net Profit:</span>
            <span className={`font-mono ${profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {profit >= 0 ? `+$${profit.toLocaleString()}` : `-$${Math.abs(profit).toLocaleString()}`}
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Agency Executive Dashboard"
        description="Real-time financial performance, revenue receivables, cashflow margins, and lead conversion telemetry streamed from Cloud Firestore."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Receipt className="w-3.5 h-3.5 text-blue-600" />}
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

      {/* --------------------------------------------------------------------- */}
      {/* 1. MANDATORY FINANCIAL KPI SECTION                                   */}
      {/* --------------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Financial Key Performance Indicators (Firestore Live)
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            Collection Rate: <strong className="text-slate-900">{kpis.collectionRate}%</strong>
          </span>
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
                ${kpis.totalRevenue.toLocaleString()}
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
                ${kpis.totalReceivables.toLocaleString()}
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
                ${kpis.totalExpenses.toLocaleString()}
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
                  ? `$${kpis.netProfit.toLocaleString()}`
                  : `-$${Math.abs(kpis.netProfit).toLocaleString()}`}
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
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
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
                ${Math.round(kpis.totalRevenue / 6).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Avg Monthly Expenses</p>
              <p className="font-bold text-slate-800 font-mono mt-0.5">
                ${Math.round(kpis.totalExpenses / 6).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">6-Month Net Run-Rate</p>
              <p className="font-bold text-emerald-600 font-mono mt-0.5">
                +${kpis.netProfit.toLocaleString()}
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
                    <Sparkles className="w-4 h-4" />
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
    </div>
  );
}
