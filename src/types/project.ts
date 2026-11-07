import { ServiceCategory } from './client';

export type ProjectStatus = 'planning' | 'active' | 'in_progress' | 'in_review' | 'completed' | 'on_hold' | 'archived';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id: string; // Unique document ID
  clientId: string;
  clientName: string;
  name: string; // projectName
  description: string;
  services: ServiceCategory[];
  status: ProjectStatus;
  priority: ProjectPriority;
  leadSpecialistId: string;
  assignedTeamMembers: string[];
  clientVisible: boolean; // Controls whether client can see this in their portal
  progressPercentage: number;
  startDate: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  packageId?: string;
  packageName?: string;
  packagePricing?: string;
}
