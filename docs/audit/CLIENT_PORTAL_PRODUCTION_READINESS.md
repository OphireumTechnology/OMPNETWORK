# Ophireum Multimedia Client Portal — Independent Security Audit & Production Readiness Verification

**Audit Date:** 2026-11-24  
**Scope:** Full independent code-level, security, database, payment, integration, and production-readiness audit of the Ophireum Multimedia Client Portal (`OMPNETWORK`, `/portal/*`, `#/portal/*`, `/api/portal/*`, `supabase/migrations/002_client_portal_commerce.sql`, `docs/PORTAL_DEPLOYMENT_GUIDE.md`).  
**Audited Codebase:** Workspace snapshot of `OMPNETWORK` (React 19, TypeScript, Vite 8, Express 4, Supabase PostgreSQL, Railway + GitHub Pages architecture).  
**Production Safety Compliance:** Zero changes were made to the public homepage or public website functionality; no deployment was executed; no SQL migration was run against production; no live payment provider was enabled; no production secrets were exposed.

---

## Section A — Executive Summary

An independent, line-by-line audit was conducted across the Client Portal frontend (`src/portal/**`), Express backend (`src/server/portal/**`, `src/server/app.ts`), Supabase SQL migration (`supabase/migrations/002_client_portal_commerce.sql`), CI/CD workflows (`.github/workflows/deploy-pages.yml`), deployment documentation (`docs/PORTAL_DEPLOYMENT_GUIDE.md`), and automated test suite (`tests/**`).

### Key Headline Findings
1. **Critical Production Blocker — Incomplete Supabase Persistence (`F-01`, CRITICAL, Unresolved):** `src/server/portal/supabasePortalRepository.ts` extends `LocalPortalRepository({ persistDir: null })` and overrides **only** read-only catalog queries (`listCategories`, `listProducts`, `getProductBySlug`). All client users, sessions, profiles, carts, orders, payments, webhook events, invoices, credit wallets, credit ledger entries, subscriptions, projects, messages, attachments, and support tickets are stored strictly in volatile process memory (or local `.portal-data/` JSON when Supabase vars are absent) and are lost on Railway restarts/redeploys. Until full Supabase PostgreSQL, Supabase Auth, and Supabase Storage write persistence is implemented and verified against a staging Supabase project, the Client Portal is **NOT READY** for production deployment.
2. **In-Scope Security Defects Identified & Remediated (`F-02` through `F-10`):** During this audit, nine concrete security and correctness defects were verified in actual source code and fixed with automated regression tests:
   - **F-02 (High — Fixed):** Unescaped HTML interpolation in downloaded invoice HTML receipts (`src/portal/pages/OrdersAndFinancePages.tsx`) allowing script injection via client-editable billing fields. Fixed with strict `escapeHtml()` encoding and an embedded `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';` meta tag.
   - **F-03 (High — Fixed):** Webhook verifier in `src/server/portal/payments/paymentAdapters.ts` accepted raw secret strings in HMAC signature headers (`|| constantTimeEquals(provided, secret)`), allowing payload integrity bypass. Separated `'hmac_sha256'` (6 providers) from `'static_token'` (Xendit `x-callback-token` only).
   - **F-04 (High — Fixed):** Payment webhook state machine bugs in `src/server/portal/localPortalRepository.ts`: paying Order A activated ALL pending subscriptions for the same user (even unpaid subscriptions from Order B); cancelled/refunded orders could transition back to `paid`; failed payments never released `wallet.pendingCredits`; duplicate `providerTransactionId` values across different orders were not rejected. All four defects fixed and covered by regression tests.
   - **F-05 (High — Fixed):** Client session bearer tokens were stored in `window.localStorage` (`opm_portal_session_token`). Replaced with JS in-memory token storage plus server-issued `HttpOnly; Secure; SameSite=None; Partitioned` session cookies (`opm_portal_session`) with CSRF validation (`X-Requested-With` / allowlisted `Origin`) on cookie-authenticated state-changing requests.
   - **F-06 (High — Fixed):** Missing cross-client ownership validation for `attachmentIds`, `referenceFileIds`, `supportingFileIds`, `relatedOrderId`, and `relatedProjectId` on messages, revisions, checkout, custom inquiries, credit redemption, and support tickets; added explicit `path.resolve` directory confinement checks in attachment storage and `isInternal` filtering on project messages.
   - **F-07 (High — Fixed):** Missing expiration timestamps on email verification tokens (now 24h) and email-change tokens (now 1h); `POST /security/change-password` did not revoke other active sessions (now calls `revokeOtherUserSessions`); production `PORTAL_SIGNING_SECRET` check now fails safely (`503`) if unconfigured in production instead of silently signing with an ephemeral per-process secret.
   - **F-08 (Medium/High — Fixed in SQL):** Hardened `supabase/migrations/002_client_portal_commerce.sql` with `SET search_path = public, pg_temp` on trigger functions, idempotent `DROP POLICY IF EXISTS`, explicit `REVOKE ALL` / `GRANT SELECT` table privileges (blocking `authenticated` access to `payment_webhook_events`), `invoices` immutability trigger, `payment_webhook_events` no-delete trigger, PostgreSQL sequences (`portal_order_seq`, `portal_invoice_seq`), `subscriptions.order_id` + `inclusions`, `project_messages.is_internal` RLS filter, and `storage.objects` private bucket owner-folder RLS policy.
   - **F-09 (Medium — Fixed):** Restricted wildcard `*.run.app` CORS matching in `src/server/app.ts` to `NODE_ENV !== 'production'`, added `Access-Control-Allow-Credentials: true` for explicitly allowlisted origins, exposed accurate `portalPersistence` status on `/api/health`, and expanded `.github/workflows/deploy-pages.yml` bundle secret scanning to cover all portal and payment secret variable names.
   - **F-10 (Low/Medium — Fixed):** Hardened login `?next=` redirect guard against `//` and `://`, wired Dashboard Quick Actions `?new=1` query params to auto-open Create Project and New Ticket modals, and corrected minor inaccuracies in `docs/PORTAL_DEPLOYMENT_GUIDE.md`.
