# 03 — Database and Migration Audit (Supabase PostgreSQL)

**Audited Artifacts:**
- `supabase/schema.sql` (310 lines, `main`)
- `supabase/migrations/001_phase1_security_and_persistence.sql` (142 lines, `main`)
- `src/server/db/supabaseRepository.ts` (620 lines, `main`)
- Unmerged PR migrations reviewed for drift/risk:
  - PR #5: `supabase/migrations/20261111_revoke_public_client_reads.sql`, `supabase/migrations/20261124_uuid_bound_admin_rls.sql`
  - PR #10: `supabase/migrations/002_customer_commerce_foundation.sql`

---

## 1. Live Database Verification Status

- **Verified Fact (via `GET https://api.ophireummultimedia.com/api/health` and `/api/appointments/availability`):**
  - The production Railway API is connected to a live Supabase PostgreSQL instance (`dependencies.database: { configured: true, connected: true, latencyMs: 1641, status: "up" }`).
  - `GET /api/appointments/availability?date=2026-12-01` returned HTTP `200` with `bookedSlots: []`, proving the `consultation_appointments` table exists and is readable by the Railway service role.
- **Unverified External Configuration:**
  - Direct SQL introspection (`pg_tables`, `pg_policies`, `pg_indexes`, `pg_triggers`, `supabase_migrations.schema_migrations`, `storage.buckets`, `storage.objects` policies) could **not** be executed because no `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or Postgres connection credentials are present in this audit environment (`UNSET`).
  - **Conflict in Prior Repo Docs:** PR #7 (`docs/ophireum-payment-intelligence-implementation.md`) and PR #5 (`SECURITY_GAP_REGISTER.md`) noted that a previously connected Supabase account only showed a `TaxGuard` project or zero public tables, whereas live `api.ophireummultimedia.com` reports `database.connected: true` and successfully queries `consultation_appointments`. **Reconciling exact Supabase project ref ID and live schema state is a mandatory P0 prerequisite before running any migration.**

---

## 2. Schema Inventory (`supabase/schema.sql` on `main`)

| Table | Used by Express Repo (`supabaseRepository.ts`)? | Primary Key | Foreign Keys | Notable Indexes | RLS Enabled? | Current RLS Policies (`schema.sql`) |
|---|---|---|---|---|---|---|
| `public.admin_users` | **Yes** (SELECT) | `id UUID` | None (`auth_user_id` has NO FK to `auth.users`) | `email UNIQUE`, `auth_user_id UNIQUE`, `idx_admin_users_email` | Yes | Admin SELECT only (good: blocks PostgREST writes) |
| `public.client_profiles` | **NO (Dead in repo)** | `id UUID` | None (`auth_user_id` has NO FK and NO UNIQUE!) | None | Yes | Owner or admin SELECT only (NO INSERT/UPDATE policy for customers) |
| `public.ai_conversation_sessions` | **NO (Dead in repo)** | `id UUID` | `client_profile_id -> client_profiles(id)` | `session_token UNIQUE` | Yes | Admin SELECT only |
| `public.project_requirements` | **NO (Dead in repo)** | `id UUID` | `session_id -> ai_conversation_sessions(id)`, `client_profile_id -> client_profiles(id)` | None | Yes | Admin SELECT only |
| `public.project_briefs` | **NO (Dead in repo)** | `id UUID` | `session_id`, `client_profile_id` | `reference_code UNIQUE` | Yes | Admin SELECT only |
| `public.solution_requests` | **Yes** (CRUD + idempotency) | `id UUID` | None (NO `client_profile_id` / `user_id` link!) | `reference_code UNIQUE`, `idempotency_key UNIQUE`, `idx_sol_req_created_at`, `idx_sol_req_status`, `idx_sol_req_email` | Yes | Admin ALL only |
| `public.consultation_appointments` | **Yes** (CRUD + slot lock + token cancel/reschedule) | `id UUID` | `session_id`, `client_profile_id` (both always NULL in code!) | `reference_code UNIQUE`, `idempotency_key UNIQUE`, `uq_active_consultation_slot` (partial unique), `idx_appt_date_slot` | Yes | Admin ALL only |
| `public.notification_records` | **Yes** (outbox + retry) | `id UUID` | None | `dedupe_key UNIQUE`, `idx_notif_retry_queue` (partial) | Yes | Admin ALL only |
| `public.consent_records` | **NO (Dead in repo)** | `id UUID` | `client_profile_id` | None | Yes | Admin SELECT only |
| `public.audit_logs` | **Yes** (append + list) | `id UUID` | None | `idx_audit_logs_created_at` | Yes | Admin SELECT only |

### Functions, Triggers, Views, Enums, and Storage
- **Functions:** `public.is_ophireum_admin()` (`SECURITY DEFINER`, `SET search_path = public`).
- **Triggers:** **NONE** (zero `updated_at` triggers, zero `auth.users` profile-sync triggers, zero `audit_logs` immutability triggers).
- **Views:** **NONE**.
- **PostgreSQL Enumerated Types:** **NONE** (all status fields use `TEXT CHECK (...)`).
- **Storage Buckets & Storage Policies:** **NONE** defined anywhere in SQL or configuration.

---

## 3. Critical Database & Migration Findings

### Finding `AUD-DB-001`
- **Severity:** `P0`
- **Location:** `supabase/migrations/001_phase1_security_and_persistence.sql` vs `supabase/schema.sql`
- **Evidence (Code-Level Observation):**
  1. There is **no `000_baseline.sql` migration**. Migration `001` immediately runs `DROP POLICY IF EXISTS ... ON public.client_profiles` (line 13) and `ALTER TABLE public.consultation_appointments ...` (line 84). On a clean Supabase database, PostgreSQL throws `ERROR: relation "public.client_profiles" does not exist`.
  2. **Schema Drift:** `001` adds `client_name`, `client_email`, `client_phone`, `calendar_sync_status` to `consultation_appointments` as nullable without `NOT NULL` or `CHECK` constraints, whereas `schema.sql:165–176` defines them `NOT NULL` with `CHECK` constraints. `001` also omits `idx_appt_date_slot` (`schema.sql:276`).
  3. **Inconsistent Migration Naming:** PR #5 adds date-prefixed files (`20261111_*`, `20261124_*`), while `main` and PR #10 use numeric prefixes (`001_*`, `002_*`). In Supabase CLI alphabetical sorting, `001` runs before `002`, which runs before `20261111` — breaking dependency order if mixed carelessly.
- **Business Impact:** Reproducible staging/DR environments cannot be provisioned from migrations; production schema state may differ silently from `schema.sql`.
- **Technical Impact:** Migration failure during CI/CD or commerce schema rollout.
- **Recommended Correction:** Standardize strictly on timestamped Supabase migrations (`YYYYMMDDHHMMSS_description.sql`), add an idempotent baseline migration reconciling `schema.sql`, and snapshot/diff the live production schema before applying any new migrations.
- **Required Test:** Clean-room migration test against ephemeral PostgreSQL 15+ (`psql` / Supabase CLI `db reset`) verifying fresh apply + idempotency + parity with expected tables/indexes/constraints.
- **Dependencies:** Live Supabase project access verification.
- **Current Status:** Open.

### Finding `AUD-DB-002`
- **Severity:** `P0`
- **Location:** `supabase/schema.sql:24–40` (`public.is_ophireum_admin()`)
- **Evidence (Code-Level Observation):** `is_ophireum_admin()` grants admin RLS privileges if `au.auth_user_id = auth.uid()` **OR** `LOWER(au.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))`. It does not verify `email_verified` and allows email-only matching. Furthermore, `REVOKE ALL ON FUNCTION public.is_ophireum_admin() FROM PUBLIC` is missing on `main`. (PR #5's `20261124_uuid_bound_admin_rls.sql` fixes this, but is unmerged and unapplied.)
- **Business Impact:** Potential admin privilege escalation if an unverified or recycled email matches an `admin_users` row once public customer Supabase Auth signup is enabled!
- **Technical Impact:** Any authenticated customer account claiming an unverified admin email could satisfy `is_ophireum_admin()` under PostgREST RLS.
- **Recommended Correction:** Replace `is_ophireum_admin()` to bind strictly to `au.auth_user_id = auth.uid()` (`NOT NULL`), revoke `PUBLIC` execute, and grant execute only to `authenticated` and `service_role`. Enforce `auth_user_id NOT NULL` on active admin rows.
- **Required Test:** Automated RLS test using real Postgres roles (`anon`, `authenticated` non-admin with matching email, `authenticated` verified admin UUID) confirming denial for email-only match.
- **Dependencies:** Live admin UUID backfill before removing email fallback.
- **Current Status:** Open on `main` (remediated in unmerged PR #5).

### Finding `AUD-DB-003`
- **Severity:** `P0`
- **Location:** Draft PR #10 `supabase/migrations/002_customer_commerce_foundation.sql`
- **Evidence (Code-Level Observation):**
  1. `CREATE POLICY "Customer manages own profile" ON public.client_profiles FOR ALL` grants customers `DELETE` permission on their own profile row and unrestricted `UPDATE` (including modifying `email` away from `auth.users.email`).
  2. `CREATE POLICY "Customer creates own draft orders" ON public.customer_orders FOR INSERT` allows customers to insert arbitrary `item_name`, arbitrary `amount` (`> 0`), and `currency` directly via browser PostgREST without catalog validation or server calculation.
  3. `customer_orders` lacks `order_items`, `catalog_service_id`, `subtotal`, `discount_amount`, `tax_amount`, `idempotency_key`, and foreign key integrity to any catalog or payment table.
- **Business Impact:** Direct price-tampering vector if any payment integration ever charges `customer_orders.amount`; broken auditability if customers delete profiles referenced by orders/invoices.
- **Technical Impact:** Violates server-authoritative commerce design.
- **Recommended Correction:** Reject direct customer `INSERT` on `customer_orders`; route all order/checkout creation exclusively through authenticated Express API endpoints using `service_role` and server-side catalog pricing. Restrict `client_profiles` RLS to `SELECT`, `INSERT`, `UPDATE` (never `DELETE`) with column-level protection or server-mediated profile updates.
- **Required Test:** RLS policy test verifying `authenticated` users receive permission denied on `INSERT`/`UPDATE`/`DELETE` to `orders`, `payments`, `credit_ledger`, and `DELETE` on `client_profiles`.
- **Dependencies:** Commerce schema design (Phase 2).
- **Current Status:** Open (in draft PR #10; do not merge).

### Finding `AUD-DB-004`
- **Severity:** `P1`
- **Location:** `supabase/schema.sql:46–56, 232–245` (`client_profiles`, `audit_logs`, `solution_requests`, `consultation_appointments`)
- **Evidence (Code-Level Observation):**
  - `client_profiles.auth_user_id` has no `FOREIGN KEY REFERENCES auth.users(id)` and no `UNIQUE` constraint on `main`.
  - `audit_logs` has no `BEFORE UPDATE OR DELETE` immutability trigger.
  - No table has an `updated_at` trigger (`set_updated_at()`), risking stale timestamps on direct SQL/partial updates.
  - `solution_requests` and `consultation_appointments` are unlinked from authenticated customer `auth.users(id)` accounts.
  - `supabase/schema.sql` lacks any commerce tables (`service_catalog_items`, `carts`, `orders`, `order_items`, `payments`, `payment_webhook_events`, `payment_reference_sequences`, `credit_wallets`, `credit_ledger`, `promotions`, `invoices`, `fulfillment_projects`, `deliverables`, `support_tickets`, `customer_notifications`).
- **Business Impact:** Cannot link historical inquiries/bookings to customer accounts, cannot guarantee tamper-evident financial audit trails, and cannot support commerce operations.
- **Technical Impact:** Data integrity gaps and missing relational foundations.
- **Recommended Correction:** Add `auth.users(id)` FKs, `UNIQUE` index on `client_profiles(auth_user_id)`, generic `updated_at` trigger, `audit_logs` append-only immutability trigger, and full normalized commerce schema (detailed in `09-target-system-architecture.md`).
- **Required Test:** Constraint/trigger verification tests (confirm `UPDATE`/`DELETE` on `audit_logs` raises exception; confirm `updated_at` advances on row update).
- **Dependencies:** Baseline migration reconciliation (`AUD-DB-001`).
- **Current Status:** Open.

### Finding `AUD-DB-005`
- **Severity:** `P1`
- **Location:** Production Supabase Connection (`GET https://api.ophireummultimedia.com/api/health`)
- **Evidence (Verified Fact):** Live healthcheck measured `dependencies.database.latencyMs: 1641` (1.64 seconds for a simple `SELECT id ... LIMIT 1` ping!).
- **Business Impact:** Multi-query commerce flows (checkout, webhook processing, dashboard load) will feel sluggish (`3–6+ seconds`) and risk gateway webhook timeouts.
- **Technical Impact:** Suggests either geographic region mismatch between Railway (`hkg1` Hong Kong edge) and Supabase project region (e.g., US/EU) or cold-start / non-pooled HTTP PostgREST overhead.
- **Recommended Correction:** Audit Supabase region vs Railway service region (co-locate in Singapore `ap-southeast-1` / Hong Kong), measure p50/p95 query latency over multiple probes, and optimize healthcheck/connection pooling.
- **Required Test:** Latency benchmark (`< 150ms` p95 DB ping from Railway runtime).
- **Dependencies:** Railway and Supabase project region verification.
- **Current Status:** Open.
