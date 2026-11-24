# 09 — Target System Architecture: Ophireum Multimedia Commerce Platform

**Guiding Principle:** Evolve and harden the existing production stack (**React 19 + TypeScript + Vite** on GitHub Pages, **Node.js + Express** on Railway, **Supabase PostgreSQL + Auth + Storage**) rather than replacing it. All financial, pricing, entitlement, credit, and payment state transitions are **100% server-authoritative** through Express + PostgreSQL transactions; the browser never writes orders, payments, credits, or entitlements directly to Supabase.

---

## 1. High-Level System Topology

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 STATIC FRONTEND (GitHub Pages / CDN)                     │
│                https://ophireummultimedia.com (React 19)                 │
│  ┌──────────────┐ ┌──────────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │  Storefront  │ │ Customer Portal  │ │   Checkout   │ │ Admin Ops   │ │
│  │  & Catalog   │ │  & Dashboard     │ │   & Cart     │ │  Console    │ │
│  └──────┬───────┘ └────────┬─────────┘ └──────┬───────┘ └──────┬──────┘ │
│         │  Supabase Auth   │                  │                │        │
│         │  (SignUp/Login/  │  HTTPS Bearer JWT / API calls     │        │
│         │   Reset ONLY)    │                  │                │        │
└─────────┼──────────────────┼──────────────────┼────────────────┼────────┘
          ▼                  ▼                  ▼                ▼
