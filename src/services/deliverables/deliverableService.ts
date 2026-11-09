import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { Deliverable, DeliverableVersion, DeliverableStatus } from '../../types/deliverable';
import { DeliverableSchema, DeliverableReviewSchema } from '../../schemas';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { logAuditEvent } from '../audit/auditService';
import { createNotification } from '../notifications/notificationService';
import { stripUndefined } from '../../utils/cleanFirestore';

export interface CreateDeliverableInput {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  externalUrl?: string;
  status?: DeliverableStatus;
}

export async function createDeliverable(
  input: CreateDeliverableInput,
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client'; name?: string }
): Promise<string> {
  const validated = DeliverableSchema.parse(input);
  const deliverableId = `deliv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const versionId = `ver_${deliverableId}_1`;

  const now = new Date().toISOString();
  const deliverableRef = doc(db, 'deliverables', deliverableId);
  const versionRef = doc(db, 'deliverable_versions', versionId);
  const taskRef = doc(db, 'tasks', validated.taskId);

  const deliverablePayload: Deliverable = {
    id: deliverableId,
    taskId: validated.taskId,
    taskTitle: validated.taskTitle,
    projectId: validated.projectId,
    projectName: validated.projectName,
    clientId: validated.clientId,
    clientName: validated.clientName,
    title: validated.title,
    description: validated.description,
    externalUrl: validated.externalUrl || '',
    submittedBy: actor.uid,
    submittedByName: actor.name || 'Bounce Growth Specialist',
    submittedAt: now,
    version: 1,
    status: validated.status || 'submitted',
    createdAt: now,
    updatedAt: now,
  };

  const versionPayload: DeliverableVersion = {
    id: versionId,
    deliverableId,
    versionNumber: 1,
    title: validated.title,
    description: validated.description,
    externalUrl: validated.externalUrl || '',
    submittedBy: actor.uid,
    submittedByName: actor.name || 'Bounce Growth Specialist',
    submittedAt: now,
    status: validated.status || 'submitted',
  };

  try {
    const batch = writeBatch(db);
    batch.set(deliverableRef, deliverablePayload);
    batch.set(versionRef, versionPayload);

    // Update parent task to in_review
    batch.update(taskRef, {
      status: 'in_review',
      updatedAt: now,
    });

    await batch.commit();

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'staff@bouncegrowth.com',
      actorRole: actor.role as 'admin' | 'team',
      action: 'deliverable_submitted',
      entityType: 'deliverable',
      entityId: deliverableId,
      details: `Submitted deliverable v1: "${validated.title}" for ${validated.clientName}`,
      status: 'success',
    });

    // Notify client portal users
    try {
      const clientDoc = await getDoc(doc(db, 'clients', validated.clientId));
      if (clientDoc.exists()) {
        const portalUsers = (clientDoc.data().portalAccessUserIds as string[]) || [];
        for (const recipientUid of portalUsers) {
          await createNotification({
            recipientUid,
            type: 'deliverable_submitted',
            title: 'New Deliverable Awaiting Review',
            message: `Bounce Growth submitted: ${validated.title} (${validated.projectName})`,
            relatedEntityType: 'deliverable',
            relatedEntityId: deliverableId,
            read: false,
            createdAt: now,
          });
        }
      }
    } catch (notifErr) {
      console.warn('Failed to notify client users:', notifErr);
    }

    return deliverableId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `deliverables/${deliverableId}`);
    throw err;
  }
}

export async function submitDeliverableRevision(
  deliverableId: string,
  input: { title: string; description: string; externalUrl?: string },
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client'; name?: string }
): Promise<number> {
  const deliverableRef = doc(db, 'deliverables', deliverableId);
  const snap = await getDoc(deliverableRef);
  if (!snap.exists()) {
    throw new Error('Deliverable not found');
  }

  const existing = snap.data() as Deliverable;
  const newVersion = (existing.version || 1) + 1;
  const versionId = `ver_${deliverableId}_${newVersion}`;
  const versionRef = doc(db, 'deliverable_versions', versionId);
  const now = new Date().toISOString();

  const versionPayload: DeliverableVersion = {
    id: versionId,
    deliverableId,
    versionNumber: newVersion,
    title: input.title,
    description: input.description,
    externalUrl: input.externalUrl || '',
    submittedBy: actor.uid,
    submittedByName: actor.name || 'Bounce Growth Specialist',
    submittedAt: now,
    status: 'submitted',
  };

  try {
    const batch = writeBatch(db);
    batch.set(versionRef, versionPayload);
    batch.update(deliverableRef, {
      title: input.title,
      description: input.description,
      externalUrl: input.externalUrl || '',
      submittedBy: actor.uid,
      submittedByName: actor.name || 'Bounce Growth Specialist',
      submittedAt: now,
      version: newVersion,
      status: 'submitted',
      reviewNotes: '', // Reset feedback for new version
      reviewedBy: '',
      reviewedByName: '',
      reviewedAt: '',
      updatedAt: now,
    });

    await batch.commit();

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'staff@bouncegrowth.com',
      actorRole: actor.role as 'admin' | 'team',
      action: 'deliverable_submitted',
      entityType: 'deliverable',
      entityId: deliverableId,
      details: `Submitted revision v${newVersion} for "${input.title}"`,
      status: 'success',
    });

    return newVersion;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `deliverables/${deliverableId}`);
    throw err;
  }
}

export async function reviewDeliverable(
  deliverableId: string,
  review: { decision: 'approved' | 'revision_requested' | 'rejected'; reviewNotes?: string },
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client'; name?: string }
): Promise<void> {
  const validated = DeliverableReviewSchema.parse(review);
  const deliverableRef = doc(db, 'deliverables', deliverableId);
  const snap = await getDoc(deliverableRef);
  if (!snap.exists()) {
    throw new Error('Deliverable not found');
  }

  const deliverable = snap.data() as Deliverable;
  const now = new Date().toISOString();

  const batch = writeBatch(db);

  // Update Deliverable status & review metadata
  batch.update(deliverableRef, {
    status: validated.decision,
    reviewNotes: validated.reviewNotes || '',
    reviewedBy: actor.uid,
    reviewedByName: actor.name || 'Client Representative',
    reviewedAt: now,
    updatedAt: now,
  });

  // If approved, update linked task to completed
  if (validated.decision === 'approved') {
    const taskRef = doc(db, 'tasks', deliverable.taskId);
    batch.update(taskRef, {
      status: 'completed',
      progressPercentage: 100,
      completedAt: now,
      updatedAt: now,
    });
  } else if (validated.decision === 'revision_requested') {
    const taskRef = doc(db, 'tasks', deliverable.taskId);
    batch.update(taskRef, {
      status: 'in_progress',
      updatedAt: now,
    });
  }

  try {
    await batch.commit();

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'client@portal.com',
      actorRole: actor.role === 'client' ? 'team' : 'admin', // Audit rule compatibility
      action: 'deliverable_reviewed',
      entityType: 'deliverable',
      entityId: deliverableId,
      details: `Client decision: ${validated.decision} for "${deliverable.title}"`,
      status: 'success',
    });

    // Notify deliverable author
    if (deliverable.submittedBy) {
      await createNotification({
        recipientUid: deliverable.submittedBy,
        type: validated.decision === 'approved' ? 'deliverable_approved' : 'revision_requested',
        title: validated.decision === 'approved' ? 'Deliverable Approved!' : 'Revision Requested',
        message: `${deliverable.clientName} ${
          validated.decision === 'approved' ? 'approved' : 'requested revisions on'
        }: "${deliverable.title}"${validated.reviewNotes ? ` - Reason: ${validated.reviewNotes}` : ''}`,
        relatedEntityType: 'deliverable',
        relatedEntityId: deliverableId,
        read: false,
        createdAt: now,
      }).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `deliverables/${deliverableId}`);
    throw err;
  }
}

export function subscribeDeliverables(
  filters: { clientId?: string; projectId?: string; status?: string },
  callback: (deliverables: Deliverable[]) => void,
  actor: { uid?: string; id?: string; role: 'admin' | 'team' | 'client'; clientId?: string },
  onError?: (error: Error) => void
): () => void {
  const actorUid = actor.uid || actor.id;
  if (!actorUid) {
    callback([]);
    return () => {};
  }

  const deliverablesRef = collection(db, 'deliverables');
  let q = query(deliverablesRef);

  if (actor.role === 'client') {
    if (!actor.clientId) {
      callback([]);
      return () => {};
    }
    q = query(deliverablesRef, where('clientId', '==', actor.clientId));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Deliverable[];

      if (actor.role === 'client') {
        items = items.filter((d) => d.status !== 'draft');
      }

      if (filters.clientId && filters.clientId !== 'all') {
        items = items.filter((d) => d.clientId === filters.clientId);
      }
      if (filters.projectId && filters.projectId !== 'all') {
        items = items.filter((d) => d.projectId === filters.projectId);
      }
      if (filters.status && filters.status !== 'all') {
        items = items.filter((d) => d.status === filters.status);
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (err) => {
      console.error('[subscribeDeliverables error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'deliverables');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function getDeliverableVersions(deliverableId: string): Promise<DeliverableVersion[]> {
  const versionsRef = collection(db, 'deliverable_versions');
  const q = query(versionsRef, where('deliverableId', '==', deliverableId));
  try {
    const snap = await getDocs(q);
    const versions = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as DeliverableVersion[];

    versions.sort((a, b) => b.versionNumber - a.versionNumber);
    return versions;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `deliverable_versions?deliv=${deliverableId}`);
    return [];
  }
}

/**
 * Update an existing report/deliverable
 */
export async function updateDeliverable(
  deliverableId: string,
  updates: Partial<Pick<Deliverable, 'title' | 'description' | 'externalUrl' | 'status'>>,
  actor: { uid: string; email?: string | null; role: string; name?: string }
): Promise<void> {
  const docRef = doc(db, 'deliverables', deliverableId);
  const now = new Date().toISOString();

  try {
    await updateDoc(
      docRef,
      stripUndefined({
        ...updates,
        updatedAt: now,
      })
    );

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role as 'admin' | 'team',
      action: 'deliverable_updated',
      entityType: 'deliverable',
      entityId: deliverableId,
      details: `Updated report/deliverable "${updates.title || deliverableId}"`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `deliverables/${deliverableId}`);
    throw err;
  }
}

/**
 * Delete a report/deliverable from Firestore
 */
export async function deleteDeliverable(
  deliverableId: string,
  title: string,
  actor: { uid: string; email?: string | null; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only an agency administrator can delete published reports.');
  }

  const docRef = doc(db, 'deliverables', deliverableId);

  try {
    await deleteDoc(docRef);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'admin@bouncegrowth.agency',
      actorRole: 'admin',
      action: 'deliverable_deleted',
      entityType: 'deliverable',
      entityId: deliverableId,
      details: `Deleted report "${title}" (${deliverableId})`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `deliverables/${deliverableId}`);
    throw err;
  }
}
