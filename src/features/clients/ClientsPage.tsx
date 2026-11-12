import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Table, Column } from '../../components/common/Table';
import {
  Users,
  Plus,
  Search,
  Globe,
  Mail,
  Phone,
  Shield,
  Send,
  UserCheck,
  Archive,
  RotateCcw,
  ExternalLink,
  Edit,
  CheckCircle2,
  Clock,
  Briefcase,
  Activity,
  ChevronRight,
  Trash2,
  Filter,
  X,
  Info,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ClientProfile, ClientStatus, ServiceCategory, ClientInvitation } from '../../types/client';
import {
  subscribeClients,
  createClient,
  updateClient,
  deleteClient,
  archiveClient,
  restoreClient,
  inviteClientContact,
  subscribeClientInvitations,
  activateClientPortalAccess,
  getClientInternalNotes,
  migrateExistingInternalNotes,
} from '../../services/clients/clientService';
import { createTeamMember } from '../../services/team/teamService';
import { db } from '../../services/firebase/client';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile } from '../../types/user';
import {
  subscribePendingUsers,
  approveAndLinkClient,
  rejectPendingUser,
} from '../../services/users/userService';
import { formatCurrency, formatDate } from '../../utils/formatters';

const ALL_SERVICES: { value: ServiceCategory; label: string }[] = [
  { value: 'server_side_tracking', label: 'Server-Side GTM & Meta CAPI' },
  { value: 'meta_ads', label: 'Meta Ads (Facebook & Instagram)' },
  { value: 'google_ads', label: 'Google Search & Performance Max Ads' },
  { value: 'ga4', label: 'GA4 Enhanced E-commerce Tracking' },
  { value: 'looker_studio', label: 'Looker Studio Executive Dashboards' },
  { value: 'cro', label: 'Conversion Rate Optimization (CRO)' },
  { value: 'tiktok_ads', label: 'TikTok Ads & Events API' },
];

