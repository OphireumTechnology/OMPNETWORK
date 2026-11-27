import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/server/app';
import { LocalPortalRepository } from '../src/server/portal/localPortalRepository';
import { AdminAuthService } from '../src/server/auth';
import { InMemoryTestDatabase } from './_testDb';

describe('Full Commerce Lifecycle, Refunds, Subscriptions, Signed Digital Downloads & Controlled Load Benchmark', () => {
  let server: Server;
  let baseUrl: string;
  let db: InMemoryTestDatabase;
  let portalRepo: LocalPortalRepository;
  let authService: AdminAuthService;
  let superToken: string;
  const origXenditSecret = process.env.XENDIT_WEBHOOK_SECRET;

  before(async () => {
    process.env.XENDIT_WEBHOOK_SECRET = 'test-xendit-webhook-secret-2026';
    db = new InMemoryTestDatabase();
    portalRepo = new LocalPortalRepository({ persistDir: null });

    const created = createApp({ db, portalRepo });
    authService = created.authService;
    const ceoAdmin = db.admins.find((a) => a.email === 'ceo@ophireum.test')!;
    superToken = authService.issueSessionToken(ceoAdmin, 3600, true);

    await new Promise<void>((resolve) => {
      server = created.app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (origXenditSecret === undefined) delete process.env.XENDIT_WEBHOOK_SECRET;
    else process.env.XENDIT_WEBHOOK_SECRET = origXenditSecret;
  });

  it('executes complete Catalog -> Cart -> Checkout -> Signed Webhook Payment -> Invoice -> Project -> Deliverable -> Partial & Full Refund -> Entitlement Revocation lifecycle', async () => {
    // 1. Register client
    const reg = await fetch(`${baseUrl}/api/portal/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'buyer@enterprise.test',
        password: 'BuyerPassword!2026',
        firstName: 'Enterprise',
        lastName: 'Buyer',
      }),
    });
    assert.equal(reg.status, 201);
    const { token: clientToken, user } = await reg.json();

    // 2. Add digital product + project service to cart
    const catalogRes = await fetch(`${baseUrl}/api/portal/catalog`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const catalogJson = await catalogRes.json();
    const allPackages = catalogJson.products.flatMap((p: any) => p.packages || []);
    const oneTimePkg = allPackages.find((pkg: any) => !pkg.isCustomQuote && pkg.billingType === 'one_time');
    assert.ok(oneTimePkg);

    await fetch(`${baseUrl}/api/portal/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: oneTimePkg.id, quantity: 1 }),
    });

    // 3. Checkout
    const checkoutRes = await fetch(`${baseUrl}/api/portal/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'USD',
        paymentProvider: 'xendit',
        billingDetails: { fullName: 'Enterprise Buyer', email: 'buyer@enterprise.test' },
        idempotencyKey: `idem-${Date.now()}`,
      }),
    });
    assert.equal(checkoutRes.status, 201);
    const { order } = await checkoutRes.json();
    assert.ok(['unpaid', 'pending', 'pending_payment'].includes(order.paymentStatus));

    // 4. Signed Xendit webhook confirms payment -> allocates MMDDYYYYHHMMAM/PMNNN ref, creates invoice, digital entitlement, and project
    const webhookBody = JSON.stringify({
      eventId: `evt-xendit-${Date.now()}`,
      transactionId: `tx-xendit-${Date.now()}`,
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: 'paid',
    });

    const whRes = await fetch(`${baseUrl}/api/portal/webhooks/xendit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-callback-token': process.env.XENDIT_WEBHOOK_SECRET!,
      },
      body: webhookBody,
    });
    assert.equal(whRes.status, 200);
    const whData = await whRes.json();
    assert.equal(whData.deduplicated, false);
    assert.match(whData.ophireumPaymentReference, /^\d{12}(AM|PM)\d{3}$/);

    const paidOrder = await portalRepo.getOrderById(user.id, order.id);
    assert.equal(paidOrder?.paymentStatus, 'paid');
    const invoicesRes = await fetch(`${baseUrl}/api/portal/invoices`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const invoicesJson = await invoicesRes.json();
    assert.ok(invoicesJson.invoices.length >= 1 && invoicesJson.invoices[0].invoiceNumber);

    // 5. Verify signed expiring digital download link works and tampered signature fails
    const dlList = await fetch(`${baseUrl}/api/portal/downloads`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const dlData = await dlList.json();
    assert.ok(dlData.entitlements.length >= 1);
    const entId = dlData.entitlements[0].id;

    const signRes = await fetch(`${baseUrl}/api/portal/downloads/${entId}/sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(signRes.status, 200);
    const signJson = await signRes.json();
    assert.ok(signJson.signedDownloadUrl);

    const downloadOk = await fetch(`${baseUrl}${signJson.signedDownloadUrl}`);
    assert.equal(downloadOk.status, 200);
    const downloadTampered = await fetch(`${baseUrl}${signJson.signedDownloadUrl}0`);
    assert.equal(downloadTampered.status, 403);

    // 6. Verify admin deliverable creation & client approval -> project completion
    const projRes = await fetch(`${baseUrl}/api/portal/projects`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const projData = await projRes.json();
    assert.ok(projData.projects.length >= 1);
    const project = projData.projects[0];

    const addDeliv = await fetch(`${baseUrl}/api/admin/projects/${project.id}/deliverables`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Final Production Master Package', fileName: 'master-v1.zip' }),
    });
    assert.equal(addDeliv.status, 201);
    const delivJson = await addDeliv.json();

    const approveDeliv = await fetch(
      `${baseUrl}/api/portal/projects/${project.id}/deliverables/${delivJson.deliverable.id}/approve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Approved for release' }),
      }
    );
    assert.equal(approveDeliv.status, 200);

    // 7. Partial refund followed by remaining refund -> transitions order to partially_refunded then refunded and revokes digital entitlement
    const paymentsListRes = await fetch(`${baseUrl}/api/admin/payments`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const paymentsListJson = await paymentsListRes.json();
    const orderPayment = paymentsListJson.payments.find((p: any) => p.orderId === order.id);
    assert.ok(orderPayment, 'Payment record for paid order must exist');

    const partialAmount = Math.floor(order.totalMinor / 2);
    const partialReq = await fetch(`${baseUrl}/api/admin/refunds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: orderPayment.id,
        amountMinor: partialAmount,
        reason: 'Partial scope reduction',
      }),
    });
    assert.equal(partialReq.status, 201);
    const partialRefund = (await partialReq.json()).refund;

    const approvePartial = await fetch(`${baseUrl}/api/admin/refunds/${partialRefund.id}/decide`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'processed' }),
    });
    assert.equal(approvePartial.status, 200);
    const ordAfterPartial = await portalRepo.getOrderById(user.id, order.id);
    assert.equal(ordAfterPartial?.paymentStatus, 'partially_refunded');

    const remainingAmount = order.totalMinor - partialAmount;
    const finalReq = await fetch(`${baseUrl}/api/admin/refunds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: orderPayment.id,
        amountMinor: remainingAmount,
        reason: 'Full cancellation settlement',
      }),
    });
    assert.equal(finalReq.status, 201);
    const finalRefund = (await finalReq.json()).refund;
    const approveFinal = await fetch(`${baseUrl}/api/admin/refunds/${finalRefund.id}/decide`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'processed' }),
    });
    assert.equal(approveFinal.status, 200);

    const ordAfterFull = await portalRepo.getOrderById(user.id, order.id);
    assert.equal(ordAfterFull?.paymentStatus, 'refunded');
    const revokedEnt = await portalRepo.getDigitalEntitlementById(user.id, entId);
    assert.equal(revokedEnt?.status, 'revoked', 'Full refund must revoke digital entitlement');
  });

  it('handles subscription plan changes, renewal, failed renewal grace period, and stale order expiration', async () => {
    const reg = await fetch(`${baseUrl}/api/portal/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sub-client@enterprise.test',
        password: 'SubPassword!2026',
        firstName: 'Sub',
        lastName: 'Client',
      }),
    });
    const { token: clientToken, user } = await reg.json();

    const catalogRes = await fetch(`${baseUrl}/api/portal/catalog`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const catalogJson = await catalogRes.json();
    const subPackages = catalogJson.products
      .flatMap((p: any) => p.packages || [])
      .filter((pkg: any) => pkg.billingType === 'subscription_monthly');
    assert.ok(subPackages.length >= 2);
    const subPkg = subPackages[0];
    const upgradePkg = subPackages[1];

    await fetch(`${baseUrl}/api/portal/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: subPkg.id, quantity: 1 }),
    });
    const coRes = await fetch(`${baseUrl}/api/portal/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'USD',
        paymentProvider: 'xendit',
        billingDetails: { fullName: 'Sub Client', email: 'sub-client@enterprise.test' },
      }),
    });
    const { order } = await coRes.json();

    // Pay subscription order via signed webhook
    const whBody = JSON.stringify({
      eventId: `evt-sub-${Date.now()}`,
      transactionId: `tx-sub-${Date.now()}`,
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: 'paid',
    });
    await fetch(`${baseUrl}/api/portal/webhooks/xendit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-callback-token': process.env.XENDIT_WEBHOOK_SECRET! },
      body: whBody,
    });

    const subsRes = await fetch(`${baseUrl}/api/portal/subscriptions`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const { subscriptions } = await subsRes.json();
    assert.equal(subscriptions.length, 1);
    const sub = subscriptions[0];

    // Customer upgrades subscription plan to a different tier package
    const planRes = await fetch(`${baseUrl}/api/portal/subscriptions/${sub.id}/change-plan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: upgradePkg.id }),
    });
    assert.equal(planRes.status, 200);
    const changed = (await planRes.json()).subscription;
    assert.equal(changed.packageId, upgradePkg.id);

    // Admin records failed renewal -> enters past_due with grace period
    const failRes = await fetch(`${baseUrl}/api/admin/subscriptions/${sub.id}/renewal-failed`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Insufficient balance', graceDays: 7 }),
    });
    assert.equal(failRes.status, 200);
    const failedSub = (await failRes.json()).subscription;
    assert.equal(failedSub.status, 'past_due');
    assert.equal(failedSub.failedRenewalCount, 1);
    assert.ok(failedSub.gracePeriodEndsAt);

    // Admin renews subscription -> restores active status & resets failure count
    const renewRes = await fetch(`${baseUrl}/api/admin/subscriptions/${sub.id}/renew`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
    });
    assert.equal(renewRes.status, 200);
    const renewed = (await renewRes.json()).subscription;
    assert.equal(renewed.status, 'active');
    assert.equal(renewed.failedRenewalCount, 0);

    // Test stale unpaid order auto-expiration
    await fetch(`${baseUrl}/api/portal/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: subPkg.id, quantity: 1 }),
    });
    const unpaidCo = await fetch(`${baseUrl}/api/portal/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'USD',
        paymentProvider: 'xendit',
        billingDetails: { fullName: 'Sub Client', email: 'sub-client@enterprise.test' },
      }),
    });
    const unpaidOrd = (await unpaidCo.json()).order;
    const stored = await portalRepo.getOrderById(user.id, unpaidOrd.id);
    assert.ok(stored);
    stored!.expiresAt = new Date(Date.now() - 60_000).toISOString();
    const expiredOrders = await portalRepo.expireStaleOrders();
    assert.ok(expiredOrders.length >= 1);
    const refreshed = await portalRepo.getOrderById(user.id, unpaidOrd.id);
    assert.equal(refreshed?.paymentStatus, 'cancelled');
    assert.equal(refreshed?.fulfillmentStatus, 'cancelled');
  });

  it('passes controlled localhost concurrency & latency benchmark (120 concurrent requests, 0 unexpected 5xx)', async () => {
    const totalRequests = 120;
    const latencies: number[] = [];
    let errors5xx = 0;

    const startedAt = performance.now();
    await Promise.all(
      Array.from({ length: totalRequests }, async (_, idx) => {
        const t0 = performance.now();
        const url =
          idx % 3 === 0
            ? `${baseUrl}/api/health`
            : idx % 3 === 1
              ? `${baseUrl}/api/portal/catalog`
              : `${baseUrl}/api/ai/agents/public`;
        const res = await fetch(url);
        if (res.status >= 500) errors5xx += 1;
        await res.text();
        latencies.push(performance.now() - t0);
      })
    );
    const elapsedMs = performance.now() - startedAt;
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const rps = Math.round((totalRequests / elapsedMs) * 1000);

    console.log(
      `[LOAD BENCHMARK] ${totalRequests} concurrent HTTP requests in ${elapsedMs.toFixed(1)}ms | p50=${p50.toFixed(2)}ms | p95=${p95.toFixed(2)}ms | throughput=${rps} req/s | 5xx=${errors5xx}`
    );

    assert.equal(errors5xx, 0, 'Zero 5xx errors allowed under concurrent load');
    assert.ok(p95 < 1500, `Expected p95 < 1500ms, got ${p95.toFixed(2)}ms`);
  });
});