3. **Environment & Verification Limitations (Reported Honestly):**
   - **No `.git` Repository in Sandbox:** Running `git status` returned `fatal: not a git repository`. Therefore, creating branch `audit/phase2-portal-production-readiness` and opening a GitHub pull request could not be performed from this workspace and must be executed by the repository operator from a Git checkout.
   - **No Live Staging Supabase Instance Connected:** SQL syntax, RLS policies, grants, triggers, and constraints in `002_client_portal_commerce.sql` were audited statically, but live PostgreSQL execution and JWT-scoped RLS integration tests remain `NOT VERIFIED` until run against a staging Supabase database.

---

## Section B — Feature Verification Matrix

| Reported Feature | Status | Verified Code Location(s) | Notes & Evidence |
| :--- | :--- | :--- | :--- |
| Public website preservation (`/`) | **VERIFIED** | `src/App.tsx`, `src/components/*`, `src/index.css` | Public homepage renders identically; portal is lazily loaded only on `/portal/*` or `#/portal/*`; single link inside `EnterpriseModal.tsx`. |
| `/portal/*` & `#/portal/*` static fallback routing | **VERIFIED** | `src/App.tsx`, `src/portal/PortalRouter.tsx`, `src/portal/ClientPortalApp.tsx` | Supports both pathname `/portal/*` and hash `#/portal/*` fallback for GitHub Pages static hosting. |
| Client registration & password hashing | **VERIFIED** | `src/server/portal/portalRoutes.ts:282-352`, `src/portal/pages/AuthPages.tsx` | `crypto.scryptSync` + 16-byte random salt + `crypto.timingSafeEqual`; rate-limited (30 req / 15 min per IP). |
| Email verification with expiry | **VERIFIED** | `src/server/portal/portalRoutes.ts:400-432`, `localPortalRepository.ts:272-298` | SHA-256 hashed tokens; 24-hour expiration added and verified in Phase 2 audit. |
| Revocable sessions & `HttpOnly` cookie auth | **VERIFIED** | `src/server/portal/portalRoutes.ts:126-245`, `src/portal/portalApi.ts` | SHA-256 hashed session tokens; `HttpOnly; Secure; SameSite=None; Partitioned` cookie + in-memory bearer token; CSRF check enforced on cookie writes; zero `localStorage` tokens. |
| Password recovery & reset | **VERIFIED** | `src/server/portal/portalRoutes.ts:433-474`, `localPortalRepository.ts:297-320` | Uniform non-enumerating response; 1-hour expiry; revokes all active sessions upon reset. |
| Sensitive-action reauthentication | **VERIFIED** | `src/server/portal/portalRoutes.ts:1503-1575` | Current password verified before password change (now revokes other sessions), email change (1h expiry), and account closure request. |
| 7-category Service Store | **VERIFIED** | `src/server/portal/catalogSeed.ts`, `src/portal/pages/StoreAndCartPages.tsx` | 7 categories seeded, search/category filtering, product detail & package selector, Custom Enterprise Inquiry workflow. |
| Server-authoritative USD / PHP pricing | **VERIFIED** | `src/server/portal/portalRoutes.ts:187-276, 879-937` | Cart and checkout recompute all line items, discounts, tax, and totals strictly from server catalog; client-tampered totals/statuses ignored (tested). |
| Shopping cart (save-for-later, currency, promo) | **VERIFIED** | `src/server/portal/portalRoutes.ts:718-822`, `src/portal/pages/StoreAndCartPages.tsx` | Quantity capped (1–25), custom-quote packages blocked from cart, server-validated discount codes. |
| Five-step guided checkout & idempotency | **VERIFIED** | `src/portal/pages/CheckoutPage.tsx`, `src/server/portal/portalRoutes.ts:833-963` | 5 steps (Review, Billing, Project Requirements, Payment Method, Confirmation); `Idempotency-Key` deduplication verified. |
| Order tracking & cancellation | **VERIFIED** | `src/server/portal/portalRoutes.ts:965-1004`, `src/portal/pages/OrdersAndFinancePages.tsx` | Owner-scoped reads; unpaid/pending cancellation releases pending credits; paid cancellation logs ops request. |
| Sequential printable invoices | **VERIFIED** | `src/server/portal/localPortalRepository.ts:635-679`, `OrdersAndFinancePages.tsx:777-818` | Sequential `OPM-INV-YYYY-#####`; HTML export hardened against XSS (`escapeHtml` + CSP) in Phase 2 audit. |
| Append-only credit wallet & ledger | **VERIFIED** | `src/server/portal/localPortalRepository.ts:998-1071`, `002_client_portal_commerce.sql` | No client top-up endpoint; overdraft blocked; idempotent allocations/redemptions; SQL `BEFORE UPDATE OR DELETE` immutability trigger. |
| Subscriptions | **VERIFIED** | `src/server/portal/localPortalRepository.ts:701-720, 924-931`, `OrdersAndFinancePages.tsx` | Pending subscriptions now bound strictly to `orderId` so paying one order cannot activate another unpaid subscription. |
| 10-stage project workspaces & discussions | **VERIFIED** | `src/server/portal/localPortalRepository.ts:80-91, 1099-1276`, `ProjectsAndFilesPages.tsx` | 10 sequential milestones; internal notes filtered (`!m.isInternal`); cross-client attachment IDs blocked (`403`). |
| Deliverables & revision quota enforcement | **VERIFIED** | `src/server/portal/localPortalRepository.ts:1278-1362`, `portalRoutes.ts:1183-1225` | Revision limit strictly enforced server-side without charging credits; approval history recorded. |
| Private signed file uploads & downloads | **PARTIALLY VERIFIED** | `src/server/portal/portalRoutes.ts:568-591, 1228-1325`, `localPortalRepository.ts:1365-1416` | Extension/MIME allowlist, 15 MB cap, path confinement, 5-minute HMAC signed download URLs, `attachment` disposition + `nosniff` verified locally. **Supabase Storage upload/signed URL integration is NOT IMPLEMENTED yet (`F-01`).** |
| Support tickets & notifications | **VERIFIED** | `src/server/portal/portalRoutes.ts:1328-1406`, `SupportAccountPages.tsx` | 9 support categories, ticket threads, ownership validation on linked order/project/files, `?new=1` quick action wired. |
| Client profile & security settings | **VERIFIED** | `src/server/portal/portalRoutes.ts:1409-1575`, `SupportAccountPages.tsx` | Profile, addresses, notification preferences, active session list/revocation, password/email/closure flows. |
| Scoped read-only portal assistant | **VERIFIED** | `src/server/portal/portalRoutes.ts:1572-1620`, `SupportAccountPages.tsx` | Strictly deterministic read-only queries scoped to `req.portalUser.id`; zero mutation tools; immune to prompt injection (tested). |
| 27-table Supabase SQL migration & RLS | **PARTIALLY VERIFIED** | `supabase/migrations/002_client_portal_commerce.sql` | All 27 tables, indexes, RLS policies, grants, triggers, sequences, and storage bucket policies statically audited & hardened. **Live staging PostgreSQL execution is `NOT VERIFIED`.** |
| Supabase PostgreSQL production persistence | **FAILED / NOT IMPLEMENTED** | `src/server/portal/supabasePortalRepository.ts` | Only overrides 3 catalog read methods; all writes remain in-memory (`LocalPortalRepository({ persistDir: null })`). **Blocks production readiness (`F-01`).** |
| 7 disabled / sandbox-gated payment adapters | **VERIFIED** | `src/server/portal/payments/paymentAdapters.ts` | All 7 default to `disabled`; live mode never auto-enabled; strict HMAC-SHA256 verified (6 providers) + static token (Xendit); deferred providers blocked in production. |
| Automated security & integration tests | **VERIFIED** | `tests/client-portal.test.ts`, `tests/phase1-stabilization.test.ts`, `tests/deployment-integration.test.ts` | Original 14/14 verified; expanded to **18/18 passing** with Phase 2 security regression tests. |

