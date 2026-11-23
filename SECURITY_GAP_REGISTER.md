# OMPNETWORK — Engineering Gap Register and Remediation Plan

Date: 2026-11-23
Baseline: `main` at `e9df3b940b1c8176d894577a7a6ad51c7a147f55`

## Scope and status

This document records source-level findings and required verification. It does not certify the application, prove production deployment health, or imply that external services have been configured.

## Findings requiring remediation

| Priority | Finding | Required action | Verification |
|---|---|---|---|
| P0 | Signed admin sessions must bind subject, email, role and active status to the current admin record | Enforce principal claim matching | Security regression tests |
| P1 | Rate-limit identity must not trust arbitrary forwarded headers | Derive IP from Express trusted proxy configuration | Proxy integration test |
| P1 | In-memory rate limiter is process-local and unsuitable for multi-instance enforcement | Move enforcement to shared Redis/managed gateway before scaling | Multi-instance rate-limit test |
| P1 | Public repository contains company and registration certificate imagery | Confirm authority to publish; remove sensitive registration data from public assets if not explicitly approved | Owner/legal review |
| P1 | Deployment documentation contains a SQL snippet that promotes a known email to super-admin | Replace with controlled, one-time admin provisioning requiring identity binding and independent approval | Migration/provisioning review |
| P1 | Appointment creation must be atomic and calendar-confirmed | Use backend transaction/unique constraint and real calendar provider; fail closed | Concurrency and calendar integration tests |
| P1 | Existing booking/session RLS fixes are in unmerged PR #2 | Review schema and migration against the actual database before merge | Database policy inspection |
| P1 | Principal binding fix exists in unmerged PR #3 | Integrate and test | Auth regression tests |
| P2 | AI consultant can synthesize a project brief using placeholder identities when client data is incomplete | Label output as a draft and require explicit user data before creating a client-ready brief | UX and service tests |
| P2 | Dependency and lockfile governance needs verification | Select one package manager and keep lockfile/CI commands consistent | Clean install and dependency scan |
| P2 | Backend readiness must be checked against live database/email/calendar dependencies | Run authenticated operational readiness checks from deployed environment | Production smoke test |

## Applied in this branch

- Bind signed administrator session subject, normalized email and role to the currently active administrator record.
- Reject malformed or expired session claims.
- Bound in-memory rate-limiter key growth.
- Derive rate-limit client address from Express's configured trusted-proxy boundary, not a raw forwarded header.
- Add focused security regression tests.

## Required before production

1. Integrate and review open security PRs #2 and #3 without bypassing their database migration review.
2. Verify stable `ADMIN_SESSION_SECRET` in production and rotate it through the approved secret manager.
3. Remove email-only bootstrap super-admin promotion; provision administrators with verified identity binding and one-time authorization.
4. Establish a shared rate limiter or gateway-enforced limits before running more than one backend instance.
5. Review public assets for personal information and certificates; do not publish sensitive registration documents without explicit approval.
6. Verify Supabase RLS against the deployed database, not only schema files.
7. Verify actual Resend, Google Calendar and Gemini configuration without exposing secrets.
8. Run clean lockfile install, typecheck, unit/integration/security tests, frontend build and server bundle build.
9. Run SAST, dependency scanning, secret scanning, DAST and independent penetration testing.
10. Complete production browser tests, health/readiness tests, backup restoration and rollback exercise.
11. Review legal, privacy and third-party service terms before production.

## Important operational limitations

GitHub source changes cannot by themselves verify Railway, Supabase, DNS, email delivery, Calendar, or the live website. No production database, credentials, DNS records, provider settings or user data were changed as part of this remediation branch.
