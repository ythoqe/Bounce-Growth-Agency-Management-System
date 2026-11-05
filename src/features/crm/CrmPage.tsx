import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Target, Plus, Search, Filter } from 'lucide-react';

export function CrmPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM & Pipeline Leads"
        description="Capture inbound leads from Bangladesh and international markets, track qualification stage, audit requirements, and convert to active retainer clients."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add New Lead
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Leads', count: 0 },
            { id: 'new', label: 'New Inquiries', count: 0 },
            { id: 'audit_scheduled', label: 'Tracking Audit Scheduled', count: 0 },
            { id: 'proposal_sent', label: 'Proposal Sent', count: 0 },
            { id: 'won', label: 'Closed Won', count: 0 },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search leads by name, domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
      </div>

      <Card>
        <CardHeader
          title="Lead Pipeline Matrix"
          subtitle="Real-time pipeline storage configured for Firestore collection: /leads"
        />
        <EmptyState
          icon={<Target className="w-6 h-6 text-slate-400" />}
          title="No leads in this stage"
          description="Inbound agency inquiries from Meta Ads, website forms, and direct outreach will appear here."
          actionLabel="Add Lead"
          onAction={() => setIsAddModalOpen(true)}
        />
      </Card>

      {/* Add Lead Modal Shell */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Lead Opportunity"
        description="Record prospect business details, service interests, and estimated retainer value."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                // Phase 1 preview handler
                setIsAddModalOpen(false);
              }}
            >
              Save Lead Record
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Company / Brand Name" placeholder="e.g. Apex Apparel BD" required />
          <Input label="Website URL" placeholder="https://apexapparel.com.bd" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Contact Person" placeholder="Mohammad Rafiq" required />
            <Input label="Contact Email" type="email" placeholder="rafiq@apexapparel.com" required />
          </div>
          <Select
            label="Primary Service Interest"
            options={[
              { value: 'server_side_tracking', label: 'Server-Side GTM & Meta CAPI' },
              { value: 'meta_ads', label: 'Meta Ads Management' },
              { value: 'google_ads', label: 'Google Search & Performance Max Ads' },
              { value: 'ga4', label: 'GA4 Setup & E-commerce Funnel Audit' },
              { value: 'cro', label: 'Conversion Rate Optimization (CRO)' },
            ]}
          />
          <Input label="Estimated Monthly Retainer (USD)" type="number" placeholder="1500" />
        </div>
      </Modal>
    </div>
  );
}
