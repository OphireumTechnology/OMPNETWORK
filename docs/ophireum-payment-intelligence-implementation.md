# Ophireum Multimedia Payment Intelligence — Implementation Plan

## Scope and deployment guardrails

- Repository: `OphireumTechnology/OMPNETWORK`
- Target service: Railway `OMPNETWORK`
- Target database: Supabase project `Ophireum Multimedia Productions`
- Development branch: `feature/ophireum-payment-intelligence`
- Payment mode: sandbox/test only until the complete acceptance checklist passes.
- Do not configure live payment credentials, charge real customers, or switch a provider to live mode as part of this milestone.
- Never commit API keys, webhook secrets, SMS credentials, Supabase service-role keys, or administrator secrets.

## Current audit findings (2026-11-24)

- Railway production environment contains the OMPNETWORK service connected to `OphireumTechnology/OMPNETWORK` on `main`; latest observed deployment was successful.
- The Railway service currently reports no environment-variable names and no public service domain in the inspected environment.
- The Supabase project is active and healthy, but its public schema currently reports zero tables, zero migrations, and zero Edge Functions.
- The application already has an Express API, a Supabase repository abstraction, administrator authentication, audit logging, and a Resend-based transactional email/outbox service. These existing facilities should be extended rather than duplicated.
- The existing Supabase repository expects tables such as `solution_requests`, `consultation_appointments`, `notification_records`, `audit_logs`, and `admin_users`; the database currently has none. Establish and test the application's baseline schema before enabling payment persistence.
- The administrator mobile value supplied so far is `+63`, which is a country prefix only and not a deliverable mobile number. SMS delivery cannot be enabled until the complete number is provided in E.164 format.

## Customer checkout

1. Read published bundle/product data from the server-side catalog.
2. Create a pending order with immutable item-name, unit-price, currency, quantity, and total snapshots.
3. Create a provider checkout session using server-side credentials and an idempotency key.
4. Redirect the customer to the provider-hosted checkout; do not collect or store card credentials.
5. Treat the provider's verified webhook—not the browser return URL—as the authoritative payment confirmation.
6. On confirmed payment, atomically mark the payment/order paid, allocate the merchant reference, create product entitlements, and enqueue notifications.
7. Fulfillment and notifications must be idempotent and retryable.

## Provider integration

### PayMongo (Philippine payment methods)

- Use test API credentials only in the test environment.
- Support only payment methods enabled for the merchant account; likely local methods include GCash, Maya, QR Ph and cards, subject to PayMongo account/product eligibility.
- Subscribe to the required payment-success, payment-failure, refund and dispute events appropriate to the selected PayMongo checkout product.
- Verify `Paymongo-Signature` against the exact raw request body using HMAC-SHA256 and the correct test-mode signature field; compare signatures in constant time and enforce a timestamp tolerance.
- Deduplicate provider event IDs. Persist the event before processing and safely retry failed downstream work.

### PayPal (international checkout)

- Use PayPal Sandbox application credentials first.
- Verify every webhook using PayPal's official webhook signature-verification API and the configured webhook ID.
- Capture/confirm only on the server; do not trust client-supplied payment status or amount.
- Store PayPal order/capture IDs separately from the merchant's Ophireum reference.

## Ophireum merchant reference

Format: `MMDDYYYYHHMMAM/PMNNN`, using `Asia/Manila`.

Example: `112420260217AM001`.

- Date: month, day, four-digit year.
- Time: 12-hour clock hour and minute, zero-padded.
- Period: uppercase `AM` or `PM`.
- Sequence: three-digit daily counter beginning at `001`, incrementing for each newly confirmed successful transaction.
- Reset the counter at the next Manila calendar date.
- Allocate the sequence in a single PostgreSQL transaction using a locked daily counter row or an equivalent atomic database function. Never allocate in application memory.
- Generate once when the payment first transitions to verified-paid. Persist permanently; retries, duplicate webhooks and refunds must never generate a second reference or reuse a prior reference.
- Preserve the provider's own transaction/capture ID as a separate reconciliation field.
- Add a unique database constraint on the merchant reference and provider/event identifiers.

## Notification preferences

