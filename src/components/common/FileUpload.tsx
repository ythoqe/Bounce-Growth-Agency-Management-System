import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  File,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Eye,
  Briefcase,
  Folder,
  Tag,
  Loader2,
} from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../../features/auth/AuthContext';
import { ProjectFile, FileVisibility, UploadFileMetadata } from '../../types/document';
import { uploadProjectFile } from '../../services/documents/fileService';
import { subscribeProjects } from '../../services/projects/projectService';
import { subscribeClients } from '../../services/clients/clientService';
import { Project } from '../../types/project';
import { ClientProfile } from '../../types/client';

export interface FileUploadProps {
  projectId?: string;
  clientId?: string;
  defaultVisibility?: FileVisibility;
  onUploadSuccess?: (file: ProjectFile) => void;
  onCancel?: () => void;
  maxSizeMB?: number;
  allowedExtensions?: string[];
  className?: string;
}

export function FileUpload({
  projectId: preboundProjectId,
  clientId: preboundClientId,
  defaultVisibility = 'client',
  onUploadSuccess,
  onCancel,
  maxSizeMB = 50,
  allowedExtensions,
  className = '',
}: FileUploadProps) {
  const { currentUser, currentRole } = useAuth();

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form fields
  const [selectedProjectId, setSelectedProjectId] = useState<string>(preboundProjectId || '');
  const [selectedClientId, setSelectedClientId] = useState<string>(preboundClientId || '');
  const [visibility, setVisibility] = useState<FileVisibility>(defaultVisibility);
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Dropdown options
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch projects & clients if not pre-bound
  useEffect(() => {
    if (!preboundProjectId) {
      const unsubProjects = subscribeProjects(
        (data) => setProjects(data),
        (err) => console.warn('Failed to load projects for FileUpload:', err)
      );
      return () => unsubProjects();
    }
  }, [preboundProjectId]);

  useEffect(() => {
    if (!preboundClientId) {
      const unsubClients = subscribeClients(
        (data) => setClients(data),
        (err) => console.warn('Failed to load clients for FileUpload:', err)
      );
      return () => unsubClients();
    }
  }, [preboundClientId]);

  // When selected project changes, auto-populate client ID
  useEffect(() => {
    if (selectedProjectId && !preboundClientId) {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj && proj.clientId) {
        setSelectedClientId(proj.clientId);
      }
    }
  }, [selectedProjectId, projects, preboundClientId]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);

    // Size validation
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorMessage(`File exceeds maximum size limit of ${maxSizeMB}MB.`);
      return;
    }

    // Extension validation
    if (allowedExtensions && allowedExtensions.length > 0) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        setErrorMessage(`Only ${allowedExtensions.join(', ')} file types are allowed.`);
        return;
      }
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadProgress(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please choose a file to upload.');
      return;
    }

    const projectId = preboundProjectId || selectedProjectId;
    const clientId = preboundClientId || selectedClientId;

    if (!projectId) {
      setErrorMessage('Please select a target Project for this file.');
      return;
    }

    if (!clientId) {
      setErrorMessage('Please select a target Client organization.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const matchedProject = projects.find((p) => p.id === projectId);
      const matchedClient = clients.find((c) => c.id === clientId);

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0);

      const metadata: UploadFileMetadata = {
        projectId,
        projectName: matchedProject?.name,
        clientId,
        clientName: matchedClient?.businessName || matchedProject?.clientName,
        visibility,
        description: description.trim() || undefined,
        tags,
      };

      const result = await uploadProjectFile(
        selectedFile,
        metadata,
        (percent) => setUploadProgress(percent),
        {
          uid: currentUser?.id || 'admin',
          email: currentUser?.email || 'admin@bouncegrowth.agency',
          name: currentUser?.displayName || 'Agency Specialist',
          role: currentRole || 'admin',
        }
      );

      setSuccessMessage(`File "${selectedFile.name}" successfully uploaded to Cloud Storage!`);
      setIsUploading(false);

      if (onUploadSuccess) {
        onUploadSuccess(result);
      }
    } catch (err: unknown) {
      console.error('File upload failed:', err);
      setIsUploading(false);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-8 h-8 text-rose-500" />;
    if (['json', 'js', 'ts', 'html'].includes(ext || '')) return <FileCode className="w-8 h-8 text-amber-500" />;
    if (['zip', 'rar', 'tar', 'gz'].includes(ext || '')) return <FileArchive className="w-8 h-8 text-purple-500" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) return <ImageIcon className="w-8 h-8 text-emerald-500" />;
    return <File className="w-8 h-8 text-blue-500" />;
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-xs ${className}`}>
      {/* Notifications */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        {/* Drop Zone */}
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/60 scale-[0.99]'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">
              Drag & Drop file here, or <span className="text-blue-600 hover:underline">browse files</span>
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Upload client contracts (PDF), GTM container backups (JSON), creative ad packs (ZIP), or audit sheets. Max {maxSizeMB}MB.
            </p>
          </div>
        ) : (
          /* Selected File Preview Box */
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">{getFileIcon(selectedFile.name)}</div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-500">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Binary file'}
                </p>
              </div>
            </div>
            {!isUploading && (
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Upload Progress Bar */}
        {isUploading && uploadProgress !== null && (
          <div className="space-y-1.5 p-3 bg-blue-50/70 border border-blue-100 rounded-lg">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                Uploading to Firebase Cloud Storage...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Project & Client Selectors (if not prebound) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Target Project <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Folder className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                disabled={!!preboundProjectId || isUploading}
                value={preboundProjectId || selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">-- Choose Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Client Organization <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                disabled={!!preboundClientId || isUploading}
                value={preboundClientId || selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">-- Choose Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Visibility Setting (Client vs Internal) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            File Access & Visibility <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setVisibility('client')}
              className={`p-3 rounded-lg border text-left transition-all ${
                visibility === 'client'
                  ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/30'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Eye className={`w-4 h-4 ${visibility === 'client' ? 'text-emerald-700' : 'text-slate-500'}`} />
                <span className={`text-xs font-bold ${visibility === 'client' ? 'text-emerald-900' : 'text-slate-800'}`}>
                  Client Visible
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Shared with client rep in their Client Portal (/portal/documents).
              </p>
            </button>

            <button
              type="button"
              disabled={isUploading}
              onClick={() => setVisibility('internal')}
              className={`p-3 rounded-lg border text-left transition-all ${
                visibility === 'internal'
                  ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/30'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Lock className={`w-4 h-4 ${visibility === 'internal' ? 'text-amber-700' : 'text-slate-500'}`} />
                <span className={`text-xs font-bold ${visibility === 'internal' ? 'text-amber-900' : 'text-slate-800'}`}>
                  Internal Only
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Confidential to Bounce Growth agency admins and team specialists.
              </p>
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            File Description / Deliverable Notes
          </label>
          <input
            type="text"
            disabled={isUploading}
            placeholder="e.g. Signed SLA copy, Q2 server-side audit benchmark, raw ad creative zip"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Tags (comma separated)
          </label>
          <div className="relative">
            <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              disabled={isUploading}
              placeholder="e.g. Contract, SLA, GTM, Audit, Banners"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!selectedFile || isUploading}
            icon={isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
          >
            {isUploading ? 'Uploading File...' : 'Upload to Cloud Storage'}
          </Button>
        </div>
      </form>
    </div>
  );
}
