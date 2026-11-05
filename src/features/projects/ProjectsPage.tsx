import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Table, Column } from '../../components/common/Table';
import { ProjectCommentsSection } from '../../components/common/ProjectCommentsSection';
import {
  Briefcase,
  Plus,
  Search,
  Eye,
  EyeOff,
  Edit,
  Archive,
  RotateCcw,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Project, ProjectStatus, ProjectPriority } from '../../types/project';
import { ClientProfile, ServiceCategory } from '../../types/client';
import {
  subscribeProjects,
  createProject,
  updateProject,
  archiveProject,
  restoreProject,
} from '../../services/projects/projectService';
import { subscribeClients } from '../../services/clients/clientService';
import { formatDate } from '../../utils/formatters';

const ALL_SERVICES: { value: ServiceCategory; label: string }[] = [
  { value: 'server_side_tracking', label: 'Server-Side GTM & Meta CAPI' },
  { value: 'meta_ads', label: 'Meta Ads Management' },
  { value: 'google_ads', label: 'Google Ads (Search & PMax)' },
  { value: 'ga4', label: 'GA4 Enhanced E-commerce' },
  { value: 'looker_studio', label: 'Looker Studio Dashboard' },
  { value: 'cro', label: 'Conversion Rate Optimization' },
  { value: 'tiktok_ads', label: 'TikTok Ads' },
];

