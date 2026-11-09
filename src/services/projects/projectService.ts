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
import { Project, ProjectStatus } from '../../types/project';
import { ProjectSchema } from '../../schemas';
import { logAuditEvent } from '../audit/auditService';
import { stripUndefined } from '../../utils/cleanFirestore';

const COLLECTION = 'projects';

export function subscribeProjects(
  onData: (projects: Project[]) => void,
  onError: (error: Error) => void,
  options?: { clientId?: string; clientVisibleOnly?: boolean; actorRole?: string; actorUid?: string }
) {
  if (!auth?.currentUser) {
    onData([]);
    return () => {};
  }
  let q = query(collection(db, COLLECTION));

  if (options?.clientId) {
    q = query(q, where('clientId', '==', options.clientId));
  }
  if (options?.clientVisibleOnly) {
    q = query(q, where('clientVisible', '==', true));
  }
  if (options?.actorRole === 'team' && options.actorUid) {
    q = query(q, where('assignedTeamMembers', 'array-contains', options.actorUid));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Project[] = [];
      snapshot.forEach((d) => {
        items.push(d.data() as Project);
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

export async function getProjectById(projectId: string): Promise<Project | null> {
  const path = `${COLLECTION}/${projectId}`;
  try {
    const snap = await getDoc(doc(db, COLLECTION, projectId));
    if (!snap.exists()) return null;
    return snap.data() as Project;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createProject(
  input: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  actor: { uid: string; email: string; role: string }
): Promise<Project> {
  const validated = ProjectSchema.parse(input);

  const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newProject: Project = {
    ...validated,
    id: projectId,
    assignedTeamMembers: validated.assignedTeamMembers || [],
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };

  try {
    await setDoc(doc(db, COLLECTION, projectId), stripUndefined(newProject));

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'project_status_changed',
      entityType: 'project',
      entityId: projectId,
      details: `Created project '${newProject.name}' for client ${newProject.clientName}`,
    });

    return newProject;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTION}/${projectId}`);
  }
}

export async function updateProject(
  projectId: string,
  input: Partial<Project>,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  const path = `${COLLECTION}/${projectId}`;
  try {
    const payload = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, COLLECTION, projectId), stripUndefined(payload));

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'project_status_changed',
      entityType: 'project',
      entityId: projectId,
      details: `Updated project properties: ${Object.keys(input).join(', ')}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function archiveProject(
  projectId: string,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  await updateProject(projectId, { status: 'archived' }, actor);
}

export async function restoreProject(
  projectId: string,
  targetStatus: ProjectStatus = 'active',
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  await updateProject(projectId, { status: targetStatus }, actor);
}

/**
 * Permanently delete a project from Firestore
 */
export async function deleteProject(
  projectId: string,
  projectName: string,
  actor: { uid: string; email: string; role: string }
): Promise<void> {
  const path = `${COLLECTION}/${projectId}`;
  try {
    const docRef = doc(db, COLLECTION, projectId);
    await deleteDoc(docRef);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'project_deleted',
      entityType: 'project',
      entityId: projectId,
      details: `Permanently deleted project "${projectName}"`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

