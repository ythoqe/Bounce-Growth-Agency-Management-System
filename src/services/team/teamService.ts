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
  TeamMember,
  CreateTeamMemberInput,
  UpdateTeamMemberInput,
} from '../../types/team';
import { logAuditEvent } from '../audit/auditService';
import { stripUndefined } from '../../utils/cleanFirestore';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';

const COLLECTION_NAME = 'team_members';

/**
 * Real-time subscription to team specialists in Firestore
 */
export function subscribeTeamMembers(
  callback: (members: TeamMember[]) => void,
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
      const members: TeamMember[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        members.push({
          id: docSnap.id,
          userId: data.userId || undefined,
          name: data.name || 'Specialist',
          email: data.email || '',
          role: data.role || 'team',
          status: data.status || 'active',
          title: data.title || 'Agency Specialist',
          department: data.department || 'Tracking & Attribution',
          skills: Array.isArray(data.skills) ? data.skills : [],
          assignedClients: Array.isArray(data.assignedClients) ? data.assignedClients : [],
          assignedClientNames: Array.isArray(data.assignedClientNames) ? data.assignedClientNames : [],
          phone: data.phone || undefined,
          joinedAt: data.joinedAt || data.createdAt || new Date().toISOString(),
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Sort by joinedAt descending
      members.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(members);
    },
    (error) => {
      console.warn('[TeamService] Subscription note:', error?.message || error);
      callback([]);
      if (onError) onError(error);
    }
  );
}

/**
 * Create a new team specialist record in Firestore
 */
export async function createTeamMember(
  input: CreateTeamMemberInput,
  actor: { uid: string; email?: string | null; role: string; name?: string }
): Promise<TeamMember> {
  if (actor.role !== 'admin') {
    throw new Error('Only an agency administrator can invite or add team specialists.');
  }

  const memberId = `member_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newMember: TeamMember = {
    id: memberId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: input.status || 'active',
    title: input.title.trim(),
    department: input.department.trim(),
    skills: input.skills.filter((s) => s.trim().length > 0),
    assignedClients: input.assignedClients || [],
    assignedClientNames: input.assignedClientNames || [],
    phone: input.phone?.trim() || undefined,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, COLLECTION_NAME, memberId), stripUndefined(newMember));

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'admin@bouncegrowth.agency',
      actorRole: 'admin',
      action: 'user_created',
      entityType: 'user',
      entityId: memberId,
      details: `Added team specialist "${newMember.name}" (${newMember.title}) with role "${newMember.role}"`,
      status: 'success',
    });

    return newMember;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${memberId}`);
    throw err;
  }
}

/**
 * Update an existing team specialist record
 */
export async function updateTeamMember(
  memberId: string,
  updates: UpdateTeamMemberInput,
  actor: { uid: string; email?: string | null; role: string; name?: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only an agency administrator can modify specialist profiles.');
  }

  const docRef = doc(db, COLLECTION_NAME, memberId);
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    ...updates,
    updatedAt: now,
  };

  if (updates.email) {
    patch.email = updates.email.trim().toLowerCase();
  }
  if (updates.name) {
    patch.name = updates.name.trim();
  }
  if (updates.title) {
    patch.title = updates.title.trim();
  }
  if (updates.department) {
    patch.department = updates.department.trim();
  }
  if (updates.skills) {
    patch.skills = updates.skills.filter((s) => s.trim().length > 0);
  }

  try {
    await updateDoc(docRef, stripUndefined(patch));

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'admin@bouncegrowth.agency',
      actorRole: 'admin',
      action: 'user_role_changed',
      entityType: 'user',
      entityId: memberId,
      details: `Updated specialist "${updates.name || memberId}" credentials/role`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${memberId}`);
    throw err;
  }
}

/**
 * Delete a team specialist from Firestore
 */
export async function deleteTeamMember(
  memberId: string,
  memberName: string,
  actor: { uid: string; email?: string | null; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only an agency administrator can remove specialists.');
  }

  const docRef = doc(db, COLLECTION_NAME, memberId);

  try {
    await deleteDoc(docRef);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'admin@bouncegrowth.agency',
      actorRole: 'admin',
      action: 'user_deleted',
      entityType: 'user',
      entityId: memberId,
      details: `Removed team member "${memberName}" (${memberId})`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_NAME}/${memberId}`);
    throw err;
  }
}
