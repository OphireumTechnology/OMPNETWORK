# 02 — Customer Portal Audit

**Audited Scope:**
1. **`main` branch (Production Codebase):** `src/components/EnterpriseModal.tsx`, `src/components/ServicesSection.tsx`, `src/components/services/*`, `src/components/ContactSection.tsx`, `src/components/consultant/*`, `src/services/supabaseService.ts`.
2. **Unmerged Draft PR #10 (`feature/customer-commerce-foundation`):** `src/components/CustomerCommercePortal.tsx`, `supabase/migrations/002_customer_commerce_foundation.sql`, `src/components/Header.tsx`, `src/App.tsx`.

> **Critical Rule Applied:** Visual prototypes and unmerged draft branches are **never** classified as working production features.

---

## 1. Executive Reality Check

- **On `main` (Production):** **ZERO functional customer portal features exist.** The "Client Portal" tab inside `EnterpriseModal.tsx` (lines `278–360`) explicitly labels itself `"Enterprise Client Portal Specification — PHASE 2"` and `"Sample Milestone Architecture Preview (Demonstration)"` with hardcoded cards. There is no customer sign-up, sign-in, session management, dashboard, cart, checkout, order history, credits, offers, invoices, deliverables, or support system.
- **On Draft PR #10 (`feature/customer-commerce-foundation`):** Contains a minimal 213-line prototype (`CustomerCommercePortal.tsx`) providing raw Supabase Auth signup/login, direct browser upsert to `client_profiles`, and direct browser insertion of free-text arbitrary-amount `customer_orders` rows (`status = 'draft'`). It is **unmerged**, lacks a backend API, lacks password reset/verification UX/account closure, is completely disconnected from `SERVICE_CATALOG`, and introduces a **P0 client-side price-tampering anti-pattern** if connected to payments.

---

## 2. Feature-by-Feature Verification Matrix

### A. Account Management

