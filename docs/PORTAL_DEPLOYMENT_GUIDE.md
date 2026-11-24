# Ophireum Multimedia Client Portal — Deployment, Migration & Rollback Guide

> **Operational Notice:** No production database migration or production deployment is executed automatically. Review and approve each checklist item before applying to staging or production.
>
> **Production Readiness Gate (Phase 2 Audit):** See `docs/audit/CLIENT_PORTAL_PRODUCTION_READINESS.md`. Before deploying the Client Portal to production, `src/server/portal/supabasePortalRepository.ts` must be upgraded from catalog-only reads to full Supabase PostgreSQL + Storage write persistence, and `002_client_portal_commerce.sql` must pass live staging RLS verification.

---

## 1. Architecture Summary

- **Public Website (`/`)**: Unchanged React 19 + Vite static frontend deployed via GitHub Pages (or served by Express).
- **Client Portal (`/portal/*` and `#/portal/*` fallback)**: Lazily loaded authenticated client experience backed by `/api/portal/*` Express endpoints.
- **Database & Storage**: Supabase PostgreSQL schema defined in `supabase/migrations/002_client_portal_commerce.sql` with Row Level Security (RLS) enabled across all 27 client portal tables plus private Storage bucket `portal-private-files`.
- **Payment Gateways**: Server-side adapter registry in `src/server/portal/payments/paymentAdapters.ts` covering Credit Card, Debit Card, PayPal, Xendit, Maya, PayMongo, and GoTyme. All providers default to `disabled` until credentials and webhook tests are verified.

---

## 2. Database Migration Procedure (Supabase)

1. Take a manual Supabase database snapshot/backup before applying any migration.
2. Open the Supabase SQL Editor (or Supabase CLI linked to staging first) and inspect:
   - `supabase/migrations/002_client_portal_commerce.sql`
3. Apply `002_client_portal_commerce.sql` in **staging** first.
4. Verify RLS and table integrity:
   - Confirm `rowsecurity = true` on all 27 tables (`pg_tables` in `public` schema).
   - Confirm private bucket `portal-private-files` exists with `public = false` and owner-folder RLS policy `portal_private_files_owner_select`.
   - Confirm `credit_transactions` rejects `UPDATE` and `DELETE` via trigger `trg_credit_transactions_immutable` and `invoices` enforces immutability via `trg_invoices_no_tamper`.
   - Confirm client JWTs can only read/write rows where `user_id = auth.uid()`, cannot access `payment_webhook_events`, and cannot directly mutate `orders`, `payments`, `invoices`, `credit_wallets`, or `credit_transactions`.

---

## 3. Environment Variables

Configure these variables in your Node.js host (Railway) and frontend build (GitHub Actions / Pages). **Never commit real keys to Git.**

### Core Backend Variables (Required in Production)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only service role key (never exposed to browser)
- `PORTAL_SIGNING_SECRET` — High-entropy 32+ byte secret for HMAC-signed expiring download links
- `ADMIN_SESSION_SECRET` — Existing admin session secret
- `ALLOWED_ORIGINS` — Comma-separated allowed frontend origins (e.g., `https://ophireumtechnology.github.io`)
- `APP_BASE_URL` — Public backend base URL
- `RESEND_API_KEY` and `EMAIL_FROM` — Transactional email delivery

### Frontend Build Variables
- `VITE_API_BASE_URL` — Deployed Express API base URL (e.g., `https://<railway-service>.up.railway.app`)
- `VITE_SUPABASE_URL` — Public Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Public Supabase anon key

### Payment Provider Readiness Variables (Optional — Leave Unset Until Verified)
- **Xendit**: `XENDIT_SECRET_KEY_TEST`, `XENDIT_WEBHOOK_TOKEN_TEST`
- **PayPal**: `PAYPAL_CLIENT_SECRET_SANDBOX`, `PAYPAL_WEBHOOK_SECRET_SANDBOX`
- **Hosted Card Gateway (Credit / Debit)**: `CARD_GATEWAY_SECRET_KEY_TEST`, `CARD_GATEWAY_WEBHOOK_SECRET_TEST`
- **Maya**: `MAYA_SECRET_KEY_TEST`, `MAYA_WEBHOOK_SECRET_TEST`
- **PayMongo (Deferred Onboarding)**: `PAYMONGO_SECRET_KEY_TEST`, `PAYMONGO_WEBHOOK_SECRET_TEST`
- **GoTyme (Deferred Onboarding)**: `GOTYME_API_SECRET_TEST`, `GOTYME_WEBHOOK_SECRET_TEST`

---

## 4. Deployment Steps

### Backend (Railway / Managed Node.js)
1. Set all Core Backend Variables above.
2. Confirm build/start scripts:
   - `npm run build`
   - `npm start` (`tsx server.ts`)
3. Verify health and portal endpoints after deploy:
   - `GET /api/health` → `200 OK`
   - `GET /api/portal/dashboard` (without bearer token) → `401 Unauthorized`
   - `POST /api/portal/webhooks/xendit` (invalid signature) → `401 Unauthorized`

### Static Frontend (GitHub Pages)
1. Confirm `VITE_API_BASE_URL` points to the deployed Railway backend.
2. Run `npm run build` and publish `dist/`.
3. Verify:
   - Public homepage `/` renders identically to pre-portal baseline.
   - Navigating to `#/portal/login` (or clicking **Open Client Portal** inside the Enterprise Workspace modal) loads the Client Portal cleanly.

---

## 5. Payment Activation Checklist (Before Setting Any Provider to `live`)

- [ ] Merchant account KYB/KYC approved by provider.
- [ ] Webhook endpoint registered (`POST https://<api-host>/api/portal/webhooks/<provider>`).
- [ ] Sandbox test completed: order created → webhook signed → order marked `paid` → credits allocated once → duplicate webhook replay returns `deduplicated: true` with `creditsAllocated: 0`.
- [ ] Amount/currency mismatch webhook tested and confirmed rejected (`422`).
- [ ] Refund and reconciliation flow verified in sandbox.

---

## 6. Rollback Plan

1. **Application Rollback**: Revert the Railway deployment and GitHub Pages artifact to the previous release commit. Because the public website code is untouched and portal routes are isolated under `/portal/*` and `/api/portal/*`, rolling back immediately restores the prior runtime with zero impact on existing inquiry/appointment/admin tables.
2. **Database Rollback (Staging Only)**: Drop the newly added 27 portal tables (which are strictly isolated from legacy `inquiries`, `appointments`, `audit_logs`, and `admin_*` tables) or restore the pre-migration Supabase snapshot.
3. **Emergency Payment Kill-Switch**: Remove the provider's `*_SECRET_KEY_TEST` / `*_WEBHOOK_SECRET_TEST` (or `XENDIT_WEBHOOK_TOKEN_TEST` / `PAYPAL_WEBHOOK_SECRET_SANDBOX`) environment variables in Railway and restart to immediately revert that adapter to `disabled` and reject automated webhooks without taking the portal offline.
