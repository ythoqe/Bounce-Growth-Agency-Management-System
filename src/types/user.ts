export type UserRole = 'admin' | 'team' | 'client';

export type UserStatus = 'active' | 'suspended' | 'invited';

export interface UserProfile {
  id: string; // Auth UID
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  clientId?: string; // Associated client record if role === 'client'
  phone?: string;
  avatarUrl?: string;
  title?: string;
  skills?: string[]; // e.g. ["Meta CAPI", "GA4", "Server-side Tracking", "Google Ads"]
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: any | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}