---

## Section C — Public Website Preservation Verification

- **Files Verified Unchanged:** `src/components/Header.tsx`, `src/components/Hero.tsx`, `src/components/AboutSection.tsx`, `src/components/ServicesSection.tsx`, `src/components/PortfolioSection.tsx`, `src/components/EnterpriseSuiteSection.tsx`, `src/components/ContactSection.tsx`, `src/components/Footer.tsx`, `src/index.css`.
- **Routing Isolation (`src/App.tsx`):** `isPortalPath(pathname, hash)` checks strictly for `/portal` prefix or `#/portal` hash prefix. All other paths render the existing public website unaltered.
- **Lazy Code Splitting (`dist/assets/`):** Vite emits `ClientPortalApp-*.js` (290.81 kB raw / 45.17 kB gzip) as a separate lazy chunk so public homepage visitors do not pay the portal JavaScript parse cost unless they open the portal.
- **Public Entry Point:** A single non-intrusive navigation option inside `EnterpriseModal.tsx` routes users to `/portal/login`, preserving the homepage hero, navigation bar, and existing lead-capture flows.
- **Existing API & Admin Routes:** All legacy `/api/inquiries`, `/api/appointments`, `/api/consultant/*`, `/api/voice/transcribe`, and `/api/admin/*` endpoints remain intact; all 10 pre-existing Phase 1 and deployment integration tests continue to pass (`10/10`).