┌──────────────────┐  ┌───────────────────────────────────────────────────┐
│  Supabase Auth   │  │     EXPRESS API GATEWAY (Railway Node 22)         │
│  (Identity +     │◄─┤       https://api.ophireummultimedia.com          │
│   Email Verify + │  │                                                   │
│   Recovery/MFA)  │  │  • Strict CORS (exact allowlist, NO *.run.app)    │
└──────────────────┘  │  • Shared Rate Limiter (Redis / PG-backed)        │
                      │  • Auth Middleware: requireCustomer / requireAdmin│
                      │  • Modular Routers:                               │
                      │      /api/catalog/*      /api/customer/*          │
                      │      /api/cart/*         /api/checkout/*          │
                      │      /api/orders/*       /api/credits/*           │
                      │      /api/webhooks/*     /api/admin/*             │
                      │      /api/inquiries      /api/appointments/*      │
                      │      /api/consultant/*   /api/voice/*             │
                      └──────┬─────────────────┬──────────────────┬───────┘
                             │                 │                  │
            service_role     │                 │ Hosted Checkout  │ Outbox
            (atomic SQL)     ▼                 │ & Webhooks       ▼
┌────────────────────────────────────┐  ┌──────────────┐  ┌──────────────┐
│   Supabase PostgreSQL + Storage    │  │   Payment    │  │  Resend Mail │
│  • Strict RLS (deny client writes  │  │   Adapters   │  │  G-Calendar  │
│    on orders/payments/ledger)      │  │  - Xendit    │  │  Gemini AI   │
│  • Integer minor units (BIGINT)    │  │  - PayPal    │  │  SMS (later) │
│  • Atomic Manila ref allocator     │  │  - Maya      │  └──────────────┘
│  • Private buckets (signed URLs):  │  │  - GoTyme*   │
│      customer-uploads              │  │  - PayMongo* │
│      order-deliverables            │  └──────────────┘
│      invoices-pdf                  │   (*deferred / adapter slot)
└────────────────────────────────────┘
```

---

## 2. Authentication, Identity & Access Control Design

1. **Customer Authentication (Supabase Auth + Express Verification):**
   - Customers register, verify email, log in, reset passwords, and enroll in MFA via Supabase Auth (`@supabase/supabase-js` with PKCE flow).
   - Every customer API call sends `Authorization: Bearer <supabase_access_token>` to Express.
   - Express `requireCustomer` middleware verifies the JWT via `supabase.auth.getUser(token)`, verifies `email_confirmed_at IS NOT NULL` for checkout/payment routes, and resolves/bootstraps the customer's `client_profiles` row bound to `auth_user_id = user.id`.
   - Zero direct browser writes to commerce tables (`orders`, `payments`, `credit_ledger`, `invoices`, `deliverables`).
2. **Administrator Authentication & RBAC:**
   - Primary path: Supabase Auth JWT strictly bound by `admin_users.auth_user_id = auth.uid()` AND `email` AND `is_active = TRUE` AND `role IN ('admin', 'super_admin', 'finance_ops', 'fulfillment_ops')`.
   - Eliminate `sessionStorage` HMAC tokens; if fallback bootstrap login is retained for emergency recovery, enforce `ADMIN_SESSION_SECRET` (`>= 32` chars), issue server-tracked `jti` sessions stored in `admin_sessions` with explicit `POST /api/admin/auth/logout` revocation, and deliver via `HttpOnly; Secure; SameSite=None` (or strict short-lived rotation) with CSRF protection.
   - `public.is_ophireum_admin()` binds exclusively to `au.auth_user_id = auth.uid()` (`REVOKE ALL FROM PUBLIC`).

---

## 3. Target Database Schema Architecture (PostgreSQL / Supabase)

All monetary amounts MUST be stored as **`BIGINT` integer minor units** (`centavos` for PHP, `cents` for USD) — never floating-point `FLOAT` or browser-supplied decimals.

### Core Commerce & Portal Tables

1. **Identity & Compliance**
   - `client_profiles` (hardened): `auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id)`, `email`, `full_name`, `phone_e164`, `company_name`, `billing_address JSONB`, `tax_id_tin`, `account_status ('active','pending_closure','closed')`, `created_at`, `updated_at`. (RLS: owner `SELECT` only; mutations via Express API.)
   - `consent_records` (wired): `user_id`, `document_type ('privacy_policy','terms_of_service','refund_policy')`, `document_version`, `accepted_at`, `ip_hash`, `user_agent`.
2. **Versioned Service Catalog**
   - `catalog_services`: `id`, `slug UNIQUE`, `category_id`, `title`, `pricing_model`, `engagement_mode ('standardized','custom_proposal')`, `price_php_minor BIGINT`, `price_usd_minor BIGINT`, `monthly_php_minor BIGINT`, `monthly_usd_minor BIGINT`, `revision_quota INT`, `is_active`, `version INT`.
   - `catalog_service_options`: `id`, `service_id FK`, `option_code`, `label`, `delta_php_minor BIGINT`, `delta_usd_minor BIGINT`, `monthly_delta_php_minor BIGINT`, `monthly_delta_usd_minor BIGINT`, `is_active`.
3. **Cart & Promotions**
   - `carts` & `cart_items`: `cart_id`, `user_id` (nullable for guest token hash), `currency ('PHP','USD')`, `service_id`, `selected_option_ids TEXT[]`, `quantity INT CHECK (quantity > 0)`.
   - `promotions` & `promotion_redemptions`: `code UNIQUE`, `discount_type ('percent','fixed_minor')`, `discount_value BIGINT`, `currency`, `min_order_minor BIGINT`, `max_redemptions`, `per_customer_limit`, `starts_at`, `expires_at`, `is_active`.
4. **Orders & Snapshots (Immutable Pricing)**
   - `orders`: `id UUID`, `order_number TEXT UNIQUE`, `user_id UUID NOT NULL REFERENCES auth.users(id)`, `currency ('PHP','USD')`, `fx_rate_snapshot NUMERIC(12,6)`, `subtotal_minor BIGINT`, `discount_minor BIGINT`, `credit_applied_minor BIGINT`, `tax_minor BIGINT`, `total_minor BIGINT CHECK (total_minor >= 0)`, `status ('draft','pending_payment','paid','in_production','completed','cancelled','refunded','partially_refunded','disputed')`, `ophireum_payment_ref TEXT UNIQUE` (allocated **only** at first verified payment), `idempotency_key TEXT UNIQUE`, `created_at`, `updated_at`.
   - `order_items`: `id`, `order_id FK`, `catalog_service_id`, `sku_version`, `title_snapshot`, `options_snapshot JSONB`, `quantity`, `unit_price_minor BIGINT`, `line_total_minor BIGINT`.
   - `order_status_history`: append-only status transitions (`order_id`, `from_status`, `to_status`, `actor_type`, `actor_id`, `reason`, `created_at`).
5. **Multi-Gateway Payments & Reference Allocator**
   - `payment_intents`: `id`, `order_id FK`, `provider ('xendit','paypal','maya','gotyme','paymongo')`, `environment ('sandbox','live')`, `provider_checkout_id`, `provider_payment_id UNIQUE`, `checkout_url`, `amount_minor BIGINT`, `currency`, `status ('created','pending','succeeded','failed','expired','cancelled')`, `idempotency_key TEXT UNIQUE`, `expires_at`, `created_at`, `updated_at`.
   - `payment_webhook_events`: `id`, `provider`, `provider_event_id TEXT NOT NULL`, `signature_verified BOOLEAN`, `payload_sanitized JSONB`, `processing_status ('received','processed','ignored_duplicate','failed')`, `error_message`, `received_at`, `processed_at`, `UNIQUE (provider, provider_event_id)`.
   - `payment_refunds`: `id`, `order_id`, `payment_intent_id`, `provider`, `provider_refund_id UNIQUE`, `amount_minor BIGINT`, `currency`, `reason`, `status`, `requested_by_admin_id`, `created_at`.
   - `payment_reference_sequences`: `manila_date DATE PRIMARY KEY`, `last_seq INT NOT NULL DEFAULT 0`.
     - PostgreSQL `SECURITY DEFINER` function `public.allocate_ophireum_payment_ref()` locks the `manila_date = (NOW() AT TIME ZONE 'Asia/Manila')::date` row (`INSERT ... ON CONFLICT DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq`), formats `MMDDYYYYHHMMAM/PM` + zero-padded 3-digit daily sequence (`001`–`999`, expanding cleanly if >999), and guarantees atomic uniqueness with zero reuse.
6. **Credits Ledger (Double-Entry Append-Only)**
   - `credit_wallets`: `user_id PRIMARY KEY REFERENCES auth.users(id)`, `currency`, `balance_minor BIGINT NOT NULL DEFAULT 0 CHECK (balance_minor >= 0)`, `updated_at`.
   - `credit_ledger`: `id`, `user_id`, `order_id`, `entry_type ('grant','redemption','refund_restore','expiration','admin_adjustment')`, `amount_minor BIGINT` (signed), `balance_after_minor BIGINT`, `idempotency_key UNIQUE`, `reason`, `actor_id`, `created_at`. (Protected by immutability trigger — no `UPDATE`/`DELETE`.)
7. **Invoices, Fulfillment, Deliverables, Support & Notifications**
   - `invoices`: `id`, `invoice_number UNIQUE`, `order_id UNIQUE`, `user_id`, `billing_snapshot JSONB`, `tax_breakdown JSONB`, `storage_path`, `issued_at`.
   - `fulfillment_projects`, `project_milestones`, `project_deliverables`, `revision_requests`: order-linked production tracker, requirement intake forms, private file storage metadata, revision quota enforcement.
   - `support_tickets` & `support_messages`: customer-owned threaded support tickets linked optionally to `order_id`.
   - `customer_notifications`: in-app notification feed (`user_id`, `title`, `body`, `category`, `link_path`, `read_at`, `created_at`).
8. **Private Supabase Storage Buckets**
   - `customer-uploads` (private; max 25 MB; allowlisted PDF/PNG/JPG/WebP/DOCX/ZIP; Express-issued signed upload/download URLs only).
   - `order-deliverables` (private; admin upload; owner signed download URL only after `order.status IN ('paid','in_production','completed')`).
   - `invoices-pdf` (private; server-generated; owner/admin signed download URL).

---

## 4. Multi-Gateway Payment Orchestration Architecture

All gateways sit behind a unified `PaymentProviderAdapter` interface (`src/server/payments/types.ts`):

```ts
interface PaymentProviderAdapter {
  readonly provider: 'xendit' | 'paypal' | 'maya' | 'gotyme' | 'paymongo';
  isConfigured(env: 'sandbox' | 'live'): boolean;
  createHostedCheckout(input: CreateCheckoutInput): Promise<HostedCheckoutResult>;
  verifyWebhookSignature(req: RawBodyRequest): Promise<VerifiedWebhookEvent>;
  fetchProviderTransaction(providerPaymentId: string): Promise<ProviderTransactionStatus>;
  createRefund(input: CreateRefundInput): Promise<ProviderRefundResult>;
}
```

### Mandatory Financial Invariants
1. **Zero Raw Card Handling (PCI-DSS SAQ A):** Use provider-hosted checkout pages exclusively.
2. **Webhook-Authoritative Confirmation:** Browser return URLs (`/checkout/return`) only poll order status; **only** a cryptographically verified webhook + amount/currency/merchant-account match marks an order `paid`.
3. **Provider-Specific Verification:**
   - **Xendit (Phase 1 — PH Primary):** Verify `x-callback-token` using `crypto.timingSafeEqual` against `XENDIT_WEBHOOK_TOKEN_TEST` (or `_LIVE`), verify invoice/payment status via Xendit REST API, and display only merchant-enabled channels.
   - **PayPal (Phase 1 — International):** Server-side `POST /v2/checkout/orders`, capture only after buyer approval, verify webhook via PayPal's `/v1/notifications/verify-webhook-signature` API with `PAYPAL_WEBHOOK_ID_*`.
   - **Maya Checkout (Phase 2 — PH Direct):** Hosted Checkout API + webhook signature verification + server-side payment retrieval.
   - **Direct GoTyme & PayMongo (Deferred):** Adapter slot kept disabled behind feature flag until direct merchant approval, credentials, and official technical specs are onboarded.
4. **Atomic Exactly-Once Fulfillment Transaction:** Within one PostgreSQL transaction:
   - Insert `payment_webhook_events(provider, provider_event_id)` (`ON CONFLICT DO NOTHING` -> if duplicate, return `200` idempotently).
   - Lock `orders` row (`SELECT ... FOR UPDATE`), confirm `amount_minor` & `currency` match provider payload exactly.
   - Transition `order.status -> 'paid'`, call `allocate_ophireum_payment_ref()`, create `fulfillment_project` + `invoice` + `credit_ledger` entries (if applicable), and enqueue durable outbox notifications (customer receipt email, admin alert email, in-app notification, and admin SMS only when valid E.164 mobile + SMS provider are configured).

---

## 5. Philippine Regulatory & Consumer Compliance Architecture

- **Data Privacy Act (RA 10173):** Explicit versioned Privacy Policy, minimal PII collection, `consent_records` audit trail, encrypted storage, customer data export endpoint (`GET /api/customer/data-export`), and compliant account closure workflow that anonymizes profile PII while retaining statutory tax/accounting transaction records.
- **Internet Transactions Act (RA 11967) & Consumer Act (RA 7394):** Clear pre-checkout disclosure of DTI Registration No. `7567003`, total itemized PHP/USD price including taxes/fees, delivery/milestone timelines, revision limits, and an explicit **Refund, Cancellation & Dispute Policy** that **preserves all mandatory Philippine statutory consumer remedies** for non-delivery, material breach, or defective services (never overriding statutory rights with an unlawful blanket "strictly non-refundable" clause).
- **BIR / Invoicing Readiness:** Capture optional customer Business Name, Billing Address, and TIN during checkout so invoices/official receipts comply with Philippine accounting workflows.
