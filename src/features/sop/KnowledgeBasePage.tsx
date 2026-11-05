import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Tabs } from '../../components/common/Tabs';
import { BookOpen, Plus, Search, Code, CheckCircle } from 'lucide-react';

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="space-y-6">
      <PageHeader
        title="SOP & Technical Knowledge Base"
        description="Standard Operating Procedures for Meta CAPI deployment, Server-Side GTM tag architecture, GA4 event naming conventions, and iOS 14.5+ attribution workarounds."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {}}
          >
            New SOP Guide
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'all', label: 'All SOPs', count: 0 },
          { id: 'tracking', label: 'Server-Side Tracking SOPs', count: 0 },
          { id: 'meta_ads', label: 'Meta Ads Frameworks', count: 0 },
          { id: 'google_ads', label: 'Google Ads Best Practices', count: 0 },
          { id: 'qa', label: 'QA Checklists', count: 0 },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <Card>
        <CardHeader
          title="Internal Knowledge Repository"
          subtitle="Target Firestore collection: /sops (Internal agency access only)"
        />
        <EmptyState
          icon={<BookOpen className="w-6 h-6 text-slate-400" />}
          title="No SOPs published yet"
          description="Document operational runbooks to ensure tracking consistency and standardize onboarding."
          actionLabel="Create First SOP"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
