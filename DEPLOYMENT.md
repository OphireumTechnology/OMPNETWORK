# OPHIREUM NETWORK — Production Deployment Architecture & Rollback Guide

## 1. Architecture overview

The frontend is published through GitHub Pages. Transactional persistence, administrator authentication, email dispatch, calendar operations and AI proxy routes require the separate Node.js API service and the dedicated OMPNETWORK PostgreSQL/Supabase project.

| Layer | Intended host | Required configuration |
|---|---|---|
| Frontend | GitHub Pages | `VITE_API_BASE_URL`, public Supabase URL/key only if directly required |
| Backend API | Approved Node.js host (Railway/Cloud Run/Render) | Server-side Supabase service key, Resend, Gemini, Calendar, stable session secret, CORS allowlist |
| Database | Dedicated OMPNETWORK Supabase project | Reviewed schema and ordered migrations |

**Environment separation is mandatory.** OMPNETWORK must not use TaxGuard's database, service credentials, Railway service, or production environment. Confirm the exact OMPNETWORK project reference and hosting project/service before any operational change.

## 2. Database migration and administrator provisioning

### Existing database safety

1. Identify the exact OMPNETWORK Supabase project reference from the production backend configuration. Do not infer it from another product or project name.
2. Confirm the database is healthy and take/verify a recoverable backup before any schema change.
3. Inspect the live migration history and policies.
4. Apply only the reviewed OMPNETWORK migrations, in order, to that exact project.
5. Run Supabase security advisors and verify RLS after the migration.
6. Do not run `schema.sql` blindly against an existing production database.

The migration `20261111_revoke_public_client_reads.sql` removes legacy anonymous read/update policies for conversation sessions and appointments. It is included as a reviewed migration artifact, **not automatically applied**. Apply it only after confirming the target project, backup, current policy names and expected application behavior.

### Administrator provisioning

Do not use email-only SQL to grant or upgrade a super-administrator. Do not use an `ON CONFLICT` clause that silently promotes an existing account.

Use this controlled procedure:

1. Create the administrator through Supabase Auth using the approved identity-verification process.
2. Verify the person controls the account and complete MFA enrollment.
3. Obtain the verified Supabase Auth user UUID from the Auth dashboard.
4. Have an existing authorized administrator provision the matching `admin_users.auth_user_id`, normalized email and full name.
5. Grant the least-privileged `admin` role initially.
6. Require a separately recorded, dual-approved administrative action for any `super_admin` elevation.
7. Test deactivation and role downgrade to confirm existing sessions lose access.

Never place a service-role key in frontend code, a `VITE_*` variable, source control, browser storage or client-visible logs.

## 3. Backend, domain, TLS and CORS

Before changing DNS or hosting:

- Confirm the OMPNETWORK Railway project, production environment, API service, source repository and deployed branch.
- Confirm `api.ophireummultimedia.com` is attached to that OMPNETWORK service, not a different application.
- Confirm the custom domain's required DNS records, ownership verification and TLS certificate status.
- Confirm CORS allows only the intended production frontend origins.
- Confirm the service binds to Railway's injected `PORT` and uses the documented start command.
- Do not modify DNS, custom domains, environment variables or deployment settings during read-only verification.

## 4. Runtime readiness checks

Readiness endpoint: `GET /api/health`.

Production verification must confirm:

- HTTP status is successful.
- Database dependency is configured, connected and responsive.
- Email provider is configured and a controlled test message is delivered.
- Calendar provider is configured and a controlled test event can be created/removed in a designated test calendar.
- AI provider is configured without exposing credentials.
- Administrator authentication uses a stable, externally managed `ADMIN_SESSION_SECRET`.
- Reported application version matches the deployed Git commit SHA.
- CORS preflight succeeds for approved origins and rejects unapproved origins.
- No unexpected pending Railway deployment/configuration changes exist.

Do not send customer data or create real customer appointments during smoke tests. Use synthetic test identities and a designated test mailbox/calendar.

## 5. Rollback and change control

- Frontend: retain the last known-good GitHub Pages deployment and revert the release PR if needed.
- Backend: retain the last known-good deployment and roll back to that revision if the new revision fails health checks.
- Database: take a verified backup before migration; prepare and test a compensating migration where applicable. Do not assume destructive changes are automatically reversible.
- Every production change requires a change record, reviewer, expected impact, rollback steps and post-change verification.

## 6. Current verification limitation

The connected Railway account currently exposes a project/service for TaxGuard, not an OMPNETWORK API service. The connected Supabase account currently exposes a TaxGuard project, not a dedicated OMPNETWORK database. Those resources must not be modified or treated as OMPNETWORK infrastructure.

Production verification for OMPNETWORK remains blocked until the owner connects the correct Railway workspace/project and the dedicated OMPNETWORK Supabase project, or supplies the exact production identifiers through the authorized connectors.