---

## Section D — Database Schema & Row Level Security (RLS) Audit

### Static Audit of `supabase/migrations/002_client_portal_commerce.sql`
- **Table Count Verified:** **27** new tables, cleanly isolated from legacy Phase 1 tables (`inquiries`, `appointments`, `audit_logs`, `admin_*`). No destructive `DROP TABLE` or `ALTER` statements on legacy tables.
- **Complete 27-Table Inventory & RLS Verification:**

| # | Table Name | RLS Enabled | Client Policy Scope (`authenticated`) | Notes / Phase 2 Hardening |
| :-: | :--- | :-: | :--- | :--- |
| 1 | `public.profiles` | Yes | `SELECT`, `UPDATE` own row (`auth.uid() = user_id`) | Trigger `trg_profiles_updated_at` |
| 2 | `public.client_addresses` | Yes | `SELECT`, `INSERT`, `UPDATE`, `DELETE` own rows | Trigger `trg_client_addresses_updated_at` |
| 3 | `public.product_categories` | Yes | `SELECT` active rows (`is_active = TRUE`) | Read-only catalog |
| 4 | `public.products` | Yes | `SELECT` active rows (`is_active = TRUE`) | Read-only catalog |
| 5 | `public.product_packages` | Yes | `SELECT` active rows (`is_active = TRUE`) | Read-only catalog |
| 6 | `public.product_features` | Yes | `SELECT` all rows | Read-only catalog |
| 7 | `public.shopping_carts` | Yes | `ALL` own rows (`auth.uid() = user_id`) | Server recomputes pricing |
| 8 | `public.cart_items` | Yes | `ALL` via owned `cart_id` subquery | Quantity `CHECK (quantity > 0 AND quantity <= 25)` |
| 9 | `public.orders` | Yes | `SELECT` own rows only (server-only writes) | Added `portal_order_seq` sequence |
| 10 | `public.order_items` | Yes | `SELECT` via owned `order_id` subquery | Server-only writes |
| 11 | `public.payments` | Yes | `SELECT` own rows only (server-only writes) | Unique `(provider, provider_transaction_id)` partial index |
| 12 | `public.payment_webhook_events` | Yes | **NO `authenticated` policy / REVOKE ALL** | Service-role only; added `trg_payment_webhooks_no_delete` |
| 13 | `public.invoices` | Yes | `SELECT` own rows only (server-only writes) | Added `portal_invoice_seq` + `trg_invoices_no_tamper` |
| 14 | `public.credit_wallets` | Yes | `SELECT` own row only (server-only writes) | `CHECK (available_credits >= 0)` |
| 15 | `public.credit_transactions` | Yes | `SELECT` own rows only (server-only writes) | Append-only via `trg_credit_transactions_immutable` |
| 16 | `public.subscriptions` | Yes | `SELECT` own rows only (server-only writes) | Added `order_id` FK & `inclusions JSONB` |
| 17 | `public.subscription_transactions` | Yes | `SELECT` own rows only | Server-only writes |
| 18 | `public.projects` | Yes | `SELECT` own rows only | `CHECK (revisions_used <= revision_limit)` |
| 19 | `public.project_milestones` | Yes | `SELECT` via owned `project_id` subquery | 10-stage workflow |
| 20 | `public.project_messages` | Yes | `SELECT` own non-internal (`is_internal = FALSE`) | Added `is_internal` column & RLS filter |
| 21 | `public.project_attachments` | Yes | `SELECT` own rows only | Private bucket `portal-private-files` |
| 22 | `public.project_deliverables` | Yes | `SELECT` own rows only | Approval timestamp tracked |
| 23 | `public.revision_requests` | Yes | `SELECT` own rows only | Linked to `projects` |
| 24 | `public.support_tickets` | Yes | `SELECT` own rows only | 9 validated categories |
| 25 | `public.support_messages` | Yes | `SELECT` via owned `ticket_id` subquery | Linked to `support_tickets` |
| 26 | `public.notifications` | Yes | `SELECT`, `UPDATE` own rows (`auth.uid() = user_id`) | Read-status updates |
| 27 | `public.client_activity_logs` | Yes | `SELECT` own rows only | Append-only activity history |

