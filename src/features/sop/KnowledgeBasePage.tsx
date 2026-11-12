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
  BookOpen,
  Plus,
  Search,
  Code,
  CheckCircle,
  Edit2,
  Trash2,
  ExternalLink,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  subscribeSops,
  createSop,
  updateSop,
  deleteSop,
} from '../../services/sop/sopService';
import { SopGuide, SopCategory, CreateSopInput } from '../../types/sop';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../../utils/formatters';

const CATEGORY_CONFIG: Record<
  SopCategory,
  { label: string; badgeVariant: 'amber' | 'blue' | 'green' | 'neutral' | 'red' }
> = {
  tracking: { label: 'Server-Side Tracking', badgeVariant: 'blue' },
  meta_ads: { label: 'Meta Ads Frameworks', badgeVariant: 'amber' },
  google_ads: { label: 'Google Ads Best Practices', badgeVariant: 'green' },
  ga4: { label: 'GA4 Setup & Events', badgeVariant: 'blue' },
  qa: { label: 'QA Checklists', badgeVariant: 'red' },
};

const CATEGORY_OPTIONS = [
  { value: 'tracking', label: 'Server-Side Tracking (GTM/CAPI)' },
  { value: 'meta_ads', label: 'Meta Ads Frameworks' },
  { value: 'google_ads', label: 'Google Search & PMax' },
  { value: 'ga4', label: 'GA4 E-commerce & Tagging' },
  { value: 'qa', label: 'Attribution QA Checklists' },
];

