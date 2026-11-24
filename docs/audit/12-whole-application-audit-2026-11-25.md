# OMPNETWORK — Whole Application Audit Register

**Audit date:** 2026-11-25 (Asia/Manila)  
**Repository:** `OphireumTechnology/OMPNETWORK`  
**Audited code snapshot:** `fix/supabase-client-auth-registration` at `e51cd3a297594897827082c7ee90cf9bdc12ee84`  
**Audit record branch:** `audit/whole-application-20261125`  
**Scope:** Repository inventory, public website, client portal, API, authentication, database migrations, persistence, files, commerce, payments, CI/CD, connected Supabase and Railway metadata.  
**Execution safety:** Read-only audit of connected hosted resources. No hosted migration, account creation, payment, email, production deployment, production data mutation, or secret change was performed.

## 1. Executive determination

**Status: NOT READY for public client registration, production commerce, or payment activation.**

The latest GitHub Actions run #97 passed the application checks and the disposable PostgreSQL migration/RLS fixture. This is useful evidence for syntax and the tested SQL contract, but it is not evidence that the live Supabase project is a valid staging target, that the real Supabase Auth lifecycle works, that Resend delivers email, or that the portal's commerce data persists.

The largest architectural blocker is that the current `SupabasePortalRepository` extends `LocalPortalRepository` and overrides only selected identity/profile/session/catalog methods. Most portal business-domain methods still come from the local in-memory implementation. A successful Supabase Auth login must not be interpreted as durable portal persistence.

## 2. Evidence and confidence labels

- **Verified in current branch:** directly inspected in the exact commit listed above.
- **Verified hosted metadata:** returned by the connected GitHub, Supabase or Railway integration during this audit.
- **Previously reported — revalidation required:** present in the existing `docs/audit/*` report set, but not independently re-probed in this audit session.
- **Not tested:** requires a controlled staging environment, browser test, provider credentials, or owner action.

## 3. Findings register

