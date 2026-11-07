import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import {
  ContentItem,
  CreateContentItemInput,
  UpdateContentItemInput,
  ContentStatus,
} from '../../types/content';
import { logAuditEvent } from '../audit/auditService';

const COLLECTION_NAME = 'content_items';

/**
 * Initial sample items seeded automatically if the collection is empty.
 * Provides instant value and visual cues for the agency team.
 */
const INITIAL_CONTENT_ITEMS: Omit<ContentItem, 'id'>[] = [
  {
    title: 'Meta Conversions API (CAPI) vs Browser Pixel Reel',
    caption:
      'Are you losing 30% of your Meta conversion data to iOS 14.5+ privacy filters? Here is how Bounce Growth recovers lost revenue with server-side GTM setup. Link in bio to book your tracking audit! 🚀📊 #MetaAds #TrackingAudit #CAPI',
    platforms: ['meta', 'tiktok'],
    publishDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'published',
    clientName: 'Internal Agency Marketing',
    notes: 'Short-form hook: 3-second split screen showing 100 purchase events in Shopify vs only 68 in Meta Event Manager.',
    tags: ['Reels', 'Conversions API', 'Meta'],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    title: 'Google Ads Performance Max & Search Themes Playbook',
    caption:
      'PMax waste ad spend if you give it generic signals. Our 4-step framework for feeding high-intent first-party audience lists directly into Google Ads audience signals. Read the breakdown 👇',
    platforms: ['google', 'linkedin'],
    publishDate: new Date(Date.now() + 86400000 * 1).toISOString(),
    status: 'scheduled',
    clientName: 'Bounce Growth Thought Leadership',
    notes: 'Carousel PDF slides (10 slides) focusing on negative keyword exclusions and customer match lists.',
    tags: ['Google Ads', 'PMax', 'B2B'],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    title: 'Dhaka E-Commerce Festival Ad Copy Variations (AB Testing)',
    caption:
      'Hook A: "Order your favorite artisanal fits before stocks run dry!"\nHook B: "Flat 25% Off + Same-day delivery across Gulshan & Banani."\nCTA: Shop Collection Now',
    platforms: ['meta', 'tiktok'],
    publishDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    status: 'client_review',
    clientName: 'Aura Lifestyle BD',
    notes: 'Awaiting client approval on creative assets & UGC licensing agreement.',
    tags: ['Seasonal Promo', 'Copywriting', 'E-commerce'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    title: 'GA4 BigQuery Export & Custom SQL Dashboard Showcase',
    caption:
      'Stop paying for costly reporting tools when you have BigQuery. Here is our automated pipeline calculating Customer Lifetime Value (LTV) and 30-day repeat purchase rate.',
    platforms: ['linkedin', 'x', 'youtube'],
    publishDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    status: 'in_creative',
    clientName: 'Bounce Growth Analytics',
    notes: 'In screen recording phase. Video specialist editing 90-sec Loom walkthrough.',
    tags: ['GA4', 'BigQuery', 'Analytics'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    title: 'TikTok Spark Ads Strategy for Bangladeshi Direct-to-Consumer Brands',
    caption:
      'Why creator Spark Ads outperform standard feed ads by 2.4x in ROAS. Breaking down the authentic Bangladeshi creator ecosystem and whitelisting best practices.',
    platforms: ['tiktok', 'meta'],
    publishDate: new Date(Date.now() + 86400000 * 9).toISOString(),
    status: 'idea',
    clientName: 'Internal Agency Marketing',
    notes: 'Idea sparked by client questions last Tuesday. Need to compile top 5 performing UGC hooks.',
    tags: ['TikTok', 'Spark Ads', 'UGC'],
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let isSeeding = false;

/**
 * Real-time listener for content calendar items
 */
export function subscribeContentItems(
  callback: (items: ContentItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty && !isSeeding) {
        isSeeding = true;
        try {
          console.log('[ContentCalendarService] Auto-seeding initial marketing entries...');
          for (let i = 0; i < INITIAL_CONTENT_ITEMS.length; i++) {
            const seed = INITIAL_CONTENT_ITEMS[i];
            const docId = `content_seed_${i + 1}`;
            await setDoc(doc(db, COLLECTION_NAME, docId), {
              id: docId,
              ...seed,
            });
          }
        } catch (seedErr) {
          console.warn('[ContentCalendarService] Auto-seed failed (may lack permissions):', seedErr);
        } finally {
          isSeeding = false;
        }
        return;
      }

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
      console.error('[ContentCalendarService] Snapshot error:', error);
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

  await setDoc(doc(db, COLLECTION_NAME, itemId), item);

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

  await updateDoc(docRef, patchData);

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
