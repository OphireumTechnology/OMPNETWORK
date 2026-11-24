import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server/app';
import { LocalPortalRepository } from '../src/server/portal/localPortalRepository';
import { PaymentGatewayRegistry } from '../src/server/portal/payments/paymentAdapters';

async function startPortalTestServer(envOverrides?: NodeJS.ProcessEnv) {
  const prevEnv: Record<string, string | undefined> = {};
  if (envOverrides) {
    for (const [k, v] of Object.entries(envOverrides)) {
      prevEnv[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  const portalRepo = new LocalPortalRepository({ persistDir: null });
  const { app } = createApp({
    portalRepo,
    sessionSecret: 'test-portal-secret-0123456789abcdef',
  });

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    portalRepo,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (envOverrides) {
        for (const [k, v] of Object.entries(prevEnv)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    },
  };
}

async function apiJson(
  baseUrl: string,
  path: string,
  options?: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> }
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };
  if (options?.token) headers['Authorization'] = `Bearer ${options.token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: options?.method || 'GET',
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

test('Client Portal Auth Lifecycle: register, verify email, protect routes, logout, password recovery', async () => {
  const srv = await startPortalTestServer();
  try {
    // 1. Unauthenticated protected route must return 401
    const unauth = await apiJson(srv.baseUrl, '/api/portal/dashboard');
    assert.equal(unauth.status, 401);

    // 2. Register client
    const reg = await apiJson(srv.baseUrl, '/api/portal/auth/register', {
      method: 'POST',
      body: {
        email: 'alice@client.test',
        password: 'StrongPassword123!',
        firstName: 'Alice',
        lastName: 'Santos',
        companyName: 'Santos Studio',
      },
    });
    assert.equal(reg.status, 201);
    assert.ok(reg.data.token);
    assert.equal(reg.data.user.emailVerified, false);
    assert.ok(reg.data.devVerificationToken);

    // 3. Verify email using issued token
    const ver = await apiJson(srv.baseUrl, '/api/portal/auth/verify-email', {
      method: 'POST',
      body: { token: reg.data.devVerificationToken },
    });
    assert.equal(ver.status, 200);
    assert.equal(ver.data.emailVerified, true);

    // 4. Dashboard loads for authenticated client
    const dash = await apiJson(srv.baseUrl, '/api/portal/dashboard', { token: reg.data.token });
    assert.equal(dash.status, 200);
    assert.equal(dash.data.metrics.availableCredits, 0);

    // 5. Logout revokes token immediately
    const out = await apiJson(srv.baseUrl, '/api/portal/auth/logout', {
      method: 'POST',
      token: reg.data.token,
    });
    assert.equal(out.status, 200);
    const afterLogout = await apiJson(srv.baseUrl, '/api/portal/dashboard', { token: reg.data.token });
    assert.equal(afterLogout.status, 401);

    // 6. Password recovery & reset
    const forgot = await apiJson(srv.baseUrl, '/api/portal/auth/forgot-password', {
      method: 'POST',
      body: { email: 'alice@client.test' },
    });
    assert.equal(forgot.status, 200);
    assert.ok(forgot.data.devResetToken);

    const reset = await apiJson(srv.baseUrl, '/api/portal/auth/reset-password', {
      method: 'POST',
      body: { token: forgot.data.devResetToken, newPassword: 'NewStrongPassword456!' },
    });
    assert.equal(reset.status, 200);

    // Old password rejected, new password works
    const badLogin = await apiJson(srv.baseUrl, '/api/portal/auth/login', {
      method: 'POST',
      body: { email: 'alice@client.test', password: 'StrongPassword123!' },
    });
    assert.equal(badLogin.status, 401);

    const goodLogin = await apiJson(srv.baseUrl, '/api/portal/auth/login', {
      method: 'POST',
      body: { email: 'alice@client.test', password: 'NewStrongPassword456!' },
    });
    assert.equal(goodLogin.status, 200);
    assert.ok(goodLogin.data.token);
  } finally {
    await srv.close();
  }
});

test('Server-Authoritative Pricing, Disabled Payment Gateways, Verified Webhook Idempotency & Credit Ledger Safety', async () => {
  const webhookSecret = 'test-paymongo-webhook-secret-999';
  const srv = await startPortalTestServer({
    PAYMONGO_SECRET_KEY_TEST: 'sk_test_dummy',
    PAYMONGO_WEBHOOK_SECRET_TEST: webhookSecret,
  });

  try {
    const reg = await apiJson(srv.baseUrl, '/api/portal/auth/register', {
      method: 'POST',
      body: {
        email: 'buyer@client.test',
        password: 'BuyerPassword123!',
        firstName: 'Marco',
        lastName: 'Reyes',
      },
    });
    const token = reg.data.token;

    // Fetch catalog and pick a credit package (e.g., Creator Plan: $49 / 600 credits)
    const cat = await apiJson(srv.baseUrl, '/api/portal/catalog', { token });
    assert.equal(cat.status, 200);
    assert.equal(cat.data.categories.length, 7);

    const creditProduct = cat.data.products.find((p: any) => p.categorySlug === 'subscription-credit-packages');
    assert.ok(creditProduct);
    const creatorPkg = creditProduct.packages.find((pkg: any) => pkg.creditsIncluded > 0 && !pkg.isCustomQuote);
    assert.ok(creatorPkg);

    // Add to cart
    const addRes = await apiJson(srv.baseUrl, '/api/portal/cart/items', {
      method: 'POST',
      token,
      body: { packageId: creatorPkg.id, quantity: 1 },
    });
    assert.equal(addRes.status, 200);
    assert.equal(addRes.data.cart.totalMinor, creatorPkg.priceUsdMinor);

    // Attempt to tamper with totalMinor, paymentStatus, and credits in checkout body
    const checkout = await apiJson(srv.baseUrl, '/api/portal/checkout', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'checkout-idem-001' },
      body: {
        paymentProvider: 'paymongo',
        totalMinor: 1, // tampered!
        paymentStatus: 'paid', // tampered!
        creditsAllocated: 999999, // tampered!
        billingDetails: { fullName: 'Marco Reyes', email: 'buyer@client.test' },
      },
    });
    assert.equal(checkout.status, 201);
    assert.equal(checkout.data.order.totalMinor, creatorPkg.priceUsdMinor);
    assert.equal(checkout.data.order.paymentStatus, 'pending');
    assert.equal(checkout.data.order.fulfillmentStatus, 'pending_payment');

    // Credits must NOT be available yet — only pending
    const creditsBefore = await apiJson(srv.baseUrl, '/api/portal/credits', { token });
    assert.equal(creditsBefore.data.wallet.availableCredits, 0);
    assert.equal(creditsBefore.data.wallet.pendingCredits, creatorPkg.creditsIncluded);

    // Idempotent checkout retry returns same order without duplicating
    const checkoutRetry = await apiJson(srv.baseUrl, '/api/portal/checkout', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'checkout-idem-001' },
      body: {
        paymentProvider: 'paymongo',
        billingDetails: { fullName: 'Marco Reyes', email: 'buyer@client.test' },
      },
    });
    assert.equal(checkoutRetry.status, 200);
    assert.equal(checkoutRetry.data.deduplicated, true);
    assert.equal(checkoutRetry.data.order.id, checkout.data.order.id);

    // Webhook with INVALID signature must fail (401)
    const webhookPayload = {
      eventId: 'evt_paymongo_001',
      orderId: checkout.data.order.id,
      transactionId: 'tx_pm_001',
      amountMinor: checkout.data.order.totalMinor,
      currency: checkout.data.order.currency,
      status: 'paid',
    };
    const badSig = await apiJson(srv.baseUrl, '/api/portal/webhooks/paymongo', {
      method: 'POST',
      headers: { 'paymongo-signature': 'deadbeef' },
      body: webhookPayload,
    });
    assert.equal(badSig.status, 401);

    // Webhook with MISMATCHED amount (signed properly) must fail (422)
    const mismatchedPayload = { ...webhookPayload, eventId: 'evt_pm_badamt', amountMinor: 100 };
    const mismatchedRaw = JSON.stringify(mismatchedPayload);
    const mismatchedSig = crypto.createHmac('sha256', webhookSecret).update(mismatchedRaw).digest('hex');
    const badAmtRes = await fetch(`${srv.baseUrl}/api/portal/webhooks/paymongo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'paymongo-signature': mismatchedSig },
      body: mismatchedRaw,
    });
    assert.equal(badAmtRes.status, 422);

    // Valid HMAC-signed webhook confirms payment & allocates credits ONCE
    const validRaw = JSON.stringify(webhookPayload);
    const validSig = crypto.createHmac('sha256', webhookSecret).update(validRaw).digest('hex');
    const okHookRes = await fetch(`${srv.baseUrl}/api/portal/webhooks/paymongo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'paymongo-signature': validSig },
      body: validRaw,
    });
    const okHook = await okHookRes.json();
    assert.equal(okHookRes.status, 200);
    assert.equal(okHook.deduplicated, false);
    assert.equal(okHook.creditsAllocated, creatorPkg.creditsIncluded);

    // Replayed duplicate webhook must NOT double-allocate credits
    const replayRes = await fetch(`${srv.baseUrl}/api/portal/webhooks/paymongo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'paymongo-signature': validSig },
      body: validRaw,
    });
    const replayHook = await replayRes.json();
    assert.equal(replayRes.status, 200);
    assert.equal(replayHook.deduplicated, true);
    assert.equal(replayHook.creditsAllocated, 0);

    // Verify wallet balance & prevent negative credit deduction
    const creditsAfter = await apiJson(srv.baseUrl, '/api/portal/credits', { token });
    assert.equal(creditsAfter.data.wallet.availableCredits, creatorPkg.creditsIncluded);

    const overRedeem = await apiJson(srv.baseUrl, '/api/portal/credits/redeem', {
      method: 'POST',
      token,
      body: {
        creditsCost: creatorPkg.creditsIncluded + 50,
        serviceDescription: 'Attempt overdraft',
      },
    });
    assert.equal(overRedeem.status, 400);

    // Valid redemption + idempotent replay
    const redeem1 = await apiJson(srv.baseUrl, '/api/portal/credits/redeem', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'redeem-key-1' },
      body: { creditsCost: 25, serviceDescription: 'AI Video Render' },
    });
    assert.equal(redeem1.status, 200);
    assert.equal(redeem1.data.wallet.availableCredits, creatorPkg.creditsIncluded - 25);

    const redeemReplay = await apiJson(srv.baseUrl, '/api/portal/credits/redeem', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'redeem-key-1' },
      body: { creditsCost: 25, serviceDescription: 'AI Video Render' },
    });
    assert.equal(redeemReplay.status, 200);
    assert.equal(redeemReplay.data.wallet.availableCredits, creatorPkg.creditsIncluded - 25);
  } finally {
    await srv.close();
  }
});

