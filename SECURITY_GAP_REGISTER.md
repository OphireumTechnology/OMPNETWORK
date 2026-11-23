# OMPNETWORK — Engineering Gap Register and Remediation Plan

Date: 2026-11-23
Source baseline: `main` at `e9df3b940b1c8176d894577a7a6ad51c7a147f55`

## Applied in security repair PR #5

- Signed admin sessions are bound to current active principal ID, normalized email and role.
- Malformed and expired session claims are rejected.
- Rate-limit identity no longer reads the raw first `X-Forwarded-For` value.
- In-process rate-limiter key growth is bounded.
- Focused authentication regression tests were added and the latest PR CI passed.
- Legacy public session/appointment read-policy revocation migration from PR #2 is included for review; it has not been applied to any database.
- Deployment documentation no longer recommends email-only super-admin promotion.

## Pending source/release review

| Priority | Finding | Required action |
|---|---|---|
| P0 | PR #2 was created from an older base and is not mergeable | Do not merge wholesale. Its legacy frontend changes are superseded by newer main code using backend inquiry and appointment APIs. Review only the RLS migration carried into PR #5. |
| P1 | PR #3 duplicates admin principal binding | Superseded by the stronger tested implementation in PR #5; close only after the consolidated PR is accepted. |
| P1 | In-memory rate limiter remains process-local | Use shared Redis or gateway-level limits before multi-replica deployment. |
| P1 | Existing production database policy state is unknown | Connect the dedicated OMPNETWORK Supabase project, inspect migration history/policies, back up, apply reviewed migration and run advisors. |
| P1 | Deployment documentation previously included email-only super-admin promotion | Replaced with verified Auth UUID provisioning and separate approval for elevation. |
| P1 | Production hosting project is not visible in the connected Railway account | Connect the correct Railway workspace/project. Do not touch the visible TaxGuard service. |
| P1 | Production backend endpoint and DNS/TLS could not be verified | Verify from the actual OMPNETWORK Railway service after access is connected. |
| P1 | Production email and calendar delivery remain unverified | Use synthetic test mailbox and dedicated test calendar after connecting the correct service. |
| P1 | Public registration certificate imagery requires owner/legal review | Confirm publication authority and redact personal/confidential fields if needed. |
| P2 | Project brief fallback content may contain assumed placeholder details | Ensure generated output is clearly marked draft and requires customer verification. |
| P2 | Dependency/lockfile governance | Standardize package manager and lockfile; run dependency and supply-chain scans. |
| P2 | Independent security assessment | Complete SAST, DAST, penetration testing and backup restoration exercise. |

## PR consolidation decisions

- PR #5 is the consolidation target for tested session hardening, rate-limit changes and security documentation.
- PR #3 is duplicate session-auth work and should not be merged separately.
- PR #2 must not be merged wholesale: it is based on an older main commit and includes older UI behavior that disables online appointment booking. The current main code has a newer server-side availability/booking API. Its narrowly scoped legacy RLS migration is carried separately for review.
- PR #4 is an IP/provenance inventory and is outside this security consolidation.

## Production verification status

Read-only inspection of connected infrastructure found:
- Railway exposes one production project named `jubilant-magic`, with one service named `taxguard`, sourced from `OphireumTechnology/taxguard`.
- That Railway service is not OMPNETWORK and has a different custom domain.
- Supabase exposes one healthy project named `TaxGuard`; no dedicated OMPNETWORK database is visible in the connected account.
- GitHub Pages deployment workflow last succeeded on the `main` branch on 2026-11-16. The repair branch CI passed, but it has not been deployed.
- Direct HTTP checks of the documented OMPNETWORK public endpoints were not available through the connected web retrieval path.

Therefore no claim is made that OMPNETWORK production database, API, email, calendar, DNS or TLS has passed verification. No Railway variables, Supabase records/policies, DNS, live deployments or customer data were changed.

## Required before production

1. Connect the correct OMPNETWORK Railway project and dedicated Supabase project.
2. Verify exact project/service IDs and production domains.
3. Inspect database migrations, policies and RLS on the correct database.
4. Take and verify a restorable backup before applying the included migration.
5. Run Supabase security/performance advisors and verify the resulting policies.
6. Verify stable admin session secret and eliminate any unsafe bootstrap identity fallback.
7. Configure and verify shared rate limiting before horizontal scaling.
8. Verify Resend, Google Calendar and Gemini integrations with controlled test resources.
9. Run CI, SAST, dependency/secret scans, DAST and independent penetration tests.
10. Verify GitHub Pages, backend health, CORS, DNS/TLS, logs and rollback path.
11. Complete production browser testing and a documented release approval.

## Change safety

The security repair branch and PR are isolated from `main`. No production database, Railway configuration, DNS record, provider credential, live deployment or customer record was changed.
