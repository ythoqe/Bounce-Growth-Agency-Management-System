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
import { Lead, CreateLeadInput, UpdateLeadInput, LeadStage } from '../../types/crm';
import { logAuditEvent } from '../audit/auditService';
import { stripUndefined } from '../../utils/cleanFirestore';
import { createClient } from '../clients/clientService';

const COLLECTION_NAME = 'leads';

/**
 * Real-time listener for CRM Leads pipeline
 */
export function subscribeLeads(
  callback: (leads: Lead[]) => void,
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
      const items: Lead[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          companyName: data.companyName || 'Unnamed Prospect',
          website: data.website || undefined,
          contactPerson: data.contactPerson || 'Lead Contact',
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || undefined,
          serviceInterest: data.serviceInterest || 'Server-Side GTM & Meta CAPI',
          estimatedValue: Number(data.estimatedValue) || 0,
          currency: data.currency === 'USD' ? 'USD' : 'BDT',
          stage: data.stage || 'new',
          notes: data.notes || undefined,
          assignedTo: data.assignedTo || undefined,
          assignedToName: data.assignedToName || undefined,
          auditDate: data.auditDate || undefined,
          source: data.source || undefined,
          convertedClientId: data.convertedClientId || undefined,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Sort client-side by createdAt descending
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      callback(items);
    },
    (error) => {
      console.warn('[LeadService] Snapshot error:', error?.message || error);
      callback([]);
      if (onError) onError(error);
    }
  );
}

/**
 * Create a new prospect lead in Firestore
 */
export async function createLead(
  input: CreateLeadInput,
  actor?: { uid: string; email?: string; name?: string; role?: string }
): Promise<Lead> {
  const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newLead: Lead = {
    id: leadId,
    companyName: input.companyName.trim(),
    website: input.website?.trim() || undefined,
    contactPerson: input.contactPerson.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    contactPhone: input.contactPhone?.trim() || undefined,
    serviceInterest: input.serviceInterest || 'Server-Side GTM & Meta CAPI',
    estimatedValue: Number(input.estimatedValue) || 0,
    currency: input.currency === 'USD' ? 'USD' : 'BDT',
    stage: input.stage || 'new',
    notes: input.notes?.trim() || undefined,
    assignedTo: input.assignedTo || undefined,
    assignedToName: input.assignedToName || undefined,
    auditDate: input.auditDate || undefined,
    source: input.source?.trim() || 'Inbound Inquiry',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, COLLECTION_NAME, leadId), stripUndefined(newLead));

  if (actor?.uid) {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role || 'admin',
      action: 'lead_created',
      entityType: 'lead',
      entityId: leadId,
      details: `Created lead "${newLead.companyName}" (${newLead.currency} ${newLead.estimatedValue}) in stage ${newLead.stage}`,
    });
  }

  return newLead;
}

/**
 * Update an existing lead's details
 */
export async function updateLead(
  leadId: string,
  updates: UpdateLeadInput,
  actor?: { uid: string; email?: string; name?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, leadId);
  const patchData: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(docRef, stripUndefined(patchData));

  if (actor?.uid) {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role || 'admin',
      action: 'lead_updated',
      entityType: 'lead',
      entityId: leadId,
      details: `Updated lead details for ${updates.companyName || leadId}`,
    });
  }
}

/**
 * Move or advance the stage of a lead
 */
export async function updateLeadStage(
  leadId: string,
  newStage: LeadStage,
  actor?: { uid: string; email?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, leadId);
  await updateDoc(docRef, {
    stage: newStage,
    updatedAt: new Date().toISOString(),
  });

  if (actor?.uid) {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role || 'admin',
      action: 'lead_stage_changed',
      entityType: 'lead',
      entityId: leadId,
      details: `Changed lead ${leadId} stage to ${newStage}`,
    });
  }
}

/**
 * Delete a lead from Firestore
 */
export async function deleteLead(
  leadId: string,
  companyName?: string,
  actor?: { uid: string; email?: string; role?: string }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, leadId);
  await deleteDoc(docRef);

  if (actor?.uid) {
    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'team@bouncegrowth.agency',
      actorRole: actor.role || 'admin',
      action: 'lead_deleted',
      entityType: 'lead',
      entityId: leadId,
      details: `Deleted lead "${companyName || leadId}"`,
    });
  }
}

/**
 * Convert a won lead into an active agency client profile
 */
export async function convertLeadToClient(
  lead: Lead,
  actor: { uid: string; email: string; role: string; name?: string }
): Promise<string> {
  // Create client in clients collection
  const createdClient = await createClient(
    {
      businessName: lead.companyName,
      website: lead.website || '',
      contactPerson: lead.contactPerson,
      email: lead.contactEmail,
      phone: lead.contactPhone || '',
      status: 'active',
      country: 'Bangladesh',
      timezone: 'Asia/Dhaka',
      primaryContact: {
        name: lead.contactPerson,
        email: lead.contactEmail,
        phone: lead.contactPhone || '',
        isPrimary: true,
      },
      servicesSubscribed: ['server_side_tracking'],
      monthlyRetainer: Number(lead.estimatedValue) || 0,
      currency: lead.currency || 'BDT',
      assignedSpecialists: actor.uid ? [actor.uid] : [],
      internalNotes: `Converted from lead ${lead.id}. Service Interest: ${lead.serviceInterest}. Notes: ${lead.notes || 'None'}`,
    },
    actor
  );

  // Update lead stage to 'won' and link convertedClientId
  const leadRef = doc(db, COLLECTION_NAME, lead.id);
  await updateDoc(leadRef, {
    stage: 'won',
    convertedClientId: createdClient.id,
    updatedAt: new Date().toISOString(),
  });

  await logAuditEvent({
    actorUserId: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'lead_converted_to_client',
    entityType: 'lead',
    entityId: lead.id,
    details: `Converted lead "${lead.companyName}" to client ${createdClient.id} (${lead.currency} ${lead.estimatedValue}/mo)`,
  });

  return createdClient.id;
}
