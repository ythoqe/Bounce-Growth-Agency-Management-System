import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase/client';
import { SopGuide, CreateSopInput, UpdateSopInput, SopCategory } from '../../types/sop';
import { logAuditEvent } from '../audit/auditService';
import { stripUndefined } from '../../utils/cleanFirestore';

const COLLECTION_NAME = 'sops';

/**
 * Real-time listener for SOP guides
 */
export function subscribeSops(
  callback: (sops: SopGuide[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!auth?.currentUser) {
    callback([]);
    return () => {};
  }

  const colRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: SopGuide[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          title: data.title || 'Untitled SOP',
          category: data.category || 'tracking',
          summary: data.summary || '',
          content: data.content || '',
          steps: Array.isArray(data.steps) ? data.steps : [],
          externalDocUrl: data.externalDocUrl || undefined,
          tags: Array.isArray(data.tags) ? data.tags : [],
          authorUid: data.authorUid || undefined,
          authorName: data.authorName || undefined,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Sort client-side by title ascending
      items.sort((a, b) => a.title.localeCompare(b.title));

      callback(items);
    },
    (error) => {
      console.warn('[SopService] Snapshot error:', error?.message || error);
      callback([]);
      if (onError) onError(error);
    }
  );
}

/**
 * Create a new SOP Guide
 */
export async function createSop(
  input: CreateSopInput,
  actor?: { uid: string; email?: string; name?: string; role?: string }
): Promise<SopGuide> {
  const sopId = `sop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newSop: SopGuide = {
    id: sopId,
    title: input.title.trim(),
    category: input.category,
    summary: input.summary.trim(),
    content: input.content.trim(),
    steps: input.steps || [],
    externalDocUrl: input.externalDocUrl?.trim() || undefined,
    tags: input.tags || [],
    authorUid: actor?.uid,
    authorName: actor?.name,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, COLLECTION_NAME, sopId), stripUndefined(newSop));

  if (actor?.uid) {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role || 'team',
      action: 'sop_created',
      entityType: 'sop',
      entityId: sopId,
      details: `Created SOP guide "${newSop.title}" in category ${newSop.category}`,
    });
  }

  return newSop;
}

/**
 * Update an existing SOP Guide
 */
export async function updateSop(
  sopId: string,
  updates: UpdateSopInput,
  actor?: { uid: string; email?: string; name?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, sopId);
  const patchData: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(docRef, stripUndefined(patchData));

  if (actor?.uid) {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role || 'team',
      action: 'sop_updated',
      entityType: 'sop',
      entityId: sopId,
      details: `Updated SOP guide ${updates.title || sopId}`,
    });
  }
}

/**
 * Delete an SOP Guide from Firestore
 */
export async function deleteSop(
  sopId: string,
  title?: string,
  actor?: { uid: string; email?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, sopId);
  await deleteDoc(docRef);

  if (actor?.uid) {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role || 'admin',
      action: 'sop_deleted',
      entityType: 'sop',
      entityId: sopId,
      details: `Deleted SOP guide "${title || sopId}"`,
    });
  }
}
