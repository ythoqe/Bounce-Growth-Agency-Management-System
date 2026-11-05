import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { UserCheck, Plus, Shield, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function TeamPage() {
  const { currentRole } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Team & Specialist Roster"
        description="Manage Bounce Growth tracking engineers, media buyers, and managers. Assign clients and projects with granular access controls."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {}}
          >
            Invite Team Specialist
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Active Specialists & Roles"
          subtitle="Target Firestore collection: /users (Filtered by role: 'admin' | 'team')"
        />
        <EmptyState
          icon={<UserCheck className="w-6 h-6 text-slate-400" />}
          title="Team members will be listed here"
          description="Specialists can be assigned to client accounts to manage server containers, campaign setup, and creative QA."
          actionLabel="Invite Member"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
