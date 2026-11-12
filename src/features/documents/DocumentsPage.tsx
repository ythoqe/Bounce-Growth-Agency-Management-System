import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Lock,
  Download,
  Trash2,
  Folder,
  Briefcase,
  User,
  Calendar,
  Layers,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  File,
  X,
  ExternalLink,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { FileUpload } from '../../components/common/FileUpload';
import { useAuth } from '../auth/AuthContext';
import { ProjectFile, FileVisibility } from '../../types/document';
import {
  subscribeProjectFiles,
  updateFileVisibility,
  deleteProjectFile,
} from '../../services/documents/fileService';
import { subscribeClients } from '../../services/clients/clientService';
import { subscribeProjects } from '../../services/projects/projectService';
import { ClientProfile } from '../../types/client';
import { Project } from '../../types/project';

export function DocumentsPage() {
  const {
    currentUser,
    currentRole,
    firebaseUser,
    isLiveAuth,
    isLoading: isAuthLoading,
    signInWithGoogle,
  } = useAuth();

  // Firestore Real-time data
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'client' | 'internal'>('all');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'pdf' | 'image' | 'code' | 'archive' | 'other'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedFileForDelete, setSelectedFileForDelete] = useState<ProjectFile | null>(null);

  // Feedback notifications
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Subscriptions
  useEffect(() => {
    // Wait until auth state finishes initializing
    if (isAuthLoading) {
      return;
    }

    setLoading(true);
    const unsubFiles = subscribeProjectFiles(
      (data) => {
        setFiles(data);
        setLoading(false);
        setAlertError(null);
      },
      (err) => {
        console.warn('Files subscription note:', err?.message || err);
        setLoading(false);
      },
      { actorRole: currentRole || 'team', actorUid: currentUser?.id }
    );

    const unsubClients = subscribeClients(
      (data) => setClients(data),
      (err) => console.warn('Clients subscription warning:', err),
      { actorRole: currentRole || 'team', actorUid: currentUser?.id }
    );

    const unsubProjects = subscribeProjects(
      (data) => setProjects(data),
      (err) => console.warn('Projects subscription warning:', err),
      { actorRole: currentRole || 'team', actorUid: currentUser?.id }
    );

    return () => {
      unsubFiles();
      unsubClients();
      unsubProjects();
    };
  }, [currentRole, currentUser, isAuthLoading, isLiveAuth, firebaseUser]);

  // Auto-dismiss alert
  useEffect(() => {
    if (alertSuccess) {
      const t = setTimeout(() => setAlertSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [alertSuccess]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      // Tab filter
      if (activeTab === 'client' && f.visibility !== 'client') return false;
      if (activeTab === 'internal' && f.visibility !== 'internal') return false;

      // Client filter
      if (selectedClientFilter !== 'all' && f.clientId !== selectedClientFilter) return false;

      // Project filter
      if (selectedProjectFilter !== 'all' && f.projectId !== selectedProjectFilter) return false;

      // File type filter
      if (fileTypeFilter !== 'all') {
        const ext = f.fileName.split('.').pop()?.toLowerCase() || '';
        if (fileTypeFilter === 'pdf' && ext !== 'pdf') return false;
        if (fileTypeFilter === 'image' && !['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) return false;
        if (fileTypeFilter === 'code' && !['json', 'js', 'ts', 'html', 'css', 'sql'].includes(ext)) return false;
        if (fileTypeFilter === 'archive' && !['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return false;
        if (fileTypeFilter === 'other' && ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'json', 'js', 'ts', 'html', 'css', 'sql', 'zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = f.fileName.toLowerCase().includes(q);
        const matchesProj = f.projectName?.toLowerCase().includes(q);
        const matchesClient = f.clientName?.toLowerCase().includes(q);
        const matchesDesc = f.description?.toLowerCase().includes(q);
        const matchesTags = f.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesProj && !matchesClient && !matchesDesc && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [files, activeTab, selectedClientFilter, selectedProjectFilter, fileTypeFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = files.length;
    const clientVisible = files.filter((f) => f.visibility === 'client').length;
    const internalOnly = files.filter((f) => f.visibility === 'internal').length;
    const totalBytes = files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
    return { total, clientVisible, internalOnly, totalBytes };
  }, [files]);

  // Helper format file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Helper file icon
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-6 h-6 text-rose-500" />;
    if (['json', 'js', 'ts', 'html'].includes(ext || '')) return <FileCode className="w-6 h-6 text-amber-500" />;
    if (['zip', 'rar', 'tar', 'gz'].includes(ext || '')) return <FileArchive className="w-6 h-6 text-purple-500" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) return <ImageIcon className="w-6 h-6 text-emerald-500" />;
    return <File className="w-6 h-6 text-blue-500" />;
  };

  // Handle visibility toggle
  const handleToggleVisibility = async (file: ProjectFile) => {
    const nextVisibility: FileVisibility = file.visibility === 'client' ? 'internal' : 'client';
    try {
      await updateFileVisibility(file.id, nextVisibility, {
        uid: currentUser?.id || 'admin',
        email: currentUser?.email || 'admin@bouncegrowth.agency',
        role: currentRole || 'admin',
      });
      setAlertSuccess(
        `Updated visibility for "${file.fileName}" to ${nextVisibility === 'client' ? 'Client Visible' : 'Internal Only'}.`
      );
    } catch (err: unknown) {
      console.error('Failed to change visibility:', err);
      setAlertError('Failed to change document visibility.');
    }
  };

  // Handle Delete Confirm
  const handleDeleteConfirm = async () => {
    if (!selectedFileForDelete) return;
    try {
      await deleteProjectFile(selectedFileForDelete, {
        uid: currentUser?.id || 'admin',
        email: currentUser?.email || 'admin@bouncegrowth.agency',
        role: currentRole || 'admin',
      });
      setAlertSuccess(`File "${selectedFileForDelete.fileName}" deleted.`);
      setIsDeleteModalOpen(false);
      setSelectedFileForDelete(null);
    } catch (err: unknown) {
      console.error('Failed to delete file:', err);
      setAlertError('Failed to delete file.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title="Agency Documents & Cloud Files"
        description="Store and organize client SLAs, tracking implementation briefs, server-side GTM backups, and creative assets powered by Firebase Cloud Storage."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Upload Document
            </Button>
          </div>
        }
      />

      {/* Notifications */}
      {!isLiveAuth && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">
              Google Sign-In Required: Sign in with your agency account to upload and sync files live with Cloud Storage and Firestore.
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

      {alertSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{alertSuccess}</span>
          </div>
          <button onClick={() => setAlertSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {alertError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{alertError}</span>
          </div>
          <button onClick={() => setAlertError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Total Uploaded Files</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-700">Client Visible</p>
            <Eye className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{metrics.clientVisible}</p>
          <span className="text-[11px] text-slate-500">Accessible in Client Portal</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-700">Internal Agency Only</p>
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-1">{metrics.internalOnly}</p>
          <span className="text-[11px] text-slate-500">Hidden from client users</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Cloud Storage Volume</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatBytes(metrics.totalBytes)}</p>
          <span className="text-[11px] text-slate-500">Firebase Storage Bucket</span>
        </div>
      </div>

      {/* Filters & Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search file name, project, client, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Client Filter */}
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>

            {/* Project Filter */}
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* File Type Filter */}
            <select
              value={fileTypeFilter}
              onChange={(e) => setFileTypeFilter(e.target.value as any)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All File Types</option>
              <option value="pdf">PDF Documents</option>
              <option value="image">Images (PNG, JPG, SVG)</option>
              <option value="code">Code & Config (JSON, JS, SQL)</option>
              <option value="archive">Archives (ZIP, TAR)</option>
              <option value="other">Other Files</option>
            </select>

            {(searchQuery.trim() || selectedClientFilter !== 'all' || selectedProjectFilter !== 'all' || fileTypeFilter !== 'all' || activeTab !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedClientFilter('all');
                  setSelectedProjectFilter('all');
                  setFileTypeFilter('all');
                  setActiveTab('all');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1.5 rounded hover:bg-rose-50 transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Tab Filter */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Visibility:
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Documents ({files.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('client')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'client'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Client Visible ({files.filter((f) => f.visibility === 'client').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('internal')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'internal'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Internal Only ({files.filter((f) => f.visibility === 'internal').length})
          </button>
        </div>
      </div>

      {/* Main Files Display */}
      {loading ? (
        <div className="py-16 bg-white rounded-xl border border-slate-200">
          <LoadingState message="Loading documents and files from Cloud Storage & Firestore..." />
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card>
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {files.length === 0 ? 'No Documents Found' : 'No Documents Match Filters'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedClientFilter !== 'all' || selectedProjectFilter !== 'all' || fileTypeFilter !== 'all' || activeTab !== 'all'
                ? 'No documents matched your active filters. Try clearing or expanding your query.'
                : 'Upload signed client contracts, GTM container backups, or creative briefs to get started.'}
            </p>
            {files.length > 0 && (searchQuery || selectedClientFilter !== 'all' || selectedProjectFilter !== 'all' || fileTypeFilter !== 'all' || activeTab !== 'all') ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedClientFilter('all');
                  setSelectedProjectFilter('all');
                  setFileTypeFilter('all');
                  setActiveTab('all');
                }}
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<Upload className="w-4 h-4" />}
                onClick={() => setIsUploadModalOpen(true)}
              >
                Upload First Document
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredFiles.map((file) => {
            const isClientVis = file.visibility === 'client';
            return (
              <div
                key={file.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar: Icon & Visibility Toggle */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 shrink-0">
                      {getFileIcon(file.fileName)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(file)}
                      title={`Click to change to ${isClientVis ? 'Internal Only' : 'Client Visible'}`}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 ${
                        isClientVis
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      {isClientVis ? <Eye className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3 text-amber-600" />}
                      <span>{isClientVis ? 'Client Visible' : 'Internal Only'}</span>
                    </button>
                  </div>

                  {/* Title & Metadata */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 break-words hover:text-blue-600 transition-colors">
                      {file.fileName}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatBytes(file.fileSize || 0)} • Uploaded{' '}
                      {new Date(file.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Project & Client tags */}
                  <div className="space-y-1 text-[11px]">
                    {file.projectName && (
                      <div className="text-slate-600 flex items-center gap-1 truncate">
                        <Folder className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{file.projectName}</span>
                      </div>
                    )}
                    {file.clientName && (
                      <div className="text-slate-500 flex items-center gap-1 truncate">
                        <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{file.clientName}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {file.description && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                      {file.description}
                    </p>
                  )}

                  {/* Tags */}
                  {file.tags && file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {file.tags.map((tag) => (
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

                {/* Footer Actions */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                    By {file.uploadedByName || file.uploadedBy}
                  </span>
                  <div className="flex items-center gap-1">
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                      title="Download or preview file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFileForDelete(file);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Document / File</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Visibility</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map((file) => {
                  const isClientVis = file.visibility === 'client';
                  return (
                    <tr key={file.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0">{getFileIcon(file.fileName)}</div>
                          <div className="min-w-0">
                            <p className="truncate font-bold">{file.fileName}</p>
                            {file.description && (
                              <p className="text-[11px] text-slate-500 truncate">{file.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {file.projectName || file.projectId}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {file.clientName || file.clientId}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {formatBytes(file.fileSize || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(file)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all inline-flex items-center gap-1 ${
                            isClientVis
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {isClientVis ? <Eye className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3 text-amber-600" />}
                          <span>{isClientVis ? 'Client Visible' : 'Internal Only'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFileForDelete(file);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* UPLOAD MODAL */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Project File to Cloud Storage"
        description="Select a file to upload. Metadata will be saved to Firestore in the projectFiles collection."
        maxWidth="lg"
      >
        <FileUpload
          onUploadSuccess={(file) => {
            setAlertSuccess(`Document "${file.fileName}" uploaded successfully.`);
            setIsUploadModalOpen(false);
          }}
          onCancel={() => setIsUploadModalOpen(false)}
        />
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedFileForDelete(null);
        }}
        title="Delete Document"
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedFileForDelete(null);
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
            Are you sure you want to delete this document? This will delete the metadata from Firestore
            and remove the file from Cloud Storage.
          </p>
          {selectedFileForDelete && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <span className="font-semibold text-rose-900 block truncate">
                {selectedFileForDelete.fileName}
              </span>
              <span className="text-xs text-rose-700 mt-1 block">
                {formatBytes(selectedFileForDelete.fileSize || 0)} • {selectedFileForDelete.projectName}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
