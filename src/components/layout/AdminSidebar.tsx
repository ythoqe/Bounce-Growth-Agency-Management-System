import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  DollarSign,
  Activity,
  BarChart3,
  Calendar,
  FileText,
  BookOpen,
  Tag,
  Shield,
  UserCheck,
  Settings,
  X,
  Target,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../features/auth/AuthContext';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'CORE',
    items: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { name: 'CRM & Leads', href: '/admin/crm', icon: Target },
      { name: 'Clients', href: '/admin/clients', icon: Users },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { name: 'Projects', href: '/admin/projects', icon: Briefcase },
      { name: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
      { name: 'Tracking Assets', href: '/admin/assets', icon: Activity },
    ],
  },
  {
    title: 'DELIVERY & ASSETS',
    items: [
      { name: 'Reports & Analytics', href: '/admin/reports', icon: BarChart3 },
      { name: 'Content Calendar', href: '/admin/marketing', icon: Calendar },
      { name: 'Documents', href: '/admin/documents', icon: FileText },
      { name: 'SOP & Knowledge', href: '/admin/sop', icon: BookOpen },
    ],
  },
  {
    title: 'AGENCY MANAGEMENT',
    items: [
      { name: 'Finance & Invoicing', href: '/admin/finance', icon: DollarSign, adminOnly: true },
      { name: 'Services & Pricing', href: '/admin/services', icon: Tag, adminOnly: true },
      { name: 'Team Members', href: '/admin/team', icon: UserCheck, adminOnly: true },
      { name: 'Settings & Audit', href: '/admin/settings', icon: Settings, adminOnly: true },
    ],
  },
];

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const { currentRole, currentUser } = useAuth();

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
          'fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800/80 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              BG
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                Bounce Growth
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Tracking-First Agency</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Nav links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.adminOnly || currentRole === 'admin'
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400">
                  {section.title}
                </div>
                <nav className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      end={item.href === '/admin'}
                      onClick={() => onClose()}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                          isActive
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-slate-300 hover:text-white hover:bg-slate-900'
                        )
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </NavLink>
                  ))}
                </nav>
              </div>
            );
          })}
        </div>

        {/* Bottom User & Role Indicator */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {currentUser?.displayName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.displayName || 'User'}
              </p>
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                <Shield className="w-3 h-3 text-blue-400" />
                {currentRole === 'admin' ? 'Founder / Admin' : 'Team Member'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
