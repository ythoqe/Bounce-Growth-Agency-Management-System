import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { UserRole } from '../../types/user';
import { LoadingState } from '../../components/common/LoadingState';
import { ShieldAlert, LogOut, Clock, LogIn, UserCheck } from 'lucide-react';
import { Button } from '../../components/common/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser, isLoading, currentRole, isLiveAuth, signOut, signInWithGoogle, switchDevRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <LoadingState message="Authenticating session..." />
      </div>
    );
  }

  // 1. If not authenticated, render an in-place sign-in card (NEVER navigate to /admin, which causes infinite redirect loops!)
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            BG
          </div>
          <h2 className="text-lg font-bold text-slate-900">Bounce Growth Agency Console</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Please sign in to access the agency operations dashboard or client portal.
          </p>

          <div className="mt-6 space-y-3">
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              onClick={signInWithGoogle}
              icon={<LogIn className="w-4 h-4" />}
            >
              Sign In with Google
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium">Or continue as demo</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={() => switchDevRole('admin')}
              >
                Agency Admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={() => switchDevRole('client')}
              >
                Client Portal
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Account status approval check for live authenticated users
  if (isLiveAuth && currentUser.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Account Awaiting Agency Authorization</h2>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Signed in as <strong>{currentUser.email}</strong>. This Google account has not yet been assigned active agency specialist or client portal privileges.
          </p>
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 text-left">
            <p className="font-semibold text-slate-700">Security Rule Verification:</p>
            <p>Database queries remain completely blocked until an agency administrator verifies this email and assigns an active role.</p>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={signOut} icon={<LogOut className="w-3.5 h-3.5" />}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. If client role, verify clientId is present
  if (currentRole === 'client' && !currentUser.clientId && isLiveAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Client Organization Not Linked</h2>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Your account is registered as a Client Representative, but has not been associated with a verified brand organization yet.
          </p>
          <div className="mt-6">
            <Button variant="outline" size="sm" onClick={signOut} icon={<LogOut className="w-3.5 h-3.5" />}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Role-based route authorization with strict loop prevention
  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    const targetPath = currentRole === 'client' ? '/portal/dashboard' : '/admin';
    
    // Prevent redirecting if already on or within target route family
    if (
      location.pathname === targetPath ||
      (currentRole === 'client' && location.pathname.startsWith('/portal')) ||
      (currentRole !== 'client' && location.pathname.startsWith('/admin'))
    ) {
      return <>{children}</>;
    }

    return <Navigate to={targetPath} replace />;
  }

  return <>{children}</>;
}
