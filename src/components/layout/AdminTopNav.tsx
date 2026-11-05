import React from 'react';
import { Menu, ExternalLink, ShieldCheck, Database, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../common/Button';
import { NotificationDropdown } from '../common/NotificationDropdown';

interface AdminTopNavProps {
  onOpenMobileMenu: () => void;
}

export function AdminTopNav({ onOpenMobileMenu }: AdminTopNavProps) {
  const { currentRole, switchDevRole, isFirebaseConnected, isLiveAuth, firebaseUser, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pathSegment = location.pathname.replace('/admin', '').replace('/', '') || 'Dashboard';
  const pageTitle = pathSegment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200/90 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left zone: Mobile trigger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-600">Bounce Growth</span>
          <span className="text-slate-400" aria-hidden="true">
            /
          </span>
          <span className="font-semibold text-slate-900">{pageTitle}</span>
        </nav>
      </div>

      {/* Right zone: Firebase status + Role switcher (Dev only) + Client Portal preview link + Live Auth */}
      <div className="flex items-center gap-2.5">
        {/* Firebase Live Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200 bg-slate-50 text-slate-600">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span>Firestore:</span>
          {isFirebaseConnected ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Active
            </span>
          ) : (
            <span className="text-amber-700 font-semibold">Offline</span>
          )}
        </div>

        {/* Development-only Role Switcher (Disabled in Production and when live authenticated) */}
        {import.meta.env.DEV && !isLiveAuth && (
          <div className="hidden sm:flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px]">
            <span className="px-1.5 text-[10px] text-slate-400 font-mono">DEV:</span>
            <button
              onClick={() => switchDevRole('admin')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                currentRole === 'admin'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => switchDevRole('team')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                currentRole === 'team'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Team
            </button>
          </div>
        )}

        {/* Notifications */}
        <NotificationDropdown />

        {/* Client Portal Link */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (import.meta.env.DEV && !isLiveAuth) {
              switchDevRole('client');
            }
            navigate('/portal');
          }}
          icon={<ExternalLink className="w-3.5 h-3.5" />}
          className="text-xs"
        >
          Portal
        </Button>

        {/* Live Authentication Trigger */}
        {isLiveAuth ? (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
            <span className="text-xs font-semibold text-slate-800 hidden md:inline truncate max-w-[120px]">
              {firebaseUser?.displayName || firebaseUser?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              icon={<LogOut className="w-3.5 h-3.5" />}
              className="text-xs text-slate-600"
            >
              Logout
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={signInWithGoogle}
            icon={<LogIn className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Google Login
          </Button>
        )}
      </div>
    </header>
  );
}