### Storage & Function Hardening Applied in `002_client_portal_commerce.sql`
- Added `SET search_path = public, pg_temp` to `set_portal_updated_at()`, `prevent_immutable_mutation()`, and `prevent_invoice_tampering()`.
- Added `DROP POLICY IF EXISTS` before every `CREATE POLICY` so re-running the migration on staging is idempotent.
- Added explicit `REVOKE ALL` from `PUBLIC, anon, authenticated` across all 27 tables followed by least-privilege `GRANT` statements (`service_role` gets full access; `authenticated` gets zero grants on `payment_webhook_events`).
- Added private bucket `storage.objects` RLS policy (`portal_private_files_owner_select`) restricting object reads in `portal-private-files` strictly to `(storage.foldername(name))[1] = auth.uid()::text`.
- **Live Staging Verification Status:** `NOT VERIFIED` (no live staging Supabase PostgreSQL instance is attached to this audit environment).

---

## Section E — Authentication, Session & Access Control Audit

| Control | Implementation & Verification | Audit Result |
| :--- | :--- | :--- |
| Password hashing | `crypto.scryptSync(password, randomSalt16B, 64)` + `crypto.timingSafeEqual` | **PASS** |
| Session token storage (server) | SHA-256 hash stored in session record; raw token never persisted | **PASS** |
| Session token storage (browser) | **Remediated (`F-05`):** Removed `localStorage`; token kept in JS memory + `HttpOnly; Secure; SameSite=None; Partitioned` cookie (`opm_portal_session`) | **PASS** |
| CSRF protection on cookies | **Remediated (`F-05`):** Cookie-authenticated `POST`/`PATCH`/`PUT`/`DELETE` require `X-Requested-With` or allowlisted `Origin` (`403 CSRF_CHECK_FAILED` verified in test) | **PASS** |
| Verification & email-change tokens | **Remediated (`F-07`):** 24h expiry on verification tokens; 1h expiry on email-change tokens; single-use clearing on success | **PASS** |
| Password reset & change | Reset revokes all sessions; password change now revokes all other sessions while preserving current session (`F-07`) | **PASS** |
| Rate limiting | Bounded in-memory rate limiters (30 req / 15 min on auth; 120 req / 15 min on checkout/upload) | **PASS (Single-Instance)** — Recommend Redis/Upstash if scaled horizontally |
| Multi-client IDOR isolation | All routes scope strictly to `req.portalUser.id`; **Remediated (`F-06`):** `attachmentIds`, `referenceFileIds`, `supportingFileIds`, `relatedOrderId`, and `relatedProjectId` ownership validated (`403` tested) | **PASS** |
| Login open-redirect guard | **Remediated (`F-10`):** Rejects `//` and `://` in `?next=` query parameter | **PASS** |

---

## Section F — Commerce, Pricing & Checkout Security Audit

- **Server-Authoritative Pricing:** Verified `computeCartSummary()` and `POST /api/portal/checkout` ignore client-supplied `totalMinor`, `unitPriceMinor`, `paymentStatus`, and `creditsAllocated`. Tampered checkout payloads produce orders with exact server catalog prices and `paymentStatus: 'pending'`.
- **Currency & Discount Integrity:** Only `'USD'` and `'PHP'` accepted; FX conversion uses server-side `USD_TO_PHP_REFERENCE_RATE`; promo codes validated server-side against expiry and minimum subtotal; discount clamped to `<= subtotalMinor`.
- **Idempotency:** `Idempotency-Key` header prevents duplicate order creation on network retries (returns `200` with `deduplicated: true` and the original order/invoice/payment).
- **Custom Quotation Enforcement:** Packages marked `isCustomQuote: true` are rejected by `POST /api/portal/cart/items` (`400`) and routed through `/custom-inquiries`.
- **Follow-up Note (Informational):** `POST /api/portal/credits/redeem` validates integer `creditsCost > 0`, blocks negative balances/overdrafts, and supports idempotency keys, but accepts client-supplied `creditsCost` (debit-only). Before launching credit-based self-service redemptions in production, bind `POST /credits/redeem` to server-side service tariff IDs so clients cannot choose arbitrary debit amounts.

---

## Section G — Payment Provider Adapters & Webhook Audit

All 7 adapters in `src/server/portal/payments/paymentAdapters.ts` were verified line by line:

| Provider | Adapter ID | Default Mode | Deferred Flag | Signature Verification Scheme | Production Status |
| :--- | :--- | :--- | :-: | :--- | :--- |
| Credit Card (Hosted) | `credit_card` | `disabled` | No | `HMAC-SHA256(rawBody, CARD_GATEWAY_WEBHOOK_SECRET_TEST)` (`x-card-signature`) | Disabled |
| Debit Card (Hosted) | `debit_card` | `disabled` | No | `HMAC-SHA256(rawBody, CARD_GATEWAY_WEBHOOK_SECRET_TEST)` (`x-card-signature`) | Disabled |
| PayPal | `paypal` | `disabled` | No | `HMAC-SHA256(rawBody, PAYPAL_WEBHOOK_SECRET_SANDBOX)` (`paypal-transmission-sig`) | Disabled |
| Xendit | `xendit` | `disabled` | No | Constant-time static callback token (`x-callback-token`) | Disabled |
| Maya | `maya` | `disabled` | No | `HMAC-SHA256(rawBody, MAYA_WEBHOOK_SECRET_TEST)` (`x-maya-signature`) | Disabled |
| PayMongo | `paymongo` | `disabled` | **Yes** | `HMAC-SHA256(rawBody, PAYMONGO_WEBHOOK_SECRET_TEST)` (`paymongo-signature`) | Disabled + Blocked in Prod (`503`) |
| GoTyme | `gotyme` | `disabled` | **Yes** | `HMAC-SHA256(rawBody, GOTYME_WEBHOOK_SECRET_TEST)` (`x-gotyme-signature`) | Disabled + Blocked in Prod (`503`) |

