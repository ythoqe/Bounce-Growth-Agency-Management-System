import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Table, Column } from '../../components/common/Table';
import { Briefcase, Eye, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Project } from '../../types/project';
import { subscribeProjects } from '../../services/projects/projectService';
import { formatDate } from '../../utils/formatters';

export function ClientProjectsPage() {
  const { currentUser, isLiveAuth, firebaseUser } = useAuth();
  const clientId = currentUser?.clientId || 'client_apex_01';

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLiveAuth || !firebaseUser) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeProjects(
      (data) => {
        setProjects(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      { clientId: clientId, clientVisibleOnly: true }
    );

    return () => unsub();
  }, [clientId, isLiveAuth, firebaseUser]);

  const columns: Column<Project>[] = [
    {
      header: 'Project Name',
      cell: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-[11px] text-slate-500 line-clamp-1">{row.description || 'Active campaign engagement'}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => {
        const colors = {
          planning: 'bg-blue-50 text-blue-700 border-blue-200',
          active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          in_progress: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          in_review: 'bg-amber-50 text-amber-700 border-amber-200',
          on_hold: 'bg-slate-100 text-slate-700 border-slate-200',
          completed: 'bg-purple-50 text-purple-700 border-purple-200',
          archived: 'bg-slate-100 text-slate-400 border-slate-200',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${colors[row.status] || 'bg-slate-50'}`}>
            {row.status.toUpperCase()}
          </span>
        );
      },
    },
    {
      header: 'Milestone Progress',
      cell: (row) => (
        <div className="w-28 space-y-1">
          <div className="text-[11px] font-medium text-slate-700 tabular-nums">
            {row.progressPercentage}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, row.progressPercentage))}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      header: 'Start Date',
      cell: (row) => <span className="text-xs text-slate-600">{formatDate(row.startDate)}</span>,
    },
    {
      header: 'Target Completion',
      cell: (row) => (
        <span className="text-xs text-slate-600">
          {row.deadline ? formatDate(row.deadline) : 'Ongoing'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approved Brand Projects"
        description="Tracking setups, performance marketing campaigns, and optimization sprints active for your brand."
      />

      {error && <ErrorState title="Failed to synchronize projects" message={error} />}

      {isLoading ? (
        <LoadingState rows={4} message="Loading your approved projects..." />
      ) : (
        <Card noPadding>
          <Table
            columns={columns}
            data={projects}
            keyExtractor={(p) => p.id}
            emptyMessage="No approved projects are currently active. When Bounce Growth specialists initiate approved projects for your brand, they will appear here."
          />
        </Card>
      )}
    </div>
  );
}