test('Strict Multi-Client Data Isolation, File Security, Revision Limits & Security Reauthentication', async () => {
  const srv = await startPortalTestServer();
  try {
    // Register Client A and Client B
    const clientA = await apiJson(srv.baseUrl, '/api/portal/auth/register', {
      method: 'POST',
      body: { email: 'clienta@test.com', password: 'PasswordA123!', firstName: 'ClientA', lastName: 'One' },
    });
    const clientB = await apiJson(srv.baseUrl, '/api/portal/auth/register', {
      method: 'POST',
      body: { email: 'clientb@test.com', password: 'PasswordB123!', firstName: 'ClientB', lastName: 'Two' },
    });
    const tokenA = clientA.data.token;
    const tokenB = clientB.data.token;

    // Client A creates project, uploads valid PDF, rejects executable .exe
    const projA = await apiJson(srv.baseUrl, '/api/portal/projects', {
      method: 'POST',
      token: tokenA,
      body: { title: 'Confidential Brand Launch', description: 'Private brand film brief' },
    });
    assert.equal(projA.status, 201);
    const projectIdA = projA.data.project.id;

    const badUpload = await apiJson(srv.baseUrl, '/api/portal/files/upload', {
      method: 'POST',
      token: tokenA,
      body: {
        fileName: 'malware.exe',
        mimeType: 'application/octet-stream',
        contentBase64: Buffer.from('MZfake').toString('base64'),
        projectId: projectIdA,
      },
    });
    assert.equal(badUpload.status, 400);

    const goodUpload = await apiJson(srv.baseUrl, '/api/portal/files/upload', {
      method: 'POST',
      token: tokenA,
      body: {
        fileName: 'brand-guide.pdf',
        mimeType: 'application/pdf',
        contentBase64: Buffer.from('%PDF-1.4 sample').toString('base64'),
        projectId: projectIdA,
      },
    });
    assert.equal(goodUpload.status, 201);
    const fileIdA = goodUpload.data.file.id;

    // Client A signs & downloads file -> 200 with attachment disposition
    const signA = await apiJson(srv.baseUrl, `/api/portal/files/${fileIdA}/sign`, {
      method: 'POST',
      token: tokenA,
    });
    assert.equal(signA.status, 200);
    const dlRes = await fetch(`${srv.baseUrl}${signA.data.downloadUrl}`);
    assert.equal(dlRes.status, 200);
    assert.match(dlRes.headers.get('content-disposition') || '', /attachment/);
    assert.equal(dlRes.headers.get('x-content-type-options'), 'nosniff');

    // Forged download signature must be rejected (403)
    const forgedDl = await fetch(`${srv.baseUrl}${signA.data.downloadUrl}tampered`);
    assert.equal(forgedDl.status, 403);

    // Client B CANNOT access Client A's project or sign Client A's file
    const crossProj = await apiJson(srv.baseUrl, `/api/portal/projects/${projectIdA}`, { token: tokenB });
    assert.equal(crossProj.status, 404);
    const crossFile = await apiJson(srv.baseUrl, `/api/portal/files/${fileIdA}/sign`, {
      method: 'POST',
      token: tokenB,
    });
    assert.equal(crossFile.status, 404);

    // Revision quota enforcement (default limit = 2)
    const r1 = await apiJson(srv.baseUrl, `/api/portal/projects/${projectIdA}/revisions`, {
      method: 'POST',
      token: tokenA,
      body: { description: 'Revision 1: adjust intro pacing.' },
    });
    assert.equal(r1.status, 201);
    const r2 = await apiJson(srv.baseUrl, `/api/portal/projects/${projectIdA}/revisions`, {
      method: 'POST',
      token: tokenA,
      body: { description: 'Revision 2: tighten color grade.' },
    });
    assert.equal(r2.status, 201);
    const r3 = await apiJson(srv.baseUrl, `/api/portal/projects/${projectIdA}/revisions`, {
      method: 'POST',
      token: tokenA,
      body: { description: 'Revision 3: exceeds included limit.' },
    });
    assert.equal(r3.status, 400);

    // Security reauthentication rejects wrong current password
    const badPassChange = await apiJson(srv.baseUrl, '/api/portal/security/change-password', {
      method: 'POST',
      token: tokenA,
      body: { currentPassword: 'WrongPassword!', newPassword: 'UpdatedPassword999!' },
    });
    assert.equal(badPassChange.status, 403);

    const badClosure = await apiJson(srv.baseUrl, '/api/portal/security/request-closure', {
      method: 'POST',
      token: tokenA,
      body: { currentPassword: 'WrongPassword!', reason: 'Closing' },
    });
    assert.equal(badClosure.status, 403);

    const okClosure = await apiJson(srv.baseUrl, '/api/portal/security/request-closure', {
      method: 'POST',
      token: tokenA,
      body: { currentPassword: 'PasswordA123!', reason: 'Completed projects' },
    });
    assert.equal(okClosure.status, 200);
    assert.equal(okClosure.data.accountStatus, 'pending_closure');
  } finally {
    await srv.close();
  }
});

test('All 7 Payment Providers default to disabled when credentials are absent', () => {
  const registry = new PaymentGatewayRegistry();
  const configs = registry.listConfigs();
  assert.equal(configs.length, 7);
  for (const cfg of configs) {
    assert.equal(cfg.isEnabled, false);
    assert.equal(cfg.mode, 'disabled');
  }
});
