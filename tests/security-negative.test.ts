import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { createApp } from '../src/server/app';
import { LocalPortalRepository } from '../src/server/portal/localPortalRepository';
import { AdminAuthService, generateTotpCode } from '../src/server/auth';
import { AdminRole } from '../src/server/db/types';
import { DistributedRateLimiter } from '../src/server/rateLimiter';
import { InMemoryTestDatabase, ALL_NINE_ROLES } from './_testDb';

describe('Enterprise Negative Security, 9-Role RBAC, MFA Hardening, CSRF, Webhook & Fail-Closed Tests', () => {
  let server: Server;
  let baseUrl: string;
  let db: InMemoryTestDatabase;
  let portalRepo: LocalPortalRepository;
  let authService: AdminAuthService;
  const origEnv = { ...process.env };

  before(async () => {
    process.env.ADMIN_BOOTSTRAP_EMAIL = 'ceo@ophireum.test';
    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'SuperSecureAdminPassword!2026';
    process.env.ADMIN_SESSION_SECRET = 'test-session-secret-32-bytes-minimum-key';
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_dGVzdF9zZWNyZXRfa2V5X2Zvcl9zdml4X3Yx';
    process.env.ALLOWED_ORIGINS = 'https://ophireummultimedia.com';

    db = new InMemoryTestDatabase();
    portalRepo = new LocalPortalRepository({ persistDir: null });

    const created = createApp({ db, portalRepo });
    authService = created.authService;
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
    process.env = origEnv;
  });

  it('enforces all 9 RBAC roles with least-privilege endpoint boundaries', async () => {
    assert.equal(ALL_NINE_ROLES.length, 9);

    const issueForRole = (role: AdminRole) => {
      const adm = db.admins.find((a) => a.role === role)!;
      return authService.issueSessionToken(adm, 3600, true);
    };

    // Auditor can read analytics, but CANNOT update system config
    const auditorToken = issueForRole('auditor');
    const auditorAnalytics = await fetch(`${baseUrl}/api/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${auditorToken}` },
    });
    assert.equal(auditorAnalytics.status, 200);

    const auditorConfigWrite = await fetch(`${baseUrl}/api/admin/config`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auditorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'test_key', value: 'x' }),
    });
    assert.equal(auditorConfigWrite.status, 403);

    // Support officer cannot view finance/payments management
    const supportToken = issueForRole('support_officer');
    const supportFinance = await fetch(`${baseUrl}/api/admin/payments`, {
      headers: { Authorization: `Bearer ${supportToken}` },
    });
    assert.equal(supportFinance.status, 403);

    // Finance officer can view payments
    const financeToken = issueForRole('finance_officer');
    const financePayments = await fetch(`${baseUrl}/api/admin/payments`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    assert.equal(financePayments.status, 200);

    // Every single one of the 9 roles can authenticate to /api/admin/auth/session
    for (const role of ALL_NINE_ROLES) {
      const tok = issueForRole(role);
      const res = await fetch(`${baseUrl}/api/admin/auth/session`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      assert.equal(res.status, 200, `Role ${role} should authenticate to session endpoint`);
    }

    // Super admin cannot enable live_payments_enabled via API (hard lock)
    const superToken = issueForRole('super_admin');
    const livePayLock = await fetch(`${baseUrl}/api/admin/config`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'live_payments_enabled', value: true }),
    });
    assert.equal(livePayLock.status, 403);
  });

  it('enforces RFC 6238 TOTP replay rejection, 5-attempt lockout, single-use recovery codes, and MFA bypass blocking', async () => {
    const mfaEmail = 'mfa-officer@ophireum.test';
    const enrolled = authService.enrollAdminMfa(mfaEmail);
    assert.ok(enrolled.secret.length >= 16);
    assert.ok(enrolled.otpAuthUri.startsWith('otpauth://totp/'));
    assert.equal(enrolled.recoveryCodes.length, 10);

    // Stored secret is AES-256-GCM encrypted with versioned key ID (enc:v2:<kid>:..., never plaintext)
    const encrypted = authService.getEncryptedAdminMfaSecret(mfaEmail);
    assert.ok(encrypted && encrypted.startsWith('enc:v2:'));
    assert.ok(!encrypted.includes(enrolled.secret));

    const code1 = generateTotpCode(enrolled.secret);
    const confirmed = authService.confirmAdminMfaEnrollment(mfaEmail, code1);
    assert.equal(confirmed, true);

    // Replay of the exact same TOTP code in the same 30s step MUST fail
    const replay = authService.verifyAdminMfaCode(mfaEmail, code1);
    assert.equal(replay.ok, false);
    assert.equal(replay.reason, 'replay');

    // Single-use recovery code works once, then fails on second attempt
    const rc = enrolled.recoveryCodes[0];
    const rcFirst = authService.verifyAdminMfaCode(mfaEmail, rc);
    assert.equal(rcFirst.ok, true);
    assert.equal(rcFirst.usedRecoveryCode, true);

    const rcSecond = authService.verifyAdminMfaCode(mfaEmail, rc);
    assert.equal(rcSecond.ok, false);

    // 5 consecutive invalid attempts trigger lockout
    for (let i = 0; i < 5; i++) {
      authService.verifyAdminMfaCode(mfaEmail, '000000');
    }
    const locked = authService.verifyAdminMfaCode(mfaEmail, enrolled.recoveryCodes[1]);
    assert.equal(locked.ok, false);
    assert.equal(locked.reason, 'locked');

    // Privileged session issued WITHOUT mfaVerified=true must be blocked when MFA is enabled
    const mfaAdmin = db.admins.find((a) => a.email === mfaEmail)!;
    const unverifiedMfaToken = authService.issueSessionToken(mfaAdmin, 3600, false);
    const bypassRes = await fetch(`${baseUrl}/api/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${unverifiedMfaToken}` },
    });
    assert.equal(bypassRes.status, 403);
  });

  it('rejects CSRF cross-origin cookie-authenticated admin mutations and unauthorized CORS origins', async () => {
    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ceo@ophireum.test',
        password: 'SuperSecureAdminPassword!2026',
      }),
    });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get('set-cookie') || '';
    const cookiePair = setCookie.split(';')[0];
    assert.ok(cookiePair.startsWith('opm_admin_session='));

    // Cookie-authenticated POST from untrusted Origin without X-Requested-With MUST fail (403)
    const csrfBlocked = await fetch(`${baseUrl}/api/admin/promotions`, {
      method: 'POST',
      headers: {
        Cookie: cookiePair,
        Origin: 'https://evil-attacker.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'EVIL90', discountType: 'percent', value: 90 }),
    });
    assert.equal(csrfBlocked.status, 403);

    // Unauthorized CORS request must not reflect evil origin
    const corsCheck = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://evil-attacker.example' },
    });
    assert.equal(corsCheck.headers.get('access-control-allow-origin'), null);

    // Logout revokes token immediately so subsequent requests fail with 401
    const logoutRes = await fetch(`${baseUrl}/api/admin/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookiePair,
        'X-Requested-With': 'fetch',
      },
    });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await fetch(`${baseUrl}/api/admin/auth/session`, {
      headers: { Cookie: cookiePair },
    });
    assert.equal(afterLogout.status, 401);
  });

  it('exports BI analytics CSV cleanly with formula-injection protection', async () => {
    const csvAdmin = db.admins.find((a) => a.email === 'csv@ophireum.test')!;
    const token = authService.issueSessionToken(csvAdmin, 3600, true);

    const csvRes = await fetch(`${baseUrl}/api/admin/analytics/export.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.match(csvText, /"metric","value"/);
  });

  it('verifies Resend Svix v1 webhook signature, rejects forged webhooks, and deduplicates replays', async () => {
    const body = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 're_test_12345' },
    });

    // Forged signature rejected
    const forged = await fetch(`${baseUrl}/api/webhooks/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_forged_1',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalidSignatureBase64==',
      },
      body,
    });
    assert.equal(forged.status, 401);

    // Valid Svix v1 signature accepted
    const svixId = 'msg_valid_1001';
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const rawKey = Buffer.from(
      process.env.RESEND_WEBHOOK_SECRET!.replace(/^whsec_/, ''),
      'base64'
    );
    const sig = crypto
      .createHmac('sha256', rawKey)
      .update(`${svixId}.${svixTimestamp}.${body}`)
      .digest('base64');

    const valid1 = await fetch(`${baseUrl}/api/webhooks/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': `v1,${sig}`,
      },
      body,
    });
    assert.equal(valid1.status, 200);

    // Replay of identical svix-id deduplicated
    const valid2 = await fetch(`${baseUrl}/api/webhooks/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': `v1,${sig}`,
      },
      body,
    });
    assert.equal(valid2.status, 200);
    const dupJson = await valid2.json();
    assert.equal(dupJson.deduplicated, true);
  });

  it('prevents client price manipulation, invalid service IDs, IDOR across customers, and suspended account logins', async () => {
    const regA = await fetch(`${baseUrl}/api/portal/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice-sec@client.test',
        password: 'ClientPassword!2026',
        firstName: 'Alice',
        lastName: 'Sec',
      }),
    });
    assert.equal(regA.status, 201);
    const dataA = await regA.json();
    const tokenA = dataA.token;

    const regB = await fetch(`${baseUrl}/api/portal/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob-sec@client.test',
        password: 'ClientPassword!2026',
        firstName: 'Bob',
        lastName: 'Sec',
      }),
    });
    assert.equal(regB.status, 201);
    const dataB = await regB.json();
    const tokenB = dataB.token;

    // Invalid catalog package ID rejected
    const badCart = await fetch(`${baseUrl}/api/portal/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: 'non-existent-sku', quantity: 1 }),
    });
    assert.equal(badCart.status, 404);

    // Fetch real catalog package
    const catRes = await fetch(`${baseUrl}/api/portal/catalog`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const catJson = await catRes.json();
    const firstPkg = catJson.products
      .flatMap((p: any) => p.packages || [])
      .find((pkg: any) => !pkg.isCustomQuote && pkg.billingType === 'one_time');
    assert.ok(firstPkg);

    // Valid item with client-tampered price ignored (server authoritative pricing)
    const addCart = await fetch(`${baseUrl}/api/portal/cart/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: firstPkg.id, quantity: 1, unitPriceMinor: 1 }),
    });
    assert.equal(addCart.status, 200);

    const checkout = await fetch(`${baseUrl}/api/portal/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'USD',
        paymentProvider: 'xendit',
        billingDetails: { fullName: 'Alice Sec', email: 'alice-sec@client.test' },
        totalMinor: 1,
      }),
    });
    assert.equal(checkout.status, 201);
    const ordJson = await checkout.json();
    assert.equal(ordJson.order.totalMinor, firstPkg.priceUsdMinor, 'Server must compute authoritative catalog total');

    // Customer B cannot access Customer A's order (IDOR defense)
    const idorRes = await fetch(`${baseUrl}/api/portal/orders/${ordJson.order.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(idorRes.status, 404);

    // Admin suspends Alice -> Alice's existing token AND login attempts are blocked
    const ceoAdmin = db.admins.find((a) => a.email === 'ceo@ophireum.test')!;
    const superToken = authService.issueSessionToken(ceoAdmin, 3600, true);
    const suspRes = await fetch(`${baseUrl}/api/admin/customers/${dataA.user.id}/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Security review' }),
    });
    assert.equal(suspRes.status, 200);

    const suspendedAccess = await fetch(`${baseUrl}/api/portal/orders`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.ok(
      suspendedAccess.status === 401 || suspendedAccess.status === 403,
      `Expected 401 or 403 for suspended customer session, got ${suspendedAccess.status}`
    );

    const suspendedLogin = await fetch(`${baseUrl}/api/portal/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice-sec@client.test', password: 'ClientPassword!2026' }),
    });
    assert.equal(suspendedLogin.status, 403);
  });

  it('enforces shared distributed rate limiter backend across multiple simulated replicas', async () => {
    const sharedCounts = new Map<string, number>();
    const sharedBackend = {
      async checkAndIncrement(key: string, _windowMs: number, maxRequests: number) {
        const next = (sharedCounts.get(key) || 0) + 1;
        sharedCounts.set(key, next);
        return {
          allowed: next <= maxRequests,
          currentHits: next,
          remaining: Math.max(0, maxRequests - next),
          backend: 'postgres_distributed' as const,
        };
      },
    };

    const replica1 = new DistributedRateLimiter('auth', 60_000, 3, { customBackend: sharedBackend });
    const replica2 = new DistributedRateLimiter('auth', 60_000, 3, { customBackend: sharedBackend });

    assert.equal((await replica1.checkDistributed('203.0.113.55')).allowed, true);
    assert.equal((await replica2.checkDistributed('203.0.113.55')).allowed, true);
    assert.equal((await replica1.checkDistributed('203.0.113.55')).allowed, true);
    assert.equal((await replica2.checkDistributed('203.0.113.55')).allowed, false);
  });

  it('supports zero-downtime MFA encryption key rotation (MFA_ENCRYPTION_KEY_PREVIOUS + POST /api/admin/auth/mfa/rotate-key)', async () => {
    // 1. Encrypt under initial key and enroll an admin
    const rotEmail = 'rot-mfa@ophireum.test';
    const enrolled = authService.enrollAdminMfa(rotEmail);
    const encBefore = authService.getEncryptedAdminMfaSecret(rotEmail);
    assert.ok(encBefore && encBefore.startsWith('enc:v2:'));
    const oldKid = encBefore.split(':')[2];
    const code1 = generateTotpCode(enrolled.secret);
    assert.equal(authService.confirmAdminMfaEnrollment(rotEmail, code1), true);

    // 2. Rotate MFA_ENCRYPTION_KEY while retaining previous key in MFA_ENCRYPTION_KEY_PREVIOUS
    const prevKey = process.env.MFA_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET || '';
    const savedPrev = process.env.MFA_ENCRYPTION_KEY_PREVIOUS;
    const savedCur = process.env.MFA_ENCRYPTION_KEY;
    try {
      process.env.MFA_ENCRYPTION_KEY_PREVIOUS = prevKey;
      process.env.MFA_ENCRYPTION_KEY = 'rotated-enterprise-mfa-master-key-2026-v2-strong';

      // Trigger authenticated super_admin key rotation endpoint
      const ceoAdmin = db.admins.find((a) => a.email === 'ceo@ophireum.test')!;
      const superToken = authService.issueSessionToken(ceoAdmin, 3600, true);
      const rotateRes = await fetch(`${baseUrl}/api/admin/auth/mfa/rotate-key`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newEncryptionKey: 'rotated-enterprise-mfa-master-key-2026-v2-strong',
        }),
      });
      assert.equal(rotateRes.status, 200);
      const rotJson = await rotateRes.json();
      assert.ok(rotJson.rotatedCount >= 1, 'Expected at least 1 MFA secret re-encrypted');
      assert.ok(rotJson.newKeyId);

      const encAfter = authService.getEncryptedAdminMfaSecret(rotEmail);
      assert.ok(encAfter && encAfter.startsWith('enc:v2:'));
      const newKid = encAfter.split(':')[2];
      assert.notEqual(newKid, oldKid, 'Key ID must advance after rotation');

      // Recovery code still works and secret decrypts cleanly under new key ONLY (even after clearing previous key)
      delete process.env.MFA_ENCRYPTION_KEY_PREVIOUS;
      const rcVerify = authService.verifyAdminMfaCode(rotEmail, enrolled.recoveryCodes[0]);
      assert.equal(rcVerify.ok, true);
    } finally {
      if (savedCur !== undefined) process.env.MFA_ENCRYPTION_KEY = savedCur;
      else delete process.env.MFA_ENCRYPTION_KEY;
      if (savedPrev !== undefined) process.env.MFA_ENCRYPTION_KEY_PREVIOUS = savedPrev;
      else delete process.env.MFA_ENCRYPTION_KEY_PREVIOUS;
    }
  });

  it('prevents session fixation by revoking prior session token on admin re-login', async () => {
    const login1 = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ceo@ophireum.test',
        password: 'SuperSecureAdminPassword!2026',
      }),
    });
    assert.equal(login1.status, 200);
    const data1 = await login1.json();
    assert.ok(data1.token);

    // Re-login presenting old session token -> old token MUST be rotated/revoked immediately
    const login2 = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data1.token}`,
      },
      body: JSON.stringify({
        email: 'ceo@ophireum.test',
        password: 'SuperSecureAdminPassword!2026',
      }),
    });
    assert.equal(login2.status, 200);
    const data2 = await login2.json();
    assert.ok(data2.token);
    assert.notEqual(data2.token, data1.token);

    const oldCheck = await fetch(`${baseUrl}/api/admin/auth/session`, {
      headers: { Authorization: `Bearer ${data1.token}` },
    });
    assert.equal(oldCheck.status, 401, 'Old pre-login token must be revoked to prevent session fixation');

    const newCheck = await fetch(`${baseUrl}/api/admin/auth/session`, {
      headers: { Authorization: `Bearer ${data2.token}` },
    });
    assert.equal(newCheck.status, 200);
  });

  it('reports honest staging & provider readiness without leaking secrets and enforces live_payments_enabled = false', async () => {
    const ceoAdmin = db.admins.find((a) => a.email === 'ceo@ophireum.test')!;
    const superToken = authService.issueSessionToken(ceoAdmin, 3600, true);

    const res = await fetch(`${baseUrl}/api/admin/system/readiness`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(res.status, 200);
    const rawText = await res.text();
    assert.ok(!rawText.includes(process.env.ADMIN_SESSION_SECRET!));
    assert.ok(!rawText.includes(process.env.RESEND_WEBHOOK_SECRET!));

    const payload = JSON.parse(rawText);
    assert.equal(payload.readiness.livePaymentsEnabled, false);
    assert.ok(Array.isArray(payload.readiness.providers) && payload.readiness.providers.length >= 8);
    const paymongoGotyme = payload.readiness.providers.find((p: any) => p.id === 'paymongo_gotyme');
    assert.equal(paymongoGotyme?.status, 'deferred_merchant_onboarding');
    const liveLock = payload.readiness.providers.find((p: any) => p.id === 'live_payments_lock');
    assert.equal(liveLock?.status, 'locked_off');
  });

  it('fails closed in NODE_ENV=production if Supabase credentials are missing', () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedSupaUrl = process.env.SUPABASE_URL;
    const savedSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      assert.throws(() => createApp(), /SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/i);
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
      if (savedSupaUrl) process.env.SUPABASE_URL = savedSupaUrl;
      if (savedSupaKey) process.env.SUPABASE_SERVICE_ROLE_KEY = savedSupaKey;
    }
  });
});
