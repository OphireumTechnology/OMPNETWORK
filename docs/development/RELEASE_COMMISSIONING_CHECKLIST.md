# OPHIREUM NETWORK (`OMPNETWORK`) — Release Commissioning Checklist

**Release Candidate**: `ophireum-network@1.0.0-rc.1`  
**Owner Approval Authority**: Dhenze Languisan (Founder & CEO — OPHIREUM MULTIMEDIA PRODUCTION)  
**Production Commercial Safety Posture**: `live_payments_enabled = false` · PayMongo & GoTyme `deferred_merchant_onboarding`

---

## Gate 1 — Source, Build, Security & Local Database Readiness (Completed Locally)
- [x] Permanent compiled backend artifact (`dist/server/index.mjs`) + `railway.json` deterministic build/start config
- [x] `package.json` cleaned (`ophireum-network@1.0.0-rc.1`, Node 22 engine lock, dev tools in `devDependencies`) + clean `package-lock.json`
- [x] `npm run typecheck` (`tsc --noEmit` on TypeScript 5.9.3): 0 errors
- [x] `npm run lint` (`eslint --max-warnings=0`): 0 errors, 0 warnings
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities
- [x] Real PostgreSQL 16 (PGlite) clean execution of Migrations `000`–`006`, idempotency, RLS, `SECURITY DEFINER` hardening, and logical Backup/Restore DR drill
- [x] Compiled production startup smoke check (`npm run smoke:prod`): fail-closed production check + `/api/health`, `/api/ready`, `/api/version`, SPA root + graceful `SIGTERM` exit `0`
- [x] Release integrity SBOM & SHA-256 manifest (`dist/release-sbom-manifest.json`) generated via `npm run sbom`

## Gate 2 — GitHub Actions CI & Multi-Browser E2E (Pending Push to GitHub)
- [ ] Push release candidate branch to `https://github.com/OphireumTechnology/OMPNETWORK`
- [ ] Verify `.github/workflows/ci.yml` passes all gates (`npm ci`, `typecheck`, `lint`, `test:unit`, `test:security`, `test:migrations`, `build:all`, `smoke:prod`, `sbom`, `npm audit --omit=dev --audit-level=high`, static security hygiene)
- [ ] Verify Playwright Multi-Browser E2E (`chromium-desktop`, `firefox-desktop`, `webkit-desktop`, `tablet`, `mobile`) passes and archive artifacts

## Gate 3 — Isolated Staging Environment Commissioning (Requires External Credentials)
- [ ] Provision isolated Supabase Staging project (enable `pgvector` extension)
- [ ] Apply append-only SQL migrations `000` -> `001` -> `002` -> `003` -> `004` -> `005` -> `006`
- [ ] Verify 6 private Storage buckets (`public = false`) and live RLS policies
- [ ] Provision Railway Staging service (2 replicas) using `railway.json` and all required secrets (`EXTERNAL_DEPENDENCY_CONFIGURATION_REGISTER.md`)
- [ ] Confirm `GET /api/admin/system/readiness` reports `stagingReady: true` with `livePaymentsEnabled: false`
- [ ] Validate live external providers in staging:
  - [ ] Supabase PostgreSQL 2-replica persistence & `pgvector` HNSW search
  - [ ] Google Gemini API (`gemini-4-hydrogen`, `gemini-3.8-live`, `gemini-3.8-flash-lite-tts`, `gemini-3.5-transcribe`, `gemini-embedding-2`)
  - [ ] Resend transactional email delivery + Svix v1 signed webhook (`POST /api/webhooks/resend`)
  - [ ] Google Calendar real event create/update/cancel sync
  - [ ] Xendit, PayPal, and Maya sandbox checkout -> signed `rawBody` webhook -> atomic `MMDDYYYYHHMMAM/PMNNN` reference -> maker-checker refund
- [ ] Execute staging live backup/restore DR drill (`pg_dump` -> `pg_restore` into disposable staging DB)

## Gate 4 — Philippine Legal & Compliance Sign-Off (Owner & Counsel Required)
- [ ] Legal counsel reviews and approves all 10 policies in `/legal/*` (`pending_legal_review` -> `approved`) under RA 10173 (Data Privacy Act), RA 11967 (Internet Transactions Act), and RA 7394 (Consumer Act)
- [ ] Confirm Data Protection Officer (DPO) contact details and NPC breach-response SOP

## Gate 5 — Controlled Production Cutover (Explicit Written Owner Authorization Required)
- [ ] Obtain explicit written Owner authorization to apply migrations `000`–`006` to Production Supabase (after capturing pre-migration snapshot)
- [ ] Deploy Railway Production (`https://api.ophireummultimedia.com/`) and merge to `main` for GitHub Pages (`https://ophireummultimedia.com/`)
- [ ] Keep `live_payments_enabled = false` until a separate Phase 2 Merchant & BIR Compliance Sign-Off authorizes live commercial billing
