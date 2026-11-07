import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  CheckCircle2,
  Receipt,
  BarChart2,
  FileCheck,
  MessageSquare,
  Lock,
  X,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../features/auth/AuthContext';

interface ClientSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const clientNavItems = [
  { name: 'Dashboard', href: '/portal/dashboard', icon: LayoutDashboard },
  { name: 'Active Projects', href: '/portal/projects', icon: Briefcase },
  { name: 'Invoices & Billing', href: '/portal/invoices', icon: Receipt },
  { name: 'Performance Reports', href: '/portal/reports', icon: BarChart2 },
  { name: 'Tasks & Approvals', href: '/portal/tasks', icon: CheckCircle2 },
  { name: 'Shared Documents', href: '/portal/documents', icon: FileCheck },
  { name: 'Support & Requests', href: '/portal/support', icon: MessageSquare },
];

export function ClientSidebar({ isOpen, onClose }: ClientSidebarProps) {
  const { currentUser } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white text-slate-700 flex flex-col border-r border-slate-200 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              BG
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900">
                Bounce Growth
              </div>
              <p className="text-[10px] text-blue-600 font-semibold tracking-wide uppercase">Client Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Isolation Notice */}
        <div className="mx-3 mt-4 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px] text-blue-900 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
          <span>
            Secure Client Workspace. Isolated to approved records for <strong>Apex Retail BD</strong>.
          </span>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Client Navigation
          </div>
          {clientNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/portal' || item.href === '/portal/dashboard'}
              onClick={() => onClose()}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </div>

        {/* Bottom account info */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
              AR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {currentUser?.displayName || 'Client Contact'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                Apex Retail BD
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
