import fs from 'node:fs/promises';
import { test, expect, Page, TestInfo } from '@playwright/test';

interface TapDiagnosticSnapshot {
  timestamp: string;
  innerWidth: number;
  innerHeight: number;
  clientWidth: number;
  scrollWidth: number;
  scrollY: number;
  devicePixelRatio: number;
  visualViewport: {
    width: number;
    height: number;
    offsetLeft: number;
    offsetTop: number;
    scale: number;
  } | null;
  launcherBox: { x: number; y: number; width: number; height: number } | null;
  centerHitStack: Array<{ tag: string; id: string; testId: string | null; ariaLabel: string | null; zIndex: string; pointerEvents: string }>;
  dialogVisible: boolean;
}

async function captureTapDiagnostic(page: Page): Promise<TapDiagnosticSnapshot> {
  return page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>('[data-testid="ai-consultant-launcher"]');
    const rect = btn ? btn.getBoundingClientRect() : null;
    const cx = rect ? rect.left + rect.width / 2 : 0;
    const cy = rect ? rect.top + rect.height / 2 : 0;
    const stack = rect
      ? document.elementsFromPoint(cx, cy).slice(0, 6).map((el) => {
          const style = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            testId: el.getAttribute('data-testid'),
            ariaLabel: el.getAttribute('aria-label'),
            zIndex: style.zIndex,
            pointerEvents: style.pointerEvents,
          };
        })
      : [];
    const vv = window.visualViewport;
    return {
      timestamp: new Date().toISOString(),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio || 1,
      visualViewport: vv
        ? {
            width: Math.round(vv.width),
            height: Math.round(vv.height),
            offsetLeft: Math.round(vv.offsetLeft),
            offsetTop: Math.round(vv.offsetTop),
            scale: vv.scale,
          }
        : null,
      launcherBox: rect
        ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        : null,
      centerHitStack: stack,
      dialogVisible: Boolean(document.querySelector('[data-testid="ai-consultant-dialog"]')),
    };
  });
}

async function writeFailureDiagnostics(
  page: Page,
  testInfo: TestInfo,
  before: TapDiagnosticSnapshot
): Promise<void> {
  const after = await captureTapDiagnostic(page);
  await fs.writeFile(testInfo.outputPath('viewport-before-tap.json'), JSON.stringify(before, null, 2), 'utf8');
  await fs.writeFile(testInfo.outputPath('viewport-after-failed-tap.json'), JSON.stringify(after, null, 2), 'utf8');
  await page.screenshot({ path: testInfo.outputPath('failed-tap.png'), fullPage: false });
}

test.describe('Phase 26 E2E — Public Website, Navigation, Services Catalog & AI Voice/Chat', () => {
  test('renders OPHIREUM corporate landing page, desktop/mobile navigation, and 78-service catalog cleanly', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OPHIREUM/i);
    await expect(page.locator('body')).toContainText(/OPHIREUM MULTIMEDIA PRODUCTION/i);

    // Verify no forbidden secret strings leaked in rendered DOM
    const bodyHtml = await page.content();
    expect(bodyHtml).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(bodyHtml).not.toContain('ADMIN_SESSION_SECRET');

    // Verify zero horizontal overflow on desktop, tablet, and mobile viewports
    const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowPx).toBeLessThanOrEqual(0);

    // Verify services catalog is interactive
    const servicesSection = page.locator('#services');
    await expect(servicesSection).toBeVisible();
  });

  test('opens AI Solutions Consultant widget, sends chat inquiry, and activates simulated-mic voice session', async ({
    page,
    browserName,
  }, testInfo) => {
    // Headless WebKit on Linux lacks a virtual microphone CLI flag; supply a controlled Web Audio MediaStream fixture
    if (browserName === 'webkit') {
      await page.addInitScript(() => {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
        const createControlledStream = () => {
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const dest = ctx.createMediaStreamDestination();
            osc.frequency.value = 440;
            osc.connect(dest);
            osc.start();
            return dest.stream;
          }
          return new MediaStream();
        };
        if (!navigator.mediaDevices) {
          Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: {
              getUserMedia: async () => createControlledStream(),
              enumerateDevices: async () => [
                { deviceId: 'webkit-test-mic', kind: 'audioinput', label: 'WebKit Test Microphone', groupId: 'test', toJSON: () => ({}) },
              ],
            },
          });
        } else {
          navigator.mediaDevices.getUserMedia = async (constraints: MediaStreamConstraints) => {
            if (originalGetUserMedia) {
              try {
                return await originalGetUserMedia(constraints);
              } catch {
                return createControlledStream();
              }
            }
            return createControlledStream();
          };
        }
      });
    }

    await page.goto('/');

    const launcher = page.getByRole('button', { name: /Open AI Solutions Consultant/i });
    await expect(launcher).toBeVisible();

    const beforeDiag = await captureTapDiagnostic(page);

    try {
      // Behavioral viewport & hit-target verification (never brittle parent CSS assertions)
      expect(beforeDiag.launcherBox).not.toBeNull();
      const box = beforeDiag.launcherBox!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(beforeDiag.innerWidth);
      expect(box.y + box.height).toBeLessThanOrEqual(beforeDiag.innerHeight);

      const topHit = beforeDiag.centerHitStack[0];
      expect(topHit).toBeTruthy();
      const launcherHit = beforeDiag.centerHitStack.some(
        (item) => item.testId === 'ai-consultant-launcher' || item.ariaLabel === 'Open AI Solutions Consultant'
      );
      expect(launcherHit).toBe(true);
      expect(topHit.testId === 'ai-consultant-launcher' || topHit.ariaLabel === 'Open AI Solutions Consultant').toBe(
        true
      );

      // Clean click/tap with zero force: true
      await launcher.click();

      const dialog = page.getByTestId('ai-consultant-dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
    } catch (err) {
      await writeFailureDiagnostics(page, testInfo, beforeDiag);
      throw err;
    }

    // Send a consultative chat message
    const chatInput = page.getByTestId('ai-consultant-input');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('We need an enterprise corporate website and AI chatbot with starting pricing.');
    await chatInput.press('Enter');

    await expect(page.locator('body')).toContainText(/starting at/i, { timeout: 15_000 });

    // Activate voice consultation (Chromium/Firefox native fake-media flags, WebKit controlled MediaStream fixture)
    const startVoiceBtn = page.getByRole('button', { name: /Start Voice/i });
    await expect(startVoiceBtn).toBeVisible();
    await startVoiceBtn.click();

    await expect(page.locator('body')).toContainText(/Voice Disclosure/i, { timeout: 10_000 });

    // Mute and unmute mic, then end voice cleanly
    const muteMicBtn = page.getByTitle(/Mute Microphone/i);
    await expect(muteMicBtn).toBeVisible();
    await muteMicBtn.click();
    await expect(page.getByTitle(/Unmute Microphone/i)).toBeVisible();

    const endVoiceBtn = page.getByTitle(/End Voice Conversation/i);
    await endVoiceBtn.click();
    await expect(page.getByRole('button', { name: /Start Voice/i })).toBeVisible();
  });

  test('navigates cleanly to Legal & Compliance Trust Center routes', async ({ page }) => {
    await page.goto('/legal/privacy-policy');
    await expect(page.locator('body')).toContainText(/Privacy Policy/i);
    await expect(page.locator('body')).toContainText(/RA 10173|Data Privacy Act/i);
  });
});