export function ClientsPage() {
  const { currentUser, isLiveAuth, firebaseUser, signInWithGoogle } = useAuth();
  const actor = {
    uid: firebaseUser?.uid || currentUser?.id || 'usr_admin_bounce',
    email: firebaseUser?.email || currentUser?.email || 'founder@bouncegrowth.com',
    role: currentUser?.role || 'admin',
  };

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Form State
  const [formBusinessName, setFormBusinessName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formBusinessType, setFormBusinessType] = useState('');
  const [formIndustry, setFormIndustry] = useState('');
  const [formCountry, setFormCountry] = useState('Bangladesh');
  const [formStatus, setFormStatus] = useState<ClientStatus>('onboarding');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'BDT'>('BDT');
  const [formRetainer, setFormRetainer] = useState('');
  const [formServices, setFormServices] = useState<ServiceCategory[]>([]);
  const [formInternalNotes, setFormInternalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Onboarding invitation state
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [activateUid, setActivateUid] = useState('');

  // Internal Notes isolation & migration state
  const [detailNotes, setDetailNotes] = useState<string>('');
  const [loadingDetailNotes, setLoadingDetailNotes] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  // Delete Client State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientProfile | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // One-Click Pending User Approvals State
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [approvingUid, setApprovingUid] = useState<string | null>(null);
  const [approvingTeamUid, setApprovingTeamUid] = useState<string | null>(null);
  const [rejectingUid, setRejectingUid] = useState<string | null>(null);
  const [selectedClientForUser, setSelectedClientForUser] = useState<Record<string, string>>({});
  const [approvalAlert, setApprovalAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDeleteClientConfirm = async () => {
    if (!clientToDelete) return;
    try {
      setIsDeletingClient(true);
      await deleteClient(clientToDelete.id, clientToDelete.businessName, actor);
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete client');
    } finally {
      setIsDeletingClient(false);
    }
  };

  // Real-time listener for Clients (attached only when authenticated; scoped by role)
  useEffect(() => {
    if (!isLiveAuth || !firebaseUser) {
      setClients([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeClients(
      (data) => {
        setClients(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      { actorRole: actor.role, actorUid: actor.uid }
    );

    return () => unsubscribe();
  }, [isLiveAuth, firebaseUser, actor.role, actor.uid]);

  // Listen to invitations and load isolated internal notes for selected client
  useEffect(() => {
    if (selectedClient) {
      setLoadingDetailNotes(true);
      getClientInternalNotes(selectedClient.id).then((notes) => {
        setDetailNotes(notes || selectedClient.internalNotes || '');
        setLoadingDetailNotes(false);
      });

      const unsub = subscribeClientInvitations(
        selectedClient.id,
        (invs) => setInvitations(invs),
        (err) => console.warn('Could not load invitations:', err)
      );
      return () => unsub();
    }
  }, [selectedClient?.id]);

  // Real-time listener for pending client registrations awaiting approval
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      setPendingUsers([]);
      return;
    }

    const unsubPending = subscribePendingUsers(
      (users) => {
        setPendingUsers(users);
        // Pre-select matching client if contact email matches
        setSelectedClientForUser((prev) => {
          const next = { ...prev };
          users.forEach((u) => {
            if (!next[u.id]) {
              const matchedClient = clients.find(
                (c) => c.email && u.email && c.email.toLowerCase().trim() === u.email.toLowerCase().trim()
              );
              if (matchedClient) {
                next[u.id] = matchedClient.id;
              } else if (clients.length > 0) {
                next[u.id] = clients[0].id;
              }
            }
          });
          return next;
        });
      },
      (err) => console.warn('[ClientsPage] Pending users subscription warning:', err)
    );

    return () => unsubPending();
  }, [currentUser, clients]);

  const handleOneClickApprove = async (user: UserProfile) => {
    const assignedClientId = selectedClientForUser[user.id] || clients[0]?.id;
    if (!assignedClientId) {
      alert('Please register or select a client organization to link this user.');
      return;
    }
    const targetClient = clients.find((c) => c.id === assignedClientId);
    try {
      setApprovingUid(user.id);
      await approveAndLinkClient(user.id, assignedClientId, actor);
      setApprovalAlert({
        type: 'success',
        message: `Approved! ${user.displayName || user.email} now has active access to ${targetClient?.businessName || 'Client Portal'}.`,
      });
      setTimeout(() => setApprovalAlert(null), 6000);
    } catch (err: any) {
      setApprovalAlert({
        type: 'error',
        message: err.message || 'Failed to approve user',
      });
    } finally {
      setApprovingUid(null);
    }
  };

  const handleRejectUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to suspend/reject portal access for ${user.displayName || user.email}?`)) {
      return;
    }
    try {
      setRejectingUid(user.id);
      await rejectPendingUser(user.id, actor);
      setApprovalAlert({
        type: 'success',
        message: `Registration for ${user.email} has been suspended.`,
      });
      setTimeout(() => setApprovalAlert(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to reject user');
    } finally {
      setRejectingUid(null);
    }
  };

  const handleApproveAsTeamMember = async (user: UserProfile) => {
    try {
      setApprovingTeamUid(user.id);
      // Check if already in team_members or create
      const teamQ = query(collection(db, 'team_members'), where('email', '==', user.email.toLowerCase().trim()));
      const teamSnaps = await getDocs(teamQ);
      if (teamSnaps.empty) {
        await createTeamMember(
          {
            name: user.displayName || 'Agency Specialist',
            email: user.email,
            role: 'team',
            title: 'Agency Specialist',
            department: 'Tracking & Attribution',
            skills: ['Tracking', 'Analytics'],
            status: 'active',
          },
          actor
        );
      } else {
        const tDoc = teamSnaps.docs[0];
        await updateDoc(doc(db, 'team_members', tDoc.id), {
          userId: user.id,
          status: 'active',
          updatedAt: new Date().toISOString(),
        });
      }

      // Update users/{uid}
      await updateDoc(doc(db, 'users', user.id), {
        role: 'team',
        status: 'active',
        title: user.title && user.title !== 'Pending Verification' ? user.title : 'Agency Specialist',
        updatedAt: new Date().toISOString(),
      });

      setApprovalAlert({
        type: 'success',
        message: `Approved! ${user.displayName || user.email} is now an Active Team Specialist with Admin Console access.`,
      });
      setTimeout(() => setApprovalAlert(null), 6000);
    } catch (err: any) {
      setApprovalAlert({
        type: 'error',
        message: err.message || 'Failed to approve as team specialist',
      });
    } finally {
      setApprovingTeamUid(null);
    }
  };

  const resetForm = () => {
    setFormBusinessName('');
    setFormContactPerson('');
    setFormEmail('');
    setFormPhone('');
    setFormWebsite('');
    setFormBusinessType('');
    setFormIndustry('');
    setFormCountry('Bangladesh');
    setFormStatus('onboarding');
    setFormCurrency('BDT');
    setFormRetainer('');
    setFormServices([]);
    setFormInternalNotes('');
    setFormError(null);
    setInviteSuccess(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (client: ClientProfile) => {
    setSelectedClient(client);
    setFormBusinessName(client.businessName);
    setFormContactPerson(client.contactPerson || client.primaryContact?.name || '');
    setFormEmail(client.email || client.primaryContact?.email || '');
    setFormPhone(client.phone || client.primaryContact?.phone || '');
    setFormWebsite(client.website || '');
    setFormBusinessType(client.businessType || 'E-commerce');
    setFormIndustry(client.industry || 'Retail & Fashion');
    setFormCountry(client.country || 'Bangladesh');
    setFormStatus(client.status);
    setFormCurrency(client.currency);
    setFormRetainer(String(client.monthlyRetainer || 0));
    setFormServices(client.servicesSubscribed || []);
    setFormInternalNotes(client.internalNotes || '');
    setFormError(null);

    // Asynchronously fetch notes from isolated collection
    getClientInternalNotes(client.id).then((notes) => {
      if (notes) setFormInternalNotes(notes);
    });

    setIsEditModalOpen(true);
  };

  const handleRunMigration = async () => {
    if (isMigrating) return;
    setIsMigrating(true);
    setMigrationStatus('Running internal notes migration...');
    const res = await migrateExistingInternalNotes(actor);
    setIsMigrating(false);
    if (res.errors.length > 0) {
      setMigrationStatus(`Migration completed with errors: ${res.errors.join('; ')}`);
    } else {
      setMigrationStatus(`Migration verified! Scanned ${res.scanned} clients. Migrated ${res.migrated} legacy internal notes to /client_internal_notes. Already clean: ${res.alreadyClean}.`);
    }
  };

  const openDetailDrawer = (client: ClientProfile) => {
    setSelectedClient(client);
    setInviteEmail(client.email || client.primaryContact?.email || '');
    setInviteName(client.contactPerson || client.primaryContact?.name || '');
    setIsDetailDrawerOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (!isLiveAuth || !firebaseUser) {
      try {
        await signInWithGoogle();
      } catch (err: any) {
        setFormError('Authentication required: You must sign in with Google to create a client in Cloud Firestore.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await createClient(
        {
          businessName: formBusinessName,
          contactPerson: formContactPerson,
          email: formEmail,
          phone: formPhone,
          website: formWebsite,
          businessType: formBusinessType,
          industry: formIndustry,
          country: formCountry,
          timezone: 'Asia/Dhaka',
          status: formStatus,
          monthlyRetainer: Number(formRetainer) || 0,
          currency: formCurrency,
          servicesSubscribed: formServices,
          primaryContact: {
            name: formContactPerson,
            email: formEmail,
            phone: formPhone,
            isPrimary: true,
          },
          assignedSpecialists: [],
          internalNotes: formInternalNotes,
        },
        actor
      );

      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      await updateClient(
        selectedClient.id,
        {
          businessName: formBusinessName,
          contactPerson: formContactPerson,
          email: formEmail,
          phone: formPhone,
          website: formWebsite,
          businessType: formBusinessType,
          industry: formIndustry,
          country: formCountry,
          status: formStatus,
          monthlyRetainer: Number(formRetainer) || 0,
          currency: formCurrency,
          servicesSubscribed: formServices,
          primaryContact: {
            name: formContactPerson,
            email: formEmail,
            phone: formPhone,
            isPrimary: true,
          },
          internalNotes: formInternalNotes,
        },
        actor
      );

      setIsEditModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async (client: ClientProfile) => {
    if (client.status === 'archived') {
      await restoreClient(client.id, 'active', actor);
    } else {
      if (confirm(`Archive client organization '${client.businessName}'?`)) {
        await archiveClient(client.id, actor);
      }
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setInviteSuccess(null);
    try {
      const inv = await inviteClientContact(
        {
          clientId: selectedClient.id,
          clientName: selectedClient.businessName,
          contactEmail: inviteEmail,
          contactName: inviteName,
        },
        actor
      );
      setInviteSuccess(`Invitation created for ${inv.contactEmail}. They can now authenticate via Google.`);
    } catch (err: any) {
      alert(err.message || 'Failed to send invitation');
    }
  };

  const handleActivateAccess = async (userUid: string, invitationId?: string) => {
    if (!selectedClient || !userUid.trim()) return;
    try {
      await activateClientPortalAccess(selectedClient.id, userUid.trim(), invitationId, actor);
      alert(`Client Portal access granted for UID: ${userUid}`);
      setActivateUid('');
    } catch (err: any) {
      alert(err.message || 'Failed to activate portal access');
    }
  };

  const toggleService = (svc: ServiceCategory) => {
    setFormServices((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
    );
  };

  // Filter clients
  const filteredClients = clients.filter((c) => {
    if (activeTab === 'active' && c.status !== 'active') return false;
    if (activeTab === 'onboarding' && c.status !== 'onboarding') return false;
    if (activeTab === 'paused' && c.status !== 'paused') return false;
    if (activeTab === 'archived' && c.status !== 'archived') return false;
    if (activeTab === 'all' && c.status === 'archived') return false; // Hide archived in main tab

    if (currencyFilter !== 'all' && c.currency !== currencyFilter) return false;
    if (industryFilter !== 'all' && c.industry !== industryFilter) return false;
    if (
      serviceFilter !== 'all' &&
      (!c.servicesSubscribed || !c.servicesSubscribed.includes(serviceFilter as ServiceCategory))
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        c.businessName.toLowerCase().includes(query) ||
        (c.website && c.website.toLowerCase().includes(query)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.industry && c.industry.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const columns: Column<ClientProfile>[] = [
    {
      header: 'Client Business',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
            {row.businessName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>{row.businessName}</span>
              {row.website && (
                <a
                  href={row.website}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-slate-400 hover:text-blue-600"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-[11px] text-slate-400">{row.businessType || 'E-commerce'} · {row.country}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Primary Contact',
      cell: (row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-800">{row.contactPerson || row.primaryContact?.name}</p>
          <p className="text-[11px] text-slate-500">{row.email || row.primaryContact?.email}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => {
        const statusColors: Record<ClientStatus, string> = {
          active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          onboarding: 'bg-blue-50 text-blue-700 border-blue-200',
          lead: 'bg-amber-50 text-amber-700 border-amber-200',
          paused: 'bg-slate-100 text-slate-700 border-slate-200',
          churned: 'bg-rose-50 text-rose-700 border-rose-200',
          archived: 'bg-slate-100 text-slate-400 border-slate-200',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusColors[row.status] || 'bg-slate-50'}`}>
            {row.status.toUpperCase()}
          </span>
        );
      },
    },
    {
      header: 'Monthly Retainer',
      isNumeric: true,
      cell: (row) => (
        <span className="font-semibold text-slate-900 tabular-nums">
          {formatCurrency(row.monthlyRetainer || 0, row.currency)}
        </span>
      ),
    },
    {
      header: 'Portal Access',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>{row.portalAccessUserIds?.length || 0} active reps</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDetailDrawer(row)}
            icon={<Info className="w-3.5 h-3.5" />}
            className="text-xs text-slate-600 h-7 px-2"
          >
            Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
            icon={<Edit className="w-3.5 h-3.5" />}
            className="text-xs text-slate-600 h-7 px-2"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleArchiveToggle(row)}
            icon={row.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 text-emerald-600" /> : <Archive className="w-3.5 h-3.5 text-slate-400" />}
            className="text-xs h-7 px-2"
          >
            {row.status === 'archived' ? 'Restore' : 'Archive'}
          </Button>
          {actor.role === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setClientToDelete(row);
                setIsDeleteModalOpen(true);
              }}
              icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
              className="text-xs h-7 px-2 text-red-600 hover:bg-red-50"
              title="Delete Client"
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Portfolio & Accounts"
        description="Live Firestore account management for Bounce Growth clients. Internal agency notes and financials are protected by database security rules."
        actions={
          <div className="flex items-center gap-2">
            {actor.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleRunMigration}
                loading={isMigrating}
              >
                Migrate Notes
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={openCreateModal}
            >
              Register Client
            </Button>
          </div>
        }
      />

      {migrationStatus && (
        <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-xs text-blue-900 flex items-center justify-between">
          <p>{migrationStatus}</p>
          <button onClick={() => setMigrationStatus(null)} className="text-blue-600 font-bold ml-2">×</button>
        </div>
      )}

      {error && <ErrorState title="Failed to synchronize clients" message={error} />}

      {!isLiveAuth && (
        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs text-slate-700">
              <strong className="font-semibold text-slate-900">Live Cloud Firestore Authentication:</strong> Sign in with Google to synchronize live Client accounts in database <code className="text-[11px] font-mono text-blue-800">ai-studio-bouncegrowthagen</code>.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={signInWithGoogle} className="text-xs shrink-0">
            Sign in with Google
          </Button>
        </div>
      )}

      {approvalAlert && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 shadow-xs ${
            approvalAlert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {approvalAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{approvalAlert.message}</span>
          </div>
          <button
            onClick={() => setApprovalAlert(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {pendingUsers.length > 0 && activeTab !== 'pending' && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">
                  {pendingUsers.length} Client {pendingUsers.length === 1 ? 'Representative' : 'Representatives'} Awaiting Approval
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-bold">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                New users have signed in with Google. Review and grant 1-click portal authorization.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setActiveTab('pending')}
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-semibold cursor-pointer"
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Review & 1-Click Approve ({pendingUsers.length})
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Active Clients', count: clients.filter((c) => c.status !== 'archived').length },
            { id: 'active', label: 'Active Retainers', count: clients.filter((c) => c.status === 'active').length },
            { id: 'onboarding', label: 'Onboarding', count: clients.filter((c) => c.status === 'onboarding').length },
            { id: 'paused', label: 'Paused', count: clients.filter((c) => c.status === 'paused').length },
            { id: 'archived', label: 'Archived', count: clients.filter((c) => c.status === 'archived').length },
            { id: 'pending', label: 'Pending Approvals', count: pendingUsers.length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab !== 'pending' && (
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by name, website, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        )}
      </div>

      {activeTab === 'pending' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start gap-3 text-xs text-blue-900 shadow-2xs">
            <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-950">1-Click Client Portal Authorization</p>
              <p className="text-blue-800 mt-0.5 leading-relaxed">
                Assign each user to their client business organization and click <strong>"1-Click Approve"</strong>. Their account will immediately become active and linked to their company's portal.
              </p>
            </div>
          </div>

          {pendingUsers.length === 0 ? (
            <Card className="py-12 text-center">
              <EmptyState
                icon={<CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />}
                title="No Pending Approvals"
                description="All registered client contacts have been verified and assigned to their organizations."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {pendingUsers.map((user) => {
                const assignedClientId = selectedClientForUser[user.id] || clients[0]?.id || '';
                const matchedClient = clients.find(
                  (c) => c.email && user.email && c.email.toLowerCase().trim() === user.email.toLowerCase().trim()
                );
                const isApproving = approvingUid === user.id;
                const isRejecting = rejectingUid === user.id;

                return (
                  <Card
                    key={user.id}
                    className="p-4 sm:p-5 border-amber-200/80 bg-white hover:border-amber-300 transition-all shadow-xs"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* User Info */}
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                          {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">
                              {user.displayName || 'External Contact'}
                            </h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              AWAITING APPROVAL
                            </span>
                            {matchedClient && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-blue-600" /> Matched with {matchedClient.businessName}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1 text-slate-700 font-medium">
                              <Mail className="w-3.5 h-3.5 text-slate-400" /> {user.email}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                              UID: {user.id}
                            </span>
                            <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                              <Clock className="w-3.5 h-3.5" /> {formatDate(user.createdAt || new Date().toISOString())}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Organization Selection & 1-Click Action */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <div className="min-w-[220px]">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Assign to Client Organization:
                          </label>
                          <select
                            value={assignedClientId}
                            onChange={(e) =>
                              setSelectedClientForUser((prev) => ({ ...prev, [user.id]: e.target.value }))
                            }
                            disabled={clients.length === 0 || isApproving}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            {clients.length === 0 ? (
                              <option value="">No clients registered yet</option>
                            ) : (
                              clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.businessName} {c.contactPerson ? `(${c.contactPerson})` : ''}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto sm:pt-4">
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => handleOneClickApprove(user)}
                            loading={isApproving}
                            disabled={isRejecting || approvingTeamUid === user.id || clients.length === 0}
                            icon={<CheckCircle2 className="w-4 h-4" />}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold text-xs whitespace-nowrap cursor-pointer"
                          >
                            1-Click Approve (Client)
                          </Button>

                          <Button
                            variant="outline"
                            size="md"
                            onClick={() => handleApproveAsTeamMember(user)}
                            loading={approvingTeamUid === user.id}
                            disabled={isApproving || isRejecting}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-semibold whitespace-nowrap cursor-pointer"
                          >
                            Approve as Team Specialist
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRejectUser(user)}
                            loading={isRejecting}
                            disabled={isApproving || approvingTeamUid === user.id}
                            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Filter Clients:</span>
              </div>

              {/* Service Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Service:</span>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px]"
                >
                  <option value="all">All Services</option>
                  {ALL_SERVICES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Currency Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Currency:</span>
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Currencies</option>
                  <option value="BDT">BDT (৳ - Bangladeshi Taka)</option>
                  <option value="USD">USD ($ - US Dollars)</option>
                </select>
              </div>
            </div>

            {/* Reset filter button */}
            {(serviceFilter !== 'all' || currencyFilter !== 'all' || industryFilter !== 'all' || searchQuery.trim() !== '') && (
              <button
                onClick={() => {
                  setServiceFilter('all');
                  setCurrencyFilter('all');
                  setIndustryFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Reset Filters
              </button>
            )}
          </div>

          {isLoading ? (
            <LoadingState rows={5} message="Streaming clients from Cloud Firestore..." />
          ) : (
            <Card noPadding>
              <Table
                columns={columns}
                data={filteredClients}
                keyExtractor={(c) => c.id}
                onRowClick={(c) => openDetailDrawer(c)}
                emptyMessage={
                  searchQuery
                    ? 'No clients match your search query.'
                    : 'No clients registered in Cloud Firestore yet. Click "Register Client" to create your first client organization.'
                }
              />
            </Card>
          )}
        </>
      )}

      {/* Register Client Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Client Organization"
        description="Creates a persistent document in Cloud Firestore under /clients/{clientId}."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateSubmit} loading={isSubmitting}>
              Create Client Document
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} autoComplete="off" className="space-y-4">
          {!isLiveAuth && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-amber-900">
                <Shield className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Google sign-in as <strong>hmmojjammalhoq@gmail.com</strong> is required to save clients to Cloud Firestore.</span>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={signInWithGoogle}
                className="shrink-0 text-xs"
              >
                Sign in with Google
              </Button>
            </div>
          )}
          {formError && (
            <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-700 flex flex-col gap-2">
              <p>{formError}</p>
              {!isLiveAuth && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={signInWithGoogle}
                  className="w-fit text-xs"
                >
                  Sign in with Google
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Business / Brand Name"
              placeholder="e.g. Apex Retail BD"
              value={formBusinessName}
              onChange={(e) => setFormBusinessName(e.target.value)}
              required
            />
            <Input
              label="Website Domain"
              placeholder="https://apexretailbd.com"
              value={formWebsite}
              onChange={(e) => setFormWebsite(e.target.value)}
              leftIcon={<Globe className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Primary Contact Person"
              placeholder="Tanvir Ahmed"
              value={formContactPerson}
              onChange={(e) => setFormContactPerson(e.target.value)}
              required
            />
            <Input
              label="Primary Email"
              type="email"
              placeholder="tanvir@apexretailbd.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Phone Number"
              placeholder="+880 1712-000000"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />
            <Input
              label="Business Type"
              placeholder="E-commerce D2C"
              value={formBusinessType}
              onChange={(e) => setFormBusinessType(e.target.value)}
            />
            <Input
              label="Country"
              value={formCountry}
              onChange={(e) => setFormCountry(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Initial Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as ClientStatus)}
              options={[
                { value: 'onboarding', label: 'Onboarding & GTM Setup' },
                { value: 'active', label: 'Active Retainer' },
                { value: 'lead', label: 'Lead / Trial' },
                { value: 'paused', label: 'Paused' },
              ]}
            />
            <Select
              label="Billing Currency"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value as 'USD' | 'BDT')}
              options={[
                { value: 'USD', label: 'USD ($)' },
                { value: 'BDT', label: 'BDT (৳ - Taka)' },
              ]}
            />
            <Input
              label="Monthly Retainer"
              type="number"
              value={formRetainer}
              onChange={(e) => setFormRetainer(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Services Subscribed ({formServices.length} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_SERVICES.map((svc) => (
                <button
                  type="button"
                  key={svc.value}
                  onClick={() => toggleService(svc.value)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                    formServices.includes(svc.value)
                      ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-medium'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formServices.includes(svc.value)}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span>{svc.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Internal Agency Notes</span>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                Agency Only (Protected from clients)
              </span>
            </label>
            <textarea
              rows={3}
              value={formInternalNotes}
              onChange={(e) => setFormInternalNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Technical quirks, staging URLs, proxy settings, or margin parameters..."
            />
          </div>
        </form>
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Client: ${selectedClient?.businessName}`}
        description="Updates client profile in Cloud Firestore."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditSubmit} loading={isSubmitting}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} autoComplete="off" className="space-y-4">
          {formError && <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{formError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Business / Brand Name"
              value={formBusinessName}
              onChange={(e) => setFormBusinessName(e.target.value)}
              required
            />
            <Input
              label="Website Domain"
              value={formWebsite}
              onChange={(e) => setFormWebsite(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Primary Contact Person"
              value={formContactPerson}
              onChange={(e) => setFormContactPerson(e.target.value)}
              required
            />
            <Input
              label="Primary Email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as ClientStatus)}
              options={[
                { value: 'active', label: 'Active Retainer' },
                { value: 'onboarding', label: 'Onboarding & GTM Setup' },
                { value: 'lead', label: 'Lead' },
                { value: 'paused', label: 'Paused' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
            <Select
              label="Billing Currency"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value as 'USD' | 'BDT')}
              options={[
                { value: 'USD', label: 'USD ($)' },
                { value: 'BDT', label: 'BDT (৳ - Taka)' },
              ]}
            />
            <Input
              label="Monthly Retainer"
              type="number"
              value={formRetainer}
              onChange={(e) => setFormRetainer(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Internal Agency Notes</span>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                Agency Internal Only
              </span>
            </label>
            <textarea
              rows={3}
              value={formInternalNotes}
              onChange={(e) => setFormInternalNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </form>
      </Modal>

      {/* Client Detail & Onboarding Drawer/Modal */}
      {selectedClient && (
        <Modal
          isOpen={isDetailDrawerOpen}
          onClose={() => setIsDetailDrawerOpen(false)}
          title={selectedClient.businessName}
          description={`Client ID: ${selectedClient.id}`}
          maxWidth="lg"
          footer={
            <Button variant="outline" size="sm" onClick={() => setIsDetailDrawerOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-6 text-xs text-slate-700">
            {/* Overview Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Status</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedClient.status.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Retainer</p>
                <p className="font-bold text-slate-900 mt-0.5 tabular-nums">
                  {formatCurrency(selectedClient.monthlyRetainer || 0, selectedClient.currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Created</p>
                <p className="text-slate-800 mt-0.5">{formatDate(selectedClient.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Portal Users</p>
                <p className="font-bold text-blue-600 mt-0.5">{selectedClient.portalAccessUserIds?.length || 0} UIDs</p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <h4 className="font-semibold text-slate-900 text-xs">Primary Contact & Domain</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                <p><strong>Name:</strong> {selectedClient.contactPerson || selectedClient.primaryContact?.name}</p>
                <p><strong>Email:</strong> {selectedClient.email || selectedClient.primaryContact?.email}</p>
                <p><strong>Phone:</strong> {selectedClient.phone || selectedClient.primaryContact?.phone || '—'}</p>
                <p><strong>Website:</strong> {selectedClient.website || '—'}</p>
              </div>
            </div>

            {/* Subscribed Services */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <h4 className="font-semibold text-slate-900 text-xs">Subscribed Agency Services</h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedClient.servicesSubscribed?.map((svc) => (
                  <span key={svc} className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium text-[11px] border border-blue-100">
                    {svc.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Internal Agency Notes (Isolated from Client documents) */}
            <div className="space-y-1.5 border-b border-slate-100 pb-4 bg-amber-50/50 p-3 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between text-amber-900 font-semibold text-xs">
                <span>Internal Agency Notes</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300">
                  Isolated in /client_internal_notes
                </span>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {loadingDetailNotes
                  ? 'Loading isolated internal notes...'
                  : (detailNotes || 'No internal notes recorded for this client.')}
              </p>
            </div>

            {/* Onboarding & Portal Invitation Flow (Phase 3 Core Feature) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Client Onboarding & Portal Invitations</h4>
                  <p className="text-[11px] text-slate-500">
                    Invite client representatives to authenticate and link to this workspace.
                  </p>
                </div>
              </div>

              {inviteSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{inviteSuccess}</span>
                </div>
              )}

              {/* Send Invitation Form */}
              <form onSubmit={handleSendInvitation} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <p className="font-semibold text-slate-800 text-[11px]">Issue Portal Invitation</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Representative Name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Authorized Google Email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <Button variant="secondary" size="sm" type="submit" icon={<Send className="w-3.5 h-3.5" />}>
                  Dispatch Invitation
                </Button>
              </form>

              {/* Existing Invitations List */}
              <div className="space-y-2">
                <p className="font-semibold text-slate-800 text-[11px]">Pending & Claimed Invitations ({invitations.length})</p>
                {invitations.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No invitations issued yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-2 rounded border border-slate-200 bg-white text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">{inv.contactName} ({inv.contactEmail})</p>
                          <p className="text-[10px] text-slate-400">Created: {formatDate(inv.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'claimed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {inv.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct Portal Activation by UID */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900 text-[11px]">Authorize Authenticated Google UID</p>
                    <p className="text-[10px] text-blue-700">
                      When a contact signs in via Google, enter their UID below to explicitly grant access to this client portal.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter User UID (e.g. from Users tab)"
                    value={activateUid}
                    onChange={(e) => setActivateUid(e.target.value)}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleActivateAccess(activateUid)}
                    disabled={!activateUid.trim()}
                  >
                    Authorize
                  </Button>
                </div>

                {pendingUsers.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-blue-200/60">
                    <p className="text-[10px] font-bold text-blue-900 uppercase">
                      Or 1-Click Link from Pending Users ({pendingUsers.length}):
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {pendingUsers.map((pUser) => (
                        <div
                          key={pUser.id}
                          className="flex items-center justify-between p-2 rounded bg-white border border-blue-200 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{pUser.displayName || 'Contact'} ({pUser.email})</p>
                            <p className="text-[10px] text-slate-500 font-mono">UID: {pUser.id}</p>
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                            onClick={async () => {
                              try {
                                await approveAndLinkClient(pUser.id, selectedClient.id, actor);
                                alert(`Approved! ${pUser.displayName || pUser.email} is now linked to ${selectedClient.businessName}`);
                              } catch (e: any) {
                                alert(e.message || 'Failed to approve');
                              }
                            }}
                          >
                            1-Click Link
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Client Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setClientToDelete(null);
        }}
        title="Permanently Delete Client Organization"
        description="Are you sure you want to permanently delete this client? All organization records will be removed."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setClientToDelete(null);
              }}
              disabled={isDeletingClient}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteClientConfirm}
              loading={isDeletingClient}
            >
              Permanently Delete Client
            </Button>
          </>
        }
      >
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-800 space-y-1">
          <p className="font-semibold">{clientToDelete?.businessName}</p>
          <p className="text-slate-600">
            Primary Contact: {clientToDelete?.contactPerson} ({clientToDelete?.email})
          </p>
          <p className="text-red-700 font-medium mt-2">
            Warning: This action deletes the client document from Cloud Firestore and cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
