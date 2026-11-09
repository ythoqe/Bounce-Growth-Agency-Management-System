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
import {
  ContentItem,
  CreateContentItemInput,
  UpdateContentItemInput,
  ContentStatus,
} from '../../types/content';
import { logAuditEvent } from '../audit/auditService';
import { stripUndefined } from '../../utils/cleanFirestore';

const COLLECTION_NAME = 'content_items';

/**
 * Real-time listener for content calendar items
 */
export function subscribeContentItems(
  callback: (items: ContentItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // If not authenticated, do not fire an unauthorized query
  if (!auth?.currentUser) {
    callback([]);
    return () => {};
  }

  const colRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: ContentItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          title: data.title || 'Untitled Content',
          caption: data.caption || '',
          platforms: data.platforms || ['meta'],
          publishDate: data.publishDate || new Date().toISOString(),
          status: data.status || 'idea',
          clientId: data.clientId || undefined,
          clientName: data.clientName || undefined,
          mediaUrl: data.mediaUrl || undefined,
          authorUid: data.authorUid || undefined,
          authorName: data.authorName || undefined,
          notes: data.notes || undefined,
          tags: data.tags || [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Sort client-side by publish date ascending
      items.sort((a, b) => new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime());

      callback(items);
    },
    (error) => {
      console.warn('[ContentCalendarService] Snapshot note:', error?.message || error);
      callback([]);
      if (onError) onError(error);
    }
  );
}

/**
 * Create a new Content Item in Firestore
 */
export async function createContentItem(
  input: CreateContentItemInput,
  actor?: { uid: string; email?: string; name?: string; role?: string }
): Promise<ContentItem> {
  const itemId = `content_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const item: ContentItem = {
    id: itemId,
    title: input.title.trim(),
    caption: input.caption.trim(),
    platforms: input.platforms.length > 0 ? input.platforms : ['meta'],
    publishDate: input.publishDate,
    status: input.status || 'idea',
    clientId: input.clientId || undefined,
    clientName: input.clientName || undefined,
    mediaUrl: input.mediaUrl || undefined,
    authorUid: actor?.uid,
    authorName: actor?.name,
    notes: input.notes || undefined,
    tags: input.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, COLLECTION_NAME, itemId), stripUndefined(item));

  if (actor?.uid && actor?.role && actor.role !== 'client') {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role,
      action: 'content_item_created',
      entityType: 'content_item',
      entityId: itemId,
      details: `Created content drop "${item.title}" for ${item.platforms.join(', ')} scheduled for ${item.publishDate}`,
    });
  }

  return item;
}

/**
 * Update an existing Content Item
 */
export async function updateContentItem(
  itemId: string,
  updates: UpdateContentItemInput,
  actor?: { uid: string; email?: string; name?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, itemId);
  const patchData: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(docRef, stripUndefined(patchData));

  if (actor?.uid && actor?.role && actor.role !== 'client') {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role,
      action: 'content_item_updated',
      entityType: 'content_item',
      entityId: itemId,
      details: `Updated content item details: ${updates.title || itemId}`,
    });
  }
}

/**
 * Move or advance status of a content item (Kanban status transition)
 */
export async function updateContentItemStatus(
  itemId: string,
  newStatus: ContentStatus,
  actor?: { uid: string; email?: string; name?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, itemId);
  await updateDoc(docRef, {
    status: newStatus,
    updatedAt: new Date().toISOString(),
  });

  if (actor?.uid && actor?.role && actor.role !== 'client') {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role,
      action: 'content_item_status_changed',
      entityType: 'content_item',
      entityId: itemId,
      details: `Changed content item ${itemId} stage to ${newStatus}`,
    });
  }
}

/**
 * Delete a content item from Firestore
 */
export async function deleteContentItem(
  itemId: string,
  itemTitle?: string,
  actor?: { uid: string; email?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, itemId);
  await deleteDoc(docRef);

  if (actor?.uid && actor?.role && actor.role !== 'client') {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role,
      action: 'content_item_deleted',
      entityType: 'content_item',
      entityId: itemId,
      details: `Deleted content item "${itemTitle || itemId}"`,
    });
  }
}
