import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db, auth } from '../firebase/client';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { ClientProfile, ClientInvitation, ClientStatus, ClientInternalNote } from '../../types/client';
import { ClientSchema, ClientInvitationSchema, ClientInternalNotesSchema } from '../../schemas';
import { logAuditEvent } from '../audit/auditService';

const COLLECTION = 'clients';
const NOTES_COLLECTION = 'client_internal_notes';
const INVITATIONS_COLLECTION = 'client_invitations';

/**
 * Real-time Subscription for Clients
 * Restricts Team Members to assignedSpecialists in compliance with security rules.
 */
export function subscribeClients(
  onData: (clients: ClientProfile[]) => void,
  onError: (error: Error) => void,
  options?: { actorRole?: string; actorUid?: string }
) {
  if (!auth?.currentUser) {
    onData([]);
    return () => {};
  }
  let q = query(collection(db, COLLECTION));

  if (options?.actorRole === 'team' && options.actorUid) {
    q = query(q, where('assignedSpecialists', 'array-contains', options.actorUid));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const clients: ClientProfile[] = [];
      snapshot.forEach((d) => {
        clients.push(d.data() as ClientProfile);
      });
      // Sort client-side by createdAt descending
      clients.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onData(clients);
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

export async function getClientById(clientId: string): Promise<ClientProfile | null> {
  const path = `${COLLECTION}/${clientId}`;
  try {
    const snap = await getDoc(doc(db, COLLECTION, clientId));
    if (!snap.exists()) return null;
    return snap.data() as ClientProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Isolated Client Internal Notes (Agency-Only)
 */
export async function getClientInternalNotes(clientId: string): Promise<string> {
  const path = `${NOTES_COLLECTION}/${clientId}`;
  try {
    const snap = await getDoc(doc(db, NOTES_COLLECTION, clientId));
    if (!snap.exists()) return '';
    return snap.data().notes || '';
  } catch (err) {
    console.warn('[getClientInternalNotes warning]', err);
    return '';
  }
}

export async function saveClientInternalNotes(
  clientId: string,
  notes: string,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  const path = `${NOTES_COLLECTION}/${clientId}`;
  try {
    const payload: ClientInternalNote = {
      clientId,
      notes,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.uid,
    };
    await setDoc(doc(db, NOTES_COLLECTION, clientId), payload);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'client_updated',
      entityType: 'client',
      entityId: clientId,
      details: `Updated internal notes in isolated /client_internal_notes collection`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createClient(
  input: Omit<ClientProfile, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'portalAccessUserIds'>,
  actor: { uid: string; email: string; role: string }
): Promise<ClientProfile> {
  // 1. Zod Validation
  const validated = ClientSchema.parse(input);

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Extract internal notes out of the client-facing document
  const { internalNotes, ...cleanData } = validated;

  const newClient: ClientProfile = {
    ...cleanData,
    id: clientId,
    primaryContact: {
      name: validated.contactPerson,
      email: validated.email,
      phone: validated.phone,
      isPrimary: true,
    },
    portalAccessUserIds: [],
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };

  try {
    // Write client document without internalNotes
    await setDoc(doc(db, COLLECTION, clientId), newClient);

    // Save internalNotes to isolated collection if present
    if (internalNotes && internalNotes.trim().length > 0) {
      await saveClientInternalNotes(clientId, internalNotes, actor);
    }

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'client_created',
      entityType: 'client',
      entityId: clientId,
      details: `Created new client: ${newClient.businessName} with status ${newClient.status}`,
    });

    return newClient;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTION}/${clientId}`);
  }
}

export async function updateClient(
  clientId: string,
  input: Partial<ClientProfile>,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  const path = `${COLLECTION}/${clientId}`;
  try {
    // If internalNotes is supplied, route it to isolated collection
    if (input.internalNotes !== undefined) {
      await saveClientInternalNotes(clientId, input.internalNotes, actor);
    }

    // Strip internalNotes from client document update payload
    const { internalNotes, ...cleanUpdate } = input;

    const updatePayload = {
      ...cleanUpdate,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, COLLECTION, clientId), updatePayload);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'client_updated',
      entityType: 'client',
      entityId: clientId,
      details: `Updated client details: ${JSON.stringify(Object.keys(cleanUpdate))}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function archiveClient(
  clientId: string,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  await updateClient(clientId, { status: 'archived' }, actor);
}

export async function restoreClient(
  clientId: string,
  targetStatus: ClientStatus = 'active',
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  await updateClient(clientId, { status: targetStatus }, actor);
}

/**
 * Client Onboarding & Portal Invitation with Expiry & Replay Protection
 */
export async function inviteClientContact(
  params: { clientId: string; clientName: string; contactEmail: string; contactName: string; expiresInDays?: number },
  actor: { uid: string; email: string; role: string }
): Promise<ClientInvitation> {
  const validated = ClientInvitationSchema.parse(params);
  const normalizedEmail = validated.contactEmail.toLowerCase().trim();

  // Check for existing pending invitation to prevent duplicates
  const q = query(
    collection(db, INVITATIONS_COLLECTION),
    where('clientId', '==', validated.clientId),
    where('contactEmail', '==', normalizedEmail),
    where('status', '==', 'pending')
  );
  const existingSnaps = await getDocs(q);
  if (!existingSnaps.empty) {
    return existingSnaps.docs[0].data() as ClientInvitation;
  }

  const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const days = validated.expiresInDays || 7;
  const expiresDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const invitation: ClientInvitation = {
    id: invitationId,
    clientId: validated.clientId,
    clientName: validated.clientName,
    contactEmail: normalizedEmail,
    contactName: validated.contactName,
    role: 'client',
    status: 'pending',
    invitedBy: actor.uid,
    createdAt: now.toISOString(),
    expiresAt: expiresDate.toISOString(),
    expiresAtMillis: expiresDate.getTime(),
  };

  try {
    await setDoc(doc(db, INVITATIONS_COLLECTION, invitationId), invitation);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'client_updated',
      entityType: 'client',
      entityId: validated.clientId,
      details: `Dispatched client portal invitation to ${normalizedEmail} (Expires: ${invitation.expiresAt})`,
    });

    return invitation;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${INVITATIONS_COLLECTION}/${invitationId}`);
  }
}

export function subscribeClientInvitations(
  clientId: string,
  onData: (invitations: ClientInvitation[]) => void,
  onError: (error: Error) => void
) {
  if (!auth?.currentUser) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, INVITATIONS_COLLECTION), where('clientId', '==', clientId));
  return onSnapshot(
    q,
    (snap) => {
      const items: ClientInvitation[] = [];
      snap.forEach((d) => items.push(d.data() as ClientInvitation));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, INVITATIONS_COLLECTION);
      } catch (e: any) {
        onError(e);
      }
    }
  );
}

/**
 * Admin Activates Portal Access for a User UID
 * Atomic Batch: Client portalAccessUserIds + User Profile + Invitation Status all succeed or fail together.
 */
export async function activateClientPortalAccess(
  clientId: string,
  targetUserUid: string,
  invitationId?: string,
  actor?: { uid: string; email: string; role: string }
): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. Add UID to client document's portalAccessUserIds
  const clientRef = doc(db, COLLECTION, clientId);
  batch.update(clientRef, {
    portalAccessUserIds: arrayUnion(targetUserUid),
    updatedAt: now,
  });

  // 2. Update user profile to client role bound to this clientId
  const userRef = doc(db, 'users', targetUserUid);
  batch.update(userRef, {
    role: 'client',
    clientId: clientId,
    status: 'active',
    updatedAt: now,
  });

  // 3. Mark invitation claimed with replay prevention
  if (invitationId) {
    const invRef = doc(db, INVITATIONS_COLLECTION, invitationId);
    batch.update(invRef, {
      status: 'claimed',
      claimedByUid: targetUserUid,
      claimedAt: now,
    });
  }

  // Commit all three mutations atomically
  await batch.commit();

  if (actor) {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'user_role_changed',
      entityType: 'client',
      entityId: clientId,
      details: `Atomic portal activation completed for UID ${targetUserUid}`,
    });
  }
}

/**
 * Safe, Retryable Internal Notes Migration
 * Moves legacy internalNotes on /clients/{clientId} to /client_internal_notes/{clientId}
 */
export async function migrateExistingInternalNotes(actor: { uid: string; email: string; role: string }): Promise<{
  scanned: number;
  migrated: number;
  alreadyClean: number;
  errors: string[];
}> {
  const results = {
    scanned: 0,
    migrated: 0,
    alreadyClean: 0,
    errors: [] as string[],
  };

  try {
    const snapshot = await getDocs(collection(db, COLLECTION));
    results.scanned = snapshot.size;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const legacyNote = data.internalNotes;

      if (legacyNote && typeof legacyNote === 'string' && legacyNote.trim().length > 0) {
        try {
          // 1. Write to isolated collection
          await setDoc(doc(db, NOTES_COLLECTION, docSnap.id), {
            clientId: docSnap.id,
            notes: legacyNote,
            updatedAt: new Date().toISOString(),
            updatedBy: actor.uid,
          });

          // 2. Verify write succeeded
          const verifySnap = await getDoc(doc(db, NOTES_COLLECTION, docSnap.id));
          if (!verifySnap.exists() || verifySnap.data().notes !== legacyNote) {
            throw new Error(`Write verification failed for client ${docSnap.id}`);
          }

          // 3. Only after verification, remove field from client-facing document
          await updateDoc(doc(db, COLLECTION, docSnap.id), {
            internalNotes: deleteField(),
          });

          results.migrated++;
        } catch (itemErr: any) {
          results.errors.push(`Client ${docSnap.id}: ${itemErr.message}`);
        }
      } else {
        results.alreadyClean++;
      }
    }

    if (results.migrated > 0) {
      await logAuditEvent({
        actorUserId: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'client_updated',
        entityType: 'client',
        entityId: 'migration_internal_notes',
        details: `Migrated ${results.migrated} legacy internal notes to isolated collection`,
      });
    }

    return results;
  } catch (err: any) {
    results.errors.push(`Global migration error: ${err.message}`);
    return results;
  }
}
