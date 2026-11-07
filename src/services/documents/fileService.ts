import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase/client';
import { ProjectFile, UploadFileMetadata, FileVisibility } from '../../types/document';
import { logAuditEvent } from '../audit/auditService';

export const COLLECTION_NAME = 'projectFiles';

/**
 * Initial sample files seeded if collection is empty, so admin and clients
 * immediately see realistic agency files and deliverables.
 */
const INITIAL_PROJECT_FILES: Omit<ProjectFile, 'id'>[] = [
  {
    fileName: 'Apex_Retail_Master_Service_Agreement_2026.pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    storagePath: 'project_files/proj_apex_growth/Apex_Retail_Master_Service_Agreement_2026.pdf',
    fileSize: 1845200, // 1.8 MB
    fileType: 'application/pdf',
    projectId: 'proj_apex_growth',
    projectName: 'Apex Retail BD - Performance Retainer',
    clientId: 'client_apex_01',
    clientName: 'Apex Retail BD',
    uploadedBy: 'usr_admin_bounce',
    uploadedByName: 'Managing Director',
    uploadedByEmail: 'admin@bouncegrowth.agency',
    visibility: 'client',
    description: 'Signed SLA, quarterly deliverables checklist, and milestone payment terms.',
    tags: ['Contract', 'SLA', 'Legal'],
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    fileName: 'Meta_CAPI_Server_Side_Audit_Report.pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    storagePath: 'project_files/proj_apex_growth/Meta_CAPI_Server_Side_Audit_Report.pdf',
    fileSize: 3420800, // 3.4 MB
    fileType: 'application/pdf',
    projectId: 'proj_apex_growth',
    projectName: 'Apex Retail BD - Performance Retainer',
    clientId: 'client_apex_01',
    clientName: 'Apex Retail BD',
    uploadedBy: 'usr_team_specialist',
    uploadedByName: 'Tracking Specialist',
    uploadedByEmail: 'tracking@bouncegrowth.com',
    visibility: 'client',
    description: 'Event Match Quality (EMQ) scores and Stape.io / AWS server container configuration benchmark.',
    tags: ['Meta Ads', 'CAPI', 'Audit'],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    fileName: 'GTM_Server_Side_Production_Export.json',
    fileUrl: 'https://gist.githubusercontent.com/mbostock/4063550/raw/flare.json',
    storagePath: 'project_files/proj_apex_growth/GTM_Server_Side_Production_Export.json',
    fileSize: 145000, // 145 KB
    fileType: 'application/json',
    projectId: 'proj_apex_growth',
    projectName: 'Apex Retail BD - Performance Retainer',
    clientId: 'client_apex_01',
    clientName: 'Apex Retail BD',
    uploadedBy: 'usr_team_specialist',
    uploadedByName: 'Tracking Specialist',
    uploadedByEmail: 'tracking@bouncegrowth.com',
    visibility: 'internal',
    description: 'Internal GTM server container workspace backup including secret API tokens & tags.',
    tags: ['GTM', 'Backup', 'Internal'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    fileName: 'E_Commerce_Ad_Creative_Assets_Pack.zip',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    storagePath: 'project_files/proj_aura_ads/E_Commerce_Ad_Creative_Assets_Pack.zip',
    fileSize: 15400000, // 15.4 MB
    fileType: 'application/zip',
    projectId: 'proj_aura_ads',
    projectName: 'Aura Lifestyle - Meta Ads Scale',
    clientId: 'client_aura_02',
    clientName: 'Aura Lifestyle BD',
    uploadedBy: 'usr_admin_bounce',
    uploadedByName: 'Founder & Head of Growth',
    uploadedByEmail: 'admin@bouncegrowth.agency',
    visibility: 'client',
    description: 'High-res Figma exports, UGC raw video cuts, and Pahela Baishakh promo banners.',
    tags: ['Creatives', 'Banners', 'UGC'],
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    fileName: 'Agency_Standard_Operating_Procedure_GA4.pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    storagePath: 'project_files/proj_apex_growth/Agency_Standard_Operating_Procedure_GA4.pdf',
    fileSize: 920000, // 920 KB
    fileType: 'application/pdf',
    projectId: 'proj_apex_growth',
    projectName: 'Apex Retail BD - Performance Retainer',
    clientId: 'client_apex_01',
    clientName: 'Apex Retail BD',
    uploadedBy: 'usr_admin_bounce',
    uploadedByName: 'Founder & Head of Growth',
    uploadedByEmail: 'admin@bouncegrowth.agency',
    visibility: 'internal',
    description: 'Confidential internal protocol for custom dimensions and purchase deduplication.',
    tags: ['SOP', 'Internal', 'Confidential'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let isSeeding = false;

/**
 * Upload a file to Firebase Cloud Storage, then record metadata in Firestore `projectFiles` collection
 */
export async function uploadProjectFile(
  file: File,
  metadata: UploadFileMetadata,
  onProgress?: (percent: number) => void,
  actor?: { uid: string; email?: string; name?: string; role?: string }
): Promise<ProjectFile> {
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `project_files/${metadata.projectId}/${Date.now()}_${cleanName}`;
  const now = new Date().toISOString();

  let downloadUrl = '';

  try {
    // 1. Upload to Firebase Cloud Storage
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        projectId: metadata.projectId,
        clientId: metadata.clientId,
        visibility: metadata.visibility,
        uploadedBy: actor?.uid || 'user',
      },
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(percent);
          }
        },
        (error) => {
          console.warn('[Firebase Cloud Storage] Upload error:', error);
          reject(error);
        },
        async () => {
          try {
            downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve();
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });
  } catch (storageErr) {
    console.warn('[Firebase Cloud Storage] Falling back to direct URL creation:', storageErr);
    // Graceful fallback for local development or restricted storage rules
    downloadUrl = URL.createObjectURL(file);
    if (onProgress) onProgress(100);
  }

  // 2. Persist metadata to Firestore `projectFiles` collection
  const projectFile: ProjectFile = {
    id: fileId,
    fileName: file.name,
    fileUrl: downloadUrl,
    storagePath,
    fileSize: file.size,
    fileType: file.type || file.name.split('.').pop() || 'unknown',
    projectId: metadata.projectId,
    projectName: metadata.projectName || undefined,
    clientId: metadata.clientId,
    clientName: metadata.clientName || undefined,
    uploadedBy: actor?.uid || 'user',
    uploadedByName: actor?.name || 'Agency Specialist',
    uploadedByEmail: actor?.email || undefined,
    visibility: metadata.visibility,
    description: metadata.description?.trim() || undefined,
    tags: metadata.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, COLLECTION_NAME, fileId), projectFile);

  // 3. Log audit event
  if (actor?.uid && actor?.role && actor.role !== 'client') {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role,
      action: 'document_uploaded',
      entityType: 'document',
      entityId: fileId,
      details: `Uploaded file "${file.name}" (${(file.size / 1024).toFixed(1)} KB) to project ${metadata.projectId} with visibility: ${metadata.visibility}`,
    });
  }

  return projectFile;
}

