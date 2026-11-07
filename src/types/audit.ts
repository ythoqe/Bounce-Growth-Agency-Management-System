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
  | 'permission_denied'
  | 'package_activated'
  | 'package_deactivated'
  | 'service_activated'
  | 'service_deactivated'
  | 'package_linked_to_project'
  | 'package_unlinked_from_project'
  | 'package_created'
  | 'content_item_created'
  | 'content_item_updated'
  | 'content_item_deleted'
  | 'content_item_status_changed'
  | 'document_deleted'
  | 'document_visibility_changed';

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
    | 'service_package'
    | 'agency_service'
    | 'content_item'
    | 'system';
  entityId: string;
  details: string;
  ipAddress?: string;
  status: 'success' | 'failure';
}