| ID | Priority | Area | Finding | Evidence / impact | Required remediation |
|---|---|---|---|---|---|
| OMP-AUD-001 | **P0** | Database / migrations | No production-ready clean-install baseline is defined. Migration 001 assumes legacy tables such as `client_profiles` and `consultation_appointments` already exist; migration 002 builds the newer portal schema. | Current CI succeeds only after `tests/database/bootstrap.sql` creates a synthetic legacy baseline. The connected Supabase project reports zero public tables and zero migration history. A test fixture is not a deployable baseline. | Design and review a canonical, ordered baseline migration set; test from a truly empty Supabase-compatible database; reconcile with the exact live production database before any production migration. |
| OMP-AUD-002 | **P0** | Portal persistence | `SupabasePortalRepository` inherits `LocalPortalRepository({persistDir:null})`. It overrides Auth account lookup/create/login, profile CRUD, sessions, and catalog reads, but does not override the majority of cart, orders, invoices, payments, wallets, credit ledger, subscriptions, projects, messages, deliverables, support, notifications and activity methods. | The inherited local repository stores state in process memory when `persistDir` is null. Those records disappear on restart/redeploy and are not protected by PostgreSQL RLS. | Implement durable Supabase repository methods for every production PortalRepository operation, with transactional RPCs for checkout, payment settlement, ledger and fulfillment. Until complete, disable unsupported portal functions or gate registration. |
| OMP-AUD-003 | **P0** | Authentication lifecycle | Supabase branch implements signup link generation, password login and persistent session rows, but inherited verification-token, resend-verification, password-reset, password-change and email-change methods still operate on local repository state. | `portalRoutes.ts` calls `verifyEmailByTokenHash`, `setVerificationToken`, `setResetToken`, `resetPasswordByTokenHash`, `updatePassword`, `requestEmailChange` and `confirmEmailChange`; the Supabase adapter does not override these methods. Recovery and email changes are therefore not a real Supabase Auth lifecycle. | Implement these flows through Supabase Auth Admin / user APIs and verified email templates; remove local token-based behavior from Supabase mode; add lifecycle and session-revocation tests. |
| OMP-AUD-004 | **P0** | File storage | Portal uploads and file retrieval are implemented by the local repository's filesystem/in-memory blob store, not Supabase Storage. | Railway service has no attached volume in the inspected environment; container filesystem is not a durable customer file store. Files may be lost on redeploy or restart. | Implement private Supabase Storage upload/download/delete with owner-scoped paths, MIME and magic-byte validation, size limits, signed URLs, malware scanning policy and retention controls. |
| OMP-AUD-005 | **P0** | Hosted staging | The connected Supabase project `hvimapfhgocgvfdcqisq` is active/healthy but has no public tables or migration history; its default branch status is `MIGRATIONS_FAILED`. | Project identity as the intended isolated staging target has not been confirmed by the owner. It must not be assumed to be staging or production. | Obtain explicit confirmation of environment purpose; provision/identify a dedicated staging target; do not apply migrations until project identity, backup and baseline plan are approved. |
| OMP-AUD-006 | **P1** | Credits / pricing | `POST /credits/redeem` accepts client-supplied `creditsCost` and `serviceDescription`. | A client can choose the debit amount rather than selecting a server-defined service tariff. Although the endpoint debits rather than credits the wallet, it can undercharge a service. | Replace arbitrary cost with server-defined tariff/service IDs; calculate debit from trusted catalog rules; require idempotency and transaction-level balance checks. |
| OMP-AUD-007 | **P1** | Payments | Payment adapters do not create actual hosted checkout sessions or execute provider API calls. When configured, `initiatePayment` returns a synthetic `sbx_<provider>_<order>` transaction identifier and a message saying hosted checkout wiring is incomplete. Refund and provider status lookup are unsupported. | UI/provider configuration may look configured while no actual payment can be collected. | Keep every provider disabled; implement each provider's documented sandbox API, return/redirect handling, server-side status verification, refunds, reconciliation and end-to-end certification before enabling. |
| OMP-AUD-008 | **P1** | Webhooks | The adapter uses a generic HMAC-SHA256 or static-token verifier and a normalized generic payload contract for multiple payment providers. | Real provider signature schemes, header sets, canonical payloads, event IDs and status/amount representations differ. A generic verifier is not evidence of provider-compatible verification. | Implement a separate provider-specific verifier and schema adapter; validate event authenticity, replay, order mapping, amount/currency, transaction uniqueness and state transitions against official provider test fixtures. |
| OMP-AUD-009 | **P1** | Email / account recovery | Resend is used for initial Supabase signup confirmation, but the remaining verification resend, password reset, email-change and other lifecycle notification routes do not send real emails in Supabase mode. | The relevant routes currently issue local tokens and only expose developer tokens outside production. No end-to-end delivery has been demonstrated. | Route every account lifecycle email through a single transactional email/outbox service; configure verified sender, SPF, DKIM, DMARC and redirect allow-list; test inbox delivery and token consumption. |
| OMP-AUD-010 | **P1** | Health / operations | `GET /api/health` always responds HTTP 200 even when the database ping reports `degraded_unconfigured`. | Railway's configured health check uses this endpoint, so an unhealthy dependency can still appear healthy to the platform. | Separate liveness and readiness endpoints; readiness must return non-2xx when mandatory dependencies are unavailable; include portal persistence mode and dependency status. |
| OMP-AUD-011 | **P1** | Configuration | `.env.example` omits variables used by the current auth/runtime code, including `SUPABASE_PUBLISHABLE_KEY`, `PORTAL_PUBLIC_URL`, `GEMINI_API_KEY`, `NODE_ENV` and `PORT`. | Operators can deploy an incomplete configuration; the Supabase adapter throws if publishable/anon key is missing. | Maintain a complete typed environment schema; validate required/optional variables at startup; document Railway service-specific secrets without exposing values. |
| OMP-AUD-012 | **P1** | CI / branch workflow | CI push trigger covers `main` and `repair/**`, but not `fix/**` or `audit/**`. PR checks targeting main do run, as shown by run #97. | Direct branch pushes outside the listed patterns do not receive the push-triggered workflow. | Add intended branch patterns or use a consistent PR-only workflow policy; require checks before merge. |
| OMP-AUD-013 | **P1** | Test coverage | No browser E2E suite is present in the repository inventory; current tests are Node tests and SQL fixture assertions. | UI routing, cookie persistence in a real browser, confirmation deep links, CORS preflight, upload/download and complete checkout journeys are not covered by Playwright or equivalent. | Add Playright (or equivalent) staging E2E tests for registration, verify, login, refresh, logout, recovery, cross-client isolation and core portal journeys. |
| OMP-AUD-014 | **P1** | Security review | Migration 001 defines `public.is_ophireum_admin()` as SECURITY DEFINER and allows email-based matching in addition to UUID matching. | This can grant admin policy access based on JWT email instead of binding the principal strictly to `auth.uid()`. The connected Supabase security advisor separately reports exposed SECURITY DEFINER function `public.rls_auto_enable()` callable by anon and authenticated. | Use UUID-only active-admin binding, pin search_path, revoke EXECUTE from PUBLIC/anon/authenticated unless required, grant only to intended roles; inspect and remediate the actual hosted `rls_auto_enable()` function. |
| OMP-AUD-015 | **P1** | Build quality | `npm run lint` is only `tsc --noEmit`; TypeScript strict mode is not enabled. | The green lint label does not represent ESLint/static analysis, and non-strict typing can conceal null/undefined defects. | Enable strict TypeScript incrementally, add ESLint and security-focused rules, and add SAST/dependency scanning to CI. |
| OMP-AUD-016 | **P2** | Dependency management | Repository contains both `package-lock.json` and `bun.lock`. | Different package managers can resolve different dependency graphs. | Select one authoritative package manager and lockfile; align local, CI and deployment install commands. |
| OMP-AUD-017 | **P2** | Architecture / maintainability | `src/server/app.ts` is a large monolithic Express module and `portalRoutes.ts` is also very large. | Route registration, dependency wiring and business logic are difficult to isolate and regression-test. | Split into domain routers/services/repositories with typed dependency injection; preserve API contracts during refactor. |
| OMP-AUD-018 | **P2** | Dev server | Vite dev server binds `0.0.0.0` and sets `allowedHosts: true`. | If the development server is exposed to an untrusted network, host-header protections are disabled. This is a development-only configuration risk, not evidence of production exposure. | Restrict allowed hosts and bind localhost by default; enable network access only for controlled development environments. |

