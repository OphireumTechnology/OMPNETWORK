# OPHIREUM NETWORK — RAILWAY DEPLOYMENT RUNBOOK (PHASE 48 & 76)

**Project:** OPHIREUM MULTIMEDIA PRODUCTION (`OMPNETWORK`)  
**DTI Registration:** No. 7567003 — Founder & CEO: Dhenze Languisan  
**Target Service:** Railway Project `brave-nature`, Service `OMPNETWORK`  
**Production Website:** `https://ophireummultimedia.com` (GitHub Pages)  
**Production API:** `https://api.ophireummultimedia.com` (Railway)  
**Release Candidate:** `1.0.0-rc.2`

---

## 1. Root Cause & Repair of Railway Build Failure (`EBUSY /app/node_modules/.cache`)

### Root Cause Observed in Previous Failed Deployments
1. `railway.json` previously specified `"builder": "NIXPACKS"` (deprecated on Railway) and executed `"buildCommand": "npm ci --no-audit --no-fund && npm run build && npm run build:server"`.
2. A competing `/bun.lock` lockfile also existed alongside `/package-lock.json`, creating toolchain ambiguity during builder detection.
3. Railway Railpack automatically installs dependencies and mounts `/app/node_modules/.cache` as a persistent build cache volume. Invoking `npm ci` a second time inside `buildCommand` attempted to `rmdir /app/node_modules/.cache`, causing Linux `EBUSY: resource busy or locked`.

### Verified Source Repairs Implemented
- Removed `/bun.lock`; standardized exclusively on **Node.js 22 (`>=22.0.0 <23.0.0`)** and **`package-lock.json`**.
- Migrated `/railway.json` to Railpack:
  ```json
  {
    "$schema": "https://railway.com/railway.schema.json",
    "build": {
      "builder": "RAILPACK",
      "buildCommand": "npm run build:all"
    },
    "deploy": {
      "startCommand": "node dist/server/index.mjs",
      "healthcheckPath": "/api/health",
      "healthcheckTimeout": 60,
      "restartPolicyType": "ON_FAILURE",
      "restartPolicyMaxRetries": 5
    }
  }
  ```
- Reconciled a **single canonical production backend artifact**: `dist/server/index.mjs` (compiled from `server.ts` via `npm run build:server`), launched via `npm start` / `node dist/server/index.mjs`.

---

## 2. Railway PostgreSQL & Service Topology

### Recommended Service Layout inside Railway Project `brave-nature`
1. **PostgreSQL 16 Database Service** (official Railway PostgreSQL template or `pgvector/pgvector:pg16` for native vector search):
   - Use private internal networking `${{Postgres.DATABASE_URL}}` (`*.railway.internal:5432`) for `OMPNETWORK` API replicas to eliminate public egress latency and TLS mismatch.
   - `PostgresPoolManager` (`src/server/db/postgresPool.ts`) automatically disables unnecessary TLS on `*.railway.internal` and enables TLS automatically on public endpoints (overrideable via `DATABASE_SSL=require|verify-full|false`).
2. **Backend API Service (`OMPNETWORK`)**:
   - **Staging / Production Replicas:** Minimum `2` replicas recommended for zero-downtime rolling deploys and high availability.
   - All stateful data (sessions, rate-limit buckets, AI conversations, portal records, orders, webhooks, audit logs) is stored in PostgreSQL; no local disk or sticky sessions are required.

---

## 3. Required Railway Environment Variables

Configure via Railway Dashboard (`Variables`) or Railway CLI — **never commit real secrets to Git**:

| Variable | Required in Prod | Notes |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Managed by Railway | Defaults to `3000` locally |
| `DATABASE_PROVIDER` | Yes | `postgres` (or `auto` with `DATABASE_URL`) |
| `DATABASE_URL` | Yes | `${{Postgres.DATABASE_URL}}` (private Railway URL) |
| `DATABASE_SSL` | Optional | `false` for `*.railway.internal`, `require` for external hosts |
| `ADMIN_SESSION_SECRET` | Yes | >= 32 random bytes (`openssl rand -hex 32`) |
| `MFA_ENCRYPTION_KEY` | Yes | >= 32 random bytes |
| `ALLOWED_ORIGINS` | Yes | `https://ophireummultimedia.com,https://www.ophireummultimedia.com` (baseline production origin is always preserved by union guard) |
| `PUBLIC_APP_URL` | Yes | `https://ophireummultimedia.com` |
| `PUBLIC_API_URL` | Yes | `https://api.ophireummultimedia.com` |
| `LIVE_PAYMENTS_ENABLED` | Yes | **MUST remain `false`** until staging acceptance, legal sign-off, and owner release authorization |
| `GEMINI_API_KEY` | When enabling live AI | Server-side only; never prefixed with `VITE_` |
| `RESEND_API_KEY` | When enabling live email | Verified domain `ophireummultimedia.com` |
| `EMAIL_FROM` | When enabling live email | `OPHIREUM Network <no-reply@ophireummultimedia.com>` |

---

## 4. Deployment & Verification Procedure

1. **Apply Database Migrations (Prior to or During Release):**
   ```powershell
   $env:DATABASE_URL="postgresql://..."
   npm run db:migrate:dry-run
   npm run db:migrate
   ```
   `scripts/run-migrations.mjs` acquires PostgreSQL advisory lock `7567003`, verifies SHA-256 checksums in `public.schema_migrations`, and applies `000`–`007` transactionally.
2. **Trigger Railway Deployment** from approved staging branch (never deploy unverified commits directly to production `main`).
3. **Verify Health & Readiness Endpoints:**
   - `GET https://api.ophireummultimedia.com/api/health` → HTTP 200, `database.provider: "postgres"`, `database.healthy: true`, `portalStorage: "postgres"`, `aiConversationBackend: "postgres_native"`.
   - `GET https://api.ophireummultimedia.com/api/ready` → HTTP 200 (fails closed with HTTP 503 if DB ping fails or required secrets are absent).
   - `GET https://api.ophireummultimedia.com/api/version` → HTTP 200 with release `1.0.0-rc.2` and git commit SHA.
4. **Verify CORS & Client Registration:**
   - Send `OPTIONS /api/portal/auth/register` with `Origin: https://ophireummultimedia.com` → must return HTTP 204 with `Access-Control-Allow-Origin: https://ophireummultimedia.com`.
5. **Graceful Shutdown & Rollback:**
   - `server.ts` handles `SIGTERM` and `SIGINT`, closing HTTP/WebSocket servers and draining `PostgresPoolManager.close()` cleanly before exit.
   - To roll back, redeploy the previous immutable Railway deployment snapshot (SQL migrations `000`–`007` are strictly additive/backward-compatible).
