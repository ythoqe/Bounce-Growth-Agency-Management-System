import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Tabs } from '../../components/common/Tabs';
import { EmptyState } from '../../components/common/EmptyState';
import { Settings, Shield, Database, Lock, AlertCircle, CheckCircle, Terminal } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function SettingsPage() {
  const { isFirebaseConnected, firebaseStatus } = useAuth();
  const [activeTab, setActiveTab] = useState('agency');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & System Governance"
        description="Configure agency operating parameters, review Firebase database boundaries, and inspect security audit logs."
      />

      <Tabs
        tabs={[
          { id: 'agency', label: 'Agency Profile' },
          { id: 'firebase', label: 'Firebase & Database Status' },
          { id: 'security', label: 'Security & Access Control' },
          { id: 'audit', label: 'Audit Trail Logs' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'agency' && (
        <Card className="max-w-2xl space-y-4">
          <CardHeader
            title="Agency Identity & Location"
            subtitle="Bounce Growth operational parameters"
          />
          <Input label="Agency Legal Name" defaultValue="Bounce Growth" disabled />
          <Input label="Headquarters Location" defaultValue="Dhaka, Bangladesh" disabled />
          <Input label="Primary Timezone" defaultValue="Asia/Dhaka (GMT+6)" disabled />
          <Input label="Core Specialty" defaultValue="Tracking-First Digital Marketing (Meta CAPI, GA4, GTM, Ads, CRO)" disabled />
          <p className="text-xs text-slate-500 italic">
            Single-agency deployment mode. Multi-tenancy is deliberately disabled.
          </p>
        </Card>
      )}

      {activeTab === 'firebase' && (
        <div className="space-y-4 max-w-3xl">
          <Card>
            <CardHeader
              title="Firebase Infrastructure Status"
              subtitle="Firestore Database, Firebase Auth, and Cloud Storage integration boundary"
            />
            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Firestore Project ID</p>
                  <p className="text-slate-500 font-mono text-[11px]">{firebaseStatus.projectId}</p>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Provisioned
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Database Instance</p>
                  <p className="text-slate-500 font-mono text-[11px]">{firebaseStatus.databaseId}</p>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                  Enterprise
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Cloud Storage Bucket</p>
                  <p className="text-slate-500 font-mono text-[11px]">{firebaseStatus.storageBucket}</p>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-200 text-slate-800">
                  Active
                </span>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-slate-700 leading-relaxed space-y-2">
                <p className="font-semibold text-blue-900">Phase 1 Boundary Preparation Complete:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Client SDK integration boundary is established without fake or hardcoded credentials.</li>
                  <li>Firestore schema blueprint (users, clients, projects, tasks, invoices, assets, audit_logs) is fully typed.</li>
                  <li>Firestore security error handler with context JSON payload is wired and ready.</li>
                  <li>Next Phase will trigger interactive Firebase provisioning and rule deployment upon user approval.</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'security' && (
        <Card className="max-w-3xl">
          <CardHeader
            title="Role-Based Access Control (RBAC) Architecture"
            subtitle="Strict boundary between internal agency operations and external client portal"
          />
          <div className="space-y-4 pt-2 text-xs text-slate-700">
            <div className="border border-slate-200 rounded-lg p-3 space-y-1 bg-slate-50">
              <span className="font-semibold text-slate-900">1. Admin / Founder Role:</span>
              <p className="text-slate-600">Full read/write access to all collections, financial margins, invoicing, expenses, client management, team invitations, and audit logs.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 space-y-1 bg-slate-50">
              <span className="font-semibold text-slate-900">2. Team Member (Specialist) Role:</span>
              <p className="text-slate-600">Access limited to assigned clients, tracking assets, campaign tasks, and SOPs. Strictly blocked from financial ledger and agency profit.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 space-y-1 bg-slate-50">
              <span className="font-semibold text-slate-900">3. Client Portal Role:</span>
              <p className="text-slate-600">Strictly isolated by <code>clientId</code>. Only access approved deliverables, visible tasks, issued invoices, published reports, and shared tracking dashboards. Never able to query other clients or internal notes.</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card>
          <CardHeader
            title="System Audit Trail"
            subtitle="Target Firestore collection: /audit_logs (Immutable activity records for compliance)"
          />
          <EmptyState
            icon={<Shield className="w-6 h-6 text-slate-400" />}
            title="Audit trail initialized"
            description="Sensitive operations such as user privilege changes, invoice issuance, and asset credential updates will generate immutable audit entries."
          />
        </Card>
      )}
    </div>
  );
}
