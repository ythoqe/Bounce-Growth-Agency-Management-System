import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Table, Column } from '../../components/common/Table';
import { BarChart2, ExternalLink, Calendar, Shield } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Deliverable } from '../../types/deliverable';
import { subscribeDeliverables } from '../../services/deliverables/deliverableService';
import { formatDate } from '../../utils/formatters';

export function ClientReportsPage() {
  const { currentUser, currentRole } = useAuth();
  const clientId = currentUser?.clientId;

  const [reports, setReports] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || currentRole !== 'client' || !clientId) {
      setReports([]);
      setLoading(false);
      return;
    }

    const unsub = subscribeDeliverables(
      { clientId: clientId },
      (data) => {
        // Exclude internal drafts
        setReports(data.filter((d) => d.status !== 'draft'));
        setLoading(false);
      },
      currentUser,
      (err) => console.error(err)
    );

    return () => unsub();
  }, [clientId, currentRole, currentUser]);

  const columns: Column<Deliverable>[] = [
    {
      header: 'Report Title',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
            <span>{row.title}</span>
            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              v{row.version}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 line-clamp-1">{row.description || 'Campaign performance deliverable'}</div>
        </div>
      ),
    },
    {
      header: 'Associated Project',
      cell: (row) => <span className="text-xs font-medium text-slate-700">{row.projectName}</span>,
    },
    {
      header: 'Submitted Date',
      cell: (row) => <span className="text-xs text-slate-600">{formatDate(row.submittedAt)}</span>,
    },
    {
      header: 'Status',
      cell: (row) => {
        const variants: Record<string, 'neutral' | 'blue' | 'green' | 'amber' | 'red'> = {
          approved: 'green',
          submitted: 'blue',
          under_review: 'blue',
          revision_requested: 'amber',
          rejected: 'red',
        };
        const labels: Record<string, string> = {
          approved: 'Approved',
          submitted: 'Ready for Review',
          under_review: 'Under Review',
          revision_requested: 'Revision Requested',
          rejected: 'Rejected',
        };
        return <Badge variant={variants[row.status] || 'neutral'}>{labels[row.status] || row.status}</Badge>;
      },
    },
    {
      header: 'Dashboard Link',
      align: 'right',
      cell: (row) =>
        row.externalUrl ? (
          <a
            href={row.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open Dashboard
          </a>
        ) : (
          <span className="text-xs text-slate-400 italic">Document File</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Reports & Dashboards"
        description="Access multi-touch attribution analysis, Meta Ads ROAS, GA4 e-commerce funnel data, and live Looker Studio dashboards."
      />

      <Card>
        <CardHeader
          title="Published Client Reports"
          subtitle={`Reporting deliverables authorized for ${currentUser?.displayName || 'your organization'}. Filtered strictly by client ID: ${clientId || 'None'}.`}
        />

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading reports from database...</div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<BarChart2 className="w-6 h-6 text-slate-400" />}
            title="No published performance reports yet"
            description="Monthly attribution reports and Looker Studio dashboards prepared by Bounce Growth will appear here."
          />
        ) : (
          <Table columns={columns} data={reports} keyExtractor={(r) => r.id} />
        )}
      </Card>
    </div>
  );
}
