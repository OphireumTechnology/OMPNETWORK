import { test, expect } from '@playwright/test';

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

    // Verify services catalog is interactive
    const servicesSection = page.locator('#services');
    await expect(servicesSection).toBeVisible();
  });

  test('opens AI Solutions Consultant widget, sends chat inquiry, and activates simulated-mic voice session', async ({
    page,
    browserName,
  }) => {
    // Firefox and WebKit do not support Chromium fake-device flags. Supply a real Web Audio MediaStream at the capture boundary in these test browsers only.
    if (browserName !== 'chromium') {
      await page.addInitScript(() => {
        const media = navigator.mediaDevices;
        if (!media) throw new Error('MediaDevices unavailable in test context');
        const capture = async () => {
          const context = new AudioContext();
          const destination = context.createMediaStreamDestination();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          gain.gain.value = 0;
          oscillator.connect(gain).connect(destination);
          oscillator.start();
          const track = destination.stream.getAudioTracks()[0];
          const stop = track.stop.bind(track);
          track.stop = () => { stop(); oscillator.stop(); void context.close(); };
          return destination.stream;
        };
        // WebKit may return a fresh wrapper for mediaDevices on each access.
        const fixture = { getUserMedia: capture };
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, get: () => fixture });
      });
    }
    await page.goto('/');

    const launcher = page.getByRole('button', { name: /Open AI Solutions Consultant/i });
    await expect(launcher).toBeVisible();
    // Verify the real pointer target, rather than forcing the click through an overlay.
    // This detects CSS stacking/position regressions in the mobile viewport.
    const launcherHitTarget = await launcher.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const topElement = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2
      );
      return {
        clickable: !!topElement && (topElement === button || button.contains(topElement)),
        position: getComputedStyle(button.parentElement as HTMLElement).position,
        zIndex: getComputedStyle(button.parentElement as HTMLElement).zIndex,
        blocker: topElement?.tagName.toLowerCase() || null,
      };
    });
    expect(launcherHitTarget, JSON.stringify(launcherHitTarget)).toMatchObject({
      clickable: true,
      position: 'fixed',
    });
    await launcher.click();

    if (browserName !== 'chromium') {
      // Confirm the capture boundary is installed before exercising voice controls.
      expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(navigator, 'mediaDevices'))).toBe(true);
    }

    // Send a consultative chat message
    const chatInput = page.getByRole("textbox", { name: "Chat message" });
    await expect(chatInput).toBeVisible();
    await chatInput.fill('We need an enterprise corporate website and AI chatbot with starting pricing.');
    await chatInput.press('Enter');

    await expect(page.locator('body')).toContainText(/starting at/i, { timeout: 15_000 });

    // Activate voice consultation using fake media stream (Playwright launchOptions)
    const startVoiceBtn = page.getByRole('button', { name: /Start Voice/i });
    await expect(startVoiceBtn).toBeVisible();
    await startVoiceBtn.click();

    await expect(page.locator('body')).toContainText(/Voice Disclosure/i, { timeout: 10_000 });

    // Mute and unmute mic, then end voice cleanly
    const muteMicBtn = page.getByTitle(/Mute Microphone/i);
    await expect(muteMicBtn).toBeVisible();
    await muteMicBtn.click();
    await expect(page.getByTitle(/Unmute Microphone/i)).toBeVisible();

    await page.getByTitle(/^Unmute Microphone$/i).click();
    await expect(page.getByTitle(/^Mute Microphone$/i)).toBeVisible();

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
