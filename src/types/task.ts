export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled';

export interface Task {
  id: string; // Document ID (taskId)
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  assignedTeamMembers: string[]; // User UIDs
  assignedTeamMemberNames?: string[];
  createdBy: string; // User UID
  createdByName?: string;
  priority: TaskPriority;
  status: TaskStatus;
  progressPercentage: number; // 0 to 100
  startDate?: string;
  deadline?: string;
  labels: string[]; // e.g. ['Meta CAPI', 'GA4', 'GTM QA', 'Server Tracking', 'Looker']
  clientVisible: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type TaskFilter = {
  clientId?: string;
  projectId?: string;
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  assigneeUid?: string;
  searchQuery?: string;
  includeArchived?: boolean;
};
