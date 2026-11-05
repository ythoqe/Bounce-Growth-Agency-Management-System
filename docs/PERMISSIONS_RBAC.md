# Permissions & Role-Based Access Control (RBAC) Specification

## 1. Overview
Bounce Growth operates under a strict Attribute-Based and Role-Based Access Control model. Security rules are mathematically isolated to ensure that external clients can never inspect other clients' accounts, agency margins, or team internals.

---

## 2. User Roles & Capabilities

| Module / Resource | Admin / Founder | Team Member (Specialist) | Client Portal User |
| :--- | :--- | :--- | :--- |
| **Agency Dashboard** | Full agency-wide metrics | Assigned tasks & projects | No access (Redirected to `/portal`) |
| **Client Portal** | Full preview access | View access | Isolated to owned `clientId` only |
| **CRM & Leads** | Full read/write | Read & update assigned leads | No access |
| **Clients List** | Create, edit, archive | View assigned clients only | No access to client directory |
| **Internal Client Notes** | Full read/write | Full read/write | **STRICTLY HIDDEN** |
| **Projects** | Full read/write | Assigned projects | Only projects with `clientVisible: true` |
| **Tasks** | Full read/write | Assigned tasks | Only tasks with `clientVisible: true` |
| **Task Approvals** | Full control | Submit for approval | Approve or Request Revisions |
| **Tracking Assets** | Full credentials & edit | View & configure tags | Read-only for `shared_with_client` |
| **Private API Tokens** | Visible | Visible for setup | **STRICTLY HIDDEN** |
| **Finance & Invoices** | Full read/write | No access | View own issued invoices only |
| **Agency Expenses** | Full read/write | **NO ACCESS** | **STRICTLY HIDDEN** |
| **Agency Profit / Margins** | Full visibility | **NO ACCESS** | **STRICTLY HIDDEN** |
| **Services & Pricing** | Manage rate cards | View rate cards | View published packages |
| **SOP & Knowledge Base** | Manage SOPs | Read & contribute | No access |
| **Team Management** | Invite & change roles | View staff directory | Only assigned specialist contact |
| **System Settings** | Full management | No access | No access |
| **Audit Logs** | Full read access | No access | No access |

---

## 3. Client Isolation Rules in Firestore (Phase 2 Rule Target)
1. **Identity Integrity**: All authenticated client requests must possess `resource.data.clientId == request.auth.token.clientId` or be present in `resource.data.portalAccessUserIds`.
2. **Field Stripping**: Queries by clients to `/clients/{clientId}` must never return `internalNotes`.
3. **No Blanket Reads**: Every `allow list` evaluates `resource.data.clientId == userDoc.clientId`.
4. **Denial of Wallet**: Maximum string lengths and allowed keys enforced via ABAC helper blueprints.
