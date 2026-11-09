import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  FileEdit,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Tag,
  Briefcase,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  CalendarDays,
  X,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuth } from '../auth/AuthContext';
import {
  ContentItem,
  ContentStatus,
  ContentPlatform,
  CreateContentItemInput,
  UpdateContentItemInput,
} from '../../types/content';
import {
  subscribeContentItems,
  createContentItem,
  updateContentItem,
  updateContentItemStatus,
  deleteContentItem,
} from '../../services/marketing/contentCalendarService';
import { subscribeClients } from '../../services/clients/clientService';
import { ClientProfile } from '../../types/client';

// Stage configuration for Kanban
const PIPELINE_STAGES: {
  id: ContentStatus;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  headerBg: string;
  badgeBg: string;
  description: string;
}[] = [
  {
    id: 'idea',
    title: 'Ideas & Backlog',
    icon: Sparkles,
    headerBg: 'bg-slate-100 text-slate-800 border-slate-200',
    badgeBg: 'bg-slate-200 text-slate-700',
    description: 'Ad angles, video hooks & promo themes',
  },
  {
    id: 'in_creative',
    title: 'In Creative / Copy',
    icon: FileEdit,
    headerBg: 'bg-amber-50 text-amber-900 border-amber-200',
    badgeBg: 'bg-amber-200 text-amber-800',
    description: 'Scripting, graphic design & video editing',
  },
  {
    id: 'client_review',
    title: 'Client Review',
    icon: Eye,
    headerBg: 'bg-purple-50 text-purple-900 border-purple-200',
    badgeBg: 'bg-purple-200 text-purple-800',
    description: 'Awaiting client approval & compliance checks',
  },
  {
    id: 'scheduled',
    title: 'Scheduled Drops',
    icon: Clock,
    headerBg: 'bg-blue-50 text-blue-900 border-blue-200',
    badgeBg: 'bg-blue-200 text-blue-800',
    description: 'Queued in Ads Manager or meta business suite',
  },
  {
    id: 'published',
    title: 'Published / Live',
    icon: CheckCircle2,
    headerBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    badgeBg: 'bg-emerald-200 text-emerald-800',
    description: 'Live campaigns & tracked conversion drops',
  },
];

// Platform badge metadata
const PLATFORM_CONFIG: Record<
  ContentPlatform,
  { name: string; color: string; badgeClass: string }
