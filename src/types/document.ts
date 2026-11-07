export type FileVisibility = 'client' | 'internal';

export interface ProjectFile {
  id: string;
  fileName: string;
  fileUrl: string;
  storagePath?: string;
  fileSize?: number; // Size in bytes
  fileType?: string; // MIME type or extension
  projectId: string;
  projectName?: string;
  clientId: string;
  clientName?: string;
  uploadedBy: string; // Auth UID or user ID
  uploadedByName?: string;
  uploadedByEmail?: string;
  visibility: FileVisibility;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UploadFileMetadata {
  projectId: string;
  projectName?: string;
  clientId: string;
  clientName?: string;
  visibility: FileVisibility;
  description?: string;
  tags?: string[];
}
