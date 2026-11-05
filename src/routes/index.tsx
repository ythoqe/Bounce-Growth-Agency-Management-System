import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';

// Admin Layout & Pages
import { AdminLayout } from '../components/layout/AdminLayout';
import { AdminDashboardPage } from '../features/dashboard/AdminDashboardPage';
import { CrmPage } from '../features/crm/CrmPage';
import { ClientsPage } from '../features/clients/ClientsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { TrackingAssetsPage } from '../features/assets/TrackingAssetsPage';
import { ReportsAnalyticsPage } from '../features/reports/ReportsAnalyticsPage';
import { ContentCalendarPage } from '../features/marketing/ContentCalendarPage';
import { DocumentsPage } from '../features/documents/DocumentsPage';
import { KnowledgeBasePage } from '../features/sop/KnowledgeBasePage';
import { FinancePage } from '../features/finance/FinancePage';
import { ServicesPricingPage } from '../features/services/ServicesPricingPage';
import { TeamPage } from '../features/team/TeamPage';
import { SettingsPage } from '../features/settings/SettingsPage';

// Client Portal Layout & Pages
import { ClientLayout } from '../components/layout/ClientLayout';
import { ClientDashboardPage } from '../features/client-portal/ClientDashboardPage';
import { ClientProjectsPage } from '../features/client-portal/ClientProjectsPage';
import { ClientTasksPage } from '../features/client-portal/ClientTasksPage';
import { ClientInvoicesPage } from '../features/client-portal/ClientInvoicesPage';
import { ClientReportsPage } from '../features/client-portal/ClientReportsPage';
import { ClientDocumentsPage } from '../features/client-portal/ClientDocumentsPage';
import { ClientSupportPage } from '../features/client-portal/ClientSupportPage';

function RootRedirect() {
  const { currentRole } = useAuth();
  if (currentRole === 'client') {
    return <Navigate to="/portal" replace />;
  }
  return <Navigate to="/admin" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      {/* Admin & Team Member Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin', 'team']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="crm" element={<CrmPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="assets" element={<TrackingAssetsPage />} />
        <Route path="reports" element={<ReportsAnalyticsPage />} />
        <Route path="marketing" element={<ContentCalendarPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="sop" element={<KnowledgeBasePage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="services" element={<ServicesPricingPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Client Portal Routes */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={['client', 'admin']}>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboardPage />} />
        <Route path="projects" element={<ClientProjectsPage />} />
        <Route path="tasks" element={<ClientTasksPage />} />
        <Route path="invoices" element={<ClientInvoicesPage />} />
        <Route path="reports" element={<ClientReportsPage />} />
        <Route path="documents" element={<ClientDocumentsPage />} />
        <Route path="support" element={<ClientSupportPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
