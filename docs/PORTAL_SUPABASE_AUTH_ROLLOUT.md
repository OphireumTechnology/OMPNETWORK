# Ophireum Multimedia Client Portal — Supabase Authentication Rollout

## Scope

This change moves the production Client Portal identity lifecycle to Supabase Auth, stores client profile records in PostgreSQL, sends Supabase-generated email confirmation links through Resend, and persists the portal's opaque application sessions in PostgreSQL.

It does not enable payment providers or change payment configuration. It does not apply database migrations or create customer accounts in any hosted environment.

## Production runtime requirements

Configure these variables on the API service (Railway), never in the browser bundle:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side secret only)
- `SUPABASE_PUBLISHABLE_KEY` (recommended) or `SUPABASE_ANON_KEY` for password sign-in requests. The service-role key is never used as the client sign-in API key.
- `RESEND_API_KEY`
- `EMAIL_FROM` set to a sender/domain verified in Resend
- `PORTAL_PUBLIC_URL=https://ophireummultimedia.com`

The API must run in production mode. Production startup now fails closed if Supabase URL or service-role credentials are missing; it will not silently use local JSON files for client authentication.

## Supabase project configuration

Before customer registration is enabled:

1. Confirm the intended Supabase project reference and API URL with the project owner.
2. Enable Email provider sign-ups and require email confirmation.
3. Configure the Site URL and allow-list `https://ophireummultimedia.com/portal/verify-email` as a redirect URL.
4. Confirm the sender address configured in `EMAIL_FROM` is verified in Resend.
5. Confirm the Supabase Auth email-link expiry and rate limits are appropriate.
6. Keep CAPTCHA/anti-abuse controls enabled or configure them before public launch.

The API uses Supabase Admin `generateLink(type: signup)` to create the Auth user and confirmation link. The link is sent using the existing Resend transport. A failed Resend delivery triggers compensating deletion of the newly created profile and Auth user; the API returns an error instead of reporting a successful registration.

## Database migration order

Apply only in a disposable/staging Supabase project first:

1. `supabase/migrations/001_phase1_security_and_persistence.sql`
2. `supabase/migrations/002_client_portal_commerce.sql`
3. `supabase/migrations/003_portal_auth_sessions.sql`

Migration 002 creates `public.profiles` with owner-only SELECT RLS and service-role writes. Migration 003 creates `public.portal_auth_sessions`, enables and forces RLS, grants authenticated clients SELECT only, and applies an `auth.uid() = user_id` owner policy. Client INSERT/UPDATE/DELETE privileges are intentionally absent; session writes and revocation are performed by the trusted API using the server-only service role.

Do not apply these migrations to production as part of this PR. Review migration history and schema drift first, take a backup, and obtain explicit production deployment approval.

## Authentication flow

### Registration
- Express validates and normalizes input.
- Supabase Auth creates an unconfirmed user and generates a one-time signup confirmation link.
- Express inserts the profile row keyed by the Auth UUID.
- Resend sends the confirmation link.
- Registration does not create an authenticated portal session until email confirmation and a subsequent login.

### Email verification
- Supabase Auth validates and consumes its one-time confirmation link.
- Supabase redirects to `/portal/verify-email?verified=1`.
- The client sees the confirmed state and proceeds to sign in.

### Login and session persistence
- Express authenticates credentials through Supabase Auth `signInWithPassword`.
- Unconfirmed accounts are rejected.
- Express creates a cryptographically random opaque portal session, stores only its SHA-256 hash in `portal_auth_sessions`, and sets the raw value in a Secure, HttpOnly cookie.
- The cookie is sent on API requests and survives browser refresh. The API checks expiry/revocation in PostgreSQL and reloads the Auth user before accepting the session.
- Logout and session revocation update the persistent session row.

## Verification matrix

| Requirement | Implementation / evidence |
|---|---|
| Real Supabase Auth account | Admin `generateLink(type: signup)` |
| PostgreSQL profile | `public.profiles` insert keyed by Auth UUID |
| Resend verification email | Existing `ResendEmailTransport` with idempotency key |
| Supabase password login | Per-request Auth client `signInWithPassword` |
| Persistent secure session | HttpOnly cookie + hashed session row in PostgreSQL |
| Duplicate email rejection | Profile pre-check plus Supabase Auth uniqueness; conflict mapped to HTTP 409 |
| Client row isolation | Profile and session RLS owner policies; client writes revoked |

## Verification limitations

CI unit/integration tests use the local test repository and cannot prove delivery to a real inbox or behavior of a specific hosted Supabase project's Auth settings. The new source-contract regression test checks that the production adapter, email transport, and RLS migration are wired as intended.

Before enabling public registration, run a staging acceptance test with two controlled email addresses:
- register account A and confirm a real Auth user plus profile row;
- receive and click the Resend email;
- log in and refresh the browser, confirming the session survives;
- verify duplicate registration is rejected;
- log in as account B and confirm account A's profile and session rows are not visible through the authenticated Data API;
- revoke/logout account A and verify its session is rejected.

The connected Supabase project inspected during this work currently reports no public tables and no migration history. No hosted schema or data was changed during this implementation.