### Remediations Verified in Phase 2
1. **Raw-Secret Bypass Removed (`F-03`):** HMAC-SHA256 providers no longer accept the raw webhook secret in the signature header; verified via automated test (`401`).
2. **Raw Body Capture Verified:** `src/server/app.ts:263-267` captures `req.rawBody` via `express.json({ verify })` specifically on `/api/portal/webhooks/*` so HMAC verification runs against the exact wire bytes.
3. **Strict State Machine & Replay Safety (`F-04`):**
   - Duplicate `(provider, providerEventId)` deduplicated cleanly (`creditsAllocated: 0`).
   - Duplicate `providerTransactionId` across different orders rejected (`422`).
   - Amount or currency mismatch against server `order.totalMinor`/`order.currency` rejected (`422`).
   - `paid` and `failed` transitions permitted ONLY from `unpaid`/`pending`/`processing`; `refunded` permitted ONLY from `paid` (`422` on illegal transitions).
   - `failed` webhook releases `wallet.pendingCredits` cleanly.
   - `paid` webhook activates ONLY pending subscriptions where `sub.orderId === order.id`.
4. **Deferred Gateways Guarded:** In `NODE_ENV=production`, `paymongo` and `gotyme` webhooks return `503` while marked `deferred: true`.

---

## Section H — Credit Wallet, Ledger & Invoice Integrity Audit

- **Zero Client Credit Inflation:** No client endpoint can credit a wallet; credits move from `pendingCredits` to `availableCredits` strictly via verified server payment webhooks using deterministic idempotency key `credit-alloc:${order.id}`.
- **Overdraft Protection:** `applyCreditLedgerEntry()` enforces `nextBalance >= 0` and integer non-zero deltas; SQL enforces `CHECK (available_credits >= 0)` and `BEFORE UPDATE OR DELETE` immutability on `credit_transactions`.
- **Invoice Integrity & XSS Defense (`F-02`):**
  - SQL migration now includes `trg_invoices_no_tamper` preventing `DELETE` and historical financial field edits while allowing legitimate `payment_status` transitions, plus `portal_invoice_seq` for collision-free numbering.
  - Client-side `downloadInvoiceHtml()` now escapes every interpolated field with `escapeHtml()`, sanitizes the download filename, and embeds `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">`.

---

## Section I — Projects, Messaging, Deliverables & Revision Audit

- **10-Stage Milestone Model:** Verified exact 10-stage progression (`order_confirmed` through `project_completed`).
- **Internal Staff Note Isolation (`F-06`):** Added `isInternal` flag to `ProjectMessageRecord` and `is_internal BOOLEAN NOT NULL DEFAULT FALSE` + RLS filter to `public.project_messages`; both `getProjectDetail()` and `listAllUserMessages()` exclude internal notes.
- **Attachment Reference Ownership (`F-06`):** Clients can no longer attach another client's file UUID to project messages or revision requests (`403`).
- **Revision Allowance Enforcement:** Verified server-side enforcement (`project.revisionsUsed >= project.revisionLimit` returns `400` without deducting credits).

---

## Section J — Private File Storage & Signed Download Audit

- **Upload Validation:** Extension allowlist (`jpg, jpeg, png, webp, mp4, mov, pdf, docx, xlsx, pptx, zip`), MIME allowlist, 15 MB binary limit (22 MB JSON route limit solely on `/files/upload`; global routes stay at 100 KB), filename sanitization (`[/\\]` stripped).
- **Path Traversal Confinement (`F-06`):** `saveAttachment()` and `getAttachmentById()` now enforce `path.basename` plus `path.resolve(baseDir, safeName).startsWith(baseDir + path.sep)`.
- **Expiring Signed Links & Safe Headers:** 5-minute HMAC-SHA256 signed URLs (`uid`, `exp`, `sig`), `crypto.timingSafeEqual` verification, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.
- **Production Secret Guard (`F-07`):** If `NODE_ENV === 'production'` and no 32+ character `PORTAL_SIGNING_SECRET` (or fallback `ADMIN_SESSION_SECRET`) is configured, signing/verifying download links fails closed (`503`/`403`) rather than using an ephemeral secret.
- **Unresolved Production Gap (`F-01`):** Binary files are currently stored in local filesystem (`.portal-data/files`) or process memory — **not** in Supabase Storage bucket `portal-private-files`. Railway container disks are ephemeral, so uploaded files would be lost on redeploy until `SupabasePortalRepository` integrates Supabase Storage.

