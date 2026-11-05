export type ServiceCategory =
  | 'meta_ads'
  | 'google_ads'
  | 'tiktok_ads'
  | 'ga4'
  | 'gtm'
  | 'meta_pixel'
  | 'meta_capi'
  | 'server_side_tracking'
  | 'looker_studio'
  | 'cro'
  | 'full_funnel_growth';

export type ClientStatus = 'active' | 'onboarding' | 'lead' | 'paused' | 'churned' | 'archived';

export interface ClientContact {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary: boolean;
}

export interface ClientInternalNote {
  clientId: string;
  notes: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ClientProfile {
  id: string; // Unique document ID
  businessName: string;
  contactPerson: string;
  email: string;
  phone?: string;
  website?: string;
  businessType?: string; // e.g. "E-commerce", "D2C Retail", "B2B SaaS"
  industry?: string;
  country: string;
  address?: string;
  timezone: string;
  primaryContact: ClientContact;
  servicesSubscribed: ServiceCategory[];
  status: ClientStatus;
  monthlyRetainer: number;
  currency: 'BDT' | 'USD';
  assignedManagerId?: string; // Team member UID
  assignedSpecialists: string[]; // Team member UIDs
  portalAccessUserIds: string[]; // UIDs granted client portal access
  internalNotes?: string; // DEPRECATED: Stored in /client_internal_notes/{clientId} for zero-trust isolation
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ClientInvitation {
  id: string;
  clientId: string;
  clientName: string;
  contactEmail: string;
  contactName: string;
  role: 'client';
  status: 'pending' | 'claimed' | 'revoked' | 'expired';
  invitedBy: string;
  claimedByUid?: string;
  createdAt: string;
  expiresAt: string; // ISO timestamp
  expiresAtMillis: number; // Epoch milliseconds for Firestore security rules comparison
  claimedAt?: string;
}
