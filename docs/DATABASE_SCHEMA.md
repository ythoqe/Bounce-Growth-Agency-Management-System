# Database Schema Specification

## Cloud Firestore Entity Mapping

All Firestore collections and sub-collections for Bounce Growth are planned as follows:

### 1. `/users/{userId}`
User profiles for agency staff and authorized client representatives.
- `id`: string (Firebase Auth UID)
- `email`: string
- `displayName`: string
- `role`: `'admin' | 'team' | 'client'`
- `status`: `'active' | 'suspended' | 'invited'`
- `clientId`: string (optional, linked if role === 'client')
- `phone`: string (optional)
- `title`: string (optional)
- `skills`: string[] (optional, e.g. ["Meta CAPI", "GA4", "sGTM"])
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

### 2. `/clients/{clientId}`
Client accounts managed by Bounce Growth.
- `id`: string (Unique document ID)
- `businessName`: string
- `contactPerson`: string
- `email`: string
- `phone`: string (optional)
- `website`: string (optional)
- `businessType`: string (optional, e.g. "E-commerce D2C")
- `industry`: string (optional)
- `country`: string
- `address`: string (optional)
- `timezone`: string (e.g. `Asia/Dhaka`)
- `primaryContact`: object `{ name, email, phone, isPrimary }`
- `servicesSubscribed`: string[]
- `status`: `'active' | 'onboarding' | 'lead' | 'paused' | 'churned' | 'archived'`
- `monthlyRetainer`: number
- `currency`: `'USD' | 'BDT'`
- `assignedManagerId`: string (User UID)
- `assignedSpecialists`: string[] (User UIDs)
- `portalAccessUserIds`: string[] (Client UIDs permitted to view this client portal)
- `internalNotes`: string (STRICT: Agency internal only - never sent to client portal)
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp
- `createdBy`: string (Admin UID)

### 2.1 `/client_invitations/{invitationId}` (Secure Onboarding Flow)
Pre-authorized invitations dispatched by administrators for client representatives.
- `id`: string
- `clientId`: string (Relational key to `/clients/{clientId}`)
- `clientName`: string
- `contactEmail`: string (Normalized lowercase Google email)
- `contactName`: string
- `role`: `'client'`
- `status`: `'pending' | 'claimed' | 'revoked'`
- `invitedBy`: string (Admin UID)
- `claimedByUid`: string (optional, linked upon Admin portal activation)
- `createdAt`: ISO timestamp
- `claimedAt`: ISO timestamp (optional)

### 3. `/projects/{projectId}`
Marketing campaigns, tracking setups, and optimization sprints.
- `id`: string
- `clientId`: string (Relational key to `/clients/{clientId}`)
- `clientName`: string
- `name`: string
- `description`: string
- `services`: string[]
- `status`: `'planning' | 'active' | 'in_progress' | 'in_review' | 'completed' | 'on_hold' | 'archived'`
- `priority`: `'low' | 'medium' | 'high' | 'urgent'`
- `leadSpecialistId`: string
- `assignedTeamMembers`: string[]
- `clientVisible`: boolean (Determines if client can view in their portal)
- `progressPercentage`: number (0 to 100)
- `startDate`: string
- `deadline`: string (optional)
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp
- `createdBy`: string (Admin UID)

### 4. `/tasks/{taskId}`
Actionable deliverables and QA items.
- `id`: string
- `projectId`: string
- `clientId`: string
- `title`: string
- `description`: string
- `status`: `'todo' | 'in_progress' | 'blocked' | 'client_review' | 'done'`
- `priority`: `'low' | 'medium' | 'high' | 'urgent'`
- `assigneeId`: string (optional)
- `creatorId`: string
- `clientVisible`: boolean
- `requiresClientApproval`: boolean
- `clientApprovalStatus`: `'pending' | 'approved' | 'changes_requested'` (optional)
- `dueDate`: string (optional)
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

### 5. `/assets/{assetId}`
Centralized tracking infrastructure inventory.
- `id`: string
- `clientId`: string
- `clientName`: string
- `type`: `'meta_pixel' | 'meta_capi' | 'ga4_property' | 'gtm_web_container' | 'gtm_server_container' | 'looker_studio_dashboard' | 'google_ads_conversion' | 'tiktok_pixel'`
- `name`: string
- `identifier`: string (e.g. `GTM-XXXXXX`, `G-XXXXXXX`, Pixel ID)
- `serverContainerUrl`: string (optional, e.g. `ssgtm.clientdomain.com`)
- `accessLevel`: `'admin_only' | 'shared_with_client'`
- `status`: `'active' | 'in_configuration' | 'verifying' | 'archived'`
- `healthStatus`: `'healthy' | 'warning' | 'error' | 'unverified'`
- `notes`: string (optional)
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

### 6. `/invoices/{invoiceId}`
Client billing records.
- `id`: string
- `invoiceNumber`: string (e.g. `BG-INV-2026-001`)
- `clientId`: string
- `clientName`: string
- `status`: `'draft' | 'issued' | 'paid' | 'overdue' | 'voided'`
- `issueDate`: string
- `dueDate`: string
- `items`: array of `{ id, description, quantity, unitPrice, total }`
- `subtotal`: number
- `tax`: number
- `discount`: number
- `totalAmount`: number
- `currency`: `'USD' | 'BDT'`
- `paidAt`: string (optional)
- `paymentMethod`: string (optional: `bank_transfer`, `stripe`, `bkash`, `nagad`, `wise`)
- `paymentReference`: string (optional)
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

### 7. `/expenses/{expenseId}` (Admin Only)
Agency operating expenses (e.g. Stape server fees, proxy tools, contractor fees).
- `id`: string
- `category`: string
- `description`: string
- `vendor`: string
- `amount`: number
- `currency`: `'USD' | 'BDT'`
- `date`: string
- `recordedByUserId`: string

### 8. `/audit_logs/{logId}` (Admin Only)
Immutable security logs.
- `id`: string
- `timestamp`: string
- `actorUserId`: string
- `actorEmail`: string
- `actorRole`: string
- `action`: string
- `entityType`: string
- `entityId`: string
- `details`: string
- `status`: `'success' | 'failure'`
