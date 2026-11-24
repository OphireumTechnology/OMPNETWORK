# 08 — Commerce System Gap Analysis

This document measures the current `main` branch (`e1f158b2`) against every functional, architectural, security, operational, and Philippine legal requirement for the full **Ophireum Multimedia Commerce Platform**.

---

## 1. Domain-by-Domain Gap Matrix

| Commerce Domain | Current State on `main` | Required Target State | Gap Severity | Key Missing Building Blocks |
|---|---|---|---|---|
| **1. Customer Identity & Accounts** | None (`main`); incomplete unsafe draft in PR #10. | Supabase Auth email/password + email verification + password recovery/reset + MFA option + server-backed profile & consent capture + compliant closure workflow. | **P0** | Express customer JWT middleware, `client_profiles` FK/RLS hardening, auth UI routes, consent recording, account closure/anonymization endpoint. |
| **2. Service Catalog & Pricing Authority** | 78 services hardcoded in `src/data/serviceCatalog.ts` + duplicate 12-item `servicesData.ts`; hardcoded FX rate `58 PHP/USD`. | Versioned, DB-backed catalog (`catalog_services`, `catalog_options`, `catalog_price_snapshots`) with explicit SKU codes, PHP/USD pricing, tax flags, revision quotas, and admin publish workflow. | **P0** | DB catalog schema + seed script from `serviceCatalog.ts`, public catalog API, admin catalog CRUD, FX rate governance. |
| **3. Persistent Cart & Configurator** | Ephemeral React state (`selectedIds` in `ServicesSection.tsx`), lost on refresh; no quantities or promo codes. | Persistent DB-backed `carts` & `cart_items` supporting anonymous-to-authenticated merge, quantities, add-on options, promo/credit previews, and server-side totals. | **P1** | `carts`, `cart_items` tables, `/api/cart/*` endpoints, storefront cart drawer. |
| **4. Server-Authoritative Orders & Checkout** | None (`solution_requests` is lead inquiry only; PR #10 allows client-typed amounts). | Immutable server-created `orders` & `order_items` snapshotting catalog SKU, unit price, add-ons, discounts, credits applied, tax, grand total, currency, and idempotency key. | **P0** | `orders`, `order_items`, `order_status_history` tables, `POST /api/checkout/orders`, strict state machine (`draft -> pending_payment -> paid -> in_production -> completed` + `cancelled`/`refunded`/`disputed`). |
| **5. Multi-Gateway Payment Orchestration** | None. | Unified `PaymentProviderAdapter` interface: **Phase 1: Xendit (PH) + PayPal (Intl)**; **Phase 2: Maya Checkout**; **Deferred: Direct GoTyme + PayMongo** (sandbox-first, hosted checkout only, zero card storage). | **P0** | `payment_intents`, `payment_transactions`, `payment_webhook_events`, `payment_refunds` tables; provider adapters; signature/token verification; provider-side reconciliation lookup; idempotent webhook processors. |
| **6. Atomic Manila Reference Numbering** | Random hex codes (`OPM-SOL-YYYY-XXXXXX`, `OPM-APT-...`). | Atomic Asia/Manila daily sequential reference allocated **only on first verified payment**: `MMDDYYYYHHMMAM/PMNNN` (strictly unique, daily reset, never reused on refunds/reversals). | **P0** | `payment_reference_sequences` table + PostgreSQL transactional allocation function (`allocate_ophireum_payment_ref()`) using `Asia/Manila` clock and row lock. |
| **7. Credits, Offers & Promotions** | None. | Append-only double-entry `credit_ledger` + `credit_wallets` (server-controlled balance) and `promotions` / `promotion_redemptions` with expiry, usage limits, min-order checks, and stacking rules. | **P1** | Ledger schema + atomic debit/credit Postgres RPCs, promo validation API, customer dashboard views. |
| **8. Invoices, Official Receipts & Tax** | None. | Sequential invoice numbering, itemized PDF invoice/receipt generation (supporting PH VAT/Non-VAT disclosure, customer TIN/business name, Ophireum DTI Reg. 7567003 details), downloadable in portal. | **P1** | `invoices` table, PDF generator service, private Storage bucket + signed download URLs. |
| **9. Fulfillment, Requirements, Files & Revisions** | Static mockup in `EnterpriseModal.tsx`; `ContactSection` file picker drops files. | Order-linked `fulfillment_projects`, `project_milestones`, structured requirement intake, private Supabase Storage buckets for reference uploads & deliverables (signed URLs, MIME/size checks), revision request workflow with quota tracking. | **P1** | Fulfillment tables, private Storage buckets (`customer-uploads`, `order-deliverables`), signed-URL endpoints, revision state machine. |
| **10. Notifications (Email, In-App, SMS)** | Resend email outbox exists in code, **unconfigured in live prod** (`email.configured: false`); no in-app notifications; admin SMS number incomplete (`+63` only). | Durable outbox driving verified Resend email, in-app `customer_notifications` center, admin dashboard real-time/polled alerts, and optional E.164 SMS alert after full mobile number & SMS provider configured. | **P1** | Configure Resend DNS/keys in Railway, add `customer_notifications` table & API, add `FOR UPDATE SKIP LOCKED` outbox worker, gate SMS on verified E.164 number. |
| **11. Admin Operations Console** | Read-only 25-row viewer inside `EnterpriseModal.tsx` (`sessionStorage` token). | Dedicated RBAC Admin Portal with pagination/search/filters, order/payment inspection, manual reconciliation, refund trigger (dual-checked), fulfillment stage & deliverable upload, catalog/promo/credit management, inquiry/appointment mutations, outbox retry, and full `audit_logs`. | **P1** | Admin mutation APIs (`PATCH`/`POST`), role separation (`admin` vs `super_admin` vs `finance_ops`), secure session management, dedicated admin UI. |
| **12. Philippine Legal & Consumer Compliance** | Non-clickable `<span>` placeholders in `Footer.tsx`; `consent_records` unused; DTI cert unredacted. | Published Privacy Policy (**RA 10173**), Terms of Service (**RA 11967** Internet Transactions Act & **RA 7394** Consumer Act), Refund/Cancellation/Dispute Policy **preserving mandatory Philippine statutory consumer remedies** (never asserting an unlawful absolute non-refundable clause for non-delivery or defective digital/multimedia services), versioned consent logging, data export & closure rights. | **P1** | Legal routes/pages, mandatory checkout/signup consent checkboxes persisted to `consent_records`, refund/dispute workflow, owner legal review of DTI image. |

---

## 2. Specific Gap Findings

### Finding `AUD-COM-001`
- **Severity:** `P1`
- **Location:** `src/components/Footer.tsx:189–191`, `supabase/schema.sql:220–230`
- **Evidence (Code-Level Observation):** Legal notices are non-functional `<span>` text; zero consent records are stored anywhere in the app.
- **Business Impact:** Cannot pass Philippine payment gateway merchant compliance review (Xendit, PayPal, Maya, PayMongo all mandate live, publicly accessible Terms of Service, Privacy Policy, and Refund/Cancellation Policy URLs during KYC/KYB onboarding!) and exposes Ophireum to RA 10173 / RA 11967 / RA 7394 compliance risks.
- **Technical Impact:** Missing legal routes and versioned consent persistence.
- **Recommended Correction:** Implement dedicated legal views (`/legal/privacy`, `/legal/terms`, `/legal/refund-policy`) reviewed by legal counsel, explicitly preserving statutory Philippine consumer rights, and persist versioned user acceptance in `consent_records` on account creation and checkout.
- **Required Test:** Verify live HTTP `200` on legal URLs and automated test confirming `consent_records` row insertion with IP, user agent, document version, and timestamp.
- **Dependencies:** Legal copy approval by Ophireum management.
- **Current Status:** Open.

### Finding `AUD-COM-002`
- **Severity:** `P1`
- **Location:** `src/data/serviceCatalog.ts` (FX rate `DEFAULT_USD_TO_PHP_RATE = 58`, pricing models) vs Multi-Gateway Settlement (`PHP` / `USD`)
- **Evidence (Code-Level Observation):** All 78 services are priced in USD in TypeScript (`startingUsd`, `monthlyUsd`), with PHP shown only as a static `× 58` client-side estimate. Xendit and Maya settle primarily in **PHP**, while PayPal supports **USD/PHP**.
- **Business Impact:** Charging a customer in PHP using an outdated hardcoded FX rate causes margin erosion, reconciliation mismatches, or customer price-shock between storefront display and checkout charge.
- **Technical Impact:** No canonical multi-currency pricing or FX snapshot mechanism.
- **Recommended Correction:** Store explicit canonical PHP and/or USD prices per catalog SKU in PostgreSQL (`price_php_centavos`, `price_usd_cents`), or record an explicit server-side FX rate snapshot (`fx_rate_snapshot`, `fx_rate_source`, `fx_quoted_at`) locked on order creation before redirecting to any payment provider. Always compute monetary math in integer minor units (`BIGINT` centavos/cents) to eliminate floating-point drift.
- **Required Test:** Unit tests verifying exact integer minor-unit arithmetic across PHP/USD orders, add-ons, percentage/fixed discounts, credit deductions, and webhook amount comparison.
- **Dependencies:** Business pricing policy decision (fixed PHP price list vs FX-converted USD).
- **Current Status:** Open.
