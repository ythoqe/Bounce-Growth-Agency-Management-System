import {
  collection,
  doc,
  setDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { ProjectComment } from '../../types/communication';
import { ProjectCommentSchema } from '../../schemas';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { createNotification } from '../notifications/notificationService';

export async function addProjectComment(
  input: {
    projectId: string;
    clientId: string;
    content: string;
    clientVisible: boolean;
  },
  actor: { uid: string; name?: string; role: 'admin' | 'team' | 'client' }
): Promise<string> {
  const validated = ProjectCommentSchema.parse(input);
  const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const commentRef = doc(db, 'project_comments', commentId);

  const payload: ProjectComment = {
    id: commentId,
    projectId: validated.projectId,
    clientId: validated.clientId,
    authorUid: actor.uid,
    authorName: actor.name || (actor.role === 'client' ? 'Client Representative' : 'Bounce Growth Specialist'),
    authorRole: actor.role,
    content: validated.content,
    clientVisible: actor.role === 'client' ? true : validated.clientVisible,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(commentRef, payload);
    return commentId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `project_comments/${commentId}`);
    throw err;
  }
}

export function subscribeProjectComments(
  projectId: string,
  callback: (comments: ProjectComment[]) => void,
  actor: { uid: string; role: 'admin' | 'team' | 'client'; clientId?: string },
  onError?: (error: Error) => void
): () => void {
  if (!actor.uid || !projectId) {
    callback([]);
    return () => {};
  }

  const commentsRef = collection(db, 'project_comments');
  let q = query(commentsRef, where('projectId', '==', projectId));

  // Security query parity: Clients must only query clientVisible == true
  if (actor.role === 'client') {
    q = query(
      commentsRef,
      where('projectId', '==', projectId),
      where('clientVisible', '==', true)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let comments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ProjectComment[];

      // In-memory security double-guard: Ensure client never sees internal comments
      if (actor.role === 'client') {
        comments = comments.filter((c) => c.clientVisible === true);
      }

      // Sort chronological
      comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(comments);
    },
    (err) => {
      console.error('[subscribeProjectComments error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, `project_comments?proj=${projectId}`);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}
