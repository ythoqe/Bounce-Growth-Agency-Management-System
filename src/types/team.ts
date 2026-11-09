export type TeamRole = 'admin' | 'team';
export type TeamStatus = 'active' | 'suspended' | 'invited';

export interface TeamMember {
  id: string; // Document ID (e.g. member_...)
  userId?: string; // Optional linked Firebase Auth UID
  name: string;
  email: string;
  role: TeamRole;
  status: TeamStatus;
  title: string; // e.g. "Lead Tracking Engineer", "Senior Meta Media Buyer"
  department: string; // e.g. "Tracking & Attribution", "Paid Media", "CRO & Analytics"
  skills: string[]; // e.g. ["Server-Side GTM", "Meta CAPI", "BigQuery", "Looker Studio"]
  assignedClients?: string[]; // Array of client IDs
  assignedClientNames?: string[];
  phone?: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberInput {
  name: string;
  email: string;
  role: TeamRole;
  status?: TeamStatus;
  title: string;
  department: string;
  skills: string[];
  assignedClients?: string[];
  assignedClientNames?: string[];
  phone?: string;
}

export interface UpdateTeamMemberInput {
  name?: string;
  email?: string;
  role?: TeamRole;
  status?: TeamStatus;
  title?: string;
  department?: string;
  skills?: string[];
  assignedClients?: string[];
  assignedClientNames?: string[];
  phone?: string;
}
