export type AuditActionType =
  | 'user_login'
  | 'user_role_changed'
  | 'client_created'
  | 'client_updated'
  | 'client_deleted'
  | 'invoice_issued'
  | 'invoice_paid'
  | 'payment_recorded'
  | 'expense_recorded'
  | 'asset_credential_accessed'
  | 'asset_modified'
  | 'project_status_changed'
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_status_changed'
  | 'deliverable_submitted'
  | 'deliverable_reviewed'
  | 'support_ticket_created'
  | 'support_ticket_updated'
  | 'document_uploaded'
  | 'permission_denied';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  action: AuditActionType;
  entityType:
    | 'user'
    | 'client'
    | 'project'
    | 'task'
    | 'deliverable'
    | 'support_ticket'
    | 'invoice'
    | 'payment'
    | 'expense'
    | 'transaction'
    | 'asset'
    | 'document'
    | 'system';
  entityId: string;
  details: string;
  ipAddress?: string;
  status: 'success' | 'failure';
}
