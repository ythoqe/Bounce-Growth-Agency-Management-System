import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types/user';
import { auth, db, firebaseStatus, testConnection } from '../services/firebase/client';
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  currentRole: UserRole | null;
  isLoading: boolean;
  isFirebaseConnected: boolean;
  isLiveAuth: boolean;
  firebaseStatus: typeof firebaseStatus;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
}

const BOOTSTRAP_ADMIN_EMAIL = 'hmmojjammalhoq@gmail.com';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
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

            // Check if user is pre-registered as a team specialist in team_members
            let preAssignedTeam: { role: UserRole; title: string; docId: string } | null = null;
            if (!isBootstrapAdmin && fbUser.email) {
              try {
                const teamQ = query(
                  collection(db, 'team_members'),
                  where('email', '==', fbUser.email.toLowerCase().trim())
                );
                const teamSnap = await getDocs(teamQ);
                if (!teamSnap.empty) {
                  const tData = teamSnap.docs[0].data();
                  preAssignedTeam = {
                    role: (tData.role as UserRole) || 'team',
                    title: tData.title || 'Agency Specialist',
                    docId: teamSnap.docs[0].id,
                  };

                  // Link UID to team_members record if not already set
                  if (!tData.userId) {
                    await updateDoc(doc(db, 'team_members', teamSnap.docs[0].id), {
                      userId: fbUser.uid,
                      updatedAt: new Date().toISOString(),
                    });
                  }
                }
              } catch (e) {
                console.warn('[AuthContext] Team pre-registration check notice:', e);
              }
            }

            if (userSnap.exists()) {
              const data = userSnap.data() as UserProfile;

              // If pre-assigned as team in team_members, ensure active team status in state immediately
              if (preAssignedTeam) {
                const updatedProfile: UserProfile = {
                  ...data,
                  role: preAssignedTeam.role,
                  status: 'active',
                  title: preAssignedTeam.title,
                };
                setCurrentUser({
                  ...updatedProfile,
                  id: fbUser.uid,
                  email: fbUser.email || data.email,
                  displayName: fbUser.displayName || data.displayName,
                });

                // Background sync to Firestore user document
                if (data.role !== preAssignedTeam.role || data.status !== 'active') {
                  try {
                    await updateDoc(userDocRef, {
                      role: preAssignedTeam.role,
                      status: 'active',
                      title: preAssignedTeam.title,
                      updatedAt: new Date().toISOString(),
                    });
                  } catch (syncErr) {
                    console.warn('[AuthContext] Team user doc sync notice:', syncErr);
                  }
                }
              } else {
                setCurrentUser({
                  ...data,
                  id: fbUser.uid,
                  email: fbUser.email || data.email,
                  displayName: fbUser.displayName || data.displayName,
                });
              }
            } else {
              // Create user record for new sign-in
              const assignedRole: UserRole = isBootstrapAdmin
                ? 'admin'
                : preAssignedTeam
                ? preAssignedTeam.role
                : 'client';
              const initialStatus = isBootstrapAdmin || preAssignedTeam ? 'active' : 'invited';
              const initialTitle = isBootstrapAdmin
                ? 'Founder / Admin'
                : preAssignedTeam
                ? preAssignedTeam.title
                : 'Pending Verification';

              const newProfile: UserProfile = {
                id: fbUser.uid,
                email: fbUser.email || '',
                displayName: fbUser.displayName || 'External User',
                role: assignedRole,
                status: initialStatus,
                title: initialTitle,
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
            // Fallback for bootstrap admin if Firestore permissions / network hiccup occurs
            if (fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
              setCurrentUser({
                id: fbUser.uid,
                email: fbUser.email,
                displayName: fbUser.displayName || 'Founder & Head of Growth',
                role: 'admin',
                status: 'active',
                title: 'Founder / Managing Director',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            } else {
              setCurrentUser(null);
            }
          }
        } else {
          setIsLiveAuth(false);
          setCurrentUser(null);
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

  const signOut = async () => {
    try {
      setIsLoading(true);
      if (auth) {
        await fbSignOut(auth);
      }
      setFirebaseUser(null);
      setIsLiveAuth(false);
      setCurrentUser(null);
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
        currentRole: currentUser?.role || null,
        isLoading,
        isFirebaseConnected: firebaseStatus.isConfigured,
        isLiveAuth,
        firebaseStatus,
        signInWithGoogle,
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
