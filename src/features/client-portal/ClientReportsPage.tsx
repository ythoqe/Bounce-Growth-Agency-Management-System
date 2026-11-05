import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { BarChart2 } from 'lucide-react';

export function ClientReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Reports & Looker Studio"
        description="Access multi-touch attribution analysis, Meta Ads ROAS, GA4 e-commerce funnel data, and live Looker Studio dashboards."
      />

      <Card>
        <CardHeader
          title="Published Client Reports"
          subtitle="Filtered strictly by clientId: client_apex_01 & clientVisible: true"
        />
        <EmptyState
          icon={<BarChart2 className="w-6 h-6 text-slate-400" />}
          title="No published performance reports yet"
          description="Monthly attribution reports and Looker Studio dashboards prepared by Bounce Growth will appear here."
        />
      </Card>
    </div>
  );
}
