import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import {
  Target,
  Plus,
  Search,
  Building,
  Mail,
  Phone,
  Globe,
  DollarSign,
  Calendar,
  ArrowRight,
  UserCheck,
  Edit2,
  Trash2,
  Filter,
  Kanban,
  List,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  X,
} from 'lucide-react';
import {
  subscribeLeads,
  createLead,
  updateLead,
  updateLeadStage,
  deleteLead,
  convertLeadToClient,
} from '../../services/crm/leadService';
import { Lead, LeadStage, CreateLeadInput } from '../../types/crm';
import { useAuth } from '../auth/AuthContext';
import { formatCurrency } from '../../utils/formatters';

const STAGE_CONFIG: Record<
  LeadStage,
  { label: string; color: string; badgeVariant: 'amber' | 'blue' | 'green' | 'neutral' | 'red' }
> = {
  new: { label: 'New Inquiry', color: 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/20', badgeVariant: 'blue' },
  audit_scheduled: {
    label: 'Tracking Audit Scheduled',
    color: 'border-purple-400 bg-purple-50/40 dark:bg-purple-950/20',
    badgeVariant: 'amber',
  },
  proposal_sent: {
    label: 'Proposal Sent',
    color: 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20',
    badgeVariant: 'amber',
  },
  negotiation: {
    label: 'Negotiation',
    color: 'border-orange-400 bg-orange-50/40 dark:bg-orange-950/20',
    badgeVariant: 'amber',
  },
  won: { label: 'Closed Won', color: 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20', badgeVariant: 'green' },
  lost: { label: 'Closed Lost', color: 'border-slate-400 bg-slate-50/40 dark:bg-slate-900/20', badgeVariant: 'neutral' },
};

const SERVICE_OPTIONS = [
  { value: 'Server-Side GTM & Meta CAPI', label: 'Server-Side GTM & Meta CAPI' },
  { value: 'Meta Ads Management & Scaling', label: 'Meta Ads Management & Scaling' },
  { value: 'Google Search & Performance Max Ads', label: 'Google Search & Performance Max Ads' },
  { value: 'GA4 Setup & E-commerce Funnel Audit', label: 'GA4 Setup & E-commerce Funnel Audit' },
  { value: 'Conversion Rate Optimization (CRO)', label: 'Conversion Rate Optimization (CRO)' },
  { value: 'Full-Stack Performance Marketing Retainer', label: 'Full-Stack Performance Marketing Retainer' },
];

export function CrmPage() {
  const { currentUser, firebaseUser, isLiveAuth, signInWithGoogle } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Views
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [valueRangeFilter, setValueRangeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Form State (Clean defaults, no autofill)
  const [formData, setFormData] = useState<CreateLeadInput>({
    companyName: '',
    website: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    serviceInterest: 'Server-Side GTM & Meta CAPI',
    estimatedValue: 0,
    currency: 'BDT',
    stage: 'new',
    notes: '',
    source: 'Website Inbound',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Actor
  const actor = useMemo(() => ({
    uid: firebaseUser?.uid || currentUser?.id || 'admin',
    email: firebaseUser?.email || currentUser?.email || 'admin@bouncegrowth.agency',
    name: firebaseUser?.displayName || currentUser?.displayName || 'Admin',
    role: currentUser?.role || 'admin',
  }), [currentUser, firebaseUser]);

  // Subscribe to real-time Leads
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeLeads(
      (data) => {
        setLeads(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to subscribe to leads:', err);
        setError('Failed to load leads from Firestore. Please verify permissions.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser, isLiveAuth]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesTab = activeTab === 'all' || lead.stage === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        lead.companyName.toLowerCase().includes(q) ||
        lead.contactPerson.toLowerCase().includes(q) ||
        lead.contactEmail.toLowerCase().includes(q) ||
        (lead.website && lead.website.toLowerCase().includes(q)) ||
        lead.serviceInterest.toLowerCase().includes(q);

      if (!matchesTab || !matchesSearch) return false;

      if (serviceFilter !== 'all' && lead.serviceInterest !== serviceFilter) {
        return false;
      }

      if (valueRangeFilter !== 'all') {
        const val = Number(lead.estimatedValue) || 0;
        const bdtVal = lead.currency === 'USD' ? val * 120 : val;
        if (valueRangeFilter === 'under50k' && bdtVal >= 50000) return false;
        if (valueRangeFilter === '50k-150k' && (bdtVal < 50000 || bdtVal > 150000)) return false;
        if (valueRangeFilter === 'over150k' && bdtVal <= 150000) return false;
      }

      return true;
    });
  }, [leads, activeTab, searchQuery, serviceFilter, valueRangeFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const totalPipelineBDT = leads.reduce((acc, lead) => {
      const val = Number(lead.estimatedValue) || 0;
      return acc + (lead.currency === 'USD' ? val * 120 : val);
    }, 0);

    const counts = {
      all: leads.length,
      new: leads.filter((l) => l.stage === 'new').length,
      audit_scheduled: leads.filter((l) => l.stage === 'audit_scheduled').length,
      proposal_sent: leads.filter((l) => l.stage === 'proposal_sent').length,
      negotiation: leads.filter((l) => l.stage === 'negotiation').length,
      won: leads.filter((l) => l.stage === 'won').length,
      lost: leads.filter((l) => l.stage === 'lost').length,
      totalPipelineBDT,
    };
    return counts;
  }, [leads]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      companyName: '',
      website: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      serviceInterest: 'Server-Side GTM & Meta CAPI',
      estimatedValue: 0,
      currency: 'BDT',
      stage: 'new',
      notes: '',
      source: 'Website Inbound',
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      companyName: lead.companyName,
      website: lead.website || '',
      contactPerson: lead.contactPerson,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone || '',
      serviceInterest: lead.serviceInterest,
      estimatedValue: lead.estimatedValue,
      currency: lead.currency,
      stage: lead.stage,
      notes: lead.notes || '',
      source: lead.source || '',
    });
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDeleteModalOpen(true);
  };

  // Open Convert Modal
  const handleOpenConvertModal = (lead: Lead) => {
    setSelectedLead(lead);
    setIsConvertModalOpen(true);
  };

  // Submit Create Lead
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim() || !formData.contactPerson.trim() || !formData.contactEmail.trim()) {
      setError('Company Name, Contact Person, and Email are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createLead(formData, actor);
      setIsAddModalOpen(false);
      setSuccessMessage(`Lead "${formData.companyName}" successfully recorded.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error creating lead:', err);
      setError(err.message || 'Failed to save lead record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Lead
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    if (!formData.companyName.trim() || !formData.contactPerson.trim() || !formData.contactEmail.trim()) {
      setError('Company Name, Contact Person, and Email are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await updateLead(selectedLead.id, formData, actor);
      setIsEditModalOpen(false);
      setSelectedLead(null);
      setSuccessMessage(`Lead "${formData.companyName}" updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error updating lead:', err);
      setError(err.message || 'Failed to update lead record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Delete Lead
  const handleDeleteSubmit = async () => {
    if (!selectedLead) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await deleteLead(selectedLead.id, selectedLead.companyName, actor);
      setIsDeleteModalOpen(false);
      setSelectedLead(null);
      setSuccessMessage('Lead deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error deleting lead:', err);
      setError(err.message || 'Failed to delete lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Stage Change
  const handleQuickStageChange = async (lead: Lead, newStage: LeadStage) => {
    try {
      await updateLeadStage(lead.id, newStage, actor);
      setSuccessMessage(`Moved ${lead.companyName} to ${STAGE_CONFIG[newStage].label}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError('Failed to update stage: ' + err.message);
    }
  };

  // Convert to Client
  const handleConvertSubmit = async () => {
    if (!selectedLead) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const clientId = await convertLeadToClient(selectedLead, actor);
      setIsConvertModalOpen(false);
      setSelectedLead(null);
      setSuccessMessage(`Lead successfully converted to active Client (ID: ${clientId})! Check the Clients section.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error converting lead:', err);
      setError(err.message || 'Failed to convert lead to client.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM & Pipeline Leads"
        description="Capture inbound leads from Bangladesh and international markets, track qualification stages, audit tracking requirements, and convert into active retainer clients."
        actions={
          <div className="flex items-center gap-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 flex items-center shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Kanban Board View"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="List Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleOpenAddModal}
            >
              Add New Lead
            </Button>
          </div>
        }
      />

      {/* Notifications / Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {!isLiveAuth && (
        <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-xs text-slate-700 dark:text-slate-300">
              <strong className="font-semibold text-slate-900 dark:text-white">Live Cloud Firestore Authentication:</strong> Sign in with Google as <code className="text-[11px] font-mono text-blue-800 dark:text-blue-300">hmmojjammalhoq@gmail.com</code> to synchronize pipeline updates and manage full agency permissions.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={signInWithGoogle} className="text-xs shrink-0">
            Sign in with Google
          </Button>
        </div>
      )}

      {/* Pipeline Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Leads</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{metrics.all}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400">New Inquiries</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{metrics.new}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="text-xs font-medium text-purple-600 dark:text-purple-400">Audits Scheduled</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{metrics.audit_scheduled}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Proposals Sent</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{metrics.proposal_sent}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Closed Won</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{metrics.won}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Est. Pipeline (BDT)</div>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 truncate">
            {formatCurrency(metrics.totalPipelineBDT, 'BDT')}
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Leads', count: metrics.all },
            { id: 'new', label: 'Inquiries', count: metrics.new },
            { id: 'audit_scheduled', label: 'Audit Scheduled', count: metrics.audit_scheduled },
            { id: 'proposal_sent', label: 'Proposal Sent', count: metrics.proposal_sent },
            { id: 'negotiation', label: 'Negotiation', count: metrics.negotiation },
            { id: 'won', label: 'Closed Won', count: metrics.won },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search leads by name, email, brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter Leads:</span>
          </div>

          {/* Service Interest Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Service:</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-2.5 py-1 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[220px]"
            >
              <option value="all">All Services ({leads.length})</option>
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estimated Value Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Pipeline Value:</span>
            <select
              value={valueRangeFilter}
              onChange={(e) => setValueRangeFilter(e.target.value)}
              className="px-2.5 py-1 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Value Tiers</option>
              <option value="under50k">&lt; ৳50,000</option>
              <option value="50k-150k">৳50,000 – ৳150,000</option>
              <option value="over150k">&gt; ৳150,000</option>
            </select>
          </div>
        </div>

        {/* View mode toggle & reset */}
        <div className="flex items-center gap-3">
          {(serviceFilter !== 'all' || valueRangeFilter !== 'all' || searchQuery.trim() !== '') && (
            <button
              onClick={() => {
                setServiceFilter('all');
                setValueRangeFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          )}

          <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <LoadingState message="Syncing pipeline leads from Firestore..." />
      ) : filteredLeads.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="w-6 h-6 text-slate-400" />}
            title="No leads in this stage"
            description="Inbound agency inquiries from Meta Ads, website audits, and client referrals will appear here."
            actionLabel="Add First Lead"
            onAction={handleOpenAddModal}
          />
        </Card>
      ) : viewMode === 'kanban' ? (
        /* Kanban Pipeline View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {(['new', 'audit_scheduled', 'proposal_sent', 'negotiation', 'won'] as LeadStage[]).map((stageKey) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stageKey);
            const cfg = STAGE_CONFIG[stageKey];

            return (
              <div
                key={stageKey}
                className="flex flex-col bg-slate-100/70 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800 min-h-[500px]"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {cfg.label}
                    </span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards List */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {stageLeads.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 italic">
                      Empty stage
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-white dark:bg-slate-800 rounded-lg p-3.5 border border-slate-200/90 dark:border-slate-700 shadow-xs hover:shadow-md transition-shadow group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                              {lead.companyName}
                            </h4>
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(lead)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                title="Edit Lead"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(lead)}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title="Delete Lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <span>{lead.contactPerson}</span>
                            {lead.contactEmail && (
                              <span className="truncate max-w-[150px]">• {lead.contactEmail}</span>
                            )}
                          </div>

                          <div className="mt-2.5 inline-block text-[11px] font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 rounded line-clamp-1">
                            {lead.serviceInterest}
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">Est. Retainer:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(lead.estimatedValue, lead.currency)}/mo
                            </span>
                          </div>
                        </div>

                        {/* Card Actions & Stage Controls */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1">
                          {lead.stage !== 'won' ? (
                            <div className="flex items-center gap-1 w-full justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  const stages: LeadStage[] = ['new', 'audit_scheduled', 'proposal_sent', 'negotiation', 'won'];
                                  const nextIdx = stages.indexOf(lead.stage) + 1;
                                  if (nextIdx < stages.length) {
                                    handleQuickStageChange(lead, stages[nextIdx]);
                                  }
                                }}
                                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                              >
                                Advance <ArrowRight className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenConvertModal(lead)}
                                className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                              >
                                <UserCheck className="w-3 h-3" /> Convert
                              </button>
                            </div>
                          ) : (
                            <div className="w-full flex items-center justify-between">
                              <Badge variant="green" size="sm">
                                Won Client
                              </Badge>
                              {!lead.convertedClientId && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenConvertModal(lead)}
                                  className="text-[11px] font-semibold text-emerald-600 hover:underline"
                                >
                                  Setup Client
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table View */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-semibold">Prospect / Brand</th>
                  <th className="py-3 px-4 font-semibold">Contact Details</th>
                  <th className="py-3 px-4 font-semibold">Service Interest</th>
                  <th className="py-3 px-4 font-semibold">Est. Value</th>
                  <th className="py-3 px-4 font-semibold">Stage</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLeads.map((lead) => {
                  const cfg = STAGE_CONFIG[lead.stage];
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                        <div className="font-semibold">{lead.companyName}</div>
                        {lead.website && (
                          <a
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Globe className="w-3 h-3" />
                            {lead.website}
                          </a>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <div>{lead.contactPerson}</div>
                        <div className="text-xs text-slate-400">{lead.contactEmail}</div>
                        {lead.contactPhone && (
                          <div className="text-xs text-slate-400">{lead.contactPhone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-700/60 rounded text-xs">
                          {lead.serviceInterest}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(lead.estimatedValue, lead.currency)}/mo
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={cfg.badgeVariant} size="sm">
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {lead.stage !== 'won' && (
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<UserCheck className="w-3 h-3 text-emerald-600" />}
                              onClick={() => handleOpenConvertModal(lead)}
                            >
                              Convert
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                            onClick={() => handleOpenEditModal(lead)}
                            title="Edit Lead"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                            onClick={() => handleOpenDeleteModal(lead)}
                            title="Delete Lead"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Lead Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Lead Opportunity"
        description="Record prospect business details, service interests, and estimated retainer value."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Lead Record'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Company / Brand Name *"
            placeholder="e.g. Apex Apparel BD"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            autoComplete="off"
            required
          />

          <Input
            label="Website URL"
            placeholder="https://apexapparel.com.bd"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            autoComplete="off"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Person *"
              placeholder="e.g. Mohammad Rafiq"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              autoComplete="off"
              required
            />
            <Input
              label="Contact Email *"
              type="email"
              placeholder="e.g. rafiq@apexapparel.com"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              autoComplete="off"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Phone / WhatsApp"
              placeholder="+8801700000000"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              autoComplete="off"
            />
            <Select
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'BDT' | 'USD' })}
              options={[
                { value: 'BDT', label: 'BDT (৳ - Bangladeshi Taka)' },
                { value: 'USD', label: 'USD ($ - US Dollar)' },
              ]}
            />
          </div>

          <Select
            label="Primary Service Interest"
            value={formData.serviceInterest}
            onChange={(e) => setFormData({ ...formData, serviceInterest: e.target.value })}
            options={SERVICE_OPTIONS}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Estimated Monthly Retainer"
              type="number"
              placeholder="0"
              value={formData.estimatedValue || ''}
              onChange={(e) => setFormData({ ...formData, estimatedValue: Number(e.target.value) || 0 })}
              autoComplete="off"
            />
            <Select
              label="Pipeline Stage"
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value as LeadStage })}
              options={[
                { value: 'new', label: 'New Inquiry' },
                { value: 'audit_scheduled', label: 'Tracking Audit Scheduled' },
                { value: 'proposal_sent', label: 'Proposal Sent' },
                { value: 'negotiation', label: 'Negotiation' },
                { value: 'won', label: 'Closed Won' },
                { value: 'lost', label: 'Closed Lost' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Internal Qualification Notes
            </label>
            <textarea
              rows={3}
              className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              placeholder="Notes on client tracking setup, current ad spend, iOS attribution gaps..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              autoComplete="off"
            />
          </div>
        </form>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedLead(null);
        }}
        title={`Edit Lead: ${selectedLead?.companyName}`}
        description="Update prospect contact details, pipeline stage, and expected retainer terms."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedLead(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Company / Brand Name *"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            autoComplete="off"
            required
          />

          <Input
            label="Website URL"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            autoComplete="off"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Person *"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              autoComplete="off"
              required
            />
            <Input
              label="Contact Email *"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              autoComplete="off"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Phone / WhatsApp"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              autoComplete="off"
            />
            <Select
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'BDT' | 'USD' })}
              options={[
                { value: 'BDT', label: 'BDT (৳ - Bangladeshi Taka)' },
                { value: 'USD', label: 'USD ($ - US Dollar)' },
              ]}
            />
          </div>

          <Select
            label="Primary Service Interest"
            value={formData.serviceInterest}
            onChange={(e) => setFormData({ ...formData, serviceInterest: e.target.value })}
            options={SERVICE_OPTIONS}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Estimated Monthly Retainer"
              type="number"
              value={formData.estimatedValue || ''}
              onChange={(e) => setFormData({ ...formData, estimatedValue: Number(e.target.value) || 0 })}
              autoComplete="off"
            />
            <Select
              label="Pipeline Stage"
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value as LeadStage })}
              options={[
                { value: 'new', label: 'New Inquiry' },
                { value: 'audit_scheduled', label: 'Tracking Audit Scheduled' },
                { value: 'proposal_sent', label: 'Proposal Sent' },
                { value: 'negotiation', label: 'Negotiation' },
                { value: 'won', label: 'Closed Won' },
                { value: 'lost', label: 'Closed Lost' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Internal Qualification Notes
            </label>
            <textarea
              rows={3}
              className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              autoComplete="off"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Lead Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedLead(null);
        }}
        title="Delete Lead Record"
        description="Are you sure you want to permanently delete this lead? This action cannot be undone."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedLead(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Permanently Delete Lead'}
            </Button>
          </>
        }
      >
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-xs sm:text-sm text-red-800 dark:text-red-300">
          <p className="font-semibold">
            {selectedLead?.companyName} ({selectedLead?.contactPerson})
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Estimated Value: {selectedLead && formatCurrency(selectedLead.estimatedValue, selectedLead.currency)}/month
          </p>
        </div>
      </Modal>

      {/* Convert to Client Confirmation Modal */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => {
          setIsConvertModalOpen(false);
          setSelectedLead(null);
        }}
        title={`Convert "${selectedLead?.companyName}" to Client`}
        description="This will promote this lead opportunity to an active Client organization with full portal access and project tracking."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsConvertModalOpen(false);
                setSelectedLead(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<UserCheck className="w-4 h-4" />}
              onClick={handleConvertSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Converting...' : 'Convert to Active Client'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs sm:text-sm">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1">
            <div className="font-semibold text-emerald-900 dark:text-emerald-200">
              New Client Profile: {selectedLead?.companyName}
            </div>
            <div className="text-emerald-700 dark:text-emerald-400">
              Primary Contact: {selectedLead?.contactPerson} ({selectedLead?.contactEmail})
            </div>
            <div className="text-emerald-700 dark:text-emerald-400">
              Monthly Retainer: {selectedLead && formatCurrency(selectedLead.estimatedValue, selectedLead.currency)}
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            A new client record will be provisioned in the Clients directory, and this lead will be marked as &quot;Closed Won&quot;.
          </p>
        </div>
      </Modal>
    </div>
  );
}
