export interface ProjectComment {
  id: string; // Document ID (commentId)
  projectId: string;
  clientId: string;
  authorUid: string;
  authorName: string;
  authorRole: 'admin' | 'team' | 'client';
  content: string;
  clientVisible: boolean; // false = internal agency team only; true = client portal visible
  createdAt: string;
}

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string; // Document ID (ticketId)
  clientId: string;
  clientName: string;
  subject: string;
  description: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  createdByUid: string;
  createdByName: string;
  assignedToUid?: string;
  assignedToName?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export type NotificationType =
  | 'task_assigned'
  | 'task_deadline'
  | 'deliverable_submitted'
  | 'deliverable_approved'
  | 'revision_requested'
  | 'project_comment'
  | 'support_ticket_created'
  | 'support_ticket_updated';

export interface AppNotification {
  id: string; // Document ID (notificationId)
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType: 'task' | 'deliverable' | 'project' | 'support_ticket';
  relatedEntityId: string;
  read: boolean;
  createdAt: string;
}
