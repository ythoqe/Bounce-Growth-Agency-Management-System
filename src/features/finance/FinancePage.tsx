import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Tabs } from '../../components/common/Tabs';
import { DollarSign, Plus, Lock, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function FinancePage() {
  const { currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices');

  if (currentRole !== 'admin') {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl my-6">
        <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">Restricted Administrative Area</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Agency finance, invoices, expenses, and profit figures are restricted strictly to Founder / Admin role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance, Invoicing & Agency Expenses"
        description="Issue client invoices in USD and BDT (bKash/Nagad/Bank Wire), track payment receipts, and record operational tool/server expenses. Strictly internal."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {}}>
              Record Expense
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {}}
            >
              Issue Invoice
            </Button>
          </div>
        }
      />

      {/* Finance Stat Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Outstanding Invoices</span>
            <ArrowUpRight className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">$0.00</div>
            <p className="text-[11px] text-slate-400 mt-1">0 invoices awaiting payment</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Collected Revenue (MTD)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">$0.00</div>
            <p className="text-[11px] text-slate-400 mt-1">Verified bank & bKash deposits</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Monthly Infrastructure Costs</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">$0.00</div>
            <p className="text-[11px] text-slate-400 mt-1">Stape, Cloud Run, proxy tools</p>
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: 'invoices', label: 'Client Invoices', count: 0 },
          { id: 'unpaid', label: 'Overdue & Pending', count: 0 },
          { id: 'expenses', label: 'Agency Expenses (Internal Only)', count: 0 },
          { id: 'pnl', label: 'Profit & Loss Overview', count: 0 },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <Card>
        <CardHeader
          title="Invoicing Ledger"
          subtitle="Target Firestore collections: /invoices and /expenses (Admin-only RBAC rules)"
        />
        <EmptyState
          icon={<DollarSign className="w-6 h-6 text-slate-400" />}
          title="No invoices currently issued"
          description="Create structured retainer invoices with automated itemized services and payment instructions."
          actionLabel="Create Invoice"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
