# 06 — GitHub Branches and Pull Request Review

**Repository:** `https://github.com/OphireumTechnology/OMPNETWORK`  
**Audit Method:** Direct read-only GitHub REST API inspection (`2026-11-24T05:39Z`).  
**Repository State (Verified Fact):** Public repository, `default_branch: "main"`, `has_pages: true`, **11 branches**, **10 PRs total** (8 open drafts, 2 merged).

---

## 1. Branch Governance Audit (`AUD-OPS-002` — P1)

- **Verified Fact:** **ALL 11 branches—including `main`—have `protected: false`.**
  - Anyone with push access can force-push, commit directly to `main` (which auto-triggers GitHub Pages production deployment via `deploy-pages.yml` and Railway production deployment!), or bypass CI checks and code review.
- **Verified Fact (Stale/Merged Branches Not Pruned):** `fix/ophireum-contact-email` (merged in PR #8) and `chore/ophireum-copyright-attribution-20261124` (merged into PR #5 via PR #6) remain unpruned.
- **Recommended Correction:** Immediately enable GitHub Branch Protection on `main`: require PR before merging, require at least 1 approval, require `CI Security & Stabilization Checks` status check to pass, require up-to-date branch before merge, block force-pushes and deletions.

---

## 2. Comprehensive Pull Request Review (`#1` through `#10`)

| PR | Branch | State / Draft | Mergeable? | CI Latest | Category | Recommended Action |
|---|---|---|---|---|---|---|
| **#1** | `fix/production-integrity-20261111` | Open / Draft | **NO (`dirty`)** | N/A (stale base) | Legacy hotfix (Nov 11) | **CLOSE (Superseded)** |
| **#2** | `fix/omp-booking-security-20261111` | Open / Draft | **NO (`dirty`)** | N/A (stale base) | Legacy booking/RLS hotfix (Nov 11) | **CLOSE (Superseded; RLS SQL already carried into PR #5)** |
| **#3** | `repair/admin-session-principal-binding-20261116` | Open / Draft | Yes (`clean`) | N/A | Narrow 1-line admin auth fix | **CLOSE after PR #5 merges (Superseded by stronger PR #5)** |
| **#4** | `review/ophireum-ip-inventory-20261123` | Open / Draft | Yes (`clean`) | N/A | IP & provenance docs (5 files) | **HOLD / DEFER** (separate legal review; update counts after commerce) |
| **#5** | `repair/security-and-runtime-hardening-20261123` | Open / Draft | **NO (`dirty`)** | Passed on PR | **Consolidated security hardening + copyright headers** | **REBASE, ADD MISSING P0/P1 FIXES, THEN MERGE FIRST** |
| **#6** | `chore/ophireum-copyright-attribution-20261124` | Closed / **MERGED** into PR #5 | N/A | N/A | Stacked copyright headers (53 files) | Already merged into PR #5; delete stale branch after PR #5 merges |
| **#7** | `feature/ophireum-payment-intelligence` | Open / Draft | Yes (`clean`) | Passed | Payment spec doc (PayMongo+PayPal) | **SUPERSEDED BY PR #9 / THIS AUDIT** — consolidate or close |
| **#8** | `fix/ophireum-contact-email` | Closed / **MERGED** into `main` | N/A | Passed | Email fix (`contact@ophireummultimedia.com`) | Already merged into `main`; delete stale branch |
| **#9** | `feature/multi-gateway-onboarding` | Open / Draft | Yes (`clean`) | Passed | Multi-gateway rollout plan doc | **KEEP AS REFERENCE / CONSOLIDATE** into `docs/audit/09` & `10` |
| **#10** | `feature/customer-commerce-foundation` | Open / Draft | Yes (`clean`) | Passed | Customer portal + `002` migration prototype | **DO NOT MERGE (P0 security/architecture flaws); REPLACE in Phase 2–3** |

---

## 3. Individual Deep-Dive Reviews

### PR #1 — `fix/production-integrity-20261111` ("Prevent false inquiry-delivery and AI-generation claims")
- **Base:** `3b3e2416` (Nov 11 — 11 commits behind `main`; `mergeable: false / dirty`).
- **Files (4):** `ContactSection.tsx`, `EnterpriseModal.tsx`, `supabase/functions/submit-inquiry/index.ts`, `supabase/schema/omp_inquiries.sql`.
- **Audit Assessment:** Completely obsolete. `main` has since replaced browser-only inquiries with Express `POST /api/inquiries` + `solution_requests` table + Resend outbox. Adding a separate Deno Edge Function (`submit-inquiry`) and duplicate `omp_inquiries` table would create a conflicting parallel architecture.
- **Decision:** **Close without merging.**

### PR #2 — `fix/omp-booking-security-20261111` ("P0: stop false appointment confirmations and revoke unsafe public reads")
- **Base:** `0ae366ba` (Nov 11 — 8 commits behind `main`; `mergeable: false / dirty`).
- **Files (7):** `.github/workflows/validate-pr.yml`, `ContactSection.tsx`, `AppointmentBookingModal.tsx`, `aiVoiceService.ts`, `supabaseService.ts`, `supabase/migrations/20261111_revoke_public_client_reads.sql`, `supabase/schema.sql`.
- **Audit Assessment:** Merging wholesale would **break current `main`**, reverting backend API booking/inquiry integration and disabling online booking. Its single valuable artifact (`20261111_revoke_public_client_reads.sql`) has already been cherry-picked into PR #5.
- **Decision:** **Close without merging** (verify `20261111_revoke_public_client_reads.sql` via PR #5).

### PR #3 — `repair/admin-session-principal-binding-20261116` ("Security: bind admin sessions to current active principal")
- **Base:** `e9df3b94`, `mergeable: true`, 1 file (`src/server/auth.ts`, `+1/-1`).
- **Audit Assessment:** Valid targeted fix, but completely subsumed by PR #5, which adds full `sub` + normalized `email` + `role` + `isActive` binding, `ADMIN_SESSION_SECRET` length enforcement, PostgREST query hardening, and 248 lines of dedicated security regression tests (`tests/security-hardening.test.ts`).
- **Decision:** **Close once PR #5 is merged.**

### PR #4 — `review/ophireum-ip-inventory-20261123` ("docs(ip): OPHIREUM-IP source inventory and provenance review")
- **Base:** `e9df3b94`, `mergeable: true`, 5 files under `IP-PROTECTION/`.
- **Audit Assessment:** Non-code documentation/IP register. Does not affect runtime or commerce architecture, though its CSV asset register reflects a pre-commerce file list and notes that ownership/provenance remain unverified.
- **Decision:** **Hold separately for legal/IP review**; do not block security hardening on it.

### PR #5 — `repair/security-and-runtime-hardening-20261123` ("Consolidated security hardening and production-readiness gates")
- **Base:** `e9df3b94`, **32 commits, 59 files changed (`+1160/-207`), `mergeable: false / dirty`** (conflicts with `main`'s subsequent PR #8 `companyConfig.ts` and commit `e1f158b2` `.env.example` cleanup).
- **Verified Improvements Included in PR #5:**
  - Fixes `AUD-SEC-001`: strict `sub`/`email`/`role`/`isActive` principal binding in `auth.ts`; removes `.or()` PostgREST filter interpolation in `supabaseRepository.ts`; blocks env-allowlist fallback when `authUserId` is present; adds `20261124_uuid_bound_admin_rls.sql` (UUID-only `is_ophireum_admin()` + `REVOKE ALL FROM PUBLIC`).
  - Fixes `X-Forwarded-For` spoofing (`req.ip`) and bounds in-memory rate-limiter key growth (`maxKeys = 10_000`).
  - Requires stable `ADMIN_SESSION_SECRET` (`>= 32` chars) before permitting bootstrap admin login.
  - Adds `tests/security-hardening.test.ts` (+248 lines), `COPYRIGHT.md`, `LICENSE`, `scripts/check-copyright-headers.mjs`, and `SECURITY_GAP_REGISTER.md`.
- **Critical Gaps STILL Missing Even in PR #5 (Code-Level Observation):**
  1. **Does NOT fix `*.run.app` CORS bypass (`AUD-SEC-002`)** — `src/server/app.ts:207–209` untouched!
  2. **Does NOT fix `PATCH /api/appointments/:referenceCode` (`AUD-API-001`)** or `POST /api/appointments` calendar-before-DB ordering (`AUD-API-002`).
  3. **Does NOT fix `/api/health` returning `200` on DB failure (`AUD-API-003`).**
  4. **Does NOT add `000_baseline.sql` migration (`AUD-DB-001`)** and introduces mixed migration naming (`001_*` + `20261111_*` + `20261124_*`).
  5. **Note:** Merging PR #6 (copyright headers on all 53 files) into PR #5 creates high merge-conflict churn with any parallel PRs; it should be rebased cleanly onto `main` first so all future commerce branches start from the hardened + header-compliant baseline.
- **Decision:** **Mandatory first merge after rebasing onto `main`, resolving conflicts, and adding the missing P0/P1 fixes (`AUD-SEC-002`, `AUD-API-001`, `AUD-API-002`, `AUD-API-003`).**

### PR #7 — `feature/ophireum-payment-intelligence` ("docs: plan Ophireum payment intelligence integration")
- **Base:** `e9df3b94`, `mergeable: true`, 1 file (`docs/ophireum-payment-intelligence-implementation.md`, +144 lines).
- **Audit Assessment:** Planning document focused on PayMongo + PayPal. Partially outdated because PR #9 subsequently pivoted the primary PH gateway strategy to **Xendit-first** (with PayMongo deferred due to merchant onboarding pauses), and its claim that "Railway has no configured env vars or public domain / Supabase has zero tables" conflicts with live production `api.ophireummultimedia.com/api/health` (likely inspected a different Railway/Supabase project—`TaxGuard`).
- **Decision:** **Supersede/consolidate into PR #9 and `docs/audit/09-target-system-architecture.md`; close PR #7 to avoid conflicting payment specs.**

### PR #9 — `feature/multi-gateway-onboarding` ("Plan multi-gateway payments for Ophireum Multimedia")
- **Base:** `7e6b3f16`, `mergeable: true`, 1 file (`docs/multi-gateway-payment-rollout.md`, +110 lines).
- **Audit Assessment:** Strong, disciplined rollout plan establishing Xendit-first (PH), PayPal Sandbox (international), Maya Checkout (Phase 2), direct GoTyme (deferred pending partnership), and PayMongo (adapter slot ready). Properly specifies sandbox-first gates, server-authoritative pricing, webhook verification, atomic Asia/Manila daily sequential reference numbers (`MMDDYYYYHHMMAM/PMNNN`), and Railway-only secret handling.
- **Minor Gap:** Does not address Philippine legal/consumer compliance (RA 10173, RA 7394, RA 11967) or cart/order/credit/fulfillment integration; carries over the same unverified Supabase blank-DB assumption that must be verified against the real `api.ophireummultimedia.com` database.
- **Decision:** **Keep aligned as the payment rollout baseline; incorporate into finalized target architecture (`09-target-system-architecture.md`).**

### PR #10 — `feature/customer-commerce-foundation` ("Build Ophireum customer accounts and checkout foundation") — Finding `AUD-PR-010` (`P0`)
- **Base:** `7e6b3f16`, 5 commits, 4 files (`CustomerCommercePortal.tsx`, `002_customer_commerce_foundation.sql`, `Header.tsx`, `App.tsx`), `mergeable: true`.
- **Evidence (Code-Level Observation — Direct Inspection of Raw Branch Files):**
  1. **P0 Price-Tampering Architecture:** `CustomerCommercePortal.tsx` renders an editable `<input type="number" value={amount}>` and free-text `item_name`, then calls `supabase.from('customer_orders').insert({ user_id, item_name, amount: parsedAmount, currency, preferred_method, status: 'draft' })` directly from the browser! This directly contradicts PR #9's central rule ("Never accept price, currency, product entitlement, or payment status as authoritative from the browser").
  2. **P0 Unsafe RLS on `client_profiles`:** `002_customer_commerce_foundation.sql` grants `FOR ALL` to `auth.uid() = auth_user_id`, allowing customers to `DELETE` their own profile and overwrite `email` with arbitrary strings.
  3. **Bypasses Express API:** Direct browser-to-Supabase writes bypass validation, rate limiting, idempotency, catalog pricing, and `audit_logs`.
  4. **Incomplete Scope:** No password recovery/reset, no verification resend, no catalog integration, no cart, no credits/offers/invoices/deliverables/support, and **zero tests** (CI only passed because existing tests don't cover PR #10!).
  5. **Broken Migration Chain:** Assumes baseline + `001` are applied on Supabase and adds `002` without checking `client_profiles` FK to `auth.users(id)` or reconciling PR #5's migrations.
- **Business & Technical Impact:** Merging PR #10 introduces an unmaintainable, insecure parallel write path directly into Supabase that would have to be ripped out before connecting real payments.
- **Recommended Action:** **DO NOT MERGE PR #10.** Salvage only UX inspiration (navigation entry point concept in `Header.tsx`) and rebuild the Customer Portal cleanly on top of Express API endpoints + hardened DB schema in Phases 2–3.
