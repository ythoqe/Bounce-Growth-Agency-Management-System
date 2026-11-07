import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Receipt,
  BarChart2,
  Shield,
  ArrowUpRight,
  Clock,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Lock,
  Layers,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../auth/AuthContext';
import { Project } from '../../types/project';
import { Invoice } from '../../types/finance';
import { Deliverable } from '../../types/deliverable';
import { subscribeProjects } from '../../services/projects/projectService';
import { subscribeInvoices } from '../../services/financeService';
import { subscribeDeliverables } from '../../services/deliverables/deliverableService';
import { formatDate, formatCurrency } from '../../utils/formatters';

export function ClientDashboardPage() {
  const navigate = useNavigate();
  const { currentUser, currentRole } = useAuth();

  // Strict tenant identifier for the logged-in client representative
  const clientId = currentUser?.clientId;

  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Strict Tenant-Filtered Real-time Data Subscriptions
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Defense-in-depth: Never query Firestore without a verified clientId
    if (!currentUser || currentRole !== 'client' || !clientId) {
      setProjects([]);
      setInvoices([]);
      setDeliverables([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Fetch Active Projects strictly for this client
    const unsubProjects = subscribeProjects(
      (data) => {
        setProjects(data);
      },
      (err) => console.error('[ClientDashboard Projects Error]', err),
      { clientId: clientId, clientVisibleOnly: true }
    );

    // 2. Fetch Invoices strictly for this client
    const unsubInvoices = subscribeInvoices(
      { clientId: clientId },
      (data) => {
        setInvoices(data);
      },
      currentUser,
      (err) => console.error('[ClientDashboard Invoices Error]', err)
    );

    // 3. Fetch Latest Shared Reports & Deliverables strictly for this client
    const unsubDeliverables = subscribeDeliverables(
      { clientId: clientId },
      (data) => {
        setDeliverables(data);
        setLoading(false);
      },
      currentUser,
      (err) => console.error('[ClientDashboard Deliverables Error]', err)
    );

    return () => {
      unsubProjects();
      unsubInvoices();
      unsubDeliverables();
    };
  }, [clientId, currentRole, currentUser]);

  // Active Projects (exclude archived & completed)
  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.status !== 'archived' && p.status !== 'completed');
  }, [projects]);

  // Outstanding Invoices (unsettled balance due)
  const outstandingInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.status !== 'voided' && inv.status !== 'paid' && (inv.balanceDue ?? inv.totalAmount) > 0
    );
  }, [invoices]);

  // Total Balance Due across all unpaid/partial invoices
  const totalBalanceDue = useMemo(() => {
    return outstandingInvoices.reduce((sum, inv) => sum + (inv.balanceDue ?? inv.totalAmount), 0);
  }, [outstandingInvoices]);

  // Currency preferred (defaults to USD or client's invoice currency)
  const primaryCurrency = useMemo(() => {
    return outstandingInvoices[0]?.currency || invoices[0]?.currency || 'USD';
  }, [outstandingInvoices, invoices]);

  // Latest Shared Reports (deliverables that are shared/submitted and not drafts)
  const sharedReports = useMemo(() => {
    return deliverables.filter((d) => d.status !== 'draft');
  }, [deliverables]);

  // Status badge for Deliverables / Reports
  const getDeliverableStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="green">Approved</Badge>;
      case 'submitted':
      case 'under_review':
        return <Badge variant="blue">Ready for Review</Badge>;
      case 'revision_requested':
        return <Badge variant="amber">Revision in Progress</Badge>;
      default:
        return <Badge variant="neutral">{status.replace('_', ' ')}</Badge>;
    }
  };

  // Status badge for Invoices
  const getInvoiceStatusBadge = (inv: Invoice) => {
    if (inv.status === 'paid' || inv.balanceDue <= 0) {
      return <Badge variant="green">Paid in Full</Badge>;
    }
    if (inv.status === 'partially_paid' || (inv.paidAmount > 0 && inv.balanceDue > 0)) {
      return <Badge variant="amber">Partially Paid</Badge>;
    }
    return <Badge variant="red">Unpaid</Badge>;
  };

  // Role Guard
  if (currentRole !== 'client') {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl my-6">
        <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">Client Portal Access Restricted</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          This portal is reserved exclusively for authenticated Client representatives. Please switch to your client role to proceed.
        </p>
      </div>
    );
  }

  // Missing Client ID Guard
  if (!clientId) {
    return (
      <div className="p-8 text-center bg-white border border-rose-200 rounded-xl my-6">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">No Client Organization Linked</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Your user profile is not linked to an active client organization. Please contact your Bounce Growth account manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <PageHeader
        title="Client Workspace Overview"
        description={`Welcome back, ${currentUser?.displayName || 'Partner'}. Monitor your active campaigns, review shared deliverables, and view billing balances in real time.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/portal/support')}
          >
            Contact Account Manager
          </Button>
        }
      />

      {/* Tenant Isolation Security Strip */}
      <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {currentUser?.displayName || 'Client Account'}
              </span>
              <span className="font-mono text-[10px] text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
                Tenant: {clientId}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Strict client tenant isolation enforced. All projects, invoices, and reports are filtered exclusively for your organization.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 rounded-md shrink-0 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Data Isolated
        </span>
      </div>

      {/* Primary KPI Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Active Projects */}
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Projects</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {activeProjects.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {projects.length} total marketing & tracking engagement(s)
            </p>
          </div>
        </Card>

        {/* KPI 2: Outstanding Balance Due */}
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Outstanding Invoices Due</span>
            <Receipt className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-rose-600 tabular-nums">
              {formatCurrency(totalBalanceDue, primaryCurrency)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {outstandingInvoices.length} invoice(s) awaiting payment
            </p>
          </div>
        </Card>

        {/* KPI 3: Latest Shared Reports */}
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Shared Reports & Deliverables</span>
            <BarChart2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-purple-700 tabular-nums">
              {sharedReports.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Attribution dashboards & milestone reviews
            </p>
          </div>
        </Card>
      </div>

      {/* Grid: Active Projects & Outstanding Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. ACTIVE PROJECTS SECTION */}
        <Card>
          <CardHeader
            title="Active Projects"
            subtitle="Current campaign setups and tracking implementations in progress"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/portal/projects')}
                icon={<ArrowUpRight className="w-3.5 h-3.5" />}
              >
                View All
              </Button>
            }
          />

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading active projects...</div>
          ) : activeProjects.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="w-6 h-6 text-slate-400" />}
              title="No active projects"
              description="Approved tracking setups and campaign projects for your business will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {activeProjects.map((project) => (
                <div key={project.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">{project.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span className="capitalize">{project.services?.map(s => s.replace('_', ' ')).join(', ') || 'Marketing & Tracking'}</span>
                        {project.deadline && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" /> Target: {formatDate(project.deadline)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 capitalize shrink-0">
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1 font-mono">
                      <span>Progress</span>
                      <span className="font-semibold text-blue-700">{project.progressPercentage}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, project.progressPercentage))}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 2. OUTSTANDING INVOICES (WITH BALANCE DUE) SECTION */}
        <Card>
          <CardHeader
            title="Outstanding Invoices"
            subtitle="Issued billing records with remaining balance due for your account"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/portal/invoices')}
                icon={<ArrowUpRight className="w-3.5 h-3.5" />}
              >
                Invoices History
              </Button>
            }
          />

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading invoices...</div>
          ) : outstandingInvoices.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-900">All invoices settled</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                There are no open or overdue balances on your account.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {outstandingInvoices.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900">{inv.invoiceNumber}</span>
                      {getInvoiceStatusBadge(inv)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                      <span>Due: {formatDate(inv.dueDate)}</span>
                      <span>•</span>
                      <span>Total: {inv.currency} {inv.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Balance Due</span>
                    <span className="text-sm font-bold text-rose-600 font-mono">
                      {inv.currency} {(inv.balanceDue ?? inv.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 3. LATEST SHARED REPORTS & DELIVERABLES SECTION */}
      <Card>
        <CardHeader
          title="Latest Shared Reports & Deliverables"
          subtitle="Multi-touch attribution dashboards, Meta CAPI audit reports, and milestone deliverables"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/portal/reports')}
              icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              All Reports
            </Button>
          }
        />

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading shared reports...</div>
        ) : sharedReports.length === 0 ? (
          <EmptyState
            icon={<BarChart2 className="w-6 h-6 text-slate-400" />}
            title="No performance reports published yet"
            description="When your Bounce Growth team publishes Looker Studio dashboards or audit reports, they will appear here with direct view links."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {sharedReports.slice(0, 5).map((report) => (
              <div
                key={report.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">{report.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      v{report.version}
                    </span>
                    {getDeliverableStatusBadge(report.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                    <span>Project: {report.projectName}</span>
                    <span>•</span>
                    <span>Submitted: {formatDate(report.submittedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  {report.externalUrl ? (
                    <a
                      href={report.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open Report
                    </a>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/portal/reports')}
                    >
                      View Details
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
