import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, auth } from '../firebase/client';
import { ServicePackage, AgencyServiceItem, ServiceBillingType } from '../../types/service';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { logAuditEvent } from '../audit/auditService';
import { stripUndefined } from '../../utils/cleanFirestore';

const PACKAGES_COLLECTION = 'service_packages';
const SERVICES_COLLECTION = 'services';

// ---------------------------------------------------------------------------
// Agency Default Packages Requested by User
// ---------------------------------------------------------------------------
export const DEFAULT_AGENCY_PACKAGES: Array<Omit<ServicePackage, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Tracking Foundation',
    description: 'Complete first-party tracking setup with server-side CAPI and data deduplication for clean attribution.',
    priceMin: 5000,
    priceMax: 8000,
    priceRange: '৳5,000 - ৳8,000',
    currency: 'BDT',
    billingType: 'one_time',
    category: 'Server-Side Tracking & CAPI',
    features: [
      'GTM Web & Server-Side Container Setup (Stape / Cloud Run)',
      'Meta Conversions API (CAPI) with 100% event deduplication',
      'First-party cookie recovery & custom domain routing',
      'GA4 standard & e-commerce event telemetry (ViewItem, AddToCart, Purchase)',
      'Event Match Quality (EMQ) score optimization to 8.0+',
    ],
    isActive: true,
    linkedProjectIds: [],
    sortOrder: 1,
  },
  {
    name: 'Performance Growth',
    description: 'Full-funnel media buying, dynamic catalog ads, and weekly creative scaling sprints for e-commerce brands.',
    priceMin: 12000,
    priceMax: 18000,
    priceRange: '৳12,000 - ৳18,000',
    currency: 'BDT',
    billingType: 'monthly_retainer',
    category: 'Paid Media & Scaling',
    features: [
      'Full-funnel Meta & Google Ads campaign strategy & execution',
      'Catalog & Dynamic Product Ads (DPA) structure',
      'Scaling budget pacing & algorithmic bid strategy calibration',
      'Creative fatigue monitoring & weekly sprint testing',
      'Dedicated media buyer & weekly live performance check-ins',
    ],
    isActive: true,
    linkedProjectIds: [],
    sortOrder: 2,
  },
  {
    name: 'Analytics & Growth Partner',
    description: 'All-in-one growth partnership with custom multi-touch attribution dashboards and CRO checkout optimization.',
    priceMin: 20000,
    priceMax: 30000,
    priceRange: '৳20,000 - ৳30,000',
    currency: 'BDT',
    billingType: 'monthly_retainer',
    category: 'Full-Funnel Growth Partnership',
    features: [
      'Everything in Tracking Foundation & Performance Growth',
      'Custom interactive Looker Studio executive attribution dashboard',
      'Conversion Rate Optimization (CRO) checkout funnel heuristic audit',
      'Senior Growth Strategist advisory & direct Slack connect channel',
      'Bi-weekly experiment sprints and full multi-channel attribution',
    ],
    isActive: true,
    linkedProjectIds: [],
    sortOrder: 3,
  },
];

export const DEFAULT_INDIVIDUAL_SERVICES: Array<Omit<AgencyServiceItem, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Meta CAPI & Server-Side Tagging',
    description: 'Server GTM container deployment, custom subdomain mapping, and CAPI gateway setup.',
    category: 'Tracking & Analytics',
    priceMin: 4000,
    priceMax: 6000,
    priceRange: '৳4,000 - ৳6,000',
    currency: 'BDT',
    features: ['Server-side container', 'Event deduplication', 'EMQ audit'],
    isActive: true,
    linkedProjectIds: [],
  },
  {
    name: 'Google Ads & Performance Max Setup',
    description: 'High-intent search keyword harvesting and Performance Max asset groups.',
    category: 'Paid Media',
    priceMin: 6000,
    priceMax: 10000,
    priceRange: '৳6,000 - ৳10,000',
    currency: 'BDT',
    features: ['Intent keyword architecture', 'Enhanced conversions', 'Negative keyword lists'],
    isActive: true,
    linkedProjectIds: [],
  },
  {
    name: 'Looker Studio Executive Dashboard',
    description: 'Live interactive reporting connecting GA4, Meta Ads, and Google Ads data.',
    category: 'Business Intelligence',
    priceMin: 4000,
    priceMax: 7000,
    priceRange: '৳4,000 - ৳7,000',
    currency: 'BDT',
    features: ['Cross-channel ROAS', 'Automated data refresh', 'Blended CAC analysis'],
    isActive: true,
    linkedProjectIds: [],
  },
];

