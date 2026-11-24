# 07 — Railway, GitHub Pages, and Deployment Audit

**Audit Method:** Direct inspection of `railway.json`, `server.ts`, `vite.config.ts`, `DEPLOYMENT.md`, `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`, `.env.example`, PLUS live read-only HTTP/TLS probes against `https://ophireummultimedia.com`, `https://ophireumtechnology.github.io/OMPNETWORK/`, and `https://api.ophireummultimedia.com`.

---

## 1. Live Production Infrastructure State (Verified Facts)

### A. Static Frontend (GitHub Pages + Custom Domain)
- `https://ophireumtechnology.github.io/OMPNETWORK/` -> `HTTP/2 301` redirect to `https://ophireummultimedia.com/` (**Verified Fact**).
- `https://ophireummultimedia.com/` -> `HTTP/2 200`, served by `GitHub.com` (Fastly/Varnish edge `japaneast`), `last-modified: Tue, 24 Nov 2026 05:31:03 GMT` (matches latest `main` commit `e1f158b2` deployed by `Deploy OMPNETWORK to GitHub Pages` workflow at `05:30:16Z`) (**Verified Fact**).
- `https://ophireummultimedia.com/assets/aistudio/OPHIREUM_Logo_6504e623.png` -> `HTTP/2 200`, `content-type: image/png`, `etag: "6b052117-abe6ed"` (**11.27 MB payload!**) (**Verified Fact**).
- `https://ophireummultimedia.com/images/dti-business-registration.png` -> `HTTP/2 200`, `content-type: image/png`, `etag: "6b052117-2a4837"` (**~2.77 MB payload**) (**Verified Fact**).

### B. Backend API Gateway (Railway)
- Endpoint: `GET https://api.ophireummultimedia.com/api/health` (**Verified Fact**):
  - Status: `HTTP/2 200`, TLS/HTTPS active (`strict-transport-security: max-age=31536000; includeSubDomains`), served via `railway-hikari` edge `hkg1`.
  - Uptime: `660,062 seconds` (~7.64 days — indicates Railway service has NOT redeployed since ~Nov 16, even though `main` had commits on Nov 23–24!).
  - Reported Version: `"phase1-stabilization-local"` (`APP_VERSION` env var is unset in Railway).
  - Live Dependency Status:
    - `database`: `configured: true`, `connected: true`, **`latencyMs: 1641`**, `status: "up"`
    - **`email`**: **`configured: false`** (`provider: "resend"`)
    - **`calendar`**: **`configured: false`** (`provider: "google_calendar"`)
    - `gemini`: `configured: true`
    - `adminAuth`: `bootstrapConfigured: false`, `supabaseConfigured: true`
    - `catalogCount: 78`, `categoryCount: 10`
- Live CORS Probe (**Verified Fact**):
  - `Origin: https://ophireummultimedia.com` -> `HTTP/2 204`, `access-control-allow-origin: https://ophireummultimedia.com`.
  - `Origin: https://untrusted-audit-check.run.app` -> `HTTP/2 204`, **`access-control-allow-origin: https://untrusted-audit-check.run.app`** (live P1 CORS bypass confirmed!).
- Live Auth Probe (**Verified Fact**):
  - `GET https://api.ophireummultimedia.com/api/admin/solution-requests` (unauthenticated) -> `HTTP/2 401`.
- Live Availability Probe (**Verified Fact**):
  - `GET https://api.ophireummultimedia.com/api/appointments/availability?date=2026-12-01` -> `HTTP/2 200`, `calendarConfigured: false`, `bookedSlots: []`.

