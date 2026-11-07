import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { AppNotification } from '../../types/communication';
import { AppNotificationSchema } from '../../schemas';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';

export async function createNotification(
  data: Omit<AppNotification, 'id'>
): Promise<string> {
  const validated = AppNotificationSchema.parse(data);
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const notifRef = doc(db, 'notifications', notificationId);

  const payload: AppNotification = {
    ...validated,
    id: notificationId,
    createdAt: data.createdAt || new Date().toISOString(),
  };

  try {
    await setDoc(notifRef, payload);
    return notificationId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notifications/${notificationId}`);
    throw err;
  }
}

export function subscribeMyNotifications(
  userUid: string,
  callback: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!auth?.currentUser || !userUid) {
    callback([]);
    return () => {};
  }

  const notifsRef = collection(db, 'notifications');
  const q = query(notifsRef, where('recipientUid', '==', userUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as AppNotification[];

      // Sort by newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (err) => {
      console.error('[subscribeMyNotifications error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notifRef = doc(db, 'notifications', notificationId);
  try {
    await updateDoc(notifRef, { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notifications/${notificationId}`);
    throw err;
  }
}

export async function markAllNotificationsAsRead(userUid: string): Promise<void> {
  if (!userUid) return;
  const notifsRef = collection(db, 'notifications');
  const q = query(notifsRef, where('recipientUid', '==', userUid), where('read', '==', false));

  try {
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'notifications/batch_read');
  }
}
