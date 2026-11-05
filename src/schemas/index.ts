import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'team', 'client']);
export const UserStatusSchema = z.enum(['active', 'suspended', 'invited']);

export const UserProfileSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  email: z.string().email('Invalid email address'),
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: UserRoleSchema,
  status: UserStatusSchema,
  clientId: z.string().optional(),
  phone: z.string().max(25).optional(),
  title: z.string().max(100).optional(),
  skills: z.array(z.string()).max(20).optional(),
});

export const ServiceCategorySchema = z.enum([
  'meta_ads',
  'google_ads',
  'tiktok_ads',
  'ga4',
  'gtm',
  'meta_pixel',
  'meta_capi',
  'server_side_tracking',
  'looker_studio',
  'cro',
  'full_funnel_growth',
]);

export const ClientSchema = z.object({
  businessName: z.string().min(2, 'Business name is required').max(120),
  contactPerson: z.string().min(2, 'Contact person name required').max(100),
  email: z.string().email('Valid contact email required'),
  phone: z.string().max(30).optional().default(''),
  website: z.string().max(255).optional().default(''),
  businessType: z.string().max(80).optional().default('E-commerce'),
  industry: z.string().max(80).optional().default('Retail'),
  country: z.string().min(2).max(60).default('Bangladesh'),
  address: z.string().max(255).optional().default(''),
  timezone: z.string().min(2).max(60).default('Asia/Dhaka'),
  servicesSubscribed: z.array(ServiceCategorySchema).min(1, 'Select at least one agency service'),
  status: z.enum(['active', 'onboarding', 'lead', 'paused', 'churned', 'archived']).default('onboarding'),
  monthlyRetainer: z.number().min(0, 'Retainer cannot be negative').default(0),
  currency: z.enum(['BDT', 'USD']).default('USD'),
  assignedManagerId: z.string().optional().default(''),
  assignedSpecialists: z.array(z.string()).default([]),
  portalAccessUserIds: z.array(z.string()).default([]),
  internalNotes: z.string().max(2000).optional().default(''),
});

export const ProjectSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  clientName: z.string().min(1, 'Client name is required'),
  name: z.string().min(3, 'Project name must be at least 3 characters').max(120),
  description: z.string().max(1000).default(''),
  services: z.array(ServiceCategorySchema).min(1, 'Select at least one service'),
  status: z.enum(['planning', 'active', 'in_progress', 'in_review', 'completed', 'on_hold', 'archived']).default('planning'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  leadSpecialistId: z.string().default(''),
  assignedTeamMembers: z.array(z.string()).default([]),
  clientVisible: z.boolean().default(true),
  progressPercentage: z.number().min(0).max(100).default(0),
  startDate: z.string().min(1, 'Start date is required'),
  deadline: z.string().optional().default(''),
});

export const TrackingAssetSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientName: z.string().min(1, 'Client name is required'),
  projectId: z.string().optional().default(''),
  projectName: z.string().optional().default(''),
  assetType: z.enum([
    'ga4',
    'gtm_web',
    'google_ads',
    'meta_pixel',
    'meta_capi',
    'tiktok_pixel',
    'tiktok_events_api',
    'gtm_server',
    'stape',
    'looker_studio',
    'custom_domain',
  ]),
  name: z.string().min(2, 'Asset name required').max(100),
  measurementId: z.string().max(80).optional().default(''),
  containerId: z.string().max(80).optional().default(''),
  pixelId: z.string().max(80).optional().default(''),
  serverContainerUrl: z.string().max(255).optional().default(''),
  dashboardUrl: z.string().max(500).optional().default(''),
  accessLevel: z.enum(['admin_only', 'shared_with_client']).default('shared_with_client'),
  status: z.enum(['active', 'in_configuration', 'verifying', 'archived']).default('active'),
  notes: z.string().max(1000).optional().default(''),
});

export const ClientInvitationSchema = z.object({
  clientId: z.string().min(1, 'Client ID required'),
  clientName: z.string().min(1, 'Client name required'),
  contactEmail: z.string().email('Valid email required'),
  contactName: z.string().min(2, 'Contact name required').max(100),
  expiresInDays: z.number().min(1).max(30).default(7),
});

export const ClientInternalNotesSchema = z.object({
  clientId: z.string().min(1, 'Client ID required'),
  notes: z.string().max(5000, 'Notes cannot exceed 5000 characters').default(''),
});

export const TaskSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  clientName: z.string().min(1, 'Client name is required'),
  projectId: z.string().min(1, 'Project is required'),
  projectName: z.string().min(1, 'Project name is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(150),
  description: z.string().max(3000).default(''),
  assignedTeamMembers: z.array(z.string()).default([]),
  assignedTeamMemberNames: z.array(z.string()).default([]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'in_review', 'completed', 'cancelled']).default('todo'),
  progressPercentage: z.number().min(0).max(100).default(0),
  startDate: z.string().optional().default(''),
  deadline: z.string().optional().default(''),
  labels: z.array(z.string().max(50)).default([]),
  clientVisible: z.boolean().default(true),
  isArchived: z.boolean().default(false),
});

export const DeliverableSchema = z.object({
  taskId: z.string().min(1, 'Task is required'),
  taskTitle: z.string().min(1, 'Task title is required'),
  projectId: z.string().min(1, 'Project is required'),
  projectName: z.string().min(1, 'Project name is required'),
  clientId: z.string().min(1, 'Client is required'),
  clientName: z.string().min(1, 'Client name is required'),
  title: z.string().min(3, 'Deliverable title required').max(150),
  description: z.string().min(10, 'Provide detailed submission notes or findings').max(5000),
  externalUrl: z
    .string()
    .url('Must be a valid web URL (e.g. Looker Studio dashboard, GTM Preview, Figma link)')
    .max(500)
    .optional()
    .or(z.literal('')),
  status: z.enum(['draft', 'submitted', 'under_review', 'approved', 'revision_requested', 'rejected']).default('submitted'),
});

export const DeliverableReviewSchema = z.object({
  decision: z.enum(['approved', 'revision_requested', 'rejected']),
  reviewNotes: z.string().max(2000).optional().default(''),
}).refine(
  (data) => data.decision !== 'revision_requested' || (data.reviewNotes && data.reviewNotes.trim().length >= 5),
  { message: 'A written reason (at least 5 characters) is required when requesting revisions', path: ['reviewNotes'] }
);

export const ProjectCommentSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  clientId: z.string().min(1, 'Client ID required'),
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
  clientVisible: z.boolean().default(true),
});

export const SupportTicketSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  clientName: z.string().min(1, 'Client name is required'),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(150),
  description: z.string().min(10, 'Please provide more details on the request').max(3000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).default('open'),
  assignedToUid: z.string().optional().default(''),
  assignedToName: z.string().optional().default(''),
});

export const AppNotificationSchema = z.object({
  recipientUid: z.string().min(1, 'Recipient is required'),
  type: z.enum([
    'task_assigned',
    'task_deadline',
    'deliverable_submitted',
    'deliverable_approved',
    'revision_requested',
    'project_comment',
    'support_ticket_created',
    'support_ticket_updated',
  ]),
  title: z.string().min(1).max(150),
  message: z.string().min(1).max(500),
  relatedEntityType: z.enum(['task', 'deliverable', 'project', 'support_ticket']),
  relatedEntityId: z.string().min(1),
  read: z.boolean().default(false),
});