export function ProjectsPage() {
  const { currentUser, isLiveAuth, firebaseUser, signInWithGoogle } = useAuth();
  const actor = {
    uid: currentUser?.id || 'usr_admin_bounce',
    email: currentUser?.email || 'founder@bouncegrowth.com',
    role: currentUser?.role || 'admin',
  };

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form State
  const [formClientId, setFormClientId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formServices, setFormServices] = useState<ServiceCategory[]>(['server_side_tracking']);
  const [formStatus, setFormStatus] = useState<ProjectStatus>('planning');
  const [formPriority, setFormPriority] = useState<ProjectPriority>('medium');
  const [formClientVisible, setFormClientVisible] = useState(true);
  const [formProgress, setFormProgress] = useState(0);
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDeadline, setFormDeadline] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLiveAuth || !firebaseUser) {
      setProjects([]);
      setClients([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubProjects = subscribeProjects(
      (data) => {
        setProjects(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      { actorRole: actor.role, actorUid: actor.uid }
    );

    const unsubClients = subscribeClients(
      (data) => setClients(data.filter((c) => c.status !== 'archived')),
      (err) => console.warn('Could not load clients for project selector:', err),
      { actorRole: actor.role, actorUid: actor.uid }
    );

    return () => {
      unsubProjects();
      unsubClients();
    };
  }, [isLiveAuth, firebaseUser]);

  const resetForm = () => {
    setFormClientId(clients[0]?.id || '');
    setFormName('');
    setFormDescription('');
    setFormServices(['server_side_tracking']);
    setFormStatus('planning');
    setFormPriority('medium');
    setFormClientVisible(true);
    setFormProgress(0);
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormDeadline('');
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    if (clients.length === 0) {
      alert('Please register at least one client first before creating a project.');
      return;
    }
    setFormClientId(clients[0].id);
    setIsAddModalOpen(true);
  };

  const openEditModal = (proj: Project) => {
    setSelectedProject(proj);
    setFormClientId(proj.clientId);
    setFormName(proj.name);
    setFormDescription(proj.description || '');
    setFormServices(proj.services || []);
    setFormStatus(proj.status);
    setFormPriority(proj.priority);
    setFormClientVisible(proj.clientVisible);
    setFormProgress(proj.progressPercentage || 0);
    setFormStartDate(proj.startDate);
    setFormDeadline(proj.deadline || '');
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const openDetailModal = (proj: Project) => {
    setSelectedProject(proj);
    setIsDetailModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const client = clients.find((c) => c.id === formClientId);
      if (!client) throw new Error('Selected client not found');

      await createProject(
        {
          clientId: client.id,
          clientName: client.businessName,
          name: formName,
          description: formDescription,
          services: formServices,
          status: formStatus,
          priority: formPriority,
          leadSpecialistId: actor.uid,
          assignedTeamMembers: [actor.uid],
          clientVisible: formClientVisible,
          progressPercentage: Number(formProgress) || 0,
          startDate: formStartDate,
          deadline: formDeadline,
        },
        actor
      );

      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const client = clients.find((c) => c.id === formClientId);

      await updateProject(
        selectedProject.id,
        {
          clientId: formClientId,
          clientName: client ? client.businessName : selectedProject.clientName,
          name: formName,
          description: formDescription,
          services: formServices,
          status: formStatus,
          priority: formPriority,
          clientVisible: formClientVisible,
          progressPercentage: Number(formProgress) || 0,
          startDate: formStartDate,
          deadline: formDeadline,
        },
        actor
      );

      setIsEditModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async (proj: Project) => {
    if (proj.status === 'archived') {
      await restoreProject(proj.id, 'active', actor);
    } else {
      if (confirm(`Archive project '${proj.name}'?`)) {
        await archiveProject(proj.id, actor);
      }
    }
  };

  const toggleService = (svc: ServiceCategory) => {
    setFormServices((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
    );
  };

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    if (activeTab === 'planning' && p.status !== 'planning') return false;
    if (activeTab === 'active' && p.status !== 'active' && p.status !== 'in_progress') return false;
    if (activeTab === 'in_review' && p.status !== 'in_review') return false;
    if (activeTab === 'completed' && p.status !== 'completed') return false;
    if (activeTab === 'archived' && p.status !== 'archived') return false;
    if (activeTab === 'all' && p.status === 'archived') return false;

    if (selectedClientFilter !== 'all' && p.clientId !== selectedClientFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const columns: Column<Project>[] = [
    {
      header: 'Project Name & Client',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <span>{row.name}</span>
            {row.clientVisible ? (
              <span title="Visible in Client Portal">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
              </span>
            ) : (
              <span title="Internal Agency Only">
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">{row.clientName}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => {
        const statusColors: Record<ProjectStatus, string> = {
          planning: 'bg-blue-50 text-blue-700 border-blue-200',
          active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          in_progress: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          in_review: 'bg-amber-50 text-amber-700 border-amber-200',
          on_hold: 'bg-slate-100 text-slate-700 border-slate-200',
          completed: 'bg-purple-50 text-purple-700 border-purple-200',
          archived: 'bg-slate-100 text-slate-400 border-slate-200',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusColors[row.status] || 'bg-slate-50'}`}>
            {row.status.toUpperCase()}
          </span>
        );
      },
    },
    {
      header: 'Priority',
      cell: (row) => {
        const priorityColors: Record<ProjectPriority, string> = {
          urgent: 'text-rose-700 font-bold',
          high: 'text-amber-700 font-semibold',
          medium: 'text-slate-700',
          low: 'text-slate-500',
        };
        return <span className={`text-xs capitalize ${priorityColors[row.priority]}`}>{row.priority}</span>;
      },
    },
    {
      header: 'Progress',
      cell: (row) => (
        <div className="w-28 space-y-1">
          <div className="flex items-center justify-between text-[11px] tabular-nums font-medium text-slate-700">
            <span>{row.progressPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, row.progressPercentage))}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      header: 'Timeline',
      cell: (row) => (
        <div className="text-xs text-slate-600">
          <p>{formatDate(row.startDate)}</p>
          <p className="text-[11px] text-slate-400">Due: {row.deadline ? formatDate(row.deadline) : 'Ongoing'}</p>
        </div>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDetailModal(row)}
            icon={<Info className="w-3.5 h-3.5" />}
            className="text-xs text-slate-600 h-7 px-2"
          >
            Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
            icon={<Edit className="w-3.5 h-3.5" />}
            className="text-xs text-slate-600 h-7 px-2"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleArchiveToggle(row)}
            icon={row.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 text-emerald-600" /> : <Archive className="w-3.5 h-3.5 text-slate-400" />}
            className="text-xs h-7 px-2"
          >
            {row.status === 'archived' ? 'Restore' : 'Archive'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Projects & Engagements"
        description="Deliverable tracking setups, Meta CAPI implementations, and ad campaigns. Projects with 'Client Visible' enabled appear in the respective brand's client portal."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={openCreateModal}
          >
            Create Project
          </Button>
        }
      />

      {error && <ErrorState title="Failed to synchronize projects" message={error} />}

      {!isLiveAuth && (
        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs text-slate-700">
              <strong className="font-semibold text-slate-900">Live Cloud Firestore Authentication:</strong> Sign in with Google to synchronize live Project records in database <code className="text-[11px] font-mono text-blue-800">ai-studio-bouncegrowthagen</code>.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={signInWithGoogle} className="text-xs shrink-0">
            Sign in with Google
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Projects', count: projects.filter((p) => p.status !== 'archived').length },
            { id: 'planning', label: 'Planning', count: projects.filter((p) => p.status === 'planning').length },
            { id: 'active', label: 'Active', count: projects.filter((p) => p.status === 'active' || p.status === 'in_progress').length },
            { id: 'in_review', label: 'QA / Review', count: projects.filter((p) => p.status === 'in_review').length },
            { id: 'completed', label: 'Completed', count: projects.filter((p) => p.status === 'completed').length },
            { id: 'archived', label: 'Archived', count: projects.filter((p) => p.status === 'archived').length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {clients.length > 0 && (
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg text-xs py-2 px-2.5 text-slate-700"
            >
              <option value="all">All Clients ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.businessName}</option>
              ))}
            </select>
          )}

          <div className="w-full sm:w-60">
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState rows={5} message="Streaming projects from Cloud Firestore..." />
      ) : (
        <Card noPadding>
          <Table
            columns={columns}
            data={filteredProjects}
            keyExtractor={(p) => p.id}
            onRowClick={(p) => openDetailModal(p)}
            emptyMessage={
              searchQuery || selectedClientFilter !== 'all'
                ? 'No projects match your current filters.'
                : 'No projects logged in Cloud Firestore. Click "Create Project" to start an engagement.'
            }
          />
        </Card>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Agency Project"
        description="Creates a persistent project document under /projects/{projectId} linked to a client."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateSubmit} loading={isSubmitting}>
              Save Project
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{formError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Associated Client Organization"
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              options={clients.map((c) => ({ value: c.id, label: `${c.businessName} (${c.country})` }))}
              required
            />
            <Input
              label="Project Name"
              placeholder="e.g. Meta CAPI & Server-Side GTM Setup"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project Scope & Description</label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Objectives, deliverables, server endpoints, and tracking criteria..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as ProjectStatus)}
              options={[
                { value: 'planning', label: 'Planning' },
                { value: 'active', label: 'Active' },
                { value: 'in_review', label: 'QA / Client Review' },
                { value: 'on_hold', label: 'On Hold' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
            <Select
              label="Priority"
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value as ProjectPriority)}
              options={[
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <Input
              label="Progress Percentage (0-100)"
              type="number"
              min="0"
              max="100"
              value={String(formProgress)}
              onChange={(e) => setFormProgress(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
              required
            />
            <Input
              label="Target Completion / Deadline"
              type="date"
              value={formDeadline}
              onChange={(e) => setFormDeadline(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Deliverable Services</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_SERVICES.map((svc) => (
                <button
                  type="button"
                  key={svc.value}
                  onClick={() => toggleService(svc.value)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                    formServices.includes(svc.value)
                      ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-medium'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formServices.includes(svc.value)}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span>{svc.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900">Make Visible in Client Portal</p>
              <p className="text-[11px] text-slate-500">
                When enabled, authorized client reps can track milestones and progress in their portal.
              </p>
            </div>
            <input
              type="checkbox"
              checked={formClientVisible}
              onChange={(e) => setFormClientVisible(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Project: ${selectedProject?.name}`}
        description="Updates project state in Cloud Firestore."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditSubmit} loading={isSubmitting}>
              Save Updates
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{formError}</p>}

          <Input
            label="Project Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project Scope</label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as ProjectStatus)}
              options={[
                { value: 'planning', label: 'Planning' },
                { value: 'active', label: 'Active' },
                { value: 'in_review', label: 'QA / Review' },
                { value: 'on_hold', label: 'On Hold' },
                { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
            <Select
              label="Priority"
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value as ProjectPriority)}
              options={[
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <Input
              label="Progress (%)"
              type="number"
              min="0"
              max="100"
              value={String(formProgress)}
              onChange={(e) => setFormProgress(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
              required
            />
            <Input
              label="Target Deadline"
              type="date"
              value={formDeadline}
              onChange={(e) => setFormDeadline(e.target.value)}
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900">Make Visible in Client Portal</p>
              <p className="text-[11px] text-slate-500">Allows client representative to view this project in portal.</p>
            </div>
            <input
              type="checkbox"
              checked={formClientVisible}
              onChange={(e) => setFormClientVisible(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </div>
        </form>
      </Modal>

      {/* Project Details Modal */}
      {selectedProject && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedProject.name}
          description={`Project ID: ${selectedProject.id} · Client: ${selectedProject.clientName}`}
          maxWidth="lg"
          footer={
            <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Status</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedProject.status.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Priority</p>
                <p className="font-bold text-slate-900 mt-0.5 capitalize">{selectedProject.priority}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Progress</p>
                <p className="font-bold text-blue-600 mt-0.5 tabular-nums">{selectedProject.progressPercentage}%</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 text-xs mb-1">Scope & Objective</h4>
              <p className="text-slate-600 bg-white p-3 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed">
                {selectedProject.description || 'No description provided.'}
              </p>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50">
              <span className="font-medium text-slate-700">Client Portal Visibility:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                selectedProject.clientVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {selectedProject.clientVisible ? 'Visible to Client' : 'Internal Only'}
              </span>
            </div>

            <div className="text-[11px] text-slate-400 space-y-0.5 pt-2 border-t border-slate-100">
              <p>Created: {formatDate(selectedProject.createdAt)} by UID {selectedProject.createdBy}</p>
              <p>Last Updated: {formatDate(selectedProject.updatedAt)}</p>
            </div>

            {/* Project Communications & Internal QA Notes */}
            <div className="pt-3 border-t border-slate-200">
              <ProjectCommentsSection
                projectId={selectedProject.id}
                projectName={selectedProject.name}
                clientId={selectedProject.clientId}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
