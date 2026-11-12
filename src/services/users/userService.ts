import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase/client';
import { UserProfile } from '../../types/user';
import { activateClientPortalAccess } from '../clients/clientService';
import { logAuditEvent } from '../audit/auditService';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';

const USERS_COLLECTION = 'users';

/**
 * Subscribe to all pending client users awaiting authorization or organization assignment
 */
export function subscribePendingUsers(
  callback: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!auth?.currentUser) {
    callback([]);
    return () => {};
  }

  const colRef = collection(db, USERS_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const pending: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        // Identify users that need admin approval or organization linking
        const isPending =
          data.role === 'client' &&
          (data.status === 'invited' || !data.clientId || (data.status as string) === 'pending');

        if (isPending) {
          pending.push({
            ...data,
            id: docSnap.id,
          });
        }
      });

      // Sort newest first
      pending.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(pending);
    },
    (err) => {
      console.warn('[UserService] Subscription note:', err?.message || err);
      callback([]);
      if (onError) onError(err);
    }
  );
}

/**
 * 1-Click Approve and Link Client to Workspace
 */
export async function approveAndLinkClient(
  targetUserUid: string,
  clientId: string,
  actor: { uid: string; email: string; role: string; name?: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only agency administrators can approve client accounts.');
  }

  // Atomically update user profile, client organization portalAccessUserIds, and any pending invitations
  await activateClientPortalAccess(clientId, targetUserUid, undefined, actor);
}

/**
 * Reject or Suspend a pending user registration
 */
export async function rejectPendingUser(
  targetUserUid: string,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only agency administrators can reject client registrations.');
  }

  const userRef = doc(db, USERS_COLLECTION, targetUserUid);

  try {
    await updateDoc(userRef, {
      status: 'suspended',
      updatedAt: new Date().toISOString(),
    });

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'user_role_changed',
      entityType: 'user',
      entityId: targetUserUid,
      details: `Suspended / rejected pending client user ${targetUserUid}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${USERS_COLLECTION}/${targetUserUid}`);
    throw err;
  }
}
