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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { Task, TaskFilter } from '../../types/task';
import { TaskSchema } from '../../schemas';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { logAuditEvent } from '../audit/auditService';
import { createNotification } from '../notifications/notificationService';

export async function createTask(
  data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client'; name?: string }
): Promise<string> {
  const validated = TaskSchema.parse(data);
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const taskRef = doc(db, 'tasks', taskId);

  const payload = {
    ...validated,
    id: taskId,
    createdBy: actor.uid,
    createdByName: actor.name || 'Team Specialist',
    progressPercentage: validated.progressPercentage ?? 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(taskRef, payload);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'specialist@bouncegrowth.com',
      actorRole: actor.role as 'admin' | 'team',
      action: 'task_created',
      entityType: 'task',
      entityId: taskId,
      details: `Created task "${validated.title}" for project "${validated.projectName}"`,
      status: 'success',
    });

    // Notify assigned team members
    for (const memberUid of validated.assignedTeamMembers) {
      if (memberUid !== actor.uid) {
        await createNotification({
          recipientUid: memberUid,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `You were assigned to: ${validated.title} (${validated.projectName})`,
          relatedEntityType: 'task',
          relatedEntityId: taskId,
          read: false,
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    return taskId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    throw err;
  }
}

export async function updateTask(
  taskId: string,
  updates: Partial<Task>,
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client'; name?: string }
): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);

  try {
    const updatePayload: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.status === 'completed' && !updates.completedAt) {
      updatePayload.completedAt = new Date().toISOString();
      updatePayload.progressPercentage = 100;
    }

    await updateDoc(taskRef, updatePayload);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'staff@bouncegrowth.com',
      actorRole: actor.role as 'admin' | 'team',
      action: 'task_updated',
      entityType: 'task',
      entityId: taskId,
      details: `Updated task ${taskId} (status: ${updates.status || 'unchanged'})`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    throw err;
  }
}

export async function archiveTask(
  taskId: string,
  isArchived: boolean,
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client' }
): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  try {
    await updateDoc(taskRef, {
      isArchived,
      updatedAt: new Date().toISOString(),
    });

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'staff@bouncegrowth.com',
      actorRole: actor.role as 'admin' | 'team',
      action: 'task_updated',
      entityType: 'task',
      entityId: taskId,
      details: `${isArchived ? 'Archived' : 'Restored'} task ${taskId}`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
    throw err;
  }
}

export async function deleteTask(
  taskId: string,
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client' }
): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  try {
    await deleteDoc(taskRef);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: actor.role as 'admin' | 'team',
      action: 'task_deleted',
      entityType: 'task',
      entityId: taskId,
      details: `Deleted task record ${taskId}`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
    throw err;
  }
}

export async function getTask(
  taskId: string,
  actor: { uid: string; role: string; clientId?: string }
): Promise<Task | null> {
  const taskRef = doc(db, 'tasks', taskId);
  try {
    const snap = await getDoc(taskRef);
    if (!snap.exists()) return null;
    return snap.data() as Task;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `tasks/${taskId}`);
    return null;
  }
}

export function subscribeTasks(
  filters: TaskFilter,
  callback: (tasks: Task[]) => void,
  actor: { uid: string; role: 'admin' | 'team' | 'client'; clientId?: string },
  onError?: (error: Error) => void
): () => void {
  if (!actor.uid) {
    callback([]);
    return () => {};
  }

  const tasksRef = collection(db, 'tasks');
  let q = query(tasksRef);

  // Security Query Parity
  if (actor.role === 'team') {
    q = query(tasksRef, where('assignedTeamMembers', 'array-contains', actor.uid));
  } else if (actor.role === 'client') {
    if (!actor.clientId) {
      callback([]);
      return () => {};
    }
    q = query(
      tasksRef,
      where('clientId', '==', actor.clientId),
      where('clientVisible', '==', true)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let tasks = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Task[];

      // Client-side filtering
      if (!filters.includeArchived) {
        tasks = tasks.filter((t) => !t.isArchived);
      }
      if (filters.clientId && filters.clientId !== 'all') {
        tasks = tasks.filter((t) => t.clientId === filters.clientId);
      }
      if (filters.projectId && filters.projectId !== 'all') {
        tasks = tasks.filter((t) => t.projectId === filters.projectId);
      }
      if (filters.status && filters.status !== 'all') {
        tasks = tasks.filter((t) => t.status === filters.status);
      }
      if (filters.priority && filters.priority !== 'all') {
        tasks = tasks.filter((t) => t.priority === filters.priority);
      }
      if (filters.searchQuery) {
        const queryLower = filters.searchQuery.toLowerCase();
        tasks = tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(queryLower) ||
            t.description.toLowerCase().includes(queryLower) ||
            t.clientName.toLowerCase().includes(queryLower) ||
            t.projectName.toLowerCase().includes(queryLower)
        );
      }

      // Sort by creation date descending
      tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      callback(tasks);
    },
    (err) => {
      console.error('[subscribeTasks error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'tasks');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}
