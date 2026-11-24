# 10 — Phased Development Roadmap

**Execution Rule:** No phase may skip its prerequisite security, database, or testing gates. Live payment credentials remain strictly disabled until **Phase 8** passes every acceptance gate and receives explicit owner sign-off. Effort is expressed in relative engineering complexity bands (no invented calendar dates).

---

## Phase 1 — Security Remediation, PR Consolidation & Baseline Stabilization (Gate)
- **Scope:**
  - Enable GitHub branch protection on `main`; close superseded PRs (`#1`, `#2`, `#3`, `#7`) and reject PR #10 as-is.
  - Rebase PR #5 onto `main`, resolve conflicts, and fold in missing P0/P1 fixes: remove `*.run.app` CORS bypass (`AUD-SEC-002`), harden `PATCH /api/appointments/:referenceCode` (`AUD-API-001`), fix `POST /api/appointments` DB-before-Calendar ordering (`AUD-API-002`), return `503` on `/api/health/ready` when DB fails (`AUD-API-003`), add server-side admin session revocation + `POST /api/admin/auth/logout`, externalize Gemini model IDs (`AUD-API-004`), and modularize `src/server/app.ts` into domain routers.
  - Reconcile live production Supabase project & Railway service (`api.ophireummultimedia.com`); create idempotent timestamped baseline migration + UUID-only `is_ophireum_admin()`; configure Resend, Google Calendar, `ADMIN_SESSION_SECRET`, `APP_VERSION`; investigate `1641ms` DB latency.
  - Optimize 11.27 MB `OPHIREUM_Logo_6504e623.png` to `< 40 KB`, remove duplicate unused assets, standardize on `npm` (`package-lock.json`), enable ESLint + `strict: true`, remove misleading client-only file input in `ContactSection.tsx`, fix `ServicesSection.tsx` Clear button.
- **Files / Modules Affected:** `src/server/*`, `server.ts`, `supabase/migrations/*`, `public/assets/*`, `package.json`, `tsconfig.json`, `.github/workflows/*`, `src/components/EnterpriseModal.tsx`, `ContactSection.tsx`, `ServicesSection.tsx`.
- **Dependencies:** Railway, Supabase, and GitHub admin access; DNS records for Resend.
- **Testing & Acceptance Criteria:** All existing + new security regression tests pass; live CORS rejects `*.run.app`; real Postgres clean-room migration + RLS test passes; Resend test email delivered; DB ping `< 150ms`; `main` protected.
- **Risks:** Live production schema differences from `schema.sql` (mitigate via read-only schema dump + verified backup before any migration).
- **Estimated Effort:** Medium (M).

---

## Phase 2 — Customer Authentication, Profiles, Legal Compliance & Portal Shell
- **Scope:**
  - Add client routing (clean URL/modal routing for `/portal/*`, `/legal/*`) with code-splitting (`React.lazy`).
  - Implement Supabase Auth PKCE flows: Sign Up, Email Verification + Resend, Sign In, Sign Out, Password Recovery & Reset, Change Password, optional TOTP MFA.
  - Build Express `requireCustomer` middleware + `/api/customer/profile`, `/api/customer/consents`, `/api/customer/data-export`, `/api/customer/closure-request`.
  - Apply migration adding `auth.users(id)` FK & `UNIQUE` index on `client_profiles`, wiring `consent_records`, adding `updated_at` & `audit_logs` immutability triggers, and linking `solution_requests`/`consultation_appointments` optionally to `user_id`.
  - Publish Privacy Policy (RA 10173), Terms of Service (RA 11967 / RA 7394), and Refund/Dispute Policy preserving mandatory PH statutory consumer remedies.
- **Files / Modules Affected:** `src/server/middleware/customerAuth.ts`, `src/server/routes/customer.ts`, `src/components/portal/*`, `src/components/legal/*`, `supabase/migrations/*_customer_accounts.sql`.
- **Dependencies:** Phase 1 complete; Supabase Auth SMTP & redirect URLs configured; legal copy approved.
- **Testing & Acceptance Criteria:** E2E auth lifecycle tests (signup -> verify -> login -> reset -> profile edit -> consent logged -> logout); cross-customer isolation tests proving User A cannot read/mutate User B's profile or data (`403`/0 rows).
- **Risks:** Email verification deliverability if custom Supabase SMTP (Resend) is not configured.
- **Estimated Effort:** Medium (M).

---

