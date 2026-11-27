# OPHIREUM NETWORK (`OMPNETWORK`) — Release Commissioning Checklist

**Release Candidate**: `ophireum-network@1.0.0-rc.2`  
**Owner Approval Authority**: Dhenze Languisan (Founder & CEO — OPHIREUM MULTIMEDIA PRODUCTION)  
**Production Commercial Safety Posture**: `live_payments_enabled = false` · PayMongo & GoTyme `deferred_merchant_onboarding`

---

## Gate 1 — Source, Build, Security & Local PostgreSQL 16 Readiness (Completed Locally)
- [x] Railway build recovery: deleted competing `/bun.lock`, migrated `railway.json` to `"builder": "RAILPACK"` + `"buildCommand": "npm run build:all"` + canonical `"startCommand": "node dist/server/index.mjs"`
- [x] Native Railway PostgreSQL (`DATABASE_URL` + `pg`) full-stack implementation (`PostgresPoolManager`, `PostgresDatabaseRepository`, `PostgresPortalRepository`, `PostgresAiConversationStore`, `scripts/run-migrations.mjs`, Migration `007`)
- [x] Client Registration `Failed to fetch` fix: guaranteed CORS baseline origin union for `https://ophireummultimedia.com` + structured `PortalApiError(..., 'API_UNREACHABLE')`
- [x] Phase 58 AI Provider Reliability & Cost Governance (`AiProviderGovernanceService`, `/api/admin/ai/governance`, explicit `LIVE_PROVIDER_RESPONSE | DEVELOPMENT_SIMULATION | PROVIDER_UNAVAILABLE` origin classification)
- [x] `package.json` reconciled (`ophireum-network@1.0.0-rc.2`, Node 22 engine lock, `db:migrate`, `test:pg`) + clean `package-lock.json`
- [x] `npm run typecheck` (`tsc --noEmit`): 0 errors
- [x] `npm run lint` (`eslint --max-warnings=0`): 0 errors, 0 warnings
- [x] `npm audit --omit=dev --audit-level=high`: 0 high/critical vulnerabilities
- [x] Real PostgreSQL 16 (PGlite) clean execution of Migrations `000`–`007`, advisory-locked runner idempotency, SHA-256 tamper rejection, full native PG portal/AI/CORS integration, RLS, `SECURITY DEFINER` hardening, and logical Backup/Restore DR drill
- [x] Compiled production startup smoke check (`npm run smoke:prod`): fail-closed production check + `/api/health`, `/api/ready`, `/api/version`, SPA root + graceful `SIGTERM` exit `0`
- [x] Release integrity SBOM & SHA-256 manifest (`dist/release-sbom-manifest.json`) generated via `npm run sbom`

## Gate 2 — GitHub Actions CI, Live PG16 Service & Multi-Browser E2E (Pending Push to GitHub)
- [ ] Push release candidate branch to `https://github.com/OphireumTechnology/OMPNETWORK`
- [ ] Verify `.github/workflows/ci.yml` `verify` job passes all gates (`npm ci`, `typecheck`, `lint`, `test:unit`, `test:security`, `test:migrations`, `test:pg`, `build:all`, `smoke:prod`, `sbom`, `npm audit`, static hygiene)
- [ ] Verify `.github/workflows/ci.yml` `postgres-live-integration` job passes against real Docker `pgvector/pgvector:pg16` (`npm run db:migrate` + `npm run test:pg`)
- [ ] Verify `.github/workflows/ci.yml` `playwright-e2e` job passes all 45 Playwright tests (`chromium-desktop`, `firefox-desktop`, `webkit-desktop`, `tablet`, `mobile`) and archives artifacts

## Gate 3 — Isolated Staging Environment Commissioning (Requires External Credentials)
- [ ] Provision isolated Railway PostgreSQL 16 staging instance (`pgvector/pgvector:pg16` recommended)
- [ ] Apply append-only SQL migrations `000`–`007` via `npm run db:migrate` (advisory lock + SHA-256 tracking)
- [ ] Verify 6 private Storage buckets (`public = false`) and live RLS policies
- [ ] Provision Railway Staging service (2 replicas) using Railpack `railway.json` and all required secrets
- [ ] Confirm `GET /api/admin/system/readiness` reports `stagingReady: true` with `databaseProvider: "postgres"` and `livePaymentsEnabled: false`
- [ ] Validate live external providers in staging (`docs/development/LIVE_PROVIDER_ACCEPTANCE_MATRIX.md`):
  - [ ] Railway PostgreSQL 2-replica persistence & failover
  - [ ] Google Gemini API (`gemini-4-hydrogen`, `gemini-3.8-live`, `gemini-3.8-flash-lite-tts`, `gemini-3.5-transcribe`, `gemini-embedding-2`) returning `LIVE_PROVIDER_RESPONSE`
  - [ ] Resend transactional email delivery + Svix v1 signed webhook (`POST /api/webhooks/resend`)
  - [ ] Google Calendar real event create/update/cancel sync
  - [ ] Xendit, PayPal, and Maya sandbox checkout -> signed `rawBody` webhook -> atomic `MMDDYYYYHHMMAM/PMNNN` reference -> maker-checker refund
- [ ] Execute staging live backup/restore DR drill (`pg_dump` -> `pg_restore` into disposable staging DB) and reconcile row counts (`DATA_RECONCILIATION_REPORT.md`)

## Gate 4 — Philippine Legal & Compliance Sign-Off (Owner & Counsel Required)
- [ ] Legal counsel reviews and approves all 10 policies in `/legal/*` (`pending_legal_review` -> `approved`) under RA 10173 (Data Privacy Act), RA 11967 (Internet Transactions Act), and RA 7394 (Consumer Act)
- [ ] Confirm Data Protection Officer (DPO) contact details and NPC breach-response SOP

## Gate 5 — Controlled Production Cutover (Explicit Written Owner Authorization Required)
- [ ] Obtain explicit written Owner authorization to apply migrations `000`–`007` to Production Railway PostgreSQL (after capturing pre-migration snapshot)
- [ ] Deploy Railway Production (`https://api.ophireummultimedia.com/`) and merge to `main` for GitHub Pages (`https://ophireummultimedia.com/`)
- [ ] Verify live `https://ophireummultimedia.com` client registration succeeds against `https://api.ophireummultimedia.com` with zero CORS/network failure
- [ ] Keep `live_payments_enabled = false` until a separate Phase 2 Merchant & BIR Compliance Sign-Off authorizes live commercial billing
