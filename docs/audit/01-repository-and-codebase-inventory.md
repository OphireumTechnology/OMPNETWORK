# 01 — Repository and Codebase Inventory

**Repository:** `https://github.com/OphireumTechnology/OMPNETWORK`  
**Audited Snapshot:** `main` (`e1f158b2`, 2026-11-24T05:30:13Z)  
**Total First-Party TypeScript/TSX Modules (`src/` + `server.ts`):** 41 files (40 in `src/`, 1 root `server.ts`)  
**Automated Static Graph Checks (Verified Fact):** `0` circular dependencies, `0` unreferenced `.ts/.tsx` modules, `0` hardcoded credential pattern hits.

---

## 1. Root Configuration, CI/CD, and Build Files

| File | Responsibility | Audit Observations |
|---|---|---|
| `package.json` | Dependencies & scripts (`dev`, `start`, `build`, `build:server`, `lint`, `typecheck`, `test`). | **Code-Level Observation:** Package is still named `"react-example"` (`"version": "0.0.0"`). `"lint"` is merely `"tsc --noEmit"` (no ESLint configured). React 19.0.1, Vite 8.3.0, TypeScript 7.0.2, Express 4.21.2, `@google/genai` 2.4.0, `@supabase/supabase-js` 2.119.0. |
| `package-lock.json` & `bun.lock` | Dependency lockfiles. | **Verified Fact:** GitHub `main` commits **both** `package-lock.json` (53,838 B) and `bun.lock` (64,845 B). Local workspace only contained `bun.lock`. Dual lockfiles create dependency drift risk between CI (`npm ci`) and local dev. |
| `tsconfig.json` | TypeScript compiler config (`ES2022`, `bundler`, `react-jsx`, `noEmit: true`). | **Code-Level Observation:** `strict` mode is NOT enabled (`strict: true` absent); only `skipLibCheck`, `isolatedModules`, `moduleDetection` are set. Weak type checking hides nullability bugs. |
| `vite.config.ts` | Vite client build config (`base: './'`, `@vitejs/plugin-react`, `@tailwindcss/vite`, port `3000`). | **Verified Fact:** Build emits deprecation warning (`__dirname` unsupported by future `configLoader: 'native'`; should use `import.meta.dirname`). Single JS bundle chunk is `1,042.04 kB` (`278.29 kB` gzip) with zero route/modal code splitting. |
| `index.html` | HTML entry point, SEO meta, OpenGraph, JSON-LD `Organization` schema, Google Fonts. | **Code-Level Observation:** References `%BASE_URL%assets/aistudio/OPHIREUM_Logo_6504e623.png` (an 11.27 MB PNG on `main`!). JSON-LD `logo` still points to `https://ophireumtechnology.github.io/OMPNETWORK/...` instead of canonical `https://ophireummultimedia.com/...`. |
| `metadata.json` | App descriptor (`Ophireum Multimedia Production`). | Clean metadata; no permissions requested. |
| `.env.example` | 17 environment variable names (alphabetical, no secret values). | **Code-Level Observation:** Omits `GEMINI_API_KEY` (used by `src/server/app.ts:965,1079,1229`) and `PORT` / `NODE_ENV`. |
| `.gitignore` | Ignores `node_modules/`, `build/`, `dist/`, `coverage/`, `.DS_Store`, `*.log`, `.env*` (except `.env.example`). | Standard and safe. |
| `railway.json` | Railway deployment config (`RAILPACK`, `startCommand: "npm start"`, `healthcheckPath: "/api/health"`, `healthcheckTimeout: 60`, `restartPolicyType: "ON_FAILURE"`, `restartPolicyMaxRetries: 5`). | **Code-Level Observation:** Healthcheck expects `2xx` from `/api/health`, which always returns `200` even when DB is down (see `AUD-OPS-003`). |
| `DEPLOYMENT.md` | Deployment guide for Railway, GitHub Pages, Supabase, Resend, Google Calendar. | **Code-Level Observation:** Contains an unsafe email-only SQL snippet (`WHERE LOWER(email) = ...`) and references `executive@ophireummultimedia.com`, which conflicts with `companyConfig.ts` (`contact@ophireummultimedia.com`) and `emailService.ts` fallback (`ophireum.multimedia@gmail.com`). |
| `.github/workflows/ci.yml` | Runs `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npm run build:server` on `main` and `repair/**`. | **Code-Level Observation:** Does NOT trigger on `feature/**` or `fix/**` pushes (only PRs targeting `main`/`repair/**`). No SAST, `npm audit`, or real-DB migration test. |
| `.github/workflows/deploy-pages.yml` | Verifies, builds with `VITE_API_BASE_URL`/`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, greps `dist/` for 5 secret names, deploys to GitHub Pages. | **Code-Level Observation:** Secret grep check is good practice, though it does not check for `GEMINI_API_KEY` or future payment secret prefixes (`XENDIT_SECRET`, `PAYPAL_CLIENT_SECRET`, `MAYA_SECRET`). |

---

## 2. Backend & Server Modules

| File | Lines | Responsibility | Key Audit Findings |
|---|---|---|---|
| `server.ts` | 109 | Node HTTP bootstrap, env loading, `parseServerPort()`, mounts `createApp()`, attaches `vite.middlewares` in dev or serves `dist/` in production, starts 60s email outbox retry worker, graceful SIGTERM/SIGINT shutdown. | **Code-Level Observation:** Outbox `setInterval(60_000)` runs in-process without distributed lock (duplicate dispatch risk if Railway scales >1 replica). |
| `src/server/app.ts` | 1,316 | Monolithic Express application: security headers, CORS, sliding-window rate limiters, `/api/health`, `/api/admin/*`, `/api/inquiries`, `/api/appointments*`, `/api/consultant/chat`, `/api/voice/*`. | **Code-Level Observation:** Overloaded single file (1,316 lines). Contains `*.run.app` CORS bypass, spoofable `X-Forwarded-For`, unbounded rate-limiter Map, unauthenticated AI endpoints, non-standard Gemini model IDs, and appointment PATCH/POST flaws. |
| `src/server/auth.ts` | 133 | `AdminAuthService`: HMAC-SHA256 bearer token issuance/verification, bootstrap password timing-safe check, Supabase JWT verification via `supabase.auth.getUser`, `requireAdmin` middleware. | **Code-Level Observation:** Ephemeral random fallback secret when `ADMIN_SESSION_SECRET` unset; `resolveAdminFromRequest` does not bind `sub`/`role` to active DB record; no logout/revocation; typo `"OPHIRIUM Administrator"`. |
| `src/server/validation.ts` | 212 | Input sanitizers & validators for solution requests, appointments, consultant chat, voice audio, and appointment actions. | **Code-Level Observation:** Still imports legacy `SERVICES_DATA` for fallback validation alongside `SERVICE_CATALOG`. `validateAppointmentActionPayload` allows `reschedule` without past-date or weekend checks. |
| `src/server/logger.ts` | 25 | Structured JSON logger (`info`/`warn`/`error`) + `createCorrelationId()`. | Clean; does not auto-redact sensitive fields (relies on callers). |
| `src/server/db/types.ts` | 140 | TypeScript interfaces for `DatabaseRepository`, `SolutionRequestRecord`, `AppointmentRecord`, `NotificationOutboxRecord`, `AuditLogRecord`, `AdminUserRecord`, `DatabaseUnavailableError`, `ConflictError`. | Covers only 5 of the 10 tables in `supabase/schema.sql`. |
| `src/server/db/supabaseRepository.ts` | 620 | Supabase `service_role` repository implementation of `DatabaseRepository`. | **Code-Level Observation:** PostgREST `.or()` filter interpolation in `findActiveAdminByEmail` (`line 572`); swallows DB error and falls back to env allowlist (`lines 589–606`); never reads/writes `client_profiles`, `ai_conversation_sessions`, `project_requirements`, `project_briefs`, or `consent_records`. |
| `src/server/services/emailService.ts` | 435 | Resend HTTP API transactional email service with outbox persistence, exponential backoff retries, HTML templates. | **Code-Level Observation:** Hardcoded fallback admin email `ophireum.multimedia@gmail.com` (`line 97`). Solution confirmation template prints `estimatedOneTimeStartingUsd` even for monthly-only subscription packages. |
| `src/server/services/calendarService.ts` | 189 | Google Calendar API v3 integration via Service Account JWT (`RS256` signed with Node `crypto`). | **Code-Level Observation:** Only implements `createConsultationEvent()` and `getBusySlots()`. Missing `updateConsultationEvent()` and `deleteConsultationEvent()` for reschedules/cancellations. |

---

## 3. Database & Test Files

| File | Lines | Responsibility | Key Audit Findings |
|---|---|---|---|
| `supabase/schema.sql` | 310 | Full declarative schema (10 tables, `is_ophireum_admin()`, RLS policies, indexes). | Not executed as a numbered migration; contains email-fallback admin RLS; lacks `updated_at` triggers and `auth.users` FKs. |
| `supabase/migrations/001_phase1_security_and_persistence.sql` | 142 | Incremental Phase 1 migration. | **P0 Failure on Fresh DB:** Drops policies and alters tables assuming baseline tables already exist, with no `000` baseline migration. Drifts from `schema.sql` (`NOT NULL`/`CHECK`/indexes). |
| `tests/phase1-stabilization.test.ts` | 412 | 6 Node test runner (`node:test`) specs covering admin RBAC, inquiries, DB 503 failure, email retry outbox, booking 409 conflict, AI fallback. | Uses in-memory mock DB (`TestDatabaseRepository`) exclusively; zero real PostgreSQL/RLS/Supabase repository tests. |
| `tests/deployment-integration.test.ts` | 298 | 4 Node test runner specs covering `apiClient`, `parseServerPort`, CORS/full flow, static secret leak scan. | Uses in-memory mock DB (`IntegrationMemoryDb`); explicitly tests blocking `github.io` CORS but never tests `*.run.app` bypass. |

---

## 4. Frontend Modules (`src/`)

| Category | Files | Responsibility & Findings |
|---|---|---|
| **Entry & Styling** | `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/types/index.ts` | Single-page React app (no router—modal-driven UI). All 9 sections and modals mount from `App.tsx`. Tailwind v4 via `@import "tailwindcss";`. |
| **Core Layout & Sections** | `Header.tsx`, `Hero.tsx`, `AboutSection.tsx`, `ServicesSection.tsx`, `PortfolioSection.tsx`, `EnterpriseSuiteSection.tsx`, `ContactSection.tsx`, `Footer.tsx` | **Code-Level Observations:** `AboutSection.tsx` accepts unused `onOpenPortal` prop. `ServicesSection.tsx:709` sticky "Clear" resets `selectedIds` but forgets `selectedOptionsMap`. `ContactSection.tsx:483–508` `<input type="file">` stores only `file.name` (binary is never uploaded). `Footer.tsx:112` says `"12 Services"` (stale vs 78 catalog items) and `Footer.tsx:189–191` renders Privacy Policy / Terms of Use as non-interactive `<span>` elements. |
| **Enterprise & Admin Modal** | `EnterpriseModal.tsx` | Houses 4 tabs: (1) "Client Portal" (static mockup), (2) "AI Studio" (`setTimeout(800)` template mockup), (3) "AI Agents" (static 12-role showcase), (4) "Admin Operations" (live read-only login + 25-row viewer storing token in `sessionStorage`). |
| **Service Catalog UI** | `ServiceCard.tsx`, `ServiceDetailModal.tsx`, `SolutionBuilderModal.tsx` | Interactive 78-service browser, USD/PHP display toggle (hardcoded `DEFAULT_USD_TO_PHP_RATE = 58`), add-on configurator, and solution request submission via `POST /api/inquiries`. |
| **AI Consultant & Booking** | `AIConsultantWidget.tsx` (1,097 lines), `AppointmentBookingModal.tsx`, `ProjectBriefModal.tsx` | Floating chat/voice widget storing history in `localStorage` (`opm_consultant_*`). Booking modal calls `GET /api/appointments/availability` and `POST /api/appointments`. Project brief generator is purely client-side (`localStorage`/printable export; never persisted to backend DB). |
| **Visual Animations** | `AIProcessingVisualizer.tsx`, `BlockchainNetworkCanvas.tsx`, `FloatingTechnologyIcons.tsx`, `GlobalDigitalGlobe.tsx`, `ServiceTechIcon.tsx` | Canvas/SVG animations. `GlobalDigitalGlobe.tsx:23` declares unused `activeHub` state. |
| **Client Services & Lib** | `src/lib/apiClient.ts`, `src/services/supabaseService.ts`, `src/services/aiConsultantService.ts`, `src/services/aiVoiceService.ts` | `apiClient.ts` resolves API base URL (`VITE_API_BASE_URL` -> Railway fallback on GitHub Pages/custom domain -> same-origin in dev). `supabaseService.ts` exports a browser `supabase` client that is **never called anywhere on `main`**; its persistence helpers are thin wrappers over `/api/*` or local fallback logic. |
| **Static Data** | `companyConfig.ts`, `serviceCatalog.ts` (2,224 lines), `servicesData.ts`, `portfolioData.ts`, `aiAgentsData.ts` | **Duplicate Catalog:** `servicesData.ts` (legacy 12 services) coexists with `serviceCatalog.ts` (78 services across 10 categories). Pricing and FX rate (`58 PHP/USD`) are hardcoded in TypeScript source rather than stored in a versioned DB catalog. |

---

## 5. Static Assets & Branding Audit

| Asset Path (GitHub `main`) | Size (Verified Fact) | Findings |
|---|---|---|
| `public/assets/aistudio/OPHIREUM_Logo_6504e623.png` | **11,265,773 bytes (11.27 MB)** | **P2 Performance Defect (`AUD-REPO-001`):** Served as favicon, header logo, hero badge, footer logo, and modal logo on every page load (`HTTP 200` on `ophireummultimedia.com`). Must be optimized to `< 50 KB` WebP/PNG/SVG. Also absent from local AI Studio snapshot due to file size. |
| `public/assets/aistudio/Ophireum_Multimedia_Tech_Brand_Board_aa50d48b.png` | **2,252,627 bytes (2.25 MB)** | Unreferenced in active UI code (`dead asset` inflating repository and GitHub Pages artifact). |
| `public/assets/aistudio/Philippines_DTI_Business_Registration_Certificate_31c45031.png` | **2,770,999 bytes (2.77 MB)** | **Duplicate unused asset** (identical purpose to `public/images/dti-business-registration.png`). |
| `public/images/dti-business-registration.png` | **~2.77 MB** (`etag: 2a4837`) | Active DTI registration image referenced by `companyConfig.ts:41`. Uncompressed multi-megabyte PNG; also flagged for owner legal review regarding public display of registration/personal fields. |

---

## 6. Codebase Structural Findings

### Finding `AUD-REPO-001`
- **Severity:** `P2`
- **Location:** `public/assets/aistudio/OPHIREUM_Logo_6504e623.png`, `public/images/dti-business-registration.png`, `public/assets/aistudio/*`
- **Evidence (Verified Fact):** GitHub API reports `11,265,773` bytes for logo PNG, `2,770,999` bytes for duplicate DTI PNG, `2,252,627` bytes for unused brand board; live `ophireummultimedia.com` serves the 11.27 MB logo (`etag: 6b052117-abe6ed`).
- **Business Impact:** Severe mobile bandwidth consumption and poor checkout conversion/LCP on Philippine mobile networks.
- **Technical Impact:** Bloats GitHub Pages deployment, browser cache, and clone times.
- **Recommended Correction:** Compress logo into responsive PNG/WebP (`<40 KB`) + SVG favicon; compress active DTI certificate; remove unused duplicate assets from `public/assets/aistudio/`.
- **Required Test:** Verify Lighthouse LCP `< 2.5s` and total initial image payload `< 500 KB`.
- **Dependencies:** None.
- **Current Status:** Open.

### Finding `AUD-REPO-002`
- **Severity:** `P2`
- **Location:** `package.json`, `tsconfig.json`, `src/data/servicesData.ts`, `src/components/ServicesSection.tsx:709`, `src/components/ContactSection.tsx:483–508`
- **Evidence (Code-Level Observation):** Dual lockfiles (`package-lock.json` + `bun.lock`), no ESLint configuration (`lint` = `tsc --noEmit`), `strict` disabled in `tsconfig.json`, dual service catalogs (`servicesData.ts` vs `serviceCatalog.ts`), `ServicesSection` Clear button fails to clear `selectedOptionsMap`, and `ContactSection` file input discards uploaded file contents.
- **Business Impact:** Customers believe reference files attached in Contact form are transmitted when they are silently dropped; stale catalog labels confuse buyers.
- **Technical Impact:** Drift between legacy and current service catalogs; weaker static safety before commerce logic is introduced.
- **Recommended Correction:** Standardize on `npm` + `package-lock.json` (remove `bun.lock`), enable ESLint + TypeScript `strict: true`, remove misleading client-only file picker until signed Supabase Storage uploads are implemented, unify catalog data source, fix Clear button state reset.
- **Required Test:** ESLint + strict `tsc --noEmit` + unit test for catalog parity and UI state reset.
- **Dependencies:** Phase 1 stabilization.
- **Current Status:** Open.
