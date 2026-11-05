import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { UserRole } from '../../types/user';
import { LoadingState } from '../../components/common/LoadingState';
import { ShieldAlert, LogOut, Clock } from 'lucide-react';
import { Button } from '../../components/common/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser, isLoading, currentRole, isLiveAuth, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <LoadingState message="Authenticating session..." />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  // Check 1: Account status approval check for live authenticated users
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

  // Check 2: If client role, verify clientId is present
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

  // Check 3: Role-based route authorization
  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    if (currentRole === 'client') {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
