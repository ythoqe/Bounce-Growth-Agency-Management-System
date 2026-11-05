import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { FileCheck } from 'lucide-react';

export function ClientDocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shared Documents & Agreements"
        description="Access signed service contracts, client NDAs, and tracking implementation briefs."
      />

      <Card>
        <CardHeader
          title="Shared Document Repository"
          subtitle="Filtered strictly by clientId: client_apex_01 & clientVisible: true"
        />
        <EmptyState
          icon={<FileCheck className="w-6 h-6 text-slate-400" />}
          title="No shared documents uploaded yet"
          description="Contracts, tracking schemas, and client onboarding guides shared by your account manager will be available here."
        />
      </Card>
    </div>
  );
}
