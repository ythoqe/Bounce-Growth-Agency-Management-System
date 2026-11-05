import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Tabs } from '../../components/common/Tabs';
import { Calendar, Plus, Filter } from 'lucide-react';

export function ContentCalendarPage() {
  const [activeTab, setActiveTab] = useState('upcoming');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing & Ad Content Calendar"
        description="Schedule ad creatives, promo copy variations, seasonal campaign launches, and client review deadlines across Meta, Google, and TikTok."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {}}
          >
            Schedule Campaign Entry
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'upcoming', label: 'Upcoming Drops', count: 0 },
          { id: 'in_creative', label: 'In Creative / Copy', count: 0 },
          { id: 'client_review', label: 'Client Ad Review', count: 0 },
          { id: 'live', label: 'Live Campaigns', count: 0 },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <Card>
        <CardHeader
          title="Campaign Schedule Matrix"
          subtitle="Target Firestore collection: /campaign_calendar"
        />
        <EmptyState
          icon={<Calendar className="w-6 h-6 text-slate-400" />}
          title="No campaigns or ad drops scheduled"
          description="Map upcoming seasonal promos (Eid, Black Friday, Pahela Baishakh, 11.11) and client creative sprints."
          actionLabel="Schedule Campaign"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