### C. Unverified External Configuration
- Exact Railway project/service ID, auto-deploy branch trigger settings, replica count, billing limits, and configured secret values (cannot be read without Railway dashboard/CLI access).
- Exact Supabase project ID, region, PITR/backup schedule, Auth redirect URLs/SMTP settings, and GitHub Actions repository `vars` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`).
- Note the **7.64-day uptime discrepancy**: `main` received commits `7e6b3f16` (Nov 23) and `e1f158b2` (Nov 24), yet `api.ophireummultimedia.com` uptime is `660,062s` (~Nov 16, matching commit `e9df3b94`). This strongly indicates either Railway auto-deploy on `main` is paused/watch-filtered, or Railway is pinned to an older deployment! **Must be verified in Railway dashboard.**

---

## 2. CI/CD & Build Pipeline Audit

| Pipeline / Config | Verified Behavior | Gaps & Risks |
|---|---|---|
| `.github/workflows/ci.yml` | Runs `npm ci`, `npm run lint` (`tsc --noEmit`), `npm test`, `npm run build`, `npm run build:server`. All recent runs on `main` and PRs #7–#10 succeeded (**Verified Fact**). | Only triggers on `main` and `repair/**` pushes/PRs; no real ESLint; no `npm audit` / SCA / secret scanner (e.g., Gitleaks); no Postgres migration/RLS CI test; no Playwright/browser E2E smoke test. |
| `.github/workflows/deploy-pages.yml` | Runs `verify` -> `build` (with `VITE_*` vars + `dist/` secret grep) -> `deploy` to GitHub Pages. | `main` is unprotected, so any direct push immediately deploys to production. Secret grep does not include `GEMINI_API_KEY` or future payment secret prefixes. Does not verify post-deploy HTTP 200 or check asset size budgets. |
| `railway.json` | `builder: RAILPACK`, `startCommand: "npm start"` (`tsx server.ts`), `healthcheckPath: "/api/health"`, `healthcheckTimeout: 60`, `restartPolicyType: "ON_FAILURE"`. | Runs TypeScript runtime transpiler (`tsx server.ts`) directly in production instead of pre-compiled JS bundle; healthcheck hits `/api/health` which always returns `200` even when DB is dead (`AUD-API-003`). |
| `vite.config.ts` & Bundle | `vite build` succeeds in `1.12s` (**Verified Fact**). | Emits deprecation warning for `__dirname` (`vite.config.ts:12`). Single monolithic client bundle `dist/assets/index-*.js` is **1,042.04 kB** (`278.29 kB` gzip), triggering Vite's `> 500 kB` chunk warning with zero lazy-loading (`React.lazy`) for modals or admin/portal views. |
| Lockfiles | GitHub `main` has both `package-lock.json` and `bun.lock`. | Risk of lockfile divergence between local Bun usage and GitHub Actions `npm ci`. |
| `.env.example` | Lists 17 env vars cleanly with no secrets. | Missing `GEMINI_API_KEY`, `PORT`, `NODE_ENV`, and future payment/storage/SMS env var templates. |

---

## 3. Deployment & Operations Findings

### Finding `AUD-OPS-001`
- **Severity:** `P1`
- **Location:** Live Railway Service (`https://api.ophireummultimedia.com`)
- **Evidence (Verified Fact):** `/api/health` returns `email.configured: false`, `calendar.configured: false`, `version: "phase1-stabilization-local"`, `database.latencyMs: 1641`, `uptimeSeconds: 660062` (not redeployed after Nov 23–24 `main` commits).
- **Business Impact:** No production customer confirmations, admin inquiry alerts, or calendar invites are being sent today; future commerce order receipts and admin payment alerts will silently queue as `skipped_unconfigured` unless Resend is configured. High DB latency degrades checkout responsiveness.
- **Technical Impact:** Missing production operational readiness and unclear Railway-to-GitHub auto-deploy alignment.
- **Recommended Correction:**
  1. Confirm the exact Railway project/service hosting `api.ophireummultimedia.com` (explicitly separate from `TaxGuard` / `jubilant-magic`).
  2. Configure verified Resend domain (`ophireummultimedia.com` SPF/DKIM/DMARC) + `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`.
  3. Configure Google Calendar service account (`GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`) or explicitly disable calendar UI claims until configured.
  4. Set `APP_VERSION` (e.g., commit SHA / release tag) and stable `ADMIN_SESSION_SECRET` (`>= 32` chars).
  5. Investigate `1641ms` DB latency and Railway auto-deploy trigger configuration.
- **Required Test:** Synthetic staging/prod smoke test verifying real Resend email delivery, real calendar invite creation, `/api/health` latency `< 150ms`, and version tag matching deployed commit.
- **Dependencies:** Railway & Supabase workspace access, DNS access for Resend SPF/DKIM.
- **Current Status:** Open (Active in Production).

### Finding `AUD-OPS-002`
- **Severity:** `P1`
- **Location:** GitHub Repository Settings (`OphireumTechnology/OMPNETWORK`)
- **Evidence (Verified Fact):** GitHub API confirms `protected: false` on `main` and all other 10 branches.
- **Business Impact:** Accidental or unauthorized direct pushes immediately deploy to `ophireummultimedia.com`.
- **Technical Impact:** No enforced review, CI gate, or force-push protection.
- **Recommended Correction:** Enable branch protection rules on `main` requiring PR review, passing CI checks, and linear/up-to-date merges.
- **Required Test:** Attempt direct push/merge without passing CI (must be blocked by GitHub).
- **Dependencies:** Repository admin access.
- **Current Status:** Open.

### Finding `AUD-OPS-003`
- **Severity:** `P2`
- **Location:** `server.ts:81–94` (In-Process Outbox Worker), `vite.config.ts`, `package.json`
- **Evidence (Code-Level Observation + Verified Fact):**
  - `server.ts:81` runs `setInterval(..., 60_000)` in-process without DB row locking (`FOR UPDATE SKIP LOCKED`) or dedicated worker process. Horizontal scaling on Railway would run concurrent outbox sweeps across replicas.
  - Client bundle is `1,042.04 kB` in a single chunk; `vite.config.ts:12` uses deprecated `__dirname`.
  - No structured observability/APM, error tracking (e.g., Sentry), or uptime alerting exists for webhook failures or 5xx spikes.
- **Business Impact:** Slow mobile load times (`1.04 MB` JS + `11.27 MB` logo PNG) and undetected production payment/webhook failures once commerce launches.
- **Technical Impact:** Scaling hazard for outbox/rate limiter and lack of production telemetry.
- **Recommended Correction:** Add `FOR UPDATE SKIP LOCKED` Postgres RPC for outbox claiming (or dedicated worker queue), code-split heavy modals (`EnterpriseModal`, `CustomerPortal`, `AIConsultantWidget`, `ServicesSection`) via `React.lazy`, fix `import.meta.dirname`, and add uptime + webhook dead-letter alerting before commerce launch.
- **Required Test:** Concurrent worker claim test verifying zero duplicate email dispatches; bundle budget check (`< 350 kB` initial JS chunk).
- **Dependencies:** Phase 1 & Phase 4 engineering.
- **Current Status:** Open.