## 4. Hosted environment observations

### Supabase — connected project metadata

- Project: `Ophireum Multimedia Productions`
- Project ref: `hvimapfhgocgvfdcqisq`
- Region: `ap-northeast-1`
- Status: `ACTIVE_HEALTHY`
- Public tables returned: none
- Migration history returned: none
- Default branch: `main`, status `MIGRATIONS_FAILED`
- Security advisor: one finding for `public.rls_auto_enable()` exposed to `anon` and `authenticated`
- Performance advisor: no findings
- Health advisor: no findings

No hosted schema was changed. The project must be positively identified as staging before it is used for validation.

### Railway — connected project metadata

- Project: `brave-nature`
- Service: `OMPNETWORK`
- Environment inspected: `production`
- Source: `OphireumTechnology/OMPNETWORK`, branch `main`
- Latest deployment: `SUCCESS`
- Attached volumes: none
- Service variable names returned: Railway system variables only; connected OAuth integration redacts values and may omit user secrets. Therefore this is **not proof** that all application secrets are absent.

No Railway variables, service configuration, deployment or production runtime were changed.

## 5. CI evidence

GitHub Actions run #97:
https://github.com/OphireumTechnology/OMPNETWORK/actions/runs/45459463000

**Observed result: success.** All listed steps passed:
- npm clean install
- TypeScript typecheck (script labelled lint)
- application test suite (20 tests in the then-current test set)
- frontend build
- server bundle build
- disposable PostgreSQL bootstrap
- migrations 001, 002 and 003
- migration structure and client RLS isolation assertions

