import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase/client';

export interface CleanupResult {
  deletedCount: number;
  collectionsCleaned: Record<string, number>;
  success: boolean;
  message: string;
}

const DEMO_CLIENT_IDS = [
  'client_apex_01',
  'client_aura_02',
  'client_bengal_03',
  'client_dhaka_04',
  'client_artisan_05',
  'client_shwapno_06',
];

/**
 * Permanently purge all demo, seed, and sample data from Cloud Firestore.
 */
export async function purgeAllDemoData(): Promise<CleanupResult> {
  if (!auth?.currentUser) {
    return {
      deletedCount: 0,
      collectionsCleaned: {},
      success: false,
      message: 'Authentication required: Sign in with Google as admin to purge demo data.',
    };
  }

  const collectionsCleaned: Record<string, number> = {};
  let totalDeleted = 0;

  const collectionsToClean = [
    {
      name: 'invoices',
      isDemo: (d: any) =>
        d.id.startsWith('inv_seed') ||
        d.id.startsWith('seed_') ||
        DEMO_CLIENT_IDS.includes(d.data()?.clientId),
    },
    {
      name: 'payments',
      isDemo: (d: any) =>
        d.id.startsWith('pay_seed') ||
        d.id.startsWith('seed_') ||
        DEMO_CLIENT_IDS.includes(d.data()?.clientId),
    },
    {
      name: 'expenses',
      isDemo: (d: any) =>
        d.id.startsWith('exp_seed') ||
        d.id.startsWith('seed_'),
    },
    {
      name: 'clients',
      isDemo: (d: any) =>
        DEMO_CLIENT_IDS.includes(d.id) ||
        d.id.startsWith('seed_') ||
        d.id.startsWith('client_seed_'),
    },
    {
      name: 'content_items',
      isDemo: (d: any) =>
        d.id.startsWith('content_seed_') ||
        d.id.startsWith('seed_'),
    },
    {
      name: 'projectFiles',
      isDemo: (d: any) =>
        d.id.startsWith('file_seed_') ||
        d.id.startsWith('seed_'),
    },
  ];

  for (const col of collectionsToClean) {
    try {
      const snap = await getDocs(collection(db, col.name));
      let colDeleted = 0;
      for (const docSnap of snap.docs) {
        if (col.isDemo(docSnap)) {
          await deleteDoc(doc(db, col.name, docSnap.id));
          colDeleted++;
          totalDeleted++;
        }
      }
      collectionsCleaned[col.name] = colDeleted;
    } catch (err) {
      console.warn(`[Cleanup] Error scanning collection ${col.name}:`, err);
    }
  }

  return {
    deletedCount: totalDeleted,
    collectionsCleaned,
    success: true,
    message: `Successfully removed ${totalDeleted} demo records from Cloud Firestore.`,
  };
}
