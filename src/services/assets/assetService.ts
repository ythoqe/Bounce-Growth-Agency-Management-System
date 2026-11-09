import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../firebase/client';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { TrackingAsset, TrackingAssetType } from '../../types/asset';
import { TrackingAssetSchema } from '../../schemas';
import { logAuditEvent } from '../audit/auditService';

const COLLECTION = 'assets';

export function subscribeAssets(
  onData: (assets: TrackingAsset[]) => void,
  onError: (error: Error) => void,
  options?: { clientId?: string; accessLevel?: 'admin_only' | 'shared_with_client' }
) {
  if (!auth?.currentUser) {
    onData([]);
    return () => {};
  }
  let q = query(collection(db, COLLECTION));

  if (options?.clientId) {
    q = query(q, where('clientId', '==', options.clientId));
  }
  if (options?.accessLevel) {
    q = query(q, where('accessLevel', '==', options.accessLevel));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const items: TrackingAsset[] = [];
      snapshot.forEach((d) => {
        items.push(d.data() as TrackingAsset);
      });
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, COLLECTION);
      } catch (e: any) {
        onError(e);
      }
    }
  );
}

export async function getAssetById(assetId: string): Promise<TrackingAsset | null> {
  const path = `${COLLECTION}/${assetId}`;
  try {
    const snap = await getDoc(doc(db, COLLECTION, assetId));
    if (!snap.exists()) return null;
    return snap.data() as TrackingAsset;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createTrackingAsset(
  input: Omit<TrackingAsset, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  actor: { uid: string; email: string; role: string }
): Promise<TrackingAsset> {
  const validated = TrackingAssetSchema.parse(input);

  const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newAsset: TrackingAsset = {
    ...validated,
    id: assetId,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };

  try {
    await setDoc(doc(db, COLLECTION, assetId), newAsset);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'asset_modified',
      entityType: 'asset',
      entityId: assetId,
      details: `Created tracking asset '${newAsset.name}' (${newAsset.assetType}) for ${newAsset.clientName}`,
    });

    return newAsset;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTION}/${assetId}`);
  }
}

export async function updateTrackingAsset(
  assetId: string,
  input: Partial<TrackingAsset>,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  const path = `${COLLECTION}/${assetId}`;
  try {
    const payload = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, COLLECTION, assetId), payload);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'asset_modified',
      entityType: 'asset',
      entityId: assetId,
      details: `Updated tracking asset properties: ${Object.keys(input).join(', ')}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function archiveTrackingAsset(
  assetId: string,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  await updateTrackingAsset(assetId, { status: 'archived' }, actor);
}

export async function restoreTrackingAsset(
  assetId: string,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  await updateTrackingAsset(assetId, { status: 'active' }, actor);
}

/**
 * Permanently delete a tracking asset document
 */
export async function deleteTrackingAsset(
  assetId: string,
  assetName: string,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  const path = `${COLLECTION}/${assetId}`;
  try {
    const docRef = doc(db, COLLECTION, assetId);
    await deleteDoc(docRef);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'asset_deleted',
      entityType: 'asset',
      entityId: assetId,
      details: `Permanently deleted tracking asset "${assetName}"`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

