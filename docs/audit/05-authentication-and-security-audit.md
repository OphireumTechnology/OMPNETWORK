# 05 — Authentication, Authorization, and Security Audit

**Audited Codebase:** `main` (`e1f158b2`) + security cross-check against open PR #5 (`repair/security-and-runtime-hardening-20261123`) and PR #10 (`feature/customer-commerce-foundation`).  
**Scope:** Admin auth, customer auth readiness, RBAC, RLS, PostgREST query safety, CORS, CSRF/XSS, rate limiting, secret hygiene, webhook readiness, and AI endpoint abuse surfaces.

---

## 1. Security Posture Summary

| Control Area | Status on `main` | Status in PR #5 | Live Prod Status | Risk Level |
|---|---|---|---|---|
| Admin session principal binding (`sub` + `role`) | **VULNERABLE** (matches email only) | Fixed (`auth.ts`) | Vulnerable (PR #5 unmerged) | **P0** |
| PostgREST filter safety (`findActiveAdminByEmail`) | **VULNERABLE** (`.or()` interpolation + `ilike` wildcard) | Fixed (`.eq()`) | Vulnerable (PR #5 unmerged) | **P0** |
| Admin RLS (`is_ophireum_admin()`) | **VULNERABLE** (email fallback, no `REVOKE PUBLIC`) | Fixed (`20261124_uuid_bound_admin_rls.sql`) | Unverified live DB | **P0** |
| CORS Policy (`*.run.app` wildcard bypass) | **VULNERABLE** (`app.ts:207–209`) | **STILL VULNERABLE** | **VERIFIED LIVE VULNERABLE** | **P1** |
| Rate Limiting (`X-Forwarded-For` spoofing + unbounded Map) | **VULNERABLE** (`app.ts:81–104`) | Fixed (`req.ip` + bounded Map; still single-instance) | Vulnerable (PR #5 unmerged) | **P1** |
| `ADMIN_SESSION_SECRET` Enforcement | **VULNERABLE** (silent random ephemeral fallback) | Fixed (requires `>=32` chars for bootstrap login) | Unverified live env | **P1** |
| Browser Admin Token Storage & Revocation | **VULNERABLE** (`sessionStorage`, no logout/revocation) | **STILL VULNERABLE** | Vulnerable | **P1** |
| Secret Isolation in Frontend Bundle | **PASS** (0 secret hits; CI grep guard) | **PASS** | Pass (checked `dist/`) | Low |
| Security Response Headers | **PARTIAL** (HSTS, `nosniff`, `DENY`, Referrer, `Permissions-Policy`; **missing CSP**) | Same | Verified live (`payment=()` present!) | **P2** |
| Customer Auth & Commerce Isolation | **ABSENT** (`main`) / **UNSAFE** (PR #10 arbitrary amount insert) | N/A | N/A | **P0** |

---

## 2. Detailed Security Findings

### Finding `AUD-SEC-001`
- **Severity:** `P0`
- **Location:** `src/server/auth.ts:62–98`, `src/server/db/supabaseRepository.ts:563–608`, `supabase/schema.sql:24–40`
- **Evidence (Code-Level Observation):**
  1. **Unbound Admin Session Principal (`auth.ts:84–90`):** After verifying HMAC signature, `resolveAdminFromRequest` looks up `db.findActiveAdminByEmail(payload.email)` and returns the record without confirming `admin.id === payload.sub` or `admin.role === payload.role`. A demoted admin or rotated account retains stale token claims.
  2. **PostgREST Filter Interpolation & Wildcard Match (`supabaseRepository.ts:572`):** `query = query.or(\`auth_user_id.eq.${authUserId},email.ilike.${normalized}\`)` interpolates an email string directly into a PostgREST filter string and uses `ilike` (where `%` and `_` act as SQL wildcards) instead of exact `.eq()`.
  3. **Error-Swallowing Env Allowlist Fallback (`supabaseRepository.ts:589–606`):** If the DB query fails (`error` is truthy), execution silently falls through to `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_ALLOWLIST_EMAILS` and elevates the caller to `role: 'super_admin'`—even for a Supabase JWT lookup!
  4. **Email-Only RLS Fallback (`schema.sql:33–38`):** `is_ophireum_admin()` accepts `LOWER(au.email) = LOWER(auth.jwt() ->> 'email')` without requiring `auth.uid()` binding or email verification.
- **Business Impact:** Potential administrative account takeover or privilege escalation once customer Supabase Auth signups are enabled.
- **Technical Impact:** Broken authentication principal binding and query-filter injection surface.
- **Recommended Correction:** Merge PR #5's fixes immediately: bind `sub`, normalized `email`, `role`, and `isActive`; replace `.or()` with exact `.eq('auth_user_id', authUserId).eq('email', normalized)`; fail closed on DB errors (never fall back to env allowlist for Supabase JWTs); apply UUID-only `is_ophireum_admin()` migration after verifying admin UUIDs.
- **Required Test:** Regression tests verifying rejected mismatched `sub`/`role`, rejected `ilike` wildcard characters in email, rejected DB-error allowlist fallback, and Postgres RLS denial for non-UUID email match.
- **Dependencies:** PR #5 conflict resolution + live `admin_users.auth_user_id` verification.
- **Current Status:** Open on `main` (partially addressed in unmerged PR #5).

### Finding `AUD-SEC-002`
- **Severity:** `P1`
- **Location:** `src/server/app.ts:207–209` (present on **both `main` and PR #5**)
- **Evidence (Verified Fact):**
  - Source line `209`: `const isAllowed = configuredOrigins.includes(cleanOrigin) || cleanOrigin.endsWith('.run.app');`
  - **Live Production Verification:** Sending a read-only `OPTIONS` preflight to `https://api.ophireummultimedia.com/api/inquiries` with `Origin: https://untrusted-audit-check.run.app` returned `HTTP/2 204` and header `access-control-allow-origin: https://untrusted-audit-check.run.app`.
- **Business Impact:** Any third party deploying a free Google Cloud Run app (`https://*.run.app`) bypasses browser Same-Origin Policy against the production Ophireum API, allowing cross-origin API reads/writes (especially dangerous once authenticated customer cookies/sessions or payment endpoints are introduced).
- **Technical Impact:** Wildcard subdomain trust on a public multi-tenant PaaS domain (`run.app`).
- **Recommended Correction:** Remove `|| cleanOrigin.endsWith('.run.app')` unconditionally in production. Allow ONLY exact origins explicitly listed in `ALLOWED_ORIGINS` (e.g., `https://ophireummultimedia.com`, `https://www.ophireummultimedia.com`, and explicitly pinned preview URLs in non-production environments only).
- **Required Test:** Automated CORS test asserting `Origin: https://untrusted-audit-check.run.app` receives NO `Access-Control-Allow-Origin` header and `403` on preflight.
- **Dependencies:** None.
- **Current Status:** **Active in Production** (unfixed in both `main` and PR #5).

### Finding `AUD-SEC-003`
- **Severity:** `P1`
- **Location:** `src/server/app.ts:81–104` (Rate Limiter), `src/components/EnterpriseModal.tsx:43,152,170` (Token Storage), `src/server/auth.ts:24–55` (Session Lifecycle)
- **Evidence (Code-Level Observation):**
  1. **Spoofable Rate-Limit Key (`main` `app.ts:98–103`):** `getClientIp` extracts the leftmost `X-Forwarded-For` IP, allowing any client to rotate spoofed headers and completely bypass brute-force protection on `/api/admin/auth/login` and quota protection on `/api/consultant/chat` and `/api/voice/transcribe` (which accepts `10mb` JSON!). (PR #5 fixes `getClientIp` and bounds the Map, but remains process-local in-memory only.)
  2. **Admin Token in `sessionStorage` + No Revocation (`EnterpriseModal.tsx:43,152`):** Admin JWT/HMAC token is readable by any JavaScript (XSS target). Logout only clears React state; there is no `/api/admin/auth/logout` endpoint, no server-side session ID (`jti`) revocation store, and compromised tokens remain valid for up to 60 minutes.
  3. **Ephemeral Signing Secret Fallback (`main` `auth.ts:24–27`):** Silently generates random bytes if `ADMIN_SESSION_SECRET` is missing.
- **Business Impact:** Brute-force admin login attempts, AI API billing exhaustion, and inability to revoke compromised admin sessions.
- **Technical Impact:** Weak session lifecycle and process-local rate limiting incompatible with multi-replica Railway scaling.
- **Recommended Correction:** Merge PR #5's `req.ip` and secret enforcement fixes; move to Redis/Upstash-backed rate limiting before scaling >1 replica; migrate admin/customer sessions to server-validated short-lived tokens or `HttpOnly; Secure; SameSite=Lax` cookies with server-side session revocation (`jti` / refresh token rotation) and explicit `POST /api/admin/auth/logout`.
- **Required Test:** Spoofed `X-Forwarded-For` rate-limit enforcement test; revoked-token `401` test after logout.
- **Dependencies:** PR #5 + Redis or Postgres session revocation table.
- **Current Status:** Open.

### Finding `AUD-SEC-004`
- **Severity:** `P1`
- **Location:** `src/server/app.ts:942–1280` (Public AI & Voice Endpoints)
- **Evidence (Code-Level Observation):** `/api/consultant/chat`, `/api/voice/session`, `/api/voice/process`, and `/api/voice/transcribe` (`10mb` JSON limit) require zero authentication or CAPTCHA/bot protection. Live production `/api/health` confirms `gemini.configured: true`.
- **Business Impact:** Attackers can trigger large audio/text payloads repeatedly to drain Ophireum's Google GenAI billing quota or cause Node.js heap pressure via concurrent 10 MB base64 uploads.
- **Technical Impact:** Unbounded external API cost and DoS amplification surface.
- **Recommended Correction:** Lower `/api/voice/transcribe` JSON payload cap (e.g., `2mb` for short voice clips), enforce strict per-IP + global circuit-breaker rate limits (daily/hourly token budget cap), and add Turnstile/hCaptcha or authenticated session gating for heavy voice features.
- **Required Test:** Oversized payload (`413`) and rate-limit (`429`) automated tests.
- **Dependencies:** Shared rate-limiter store.
- **Current Status:** Open.

### Finding `AUD-SEC-005`
- **Severity:** `P2`
- **Location:** `src/server/app.ts:189–201` (Security Headers) & `index.html`
- **Evidence (Verified Fact + Code-Level Observation):**
  - Live Railway headers include HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), geolocation=(), payment=()`.
  - **Missing:** `Content-Security-Policy` (CSP) header on both GitHub Pages frontend (`<meta http-equiv="Content-Security-Policy">` or CDN edge headers) and API (`default-src 'none'; frame-ancestors 'none'`).
  - **Commerce Note:** `Permissions-Policy` currently emits `payment=()`, which explicitly disables the browser Payment Request API if ever used on same-origin responses (hosted checkout redirects to Xendit/PayPal/Maya are unaffected, but note before enabling embedded payment elements).
- **Business Impact:** Reduced defense-in-depth against XSS exfiltration of customer/admin sessions and clickjacking on static pages.
- **Technical Impact:** Missing CSP enforcement.
- **Recommended Correction:** Add strict API CSP (`default-src 'none'; frame-ancestors 'none'`) and frontend CSP permitting only self, Google Fonts, Supabase project origin, `api.ophireummultimedia.com`, and explicitly allowlisted payment SDK domains once approved.
- **Required Test:** Automated header assertion tests + staging CSP violation report check.
- **Dependencies:** Approved payment gateway domain list.
- **Current Status:** Open.

### Finding `AUD-SEC-006`
- **Severity:** `P2`
- **Location:** `src/components/Footer.tsx:189–191`, `public/images/dti-business-registration.png`, `supabase/schema.sql:220–230` (`consent_records`)
- **Evidence (Code-Level Observation):**
  - "Privacy Policy" and "Terms of Use" in `Footer.tsx:189–191` are static `<span>` tags (no links, no legal documents).
  - `consent_records` table exists in `schema.sql` but is never written to during inquiry submission, consultation booking, or signup.
  - DTI Business Registration Certificate PNG is publicly served without documented redaction review for personal data fields.
- **Business Impact:** Non-compliance risk with the **Philippine Data Privacy Act of 2012 (RA 10173)**, **Internet Transactions Act of 2023 (RA 11967)**, and **Consumer Act (RA 7394)** once customer accounts and payments launch.
- **Technical Impact:** No versioned consent proof stored per customer/order.
- **Recommended Correction:** Publish legal pages (Privacy Policy, Terms of Service preserving statutory consumer remedies under RA 7394 / RA 11967, Refund & Dispute Policy, Cookie Notice), capture versioned consent in `consent_records` on registration and checkout, and complete owner legal review of DTI certificate imagery.
- **Required Test:** E2E test verifying registration/checkout fails unless privacy/terms consent version is accepted and recorded in `consent_records`.
- **Dependencies:** Legal copy sign-off by Ophireum counsel/owner.
- **Current Status:** Open.
