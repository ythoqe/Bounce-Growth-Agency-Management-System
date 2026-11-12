import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LogIn, Shield, AlertCircle } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';

export function LoginPage() {
  const { currentUser, currentRole, isLoading, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const location = useLocation();

  // If already authenticated, redirect to appropriate destination
  if (currentUser) {
    const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
    if (fromPath && fromPath !== '/login') {
      return <Navigate to={fromPath} replace />;
    }
    const destination = currentRole === 'client' ? '/portal/dashboard' : '/admin/dashboard';
    return <Navigate to={destination} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <LoadingState message="Checking authentication session..." />
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error('Sign-in failed:', err);
      const message = err instanceof Error ? err.message : 'Unable to sign in with Google. Please try again.';
      setError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center mb-4 shadow-md shadow-blue-500/20">
            BG
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bounce Growth Agency</h1>
          <p className="text-xs text-slate-500 mt-1">Enterprise Marketing Operations & Analytics</p>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-xs text-slate-600 text-center mb-6 leading-relaxed">
            Please sign in with your verified Google account to access your workspace or client portal.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center shadow-sm cursor-pointer"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            icon={<LogIn className="w-4 h-4" />}
          >
            {isSigningIn ? 'Connecting to Google...' : 'Sign In with Google'}
          </Button>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secured via Firebase Authentication & RBAC</span>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-400 text-center">
        Bounce Growth Agency Management Console &bull; Production Environment
      </p>
    </div>
  );
}
