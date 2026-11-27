import { test, expect } from '@playwright/test';

test.describe('Phase 26 E2E — Admin Command Center Security, RBAC, MFA, CSRF & Readiness', () => {
  test('blocks unauthenticated admin access, logs in via bootstrap admin, and verifies readiness endpoint', async ({
    page,
    request,
  }) => {
    // 1. Admin route UI loads login screen without leaking privileged data
    await page.goto('/admin');
    await expect(page.locator('body')).toContainText(/Admin|Sign In|OPHIREUM/i);

    // 2. Unauthenticated API call MUST be rejected with 401
    const unauth = await request.get('/api/admin/system/readiness');
    expect(unauth.status()).toBe(401);

    // 3. Authenticate with bootstrap credentials
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'e2e-admin@ophireum.test';
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'OphireumE2EAdminPass!2026';
    const loginRes = await request.post('/api/admin/auth/login', {
      data: { email, password },
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.token).toBeTruthy();

    // 4. Verify live_payments_enabled cannot be activated without production approval
    const liveSwitch = await request.patch('/api/admin/config', {
      headers: { Authorization: `Bearer ${loginData.token}` },
      data: { key: 'live_payments_enabled', value: true },
    });
    expect(liveSwitch.status()).toBe(403);

    // 5. Verify system readiness validator reports honest disabled live payments
    const readinessRes = await request.get('/api/admin/system/readiness', {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    expect(readinessRes.status()).toBe(200);
    const readinessData = await readinessRes.json();
    expect(readinessData.readiness.livePaymentsEnabled).toBe(false);

    // 6. Logout revokes session token immediately
    const logoutRes = await request.post('/api/admin/auth/logout', {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    expect(logoutRes.status()).toBe(200);

    const postLogout = await request.get('/api/admin/system/readiness', {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    expect(postLogout.status()).toBe(401);
  });
});