export function KnowledgeBasePage() {
  const { currentUser, firebaseUser } = useAuth();
  const [sops, setSops] = useState<SopGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSop, setSelectedSop] = useState<SopGuide | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateSopInput>({
    title: '',
    category: 'tracking',
    summary: '',
    content: '',
    steps: [],
    externalDocUrl: '',
    tags: [],
  });
  const [stepsText, setStepsText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Actor
  const actor = useMemo(() => ({
    uid: firebaseUser?.uid || currentUser?.id || 'admin',
    email: firebaseUser?.email || currentUser?.email || 'admin@bouncegrowth.agency',
    name: firebaseUser?.displayName || currentUser?.displayName || 'Admin',
    role: currentUser?.role || 'admin',
  }), [currentUser, firebaseUser]);

  // Subscribe to real-time SOPs
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeSops(
      (data) => {
        setSops(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to subscribe SOPs:', err);
        setError('Failed to load SOPs from Firestore. Please verify permissions.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Unique tags
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    sops.forEach((s) => s.tags?.forEach((t) => t && set.add(t)));
    return Array.from(set);
  }, [sops]);

  // Filtered SOPs
  const filteredSops = useMemo(() => {
    return sops.filter((sop) => {
      const matchesTab = activeTab === 'all' || sop.category === activeTab;
      if (!matchesTab) return false;
      if (selectedTagFilter !== 'all' && !sop.tags?.includes(selectedTagFilter)) return false;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sop.title.toLowerCase().includes(q) ||
        sop.summary.toLowerCase().includes(q) ||
        sop.content.toLowerCase().includes(q) ||
        sop.tags.some((t) => t.toLowerCase().includes(q));

      return matchesSearch;
    });
  }, [sops, activeTab, selectedTagFilter, searchQuery]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: sops.length,
      tracking: sops.filter((s) => s.category === 'tracking').length,
      meta_ads: sops.filter((s) => s.category === 'meta_ads').length,
      google_ads: sops.filter((s) => s.category === 'google_ads').length,
      ga4: sops.filter((s) => s.category === 'ga4').length,
      qa: sops.filter((s) => s.category === 'qa').length,
    };
  }, [sops]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      title: '',
      category: 'tracking',
      summary: '',
      content: '',
      steps: [],
      externalDocUrl: '',
      tags: [],
    });
    setStepsText('');
    setTagsText('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sop: SopGuide) => {
    setSelectedSop(sop);
    setFormData({
      title: sop.title,
      category: sop.category,
      summary: sop.summary,
      content: sop.content,
      steps: sop.steps,
      externalDocUrl: sop.externalDocUrl || '',
      tags: sop.tags,
    });
    setStepsText((sop.steps || []).join('\n'));
    setTagsText((sop.tags || []).join(', '));
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (sop: SopGuide) => {
    setSelectedSop(sop);
    setIsDeleteModalOpen(true);
  };

  // Open Detail Modal
  const handleOpenDetailModal = (sop: SopGuide) => {
    setSelectedSop(sop);
    setIsDetailModalOpen(true);
  };

  // Submit Create SOP
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.summary.trim()) {
      setError('Title and Summary are required.');
      return;
    }

    const steps = stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      setIsSubmitting(true);
      setError(null);
      await createSop(
        {
          ...formData,
          steps,
          tags,
        },
        actor
      );
      setIsAddModalOpen(false);
      setSuccessMessage(`SOP guide "${formData.title}" saved successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error creating SOP:', err);
      setError(err.message || 'Failed to save SOP guide.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit SOP
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSop) return;
    if (!formData.title.trim() || !formData.summary.trim()) {
      setError('Title and Summary are required.');
      return;
    }

    const steps = stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      setIsSubmitting(true);
      setError(null);
      await updateSop(
        selectedSop.id,
        {
          ...formData,
          steps,
          tags,
        },
        actor
      );
      setIsEditModalOpen(false);
      setSelectedSop(null);
      setSuccessMessage(`SOP guide "${formData.title}" updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error updating SOP:', err);
      setError(err.message || 'Failed to update SOP guide.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Delete SOP
  const handleDeleteSubmit = async () => {
    if (!selectedSop) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await deleteSop(selectedSop.id, selectedSop.title, actor);
      setIsDeleteModalOpen(false);
      setSelectedSop(null);
      setSuccessMessage('SOP guide deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error deleting SOP:', err);
      setError(err.message || 'Failed to delete SOP guide.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            onClick={handleOpenAddModal}
          >
            New SOP Guide
          </Button>
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

      {/* Tabs & Search */}
      <div className="space-y-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All SOPs', count: counts.all },
            { id: 'tracking', label: 'Server-Side Tracking', count: counts.tracking },
            { id: 'meta_ads', label: 'Meta Ads', count: counts.meta_ads },
            { id: 'google_ads', label: 'Google Ads', count: counts.google_ads },
            { id: 'ga4', label: 'GA4 & Funnels', count: counts.ga4 },
            { id: 'qa', label: 'QA Checklists', count: counts.qa },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search SOPs by title, tag, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <Trash2 className="w-3 h-3 hidden" />
                <span className="text-xs font-bold">×</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {availableTags.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Tag:</span>
                <select
                  value={selectedTagFilter}
                  onChange={(e) => setSelectedTagFilter(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Tags</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      #{tag}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(searchQuery.trim() || selectedTagFilter !== 'all' || activeTab !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTagFilter('all');
                  setActiveTab('all');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SOP Content Grid */}
      {loading ? (
        <LoadingState message="Loading technical SOP repository..." />
      ) : filteredSops.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="w-6 h-6 text-slate-400" />}
            title={sops.length === 0 ? "No SOPs found in this category" : "No SOPs match the selected filters"}
            description={
              sops.length === 0
                ? "Document operational runbooks to ensure tracking consistency and standardize onboarding."
                : "Try resetting your search query or tag filter to view other runbooks."
            }
            actionLabel={sops.length === 0 ? "Create First SOP" : "Reset Filters"}
            onAction={
              sops.length === 0
                ? handleOpenAddModal
                : () => {
                    setSearchQuery('');
                    setSelectedTagFilter('all');
                    setActiveTab('all');
                  }
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSops.map((sop) => {
            const cfg = CATEGORY_CONFIG[sop.category];
            return (
              <div
                key={sop.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant={cfg.badgeVariant} size="sm">
                      {cfg.label}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(sop)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        title="Edit SOP"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteModal(sop)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete SOP"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-2 line-clamp-1">
                    {sop.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                    {sop.summary}
                  </p>

                  {sop.steps && sop.steps.length > 0 && (
                    <div className="mt-3 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-500" /> Key Execution Steps ({sop.steps.length})
                      </div>
                      <p className="line-clamp-1">{sop.steps[0]}</p>
                    </div>
                  )}

                  {sop.tags && sop.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {sop.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Updated {formatDate(sop.updatedAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    {sop.externalDocUrl && (
                      <a
                        href={sop.externalDocUrl.startsWith('http') ? sop.externalDocUrl : `https://${sop.externalDocUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                      >
                        Doc <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetailModal(sop)}
                    >
                      Read Guide
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add SOP Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Standard Operating Procedure"
        description="Document step-by-step agency workflows, tracking architectures, and technical setups."
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
              {isSubmitting ? 'Saving...' : 'Save SOP'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="SOP Title *"
            placeholder="e.g. Stape.io & Meta CAPI Setup via Server GTM"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            autoComplete="off"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="SOP Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as SopCategory })}
              options={CATEGORY_OPTIONS}
            />
            <Input
              label="External Reference Link (Google Doc / Notion)"
              placeholder="https://docs.google.com/..."
              value={formData.externalDocUrl}
              onChange={(e) => setFormData({ ...formData, externalDocUrl: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Executive Summary *
            </label>
            <textarea
              rows={2}
              className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              placeholder="High-level summary of the implementation and when to use it..."
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              autoComplete="off"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Step-by-Step Execution Runbook (One step per line)
            </label>
            <textarea
              rows={4}
              className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
              placeholder="Step 1: Configure Custom Domain Loader in Stape.io&#10;Step 2: Add Web GTM Client to Server Container&#10;Step 3: Map event_id across browser and server payloads"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Full Technical Guide / Documentation Notes
            </label>
            <textarea
              rows={5}
              className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              placeholder="Detailed guide content, code snippets, troubleshooting tips..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              autoComplete="off"
            />
          </div>

          <Input
            label="Tags (Comma-separated)"
            placeholder="capi, server-side, gtm, stape, ga4"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            autoComplete="off"
          />
        </form>
      </Modal>

      {/* Edit SOP Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedSop(null);
        }}
        title={`Edit SOP: ${selectedSop?.title}`}
        description="Update standard operating procedure documentation and checklist steps."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedSop(null);
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
            label="SOP Title *"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            autoComplete="off"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="SOP Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as SopCategory })}
              options={CATEGORY_OPTIONS}
            />
            <Input
              label="External Reference Link"
              value={formData.externalDocUrl}
              onChange={(e) => setFormData({ ...formData, externalDocUrl: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Executive Summary *
            </label>
            <textarea
              rows={2}
              className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              autoComplete="off"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Step-by-Step Execution Runbook (One step per line)
            </label>
            <textarea
              rows={4}
              className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Full Technical Guide / Documentation Notes
            </label>
            <textarea
              rows={5}
              className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              autoComplete="off"
            />
          </div>

          <Input
            label="Tags (Comma-separated)"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            autoComplete="off"
          />
        </form>
      </Modal>

      {/* Delete SOP Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedSop(null);
        }}
        title="Delete SOP Guide"
        description="Are you sure you want to permanently delete this SOP guide? This action cannot be undone."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedSop(null);
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
              {isSubmitting ? 'Deleting...' : 'Permanently Delete SOP'}
            </Button>
          </>
        }
      >
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-xs sm:text-sm text-red-800 dark:text-red-300">
          <p className="font-semibold">{selectedSop?.title}</p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{selectedSop?.summary}</p>
        </div>
      </Modal>

      {/* Read SOP Detail Modal */}
      {selectedSop && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedSop(null);
          }}
          title={selectedSop.title}
          description={`Category: ${CATEGORY_CONFIG[selectedSop.category].label}`}
          footer={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsDetailModalOpen(false);
                setSelectedSop(null);
              }}
            >
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Summary</h4>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{selectedSop.summary}</p>
            </div>

            {selectedSop.steps && selectedSop.steps.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Execution Checklist
                </h4>
                <div className="space-y-2">
                  {selectedSop.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2"
                    >
                      <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 leading-tight pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedSop.content && (
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Technical Documentation</h4>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans text-xs">
                  {selectedSop.content}
                </div>
              </div>
            )}

            {selectedSop.externalDocUrl && (
              <div className="pt-2">
                <a
                  href={selectedSop.externalDocUrl.startsWith('http') ? selectedSop.externalDocUrl : `https://${selectedSop.externalDocUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  <ExternalLink className="w-4 h-4" /> Open Full External Resource
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