/**
 * Real-time subscription to service packages with auto-seeding
 */
export function subscribePackages(
  callback: (packages: ServicePackage[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!auth?.currentUser) {
    callback([]);
    return () => {};
  }

  const packagesRef = collection(db, PACKAGES_COLLECTION);
  const q = query(packagesRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ServicePackage[];

      // Sort by sortOrder or price
      items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      callback(items);
    },
    (err) => {
      console.error('[subscribePackages error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, PACKAGES_COLLECTION);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

/**
 * Real-time subscription to individual services
 */
export function subscribeServices(
  callback: (services: AgencyServiceItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!auth?.currentUser) {
    callback([]);
    return () => {};
  }

  const servicesRef = collection(db, SERVICES_COLLECTION);
  const q = query(servicesRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as AgencyServiceItem[];

      items.sort((a, b) => a.name.localeCompare(b.name));
      callback(items);
    },
    (err) => {
      console.error('[subscribeServices error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, SERVICES_COLLECTION);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

/**
 * Toggle Service Package Active Status
 */
export async function togglePackageActive(
  packageId: string,
  currentStatus: boolean,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<boolean> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can toggle service package active status.');
  }

  const newStatus = !currentStatus;
  const pkgRef = doc(db, PACKAGES_COLLECTION, packageId);
  const now = new Date().toISOString();

  try {
    await updateDoc(pkgRef, {
      isActive: newStatus,
      updatedAt: now,
    });

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: newStatus ? 'package_activated' : 'package_deactivated',
      entityType: 'service_package',
      entityId: packageId,
      details: `Toggled package ${packageId} to ${newStatus ? 'Active' : 'Inactive'}`,
      status: 'success',
    });

    return newStatus;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PACKAGES_COLLECTION}/${packageId}`);
    throw err;
  }
}

/**
 * Toggle Individual Service Active Status
 */
export async function toggleServiceActive(
  serviceId: string,
  currentStatus: boolean,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<boolean> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can toggle service active status.');
  }

  const newStatus = !currentStatus;
  const srvRef = doc(db, SERVICES_COLLECTION, serviceId);
  const now = new Date().toISOString();

  try {
    await updateDoc(srvRef, {
      isActive: newStatus,
      updatedAt: now,
    });

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: newStatus ? 'service_activated' : 'service_deactivated',
      entityType: 'agency_service',
      entityId: serviceId,
      details: `Toggled service ${serviceId} to ${newStatus ? 'Active' : 'Inactive'}`,
      status: 'success',
    });

    return newStatus;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SERVICES_COLLECTION}/${serviceId}`);
    throw err;
  }
}

/**
 * Link a Service Package to a specific Project
 */
export async function linkPackageToProject(
  packageId: string,
  projectId: string,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can link packages to projects.');
  }

  const pkgRef = doc(db, PACKAGES_COLLECTION, packageId);
  const projRef = doc(db, 'projects', projectId);
  const now = new Date().toISOString();

  try {
    const pkgSnap = await getDoc(pkgRef);
    if (!pkgSnap.exists()) {
      throw new Error('Service package not found.');
    }
    const pkgData = pkgSnap.data() as ServicePackage;

    const projSnap = await getDoc(projRef);
    if (!projSnap.exists()) {
      throw new Error('Project not found.');
    }

    const batch = writeBatch(db);
    // 1. Add projectId to package's linkedProjectIds
    batch.update(pkgRef, {
      linkedProjectIds: arrayUnion(projectId),
      updatedAt: now,
    });

    // 2. Add package reference to the Project document
    batch.update(projRef, {
      packageId: packageId,
      packageName: pkgData.name,
      packagePricing: pkgData.priceRange,
      updatedAt: now,
    });

    await batch.commit();

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'package_linked_to_project',
      entityType: 'service_package',
      entityId: packageId,
      details: `Linked package "${pkgData.name}" to project ${projectId}`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PACKAGES_COLLECTION}/${packageId}`);
    throw err;
  }
}

/**
 * Unlink a Service Package from a Project
 */
export async function unlinkPackageFromProject(
  packageId: string,
  projectId: string,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can unlink packages from projects.');
  }

  const pkgRef = doc(db, PACKAGES_COLLECTION, packageId);
  const projRef = doc(db, 'projects', projectId);
  const now = new Date().toISOString();

  try {
    const batch = writeBatch(db);
    batch.update(pkgRef, {
      linkedProjectIds: arrayRemove(projectId),
      updatedAt: now,
    });

    batch.update(projRef, {
      packageId: '',
      packageName: '',
      packagePricing: '',
      updatedAt: now,
    });

    await batch.commit();

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'package_unlinked_from_project',
      entityType: 'service_package',
      entityId: packageId,
      details: `Unlinked package ${packageId} from project ${projectId}`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PACKAGES_COLLECTION}/${packageId}`);
    throw err;
  }
}

