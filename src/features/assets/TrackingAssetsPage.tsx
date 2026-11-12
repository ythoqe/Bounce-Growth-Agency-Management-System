import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Table, Column } from '../../components/common/Table';
import {
  Activity,
  Plus,
  Search,
  Server,
  ExternalLink,
  Edit,
  Archive,
  RotateCcw,
  Copy,
  Check,
  Shield,
  Eye,
  EyeOff,
  Info,
  Trash2,
  Filter,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { TrackingAsset, TrackingAssetType } from '../../types/asset';
import { ClientProfile } from '../../types/client';
import { Project } from '../../types/project';
import {
  subscribeAssets,
  createTrackingAsset,
  updateTrackingAsset,
  deleteTrackingAsset,
  archiveTrackingAsset,
  restoreTrackingAsset,
} from '../../services/assets/assetService';
import { subscribeClients } from '../../services/clients/clientService';
import { subscribeProjects } from '../../services/projects/projectService';
import { formatDate } from '../../utils/formatters';

const ASSET_TYPES: { value: TrackingAssetType; label: string; placeholder: string }[] = [
  { value: 'ga4', label: 'Google Analytics 4 (GA4)', placeholder: 'G-XXXXXXXXXX' },
  { value: 'gtm_web', label: 'Google Tag Manager (Web)', placeholder: 'GTM-XXXXXXX' },
  { value: 'gtm_server', label: 'Server-Side GTM (sGTM)', placeholder: 'GTM-XXXXXXX' },
  { value: 'meta_pixel', label: 'Meta Pixel', placeholder: '123456789012345' },
  { value: 'meta_capi', label: 'Meta Conversions API (CAPI)', placeholder: 'Pixel ID & Dataset ID' },
  { value: 'google_ads', label: 'Google Ads Conversion Tracking', placeholder: 'AW-XXXXXXXXX / Conversion Label' },
  { value: 'tiktok_pixel', label: 'TikTok Pixel', placeholder: 'CXXXXXXXXXXXXXXX' },
  { value: 'tiktok_events_api', label: 'TikTok Events API', placeholder: 'Pixel Code & Event ID' },
  { value: 'stape', label: 'Stape Cloud Server Tagging', placeholder: 'https://ssgtm.client.com' },
  { value: 'looker_studio', label: 'Looker Studio Executive Report', placeholder: 'Looker Studio Report URL' },
];

export function TrackingAssetsPage() {
  const { currentUser, isLiveAuth, firebaseUser, signInWithGoogle } = useAuth();
  const actor = {
    uid: currentUser?.id || 'usr_admin_bounce',
    email: currentUser?.email || 'founder@bouncegrowth.com',
    role: currentUser?.role || 'admin',
  };

  const [assets, setAssets] = useState<TrackingAsset[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  const [selectedAssetTypeFilter, setSelectedAssetTypeFilter] = useState<string>('all');
  const [selectedAccessLevelFilter, setSelectedAccessLevelFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<TrackingAsset | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Form State
  const [formClientId, setFormClientId] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formAssetType, setFormAssetType] = useState<TrackingAssetType>('meta_capi');
  const [formName, setFormName] = useState('');
  const [formMeasurementId, setFormMeasurementId] = useState('');
  const [formContainerId, setFormContainerId] = useState('');
  const [formPixelId, setFormPixelId] = useState('');
  const [formServerUrl, setFormServerUrl] = useState('');
  const [formDashboardUrl, setFormDashboardUrl] = useState('');
  const [formAccessLevel, setFormAccessLevel] = useState<'admin_only' | 'shared_with_client'>('shared_with_client');
  const [formStatus, setFormStatus] = useState<'active' | 'in_configuration' | 'verifying' | 'archived'>('active');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Asset State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<TrackingAsset | null>(null);
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);

  const handleDeleteAssetConfirm = async () => {
    if (!assetToDelete) return;
    try {
      setIsDeletingAsset(true);
      await deleteTrackingAsset(assetToDelete.id, assetToDelete.name, actor);
      setIsDeleteModalOpen(false);
      setAssetToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete asset');
    } finally {
      setIsDeletingAsset(false);
    }
  };

  useEffect(() => {
    if (!isLiveAuth || !firebaseUser) {
      setAssets([]);
      setClients([]);
      setProjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubAssets = subscribeAssets(
      (data) => {
        setAssets(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      }
    );

    const unsubClients = subscribeClients(
      (data) => setClients(data.filter((c) => c.status !== 'archived')),
      (err) => console.warn('Could not load clients for asset form:', err)
    );

    const unsubProjects = subscribeProjects(
      (data) => setProjects(data.filter((p) => p.status !== 'archived')),
      (err) => console.warn('Could not load projects for asset form:', err)
    );

    return () => {
      unsubAssets();
      unsubClients();
      unsubProjects();
    };
  }, [isLiveAuth, firebaseUser]);

  const resetForm = () => {
    setFormClientId(clients[0]?.id || '');
    setFormProjectId('');
    setFormAssetType('meta_capi');
    setFormName('');
    setFormMeasurementId('');
    setFormContainerId('');
    setFormPixelId('');
    setFormServerUrl('');
    setFormDashboardUrl('');
    setFormAccessLevel('shared_with_client');
    setFormStatus('active');
    setFormNotes('');
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    if (clients.length === 0) {
      alert('Please register at least one client before adding tracking assets.');
      return;
    }
    setFormClientId(clients[0].id);
    setIsAddModalOpen(true);
  };

  const openEditModal = (asset: TrackingAsset) => {
    setSelectedAsset(asset);
    setFormClientId(asset.clientId);
    setFormProjectId(asset.projectId || '');
    setFormAssetType(asset.assetType);
    setFormName(asset.name);
    setFormMeasurementId(asset.measurementId || '');
    setFormContainerId(asset.containerId || '');
    setFormPixelId(asset.pixelId || '');
    setFormServerUrl(asset.serverContainerUrl || '');
    setFormDashboardUrl(asset.dashboardUrl || '');
    setFormAccessLevel(asset.accessLevel);
    setFormStatus(asset.status);
    setFormNotes(asset.notes || '');
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const openDetailModal = (asset: TrackingAsset) => {
    setSelectedAsset(asset);
    setCopiedId(false);
    setIsDetailModalOpen(true);
  };

  const getPrimaryIdentifier = (asset: TrackingAsset): string => {
    return (
      asset.measurementId ||
      asset.containerId ||
      asset.pixelId ||
      asset.serverContainerUrl ||
      asset.dashboardUrl ||
      '—'
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const client = clients.find((c) => c.id === formClientId);
      if (!client) throw new Error('Selected client not found');

      const project = projects.find((p) => p.id === formProjectId);

      await createTrackingAsset(
        {
          clientId: client.id,
          clientName: client.businessName,
          projectId: formProjectId || undefined,
          projectName: project?.name,
          assetType: formAssetType,
          name: formName,
          measurementId: formMeasurementId || undefined,
          containerId: formContainerId || undefined,
          pixelId: formPixelId || undefined,
          serverContainerUrl: formServerUrl || undefined,
          dashboardUrl: formDashboardUrl || undefined,
          accessLevel: formAccessLevel,
          status: formStatus,
          notes: formNotes,
        },
        actor
      );

      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register tracking asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const client = clients.find((c) => c.id === formClientId);
      const project = projects.find((p) => p.id === formProjectId);

      await updateTrackingAsset(
        selectedAsset.id,
        {
          clientId: formClientId,
          clientName: client ? client.businessName : selectedAsset.clientName,
          projectId: formProjectId || undefined,
          projectName: project?.name,
          assetType: formAssetType,
          name: formName,
          measurementId: formMeasurementId || undefined,
          containerId: formContainerId || undefined,
          pixelId: formPixelId || undefined,
          serverContainerUrl: formServerUrl || undefined,
          dashboardUrl: formDashboardUrl || undefined,
          accessLevel: formAccessLevel,
          status: formStatus,
          notes: formNotes,
        },
        actor
      );

      setIsEditModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update tracking asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async (asset: TrackingAsset) => {
    if (asset.status === 'archived') {
      await restoreTrackingAsset(asset.id, actor);
    } else {
      if (confirm(`Archive tracking asset '${asset.name}'?`)) {
        await archiveTrackingAsset(asset.id, actor);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Filter assets
  const filteredAssets = assets.filter((a) => {
    if (activeTab === 'meta' && a.assetType !== 'meta_pixel' && a.assetType !== 'meta_capi') return false;
    if (activeTab === 'gtm' && a.assetType !== 'gtm_web' && a.assetType !== 'gtm_server') return false;
    if (activeTab === 'ga4' && a.assetType !== 'ga4') return false;
    if (activeTab === 'looker' && a.assetType !== 'looker_studio') return false;
    if (activeTab === 'archived' && a.status !== 'archived') return false;
    if (activeTab === 'all' && a.status === 'archived') return false;

    if (selectedClientFilter !== 'all' && a.clientId !== selectedClientFilter) return false;
    if (selectedAssetTypeFilter !== 'all' && a.assetType !== selectedAssetTypeFilter) return false;
    if (selectedAccessLevelFilter !== 'all' && a.accessLevel !== selectedAccessLevelFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.clientName.toLowerCase().includes(q) ||
        (a.measurementId && a.measurementId.toLowerCase().includes(q)) ||
        (a.containerId && a.containerId.toLowerCase().includes(q)) ||
        (a.pixelId && a.pixelId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const columns: Column<TrackingAsset>[] = [
    {
      header: 'Asset Name & Client',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <span>{row.name}</span>
            {row.accessLevel === 'shared_with_client' ? (
              <span title="Shared in Client Portal">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
              </span>
            ) : (
              <span title="Internal Agency Only">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">{row.clientName}</p>
        </div>
      ),
    },
    {
      header: 'Type',
      cell: (row) => {
        const typeLabels: Record<string, string> = {
          ga4: 'Google Analytics 4',
          gtm_web: 'Web GTM',
          gtm_server: 'Server-Side GTM',
          meta_pixel: 'Meta Pixel',
          meta_capi: 'Meta CAPI',
          google_ads: 'Google Ads Conversion',
          tiktok_pixel: 'TikTok Pixel',
          tiktok_events_api: 'TikTok Events API',
          stape: 'Stape sGTM Server',
          looker_studio: 'Looker Studio Report',
        };
        return (
          <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            {typeLabels[row.assetType] || row.assetType}
          </span>
        );
      },
    },
    {
      header: 'Identifier / Container ID',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-800 tabular-nums">
          {getPrimaryIdentifier(row)}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => {
        const statusColors = {
          active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          in_configuration: 'bg-blue-50 text-blue-700 border-blue-200',
          verifying: 'bg-amber-50 text-amber-700 border-amber-200',
          archived: 'bg-slate-100 text-slate-400 border-slate-200',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusColors[row.status] || 'bg-slate-50'}`}>
            {row.status.toUpperCase()}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDetailModal(row)}
            icon={<Info className="w-3.5 h-3.5" />}
            className="text-xs text-slate-600 h-7 px-2"
          >
            Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
            icon={<Edit className="w-3.5 h-3.5" />}
            className="text-xs text-slate-600 h-7 px-2"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleArchiveToggle(row)}
            icon={row.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 text-emerald-600" /> : <Archive className="w-3.5 h-3.5 text-slate-400" />}
            className="text-xs h-7 px-2"
          >
            {row.status === 'archived' ? 'Restore' : 'Archive'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAssetToDelete(row);
              setIsDeleteModalOpen(true);
            }}
            icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
            className="text-xs h-7 px-2 text-red-600 hover:bg-red-50"
            title="Delete Asset"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking Assets & Infrastructure"
        description="Centralized inventory of Meta Pixels, Meta Conversions API (CAPI) setups, Server-Side GTM containers, GA4 Measurement IDs, and Looker Studio reports. Secret tokens are never stored."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={openCreateModal}
          >
            Register Tracking Asset
          </Button>
        }
      />

      {error && <ErrorState title="Failed to synchronize tracking assets" message={error} />}

      {!isLiveAuth && (
        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs text-slate-700">
              <strong className="font-semibold text-slate-900">Live Cloud Firestore Authentication:</strong> Sign in with Google to synchronize live Tracking Asset configurations in database <code className="text-[11px] font-mono text-blue-800">ai-studio-bouncegrowthagen</code>.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={signInWithGoogle} className="text-xs shrink-0">
            Sign in with Google
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Tracking Assets', count: assets.filter((a) => a.status !== 'archived').length },
            { id: 'meta', label: 'Meta Pixel & CAPI', count: assets.filter((a) => a.assetType.includes('meta')).length },
            { id: 'gtm', label: 'Web & Server GTM', count: assets.filter((a) => a.assetType.includes('gtm')).length },
            { id: 'ga4', label: 'GA4 Properties', count: assets.filter((a) => a.assetType === 'ga4').length },
            { id: 'looker', label: 'Looker Studio', count: assets.filter((a) => a.assetType === 'looker_studio').length },
            { id: 'archived', label: 'Archived', count: assets.filter((a) => a.status === 'archived').length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search by ID, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter Tracking Assets:</span>
          </div>

          {/* Client Filter */}
          {clients.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Client:</span>
              <select
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg text-xs py-1 px-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[180px]"
              >
                <option value="all">All Clients ({clients.length})</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.businessName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Asset Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Asset Type:</span>
            <select
              value={selectedAssetTypeFilter}
              onChange={(e) => setSelectedAssetTypeFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg text-xs py-1 px-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px]"
            >
              <option value="all">All Asset Types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Access Level Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Access:</span>
            <select
              value={selectedAccessLevelFilter}
              onChange={(e) => setSelectedAccessLevelFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg text-xs py-1 px-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Access</option>
              <option value="shared_with_client">Shared with Client</option>
              <option value="admin_only">Admin Only</option>
            </select>
          </div>
        </div>

        {/* Reset Filters Button */}
        {(selectedClientFilter !== 'all' || selectedAssetTypeFilter !== 'all' || selectedAccessLevelFilter !== 'all' || searchQuery.trim() !== '') && (
          <button
            onClick={() => {
              setSelectedClientFilter('all');
              setSelectedAssetTypeFilter('all');
              setSelectedAccessLevelFilter('all');
              setSearchQuery('');
            }}
            className="text-xs text-rose-600 hover:text-rose-800 font-medium underline flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Reset Filters
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingState rows={5} message="Streaming tracking assets from Cloud Firestore..." />
      ) : (
        <Card noPadding>
          <Table
            columns={columns}
            data={filteredAssets}
            keyExtractor={(a) => a.id}
            onRowClick={(a) => openDetailModal(a)}
            emptyMessage={
              searchQuery || selectedClientFilter !== 'all'
                ? 'No tracking assets match your current filters.'
                : 'No tracking assets registered in Cloud Firestore yet. Click "Register Tracking Asset" to catalog your first Pixel or GTM container.'
            }
          />
        </Card>
      )}

      {/* Register Asset Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Tracking Asset"
        description="Creates a persistent record in /assets/{assetId}. For security, secret API keys must not be entered here."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateSubmit} loading={isSubmitting}>
              Register Asset
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{formError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Client Organization"
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              options={clients.map((c) => ({ value: c.id, label: c.businessName }))}
              required
            />
            <Select
              label="Tracking Platform / Asset Type"
              value={formAssetType}
              onChange={(e) => setFormAssetType(e.target.value as TrackingAssetType)}
              options={ASSET_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Asset Descriptive Name"
              placeholder="e.g. Apex Retail Main GTM Server Container"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            {projects.length > 0 && (
              <Select
                label="Associated Project (Optional)"
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                options={[{ value: '', label: 'None (Account-Wide Asset)' }, ...projects.map((p) => ({ value: p.id, label: `${p.name} (${p.clientName})` }))]}
              />
            )}
          </div>

          {/* Dynamic Inputs based on Asset Type */}
          {(formAssetType === 'ga4') && (
            <Input
              label="GA4 Measurement ID"
              placeholder="G-XXXXXXXXXX"
              value={formMeasurementId}
              onChange={(e) => setFormMeasurementId(e.target.value)}
              required
            />
          )}

          {(formAssetType === 'gtm_web' || formAssetType === 'gtm_server') && (
            <Input
              label="GTM Container ID"
              placeholder="GTM-XXXXXXX"
              value={formContainerId}
              onChange={(e) => setFormContainerId(e.target.value)}
              required
            />
          )}

          {(formAssetType === 'meta_pixel' || formAssetType === 'meta_capi' || formAssetType === 'tiktok_pixel') && (
            <Input
              label="Pixel ID / Dataset ID"
              placeholder="e.g. 123456789012345"
              value={formPixelId}
              onChange={(e) => setFormPixelId(e.target.value)}
              required
            />
          )}

          {(formAssetType === 'gtm_server' || formAssetType === 'stape') && (
            <Input
              label="Server Tagging Endpoint / Subdomain"
              placeholder="https://ssgtm.clientdomain.com"
              value={formServerUrl}
              onChange={(e) => setFormServerUrl(e.target.value)}
            />
          )}

          {formAssetType === 'looker_studio' && (
            <Input
              label="Looker Studio Report URL"
              placeholder="https://lookerstudio.google.com/reporting/..."
              value={formDashboardUrl}
              onChange={(e) => setFormDashboardUrl(e.target.value)}
              required
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Client Portal Visibility"
              value={formAccessLevel}
              onChange={(e) => setFormAccessLevel(e.target.value as 'admin_only' | 'shared_with_client')}
              options={[
                { value: 'shared_with_client', label: 'Visible to Client in Portal' },
                { value: 'admin_only', label: 'Internal Agency Only (Private)' },
              ]}
            />
            <Select
              label="Verification Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as any)}
              options={[
                { value: 'active', label: 'Active & Verified' },
                { value: 'in_configuration', label: 'In Configuration' },
                { value: 'verifying', label: 'Testing & QA' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Technical Notes & Setup Instructions</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="First-party cookie settings, DNS records, Stape container location, etc..."
            />
          </div>
        </form>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Asset: ${selectedAsset?.name}`}
        description="Updates tracking asset metadata in Cloud Firestore."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditSubmit} loading={isSubmitting}>
              Save Updates
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{formError}</p>}

          <Input
            label="Asset Descriptive Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Verification Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as any)}
              options={[
                { value: 'active', label: 'Active & Verified' },
                { value: 'in_configuration', label: 'In Configuration' },
                { value: 'verifying', label: 'Testing & QA' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
            <Select
              label="Client Visibility"
              value={formAccessLevel}
              onChange={(e) => setFormAccessLevel(e.target.value as 'admin_only' | 'shared_with_client')}
              options={[
                { value: 'shared_with_client', label: 'Visible in Client Portal' },
                { value: 'admin_only', label: 'Agency Internal Only' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Technical Notes</label>
            <textarea
              rows={3}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </form>
      </Modal>

      {/* Asset Details Modal */}
      {selectedAsset && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedAsset.name}
          description={`Asset ID: ${selectedAsset.id} · Client: ${selectedAsset.clientName}`}
          maxWidth="md"
          footer={
            <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Platform / Type</span>
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {selectedAsset.assetType.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Status</span>
                <span className="font-bold text-slate-900">{selectedAsset.status.toUpperCase()}</span>
              </div>
            </div>

            {/* Primary Identifier with Copy Action */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Primary Container / Pixel ID</span>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="font-mono text-sm font-bold text-slate-900 break-all select-all">
                  {getPrimaryIdentifier(selectedAsset)}
                </span>
                <button
                  onClick={() => copyToClipboard(getPrimaryIdentifier(selectedAsset))}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors shrink-0"
                  title="Copy Identifier"
                >
                  {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {selectedAsset.serverContainerUrl && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Server Tagging URL</span>
                <p className="font-mono text-xs text-slate-800 break-all">{selectedAsset.serverContainerUrl}</p>
              </div>
            )}

            {selectedAsset.dashboardUrl && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Looker Studio Dashboard</span>
                <a
                  href={selectedAsset.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-0.5"
                >
                  Open Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {selectedAsset.notes && (
              <div>
                <h4 className="font-semibold text-slate-900 text-xs mb-1">Notes</h4>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap">
                  {selectedAsset.notes}
                </p>
              </div>
            )}

            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              Registered on {formatDate(selectedAsset.createdAt)}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Asset Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setAssetToDelete(null);
        }}
        title="Permanently Delete Tracking Asset"
        description="Are you sure you want to permanently delete this tracking asset? This action cannot be undone."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setAssetToDelete(null);
              }}
              disabled={isDeletingAsset}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAssetConfirm}
              loading={isDeletingAsset}
            >
              Permanently Delete Asset
            </Button>
          </>
        }
      >
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-800 space-y-1">
          <p className="font-semibold">{assetToDelete?.name}</p>
          <p className="text-slate-600">Client: {assetToDelete?.clientName} • Type: {assetToDelete?.assetType}</p>
          <p className="text-red-700 font-medium mt-2">
            Warning: This action deletes the tracking asset document from Cloud Firestore.
          </p>
        </div>
      </Modal>
    </div>
  );
}
