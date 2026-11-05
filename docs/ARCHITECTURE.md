# Bounce Growth | Agency Management System Architecture

## 1. System Overview
**Bounce Growth** is a tracking-first digital marketing agency based in Dhaka, Bangladesh. The agency specializes in:
- Server-Side Google Tag Manager (sGTM) on Stape and Cloud Run
- Meta Conversions API (CAPI) with first-party cookie recovery & event deduplication
- Meta Ads, Google Ads (Search & Performance Max), and TikTok Ads management
- Google Analytics 4 (GA4) e-commerce funnel tracking & Looker Studio executive reporting
- Conversion Rate Optimization (CRO)

This application is exclusively for Bounce Growth. It is **single-agency by design** and deliberately avoids multi-tenant complexity.

---

## 2. Architectural Pillars

### A. Separation of Concerns & Modular Organization
The codebase follows a feature-based modular folder structure:
- `src/components/common`: Reusable, accessible UI primitives (Buttons, Inputs, Selects, Cards, Tables, Tabs, Modals, Empty/Loading/Error states).
- `src/components/layout`: Admin Layout, Admin Sidebar, Admin TopNav, Client Layout, Client Sidebar, Client TopNav.
- `src/features/*`: Domain features (auth, dashboard, crm, clients, projects, tasks, assets, finance, marketing, reports, documents, sop, team, settings, client-portal).
- `src/services/firebase`: Firebase SDK client initialization boundary and standardized Firestore ABAC error throwing.
- `src/types/*`: Central TypeScript definitions for users, clients, projects, tasks, finances, tracking assets, and audit logs.
- `src/schemas/*`: Zod runtime validation schemas ensuring runtime integrity for all mutations.
- `src/utils/*`: Tailwind merge (`cn`), currency formatters (BDT ৳ and USD $), date formatters.

### B. Strict Role-Based Access Control (RBAC)
Three distinct access tiers are enforced:
1. **Admin / Founder**: Full administrative control over all clients, projects, tasks, rate cards, team invitations, financial statements, agency profit margins, and audit logs.
2. **Team Member (Specialist)**: Access to assigned clients, tracking containers, ad campaign tasks, and SOPs. Completely restricted from viewing financial ledger, agency expenses, and profit figures.
3. **Client Portal User**: Strictly isolated to their specific `clientId`. Can only view approved projects, visible tasks, issued invoices, published reports, and shared documents. Never permitted to query other clients, internal agency notes, internal expenses, or employee details.

### C. Zero Fake Data & Honest State Management
- No hardcoded vanity KPI figures or fictitious records in production code.
- All views render authentic empty, loading, and error states.
- System transparently displays Firebase integration readiness.

### D. Zero-Trust Firestore Security (Upcoming in Phase 2)
- All mutations guarded by Zod validation client-side and strict ABAC security rules in `firestore.rules`.
- Subcollections enforce relational parent existence checks (`exists()`).
- Document creation forbids client-side role elevation (`request.auth.uid` validation).
