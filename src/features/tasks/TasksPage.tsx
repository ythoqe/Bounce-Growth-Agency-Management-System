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
import { DeliverableModal } from '../../components/common/DeliverableModal';
import { ProjectCommentsSection } from '../../components/common/ProjectCommentsSection';
import {
  CheckSquare,
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
  AlertCircle,
  FileCheck,
  Tag,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Task, TaskPriority, TaskStatus, TaskFilter } from '../../types/task';
import { Project } from '../../types/project';
import { ClientProfile } from '../../types/client';
import {
  subscribeTasks,
  createTask,
  updateTask,
  deleteTask,
  archiveTask,
} from '../../services/tasks/taskService';
import { subscribeProjects } from '../../services/projects/projectService';
import { subscribeClients } from '../../services/clients/clientService';
import { formatDate } from '../../utils/formatters';

const PRESET_LABELS = [
  'Meta CAPI',
  'GA4 E-Commerce',
  'GTM Server',
  'Pixel QA',
  'Looker Studio',
  'Google Ads',
  'Stape Subdomain',
  'CRO Audit',
];

export function TasksPage() {
  const { currentUser, isLiveAuth, firebaseUser, currentRole } = useAuth();
  const actor = {
    uid: (isLiveAuth ? firebaseUser?.uid : currentUser?.id) || 'usr_admin_bounce',
    email: (isLiveAuth ? firebaseUser?.email : currentUser?.email) || 'founder@bouncegrowth.com',
    role: currentRole as 'admin' | 'team' | 'client',
    name: currentUser?.displayName || firebaseUser?.displayName || 'Agency Specialist',
    clientId: currentUser?.clientId,
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('all');

  // Modal & Drawer State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isDeliverableModalOpen, setIsDeliverableModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Form State
  const [formClientId, setFormClientId] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formStatus, setFormStatus] = useState<TaskStatus>('todo');
  const [formProgress, setFormProgress] = useState(0);
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDeadline, setFormDeadline] = useState('');
  const [formLabels, setFormLabels] = useState<string[]>(['Meta CAPI']);
  const [formClientVisible, setFormClientVisible] = useState(true);
  const [formAssignedMembers, setFormAssignedMembers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Delete Task State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const handleDeleteTaskConfirm = async () => {
    if (!taskToDelete) return;
    try {
      setIsDeletingTask(true);
      await deleteTask(taskToDelete.id, {
        uid: actor.uid,
        email: actor.email,
        role: actor.role,
      });
      setIsDeleteModalOpen(false);
      setTaskToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    } finally {
      setIsDeletingTask(false);
    }
  };

  // Live Subscriptions
  useEffect(() => {
    setLoading(true);

    const unsubTasks = subscribeTasks(
      {
        clientId: selectedClientFilter,
        projectId: selectedProjectFilter,
        status: activeTab === 'all' ? 'all' : (activeTab as TaskStatus),
        priority: selectedPriorityFilter as any,
        searchQuery,
        includeArchived: activeTab === 'archived',
      },
      (data) => {
        setTasks(data);
        setLoading(false);
        setError(null);
      },
      { uid: actor.uid, role: actor.role, clientId: actor.clientId },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubProjects = subscribeProjects(
      (projs) => setProjects(projs),
      () => {},
      { actorRole: actor.role, actorUid: actor.uid }
    );

    const unsubClients = subscribeClients(
      (cls) => setClients(cls),
      () => {},
      { actorRole: actor.role, actorUid: actor.uid }
    );

    return () => {
      unsubTasks();
      unsubProjects();
      unsubClients();
    };
  }, [
    activeTab,
    searchQuery,
    selectedClientFilter,
    selectedProjectFilter,
    selectedPriorityFilter,
    actor.uid,
    actor.role,
    actor.clientId,
  ]);

  const openCreateModal = () => {
    setFormClientId(clients[0]?.id || '');
    const clientProjects = projects.filter((p) => !clients[0] || p.clientId === clients[0].id);
    setFormProjectId(clientProjects[0]?.id || projects[0]?.id || '');
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormStatus('todo');
    setFormProgress(0);
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormDeadline('');
    setFormLabels(['Meta CAPI']);
    setFormClientVisible(true);
    setFormAssignedMembers([actor.uid]);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setActiveTask(task);
    setFormClientId(task.clientId);
    setFormProjectId(task.projectId);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormStatus(task.status);
    setFormProgress(task.progressPercentage);
    setFormStartDate(task.startDate || '');
    setFormDeadline(task.deadline || '');
    setFormLabels(task.labels || []);
    setFormClientVisible(task.clientVisible);
    setFormAssignedMembers(task.assignedTeamMembers || []);
    setIsEditModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formProjectId || !formClientId) return;

    setSubmitting(true);
    try {
      const selectedClient = clients.find((c) => c.id === formClientId);
      const selectedProject = projects.find((p) => p.id === formProjectId);

      await createTask(
        {
          clientId: formClientId,
          clientName: selectedClient?.businessName || 'Client Org',
          projectId: formProjectId,
          projectName: selectedProject?.name || 'Tracking Project',
          title: formTitle.trim(),
          description: formDescription.trim(),
          priority: formPriority,
          status: formStatus,
          progressPercentage: Number(formProgress),
          startDate: formStartDate,
          deadline: formDeadline || undefined,
          labels: formLabels,
          clientVisible: formClientVisible,
          assignedTeamMembers: formAssignedMembers.length > 0 ? formAssignedMembers : [actor.uid],
          assignedTeamMemberNames: [actor.name],
          createdBy: actor.uid,
          isArchived: false,
        },
        actor
      );

      setIsCreateModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !formTitle.trim()) return;

    setSubmitting(true);
    try {
      await updateTask(
        activeTask.id,
        {
          title: formTitle.trim(),
          description: formDescription.trim(),
          priority: formPriority,
          status: formStatus,
          progressPercentage: Number(formProgress),
          startDate: formStartDate,
          deadline: formDeadline || undefined,
          labels: formLabels,
          clientVisible: formClientVisible,
          assignedTeamMembers: formAssignedMembers,
        },
        actor
      );

      setIsEditModalOpen(false);
      if (activeTask) {
        setActiveTask({
          ...activeTask,
          title: formTitle,
          description: formDescription,
          priority: formPriority,
          status: formStatus,
          progressPercentage: Number(formProgress),
          clientVisible: formClientVisible,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchive = async (task: Task) => {
    try {
      await archiveTask(task.id, !task.isArchived, actor);
    } catch (err: any) {
      setError(err?.message || 'Failed to archive/restore task');
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">Low</span>;
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Completed</span>;
      case 'in_review':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">In Review</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">In Progress</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">To Do</span>;
    }
  };

  const columns: Column<Task>[] = [
    {
      header: 'Task & Action Item',
      cell: (task) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              onClick={() => {
                setActiveTask(task);
                setIsDetailDrawerOpen(true);
              }}
              className="font-semibold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer text-xs"
            >
              {task.title}
            </span>
            {task.clientVisible ? (
              <span title="Visible in Client Portal" className="flex items-center text-slate-400">
                <Eye className="w-3.5 h-3.5 text-blue-500" />
              </span>
            ) : (
              <span title="Agency Internal Only" className="flex items-center text-slate-400">
                <EyeOff className="w-3.5 h-3.5 text-amber-500" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>{task.projectName}</span>
            <span>•</span>
            <span className="font-medium text-slate-700">{task.clientName}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Priority',
      cell: (task) => getPriorityBadge(task.priority),
    },
    {
      header: 'Status',
      cell: (task) => getStatusBadge(task.status),
    },
    {
      header: 'Progress',
      cell: (task) => (
        <div className="w-24 space-y-1">
          <div className="flex justify-between text-[10px] text-slate-600 font-medium">
            <span>{task.progressPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                task.progressPercentage === 100
                  ? 'bg-emerald-500'
                  : task.progressPercentage > 50
                  ? 'bg-blue-600'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${task.progressPercentage}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      header: 'Deadline',
      cell: (task) => (
        <div className="text-xs text-slate-600 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{task.deadline ? formatDate(task.deadline) : 'No due date'}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (task) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveTask(task);
              setIsDeliverableModalOpen(true);
            }}
            icon={<FileCheck className="w-3.5 h-3.5 text-blue-600" />}
            title="Submit Deliverable"
            className="text-xs"
          >
            Deliverable
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(task)}
            icon={<Edit className="w-3.5 h-3.5 text-slate-500" />}
            title="Edit Task"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleArchive(task)}
            icon={
              task.isArchived ? (
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Archive className="w-3.5 h-3.5 text-slate-400 hover:text-amber-600" />
              )
            }
            title={task.isArchived ? 'Restore' : 'Archive'}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTaskToDelete(task);
              setIsDeleteModalOpen(true);
            }}
            icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
            title="Delete Task"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks & Deliverables Management"
        description="Individual action items for tracking configuration, campaign rollouts, ad creatives, and GTM tag QA. Assign to specialists with optional client approval requirements."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={openCreateModal}
          >
            Create Task
          </Button>
        }
      />

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs & Search Filter Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Tasks', count: tasks.filter((t) => !t.isArchived).length },
            { id: 'todo', label: 'To Do', count: tasks.filter((t) => t.status === 'todo' && !t.isArchived).length },
            { id: 'in_progress', label: 'In Progress', count: tasks.filter((t) => t.status === 'in_progress' && !t.isArchived).length },
            { id: 'in_review', label: 'In Review', count: tasks.filter((t) => t.status === 'in_review' && !t.isArchived).length },
            { id: 'completed', label: 'Completed', count: tasks.filter((t) => t.status === 'completed' && !t.isArchived).length },
            { id: 'archived', label: 'Archived', count: tasks.filter((t) => t.isArchived).length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="flex items-center gap-2">
          <div className="w-full sm:w-60">
            <Input
              placeholder="Search tasks, clients, projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>
      </div>

      {/* Secondary filter bar: Client, Project, Priority */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <Select
          label="Filter by Client"
          value={selectedClientFilter}
          onChange={(e) => setSelectedClientFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Clients' },
            ...clients.map((c) => ({ value: c.id, label: c.businessName })),
          ]}
        />

        <Select
          label="Filter by Project"
          value={selectedProjectFilter}
          onChange={(e) => setSelectedProjectFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Projects' },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

        <Select
          label="Priority"
          value={selectedPriorityFilter}
          onChange={(e) => setSelectedPriorityFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Priorities' },
            { value: 'urgent', label: 'Urgent' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />
      </div>

      {/* Task List / Table */}
      <Card>
        <CardHeader
          title="Actionable Task Pipeline"
          subtitle={`Showing ${tasks.length} live tasks backed by Firestore /tasks`}
        />

        {loading ? (
          <LoadingState message="Loading tasks from Firestore..." />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="w-6 h-6 text-slate-400" />}
            title="No tasks found"
            description="Create actionable items such as 'Configure Stape custom subdomain' or 'Audit purchase event deduplication'."
            actionLabel="Add Task"
            onAction={openCreateModal}
          />
        ) : (
          <Table data={tasks} columns={columns} keyExtractor={(task) => task.id} />
        )}
      </Card>

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Actionable Task"
        description="Specify priority, assignee, and whether the client can view this item in their portal."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Task Title"
            placeholder="e.g. Verify Meta CAPI event deduplication key (event_id)"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Client"
              value={formClientId}
              onChange={(e) => {
                setFormClientId(e.target.value);
                const matchingProjs = projects.filter((p) => p.clientId === e.target.value);
                setFormProjectId(matchingProjs[0]?.id || '');
              }}
              options={clients.map((c) => ({ value: c.id, label: c.businessName }))}
              required
            />

            <Select
              label="Linked Project"
              value={formProjectId}
              onChange={(e) => setFormProjectId(e.target.value)}
              options={projects
                .filter((p) => !formClientId || p.clientId === formClientId)
                .map((p) => ({ value: p.id, label: p.name }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Priority"
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
              options={[
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />

            <Select
              label="Initial Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
              options={[
                { value: 'todo', label: 'To Do' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'in_review', label: 'In Review' },
                { value: 'completed', label: 'Completed' },
              ]}
            />

            <Input
              label="Deadline (Optional)"
              type="date"
              value={formDeadline}
              onChange={(e) => setFormDeadline(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Detailed Description & QA Steps</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Instructions for team specialists, server endpoints, parameter details..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-900">Client Portal Visibility</span>
              <p className="text-[11px] text-slate-500">Allow client to view this task and its status in their portal</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formClientVisible}
                onChange={(e) => setFormClientVisible(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Task Details"
        description="Update status, completion progress, deadline, and visibility."
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateTask} className="space-y-4">
          <Input
            label="Task Title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Priority"
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
              options={[
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />

            <Select
              label="Status"
              value={formStatus}
              onChange={(e) => {
                const next = e.target.value as TaskStatus;
                setFormStatus(next);
                if (next === 'completed') setFormProgress(100);
              }}
              options={[
                { value: 'todo', label: 'To Do' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'in_review', label: 'In Review' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />

            <Input
              label="Progress (%)"
              type="number"
              min={0}
              max={100}
              value={formProgress}
              onChange={(e) => setFormProgress(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
            />
            <Input
              label="Deadline"
              type="date"
              value={formDeadline}
              onChange={(e) => setFormDeadline(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs font-semibold text-slate-900">Client Portal Visibility</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formClientVisible}
                onChange={(e) => setFormClientVisible(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Drawer / Modal with Embedded Project Communications */}
      <Modal
        isOpen={isDetailDrawerOpen && Boolean(activeTask)}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={activeTask?.title || 'Task Details'}
        description={`Project: ${activeTask?.projectName} | Client: ${activeTask?.clientName}`}
        maxWidth="xl"
      >
        {activeTask && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Priority</span>
                <div className="mt-1">{getPriorityBadge(activeTask.priority)}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Status</span>
                <div className="mt-1">{getStatusBadge(activeTask.status)}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Progress</span>
                <div className="mt-1 font-semibold text-slate-800">{activeTask.progressPercentage}%</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Deadline</span>
                <div className="mt-1 text-slate-700">
                  {activeTask.deadline ? formatDate(activeTask.deadline) : 'None'}
                </div>
              </div>
            </div>

            {activeTask.description && (
              <div className="text-xs space-y-1">
                <span className="font-semibold text-slate-900">Task Scope & Instructions</span>
                <p className="text-slate-600 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                  {activeTask.description}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                icon={<FileCheck className="w-3.5 h-3.5" />}
                onClick={() => {
                  setIsDetailDrawerOpen(false);
                  setIsDeliverableModalOpen(true);
                }}
              >
                Submit Milestone Deliverable
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Edit className="w-3.5 h-3.5" />}
                onClick={() => {
                  setIsDetailDrawerOpen(false);
                  openEditModal(activeTask);
                }}
              >
                Edit Details
              </Button>
            </div>

            {/* Embedded Project Communication Section */}
            <div className="border-t border-slate-200 pt-4">
              <ProjectCommentsSection
                projectId={activeTask.projectId}
                projectName={activeTask.projectName}
                clientId={activeTask.clientId}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Deliverable Modal for Task Submissions */}
      <DeliverableModal
        isOpen={isDeliverableModalOpen}
        onClose={() => setIsDeliverableModalOpen(false)}
        task={activeTask}
        mode="submit"
        onSuccess={() => {
          setIsDeliverableModalOpen(false);
        }}
      />

      {/* Delete Task Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setTaskToDelete(null);
        }}
        title="Permanently Delete Task"
        description="Are you sure you want to permanently delete this task? This action cannot be undone."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setTaskToDelete(null);
              }}
              disabled={isDeletingTask}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteTaskConfirm}
              loading={isDeletingTask}
            >
              Permanently Delete Task
            </Button>
          </>
        }
      >
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-800 space-y-1">
          <p className="font-semibold">{taskToDelete?.title}</p>
          <p className="text-slate-600">Client: {taskToDelete?.clientName} • Project: {taskToDelete?.projectName}</p>
          <p className="text-red-700 font-medium mt-2">
            Warning: This action deletes the task document from Cloud Firestore.
          </p>
        </div>
      </Modal>
    </div>
  );
}
