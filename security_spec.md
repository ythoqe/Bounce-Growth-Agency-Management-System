# Bounce Growth Security Specification & Penetration Test Suite

## 1. System Invariants & Zero-Trust Access Control (ABAC)

1. **Default-Deny Catch-All**: Any document, collection, or sub-collection not explicitly allowed must return `PERMISSION_DENIED`.
2. **Client Isolation**: Client portal users can ONLY read and write documents that match their assigned `clientId` and where `clientVisible == true`. Cross-client queries must be rejected at the database level.
3. **No Client Role Elevation**: Users can NEVER set, update, or alter their own `role`, `clientId`, or administrative status. Role updates are restricted to verified admins.
4. **Identity & Creator Verification**: On create, the author/creator UID field in incoming payload must strictly equal `request.auth.uid`. No user may forge another user's UID.
5. **PII & Internal Notes Boundary**: Internal agency notes on clients (`internalNotes`) and agency operating expenses (`/expenses/{expenseId}`) are mathematically inaccessible to non-admin / client users.
6. **Financial Integrity**: Invoices and expenses cannot have negative sums. Invoices in terminal state (`paid`, `voided`) cannot have their amounts modified.
7. **Path Variable Hardening**: Every document ID path parameter must conform to `isValidId()` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
8. **Audit Trail Immutability**: Documents in `/audit_logs` are strictly append-only by authenticated actors; updates and deletes are permanently forbidden (`allow update, delete: if false`).

---

## 2. The "Dirty Dozen" Penetration Payloads

The following 12 hostile payloads are designed to attack Identity, Authorization, and Integrity invariants. All 12 must evaluate to `PERMISSION_DENIED`:

### Payload 01: Client Cross-Tenant Snooping (Data Leak Attack)
- **Actor**: Client `usr_client_dhaka` (linked to `client_apex_01`).
- **Target**: `GET /clients/client_competitor_99`
- **Expected Outcome**: `PERMISSION_DENIED`. Clients may only access `/clients/client_apex_01`.

### Payload 02: Privilege Escalation on Profile Creation
- **Actor**: Newly authenticated user `usr_attacker`.
- **Target**: `CREATE /users/usr_attacker`
- **Payload**: `{ "id": "usr_attacker", "email": "attacker@external.com", "role": "admin", "status": "active" }`
- **Expected Outcome**: `PERMISSION_DENIED`. Self-assigning the `'admin'` role on signup is prohibited. Only bootstrapped admin or server functions may provision admin roles.

### Payload 03: Privilege Escalation via Shadow Update
- **Actor**: Team Member `usr_team_specialist`.
- **Target**: `UPDATE /users/usr_team_specialist`
- **Payload**: `{ "role": "admin" }`
- **Expected Outcome**: `PERMISSION_DENIED`. Users are blocked from modifying their own `role` field.

### Payload 04: Team Member Unauthorized Access to Financial Ledger
- **Actor**: Team Member `usr_team_specialist`.
- **Target**: `LIST /invoices` or `GET /expenses/exp_tool_01`
- **Expected Outcome**: `PERMISSION_DENIED`. Team members are restricted from agency financial ledgers and operating expenses.

### Payload 05: Unauthenticated Public Scraping
- **Actor**: Anonymous user (`request.auth == null`).
- **Target**: `LIST /clients` or `LIST /assets`
- **Expected Outcome**: `PERMISSION_DENIED`. Zero unauthenticated reads across all agency assets.

### Payload 06: Client Reading Private Internal Agency Notes
- **Actor**: Client `usr_client_dhaka`.
- **Target**: `GET /clients/client_apex_01` attempting to query document with `internalNotes` exposed.
- **Expected Outcome**: `PERMISSION_DENIED` or field-stripped.

### Payload 07: Client Attempting to View Internal-Only Projects
- **Actor**: Client `usr_client_dhaka`.
- **Target**: `GET /projects/proj_internal_strategy` where `clientVisible: false`.
- **Expected Outcome**: `PERMISSION_DENIED`. Clients can only read projects explicitly flagged `clientVisible == true`.

### Payload 08: Client Forging Creator UID on Task Creation
- **Actor**: Client `usr_client_dhaka`.
- **Target**: `CREATE /tasks/task_malicious_01`
- **Payload**: `{ "creatorId": "founder_uid_impersonated", "clientId": "client_apex_01", "title": "Free Work Order" }`
- **Expected Outcome**: `PERMISSION_DENIED`. `incoming().creatorId` must strictly equal `request.auth.uid`.

### Payload 09: Path Variable Buffer Overflow (Denial of Wallet)
- **Actor**: Authenticated user.
- **Target**: `GET /projects/` followed by a 4KB garbage string document ID.
- **Expected Outcome**: `PERMISSION_DENIED`. Fails `isValidId()` boundary check.

### Payload 10: Ghost Field Injection (Anti-Update-Gap)
- **Actor**: Team Member `usr_team_specialist`.
- **Target**: `UPDATE /tasks/task_100`
- **Payload**: `{ "status": "done", "pwned_ghost_field": true }`
- **Expected Outcome**: `PERMISSION_DENIED`. Fails strict `affectedKeys().hasOnly(['status', 'updatedAt'])`.

### Payload 11: Tampering With Paid Invoices
- **Actor**: Authenticated user.
- **Target**: `UPDATE /invoices/inv_paid_2026_01`
- **Payload**: Attempting to alter `totalAmount` or `items` on an invoice already in status `'paid'`.
- **Expected Outcome**: `PERMISSION_DENIED`. Terminal state locking prevents modifying financial terms after payment.

### Payload 12: Storage Cross-Client File Exfiltration
- **Actor**: Client `usr_client_dhaka`.
- **Target**: `GET /storage/clients/client_competitor_99/contract.pdf`
- **Expected Outcome**: `PERMISSION_DENIED`. Cloud Storage security rules forbid reading client directories other than the caller's authorized `clientId`.