**Important limitation:** PostgreSQL tests use `tests/database/bootstrap.sql`, a synthetic baseline. They do not establish that migrations can initialize an empty hosted Supabase project, nor do they test Supabase Auth, Resend, Storage, Railway or real payment provider APIs.

## 6. Prior audit items carried forward — revalidate before closing

The repository already contains `docs/audit/00` through `docs/audit/11` and `CLIENT_PORTAL_PRODUCTION_READINESS.md`, created against earlier snapshots. These documents report additional issues that must remain in the remediation backlog until re-tested against the current branch and live deployment:

- Public marketing site: contact form file selection may retain only a filename; service option clear/reset state may be inconsistent; legal/privacy/terms links may be placeholders; stale service count and branding/SEO metadata.
- Backend: appointment reschedule date/weekend validation, calendar create/update/cancel consistency, appointment action rate limiting, admin principal binding and revocation, forwarded-IP trust/rate limiting, and CORS negative tests.
- Data governance: customer consent records, privacy/terms acceptance, data retention/deletion/anonymization, audit immutability, backup/restore and disaster recovery.
- Operational: Resend and Google Calendar live configuration/delivery, production DB latency, app version/commit reporting, branch protection and stale/conflicting PR consolidation.
- UI and commerce: accessibility, mobile/responsive behavior, invoice PDF generation, tax/VAT treatment, FX snapshot governance, subscriptions, refund lifecycle, support SLA and staff/admin workflows.

These are **not all newly re-proven** in this audit; consult the prior detailed documents and run current verification before marking them fixed.

## 7. Remediation order and release gates

### Gate 0 — Freeze risky activation
- Keep public registration disabled until Supabase Auth staging tests pass.
- Keep payment providers and live payment secrets disabled.
- Do not merge the auth PR or deploy to production as a shortcut.

### Gate 1 — Database and persistence foundation (P0)
- Confirm staging project identity.
- Create a reproducible clean-install baseline.
- Implement complete PostgreSQL persistence for all portal repository methods.
- Implement Supabase Storage.
- Run live two-user RLS tests across every client-owned table.

### Gate 2 — Complete Auth lifecycle (P0)
- Supabase Auth signup/confirmation/resend/login/logout/password recovery/password change/email change.
- Secure session creation, refresh/expiry/revocation, cookie and CSRF verification.
- Real Resend delivery with verified sender and deliverability records.
- Two controlled test accounts and browser refresh/cross-client isolation E2E.

### Gate 3 — Commerce integrity (P1)
- Server-defined credit tariffs.
- Real sandbox hosted checkout and provider-specific webhooks.
- Atomic payment/ledger/invoice/fulfillment operations.
- Refund/reversal and reconciliation flows.

### Gate 4 — Application hardening (P1/P2)
- Health/readiness semantics, environment schema, CORS/proxy/rate limiting, admin authorization, strict TypeScript, lint/SAST/dependency scanning, browser E2E and accessibility checks.
- Revalidate the prior marketing site, appointment, admin and privacy/compliance findings.

### Gate 5 — Release approval
- All P0 and P1 findings closed or explicitly risk-accepted by owner.
- Staging acceptance suite passes.
- Backup/restore and rollback procedures tested.
- PR reviewed and approved; production migration and deployment require separate explicit authorization.

## 8. Audit limitations

This is a code-level and connected-metadata audit, not a third-party penetration test or legal opinion. The following were not performed: authenticated browser session against a staging deployment, live Supabase Auth signup, real Resend inbox delivery, real Supabase Storage upload, real payment provider sandbox transaction, live DB schema dump from the production API's actual database, DAST/load test, accessibility audit in browsers, and full manual review of every rendered screen on all viewport sizes.

**Release decision: NOT READY.** Treat the P0 items as blockers. No production action is authorized by this audit record.
