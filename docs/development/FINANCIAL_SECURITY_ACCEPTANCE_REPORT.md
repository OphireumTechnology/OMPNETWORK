# OPHIREUM NETWORK (`OMPNETWORK`) — Financial Security & Payment Governance Acceptance Report

**Scope**: Phase 4, Phase 9 Commerce Hardening, Phase 34 Financial Security Hardening  
**Master Commercial Safety Switch**: `live_payments_enabled = false` (hard-locked in DB migrations `003`/`004` and blocked via `403` in `PUT /api/admin/config`)

---

## 1. Payment Provider Posture

| Provider | Currencies | Adapter Status | Webhook Verification | Live Commercial Charging |
|---|---|---|---|---|
| **Xendit** | PHP, USD | `sandbox_ready` (when sandbox keys supplied) / `live_disabled_pending_credentials` | Exact `rawBody` + timing-safe `x-callback-token` + 5-min timestamp replay window | **DISABLED (`liveEnabled: false`)** |
| **PayPal** | USD, PHP | `sandbox_ready` (when sandbox keys supplied) / `live_disabled_pending_credentials` | Exact `rawBody` + HMAC-SHA256 (`paypal-transmission-sig` / `x-paypal-signature`) + 5-min timestamp replay window | **DISABLED (`liveEnabled: false`)** |
| **Maya** | PHP | `sandbox_ready` (when sandbox keys supplied) / `live_disabled_pending_credentials` | Exact `rawBody` + HMAC-SHA256 (`x-maya-signature`) + 5-min timestamp replay window | **DISABLED (`liveEnabled: false`)** |
| **Card Gateway** | USD, PHP | `live_disabled_pending_credentials` | Exact `rawBody` + HMAC-SHA256 + replay window | **DISABLED (`liveEnabled: false`)** |
| **GCash (via Acquirer)** | PHP | Routed via Xendit/Maya once activated | Acquirer rawBody verification | **DISABLED (`liveEnabled: false`)** |
| **PayMongo** | PHP | `deferred_merchant_onboarding` | Deferred | **DISABLED (`isEnabled: false`, `liveEnabled: false`)** |
| **GoTyme Bank** | PHP | `deferred_merchant_onboarding` | Deferred | **DISABLED (`isEnabled: false`, `liveEnabled: false`)** |

## 2. Phase 34 Cryptographic & Financial Controls Verified

1. **Zero `JSON.stringify(req.body)` Webhook Fallbacks**:
   - Removed all unsafe `req.rawBody || JSON.stringify(req.body)` fallbacks from both `POST /api/portal/webhooks/:provider` (`src/server/portal/portalRoutes.ts`) and `POST /api/webhooks/resend` (`src/server/app.ts`).
   - Requests missing exact captured `rawBody` are rejected immediately with HTTP `400` (`RAW_BODY_REQUIRED`).
   - CI static hygiene gate (`ci.yml`) fails builds if any `rawBody || JSON.stringify(req.body` pattern is reintroduced.
2. **Webhook Replay Protection & Timestamp Skew Tolerance**:
   - `validateWebhookTimestampWindow()` enforces a strict ±5-minute tolerance window on `x-webhook-timestamp`, `paypal-transmission-time`, and `x-maya-timestamp`.
   - Duplicate provider event IDs are rejected idempotently via `payment_webhook_events` unique `(provider, provider_event_id)` constraints.
3. **Atomic Asia/Manila Official Payment Reference Allocation**:
   - Format `MMDDYYYYHHMMAM/PMNNN` (`Asia/Manila`) enforced via `public.allocate_ophireum_payment_ref(timestamptz)` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`).
   - Verified in real PostgreSQL 16 (PGlite) for UTC->Manila date/year rollover (`2026-12-31T16:05:00Z` -> `010120271205AM001`), transaction rollback safety, and sequence exhaustion >999 (`PAYMENT_REF_MINUTE_SEQUENCE_EXHAUSTED`).
4. **Unmatched Payment Reconciliation Queue & Dispute Tracking**:
   - Unmatched order IDs or amount/currency discrepancies detected on verified webhooks are persisted into the reconciliation queue (`payment_reconciliation_queue` in Migration `006`, exposed at `GET/PATCH /api/admin/payments/reconciliation`).
   - Payment disputes / chargebacks tracked via `payment_disputes` (`GET/POST /api/admin/payments/disputes`).
5. **Dual-Control Maker-Checker Segregation of Duties**:
   - High-value refunds (`>= $500.00 USD` / `>= ₱25,000.00 PHP`), manual credit adjustments, reconciliation overrides, and dispute resolutions require a distinct second approver (`financial_maker_checker_approvals`).
   - Enforced at **both** API layer (HTTP `403` on self-approval in `financialGovernance.ts` & `adminRoutes.ts`) and **PostgreSQL schema layer** (`CONSTRAINT chk_maker_checker_distinct_actors CHECK (approver_email IS NULL OR lower(approver_email) <> lower(requested_by_email))`).
6. **Server-Authoritative Pricing & Currency Integrity**:
   - Checkout recalculates all catalog prices, discounts, and currency conversions server-side from authoritative records; client-supplied price mutations are ignored and verified by negative security tests.

## 3. External Blockers Preventing Live Payment Acceptance
- No live/sandbox merchant API keys or webhook secrets for Xendit, PayPal, or Maya exist in this sandbox environment (**External Payment Sandbox Acceptance: 0%**).
- Live commercial charges remain strictly blocked pending staging sandbox reconciliation, BIR invoicing / Philippine merchant compliance verification, and explicit written authorization from the Owner/CEO.
