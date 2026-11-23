# Ophireum Multimedia — Multi-Gateway Payment Rollout

## Objective

Add multiple payment providers behind one server-side payment orchestration layer. The initial rollout is sandbox-first. No live charges or production payment activation are permitted until merchant approval, credentials, webhook verification, end-to-end tests, and explicit owner approval are complete.

## Provider rollout

### Phase 1 — Xendit (Philippines)

Xendit is the primary Philippine gateway for the first implementation. It also consolidates the current Dragonpay merchant onboarding and integration path. Use Xendit Test Mode first.

Potential Philippine channels depend on the merchant account and channel activation. The current Xendit channel catalog includes cards, Maya/PayMaya, bank-transfer and online-banking channels, QR/wallet and over-the-counter options. Never display or enable a channel unless it is confirmed available for the merchant account.

Official onboarding: https://dashboard.xendit.co/register/1?regional=true
Documentation: https://docs.xendit.co/
Test-mode account and keys are available after registration; live mode requires business verification.

### Phase 1 — PayPal (international)

Use PayPal Checkout REST APIs with a Sandbox business account and sandbox buyer account. Create orders server-side, capture only after buyer approval, and fulfill only after a verified completed capture. Verify webhook signatures using the PayPal webhook verification API and configured webhook ID.

Developer dashboard: https://developer.paypal.com/dashboard/
Documentation: https://developer.paypal.com/api/rest/

### Phase 2 — Maya Checkout (Philippines)

Add Maya as a separate direct provider after merchant onboarding and sandbox credentials are obtained. Use hosted checkout, server-side webhook processing, and transaction retrieval as appropriate. Do not assume all payment methods (cards, QR Ph, Maya Wallet) are enabled by default; merchant configuration controls availability.

Documentation: https://developers.maya.ph/

### Deferred — Direct GoTyme

Pursue direct GoTyme merchant/API access separately. Do not represent ordinary bank transfer or QR Ph acceptance as a direct GoTyme API integration. Implement only after GoTyme provides merchant approval, technical documentation, sandbox credentials, webhook/signature details, and settlement terms.

### PayMongo

Keep the provider adapter slot available. Resume onboarding when new merchant registrations reopen or Sales provides a direct onboarding route.

## Central payment architecture

- One server-owned order and payment-intent model; provider adapters only create/lookup/cancel/refund provider-side transactions.
- Never accept price, currency, product entitlement, or payment status as authoritative from the browser.
- Use server-side catalog/package IDs and price snapshots.
- Persist provider name, provider transaction ID, provider event ID, idempotency key, amount, currency, state, timestamps, and sanitized metadata.
- Unique constraints on provider event IDs and provider transaction IDs prevent duplicate processing.
- Verify each provider's webhook according to its official mechanism. Browser redirects are not proof of payment.
- Retrieve the payment from the provider when needed to confirm amount, currency, merchant account, and final state.
- Fulfill only once after a verified successful/captured state.
- Preserve provider transaction IDs separately from the Ophireum reference number.
- Generate the custom Ophireum reference only at first verified successful payment, atomically in Asia/Manila time, using the owner's specified format: MMDDYYYYHHMMAM/PMNNN. Sequence resets daily and must never be reused.
- Keep refunds, reversals, disputes, and chargebacks as separate lifecycle events; never delete or reuse the original payment reference.

## Notification and audit requirements

On first verified payment, queue notifications to:
- Admin email
- Admin SMS (only after the full recipient number and SMS provider are configured)
- Admin dashboard

Notification payload: Ophireum reference, order ID, amount/currency, provider/payment method, provider transaction ID, paid status, and Asia/Manila timestamp. Use a durable outbox with deduplication and retries. Do not put secrets or full payment credentials in logs or notifications.

## Environment configuration (Railway secrets only)

Use separate TEST and LIVE configuration. Initial integration must run in TEST mode only.

Xendit:
- XENDIT_SECRET_KEY_TEST
- XENDIT_WEBHOOK_TOKEN_TEST
- XENDIT_SECRET_KEY_LIVE (deferred)
- XENDIT_WEBHOOK_TOKEN_LIVE (deferred)

PayPal:
- PAYPAL_CLIENT_ID_SANDBOX
- PAYPAL_CLIENT_SECRET_SANDBOX
- PAYPAL_WEBHOOK_ID_SANDBOX
- PAYPAL_CLIENT_ID_LIVE (deferred)
- PAYPAL_CLIENT_SECRET_LIVE (deferred)
- PAYPAL_WEBHOOK_ID_LIVE (deferred)

Maya (later):
- MAYA_PUBLIC_KEY_TEST
- MAYA_SECRET_KEY_TEST
- MAYA_WEBHOOK_CONFIGURATION (store only the provider-issued verification configuration needed by the implementation)
- Live keys deferred.

Also required before runtime deployment:
- Supabase project URL and server-only service-role key
- Notification provider credentials
- Admin notification email and confirmed full E.164 SMS number

Never commit credentials to GitHub, frontend bundles, migration files, or logs. Never ask the owner to paste live secrets into chat; add them through Railway's secret/environment-variable interface.

## Database prerequisite

Before payment implementation is connected to runtime, reconcile the existing schema and migration history against the active Supabase project. The current application repository includes a baseline schema and migration, but the previously inspected Supabase project had no public tables/migrations. Do not assume the database is initialized. Apply a reviewed, idempotent baseline first, then a separately reviewed payment migration with RLS enabled and no public client writes.

## Release gates

1. Provider sandbox credentials configured in Railway.
2. Database baseline and payment migrations reviewed and applied.
3. Unit tests for amount/currency validation, idempotency, duplicate/out-of-order webhooks, replay protection, concurrent reference allocation, and exactly-once fulfillment.
4. Provider sandbox webhook tests pass.
5. Reconciliation tests and refund/reversal handling pass.
6. Notifications tested without exposing sensitive data.
7. Production credentials and live payment methods remain disabled until explicit owner approval.

## Current status

This document is an implementation rollout plan only. It does not claim that any payment gateway is integrated, credentials are configured, database migrations are applied, or live transactions are enabled.
