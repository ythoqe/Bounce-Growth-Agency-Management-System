import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  Search,
  Filter,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  File,
  Calendar,
  Folder,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuth } from '../auth/AuthContext';
import { ProjectFile } from '../../types/document';
import { subscribeProjectFiles } from '../../services/documents/fileService';

export function ClientDocumentsPage() {
  const { currentUser } = useAuth();
  const effectiveClientId = currentUser?.clientId || 'client_apex_01';

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    // Subscribe strictly to files matching this client's clientId and visibility: 'client'
    const unsub = subscribeProjectFiles(
      (data) => {
        setFiles(data);
        setLoading(false);
      },
      (err) => {
        console.warn('Client documents subscription note:', err?.message || err);
        setLoading(false);
      },
      {
        clientId: effectiveClientId,
        clientVisibleOnly: true, // STRICT SECURITY: only files where visibility == 'client'
      }
    );

    return () => unsub();
  }, [effectiveClientId]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    files.forEach((f) => {
      f.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [files]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      // Must be client visible (double-check in UI memory)
      if (f.visibility !== 'client') return false;

      // Tag filter
      if (selectedTag !== 'all' && !f.tags?.includes(selectedTag)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = f.fileName.toLowerCase().includes(q);
        const matchesProj = f.projectName?.toLowerCase().includes(q);
        const matchesDesc = f.description?.toLowerCase().includes(q);
        const matchesTag = f.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesProj && !matchesDesc && !matchesTag) {
          return false;
        }
      }

      return true;
    });
  }, [files, selectedTag, searchQuery]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-7 h-7 text-rose-500" />;
    if (['json', 'js', 'ts', 'html'].includes(ext || '')) return <FileCode className="w-7 h-7 text-amber-500" />;
    if (['zip', 'rar', 'tar', 'gz'].includes(ext || '')) return <FileArchive className="w-7 h-7 text-purple-500" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) return <ImageIcon className="w-7 h-7 text-emerald-500" />;
    return <File className="w-7 h-7 text-blue-500" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title="Shared Documents & Deliverables"
        description="Access signed master service agreements (SLAs), tracking architecture briefs, ad creative assets, and performance reports shared with your organization."
      />

      {/* Security Banner */}
      <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-900">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold block">Verified Client Encrypted Access</span>
            <span className="text-emerald-700">
              Filtered strictly for your organization (<span className="font-mono">{effectiveClientId}</span>). Only client-approved deliverables are accessible.
            </span>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5" /> Client Portal Active
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Shared Documents</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{files.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Contracts & SLAs</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {files.filter((f) => f.tags?.some((t) => ['contract', 'sla', 'legal'].includes(t.toLowerCase()))).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Technical Briefs & Assets</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {files.filter((f) => f.tags?.some((t) => !['contract', 'sla', 'legal'].includes(t.toLowerCase()))).length}
          </p>
        </div>
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents by name, project, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Tags:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                selectedTag === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({files.length})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="py-16 bg-white rounded-xl border border-slate-200">
          <LoadingState message="Loading your shared documents from Cloud Storage..." />
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card>
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No Shared Documents Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedTag !== 'all'
                ? 'No documents matched your search filter. Try clearing the search term.'
                : 'Contracts, tracking architecture blueprints, and campaign briefs uploaded by your account manager will be available here.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Icon & File Size */}
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 shrink-0">
                    {getFileIcon(file.fileName)}
                  </div>
                  <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {formatBytes(file.fileSize || 0)}
                  </span>
                </div>

                {/* File Title */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 break-words leading-snug">
                    {file.fileName}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Shared on{' '}
                    {new Date(file.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Project association */}
                {file.projectName && (
                  <div className="text-[11px] text-slate-600 flex items-center gap-1 truncate bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate font-medium">{file.projectName}</span>
                  </div>
                )}

                {/* Description */}
                {file.description && (
                  <p className="text-[11px] text-slate-600 bg-slate-50/60 p-2 rounded-lg border border-slate-100 line-clamp-2">
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

              {/* Download Action */}
              <div className="pt-3 mt-3 border-t border-slate-100">
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-blue-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download / Preview Document</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