## Phase 3 — Database-Backed Service Catalog, Cart, Offers & Credits Engine
- **Scope:**
  - Migrate the 78 services & configurable options from `src/data/serviceCatalog.ts` into `catalog_services` & `catalog_service_options` with integer minor-unit pricing (`PHP`/`USD`), SKU versioning, and revision quotas; retire legacy `servicesData.ts`.
  - Build persistent `carts` & `cart_items` API (`/api/cart/*`) with guest-to-user cart merge and interactive Storefront Cart Drawer.
  - Implement `promotions` / `promotion_redemptions` validation API and append-only `credit_wallets` / `credit_ledger` engine with Postgres atomic debit/credit RPCs.
  - Build Customer Dashboard views for Available Credits, Credit History, and Available Offers.
- **Files / Modules Affected:** `src/server/routes/catalog.ts`, `src/server/routes/cart.ts`, `src/server/routes/credits.ts`, `src/components/cart/*`, `src/components/portal/CreditsView.tsx`, `supabase/migrations/*_catalog_cart_credits.sql`.
- **Dependencies:** Phase 2 complete; business sign-off on canonical PHP vs USD pricing policy (`AUD-COM-002`).
- **Testing & Acceptance Criteria:** Exact minor-unit arithmetic unit tests; concurrent credit redemption race test (zero negative balances); promo expiry/limit/min-order enforcement tests.
- **Risks:** FX/currency rounding inconsistencies (mitigate by enforcing integer minor units end-to-end).
- **Estimated Effort:** Medium-Large (M–L).

---

## Phase 4 — Server-Authoritative Orders, Checkout & Atomic Reference Allocation
- **Scope:**
  - Implement `orders`, `order_items`, `order_status_history`, `invoices`, and `payment_reference_sequences` + `allocate_ophireum_payment_ref()` (Asia/Manila `MMDDYYYYHHMMAM/PMNNN`).
  - Build `POST /api/checkout/orders` (idempotent, recalculates all prices/add-ons/discounts/credits/taxes server-side, records checkout consent, creates immutable price snapshots) and `GET /api/orders`, `GET /api/orders/:id`.
  - Implement server-side PDF invoice/receipt generation stored in private `invoices-pdf` bucket with authenticated signed download URLs.
  - Add `FOR UPDATE SKIP LOCKED` Postgres RPC for durable multi-replica outbox processing.
- **Files / Modules Affected:** `src/server/routes/checkout.ts`, `src/server/routes/orders.ts`, `src/server/services/invoiceService.ts`, `src/components/checkout/*`, `src/components/portal/OrdersView.tsx`, `supabase/migrations/*_orders_invoices.sql`.
- **Dependencies:** Phase 3 complete.
- **Testing & Acceptance Criteria:** Tampered client price payload ignored/rejected; duplicate `Idempotency-Key` returns single order; concurrency stress test allocating 100 parallel Manila payment references with zero collisions and proper daily rollover; PDF invoice download blocked for non-owners (`403`).
- **Risks:** Concurrency deadlocks on reference sequence row (mitigate by allocating reference inside short, single-row atomic function).
- **Estimated Effort:** Medium-Large (M–L).

---

## Phase 5 — Multi-Gateway Payment Integrations (Sandbox-First)
- **Scope:**
  - Build central `PaymentOrchestrator` and `PaymentProviderAdapter` registry (`src/server/payments/*`), raw-body webhook capture middleware, `payment_intents`, `payment_webhook_events`, and `payment_refunds`.
  - **Phase 5A (Primary):** Implement **Xendit** (PH Test Mode: hosted invoice/checkout, `x-callback-token` constant-time verification, channel filtering) and **PayPal** (Sandbox: Orders v2 create/capture + `/v1/notifications/verify-webhook-signature`).
  - **Phase 5B (Follow-On):** Implement **Maya Checkout** (Sandbox) once merchant onboarding credentials arrive.
  - **Phase 5C (Deferred Adapter Slots):** Keep **Direct GoTyme** and **PayMongo** disabled behind explicit feature flags until official merchant approval & API docs are onboarded.
  - Wire post-payment atomic trigger: mark order `paid` -> allocate `MMDDYYYYHHMMAM/PMNNN` -> create invoice & fulfillment project -> queue customer receipt email + admin email/dashboard alert (+ SMS only after full E.164 number & SMS provider configured).