---

## Section K — Support Tickets, Notifications & Scoped AI Assistant Audit

- **Support Tickets:** 9 categories enforced; ownership of `attachmentIds`, `relatedOrderId`, and `relatedProjectId` strictly validated (`403` on cross-client IDs). Dashboard quick action `/portal/support?new=1` now opens the ticket creation modal automatically.
- **Notifications:** Owner-scoped read and mark-all-read endpoints verified.
- **Scoped Read-Only Portal Assistant (`/api/portal/assistant/ask`):**
  - Reads strictly `listOrders(userId)`, `listProjects(userId)`, `getWallet(userId)`, and `listAttachments(userId)` for `req.portalUser.id`.
  - Contains zero write/mutation pathways and zero external LLM tool calls.
  - Automated prompt-injection test confirms attempting to credit wallet or mark orders paid leaves wallet and order state completely unchanged.

---

## Section L — Environment Variables, Deployment & CI/CD Security Audit

### Complete Environment Variable Inventory
| Variable | Scope | Secret? | Default / Fallback Behavior | Status |
| :--- | :--- | :-: | :--- | :--- |
| `SUPABASE_URL` | Server | No | Falls back to `LocalPortalRepository` if unset | Verified |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | **Yes** | Never bundled into `dist/` (CI checked) | Verified |
| `PORTAL_SIGNING_SECRET` | Server | **Yes** | Fails closed (`503`) in production if `< 32` chars | Hardened (`F-07`) |
| `ADMIN_SESSION_SECRET` | Server | **Yes** | Existing admin session secret | Verified |
| `ALLOWED_ORIGINS` | Server | No | Explicit production origins; `.run.app` now dev-only | Hardened (`F-09`) |
| `APP_BASE_URL` | Server | No | Public API base URL | Verified |
| `RESEND_API_KEY` / `EMAIL_FROM` | Server | **Yes** | Transactional email (graceful unconfigured handling) | Verified |
| `VITE_API_BASE_URL` | Client Build | No | Public backend URL | Verified |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Client Build | No | Public Supabase browser client config | Verified |
| `XENDIT_SECRET_KEY_TEST` / `XENDIT_WEBHOOK_TOKEN_TEST` | Server | **Yes** | Disabled if unset; sandbox only | Verified |
| `PAYPAL_CLIENT_SECRET_SANDBOX` / `PAYPAL_WEBHOOK_SECRET_SANDBOX` | Server | **Yes** | Disabled if unset; sandbox only | Verified |
| `CARD_GATEWAY_SECRET_KEY_TEST` / `CARD_GATEWAY_WEBHOOK_SECRET_TEST` | Server | **Yes** | Disabled if unset; sandbox only | Verified |
| `MAYA_SECRET_KEY_TEST` / `MAYA_WEBHOOK_SECRET_TEST` | Server | **Yes** | Disabled if unset; sandbox only | Verified |
| `PAYMONGO_SECRET_KEY_TEST` / `PAYMONGO_WEBHOOK_SECRET_TEST` | Server | **Yes** | Deferred + blocked in prod | Verified |
| `GOTYME_API_SECRET_TEST` / `GOTYME_WEBHOOK_SECRET_TEST` | Server | **Yes** | Deferred + blocked in prod | Verified |

### CI/CD, Bundle & Dependency Findings
- **Dependency Audit (`bun audit`):** **0 vulnerabilities** across 268 installed packages.
- **Frontend Bundle Secret Scan:** Ran `npm run build` + grep against `dist/` for all 12 server secret variable names — **`SECRET_SCAN_CLEAN`**. Updated `.github/workflows/deploy-pages.yml` to enforce this expanded list in CI.
- **CORS Hardening (`F-09`):** `src/server/app.ts` now restricts `.run.app` origin matching strictly to `NODE_ENV !== 'production'`, adds `Access-Control-Allow-Credentials: true` only for explicitly allowlisted origins (never `*`), and includes `X-Requested-With` in `Access-Control-Allow-Headers`.
- **Honest Health Endpoint:** `/api/health` now reports `dependencies.portalPersistence: { mode, supabaseWritePersistenceImplemented: false }` so operators have transparent visibility.
- **Deployment Guide Alignment:** Updated `docs/PORTAL_DEPLOYMENT_GUIDE.md` to fix the SQL trigger name (`trg_credit_transactions_immutable`), accurate payment kill-switch env instructions, and explicit warning regarding `SupabasePortalRepository` write persistence.

---

## Section M — Automated Test Execution, Performance & Operational Limitations

