import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/client';
import { AuditLogEntry, AuditActionType } from '../../types/audit';

export async function logAuditEvent(params: {
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  action: AuditActionType;
  entityType: 'client' | 'project' | 'asset' | 'user' | 'system';
  entityId: string;
  details: string;
  status?: 'success' | 'failure';
}): Promise<void> {
  // Agency Audit logs can only be authored by Admin or Team members per security rules
  if (params.actorRole === 'client') {
    return;
  }

  const currentAuth = auth?.currentUser;
  const actorUid = currentAuth?.uid || params.actorUserId;
  const actorEmail = currentAuth?.email || params.actorEmail;

  if (!actorUid || !actorEmail) {
    return;
  }

  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logEntry: AuditLogEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      actorUserId: actorUid,
      actorEmail: actorEmail,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
      status: params.status || 'success',
    };

    await setDoc(doc(db, 'audit_logs', logId), logEntry);
  } catch (err) {
    // Non-blocking log failure
    console.warn('[Audit Logger] Could not persist audit log:', err);
  }
}
