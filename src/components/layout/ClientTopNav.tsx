import React from 'react';
import { Menu, ArrowLeft, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../common/Button';
import { NotificationDropdown } from '../common/NotificationDropdown';

interface ClientTopNavProps {
  onOpenMobileMenu: () => void;
}

export function ClientTopNav({ onOpenMobileMenu }: ClientTopNavProps) {
  const { signOut, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pathSegment = location.pathname.replace('/portal', '').replace('/', '') || 'Overview';
  const pageTitle = pathSegment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const isAdminOrTeam = currentUser?.role === 'admin' || currentUser?.role === 'team';

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
          <span className="font-semibold text-slate-900">{currentUser?.displayName || 'Client Portal'}</span>
          <span className="text-slate-400" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-slate-600">{pageTitle}</span>
        </nav>
      </div>

      {/* Right zone: Notifications + Admin Link + Logout */}
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>Client Isolation Active</span>
        </div>

        <NotificationDropdown />

        {isAdminOrTeam && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigate('/admin/dashboard');
            }}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Admin Console
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          icon={<LogOut className="w-3.5 h-3.5" />}
          className="text-xs text-slate-600 cursor-pointer"
        >
          Logout
        </Button>
      </div>
    </header>
  );
}
