import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Plus,
  ExternalLink,
  Search,
  Filter,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  FileText,
  Clock,
  Eye,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Table, Column } from '../../components/common/Table';
import { useAuth } from '../auth/AuthContext';
import { Deliverable, DeliverableStatus } from '../../types/deliverable';
import { ClientProfile } from '../../types/client';
import { Project } from '../../types/project';
import {
  subscribeDeliverables,
  createDeliverable,
  updateDeliverable,
  deleteDeliverable,
} from '../../services/deliverables/deliverableService';
import { subscribeClients } from '../../services/clients/clientService';
import { subscribeProjects } from '../../services/projects/projectService';
import { createTask, subscribeTasks } from '../../services/tasks/taskService';
import { Task } from '../../types/task';
import { formatDate } from '../../utils/formatters';

export function ReportsAnalyticsPage() {
  const { currentUser, currentRole, isLiveAuth, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  // Firestore Real-Time State
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('all');

  // Modals state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Deliverable | null>(null);

  // Publish Form State
  const [pubClientId, setPubClientId] = useState('');
  const [pubProjectId, setPubProjectId] = useState('');
  const [pubTitle, setPubTitle] = useState('');
  const [pubDescription, setPubDescription] = useState('');
  const [pubExternalUrl, setPubExternalUrl] = useState('');
  const [pubStatus, setPubStatus] = useState<DeliverableStatus>('submitted');
  const [publishSubmitting, setPublishSubmitting] = useState(false);

  // Edit Form State
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editExternalUrl, setEditExternalUrl] = useState('');
  const [editStatus, setEditStatus] = useState<DeliverableStatus>('submitted');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Feedback notifications
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Subscriptions
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubDeliverables = subscribeDeliverables(
      {},
      (data) => {
        setDeliverables(data);
        setLoading(false);
      },
      {
        uid: currentUser.id,
        id: currentUser.id,
        role: (currentRole || 'admin') as 'admin' | 'team' | 'client',
        clientId: currentUser.clientId,
      },
      (err) => {
        console.warn('Reports subscription warning:', err);
        setLoading(false);
      }
    );

    const unsubClients = subscribeClients(
      (data) => setClients(data),
      (err) => console.warn('Clients subscription warning:', err),
      { actorRole: currentRole || 'admin', actorUid: currentUser.id }
    );

    const unsubProjects = subscribeProjects(
      (data) => setProjects(data),
      (err) => console.warn('Projects subscription warning:', err)
    );

    const unsubTasks = subscribeTasks(
      {},
      (data) => setTasks(data),
      {
        uid: currentUser.id,
        role: (currentRole || 'admin') as 'admin' | 'team' | 'client',
        clientId: currentUser.clientId,
      },
      (err) => console.warn('Tasks subscription warning:', err)
    );

    return () => {
      unsubDeliverables();
      unsubClients();
      unsubProjects();
      unsubTasks();
    };
  }, [currentUser, currentRole]);

  // Available projects for the currently selected client in Publish modal
  const clientAvailableProjects = useMemo(() => {
    if (!pubClientId) return [];
    return projects.filter((p) => p.clientId === pubClientId);
  }, [projects, pubClientId]);

  // Filtered Deliverables / Reports
  const filteredReports = useMemo(() => {
    return deliverables.filter((report) => {
      // Client filter
      if (clientFilter !== 'all' && report.clientId !== clientFilter) {
        return false;
      }

      // Tab filter
      if (activeTab === 'monthly') {
        const titleLower = report.title.toLowerCase();
        const descLower = report.description?.toLowerCase() || '';
        if (!titleLower.includes('month') && !titleLower.includes('audit') && !descLower.includes('monthly')) {
          return false;
        }
      } else if (activeTab === 'looker') {
        const url = (report.externalUrl || '').toLowerCase();
        const titleLower = report.title.toLowerCase();
        if (!url.includes('looker') && !url.includes('datastudio') && !titleLower.includes('looker') && !titleLower.includes('dashboard')) {
          return false;
        }
      } else if (activeTab === 'approved') {
        if (report.status !== 'approved') {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = report.title.toLowerCase().includes(q);
        const matchesDesc = (report.description || '').toLowerCase().includes(q);
        const matchesClient = (report.clientName || '').toLowerCase().includes(q);
        const matchesProject = (report.projectName || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesClient && !matchesProject) {
          return false;
        }
      }

      return true;
    });
  }, [deliverables, clientFilter, activeTab, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = deliverables.length;
    const approved = deliverables.filter((d) => d.status === 'approved').length;
    const readyForReview = deliverables.filter((d) => d.status === 'submitted' || d.status === 'under_review').length;
    const lookerDashboards = deliverables.filter(
      (d) => d.externalUrl && (d.externalUrl.includes('looker') || d.externalUrl.includes('datastudio') || d.title.toLowerCase().includes('looker'))
    ).length;
    return { total, approved, readyForReview, lookerDashboards };
  }, [deliverables]);

  // Handlers: Publish
  const handleOpenPublishModal = () => {
    setPubClientId(clients[0]?.id || '');
    setPubProjectId('');
    setPubTitle('');
    setPubDescription('');
    setPubExternalUrl('');
    setPubStatus('submitted');
    setAlertError(null);
    setIsPublishModalOpen(true);
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!pubClientId || !pubTitle.trim() || !pubDescription.trim()) {
      setAlertError('Please select a client, provide a report title, and include summary findings.');
      return;
    }

    const client = clients.find((c) => c.id === pubClientId);
    if (!client) {
      setAlertError('Selected client not found.');
      return;
    }

    let project = projects.find((p) => p.id === pubProjectId);
    if (!project) {
      project = projects.find((p) => p.clientId === pubClientId);
    }

    if (!project) {
      setAlertError(`No active project found for ${client.businessName}. Please create a project under Clients or Projects first.`);
      return;
    }

    setPublishSubmitting(true);
    setAlertError(null);

    try {
      // Find or create parent task under project
      let targetTask = tasks.find((t) => t.projectId === project?.id);
      if (!targetTask) {
        const newTaskId = await createTask(
          {
            projectId: project.id,
            projectName: project.name,
            clientId: client.id,
            clientName: client.businessName,
            title: `Reporting & Performance Audit Deliverable - ${pubTitle.trim()}`,
            description: pubDescription.trim(),
            status: 'in_review',
            priority: 'high',
            progressPercentage: 100,
            assignedTeamMembers: [currentUser.id],
            assignedTeamMemberNames: [currentUser.displayName || 'Specialist'],
            createdBy: currentUser.id,
            clientVisible: true,
            isArchived: false,
            labels: ['Reporting', 'Looker Studio'],
          },
          {
            uid: currentUser.id,
            email: currentUser.email,
            role: (currentRole || 'admin') as 'admin' | 'team',
            name: currentUser.displayName,
          }
        );
        targetTask = {
          id: newTaskId,
          title: `Reporting & Performance Audit Deliverable - ${pubTitle.trim()}`,
        } as Task;
      }

      await createDeliverable(
        {
          taskId: targetTask.id,
          taskTitle: targetTask.title,
          projectId: project.id,
          projectName: project.name,
          clientId: client.id,
          clientName: client.businessName,
          title: pubTitle.trim(),
          description: pubDescription.trim(),
          externalUrl: pubExternalUrl.trim() || undefined,
          status: pubStatus,
        },
        {
          uid: currentUser.id,
          email: currentUser.email,
          role: (currentRole || 'admin') as 'admin' | 'team',
          name: currentUser.displayName,
        }
      );

      setIsPublishModalOpen(false);
      setAlertSuccess(`Report "${pubTitle.trim()}" successfully published for ${client.businessName}.`);
      setTimeout(() => setAlertSuccess(null), 5000);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to publish performance report.');
    } finally {
      setPublishSubmitting(false);
    }
  };

  // Handlers: Edit
  const handleOpenEditModal = (report: Deliverable) => {
    setSelectedReport(report);
    setEditTitle(report.title);
    setEditDescription(report.description || '');
    setEditExternalUrl(report.externalUrl || '');
    setEditStatus(report.status);
    setAlertError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || !currentUser) return;

    if (!editTitle.trim() || !editDescription.trim()) {
      setAlertError('Please enter a report title and description.');
      return;
    }

    setEditSubmitting(true);
    setAlertError(null);

    try {
      await updateDeliverable(
        selectedReport.id,
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          externalUrl: editExternalUrl.trim() || '',
          status: editStatus,
        },
        {
          uid: currentUser.id,
          email: currentUser.email,
          role: currentRole || 'admin',
          name: currentUser.displayName,
        }
      );

      setIsEditModalOpen(false);
      setSelectedReport(null);
      setAlertSuccess(`Report "${editTitle.trim()}" successfully updated.`);
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to update report.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handlers: Delete
  const handleOpenDeleteModal = (report: Deliverable) => {
    setSelectedReport(report);
    setAlertError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedReport || !currentUser) return;

    try {
      await deleteDeliverable(selectedReport.id, selectedReport.title, {
        uid: currentUser.id,
        email: currentUser.email,
        role: currentRole || 'admin',
      });

      setIsDeleteModalOpen(false);
      setSelectedReport(null);
      setAlertSuccess(`Report "${selectedReport.title}" deleted.`);
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to delete report.');
    }
  };

  // Table columns definition
  const columns: Column<Deliverable>[] = [
    {
      header: 'Report Title & Deliverable',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
            <span>{row.title}</span>
            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              v{row.version}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
            {row.description || 'Attribution & conversion tracking report'}
          </div>
        </div>
      ),
    },
    {
      header: 'Client & Project',
      cell: (row) => (
        <div>
          <div className="font-medium text-slate-800 text-xs flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{row.clientName}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">{row.projectName}</div>
        </div>
      ),
    },
    {
      header: 'Published Date',
      cell: (row) => (
        <span className="text-xs text-slate-600 font-mono">
          {formatDate(row.submittedAt || row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Review Status',
      cell: (row) => {
        const variants: Record<string, 'neutral' | 'blue' | 'green' | 'amber' | 'red'> = {
          approved: 'green',
          submitted: 'blue',
          under_review: 'blue',
          revision_requested: 'amber',
          rejected: 'red',
          draft: 'neutral',
        };
        const labels: Record<string, string> = {
          approved: 'Client Approved',
          submitted: 'Ready for Review',
          under_review: 'Under Review',
          revision_requested: 'Revision Requested',
          rejected: 'Rejected',
          draft: 'Internal Draft',
        };
        return (
          <Badge variant={variants[row.status] || 'neutral'}>
            {labels[row.status] || row.status}
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.externalUrl && (
            <a
              href={row.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Dashboard</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => handleOpenEditModal(row)}
            title="Edit Report"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteModal(row)}
            title="Delete Report"
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Performance Reports & Looker Studio Hub"
        description="Deliverable client analytics, monthly attribution audits, ROAS tracking, and embeddable Looker Studio dashboards."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleOpenPublishModal}
          >
            Publish New Report
          </Button>
        }
      />

      {/* Notifications */}
      {alertSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{alertSuccess}</span>
          </div>
          <button onClick={() => setAlertSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {alertError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{alertError}</span>
          </div>
          <button onClick={() => setAlertError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Reports Published</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">
            {metrics.total}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Attribution & ROAS audits</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Client Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-emerald-700 mt-2 tabular-nums">
            {metrics.approved}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Approved deliverables</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Awaiting Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-amber-800 mt-2 tabular-nums">
            {metrics.readyForReview}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Pending client feedback</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Looker Studio Feeds</span>
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-purple-700 mt-2 tabular-nums">
            {metrics.lookerDashboards}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Live dashboard links</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'all', label: 'All Reports & Dashboards', count: deliverables.length },
          { id: 'looker', label: 'Looker Studio Live Feeds', count: metrics.lookerDashboards },
          {
            id: 'monthly',
            label: 'Monthly Attribution Audits',
            count: deliverables.filter(
              (d) =>
                d.title.toLowerCase().includes('month') ||
                d.title.toLowerCase().includes('audit') ||
                (d.description || '').toLowerCase().includes('monthly')
            ).length,
          },
          { id: 'approved', label: 'Approved by Clients', count: metrics.approved },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reports by title, findings, client, or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Client Organizations</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table Card */}
      <Card>
        <CardHeader
          title="Client Performance Reports Archive"
          subtitle="All published attribution analyses, ROAS reports, and Looker Studio live feeds synchronized with Cloud Firestore."
        />

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading reports from database...</div>
        ) : filteredReports.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No Performance Reports Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery || clientFilter !== 'all'
                ? 'No reports match your current filter settings. Try clearing search filters.'
                : 'Generate and publish tracking health audits, Meta Ads ROAS analysis, and Looker Studio reports.'}
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleOpenPublishModal}
            >
              Publish First Report
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={filteredReports} keyExtractor={(r) => r.id} />
        )}
      </Card>

      {/* =========================================================================
          MODAL 1: Publish New Performance Report / Looker Studio Dashboard
      ========================================================================= */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Publish Performance Report & Dashboard"
        description="Share attribution audits, ROAS tracking sheets, or Looker Studio live dashboards with clients."
        maxWidth="lg"
      >
        <form onSubmit={handlePublishSubmit} autoComplete="off" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Client Organization <span className="text-red-500">*</span>
              </label>
              <select
                value={pubClientId}
                onChange={(e) => {
                  setPubClientId(e.target.value);
                  setPubProjectId('');
                }}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Project / Campaign
              </label>
              <select
                value={pubProjectId}
                onChange={(e) => setPubProjectId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Auto-select first active project</option>
                {clientAvailableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Report Title"
            placeholder="E.g. November Meta Ads ROAS & Multi-Touch Attribution Audit"
            value={pubTitle}
            onChange={(e) => setPubTitle(e.target.value)}
            autoComplete="off"
            required
          />

          <Input
            label="Dashboard / Looker Studio Live Feed URL"
            placeholder="https://lookerstudio.google.com/reporting/... or docs.google.com/spreadsheets/..."
            value={pubExternalUrl}
            onChange={(e) => setPubExternalUrl(e.target.value)}
            autoComplete="off"
            helperText="Provides a one-click dashboard link for client portal representatives."
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Executive Summary & Key Findings <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={pubDescription}
              onChange={(e) => setPubDescription(e.target.value)}
              placeholder="Highlight blended ROAS, Meta CAPI event match quality, conversion drop rates, and optimizations..."
              className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Initial Status</label>
            <select
              value={pubStatus}
              onChange={(e) => setPubStatus(e.target.value as DeliverableStatus)}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="submitted">Ready for Client Review (Client Portal Visible)</option>
              <option value="approved">Approved & Finalized</option>
              <option value="draft">Internal Draft (Hidden from Client Portal)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPublishModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={publishSubmitting}
            >
              {publishSubmitting ? 'Publishing...' : 'Publish Report'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: Edit Performance Report
      ========================================================================= */}
      {selectedReport && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedReport(null);
          }}
          title={`Edit Report: ${selectedReport.title}`}
          maxWidth="lg"
        >
          <form onSubmit={handleEditSubmit} autoComplete="off" className="space-y-4">
            <Input
              label="Report Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoComplete="off"
              required
            />

            <Input
              label="Dashboard / Looker Studio URL"
              value={editExternalUrl}
              onChange={(e) => setEditExternalUrl(e.target.value)}
              autoComplete="off"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Executive Summary & Key Findings <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Review Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as DeliverableStatus)}
                className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="submitted">Ready for Client Review</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved & Finalized</option>
                <option value="revision_requested">Revision Requested</option>
                <option value="draft">Internal Draft</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedReport(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={editSubmitting}
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 3: Delete Report Confirmation
      ========================================================================= */}
      {selectedReport && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedReport(null);
          }}
          title="Delete Published Report"
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedReport(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteSubmit}
              >
                Delete Report
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-2 text-sm text-slate-600">
            <p>Are you sure you want to remove this published performance report?</p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="font-bold text-rose-900">{selectedReport.title}</p>
              <p className="text-xs text-rose-700 mt-0.5">{selectedReport.clientName}</p>
            </div>
            <p className="text-xs text-slate-500">
              This report deliverable will be permanently removed from Cloud Firestore and the client portal.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
