export type LeadStage =
  | 'new'
  | 'audit_scheduled'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Lead {
  id: string;
  companyName: string;
  website?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  serviceInterest: string;
  estimatedValue: number;
  currency: 'BDT' | 'USD';
  stage: LeadStage;
  notes?: string;
  assignedTo?: string;
  assignedToName?: string;
  auditDate?: string;
  source?: string;
  convertedClientId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  companyName: string;
  website?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  serviceInterest: string;
  estimatedValue: number;
  currency?: 'BDT' | 'USD';
  stage?: LeadStage;
  notes?: string;
  assignedTo?: string;
  assignedToName?: string;
  auditDate?: string;
  source?: string;
}

export interface UpdateLeadInput {
  companyName?: string;
  website?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  serviceInterest?: string;
  estimatedValue?: number;
  currency?: 'BDT' | 'USD';
  stage?: LeadStage;
  notes?: string;
  assignedTo?: string;
  assignedToName?: string;
  auditDate?: string;
  source?: string;
}
