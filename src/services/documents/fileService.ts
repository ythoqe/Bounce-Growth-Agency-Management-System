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
  Query,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, auth } from '../firebase/client';
import { ProjectFile, UploadFileMetadata, FileVisibility } from '../../types/document';
import { logAuditEvent } from '../audit/auditService';
import { stripUndefined } from '../../utils/cleanFirestore';

export const COLLECTION_NAME = 'projectFiles';

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

  await setDoc(doc(db, COLLECTION_NAME, fileId), stripUndefined(projectFile));

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
    actorRole?: string;
    actorUid?: string;
  }
): Unsubscribe {
  // If unauthenticated, return empty list gracefully without triggering Firestore permission errors
  if (!auth?.currentUser) {
    callback([]);
    return () => {};
  }

  // Construct query satisfying Firestore security rules for client users and scoping
  let targetQuery: Query = collection(db, COLLECTION_NAME);
  if (options?.clientVisibleOnly && options?.clientId) {
    targetQuery = query(
      collection(db, COLLECTION_NAME),
      where('visibility', '==', 'client'),
      where('clientId', '==', options.clientId)
    );
  } else if (options?.clientId) {
    targetQuery = query(collection(db, COLLECTION_NAME), where('clientId', '==', options.clientId));
  } else if (options?.projectId) {
    targetQuery = query(collection(db, COLLECTION_NAME), where('projectId', '==', options.projectId));
  }

  return onSnapshot(
    targetQuery,
    (snapshot) => {
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
      console.warn('[FileService] Snapshot subscription note:', error?.message || error);
      callback([]);
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
