import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Tabs } from '../../components/common/Tabs';
import { BarChart3, Plus, ExternalLink, Calendar } from 'lucide-react';

export function ReportsAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Reports & Looker Studio Hub"
        description="Deliverable client analytics, monthly attribution audits, ROAS tracking, and embeddable Looker Studio dashboards."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {}}
          >
            Publish New Report
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'all', label: 'All Reports', count: 0 },
          { id: 'monthly', label: 'Monthly Audits', count: 0 },
          { id: 'looker', label: 'Looker Studio Live Feeds', count: 0 },
          { id: 'cro', label: 'CRO & A/B Test Audits', count: 0 },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <Card>
        <CardHeader
          title="Client Performance Reports Archive"
          subtitle="Target Firestore collection: /reports (Client portal users can only access reports matching their clientId)"
        />
        <EmptyState
          icon={<BarChart3 className="w-6 h-6 text-slate-400" />}
          title="No performance reports published yet"
          description="Generate and publish tracking health audits, Meta Ads ROAS analysis, and Looker Studio reports here."
          actionLabel="Create Monthly Report"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