- **Files / Modules Affected:** `src/server/payments/*`, `src/server/routes/webhooks.ts`, `src/components/checkout/CheckoutReturnPage.tsx`, `supabase/migrations/*_payments.sql`.
- **Dependencies:** Phase 4 complete; Xendit Test Mode and PayPal Sandbox credentials stored strictly in Railway environment variables.
- **Testing & Acceptance Criteria:** Invalid/replayed/out-of-order webhook signature tests (`401`/`200` idempotent no-op); amount/currency mismatch rejection; duplicate webhook delivery fulfills strictly once; sandbox E2E checkout + refund/reversal lifecycle tests.
- **Risks:** Unverified webhook bypass or partial failure between payment capture and fulfillment (mitigate via DB transaction + reconciliation job).
- **Estimated Effort:** Large (L).

---

## Phase 6 — Fulfillment, Requirements Intake, Private Storage, Deliverables & Support
- **Scope:**
  - Provision private Supabase Storage buckets (`customer-uploads`, `order-deliverables`, `invoices-pdf`) with strict RLS + Express signed URL endpoints, MIME/magic-byte & size validation (`<= 25 MB`).
  - Build Order Fulfillment Tracker (`fulfillment_projects`, `project_milestones`), structured Project Requirement submission linked to paid orders, Deliverable download & client approval sign-off, Revision request workflow enforcing SKU revision quotas, in-app `customer_notifications` center, and threaded Support Tickets.
- **Files / Modules Affected:** `src/server/routes/fulfillment.ts`, `src/server/routes/storage.ts`, `src/server/routes/support.ts`, `src/components/portal/FulfillmentView.tsx`, `DeliverablesView.tsx`, `SupportView.tsx`, `supabase/migrations/*_fulfillment_support.sql`.
- **Dependencies:** Phase 4 complete (can parallelize partially with Phase 5B).
- **Testing & Acceptance Criteria:** Unauthorized signed-URL access blocked (`403`); disallowed file types/oversize rejected (`400`/`413`); revision limit enforcement tested; ticket ownership isolation tested.
- **Risks:** Malicious file uploads (mitigate via strict MIME/extension allowlist, non-executable `Content-Disposition: attachment`, optional AV scan hook).
- **Estimated Effort:** Medium-Large (M–L).

---

## Phase 7 — Full Admin Operations Console & Financial Reconciliation
- **Scope:**
  - Replace the read-only tab in `EnterpriseModal.tsx` with a dedicated lazy-loaded RBAC Admin Operations Console (`/admin/*`).
  - Add authenticated admin mutation APIs (all recorded in immutable `audit_logs`): order & payment inspection, provider reconciliation sync, dual-confirmed refund initiation, fulfillment milestone & deliverable upload, catalog/promo/credit adjustments, inquiry/appointment status updates, manual outbox retry, and support ticket replies.
  - Add shared Redis/Postgres rate limiting, APM/error alerting, and webhook dead-letter monitoring.
- **Files / Modules Affected:** `src/server/routes/admin/*`, `src/components/admin/*`.
- **Dependencies:** Phases 4, 5, and 6.
- **Testing & Acceptance Criteria:** Role-based permission matrix tests (`admin` vs `super_admin` vs `customer` -> `403`); every mutation writes an immutable `audit_logs` entry; refund updates ledger/order/provider accurately.
- **Risks:** Over-privileged admin mutations without audit trail (mitigate via centralized admin audit middleware).
- **Estimated Effort:** Medium (M).

---

## Phase 8 — Security Audit, Load/DR Testing & Controlled Live Payment Go-Live
- **Scope:**
  - Run full CI, SAST, dependency vulnerability audit (`npm audit`), DAST, independent penetration test, and Supabase backup/restore drill.
  - Complete Xendit/PayPal/Maya KYB live merchant verification (requiring live Privacy Policy, Terms, Refund Policy URLs).
  - Execute staging-to-production canary checklist, configure live gateway secrets strictly in Railway, run controlled ₱100 / $1 live penny test + refund verification, and obtain formal written owner go-live sign-off.
- **Dependencies:** Phases 1–7 100% verified; merchant KYB approval; legal sign-off.
- **Testing & Acceptance Criteria:** Zero open P0/P1 findings; 100% automated regression + E2E suite passing; verified live penny-test settlement, reference number `MMDDYYYYHHMMAM/PMNNN`, invoice PDF, admin notification, and refund cycle.
- **Estimated Effort:** Medium (M).