| Feature | Exists on `main`? | Source File / Function | Exists in PR #10? | Connected to Backend API? | Persists Data? | Auth Required? | AuthZ Enforced? | Tested? | What Remains Incomplete |
|---|---|---|---|---|---|---|---|---|---|
| Customer registration | **No** | None on `main` | Prototype (`CustomerCommercePortal.tsx:authenticate`) | Direct Supabase Auth only (no Express API) | Unverified (requires `VITE_SUPABASE_*` + Auth config) | N/A | N/A | **No** | No terms/privacy consent capture, no server profile bootstrap trigger, no abuse rate limit, no tests. |
| Email verification | **No** | None | Relies passively on Supabase Auth default | No | No | N/A | N/A | **No** | No resend-verification button, no verification callback route, no gating of unverified accounts from checkout. |
| Login and logout | **No** (Admin only in `EnterpriseModal.tsx`) | None for customers | Prototype (`signInWithPassword` / `signOut`) | Direct Supabase Auth only | Browser session only | Yes (in PR #10) | N/A | **No** | No Express session verification, no MFA/step-up option, no login error throttling UX. |
| Password recovery | **No** | None | **No** | No | No | N/A | N/A | **No** | Entire `resetPasswordForEmail` request flow missing. |
| Password reset | **No** | None | **No** | No | No | N/A | N/A | **No** | Entire recovery token callback & `updateUser({ password })` UI missing. |
| Customer profile creation | **No** (`client_profiles` table unused) | `schema.sql:46–56` (unwired) | Prototype (`saveProfile` manual upsert) | Direct browser Supabase write | Only if `002` applied | Yes (in PR #10) | Partial (PR #10 `FOR ALL` allows profile DELETE + arbitrary email change) | **No** | No automatic profile creation on signup, no server validation, email desync with `auth.users`. |
| Profile editing | **No** | None | Prototype (`full_name`, `phone`, `company_name`) | Direct browser Supabase write | Only if `002` applied | Yes (in PR #10) | Partial | **No** | Missing billing address, TIN/VAT info for PH invoicing, avatar, notification preferences, phone/format validation. |
| Session persistence | **No** (customers) | None | Prototype (`getSession` + `onAuthStateChange`) | Browser SDK only | `localStorage` via Supabase SDK | Yes | N/A | **No** | No token refresh error handling, no cross-tab logout sync verification, no backend JWT verification middleware for customers. |
| Account security (2FA, sessions, password change) | **No** | None | **No** | No | No | N/A | N/A | **No** | No change-password flow, no active sessions/devices list, no security event log, no MFA enrollment. |
| Account deletion / closure workflow | **No** | None | **No** (dangerously allows raw SQL `DELETE` on `client_profiles` via `FOR ALL` RLS!) | No | No | N/A | **Unsafe in PR #10** | **No** | Missing compliant PH RA 10173 data erasure/anonymization workflow preserving legally required financial/BIR tax records. |

### B. Customer Dashboard

| Feature | Exists on `main`? | Source File / Function | Exists in PR #10? | Connected to Backend? | Persists Data? | Auth / AuthZ | Tested? | What Remains Incomplete |
|---|---|---|---|---|---|---|---|---|
| Dashboard navigation | **Mockup only** | `EnterpriseModal.tsx:278–360` | 3-tab prototype (`dashboard`, `checkout`, `profile`) | No (PR #10 uses direct Supabase) | No | PR #10 checks `session` | **No** | Missing Orders, Invoices, Deliverables, Credits, Offers, Support, Notifications, Settings views. |
| Customer overview | **Mockup only** | `EnterpriseModal.tsx:287–356` | 3 static count cards (`Orders`, `Draft`, `Paid`) | Direct Supabase query in PR #10 | No | PR #10 RLS `auth.uid() = user_id` | **No** | Missing active production progress, credit balance, unread alerts, pending actions. |
| Active orders | **No** | None | Filtered draft/paid rows in table | Direct Supabase in PR #10 | Draft only | Owner SELECT in PR #10 | **No** | No order detail view, no production stage tracker, no payment status timeline. |
| Previous purchases | **No** | None | Same 25-row flat table | Direct Supabase in PR #10 | No completed purchases possible | Owner SELECT in PR #10 | **No** | No pagination, search, filter, reorder, or receipt link. |
| Service requests | **Public submit only** (no customer view) | `SolutionBuilderModal.tsx`, `ContactSection.tsx` -> `POST /api/inquiries` | **Not linked** | `POST /api/inquiries` persists to `solution_requests` | Yes (anonymous/unlinked) | **None** (no `user_id` column on `solution_requests`) | Backend POST tested | Customers cannot view their submitted solution requests or consultations in a portal. |
| Available credits | **No** | None | **No** | No | No | No | **No** | No credit ledger schema, balance view, or redemption engine. |
| Credit usage history | **No** | None | **No** | No | No | No | **No** | No append-only credit transaction log or UI. |
| Available offers / Discount visibility | **No** | None | **No** | No | No | No | **No** | No promotions/coupons table, validation endpoint, or customer display. |
| Notifications | **No** (email outbox is backend-only) | `notification_records` (admin view only) | **No** | No | No | No | **No** | No in-app notification center, read/unread state, or customer preferences. |
| Invoices & receipts | **No** | None | **No** | No | No | No | **No** | No invoice numbering, PDF receipt generation, or download endpoints. |
| Downloadable deliverables | **No** | None | **No** | No | No | No | **No** | No Supabase Storage bucket, signed URL generator, or deliverable approval UI. |
| Customer support | **Static links / AI widget only** | `AIConsultantWidget.tsx` (escalation modal) | **No** | No ticketing backend | Local `localStorage` chat only | No | **No** | No support ticket creation, threaded replies, or SLA tracking. |
| Account settings | **No** | None | Partial (`profile` tab) | Direct Supabase in PR #10 | Partial | Partial | **No** | No notification settings, billing profile, password/security settings, or export/closure controls. |

### C. Customer Service Management

| Feature | Exists on `main`? | Source File / Function | Connected to Backend? | Persists Data? | Auth / AuthZ | Tested? | What Remains Incomplete |
|---|---|---|---|---|---|---|---|
| Browse services | **Yes** | `ServicesSection.tsx`, `ServiceCard.tsx`, `serviceCatalog.ts` (78 items, 10 categories) | Static TS bundle | N/A | Public | Build tested | Catalog hardcoded in TS; not DB-backed or versioned for commerce pricing. |
| View service descriptions & package details | **Yes** | `ServiceDetailModal.tsx` | Static TS bundle | N/A | Public | Build tested | No DB-backed SKU IDs, revision limits, SLA terms, or tax/FX disclosures. |
| Select additional services & configure options | **Yes** | `ServicesSection.tsx`, `ServiceDetailModal.tsx`, `SolutionBuilderModal.tsx` | Submitted via `POST /api/inquiries` | Persists inquiry (`solution_requests`) | Public | Backend pricing test exists | `ServicesSection.tsx:709` Clear button leaves `selectedOptionsMap` stale. Not connected to a persistent cart/order system. |
| Add services to cart | **Partial (ephemeral local selection)** | `ServicesSection.tsx` (`selectedIds` React state) | **No** | **No** (lost on refresh) | Public | **No** | No persistent server-side cart (`carts` / `cart_items`), no quantity support, no promo code application, no checkout handoff. |
| View order history | **No** (`main`) / Draft prototype (PR #10) | PR #10 `CustomerCommercePortal.tsx` | No Express API | PR #10 draft only | PR #10 owner RLS | **No** | Not integrated with `SERVICE_CATALOG`, payments, or fulfillment. |
| Track service production | **Mockup only** | `EnterpriseModal.tsx:314–340` | **No** | **No** | No | **No** | No `service_orders`/`fulfillment_milestones` tables or status transition API. |
| Submit project requirements | **Partial (local brief / inquiry message)** | `ProjectBriefModal.tsx` (`localStorage`), `ContactSection.tsx` | `POST /api/inquiries` only (`project_requirements` & `project_briefs` tables unused) | Only `solution_requests.message` | Public | Inquiry POST tested | Dedicated intake forms linked to paid orders do not exist. |
| Upload reference files | **Broken / Misleading UI** | `ContactSection.tsx:483–508` | **No** (only stores `file.name` string!) | **No** (file binary discarded) | Public | **No** | No Supabase Storage bucket, malware/MIME/size validation, or signed upload URLs. |
| Receive completed deliverables | **No** | None | **No** | **No** | No | **No** | No deliverable staging, signed download URLs, or acceptance sign-off. |
| Request revisions | **No** | None | **No** | **No** | No | **No** | No revision quota tracking, change-request tickets, or milestone loop. |

---

## 3. Customer Portal Findings

### Finding `AUD-PORTAL-001`
- **Severity:** `P0`
- **Location:** `src/components/EnterpriseModal.tsx:278–360`
- **Evidence (Code-Level Observation):** The Client Portal tab renders static milestone cards labeled `"Sample Milestone Architecture Preview (Demonstration)"` with zero authentication, API integration, or persistence.
- **Business Impact:** Customers cannot register, sign in, manage orders, pay, or receive deliverables.
- **Technical Impact:** Full customer identity, session, dashboard, and order lifecycle must be engineered from scratch on top of Supabase Auth + Express API.
- **Recommended Correction:** Build dedicated authenticated Customer Portal routes/views backed by Express customer endpoints and hardened Supabase RLS (Phases 2–6 of Roadmap).
- **Required Test:** End-to-end authentication, profile CRUD, cross-customer isolation (`403`/zero rows), and order lifecycle tests.
- **Dependencies:** Baseline DB migration (`AUD-DB-001`) and security hardening (`AUD-SEC-001`).
- **Current Status:** Open.

### Finding `AUD-PORTAL-002`
- **Severity:** `P1`
- **Location:** `src/components/ContactSection.tsx:483–508`
- **Evidence (Code-Level Observation):** `handleFileUpload` reads `e.target.files?.[0]` and saves only `file.name` into React state (`formData.fileName`), appending the filename as text in the inquiry payload; the file content is never uploaded.
- **Business Impact:** Customers think they submitted RFPs, NDAs, or brand assets when Ophireum never receives them.
- **Technical Impact:** Misleading UX and missing secure object-storage pipeline.
- **Recommended Correction:** Either remove the file picker until signed Supabase Storage upload endpoints exist, or implement authenticated signed-URL upload with MIME/size validation (`<= 25 MB`, allowlisted extensions) and private bucket storage.
- **Required Test:** Integration test verifying rejected invalid MIME/oversize uploads and authorized download via signed URL only.
- **Dependencies:** Private Supabase Storage buckets & policies.
- **Current Status:** Open.
