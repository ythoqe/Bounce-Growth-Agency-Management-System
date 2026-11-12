import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Plus,
  Check,
  ToggleLeft,
  ToggleRight,
  Link as LinkIcon,
  Unlink,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { useAuth } from '../auth/AuthContext';
import { ServicePackage, AgencyServiceItem, ServiceBillingType } from '../../types/service';
import { Project } from '../../types/project';
import {
  subscribePackages,
  subscribeServices,
  togglePackageActive,
  toggleServiceActive,
  linkPackageToProject,
  unlinkPackageFromProject,
  createServicePackage,
  updateServicePackage,
  deleteServicePackage,
  createAgencyService,
  updateAgencyService,
  deleteAgencyService,
} from '../../services/services/serviceCatalogService';
import { subscribeProjects } from '../../services/projects/projectService';

export function ServicesPricingPage() {
  const { currentUser, currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState('packages');

  // Firestore Real-time data
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [services, setServices] = useState<AgencyServiceItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Link Package to Project Modal State
  const [selectedPackageForLink, setSelectedPackageForLink] = useState<ServicePackage | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedProjectIdToLink, setSelectedProjectIdToLink] = useState('');
  const [linkingSubmitting, setLinkingSubmitting] = useState(false);

  // Create Package Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgCategory, setNewPkgCategory] = useState('Paid Media & Scaling');
  const [newPkgMinPrice, setNewPkgMinPrice] = useState<number>(0);
  const [newPkgMaxPrice, setNewPkgMaxPrice] = useState<number>(0);
  const [newPkgBilling, setNewPkgBilling] = useState<ServiceBillingType>('monthly_retainer');
  const [newPkgDescription, setNewPkgDescription] = useState('');
  const [newPkgFeatures, setNewPkgFeatures] = useState<string[]>(['']);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit Package Modal State
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);
  const [isEditPackageModalOpen, setIsEditPackageModalOpen] = useState(false);
  const [editPkgName, setEditPkgName] = useState('');
  const [editPkgCategory, setEditPkgCategory] = useState('');
  const [editPkgMinPrice, setEditPkgMinPrice] = useState<number>(0);
  const [editPkgMaxPrice, setEditPkgMaxPrice] = useState<number>(0);
  const [editPkgBilling, setEditPkgBilling] = useState<ServiceBillingType>('monthly_retainer');
  const [editPkgDescription, setEditPkgDescription] = useState('');
  const [editPkgFeatures, setEditPkgFeatures] = useState<string[]>([]);
  const [editPackageSubmitting, setEditPackageSubmitting] = useState(false);

  // Delete Package Modal State
  const [deletingPackage, setDeletingPackage] = useState<ServicePackage | null>(null);
  const [isDeletePackageModalOpen, setIsDeletePackageModalOpen] = useState(false);
  const [deletePackageSubmitting, setDeletePackageSubmitting] = useState(false);

  // Create Individual Service Modal State
  const [isCreateServiceModalOpen, setIsCreateServiceModalOpen] = useState(false);
  const [newSrvName, setNewSrvName] = useState('');
  const [newSrvCategory, setNewSrvCategory] = useState('Tracking & Infrastructure');
  const [newSrvPriceRange, setNewSrvPriceRange] = useState('');
  const [newSrvDescription, setNewSrvDescription] = useState('');
  const [createServiceSubmitting, setCreateServiceSubmitting] = useState(false);

  // Edit Individual Service Modal State
  const [editingService, setEditingService] = useState<AgencyServiceItem | null>(null);
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [editSrvName, setEditSrvName] = useState('');
  const [editSrvCategory, setEditSrvCategory] = useState('');
  const [editSrvPriceRange, setEditSrvPriceRange] = useState('');
  const [editSrvDescription, setEditSrvDescription] = useState('');
  const [editServiceSubmitting, setEditServiceSubmitting] = useState(false);

  // Delete Individual Service Modal State
  const [deletingService, setDeletingService] = useState<AgencyServiceItem | null>(null);
  const [isDeleteServiceModalOpen, setIsDeleteServiceModalOpen] = useState(false);
  const [deleteServiceSubmitting, setDeleteServiceSubmitting] = useState(false);

  // Status feedback
  const [serverError, setServerError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Real-time Subscriptions
  useEffect(() => {
    if (!currentUser || currentRole !== 'admin') {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubPackages = subscribePackages(
      (data) => {
        setPackages(data);
        setLoading(false);
      },
      (err) => console.error('[subscribePackages error]', err)
    );

    const unsubServices = subscribeServices(
      (data) => setServices(data),
      (err) => console.error('[subscribeServices error]', err)
    );

    const unsubProjects = subscribeProjects(
      (data) => setProjects(data),
      (err) => console.error('[subscribeProjects error]', err)
    );

    return () => {
      unsubPackages();
      unsubServices();
      unsubProjects();
    };
  }, [currentUser, currentRole]);

  // Derived filter collections
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    packages.forEach((p) => p.category && set.add(p.category));
    services.forEach((s) => s.category && set.add(s.category));
    return Array.from(set);
  }, [packages, services]);

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      if (categoryFilter !== 'all' && pkg.category !== categoryFilter) return false;
      if (statusFilter === 'active' && !pkg.isActive) return false;
      if (statusFilter === 'inactive' && pkg.isActive) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = pkg.name.toLowerCase().includes(q);
        const matchesDesc = pkg.description?.toLowerCase().includes(q);
        const matchesCat = pkg.category?.toLowerCase().includes(q);
        const matchesFeat = pkg.features?.some((f) => f.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesCat && !matchesFeat) return false;
      }
      return true;
    });
  }, [packages, categoryFilter, statusFilter, searchQuery]);

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      if (categoryFilter !== 'all' && srv.category !== categoryFilter) return false;
      if (statusFilter === 'active' && !srv.isActive) return false;
      if (statusFilter === 'inactive' && srv.isActive) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = srv.name.toLowerCase().includes(q);
        const matchesDesc = srv.description?.toLowerCase().includes(q);
        const matchesCat = srv.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [services, categoryFilter, statusFilter, searchQuery]);

  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = proj.name.toLowerCase().includes(q);
        const matchesClient = proj.clientName?.toLowerCase().includes(q);
        const matchesPkg = (proj.packageId || (proj as any).packageName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClient && !matchesPkg) return false;
      }
      return true;
    });
  }, [projects, searchQuery]);

  // ---------------------------------------------------------------------------
  // Handlers: Toggle Active Status
  // ---------------------------------------------------------------------------
  const handleTogglePackage = async (pkg: ServicePackage) => {
    if (!currentUser) return;
    setServerError(null);

    try {
      const newStatus = await togglePackageActive(pkg.id, pkg.isActive, currentUser);
      setActionSuccess(
        `Package "${pkg.name}" is now ${newStatus ? 'Active' : 'Inactive (Hidden from proposals)'}.`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to update package status.');
    }
  };

  const handleToggleService = async (service: AgencyServiceItem) => {
    if (!currentUser) return;
    setServerError(null);

    try {
      const newStatus = await toggleServiceActive(service.id, service.isActive, currentUser);
      setActionSuccess(
        `Service "${service.name}" is now ${newStatus ? 'Active' : 'Inactive'}.`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to update service status.');
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Link & Unlink Project
  // ---------------------------------------------------------------------------
  const handleOpenLinkModal = (pkg: ServicePackage) => {
    setSelectedPackageForLink(pkg);
    setSelectedProjectIdToLink('');
    setServerError(null);
    setIsLinkModalOpen(true);
  };

  const handleLinkProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageForLink || !selectedProjectIdToLink || !currentUser) return;

    setLinkingSubmitting(true);
    setServerError(null);

    try {
      await linkPackageToProject(selectedPackageForLink.id, selectedProjectIdToLink, currentUser);
      const proj = projects.find((p) => p.id === selectedProjectIdToLink);
      setActionSuccess(
        `Successfully linked package "${selectedPackageForLink.name}" to project "${proj?.name || selectedProjectIdToLink}".`
      );
      setSelectedProjectIdToLink('');
      setIsLinkModalOpen(false);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to link package to project.');
    } finally {
      setLinkingSubmitting(false);
    }
  };

  const handleUnlinkProject = async (packageId: string, projectId: string) => {
    if (!currentUser) return;
    setServerError(null);

    try {
      await unlinkPackageFromProject(packageId, projectId, currentUser);
      setActionSuccess('Unlinked project from package.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to unlink project.');
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Package CRUD
  // ---------------------------------------------------------------------------
  const handleCreatePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!newPkgName.trim() || newPkgMinPrice < 0 || newPkgMaxPrice < newPkgMinPrice) {
      setServerError('Please provide a valid package name and price range.');
      return;
    }

    setCreateSubmitting(true);
    setServerError(null);

    try {
      const priceRange = `৳${newPkgMinPrice.toLocaleString()} - ৳${newPkgMaxPrice.toLocaleString()}`;
      await createServicePackage(
        {
          name: newPkgName.trim(),
          description: newPkgDescription.trim(),
          priceMin: newPkgMinPrice,
          priceMax: newPkgMaxPrice,
          priceRange,
          currency: 'BDT',
          billingType: newPkgBilling,
          category: newPkgCategory.trim(),
          features: newPkgFeatures.map((f) => f.trim()).filter((f) => f.length > 0),
          isActive: true,
          sortOrder: packages.length + 1,
        },
        currentUser
      );

      setIsCreateModalOpen(false);
      setNewPkgName('');
      setNewPkgDescription('');
      setNewPkgMinPrice(0);
      setNewPkgMaxPrice(0);
      setNewPkgFeatures(['']);
      setActionSuccess('Service package successfully created.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to create package.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenEditPackage = (pkg: ServicePackage) => {
    setEditingPackage(pkg);
    setEditPkgName(pkg.name);
    setEditPkgCategory(pkg.category);
    setEditPkgMinPrice(pkg.priceMin || 0);
    setEditPkgMaxPrice(pkg.priceMax || 0);
    setEditPkgBilling(pkg.billingType);
    setEditPkgDescription(pkg.description || '');
    setEditPkgFeatures(pkg.features && pkg.features.length > 0 ? [...pkg.features] : ['']);
    setServerError(null);
    setIsEditPackageModalOpen(true);
  };

  const handleUpdatePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage || !currentUser) return;

    if (!editPkgName.trim() || editPkgMinPrice < 0 || editPkgMaxPrice < editPkgMinPrice) {
      setServerError('Please provide a valid package name and price range.');
      return;
    }

    setEditPackageSubmitting(true);
    setServerError(null);

    try {
      const priceRange = `৳${editPkgMinPrice.toLocaleString()} - ৳${editPkgMaxPrice.toLocaleString()}`;
      await updateServicePackage(
        editingPackage.id,
        {
          name: editPkgName.trim(),
          description: editPkgDescription.trim(),
          priceMin: editPkgMinPrice,
          priceMax: editPkgMaxPrice,
          priceRange,
          currency: 'BDT',
          billingType: editPkgBilling,
          category: editPkgCategory.trim(),
          features: editPkgFeatures.map((f) => f.trim()).filter((f) => f.length > 0),
        },
        currentUser
      );

      setIsEditPackageModalOpen(false);
      setEditingPackage(null);
      setActionSuccess(`Service package "${editPkgName}" successfully updated.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to update package.');
    } finally {
      setEditPackageSubmitting(false);
    }
  };

  const handleOpenDeletePackage = (pkg: ServicePackage) => {
    setDeletingPackage(pkg);
    setServerError(null);
    setIsDeletePackageModalOpen(true);
  };

  const handleDeletePackageSubmit = async () => {
    if (!deletingPackage || !currentUser) return;
    setDeletePackageSubmitting(true);
    setServerError(null);

    try {
      await deleteServicePackage(deletingPackage.id, deletingPackage.name, currentUser);
      setIsDeletePackageModalOpen(false);
      setDeletingPackage(null);
      setActionSuccess(`Service package "${deletingPackage.name}" deleted.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to delete package.');
    } finally {
      setDeletePackageSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Individual Service CRUD
  // ---------------------------------------------------------------------------
  const handleCreateServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!newSrvName.trim() || !newSrvPriceRange.trim()) {
      setServerError('Please enter a service name and price range.');
      return;
    }

    setCreateServiceSubmitting(true);
    setServerError(null);

    try {
      await createAgencyService(
        {
          name: newSrvName.trim(),
          category: newSrvCategory.trim(),
          priceMin: 0,
          priceMax: 0,
          priceRange: newSrvPriceRange.trim().startsWith('৳') ? newSrvPriceRange.trim() : `৳${newSrvPriceRange.trim()}`,
          description: newSrvDescription.trim(),
          currency: 'BDT',
          isActive: true,
          features: [],
        },
        currentUser
      );

      setIsCreateServiceModalOpen(false);
      setNewSrvName('');
      setNewSrvPriceRange('');
      setNewSrvDescription('');
      setActionSuccess('Technical service successfully created.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to create service.');
    } finally {
      setCreateServiceSubmitting(false);
    }
  };

  const handleOpenEditService = (srv: AgencyServiceItem) => {
    setEditingService(srv);
    setEditSrvName(srv.name);
    setEditSrvCategory(srv.category);
    setEditSrvPriceRange(srv.priceRange);
    setEditSrvDescription(srv.description || '');
    setServerError(null);
    setIsEditServiceModalOpen(true);
  };

  const handleUpdateServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !currentUser) return;

    if (!editSrvName.trim() || !editSrvPriceRange.trim()) {
      setServerError('Please enter a service name and price range.');
      return;
    }

    setEditServiceSubmitting(true);
    setServerError(null);

    try {
      await updateAgencyService(
        editingService.id,
        {
          name: editSrvName.trim(),
          category: editSrvCategory.trim(),
          priceRange: editSrvPriceRange.trim(),
          description: editSrvDescription.trim(),
          currency: 'BDT',
        },
        currentUser
      );

      setIsEditServiceModalOpen(false);
      setEditingService(null);
      setActionSuccess(`Service "${editSrvName}" successfully updated.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to update service.');
    } finally {
      setEditServiceSubmitting(false);
    }
  };

  const handleOpenDeleteService = (srv: AgencyServiceItem) => {
    setDeletingService(srv);
    setServerError(null);
    setIsDeleteServiceModalOpen(true);
  };

  const handleDeleteServiceSubmit = async () => {
    if (!deletingService || !currentUser) return;
    setDeleteServiceSubmitting(true);
    setServerError(null);

    try {
      await deleteAgencyService(deletingService.id, deletingService.name, currentUser);
      setIsDeleteServiceModalOpen(false);
      setDeletingService(null);
      setActionSuccess(`Service "${deletingService.name}" deleted.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to delete service.');
    } finally {
      setDeleteServiceSubmitting(false);
    }
  };

  // Map linked projects for a package
  const getLinkedProjects = (pkg: ServicePackage) => {
    const ids = pkg.linkedProjectIds || [];
    return projects.filter((p) => ids.includes(p.id));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Services & Pricing Rate Cards"
        description="Standardized agency service deliverables, recurring retainer packages in BDT (৳), live active status toggles, and direct project linking."
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'services' ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setServerError(null);
                  setIsCreateServiceModalOpen(true);
                }}
              >
                Add Individual Service
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setServerError(null);
                  setIsCreateModalOpen(true);
                }}
              >
                Add Service Package
              </Button>
            )}
          </div>
        }
      />

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {serverError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{serverError}</span>
          </div>
          <button onClick={() => setServerError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Tiered Agency Packages</span>
            <Tag className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {packages.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {packages.filter((p) => p.isActive).length} currently active for proposals
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Individual Technical Services</span>
            <Tag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
              {services.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Tracking, media & attribution modules
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Projects with Linked Packages</span>
            <Briefcase className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-purple-700 tabular-nums">
              {projects.filter((p) => p.packageId || (p as any).packageName).length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Attached to live client deliverables
            </p>
          </div>
        </Card>
      </div>

      {/* Services & Pricing Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search packages, services, deliverables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active (Offered)</option>
                <option value="inactive">Inactive (Hidden)</option>
              </select>
            </div>

            {(searchQuery.trim() || categoryFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1.5 rounded hover:bg-rose-50 transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'packages', label: 'Agency Retainer Packages', count: filteredPackages.length },
          { id: 'services', label: 'Individual Services', count: filteredServices.length },
          { id: 'attachments', label: 'Project Attachments', count: filteredProjects.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* =========================================================================
          TAB 1: Agency Packages (Tiered Offerings with Pricing in BDT)
      ========================================================================= */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Standardized Growth Packages</h3>
              <p className="text-xs text-slate-500">
                Core packages offered to e-commerce and lead-generation clients with edit and delete controls.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading service packages...</div>
          ) : filteredPackages.length === 0 ? (
            <Card>
              <div className="py-12 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  {packages.length === 0 ? 'No service packages created yet.' : 'No packages match the selected filters.'}
                </p>
                <p className="text-xs text-slate-400">
                  {packages.length === 0
                    ? 'Click "Add Service Package" to build your first BDT rate card.'
                    : 'Try clearing your search or category filter to view all packages.'}
                </p>
                {packages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('all');
                      setStatusFilter('all');
                    }}
                    className="mt-2"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPackages.map((pkg) => {
                const linkedProjs = getLinkedProjects(pkg);

                return (
                  <Card
                    key={pkg.id}
                    className={`flex flex-col justify-between transition-all ${
                      pkg.isActive ? 'border-slate-200' : 'opacity-60 bg-slate-50/70 border-dashed border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Top Category, Actions & Active Toggle */}
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                        <span className="font-semibold text-slate-500 text-[11px] truncate max-w-[140px]">
                          {pkg.category}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPackage(pkg)}
                            title="Edit Package"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeletePackage(pkg)}
                            title="Delete Package"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              pkg.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {pkg.isActive ? 'Active' : 'Inactive'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleTogglePackage(pkg)}
                            title={pkg.isActive ? 'Deactivate package' : 'Activate package'}
                            className="text-slate-400 hover:text-blue-600 transition-colors p-0.5"
                          >
                            {pkg.isActive ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Package Name & Price */}
                      <h3 className="text-base font-bold text-slate-900 mt-3">{pkg.name}</h3>

                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-blue-700 font-mono tracking-tight">
                          {pkg.priceRange}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium capitalize">
                          {pkg.billingType === 'monthly_retainer' ? '/ month' : '(one-time)'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">{pkg.description}</p>

                      {/* Features Bullet List */}
                      {pkg.features && pkg.features.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {pkg.features.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Linked Projects Indicator */}
                      {linkedProjs.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Linked Projects ({linkedProjs.length})
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {linkedProjs.map((lp) => (
                              <span
                                key={lp.id}
                                className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium"
                              >
                                <Briefcase className="w-3 h-3 text-blue-500" />
                                {lp.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<LinkIcon className="w-3.5 h-3.5 text-blue-600" />}
                        onClick={() => handleOpenLinkModal(pkg)}
                        className="flex-1 text-xs"
                      >
                        Link to Project
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Edit2 className="w-3.5 h-3.5 text-slate-600" />}
                        onClick={() => handleOpenEditPackage(pkg)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: Individual Services
      ========================================================================= */}
      {activeTab === 'services' && (
        <Card>
          <CardHeader
            title="Individual Technical Services"
            subtitle="Granular deliverables available as add-ons or standalone contracts."
          />
          {filteredServices.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700">
                {services.length === 0 ? 'No individual services configured yet.' : 'No services match the selected filters.'}
              </p>
              <p className="text-xs text-slate-400">
                {services.length === 0
                  ? 'Click "Add Individual Service" to define technical offerings.'
                  : 'Try clearing your search or category filter.'}
              </p>
              {services.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                  }}
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                    <th className="px-4 py-3">Service Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Price Range</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredServices.map((srv) => (
                    <tr key={srv.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{srv.name}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{srv.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">{srv.category}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{srv.priceRange}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleService(srv)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                        >
                          {srv.isActive ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <ToggleRight className="w-5 h-5 text-emerald-600" /> Active
                            </span>
                          ) : (
                            <span className="text-slate-400 flex items-center gap-1">
                              <ToggleLeft className="w-5 h-5 text-slate-400" /> Inactive
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditService(srv)}
                            title="Edit Service"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteService(srv)}
                            title="Delete Service"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* =========================================================================
          TAB 3: Project Attachments Overview
      ========================================================================= */}
      {activeTab === 'attachments' && (
        <Card>
          <CardHeader
            title="Projects & Assigned Service Packages"
            subtitle="Overview of which service package is linked to each active agency project."
          />
          {filteredProjects.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700">
                {projects.length === 0 ? 'No agency projects registered yet.' : 'No projects match your search.'}
              </p>
              {projects.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-2"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Assigned Package</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredProjects.map((proj) => {
                    const linkedPackage = packages.find(
                      (p) => p.id === proj.packageId || (p.linkedProjectIds || []).includes(proj.id)
                    );

                    return (
                      <tr key={proj.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{proj.name}</p>
                          <p className="text-[11px] text-slate-400 capitalize">{proj.status.replace('_', ' ')}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800">{proj.clientName}</span>
                        </td>
                        <td className="px-4 py-3">
                          {linkedPackage ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                {linkedPackage.name}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {linkedPackage.priceRange}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No package attached</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {linkedPackage ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-rose-600 hover:text-rose-700"
                              onClick={() => handleUnlinkProject(linkedPackage.id, proj.id)}
                            >
                              Unlink
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                if (packages.length > 0) handleOpenLinkModal(packages[0]);
                              }}
                            >
                              Assign Package
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* =========================================================================
          MODAL 1: Link Package to Project
      ========================================================================= */}
      {selectedPackageForLink && (
        <Modal
          isOpen={isLinkModalOpen}
          onClose={() => {
            setIsLinkModalOpen(false);
            setSelectedPackageForLink(null);
          }}
          title={`Link "${selectedPackageForLink.name}" to Project`}
          description="Assign this service package and rate card to an active client project engagement."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Package:</span>
                <span className="font-bold text-slate-900">{selectedPackageForLink.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rate Card:</span>
                <span className="font-bold text-blue-700 font-mono">{selectedPackageForLink.priceRange}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Billing:</span>
                <span className="font-medium text-slate-700 capitalize">
                  {selectedPackageForLink.billingType.replace('_', ' ')}
                </span>
              </div>
            </div>

            {getLinkedProjects(selectedPackageForLink).length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Currently Linked Projects:
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {getLinkedProjects(selectedPackageForLink).map((proj) => (
                    <div
                      key={proj.id}
                      className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{proj.name}</span>
                        <span className="text-[11px] text-slate-500 ml-2">({proj.clientName})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlinkProject(selectedPackageForLink.id, proj.id)}
                        className="text-rose-600 hover:text-rose-800 text-[11px] font-medium flex items-center gap-1"
                      >
                        <Unlink className="w-3 h-3" /> Unlink
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleLinkProjectSubmit} autoComplete="off" className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Project to Link <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProjectIdToLink}
                  onChange={(e) => setSelectedProjectIdToLink(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg text-sm text-slate-900 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                >
                  <option value="">Choose an active project...</option>
                  {projects
                    .filter((p) => !(selectedPackageForLink.linkedProjectIds || []).includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.clientName}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLinkModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!selectedProjectIdToLink || linkingSubmitting}
                >
                  {linkingSubmitting ? 'Linking...' : 'Confirm Link'}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 2: Create Custom Service Package
      ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Service Package"
        description="Add a new agency package with custom deliverables and BDT pricing tier."
        maxWidth="md"
      >
        <form onSubmit={handleCreatePackageSubmit} autoComplete="off" className="space-y-4">
          <Input
            label="Package Name"
            placeholder="E.g. Full-Funnel CRO & Attribution"
            value={newPkgName}
            onChange={(e) => setNewPkgName(e.target.value)}
            autoComplete="off"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
              <select
                value={newPkgCategory}
                onChange={(e) => setNewPkgCategory(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Paid Media & Scaling">Paid Media & Scaling</option>
                <option value="Server-Side Tracking & CAPI">Server-Side Tracking & CAPI</option>
                <option value="Full-Funnel Growth Partnership">Full-Funnel Growth Partnership</option>
                <option value="Attribution & Analytics">Attribution & Analytics</option>
                <option value="CRO & Funnel Optimization">CRO & Funnel Optimization</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Billing Type</label>
              <select
                value={newPkgBilling}
                onChange={(e) => setNewPkgBilling(e.target.value as ServiceBillingType)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="monthly_retainer">Monthly Retainer</option>
                <option value="one_time">One-Time Project</option>
                <option value="sprint">Weekly Sprint</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="500"
              min="0"
              label="Min Price (৳ BDT)"
              value={newPkgMinPrice}
              onChange={(e) => setNewPkgMinPrice(parseInt(e.target.value) || 0)}
              autoComplete="off"
              required
            />
            <Input
              type="number"
              step="500"
              min="0"
              label="Max Price (৳ BDT)"
              value={newPkgMaxPrice}
              onChange={(e) => setNewPkgMaxPrice(parseInt(e.target.value) || 0)}
              autoComplete="off"
              required
            />
          </div>

          <Input
            label="Brief Description"
            placeholder="High-level value proposition for clients"
            value={newPkgDescription}
            onChange={(e) => setNewPkgDescription(e.target.value)}
            autoComplete="off"
            required
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Scope Deliverables</label>
              <button
                type="button"
                onClick={() => setNewPkgFeatures([...newPkgFeatures, ''])}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Deliverable
              </button>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {newPkgFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={feat}
                    autoComplete="off"
                    onChange={(e) => {
                      const updated = [...newPkgFeatures];
                      updated[idx] = e.target.value;
                      setNewPkgFeatures(updated);
                    }}
                    placeholder="Deliverable bullet point"
                    className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                  {newPkgFeatures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setNewPkgFeatures(newPkgFeatures.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createSubmitting}
            >
              {createSubmitting ? 'Creating...' : 'Create Package'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 3: Edit Service Package
      ========================================================================= */}
      {editingPackage && (
        <Modal
          isOpen={isEditPackageModalOpen}
          onClose={() => {
            setIsEditPackageModalOpen(false);
            setEditingPackage(null);
          }}
          title={`Edit Package: ${editingPackage.name}`}
          description="Update rate card pricing in BDT, scope deliverables, or category details."
          maxWidth="md"
        >
          <form onSubmit={handleUpdatePackageSubmit} autoComplete="off" className="space-y-4">
            <Input
              label="Package Name"
              value={editPkgName}
              onChange={(e) => setEditPkgName(e.target.value)}
              autoComplete="off"
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                <select
                  value={editPkgCategory}
                  onChange={(e) => setEditPkgCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Paid Media & Scaling">Paid Media & Scaling</option>
                  <option value="Server-Side Tracking & CAPI">Server-Side Tracking & CAPI</option>
                  <option value="Full-Funnel Growth Partnership">Full-Funnel Growth Partnership</option>
                  <option value="Attribution & Analytics">Attribution & Analytics</option>
                  <option value="CRO & Funnel Optimization">CRO & Funnel Optimization</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Billing Type</label>
                <select
                  value={editPkgBilling}
                  onChange={(e) => setEditPkgBilling(e.target.value as ServiceBillingType)}
                  className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="monthly_retainer">Monthly Retainer</option>
                  <option value="one_time">One-Time Project</option>
                  <option value="sprint">Weekly Sprint</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                step="500"
                min="0"
                label="Min Price (৳ BDT)"
                value={editPkgMinPrice}
                onChange={(e) => setEditPkgMinPrice(parseInt(e.target.value) || 0)}
                autoComplete="off"
                required
              />
              <Input
                type="number"
                step="500"
                min="0"
                label="Max Price (৳ BDT)"
                value={editPkgMaxPrice}
                onChange={(e) => setEditPkgMaxPrice(parseInt(e.target.value) || 0)}
                autoComplete="off"
                required
              />
            </div>

            <Input
              label="Brief Description"
              value={editPkgDescription}
              onChange={(e) => setEditPkgDescription(e.target.value)}
              autoComplete="off"
              required
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Scope Deliverables</label>
                <button
                  type="button"
                  onClick={() => setEditPkgFeatures([...editPkgFeatures, ''])}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Deliverable
                </button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {editPkgFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={feat}
                      autoComplete="off"
                      onChange={(e) => {
                        const updated = [...editPkgFeatures];
                        updated[idx] = e.target.value;
                        setEditPkgFeatures(updated);
                      }}
                      placeholder="Deliverable bullet point"
                      className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                    {editPkgFeatures.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditPkgFeatures(editPkgFeatures.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditPackageModalOpen(false);
                  setEditingPackage(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={editPackageSubmitting}
              >
                {editPackageSubmitting ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 4: Delete Service Package Confirmation
      ========================================================================= */}
      {deletingPackage && (
        <Modal
          isOpen={isDeletePackageModalOpen}
          onClose={() => {
            setIsDeletePackageModalOpen(false);
            setDeletingPackage(null);
          }}
          title="Delete Service Package"
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeletePackageModalOpen(false);
                  setDeletingPackage(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deletePackageSubmitting}
                onClick={handleDeletePackageSubmit}
              >
                {deletePackageSubmitting ? 'Deleting...' : 'Delete Package'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-2 text-sm text-slate-600">
            <p>Are you sure you want to delete this rate card package?</p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="font-bold text-rose-900">{deletingPackage.name}</p>
              <p className="text-xs text-rose-700 mt-0.5">{deletingPackage.priceRange}</p>
            </div>
            <p className="text-xs text-slate-500">
              This action will remove the package from the catalog. Linked projects will remain intact.
            </p>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 5: Create Individual Service
      ========================================================================= */}
      <Modal
        isOpen={isCreateServiceModalOpen}
        onClose={() => setIsCreateServiceModalOpen(false)}
        title="Add Individual Technical Service"
        description="Add a granular deliverable item to the agency service catalog."
        maxWidth="md"
      >
        <form onSubmit={handleCreateServiceSubmit} autoComplete="off" className="space-y-4">
          <Input
            label="Service Name"
            placeholder="E.g. Server-Side Google Tag Manager Setup"
            value={newSrvName}
            onChange={(e) => setNewSrvName(e.target.value)}
            autoComplete="off"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
              <select
                value={newSrvCategory}
                onChange={(e) => setNewSrvCategory(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Tracking & Infrastructure">Tracking & Infrastructure</option>
                <option value="Paid Media Scaling">Paid Media Scaling</option>
                <option value="Attribution & Analytics">Attribution & Analytics</option>
                <option value="Creative & Copywriting">Creative & Copywriting</option>
                <option value="Conversion Optimization">Conversion Optimization</option>
              </select>
            </div>

            <Input
              label="Price Range (BDT)"
              placeholder="E.g. ৳15,000 - ৳25,000"
              value={newSrvPriceRange}
              onChange={(e) => setNewSrvPriceRange(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <Input
            label="Description / Deliverable Specs"
            placeholder="Technical scope included in this deliverable"
            value={newSrvDescription}
            onChange={(e) => setNewSrvDescription(e.target.value)}
            autoComplete="off"
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateServiceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createServiceSubmitting}
            >
              {createServiceSubmitting ? 'Adding...' : 'Add Service'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 6: Edit Individual Service
      ========================================================================= */}
      {editingService && (
        <Modal
          isOpen={isEditServiceModalOpen}
          onClose={() => {
            setIsEditServiceModalOpen(false);
            setEditingService(null);
          }}
          title={`Edit Service: ${editingService.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleUpdateServiceSubmit} autoComplete="off" className="space-y-4">
            <Input
              label="Service Name"
              value={editSrvName}
              onChange={(e) => setEditSrvName(e.target.value)}
              autoComplete="off"
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                <select
                  value={editSrvCategory}
                  onChange={(e) => setEditSrvCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-900 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Tracking & Infrastructure">Tracking & Infrastructure</option>
                  <option value="Paid Media Scaling">Paid Media Scaling</option>
                  <option value="Attribution & Analytics">Attribution & Analytics</option>
                  <option value="Creative & Copywriting">Creative & Copywriting</option>
                  <option value="Conversion Optimization">Conversion Optimization</option>
                </select>
              </div>

              <Input
                label="Price Range"
                value={editSrvPriceRange}
                onChange={(e) => setEditSrvPriceRange(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <Input
              label="Description / Deliverable Specs"
              value={editSrvDescription}
              onChange={(e) => setEditSrvDescription(e.target.value)}
              autoComplete="off"
              required
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditServiceModalOpen(false);
                  setEditingService(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={editServiceSubmitting}
              >
                {editServiceSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 7: Delete Individual Service Confirmation
      ========================================================================= */}
      {deletingService && (
        <Modal
          isOpen={isDeleteServiceModalOpen}
          onClose={() => {
            setIsDeleteServiceModalOpen(false);
            setDeletingService(null);
          }}
          title="Delete Individual Service"
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteServiceModalOpen(false);
                  setDeletingService(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteServiceSubmitting}
                onClick={handleDeleteServiceSubmit}
              >
                {deleteServiceSubmitting ? 'Deleting...' : 'Delete Service'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-2 text-sm text-slate-600">
            <p>Are you sure you want to delete this technical service from the catalog?</p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="font-bold text-rose-900">{deletingService.name}</p>
              <p className="text-xs text-rose-700 mt-0.5">{deletingService.priceRange}</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
