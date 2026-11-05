import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../../firebase-applet-config.json';

export interface FirebaseConfigStatus {
  isConfigured: boolean;
  projectId: string;
  authDomain: string;
  databaseId: string;
  storageBucket: string;
  connected?: boolean;
}

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRITICAL: Must pass databaseId from config
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

export const firebaseStatus: FirebaseConfigStatus = {
  isConfigured: true,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  databaseId: firebaseConfig.firestoreDatabaseId,
  storageBucket: firebaseConfig.storageBucket,
  connected: true,
};

/**
 * Validate Connection to Cloud Firestore on boot
 */
export async function testConnection(): Promise<boolean> {
  try {
    const testDoc = await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase Firestore] Live server connectivity verified. Exists:', testDoc.exists());
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('[Firebase Firestore] Client appears offline. Check network or config.');
    } else {
      console.log('[Firebase Firestore] Connectivity test response:', error);
    }
    return false;
  }
}

// Initial connectivity test
testConnection();
