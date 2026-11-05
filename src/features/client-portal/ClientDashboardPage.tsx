import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Briefcase,
  CheckCircle2,
  Receipt,
  BarChart2,
  Shield,
  ArrowUpRight,
  Clock,
  ExternalLink,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Project } from '../../types/project';
import { TrackingAsset } from '../../types/asset';
import { subscribeProjects } from '../../services/projects/projectService';
import { subscribeAssets } from '../../services/assets/assetService';
import { formatDate } from '../../utils/formatters';

export function ClientDashboardPage() {
  const navigate = useNavigate();
  const { currentUser, isLiveAuth, firebaseUser } = useAuth();
  const clientId = currentUser?.clientId || 'client_apex_01';

  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<TrackingAsset[]>([]);

  useEffect(() => {
    if (!isLiveAuth || !firebaseUser) {
      setProjects([]);
      setAssets([]);
      return;
    }

    const unsubProjects = subscribeProjects(
      (data) => setProjects(data),
      (err) => console.warn('[ClientDashboard projects warning]', err),
      { clientId: clientId, clientVisibleOnly: true }
    );

    const unsubAssets = subscribeAssets(
      (data) => setAssets(data),
      (err) => console.warn('[ClientDashboard assets warning]', err),
      { clientId: clientId, accessLevel: 'shared_with_client' }
    );

    return () => {
      unsubProjects();
      unsubAssets();
    };
  }, [clientId, isLiveAuth, firebaseUser]);

  const activeProjects = projects.filter((p) => p.status !== 'archived' && p.status !== 'completed');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Growth & Tracking Portal"
        description={`Welcome to your dedicated workspace with Bounce Growth. Tracking setups, approved campaigns, and deliverables for ${currentUser?.displayName || 'your account'}.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/portal/support')}
          >
            Contact Account Manager
          </Button>
        }
      />

      {/* Client Boundary Privacy Card */}
      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">Protected Client Space: {currentUser?.displayName || 'Client Account'}</p>
            <p className="text-[11px] text-slate-600">
              Only approved deliverables, shared tracking reports, and invoices for your account are displayed.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-block text-[11px] font-semibold text-blue-700 bg-white border border-blue-200 px-2.5 py-1 rounded-md">
          Client Workspace Isolated
        </span>
      </div>

      {/* Client KPI Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Approved Projects</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {activeProjects.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Active tracking & media campaigns</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Configured Tracking Assets</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {assets.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Shared Pixels & GTM containers</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Published Reports</span>
            <BarChart2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">0</div>
            <p className="text-[11px] text-slate-400 mt-1">Attribution & ROAS dashboards</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Open Invoices</span>
            <Receipt className="w-4 h-4 text-slate-700" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">$0.00</div>
            <p className="text-[11px] text-slate-400 mt-1">Retainer and service billing</p>
          </div>
        </Card>
      </div>

      {/* Main Client Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Active Engagements"
            subtitle="Projects authorized for client review"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/portal/projects')} icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                View All
              </Button>
            }
          />
          {projects.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="w-6 h-6 text-slate-400" />}
              title="No active projects shared yet"
              description="When Bounce Growth specialists initiate approved projects for your brand, they will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.slice(0, 4).map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-500">Status: {p.status.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-mono font-medium text-blue-600">{p.progressPercentage}%</span>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/portal/projects')} className="h-7 text-xs">
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Shared Tracking Infrastructure"
            subtitle="Pixels and server containers configured for your store"
          />
          {assets.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-6 h-6 text-slate-400" />}
              title="No tracking assets shared yet"
              description="Meta Pixels, GA4 Measurement IDs, and GTM container details will be visible here once configured."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {assets.slice(0, 4).map((a) => (
                <div key={a.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{a.name}</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      {a.measurementId || a.containerId || a.pixelId || a.serverContainerUrl}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {a.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
