import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Table, Column } from '../../components/common/Table';
import { DeliverableModal } from '../../components/common/DeliverableModal';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  ExternalLink,
  Search,
  Eye,
  Calendar,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Task, TaskPriority, TaskStatus } from '../../types/task';
import { Deliverable } from '../../types/deliverable';
import { subscribeTasks } from '../../services/tasks/taskService';
import { subscribeDeliverables } from '../../services/deliverables/deliverableService';
import { formatDate } from '../../utils/formatters';

export function ClientTasksPage() {
  const { currentUser, isLiveAuth, firebaseUser, currentRole } = useAuth();
  const clientId = currentUser?.clientId || 'client_apex_01';
  const actor = {
    uid: (isLiveAuth ? firebaseUser?.uid : currentUser?.id) || 'usr_client_dhaka',
    email: (isLiveAuth ? firebaseUser?.email : currentUser?.email) || 'ceo@apexretailbd.com',
    role: currentRole as 'admin' | 'team' | 'client',
    clientId,
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Modal State
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);

    const unsubTasks = subscribeTasks(
      { clientId, includeArchived: false },
      (items) => {
        setTasks(items);
        setLoading(false);
      },
      { uid: actor.uid, role: 'client', clientId },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubDeliverables = subscribeDeliverables(
      { clientId },
      (delivs) => {
        setDeliverables(delivs);
      },
      { uid: actor.uid, role: 'client', clientId }
    );

    return () => {
      unsubTasks();
      unsubDeliverables();
    };
  }, [clientId, actor.uid]);

  const pendingReviewDeliverables = deliverables.filter(
    (d) => d.status === 'submitted' || d.status === 'under_review'
  );

  const approvedDeliverables = deliverables.filter(
    (d) => d.status === 'approved' || d.status === 'revision_requested' || d.status === 'rejected'
  );

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">High</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">Standard</span>;
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Completed</span>;
      case 'in_review':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">Needs Review</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">In Progress</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">Queued</span>;
    }
  };

  const taskColumns: Column<Task>[] = [
    {
      header: 'Task Title',
      cell: (task) => (
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-900 text-xs">{task.title}</p>
          <p className="text-[11px] text-slate-500">{task.projectName}</p>
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
      header: 'Estimated Due',
      cell: (task) => (
        <div className="text-xs text-slate-600 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{task.deadline ? formatDate(task.deadline) : 'Ongoing'}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks, Approvals & Deliverables"
        description="Review tracking setups, conversion tag audits, campaign copy, and deliverables requiring your approval before deployment."
      />

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: Pending Deliverables Review Queue */}
      <Card>
        <CardHeader
          title="Sign-off & Approval Queue"
          subtitle="Milestones submitted by Bounce Growth awaiting your sign-off or feedback"
        />

        {loading ? (
          <LoadingState message="Loading deliverable queue..." />
        ) : pendingReviewDeliverables.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            title="All clear! No deliverables pending approval"
            description="When Bounce Growth specialists submit completed milestones or reports, they will appear here for review."
          />
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingReviewDeliverables.map((deliv) => (
              <div
                key={deliv.id}
                className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                      Version {deliv.version}
                    </span>
                    <h4 className="font-semibold text-slate-900 text-sm">{deliv.title}</h4>
                    <p className="text-[11px] text-slate-500">{deliv.projectName}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Awaiting Review
                  </span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {deliv.description}
                </p>

                {deliv.externalUrl && (
                  <div>
                    <a
                      href={deliv.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Verification Dashboard
                    </a>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Submitted: {new Date(deliv.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<FileCheck className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setSelectedDeliverable(deliv);
                      setIsReviewModalOpen(true);
                    }}
                  >
                    Review & Decide
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* SECTION 2: Active Project Tasks (Client Visible) */}
      <Card>
        <CardHeader
          title="Active Project Tasks"
          subtitle={`Tasks approved for your review (Total: ${tasks.length})`}
        />

        {loading ? (
          <LoadingState message="Loading client tasks..." />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="w-6 h-6 text-slate-400" />}
            title="No client-visible tasks found"
            description="Tasks configured by Bounce Growth for your tracking setup will be displayed here."
          />
        ) : (
          <Table data={tasks} columns={taskColumns} keyExtractor={(task) => task.id} />
        )}
      </Card>

      {/* Interactive Review Modal */}
      {selectedDeliverable && (
        <DeliverableModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          existingDeliverable={selectedDeliverable}
          mode="review"
          onSuccess={() => {
            setIsReviewModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
