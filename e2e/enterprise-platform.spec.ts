import { test, expect } from '@playwright/test';

test.describe('Enterprise Reliability, Accessibility, Privacy & Legal Governance E2E', () => {
  test('exposes structured health, readiness, and version endpoints without leaking secrets', async ({ request }) => {
    const healthRes = await request.get('/api/health');
    expect(healthRes.ok()).toBeTruthy();
    const health = await healthRes.json();
    expect(['healthy', 'degraded', 'unconfigured']).toContain(health.status);
    expect(health.dependencies).toBeTruthy();
    expect(health.circuitBreakers).toBeTruthy();

    const serialized = JSON.stringify(health);
    expect(serialized).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|ADMIN_SESSION_SECRET|GEMINI_API_KEY|RESEND_API_KEY/i);

    const readyRes = await request.get('/api/ready');
    expect([200, 503]).toContain(readyRes.status());
    const ready = await readyRes.json();
    expect(typeof ready.ready).toBe('boolean');

    const versionRes = await request.get('/api/version');
    expect(versionRes.ok()).toBeTruthy();
    const version = await versionRes.json();
    expect(version.packageName).toBe('ophireum-network');
    expect(typeof version.nodeVersion).toBe('string');
  });

  test('renders OPHIREUM homepage with zero horizontal overflow, clean headings, and accessible navigation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - window.innerWidth;
    });
    expect(overflow).toBeLessThanOrEqual(4);
    expect(consoleErrors).toEqual([]);
  });

  test('navigates to legal compliance pages and preserves Data Privacy / Legal Review disclosure', async ({ page }) => {
    await page.goto('/legal/privacy');
    await expect(page.locator('body')).toContainText(/Privacy|Data Privacy|RA 10173/i);
  });

  test('records AI conversation consent and exports RA 10173 portability bundle cleanly', async ({ request }) => {
    const chatRes = await request.post('/api/consultant/chat', {
      data: {
        userMessage: 'We need an enterprise web platform with AI automation.',
        language: 'en-US',
      },
    });
    expect(chatRes.ok()).toBeTruthy();
    const chatData = await chatRes.json();
    expect(chatData.sessionId).toBeTruthy();
    expect(chatData.sessionToken).toBeTruthy();

    const consentRes = await request.post(`/api/consultant/session/${chatData.sessionId}/consent`, {
      headers: {
        'x-session-token': chatData.sessionToken,
      },
      data: {
        consentType: 'conversation_memory',
        granted: true,
        policyVersion: '2026.1',
      },
    });
    expect(consentRes.ok()).toBeTruthy();
    const consentData = await consentRes.json();
    expect(consentData.success).toBe(true);
    expect(consentData.consent.granted).toBe(true);

    const exportRes = await request.get(`/api/consultant/session/${chatData.sessionId}/export`, {
      headers: {
        'x-session-token': chatData.sessionToken,
      },
    });
    expect(exportRes.ok()).toBeTruthy();
    const exportData = await exportRes.json();
    expect(exportData.success).toBe(true);
    expect(Array.isArray(exportData.export.messages)).toBe(true);
    expect(exportData.export.messages.length).toBeGreaterThanOrEqual(2);
  });
});
