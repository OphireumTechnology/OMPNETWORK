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
    const sanitizedConsoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const clean = msg
          .text()
          .replace(/(Bearer\s+|token=|secret=|key=)[^\s,&"']+/gi, '$1[REDACTED]')
          .slice(0, 300);
        if (sanitizedConsoleErrors.length < 25) {
          sanitizedConsoleErrors.push(clean);
        }
      }
    });
    page.on('pageerror', (err) => {
      if (sanitizedConsoleErrors.length < 25) {
        sanitizedConsoleErrors.push(`pageerror: ${String(err.message || err).slice(0, 300)}`);
      }
    });

    // Headless WebKit on Linux (Desktop Safari + iPad Pro 11 tablet) lacks virtual microphone CLI flags and
    // unsupported permissions API, AND JavaScriptCore garbage-collects unretained navigator.mediaDevices wrappers
    // causing own-property patches to revert to native getUserMedia. Patch MediaDevices.prototype AND retain the
    // test-only fixture cleanly (strictly isolated to E2E tests, never in production code).
    if (browserName === 'webkit') {
      await page.addInitScript(() => {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const retainedContexts: Array<{ ctx: AudioContext; osc: OscillatorNode }> = [];
        const trackedAudioTracks: Array<{ enabled: boolean; readyState: string }> = [];

        (window as unknown as Record<string, unknown>).__ophireumWebkitVoiceFixture = {
          getUserMediaCalls: 0,
          getLatestTrackState: () => {
            const latest = trackedAudioTracks[trackedAudioTracks.length - 1];
            if (!latest) return null;
            return { enabled: Boolean(latest.enabled), readyState: String(latest.readyState) };
          },
          getTrackCount: () => trackedAudioTracks.length,
        };

        const createControlledStream = (): MediaStream => {
          const fixture = (window as unknown as Record<string, { getUserMediaCalls: number }>)
            .__ophireumWebkitVoiceFixture;
          fixture.getUserMediaCalls += 1;

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
                const track = audioTracks[0];
                const entry = { ctx, osc };
                retainedContexts.push(entry);
                trackedAudioTracks.push(track);
                const origStop = track.stop.bind(track);
                track.stop = () => {
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
          trackedAudioTracks.push(track);

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

        // Patch MediaDevices.prototype so newly-materialized JSC DOM wrappers in WebKit ALWAYS use the fixture
        if (typeof MediaDevices !== 'undefined' && MediaDevices.prototype) {
          try {
            Object.defineProperty(MediaDevices.prototype, 'getUserMedia', {
              configurable: true,
              writable: true,
              value: testGetUserMedia,
            });
            Object.defineProperty(MediaDevices.prototype, 'enumerateDevices', {
              configurable: true,
              writable: true,
              value: testEnumerateDevices,
            });
          } catch {
            // Fall through to instance/navigator definition below
          }
        }

        if (!navigator.mediaDevices) {
          Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: {
              getUserMedia: testGetUserMedia,
              enumerateDevices: testEnumerateDevices,
            },
          });
        } else {
          // Retain the current wrapper on window so JSC never sweeps own-property overrides either
          (window as unknown as Record<string, unknown>).__ophireumPinnedMediaDevices = navigator.mediaDevices;
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

    const observedLifecycles: string[] = [];
    const recordLifecycle = async (label: string) => {
      const state = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="voice-active-controls"]');
        return el
          ? `${el.getAttribute('data-voice-status') || ''}/${el.getAttribute('data-voice-lifecycle') || ''}`
          : 'inactive';
      });
      observedLifecycles.push(`${label}:${state}`);
    };

    try {
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

      // Active voice controls & Mute Microphone button
      const muteMicBtn = page.getByRole('button', { name: 'Mute Microphone' });
      await expect(muteMicBtn).toBeVisible({ timeout: 10_000 });
      await expect(muteMicBtn).toHaveAttribute('aria-pressed', 'false');
      await recordLifecycle('after-connect');

      if (browserName === 'webkit') {
        const trackBeforeMute = await page.evaluate(() => {
          const fx = (window as unknown as Record<string, { getLatestTrackState: () => { enabled: boolean; readyState: string } | null }>)
            .__ophireumWebkitVoiceFixture;
          return fx?.getLatestTrackState() ?? null;
        });
        expect(trackBeforeMute).toEqual({ enabled: true, readyState: 'live' });
      }

      // Mute Microphone -> verify Unmute Microphone + aria-pressed + actual MediaStreamTrack.enabled === false
      await muteMicBtn.click();
      const unmuteMicBtn = page.getByRole('button', { name: 'Unmute Microphone' });
      await expect(unmuteMicBtn).toBeVisible();
      await expect(unmuteMicBtn).toHaveAttribute('aria-pressed', 'true');
      await recordLifecycle('after-mute');

      if (browserName === 'webkit') {
        const trackMuted = await page.evaluate(() => {
          const fx = (window as unknown as Record<string, { getLatestTrackState: () => { enabled: boolean; readyState: string } | null }>)
            .__ophireumWebkitVoiceFixture;
          return fx?.getLatestTrackState() ?? null;
        });
        expect(trackMuted).toEqual({ enabled: false, readyState: 'live' });
      }

      // Unmute Microphone -> verify Mute Microphone + aria-pressed + actual MediaStreamTrack.enabled === true
      await unmuteMicBtn.click();
      await expect(page.getByRole('button', { name: 'Mute Microphone' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Mute Microphone' })).toHaveAttribute('aria-pressed', 'false');
      await recordLifecycle('after-unmute');

      if (browserName === 'webkit') {
        const trackUnmuted = await page.evaluate(() => {
          const fx = (window as unknown as Record<string, { getLatestTrackState: () => { enabled: boolean; readyState: string } | null }>)
            .__ophireumWebkitVoiceFixture;
          return fx?.getLatestTrackState() ?? null;
        });
        expect(trackUnmuted).toEqual({ enabled: true, readyState: 'live' });
      }

      // Speaker Mute & Unmute controls
      const muteSpeakerBtn = page.getByRole('button', { name: 'Mute Speaker Output' });
      await expect(muteSpeakerBtn).toBeVisible();
      await expect(muteSpeakerBtn).toHaveAttribute('aria-pressed', 'false');
      await muteSpeakerBtn.click();
      const unmuteSpeakerBtn = page.getByRole('button', { name: 'Unmute Speaker Output' });
      await expect(unmuteSpeakerBtn).toBeVisible();
      await expect(unmuteSpeakerBtn).toHaveAttribute('aria-pressed', 'true');
      await unmuteSpeakerBtn.click();
      await expect(page.getByRole('button', { name: 'Mute Speaker Output' })).toHaveAttribute('aria-pressed', 'false');

      // End Voice Conversation cleanly -> returns to Start Voice and stops live track
      const endVoiceBtn = page.getByRole('button', { name: 'End Voice Conversation' });
      await expect(endVoiceBtn).toBeVisible();
      await endVoiceBtn.click();
      await expect(page.getByRole('button', { name: /Start Voice/i })).toBeVisible();
      await recordLifecycle('after-end');

      if (browserName === 'webkit') {
        const trackStopped = await page.evaluate(() => {
          const fx = (window as unknown as Record<string, { getLatestTrackState: () => { enabled: boolean; readyState: string } | null }>)
            .__ophireumWebkitVoiceFixture;
          return fx?.getLatestTrackState() ?? null;
        });
        expect(trackStopped?.readyState).toBe('ended');
      }

      // Session Restart Verification: Start Voice -> Consent -> Active Controls -> End cleanly
      await page.getByRole('button', { name: /Start Voice/i }).click();
      await expect(page.getByTestId('voice-disclosure-panel')).toBeVisible();
      await page.getByTestId('voice-consent-confirm').click();
      await expect(page.getByRole('button', { name: 'Mute Microphone' })).toBeVisible({ timeout: 10_000 });
      await recordLifecycle('after-restart');
      await page.getByRole('button', { name: 'End Voice Conversation' }).click();
      await expect(page.getByRole('button', { name: /Start Voice/i })).toBeVisible();
    } catch (err) {
      await recordLifecycle('on-failure');
      const voiceDiag = await page.evaluate(() => {
        const activeBar = document.querySelector<HTMLElement>('[data-testid="voice-active-controls"]');
        const dialogEl = document.querySelector<HTMLElement>('[data-testid="ai-consultant-dialog"]');
        return {
          hasActiveControls: Boolean(activeBar),
          voiceStatus: activeBar?.getAttribute('data-voice-status') || null,
          voiceLifecycle: activeBar?.getAttribute('data-voice-lifecycle') || null,
          micMuted: activeBar?.getAttribute('data-mic-muted') || null,
          speakerMuted: activeBar?.getAttribute('data-speaker-muted') || null,
          consentPanelVisible: Boolean(document.querySelector('[data-testid="voice-consent-confirm"]')),
          dialogTextSnippet: (dialogEl?.innerText || '').slice(0, 600),
        };
      });
      await fs.writeFile(
        testInfo.outputPath('voice-failure-diagnostics.json'),
        JSON.stringify(
          {
            project: testInfo.project.name,
            browserName,
            observedLifecycles,
            voiceDiag,
            sanitizedConsoleErrors,
          },
          null,
          2
        ),
        'utf8'
      );
      throw err;
    }
  });

  test('navigates cleanly to Legal & Compliance Trust Center routes', async ({ page }) => {
    await page.goto('/legal/privacy-policy');
    await expect(page.locator('body')).toContainText(/Privacy Policy/i);
    await expect(page.locator('body')).toContainText(/RA 10173|Data Privacy Act/i);
  });
});