- Administrator channels: SMS, email, and admin dashboard.
- Customer channel: receipt email, with order/reference details.
- SMS payload: merchant reference, amount/currency, provider/method, order ID, paid status, and Manila timestamp. Avoid sending unnecessary customer personal data.
- Use an SMS provider selected after merchant account setup; store credentials only in Railway secrets.
- Use the existing Resend transactional email/outbox service where possible.
- Persist notification delivery attempts and provider message IDs. Retry transient failures without duplicating successful sends.
- The current administrator mobile number is incomplete (`+63`). Keep SMS disabled until a complete number is confirmed; do not guess it.

## Suggested database objects

- `omp_products`, `omp_product_bundles`, `omp_bundle_items`
- `omp_orders`, `omp_order_items`
- `omp_payments`
- `omp_payment_webhook_events` (unique provider + provider event ID)
- `omp_daily_payment_sequences` (one locked counter per Manila date)
- `omp_product_entitlements`
- `omp_payment_notification_outbox`
- `omp_payment_audit_log`

All financial rows must use exact decimal/integer minor-unit amounts, explicit ISO currency codes, immutable price snapshots, timestamps, and restricted access. Enable RLS on all exposed tables. Revoke anonymous/authenticated write access to payment state, sequences, entitlements and webhook records; privileged writes must be performed through trusted server-side code or narrowly scoped database functions.

## Proposed server API

- `POST /api/checkout/orders` — create a pending order from validated catalog identifiers.
- `POST /api/checkout/paymongo/session` — create PayMongo test checkout.
- `POST /api/checkout/paypal/order` — create PayPal Sandbox order.
- `POST /api/webhooks/paymongo` — raw-body signature verification and event ingestion.
- `POST /api/webhooks/paypal` — PayPal webhook verification and event ingestion.
- `GET /api/orders/:orderId` — authenticated/customer-scoped order status.
- `GET /api/admin/payments` — admin-only transaction list and filters.
- `GET /api/admin/payments/:id` — admin-only transaction details and notification status.

Exact paths should be reconciled with the existing API conventions before implementation.

## Agent responsibilities

1. Order Agent: validate catalog items, quantities, currency, and immutable price snapshots.
2. Checkout Agent: create provider sessions and use idempotency keys.
3. Verification Agent: deterministic signature, amount, currency, order, status, and event checks. AI must never approve a payment.
4. Fulfillment Agent: create product entitlements only after verified paid status.
5. Notification Agent: dispatch SMS/email/admin alerts from a durable outbox.
6. Reconciliation Agent: identify mismatches, duplicates, refunds, disputes and delayed events; produce review alerts, never alter payment truth autonomously.

## Test and release acceptance checklist

- [ ] Baseline schema migrations apply cleanly to the empty Supabase project.
- [ ] Existing inquiry, appointment, admin-auth and audit-log flows pass regression tests.
- [ ] PayMongo test checkout creates the expected order and amount.
- [ ] PayMongo valid signature accepted; invalid signature, stale timestamp and malformed body rejected.
- [ ] PayPal Sandbox order/capture and webhook signature verification pass.
- [ ] Repeated webhook delivery creates one payment, one merchant reference, one entitlement set and one notification per channel.
- [ ] Concurrent paid events allocate distinct sequential references.
- [ ] Sequence resets on the next Manila calendar day and handles 12:00 AM/PM correctly.
- [ ] Failed, pending, expired, refunded and disputed transactions do not create paid entitlements.
- [ ] Notification failure is retried without changing payment truth or duplicating successful delivery.
- [ ] Admin endpoints enforce authentication and authorization; RLS and secret-leak checks pass.
- [ ] Test receipts and SMS use sandbox/test indicators.
- [ ] Owner signs off on the complete administrator mobile number, SMS provider, email recipient, product/bundle catalog and merchant provider accounts.
- [ ] Separate written approval before adding live credentials or enabling real-money payments.

## Required configuration (Railway service secrets)

Configure only after code and schema are ready:

- `NODE_ENV=production` (already appropriate for the production service)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose to browser)
- `PAYMENT_MODE=test`
- `PAYMONGO_SECRET_KEY` (test key only)
- `PAYMONGO_WEBHOOK_SECRET` (test endpoint secret)
- `PAYPAL_ENV=sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `RESEND_API_KEY` and `ADMIN_NOTIFICATION_EMAIL`
- SMS provider credentials and `ADMIN_NOTIFICATION_PHONE` only after the complete number and provider are confirmed.

Do not place placeholder or invented secrets in Railway. Do not deploy a configuration that reports a successful payment while the database or required notification outbox is unavailable.