/**
 * Create a new custom Service Package
 */
export async function createServicePackage(
  input: Omit<ServicePackage, 'id' | 'createdAt' | 'updatedAt' | 'linkedProjectIds'>,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<ServicePackage> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can create service packages.');
  }

  const pkgId = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const pkgRef = doc(db, PACKAGES_COLLECTION, pkgId);
  const now = new Date().toISOString();

  const newPackage: ServicePackage = {
    id: pkgId,
    ...input,
    linkedProjectIds: [],
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(pkgRef, newPackage);

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'package_created',
      entityType: 'service_package',
      entityId: pkgId,
      details: `Created package "${newPackage.name}" (${newPackage.priceRange})`,
      status: 'success',
    });

    return newPackage;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PACKAGES_COLLECTION}/${pkgId}`);
    throw err;
  }
}

/**
 * Update an existing Service Package
 */
export async function updateServicePackage(
  packageId: string,
  updates: Partial<Omit<ServicePackage, 'id' | 'createdAt' | 'updatedAt' | 'linkedProjectIds'>>,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can update service packages.');
  }

  const pkgRef = doc(db, PACKAGES_COLLECTION, packageId);
  const now = new Date().toISOString();

  try {
    await updateDoc(
      pkgRef,
      stripUndefined({
        ...updates,
        updatedAt: now,
      })
    );

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'package_updated',
      entityType: 'service_package',
      entityId: packageId,
      details: `Updated service package "${updates.name || packageId}"`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PACKAGES_COLLECTION}/${packageId}`);
    throw err;
  }
}

/**
 * Delete a Service Package
 */
export async function deleteServicePackage(
  packageId: string,
  packageName: string,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can delete service packages.');
  }

  const pkgRef = doc(db, PACKAGES_COLLECTION, packageId);

  try {
    await deleteDoc(pkgRef);

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'package_deleted',
      entityType: 'service_package',
      entityId: packageId,
      details: `Deleted service package "${packageName}" (${packageId})`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${PACKAGES_COLLECTION}/${packageId}`);
    throw err;
  }
}

/**
 * Create a new Individual Agency Service
 */
export async function createAgencyService(
  input: Omit<AgencyServiceItem, 'id' | 'createdAt' | 'updatedAt' | 'linkedProjectIds'>,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<AgencyServiceItem> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can create services.');
  }

  const srvId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const srvRef = doc(db, SERVICES_COLLECTION, srvId);
  const now = new Date().toISOString();

  const newService: AgencyServiceItem = {
    id: srvId,
    ...input,
    linkedProjectIds: [],
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(srvRef, stripUndefined(newService));

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'service_created',
      entityType: 'agency_service',
      entityId: srvId,
      details: `Created service item "${newService.name}" (${newService.priceRange})`,
      status: 'success',
    });

    return newService;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SERVICES_COLLECTION}/${srvId}`);
    throw err;
  }
}

/**
 * Update an Individual Agency Service
 */
export async function updateAgencyService(
  serviceId: string,
  updates: Partial<Omit<AgencyServiceItem, 'id' | 'createdAt' | 'updatedAt'>>,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can update services.');
  }

  const srvRef = doc(db, SERVICES_COLLECTION, serviceId);
  const now = new Date().toISOString();

  try {
    await updateDoc(
      srvRef,
      stripUndefined({
        ...updates,
        updatedAt: now,
      })
    );

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'service_updated',
      entityType: 'agency_service',
      entityId: serviceId,
      details: `Updated service "${updates.name || serviceId}"`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SERVICES_COLLECTION}/${serviceId}`);
    throw err;
  }
}

/**
 * Delete an Individual Agency Service
 */
export async function deleteAgencyService(
  serviceId: string,
  serviceName: string,
  actor: { uid?: string; id?: string; email?: string | null; role: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Only Admin can delete services.');
  }

  const srvRef = doc(db, SERVICES_COLLECTION, serviceId);

  try {
    await deleteDoc(srvRef);

    await logAuditEvent({
      actorUserId: actor.uid || actor.id || 'admin',
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: 'admin',
      action: 'service_deleted',
      entityType: 'agency_service',
      entityId: serviceId,
      details: `Deleted service "${serviceName}" (${serviceId})`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${SERVICES_COLLECTION}/${serviceId}`);
    throw err;
  }
}
