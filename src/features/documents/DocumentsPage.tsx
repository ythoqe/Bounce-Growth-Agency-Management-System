import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Tabs } from '../../components/common/Tabs';
import { FileText, Plus, Upload, Folder } from 'lucide-react';

export function DocumentsPage() {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Documents & Contracts"
        description="Store service level agreements (SLAs), client onboarding tracking briefs, GTM audit sheets, and nondisclosure agreements. Securely stored in Cloud Storage for Firebase."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Upload className="w-3.5 h-3.5" />}
            onClick={() => {}}
          >
            Upload Document
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'all', label: 'All Documents', count: 0 },
          { id: 'contracts', label: 'Client Contracts & Retainers', count: 0 },
          { id: 'briefs', label: 'Tracking & Pixel Briefs', count: 0 },
          { id: 'internal', label: 'Agency Internal Only', count: 0 },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <Card>
        <CardHeader
          title="Document Repository"
          subtitle="Backed by Cloud Storage for Firebase with strict read/write security rules"
        />
        <EmptyState
          icon={<FileText className="w-6 h-6 text-slate-400" />}
          title="No documents uploaded"
          description="Upload client NDAs, retainer agreements, or GTM container export files (.json) for secure storage."
          actionLabel="Upload First File"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