/**
 * Real-time subscription for project files
 */
export function subscribeProjectFiles(
  callback: (files: ProjectFile[]) => void,
  onError?: (err: Error) => void,
  options?: {
    clientId?: string;
    clientVisibleOnly?: boolean;
    projectId?: string;
  }
): Unsubscribe {
  const colRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    colRef,
    async (snapshot) => {
      // Auto-seed sample files if empty
      if (snapshot.empty && !isSeeding && !options?.clientId && !options?.projectId) {
        isSeeding = true;
        try {
          console.log('[FileService] Auto-seeding initial project files...');
          for (let i = 0; i < INITIAL_PROJECT_FILES.length; i++) {
            const seed = INITIAL_PROJECT_FILES[i];
            const docId = `file_seed_${i + 1}`;
            await setDoc(doc(db, COLLECTION_NAME, docId), {
              id: docId,
              ...seed,
            });
          }
        } catch (seedErr) {
          console.warn('[FileService] Auto-seed failed (may lack permissions):', seedErr);
        } finally {
          isSeeding = false;
        }
        return;
      }

      let files: ProjectFile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        files.push({
          id: docSnap.id,
          fileName: data.fileName || 'Untitled File',
          fileUrl: data.fileUrl || '',
          storagePath: data.storagePath,
          fileSize: data.fileSize || 0,
          fileType: data.fileType || '',
          projectId: data.projectId || '',
          projectName: data.projectName,
          clientId: data.clientId || '',
          clientName: data.clientName,
          uploadedBy: data.uploadedBy || '',
          uploadedByName: data.uploadedByName,
          uploadedByEmail: data.uploadedByEmail,
          visibility: data.visibility || 'internal',
          description: data.description,
          tags: data.tags || [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Apply client filtering if requested
      if (options?.clientId) {
        files = files.filter((f) => f.clientId === options.clientId);
      }

      // Filter client visible files if requested (for Client Portal)
      if (options?.clientVisibleOnly) {
        files = files.filter((f) => f.visibility === 'client');
      }

      // Filter by project if requested
      if (options?.projectId) {
        files = files.filter((f) => f.projectId === options.projectId);
      }

      // Sort by newest first
      files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      callback(files);
    },
    (error) => {
      console.error('[FileService] Snapshot error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Update visibility of an existing project file
 */
export async function updateFileVisibility(
  fileId: string,
  visibility: FileVisibility,
  actor?: { uid: string; email?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, fileId);
  await updateDoc(docRef, {
    visibility,
    updatedAt: new Date().toISOString(),
  });

  if (actor?.uid && actor?.role && actor.role !== 'client') {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role,
      action: 'document_visibility_changed',
      entityType: 'document',
      entityId: fileId,
      details: `Changed document ${fileId} visibility to ${visibility}`,
    });
  }
}

/**
 * Delete a project file document and delete the storage blob
 */
export async function deleteProjectFile(
  file: ProjectFile,
  actor?: { uid: string; email?: string; role?: string }
): Promise<void> {
  // 1. Delete from Firestore
  const docRef = doc(db, COLLECTION_NAME, file.id);
  await deleteDoc(docRef);

  // 2. Delete from Cloud Storage
  if (file.storagePath) {
    try {
      const storageRef = ref(storage, file.storagePath);
      await deleteObject(storageRef);
    } catch (storageErr) {
      console.warn('[FileService] Cloud storage blob deletion failed (may already be gone):', storageErr);
    }
  }

  // 3. Log audit event
  if (actor?.uid && actor?.role && actor.role !== 'client') {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role,
      action: 'document_deleted',
      entityType: 'document',
      entityId: file.id,
      details: `Deleted project file "${file.fileName}"`,
    });
  }
}
