import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../../types/user';
import { auth, db, firebaseStatus, testConnection } from '../../services/firebase/client';
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  currentRole: UserRole;
  isLoading: boolean;
  isFirebaseConnected: boolean;
  isLiveAuth: boolean;
  firebaseStatus: typeof firebaseStatus;
  signInWithGoogle: () => Promise<void>;
  switchDevRole: (role: UserRole) => void;
  signOut: () => Promise<void>;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
}

const BOOTSTRAP_ADMIN_EMAIL = 'hmmojjammalhoq@gmail.com';

const devProfiles: Record<UserRole, UserProfile> = {
  admin: {
    id: 'usr_admin_bounce',
    email: BOOTSTRAP_ADMIN_EMAIL,
    displayName: 'Founder & Head of Growth',
    role: 'admin',
    status: 'active',
    title: 'Founder / Managing Director',
    skills: ['Meta Ads', 'Google Ads', 'GA4 & Server-Side GTM', 'Meta CAPI', 'CRO'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  team: {
    id: 'usr_team_specialist',
    email: 'tracking@bouncegrowth.com',
    displayName: 'Lead Tracking Specialist',
    role: 'team',
    status: 'active',
    title: 'Senior Tracking & Ads Specialist',
    skills: ['GTM Server-Side', 'Meta CAPI', 'GA4 E-commerce', 'Looker Studio'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  client: {
    id: 'usr_client_dhaka',
    email: 'ceo@apexretailbd.com',
    displayName: 'Apex Retail BD (Client Rep)',
    role: 'client',
    clientId: 'client_apex_01',
    status: 'active',
    title: 'Managing Director, Apex Retail',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(devProfiles.admin);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLiveAuth, setIsLiveAuth] = useState<boolean>(false);

  useEffect(() => {
    testConnection();

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        setFirebaseUser(fbUser);
        if (fbUser) {
          setIsLiveAuth(true);
          try {
            // Check if profile exists in Firestore
            const userDocRef = doc(db, 'users', fbUser.uid);
            const userSnap = await getDoc(userDocRef);

            const isBootstrapAdmin = fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

            if (userSnap.exists()) {
              const data = userSnap.data() as UserProfile;
              setCurrentUser({
                ...data,
                id: fbUser.uid,
                email: fbUser.email || data.email,
                displayName: fbUser.displayName || data.displayName,
              });
            } else {
              // Create user record for new sign-in
              // CRITICAL: Unknown Google users are NEVER granted admin or team roles automatically!
              const assignedRole: UserRole = isBootstrapAdmin ? 'admin' : 'client';
              const initialStatus = isBootstrapAdmin ? 'active' : 'invited';

              const newProfile: UserProfile = {
                id: fbUser.uid,
                email: fbUser.email || '',
                displayName: fbUser.displayName || 'External User',
                role: assignedRole,
                status: initialStatus,
                title: isBootstrapAdmin ? 'Founder / Admin' : 'Pending Verification',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              await setDoc(userDocRef, newProfile);

              if (isBootstrapAdmin) {
                // Record admin doc for security rules check
                await setDoc(doc(db, 'admins', fbUser.uid), {
                  email: fbUser.email,
                  assignedAt: new Date().toISOString(),
                });
              }

              setCurrentUser(newProfile);
            }
          } catch (err) {
            console.error('[AuthContext] Error loading user profile:', err);
            // Fallback to bootstrap admin if email matches
            if (fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
              setCurrentUser({
                ...devProfiles.admin,
                id: fbUser.uid,
                email: fbUser.email,
                displayName: fbUser.displayName || devProfiles.admin.displayName,
              });
            }
          }
        } else {
          setIsLiveAuth(false);
          // Keep default admin profile so both preview and published site load immediately
          setCurrentUser(devProfiles.admin);
        }
        setIsLoading(false);
      });

      return () => unsubscribe();
    } else {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('[AuthContext] Google sign-in error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchDevRole = (role: UserRole) => {
    // Only permit switching in development mode when not bound to an active live session
    if (import.meta.env.DEV && !isLiveAuth) {
      setCurrentUser(devProfiles[role]);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      if (auth) {
        await fbSignOut(auth);
      }
      setFirebaseUser(null);
      setIsLiveAuth(false);
      if (import.meta.env.DEV) {
        setCurrentUser(devProfiles.admin);
      } else {
        setCurrentUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (requiredRole: UserRole | UserRole[]) => {
    if (!currentUser) return false;
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(currentUser.role);
    }
    return currentUser.role === requiredRole;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        currentRole: currentUser?.role || 'admin',
        isLoading,
        isFirebaseConnected: firebaseStatus.isConfigured,
        isLiveAuth,
        firebaseStatus,
        signInWithGoogle,
        switchDevRole,
        signOut,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