### Executed Verification Commands & Actual Results
1. **Full Automated Test Suite (`npm test`):** **18 / 18 PASSING** (`0 failed`, `0 skipped`, duration ~3.47s):
   - `tests/client-portal.test.ts`: **8 / 8 passing** (4 original portal tests + 4 new Phase 2 security regression suites verifying HMAC raw-secret rejection, Xendit static token, cross-order subscription isolation, illegal order state transitions, pending credit release on failure, unique `providerTransactionId`, `HttpOnly` cookie auth + CSRF blocking, cross-client attachment/project reference rejection, session revocation on password change, expired verification token rejection, read-only AI prompt-injection immunity, and static `localStorage`/XSS-escaping guards).
   - `tests/phase1-stabilization.test.ts`: **6 / 6 passing**.
   - `tests/deployment-integration.test.ts`: **4 / 4 passing**.
2. **Server Production Bundle (`npm run build:server`):** **PASSED** (`376.8 kB` bundle in 22 ms).
3. **Frontend Production Build (`npm run build`):** **PASSED** (`dist/index.html` 3.92 kB; `ClientPortalApp-*.js` 290.81 kB / 45.17 kB gzip; main public chunk `index-*.js` 1,047.86 kB / 280.27 kB gzip; CSS 80.34 kB / 13.22 kB gzip). Note: main public chunk exceeds Vite's 500 kB advisory threshold due to pre-existing public site dependencies (unchanged per strict public-site preservation rules).
4. **TypeScript & Lint Verification (`npm run lint` / `tsc --noEmit`):** **PASSED** with zero errors.
5. **Live Local Smoke Verification:** Public `/`, `/portal/login`, `/api/health`, and unauthenticated `/api/portal/dashboard` (`401`) verified cleanly.

### Honest Reporting of Audit Environment Limitations
- **Git Branch & Pull Request Restriction:** No `.git` metadata directory exists in this audit workspace (`git status` exits with `fatal: not a git repository`), and no GitHub credentials/remote are configured. Consequently, changes were applied cleanly in the workspace but branch creation (`audit/phase2-portal-production-readiness`) and Pull Request submission must be performed from a cloned Git repository.
- **Staging Supabase Verification:** No live staging Supabase URL/service-role key was provided in this environment. Live execution of `002_client_portal_commerce.sql` and real PostgreSQL RLS enforcement tests remain `NOT VERIFIED`.

---

## Section N — Production Readiness Decision & Required Remediation Roadmap

### Production Readiness Decision

# **NOT READY**

### Rationale
Although all nine in-code application security findings (`F-02` through `F-10`) were successfully remediated and verified with **18/18 passing automated tests**, **0 dependency vulnerabilities**, and a clean secret scan, the Client Portal cannot be approved for production deployment due to one **Critical** unresolved architectural blocker (`F-01`) and two unverified staging prerequisites:

1. **BLOCKER 1 (`F-01` — Critical):** `src/server/portal/supabasePortalRepository.ts` currently inherits in-memory storage from `LocalPortalRepository({ persistDir: null })` and only queries Supabase for the service catalog. Every client registration, session, order, payment, invoice, credit ledger entry, subscription, project, message, file upload, and support ticket would be permanently lost on every Railway restart or deployment.
2. **BLOCKER 2 (Staging SQL & RLS Verification — `NOT VERIFIED`):** `supabase/migrations/002_client_portal_commerce.sql` must be applied to a staging Supabase instance and verified with live two-user JWT RLS integration tests (confirming `auth.uid()` isolation on all 27 tables, `credit_transactions` immutability, `invoices` tamper protection, `payment_webhook_events` denial for `authenticated`, and `storage.objects` isolation on `portal-private-files`).
3. **BLOCKER 3 (Production Transactional Email & Auth Wiring):** Portal email verification, password reset, and email-change flows currently rely on dev-mode token responses (`NODE_ENV !== 'production'`) and are not yet wired to `EmailService` (Resend) for real inbox delivery in production.

### Mandatory Steps to Reach `READY FOR STAGING` -> `READY FOR PRODUCTION`
1. **Implement Full `SupabasePortalRepository` Persistence:** Replace the in-memory superclass fallback with real Supabase PostgreSQL queries (`@supabase/supabase-js` service-role client), transactional RPCs for atomic credit ledger & webhook settlement, PostgreSQL sequence calls (`nextval('public.portal_order_seq')` / `nextval('public.portal_invoice_seq')`), and Supabase Storage (`portal-private-files`) binary uploads & signed URLs.
2. **Wire Transactional Emails via `EmailService`:** Send verification, password reset, email-change, order confirmation, and support notifications through Resend with outbox retry tracking.
3. **Bind Credit Redemption to Server Tariffs:** Replace client-supplied `creditsCost` in `POST /api/portal/credits/redeem` with server-defined credit tariff IDs.
4. **Execute Staging Supabase Migration & RLS Tests:** Apply `002_client_portal_commerce.sql` to staging, run real two-client JWT RLS assertions, and run end-to-end sandbox webhook tests per payment provider.
5. **Commit on Audit Branch & Open PR:** From a local Git clone of `OphireumTechnology/OMPNETWORK`, commit these remediations onto branch `audit/phase2-portal-production-readiness`, open a Pull Request against `main`, and obtain formal review before merging.
