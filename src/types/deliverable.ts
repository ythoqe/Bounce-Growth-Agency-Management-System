export type DeliverableStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'revision_requested'
  | 'rejected';

export interface Deliverable {
  id: string; // Document ID (deliverableId)
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  externalUrl?: string; // Validated link (Looker Studio dashboard, GTM Preview, Figma, Loom, etc.)
  submittedBy: string; // User UID
  submittedByName: string;
  submittedAt: string;
  version: number; // 1, 2, 3...
  status: DeliverableStatus;
  reviewNotes?: string; // Client feedback or revision reasoning
  reviewedBy?: string; // Client User UID
  reviewedByName?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliverableVersion {
  id: string;
  deliverableId: string;
  versionNumber: number;
  title: string;
  description: string;
  externalUrl?: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  status: DeliverableStatus;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
}
