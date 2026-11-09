import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Briefcase,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Sparkles,
  Layers,
  UserCheck,
  UserX,
  Code,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { useAuth } from '../auth/AuthContext';
import { TeamMember, TeamRole, TeamStatus } from '../../types/team';
import { ClientProfile } from '../../types/client';
import {
  subscribeTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from '../../services/team/teamService';
import { subscribeClients } from '../../services/clients/clientService';

const DEPARTMENTS = [
  'Tracking & Attribution',
  'Paid Media & Scaling',
  'CRO & Funnel Analytics',
  'Client Strategy & Operations',
  'Creative & Ad Copywriting',
];

export function TeamPage() {
  const { currentUser, currentRole, isLiveAuth, signInWithGoogle } = useAuth();

  // Real-time state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Form states (Add)
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<TeamRole>('team');
  const [formTitle, setFormTitle] = useState('');
  const [formDepartment, setFormDepartment] = useState(DEPARTMENTS[0]);
  const [formPhone, setFormPhone] = useState('');
  const [formSkillInput, setFormSkillInput] = useState('');
  const [formSkills, setFormSkills] = useState<string[]>([]);
  const [formSelectedClients, setFormSelectedClients] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Status feedback
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Subscriptions
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubTeam = subscribeTeamMembers(
      (data) => {
        setMembers(data);
        setLoading(false);
      },
      (err) => {
        console.warn('Team subscription warning:', err);
        setLoading(false);
      }
    );

    const unsubClients = subscribeClients(
      (data) => setClients(data),
      (err) => console.warn('Clients subscription warning:', err),
      { actorRole: currentRole || 'admin', actorUid: currentUser.id }
    );

    return () => {
      unsubTeam();
      unsubClients();
    };
  }, [currentUser, currentRole]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Department filter
      if (deptFilter !== 'all' && member.department !== deptFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = member.name.toLowerCase().includes(q);
        const matchesEmail = member.email.toLowerCase().includes(q);
        const matchesTitle = member.title.toLowerCase().includes(q);
        const matchesSkills = member.skills.some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesEmail && !matchesTitle && !matchesSkills) {
          return false;
        }
      }
      return true;
    });
  }, [members, deptFilter, searchQuery]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.status === 'active').length;
    const tracking = members.filter((m) => m.department === 'Tracking & Attribution').length;
    const media = members.filter((m) => m.department === 'Paid Media & Scaling').length;
    return { total, active, tracking, media };
  }, [members]);

  // Handlers: Add
  const handleOpenAddModal = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('team');
    setFormTitle('');
    setFormDepartment(DEPARTMENTS[0]);
    setFormPhone('');
    setFormSkillInput('');
    setFormSkills([]);
    setFormSelectedClients([]);
    setAlertError(null);
    setIsAddModalOpen(true);
  };

  const handleAddSkill = () => {
    if (formSkillInput.trim() && !formSkills.includes(formSkillInput.trim())) {
      setFormSkills([...formSkills, formSkillInput.trim()]);
      setFormSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormSkills(formSkills.filter((s) => s !== skillToRemove));
  };

  const handleToggleClientAssign = (clientId: string) => {
    if (formSelectedClients.includes(clientId)) {
      setFormSelectedClients(formSelectedClients.filter((id) => id !== clientId));
    } else {
      setFormSelectedClients([...formSelectedClients, clientId]);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!formName.trim() || !formEmail.trim() || !formTitle.trim()) {
      setAlertError('Please provide a specialist name, email, and job title.');
      return;
    }

    setSubmitting(true);
    setAlertError(null);

    const assignedClientNames = clients
      .filter((c) => formSelectedClients.includes(c.id))
      .map((c) => c.businessName);

    try {
      await createTeamMember(
        {
          name: formName,
          email: formEmail,
          role: formRole,
          title: formTitle,
          department: formDepartment,
          skills: formSkills,
          phone: formPhone,
          assignedClients: formSelectedClients,
          assignedClientNames,
          status: 'active',
        },
        {
          uid: currentUser.id,
          email: currentUser.email,
          role: currentRole || 'admin',
          name: currentUser.displayName,
        }
      );

      setIsAddModalOpen(false);
      setAlertSuccess(`Specialist "${formName}" successfully added.`);
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to add team member.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handlers: Edit
  const handleOpenEditModal = (member: TeamMember) => {
    setSelectedMember(member);
    setFormName(member.name);
    setFormEmail(member.email);
    setFormRole(member.role);
    setFormTitle(member.title);
    setFormDepartment(member.department);
    setFormPhone(member.phone || '');
    setFormSkillInput('');
    setFormSkills(member.skills || []);
    setFormSelectedClients(member.assignedClients || []);
    setAlertError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !currentUser) return;

    if (!formName.trim() || !formEmail.trim() || !formTitle.trim()) {
      setAlertError('Please provide a specialist name, email, and job title.');
      return;
    }

    setSubmitting(true);
    setAlertError(null);

    const assignedClientNames = clients
      .filter((c) => formSelectedClients.includes(c.id))
      .map((c) => c.businessName);

    try {
      await updateTeamMember(
        selectedMember.id,
        {
          name: formName,
          email: formEmail,
          role: formRole,
          title: formTitle,
          department: formDepartment,
          skills: formSkills,
          phone: formPhone,
          assignedClients: formSelectedClients,
          assignedClientNames,
        },
        {
          uid: currentUser.id,
          email: currentUser.email,
          role: currentRole || 'admin',
          name: currentUser.displayName,
        }
      );

      setIsEditModalOpen(false);
      setSelectedMember(null);
      setAlertSuccess(`Specialist profile for "${formName}" updated.`);
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to update specialist profile.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handlers: Delete
  const handleOpenDeleteModal = (member: TeamMember) => {
    setSelectedMember(member);
    setAlertError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedMember || !currentUser) return;

    setSubmitting(true);
    setAlertError(null);

    try {
      await deleteTeamMember(selectedMember.id, selectedMember.name, {
        uid: currentUser.id,
        email: currentUser.email,
        role: currentRole || 'admin',
      });

      setIsDeleteModalOpen(false);
      setSelectedMember(null);
      setAlertSuccess(`Specialist "${selectedMember.name}" removed from agency roster.`);
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to remove team specialist.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle active/suspended
  const handleToggleStatus = async (member: TeamMember) => {
    if (!currentUser) return;
    const nextStatus: TeamStatus = member.status === 'active' ? 'suspended' : 'active';

    try {
      await updateTeamMember(
        member.id,
        { status: nextStatus },
        {
          uid: currentUser.id,
          email: currentUser.email,
          role: currentRole || 'admin',
        }
      );
      setAlertSuccess(
        `Specialist "${member.name}" marked as ${nextStatus === 'active' ? 'Active' : 'Suspended'}.`
      );
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to update specialist status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Agency Team & Specialist Roster"
        description="Manage Bounce Growth tracking engineers, media buyers, and managers. Assign clients and projects with granular access controls."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleOpenAddModal}
          >
            Add Team Specialist
          </Button>
        }
      />

      {/* Notifications */}
      {alertSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{alertSuccess}</span>
          </div>
          <button onClick={() => setAlertSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {alertError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{alertError}</span>
          </div>
          <button onClick={() => setAlertError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isLiveAuth && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Google sign-in as <strong>founder@bouncegrowth.agency</strong> required to manage team permissions in Firestore.
            </span>
          </div>
          <button
            onClick={() => signInWithGoogle()}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shrink-0 cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Specialists</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">
            {metrics.total}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{metrics.active} active in roster</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Tracking Specialists</span>
            <Code className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-emerald-700 mt-2 tabular-nums">
            {metrics.tracking}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">GTM, Meta CAPI & GA4</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Media & Growth Leads</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-purple-700 mt-2 tabular-nums">
            {metrics.media}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Meta, Google & TikTok ads</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Client Brands Managed</span>
            <Briefcase className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-amber-800 mt-2 tabular-nums">
            {clients.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Assigned to team roster</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search specialists by name, email, title, or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Department:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Team Specialist Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
          Loading team roster from Cloud Firestore...
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card>
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No Specialists Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery || deptFilter !== 'all'
                ? 'No specialists matched your filter criteria. Try clearing search filters.'
                : 'Build your agency roster by adding your first tracking engineer or media buyer.'}
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleOpenAddModal}
            >
              Add First Specialist
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMembers.map((member) => (
            <Card
              key={member.id}
              className={`flex flex-col justify-between transition-all hover:shadow-md ${
                member.status === 'suspended' ? 'opacity-60 bg-slate-50 border-dashed border-slate-300' : ''
              }`}
            >
              <div className="space-y-3">
                {/* Header row: Department & Role */}
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[150px]">
                    {member.department}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        member.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {member.role === 'admin' ? 'Agency Admin' : 'Specialist'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(member)}
                      title={member.status === 'active' ? 'Suspend specialist' : 'Activate specialist'}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                        member.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {member.status === 'active' ? 'Active' : 'Suspended'}
                    </button>
                  </div>
                </div>

                {/* Profile info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{member.name}</h3>
                    <p className="text-xs text-blue-700 font-medium truncate">{member.title}</p>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 truncate">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{member.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Skills tags */}
                {member.skills && member.skills.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Technical Skills
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {member.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono"
                        >
                          #{skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned Clients */}
                {member.assignedClientNames && member.assignedClientNames.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Assigned Accounts ({member.assignedClientNames.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {member.assignedClientNames.map((cName, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium"
                        >
                          <Briefcase className="w-3 h-3 text-blue-500" />
                          {cName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => handleOpenEditModal(member)}
                  className="text-xs"
                >
                  Edit Profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                  onClick={() => handleOpenDeleteModal(member)}
                  className="text-xs text-rose-600 hover:text-rose-700"
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: Add Team Specialist
      ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Team Specialist"
        description="Invite or register a tracking engineer, media buyer, or account strategist."
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} autoComplete="off" className="space-y-4">
          <Input
            label="Full Name"
            placeholder="E.g. Tanvir Ahmed"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            autoComplete="off"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="email"
              label="Email Address"
              placeholder="specialist@bouncegrowth.agency"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              autoComplete="off"
              required
            />
            <Input
              label="Phone Number"
              placeholder="+880 1700-000000"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Job Title"
              placeholder="E.g. Senior Tracking Engineer"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              autoComplete="off"
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
              <select
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">RBAC Role Privilege</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormRole('team')}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                  formRole === 'team'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="font-bold block">Specialist</span>
                <span className="text-[11px] text-slate-500">Access to assigned clients, projects, tasks, and deliverables.</span>
              </button>

              <button
                type="button"
                onClick={() => setFormRole('admin')}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                  formRole === 'admin'
                    ? 'border-purple-600 bg-purple-50/50 text-purple-900 ring-1 ring-purple-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="font-bold block">Administrator</span>
                <span className="text-[11px] text-slate-500">Full agency authority: financial ledgers, audit logs, and roster.</span>
              </button>
            </div>
          </div>

          {/* Technical Skills builder */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Technical Skills & Specializations</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="E.g. Server-Side GTM, Meta CAPI, BigQuery"
                value={formSkillInput}
                onChange={(e) => setFormSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                className="flex-1 text-xs py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleAddSkill}>
                Add Tag
              </Button>
            </div>

            {formSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded font-mono"
                  >
                    #{skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Client Account Assignment */}
          {clients.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assign Client Accounts ({formSelectedClients.length} selected)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                {clients.map((c) => {
                  const isChecked = formSelectedClients.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none p-1 rounded hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleClientAssign(c.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{c.businessName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Specialist'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: Edit Team Specialist
      ========================================================================= */}
      {selectedMember && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedMember(null);
          }}
          title={`Edit Specialist: ${selectedMember.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleEditSubmit} autoComplete="off" className="space-y-4">
            <Input
              label="Full Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoComplete="off"
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                type="email"
                label="Email Address"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                autoComplete="off"
                required
              />
              <Input
                label="Phone Number"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Job Title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                autoComplete="off"
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
                <select
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">RBAC Role Privilege</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormRole('team')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    formRole === 'team'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold block">Specialist</span>
                  <span className="text-[11px] text-slate-500">Access to assigned clients, projects, tasks, and deliverables.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormRole('admin')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    formRole === 'admin'
                      ? 'border-purple-600 bg-purple-50/50 text-purple-900 ring-1 ring-purple-600'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold block">Administrator</span>
                  <span className="text-[11px] text-slate-500">Full agency authority: financial ledgers, audit logs, and roster.</span>
                </button>
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Technical Skills</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add skill tag"
                  value={formSkillInput}
                  onChange={(e) => setFormSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="flex-1 text-xs py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
                <Button type="button" size="sm" variant="outline" onClick={handleAddSkill}>
                  Add
                </Button>
              </div>

              {formSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded font-mono"
                    >
                      #{skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Clients */}
            {clients.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assign Client Accounts ({formSelectedClients.length} selected)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {clients.map((c) => {
                    const isChecked = formSelectedClients.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none p-1 rounded hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleClientAssign(c.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{c.businessName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedMember(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 3: Delete Team Specialist Confirmation
      ========================================================================= */}
      {selectedMember && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedMember(null);
          }}
          title="Remove Team Specialist"
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedMember(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={submitting}
                onClick={handleDeleteSubmit}
              >
                {submitting ? 'Removing...' : 'Remove Specialist'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-2 text-sm text-slate-600">
            <p>Are you sure you want to remove this specialist from the agency roster?</p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="font-bold text-rose-900">{selectedMember.name}</p>
              <p className="text-xs text-rose-700 mt-0.5">{selectedMember.title} • {selectedMember.department}</p>
            </div>
            <p className="text-xs text-slate-500">
              This action will revoke specialist database access and unlink them from assigned client accounts.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