> = {
  meta: {
    name: 'Meta Ads',
    color: '#1877F2',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  google: {
    name: 'Google Ads',
    color: '#EA4335',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
  tiktok: {
    name: 'TikTok',
    color: '#000000',
    badgeClass: 'bg-zinc-900 text-cyan-300 border-zinc-700',
  },
  linkedin: {
    name: 'LinkedIn',
    color: '#0A66C2',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  youtube: {
    name: 'YouTube',
    color: '#FF0000',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  x: {
    name: 'X (Twitter)',
    color: '#000000',
    badgeClass: 'bg-slate-900 text-slate-100 border-slate-700',
  },
  pinterest: {
    name: 'Pinterest',
    color: '#E60023',
    badgeClass: 'bg-pink-100 text-pink-800 border-pink-200',
  },
  other: {
    name: 'Other',
    color: '#64748B',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

export function ContentCalendarPage() {
  const {
    currentUser,
    currentRole,
    firebaseUser,
    isLiveAuth,
    isLoading: isAuthLoading,
    signInWithGoogle,
  } = useAuth();

  // Firestore Real-time state
  const [items, setItems] = useState<ContentItem[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // View & Filter states
  const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<ContentPlatform | 'all'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  // Target stage for quick add modal button on column headers
  const [targetInitialStatus, setTargetInitialStatus] = useState<ContentStatus>('idea');

  // Feedback notifications
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});

  // Subscriptions
  useEffect(() => {
    // Wait until auth state finishes initializing
    if (isAuthLoading) {
      return;
    }

    if (!firebaseUser && !isLiveAuth) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubItems = subscribeContentItems(
      (data) => {
        setItems(data);
        setLoading(false);
        setAlertError(null);
      },
      (err) => {
        console.error('Failed to subscribe content calendar:', err);
        setAlertError(err.message || 'Unable to load content items from Firestore');
        setLoading(false);
      }
    );

    const unsubClients = subscribeClients(
      (data) => setClients(data),
      (err) => console.warn('Clients subscription warning:', err),
      { actorRole: currentRole || 'team', actorUid: currentUser?.id }
    );

    return () => {
      unsubItems();
      unsubClients();
    };
  }, [currentRole, currentUser, firebaseUser, isLiveAuth, isAuthLoading]);

  // Dismiss feedback automatically
  useEffect(() => {
    if (alertSuccess) {
      const timer = setTimeout(() => setAlertSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alertSuccess]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Platform filter
      if (platformFilter !== 'all' && !item.platforms.includes(platformFilter)) {
        return false;
      }
      // Client filter
      if (clientFilter !== 'all' && item.clientId !== clientFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesCaption = item.caption.toLowerCase().includes(query);
        const matchesClient = item.clientName?.toLowerCase().includes(query);
        const matchesTags = item.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesCaption && !matchesClient && !matchesTags) {
          return false;
        }
      }
      return true;
    });
  }, [items, platformFilter, clientFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const idea = items.filter((i) => i.status === 'idea').length;
    const inCreative = items.filter((i) => i.status === 'in_creative').length;
    const inReview = items.filter((i) => i.status === 'client_review').length;
    const scheduled = items.filter((i) => i.status === 'scheduled').length;
    const published = items.filter((i) => i.status === 'published').length;
    return { total, idea, inCreative, inReview, scheduled, published };
  }, [items]);

  // Stage advance helper
  const handleMoveStage = async (item: ContentItem, direction: 'prev' | 'next') => {
    const stagesOrder: ContentStatus[] = ['idea', 'in_creative', 'client_review', 'scheduled', 'published'];
    const currentIndex = stagesOrder.indexOf(item.status);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < stagesOrder.length) {
      const nextStatus = stagesOrder[newIndex];
      try {
        await updateContentItemStatus(item.id, nextStatus, {
          uid: currentUser?.id || 'admin',
          email: currentUser?.email || 'admin@bouncegrowth.agency',
          name: currentUser?.displayName || 'Agency Specialist',
          role: currentRole || 'admin',
        });
        setAlertSuccess(`Moved "${item.title}" to ${PIPELINE_STAGES.find((s) => s.id === nextStatus)?.title}`);
      } catch (err: unknown) {
        console.error('Error changing stage:', err);
        setAlertError(err instanceof Error ? err.message : 'Failed to update stage');
      }
    }
  };

  // Direct status update
  const handleDirectStatusChange = async (item: ContentItem, nextStatus: ContentStatus) => {
    try {
      await updateContentItemStatus(item.id, nextStatus, {
        uid: currentUser?.id || 'admin',
        email: currentUser?.email || 'admin@bouncegrowth.agency',
        name: currentUser?.displayName || 'Agency Specialist',
        role: currentRole || 'admin',
      });
      setAlertSuccess(`Updated status to ${PIPELINE_STAGES.find((s) => s.id === nextStatus)?.title}`);
    } catch (err: unknown) {
      console.error('Error updating status:', err);
      setAlertError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Copy caption to clipboard
  const handleCopyCaption = (item: ContentItem) => {
    navigator.clipboard.writeText(item.caption);
    setCopiedItemId(item.id);
    setTimeout(() => setCopiedItemId(null), 2500);
  };

  const toggleCaptionExpand = (id: string) => {
    setExpandedCaptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!selectedItem) return;
    try {
      await deleteContentItem(selectedItem.id, selectedItem.title, {
        uid: currentUser?.id || 'admin',
        email: currentUser?.email || 'admin@bouncegrowth.agency',
        role: currentRole || 'admin',
      });
      setAlertSuccess(`Content item "${selectedItem.title}" deleted.`);
      setIsDeleteModalOpen(false);
      setSelectedItem(null);
    } catch (err: unknown) {
      console.error('Delete error:', err);
      setAlertError(err instanceof Error ? err.message : 'Failed to delete content item');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title="Marketing & Ad Content Calendar"
        description="Plan ad angles, copywriting variations, creative sprints, and scheduled drops across Meta, Google, TikTok, LinkedIn, and YouTube."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Timeline
              </button>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setTargetInitialStatus('idea');
                setIsCreateModalOpen(true);
              }}
            >
              Add Content Drop
            </Button>
          </div>
        }
      />

      {/* Notifications */}
      {alertSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{alertSuccess}</span>
          </div>
          <button
            onClick={() => setAlertSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isLiveAuth && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">
              Google Sign-In Required: Sign in with your agency account to sync marketing content items live with Cloud Firestore.
            </span>
          </div>
          <button
            onClick={() => signInWithGoogle()}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shrink-0 cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      )}

      {alertError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{alertError}</span>
          </div>
          <button
            onClick={() => setAlertError(null)}
            className="text-rose-600 hover:text-rose-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Total Items</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{metrics.total}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Ideas</p>
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{metrics.idea}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-700">In Creative</p>
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          </div>
          <p className="text-xl font-bold text-amber-800 mt-0.5">{metrics.inCreative}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-purple-700">Review</p>
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          </div>
          <p className="text-xl font-bold text-purple-900 mt-0.5">{metrics.inReview}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-blue-700">Scheduled</p>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <p className="text-xl font-bold text-blue-900 mt-0.5">{metrics.scheduled}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-700">Published</p>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-xl font-bold text-emerald-900 mt-0.5">{metrics.published}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search content angles, captions, tags, or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Client Filter */}
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Clients & Agency Brands</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Platform Pills Filter */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Platform:
          </span>
          <button
            type="button"
            onClick={() => setPlatformFilter('all')}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
              platformFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Platforms
          </button>
          {(Object.keys(PLATFORM_CONFIG) as ContentPlatform[]).map((platformKey) => {
            const config = PLATFORM_CONFIG[platformKey];
            const isSelected = platformFilter === platformKey;
            return (
              <button
                key={platformKey}
                type="button"
                onClick={() => setPlatformFilter(platformKey)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${
                  isSelected
                    ? `${config.badgeClass} ring-2 ring-offset-1 ring-blue-500 font-semibold shadow-xs`
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {config.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="py-16 bg-white rounded-xl border border-slate-200">
          <LoadingState message="Loading campaign content items from Firestore..." />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No Content Items Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery || platformFilter !== 'all' || clientFilter !== 'all'
                ? 'No content drops matched your current filter criteria. Try clearing filters.'
                : 'Get started by creating your first ad idea or campaign launch schedule.'}
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setTargetInitialStatus('idea');
                setIsCreateModalOpen(true);
              }}
            >
              Add First Content Idea
            </Button>
          </div>
        </Card>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {PIPELINE_STAGES.map((stage) => {
            const stageItems = filteredItems.filter((i) => i.status === stage.id);
            const StageIcon = stage.icon;

            return (
              <div
                key={stage.id}
                className="bg-slate-50/80 rounded-xl border border-slate-200/90 flex flex-col min-h-[580px] shadow-xs"
              >
                {/* Column Header */}
                <div className={`p-3 rounded-t-xl border-b ${stage.headerBg} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <StageIcon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">{stage.title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${stage.badgeBg}`}>
                      {stageItems.length}
                    </span>
                    <button
                      type="button"
                      title={`Add item to ${stage.title}`}
                      onClick={() => {
                        setTargetInitialStatus(stage.id);
                        setIsCreateModalOpen(true);
                      }}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-black/5 rounded transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtitle */}
                <div className="px-3 py-1.5 bg-white/40 border-b border-slate-100 text-[11px] text-slate-500 italic truncate">
                  {stage.description}
                </div>

                {/* Cards Container */}
                <div className="p-2.5 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
                  {stageItems.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      No cards in this stage
                    </div>
                  ) : (
                    stageItems.map((item) => (
                      <ContentCard
                        key={item.id}
                        item={item}
                        onEdit={(it) => {
                          setSelectedItem(it);
                          setIsEditModalOpen(true);
                        }}
                        onDelete={(it) => {
                          setSelectedItem(it);
                          setIsDeleteModalOpen(true);
                        }}
                        onMoveStage={handleMoveStage}
                        onDirectStatusChange={handleDirectStatusChange}
                        onCopyCaption={handleCopyCaption}
                        isCopied={copiedItemId === item.id}
                        isCaptionExpanded={!!expandedCaptions[item.id]}
                        onToggleExpand={() => toggleCaptionExpand(item.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TIMELINE / CALENDAR AGENDA VIEW */
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Campaign Launch Schedule Agenda"
              subtitle={`Showing ${filteredItems.length} planned drops ordered chronologically`}
            />
            <div className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const stage = PIPELINE_STAGES.find((s) => s.id === item.status);
                const publishDateObj = new Date(item.publishDate);
                const isPast = publishDateObj.getTime() < Date.now();

                return (
                  <div
                    key={item.id}
                    className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status Badge */}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${stage?.headerBg}`}
                        >
                          {stage?.title}
                        </span>

                        {/* Platform Pills */}
                        {item.platforms.map((p) => (
                          <span
                            key={p}
                            className={`text-xs px-2 py-0.5 rounded-md font-medium border ${PLATFORM_CONFIG[p]?.badgeClass}`}
                          >
                            {PLATFORM_CONFIG[p]?.name}
                          </span>
                        ))}

                        {/* Client name */}
                        {item.clientName && (
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-slate-400" />
                            {item.clientName}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>

                      <p className="text-xs text-slate-600 line-clamp-2">{item.caption}</p>

                      {item.notes && (
                        <p className="text-[11px] text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded border border-amber-100 font-mono">
                          Notes: {item.notes}
                        </p>
                      )}
                    </div>

                    {/* Right column: Date and Actions */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 justify-end">
                          <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                          {publishDateObj.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {publishDateObj.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          {isPast ? '(Passed)' : '(Upcoming)'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyCaption(item)}
                          title="Copy ad copy to clipboard"
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          {copiedItemId === item.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* CREATE MODAL */}
      <CreateContentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        initialStatus={targetInitialStatus}
        clients={clients}
        onSuccess={(created) => {
          setAlertSuccess(`Created content item "${created.title}" successfully.`);
          setIsCreateModalOpen(false);
        }}
      />

      {/* EDIT MODAL */}
      {selectedItem && (
        <EditContentModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
          clients={clients}
          onSuccess={() => {
            setAlertSuccess(`Updated content item "${selectedItem.title}".`);
            setIsEditModalOpen(false);
            setSelectedItem(null);
          }}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedItem(null);
        }}
        title="Delete Content Item"
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedItem(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteConfirm}>
              Permanently Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-2 text-sm text-slate-600">
          <p>
            Are you sure you want to delete this content item? This action will remove it from the
            calendar and Firestore permanently.
          </p>
          {selectedItem && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <span className="font-semibold text-rose-900 block">{selectedItem.title}</span>
              <span className="text-xs text-rose-700 mt-1 block">
                Scheduled for {new Date(selectedItem.publishDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single Content Card inside Kanban
// ---------------------------------------------------------------------------
interface ContentCardProps {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
  onMoveStage: (item: ContentItem, direction: 'prev' | 'next') => void;
  onDirectStatusChange: (item: ContentItem, status: ContentStatus) => void;
  onCopyCaption: (item: ContentItem) => void;
  isCopied: boolean;
  isCaptionExpanded: boolean;
  onToggleExpand: () => void;
}

function ContentCard({
  item,
  onEdit,
  onDelete,
  onMoveStage,
  onDirectStatusChange,
  onCopyCaption,
  isCopied,
  isCaptionExpanded,
  onToggleExpand,
}: ContentCardProps) {
  const publishDateObj = new Date(item.publishDate);
  const now = new Date();
  const diffHours = (publishDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Friendly date label
  let dateLabel = publishDateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  if (Math.abs(diffHours) < 24) {
    if (diffHours > 0) dateLabel = 'Today';
    else dateLabel = 'Yesterday';
  }

  const stagesOrder: ContentStatus[] = ['idea', 'in_creative', 'client_review', 'scheduled', 'published'];
  const currentIndex = stagesOrder.indexOf(item.status);
  const canMovePrev = currentIndex > 0;
  const canMoveNext = currentIndex < stagesOrder.length - 1;

  return (
    <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between">
      <div className="space-y-2.5">
        {/* Top bar: Client Name & Platforms */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {item.platforms.map((p) => {
              const cfg = PLATFORM_CONFIG[p];
              return (
                <span
                  key={p}
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                    cfg?.badgeClass || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {p}
                </span>
              );
            })}
          </div>

          {/* Card action buttons */}
          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onEdit(item)}
              title="Edit Content Drop"
              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              <FileEdit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              title="Delete"
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Client Tag if present */}
        {item.clientName && (
          <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1 truncate">
            <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{item.clientName}</span>
          </div>
        )}

        {/* Title */}
        <h4 className="text-xs font-bold text-slate-900 leading-snug hover:text-blue-600 cursor-pointer" onClick={() => onEdit(item)}>
          {item.title}
        </h4>

        {/* Caption Snippet with Copy Option */}
        {item.caption && (
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] text-slate-700 relative">
            <p className={isCaptionExpanded ? 'whitespace-pre-line' : 'line-clamp-2'}>
              {item.caption}
            </p>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/60">
              <button
                type="button"
                onClick={onToggleExpand}
                className="text-[10px] text-blue-600 font-semibold hover:underline"
              >
                {isCaptionExpanded ? 'Show less' : 'Read more'}
              </button>
              <button
                type="button"
                onClick={() => onCopyCaption(item)}
                title="Copy caption"
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-900 font-medium"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer: Date & Stage Navigation */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <CalendarIcon className="w-3 h-3 text-slate-400" />
          <span>{dateLabel}</span>
        </div>

        {/* Quick Stage Transitions */}
        <div className="flex items-center gap-1">
          {canMovePrev && (
            <button
              type="button"
              onClick={() => onMoveStage(item, 'prev')}
              title={`Move back to ${stagesOrder[currentIndex - 1]}`}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick status dropdown */}
          <select
            value={item.status}
            onChange={(e) => onDirectStatusChange(item, e.target.value as ContentStatus)}
            className="text-[10px] font-semibold bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 focus:outline-none"
          >
            <option value="idea">Idea</option>
            <option value="in_creative">Creative</option>
            <option value="client_review">Review</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>

          {canMoveNext && (
            <button
              type="button"
              onClick={() => onMoveStage(item, 'next')}
              title={`Advance to ${stagesOrder[currentIndex + 1]}`}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors font-bold"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Content Item Modal
// ---------------------------------------------------------------------------
interface CreateContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStatus: ContentStatus;
  clients: ClientProfile[];
  onSuccess: (item: ContentItem) => void;
}

function CreateContentModal({
  isOpen,
  onClose,
  initialStatus,
  clients,
  onSuccess,
}: CreateContentModalProps) {
  const { currentUser, currentRole } = useAuth();

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<ContentPlatform[]>(['meta']);
  const [publishDate, setPublishDate] = useState(() => {
    // Default to tomorrow at 10:00 AM local time
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [status, setStatus] = useState<ContentStatus>(initialStatus);
  const [clientId, setClientId] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync initial status when opened
  useEffect(() => {
    if (isOpen) {
      setStatus(initialStatus);
      setFormError(null);
    }
  }, [isOpen, initialStatus]);

  const togglePlatform = (p: ContentPlatform) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length === 1) return; // Keep at least one
      setSelectedPlatforms(selectedPlatforms.filter((item) => item !== p));
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const handleQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(10, 0, 0, 0);
    setPublishDate(d.toISOString().slice(0, 16));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a content angle or title.');
      return;
    }
    if (!publishDate) {
      setFormError('Please choose a target publication date.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const selectedClient = clients.find((c) => c.id === clientId);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0);

      const newItem = await createContentItem(
        {
          title: title.trim(),
          caption: caption.trim(),
          platforms: selectedPlatforms,
          publishDate: new Date(publishDate).toISOString(),
          status,
          clientId: clientId || undefined,
          clientName: selectedClient?.businessName || (clientId === 'internal' ? 'Internal Agency' : undefined),
          notes: notes.trim() || undefined,
          tags,
        },
        {
          uid: currentUser?.id || 'admin',
          email: currentUser?.email || 'admin@bouncegrowth.agency',
          name: currentUser?.displayName || 'Agency Specialist',
          role: currentRole || 'admin',
        }
      );

      // Reset
      setTitle('');
      setCaption('');
      setNotes('');
      setTagsInput('');
      setClientId('');
      onSuccess(newItem);
    } catch (err: unknown) {
      console.error('Failed to create content item:', err);
      setFormError(err instanceof Error ? err.message : 'Error creating content item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Content Angle / Ad Drop"
      description="Add a new creative idea, ad copy variation, or schedule a multi-channel campaign release."
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            icon={<Plus className="w-4 h-4" />}
          >
            {submitting ? 'Saving to Firestore...' : 'Create Content Drop'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2 text-sm text-slate-800">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Content Title / Angle Hook <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Meta Conversions API vs Pixel Hook Reel, Black Friday Copy Set A"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Platform Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Target Platforms <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {(Object.keys(PLATFORM_CONFIG) as ContentPlatform[]).map((platformKey) => {
              const cfg = PLATFORM_CONFIG[platformKey];
              const isSelected = selectedPlatforms.includes(platformKey);
              return (
                <button
                  key={platformKey}
                  type="button"
                  onClick={() => togglePlatform(platformKey)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                    isSelected
                      ? `${cfg.badgeClass} ring-2 ring-blue-500 shadow-xs font-bold`
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isSelected && '✓ '}
                  {cfg.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Captions / Ad Copy */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Captions & Ad Copy
            </label>
            <span className="text-[11px] text-slate-400 font-mono">{caption.length} characters</span>
          </div>
          <textarea
            rows={4}
            placeholder="Write your high-converting copy, hook variations, primary text, bullet points, CTA, and hashtags..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
          />
        </div>

        {/* Grid: Dates & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Target Publish Date & Time <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
            />
            {/* Quick date presets */}
            <div className="flex gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => handleQuickDate(1)}
                className="text-[11px] text-blue-600 hover:underline font-medium"
              >
                +Tomorrow
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => handleQuickDate(3)}
                className="text-[11px] text-blue-600 hover:underline font-medium"
              >
                +3 Days
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => handleQuickDate(7)}
                className="text-[11px] text-blue-600 hover:underline font-medium"
              >
                +1 Week
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Workflow Stage
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="idea">💡 Idea & Backlog</option>
              <option value="in_creative">🎨 In Creative / Copy</option>
              <option value="client_review">👁️ Client Ad Review</option>
              <option value="scheduled">⏰ Scheduled Drop</option>
              <option value="published">🚀 Published / Live</option>
            </select>
          </div>
        </div>

        {/* Client & Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Client / Account Association
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None (General Agency Drop)</option>
              <option value="internal">Bounce Growth Agency Internal</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Hashtags / Tags (Comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. MetaAds, Reels, TrackingFix, B2B"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Notes & Asset Links */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Internal Production Notes / Asset Links (Figma / Drive)
          </label>
          <input
            type="text"
            placeholder="e.g. Drive folder link, video editor instructions, client revision feedback"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit Content Item Modal
// ---------------------------------------------------------------------------
interface EditContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ContentItem;
  clients: ClientProfile[];
  onSuccess: () => void;
}

function EditContentModal({
  isOpen,
  onClose,
  item,
  clients,
  onSuccess,
}: EditContentModalProps) {
  const { currentUser, currentRole } = useAuth();

  const [title, setTitle] = useState(item.title);
  const [caption, setCaption] = useState(item.caption);
  const [selectedPlatforms, setSelectedPlatforms] = useState<ContentPlatform[]>(item.platforms);
  const [publishDate, setPublishDate] = useState(() => {
    try {
      return new Date(item.publishDate).toISOString().slice(0, 16);
    } catch {
      return new Date().toISOString().slice(0, 16);
    }
  });
  const [status, setStatus] = useState<ContentStatus>(item.status);
  const [clientId, setClientId] = useState(item.clientId || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [tagsInput, setTagsInput] = useState(item.tags?.join(', ') || '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const togglePlatform = (p: ContentPlatform) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length === 1) return;
      setSelectedPlatforms(selectedPlatforms.filter((itemKey) => itemKey !== p));
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a content title.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const selectedClient = clients.find((c) => c.id === clientId);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0);

      const updates: UpdateContentItemInput = {
        title: title.trim(),
        caption: caption.trim(),
        platforms: selectedPlatforms,
        publishDate: new Date(publishDate).toISOString(),
        status,
        clientId: clientId || undefined,
        clientName: selectedClient?.businessName || (clientId === 'internal' ? 'Internal Agency' : undefined),
        notes: notes.trim() || undefined,
        tags,
      };

      await updateContentItem(item.id, updates, {
        uid: currentUser?.id || 'admin',
        email: currentUser?.email || 'admin@bouncegrowth.agency',
        name: currentUser?.displayName || 'Agency Specialist',
        role: currentRole || 'admin',
      });

      onSuccess();
    } catch (err: unknown) {
      console.error('Failed to update content item:', err);
      setFormError(err instanceof Error ? err.message : 'Error updating content item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Content Angle / Drop"
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            icon={<Check className="w-4 h-4" />}
          >
            {submitting ? 'Saving Changes...' : 'Save Updates'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2 text-sm text-slate-800">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Content Title / Angle Hook <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Target Platforms <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {(Object.keys(PLATFORM_CONFIG) as ContentPlatform[]).map((platformKey) => {
              const cfg = PLATFORM_CONFIG[platformKey];
              const isSelected = selectedPlatforms.includes(platformKey);
              return (
                <button
                  key={platformKey}
                  type="button"
                  onClick={() => togglePlatform(platformKey)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                    isSelected
                      ? `${cfg.badgeClass} ring-2 ring-blue-500 shadow-xs font-bold`
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isSelected && '✓ '}
                  {cfg.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Captions & Ad Copy
            </label>
            <span className="text-[11px] text-slate-400 font-mono">{caption.length} characters</span>
          </div>
          <textarea
            rows={5}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Publish Date & Time <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Workflow Stage
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="idea">💡 Idea & Backlog</option>
              <option value="in_creative">🎨 In Creative / Copy</option>
              <option value="client_review">👁️ Client Ad Review</option>
              <option value="scheduled">⏰ Scheduled Drop</option>
              <option value="published">🚀 Published / Live</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Client / Account Association
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None (General Agency Drop)</option>
              <option value="internal">Bounce Growth Agency Internal</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Hashtags / Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Internal Production Notes / Links
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
}
