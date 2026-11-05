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
import { db } from '../firebase/client';
import { SupportTicket, SupportTicketStatus } from '../../types/communication';
import { SupportTicketSchema } from '../../schemas';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { logAuditEvent } from '../audit/auditService';
import { createNotification } from '../notifications/notificationService';

export async function createSupportTicket(
  input: {
    clientId: string;
    clientName: string;
    subject: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  },
  actor: { uid: string; email?: string | null; name?: string; role: 'admin' | 'team' | 'client' }
): Promise<string> {
  const validated = SupportTicketSchema.parse({
    ...input,
    priority: input.priority || 'medium',
    status: 'open',
  });

  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ticketRef = doc(db, 'support_tickets', ticketId);
  const now = new Date().toISOString();

  const payload: SupportTicket = {
    id: ticketId,
    clientId: validated.clientId,
    clientName: validated.clientName,
    subject: validated.subject,
    description: validated.description,
    priority: validated.priority,
    status: 'open',
    createdByUid: actor.uid,
    createdByName: actor.name || (actor.role === 'client' ? 'Client Representative' : 'Admin'),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(ticketRef, payload);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'client@portal.com',
      actorRole: actor.role === 'admin' ? 'admin' : 'team',
      action: 'support_ticket_created',
      entityType: 'support_ticket',
      entityId: ticketId,
      details: `Created support ticket "${validated.subject}" for ${validated.clientName}`,
      status: 'success',
    });

    // Notify agency founder/lead
    await createNotification({
      recipientUid: 'usr_admin_bounce',
      type: 'support_ticket_created',
      title: 'New Support Ticket Created',
      message: `${validated.clientName} opened ticket: "${validated.subject}"`,
      relatedEntityType: 'support_ticket',
      relatedEntityId: ticketId,
      read: false,
      createdAt: now,
    }).catch(() => {});

    return ticketId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `support_tickets/${ticketId}`);
    throw err;
  }
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
  resolutionNotes: string | undefined,
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client' }
): Promise<void> {
  const ticketRef = doc(db, 'support_tickets', ticketId);
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  if (resolutionNotes) {
    updateData.resolutionNotes = resolutionNotes;
  }
  if (status === 'resolved' || status === 'closed') {
    updateData.resolvedAt = now;
  }

  try {
    const snap = await getDoc(ticketRef);
    if (!snap.exists()) throw new Error('Ticket not found');
    const existingTicket = snap.data() as SupportTicket;

    await updateDoc(ticketRef, updateData);

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'staff@bouncegrowth.com',
      actorRole: actor.role as 'admin' | 'team',
      action: 'support_ticket_updated',
      entityType: 'support_ticket',
      entityId: ticketId,
      details: `Updated ticket ${ticketId} status to "${status}"`,
      status: 'success',
    });

    // Notify ticket creator
    if (existingTicket.createdByUid && existingTicket.createdByUid !== actor.uid) {
      await createNotification({
        recipientUid: existingTicket.createdByUid,
        type: 'support_ticket_updated',
        title: 'Support Ticket Status Updated',
        message: `Your ticket "${existingTicket.subject}" is now marked as ${status.replace('_', ' ').toUpperCase()}`,
        relatedEntityType: 'support_ticket',
        relatedEntityId: ticketId,
        read: false,
        createdAt: now,
      }).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `support_tickets/${ticketId}`);
    throw err;
  }
}

export async function assignSupportTicket(
  ticketId: string,
  assignedToUid: string,
  assignedToName: string,
  actor: { uid: string; email?: string | null; role: 'admin' | 'team' | 'client' }
): Promise<void> {
  const ticketRef = doc(db, 'support_tickets', ticketId);
  try {
    await updateDoc(ticketRef, {
      assignedToUid,
      assignedToName,
      status: 'in_progress',
      updatedAt: new Date().toISOString(),
    });

    await logAuditEvent({
      actorUserId: actor.uid,
      actorEmail: actor.email || 'admin@bouncegrowth.com',
      actorRole: actor.role as 'admin' | 'team',
      action: 'support_ticket_updated',
      entityType: 'support_ticket',
      entityId: ticketId,
      details: `Assigned ticket ${ticketId} to ${assignedToName}`,
      status: 'success',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `support_tickets/${ticketId}`);
    throw err;
  }
}

export function subscribeSupportTickets(
  filters: { clientId?: string; status?: string },
  callback: (tickets: SupportTicket[]) => void,
  actor: { uid: string; role: 'admin' | 'team' | 'client'; clientId?: string },
  onError?: (error: Error) => void
): () => void {
  if (!actor.uid) {
    callback([]);
    return () => {};
  }

  const ticketsRef = collection(db, 'support_tickets');
  let q = query(ticketsRef);

  if (actor.role === 'client') {
    if (!actor.clientId) {
      callback([]);
      return () => {};
    }
    q = query(ticketsRef, where('clientId', '==', actor.clientId));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let tickets = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as SupportTicket[];

      if (filters.clientId && filters.clientId !== 'all') {
        tickets = tickets.filter((t) => t.clientId === filters.clientId);
      }
      if (filters.status && filters.status !== 'all') {
        tickets = tickets.filter((t) => t.status === filters.status);
      }

      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(tickets);
    },
    (err) => {
      console.error('[subscribeSupportTickets error]', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'support_tickets');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}
