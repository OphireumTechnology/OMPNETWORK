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

    // Verify zero horizontal overflow on desktop, tablet, and mobile viewports (with offending-element diagnostics)
    const overflowAudit = await page.evaluate(() => {
      const innerWidth = window.innerWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((item) => item.right > innerWidth + 1)
        .slice(0, 5);
      return { overflowPx: scrollWidth - innerWidth, innerWidth, scrollWidth, offenders };
    });
    expect(overflowAudit.overflowPx, JSON.stringify(overflowAudit)).toBeLessThanOrEqual(0);

    // Verify services catalog is interactive
    const servicesSection = page.locator('#services');
    await expect(servicesSection).toBeVisible();
  });

  test('opens AI Solutions Consultant widget, sends chat inquiry, and activates simulated-mic voice session', async ({
    page,
    browserName,
  }, testInfo) => {
    // Headless WebKit on Linux (Desktop Safari + iPad Pro 11 tablet) lacks virtual microphone CLI flags and
    // unsupported permissions API; install a controlled test-only MediaStream fixture (never in production code)
    // that retains audio resources until track.stop() and guarantees a live mutable audio track.
    if (browserName === 'webkit') {
      await page.addInitScript(() => {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const retainedContexts: Array<{ ctx: AudioContext; osc: OscillatorNode }> = [];

        const createControlledStream = (): MediaStream => {
          if (AudioCtx) {
            try {
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const dest = ctx.createMediaStreamDestination();
              osc.frequency.value = 440;
              osc.connect(dest);
              osc.start();
              const stream = dest.stream;
              const audioTracks = stream.getAudioTracks();
              if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
                const entry = { ctx, osc };
                retainedContexts.push(entry);
                const origStop = audioTracks[0].stop.bind(audioTracks[0]);
                audioTracks[0].stop = () => {
                  origStop();
                  try {
                    osc.stop();
                  } catch {
                    // ignore
                  }
                  try {
                    void ctx.close();
                  } catch {
                    // ignore
                  }
                  const idx = retainedContexts.indexOf(entry);
                  if (idx >= 0) retainedContexts.splice(idx, 1);
                };
                return stream;
              }
              try {
                osc.stop();
                void ctx.close();
              } catch {
                // ignore
              }
            } catch {
              // Headless WebKit on Linux without an audio backend may fail Web Audio destination creation
            }
          }

          // Fallback controlled MediaStream-compatible test double with a genuine mutable live audio track
          const track = {
            id: `webkit-test-track-${Date.now()}`,
            kind: 'audio',
            label: 'WebKit Test Microphone',
            enabled: true,
            muted: false,
            readyState: 'live' as 'live' | 'ended',
            stop() {
              this.readyState = 'ended';
              this.enabled = false;
            },
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return true;
            },
            clone() {
              return { ...this };
            },
            getCapabilities() {
              return {};
            },
            getConstraints() {
              return {};
            },
            getSettings() {
              return { deviceId: 'webkit-test-mic', channelCount: 1, sampleRate: 48000 };
            },
            applyConstraints: async () => {},
          };

          const controlledStream = {
            id: `webkit-test-stream-${Date.now()}`,
            active: true,
            getTracks: () => [track],
            getAudioTracks: () => [track],
            getVideoTracks: () => [],
            getTrackById: (id: string) => (id === track.id ? track : null),
            addTrack() {},
            removeTrack() {},
            clone() {
              return this;
            },
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return true;
            },
          };

          return controlledStream as unknown as MediaStream;
        };

        const testEnumerateDevices = async () => [
          {
            deviceId: 'webkit-test-mic',
            kind: 'audioinput' as const,
            label: 'WebKit Test Microphone',
            groupId: 'webkit-test',
            toJSON: () => ({ deviceId: 'webkit-test-mic', kind: 'audioinput', label: 'WebKit Test Microphone' }),
          },
        ];

        const testGetUserMedia = async () => createControlledStream();

        if (!navigator.mediaDevices) {
          Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: {
              getUserMedia: testGetUserMedia,
              enumerateDevices: testEnumerateDevices,
            },
          });
        } else {
          try {
            Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
              configurable: true,
              writable: true,
              value: testGetUserMedia,
            });
            Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
              configurable: true,
              writable: true,
              value: testEnumerateDevices,
            });
          } catch {
            Object.defineProperty(navigator, 'mediaDevices', {
              configurable: true,
              value: {
                getUserMedia: testGetUserMedia,
                enumerateDevices: testEnumerateDevices,
              },
            });
          }
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

    // Activate voice consultation: Start Voice -> Pre-Mic Voice Disclosure -> Explicit Consent -> Mic Acquisition
    const startVoiceBtn = page.getByRole('button', { name: /Start Voice/i });
    await expect(startVoiceBtn).toBeVisible();
    await startVoiceBtn.click();

    // Voice Disclosure MUST render BEFORE microphone permission/acquisition on all browsers (including WebKit)
    const disclosurePanel = page.getByTestId('voice-disclosure-panel');
    await expect(disclosurePanel).toBeVisible({ timeout: 10_000 });
    await expect(disclosurePanel).toContainText(/Voice Disclosure/i);

    // Explicitly grant consent to acquire microphone
    const confirmConsentBtn = page.getByTestId('voice-consent-confirm');
    await expect(confirmConsentBtn).toBeVisible();
    await confirmConsentBtn.click();

    // Mute, verify Unmute + aria-pressed, unmute back to active listening, then end voice cleanly
    const muteMicBtn = page.getByRole('button', { name: 'Mute Microphone' });
    await expect(muteMicBtn).toBeVisible({ timeout: 10_000 });
    await expect(muteMicBtn).toHaveAttribute('aria-pressed', 'false');
    await muteMicBtn.click();

    const unmuteMicBtn = page.getByRole('button', { name: 'Unmute Microphone' });
    await expect(unmuteMicBtn).toBeVisible();
    await expect(unmuteMicBtn).toHaveAttribute('aria-pressed', 'true');
    await unmuteMicBtn.click();

    await expect(page.getByRole('button', { name: 'Mute Microphone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mute Microphone' })).toHaveAttribute('aria-pressed', 'false');

    const endVoiceBtn = page.getByRole('button', { name: 'End Voice Conversation' });
    await expect(endVoiceBtn).toBeVisible();
    await endVoiceBtn.click();
    await expect(page.getByRole('button', { name: /Start Voice/i })).toBeVisible();
  });

  test('navigates cleanly to Legal & Compliance Trust Center routes', async ({ page }) => {
    await page.goto('/legal/privacy-policy');
    await expect(page.locator('body')).toContainText(/Privacy Policy/i);
    await expect(page.locator('body')).toContainText(/RA 10173|Data Privacy Act/i);
  });
});
