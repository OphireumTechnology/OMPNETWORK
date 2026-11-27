import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

const chromiumMediaLaunchOptions = {
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          ...process.env,
          PORT: '3000',
          ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || 'e2e-admin@ophireum.test',
          ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'OphireumE2EAdminPass!2026',
          ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET || 'ophireum-e2e-session-secret-0123456789abcdef',
          MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY || 'ophireum-e2e-mfa-encryption-key-0123456789abcdef',
        },
      },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: chromiumMediaLaunchOptions,
      },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro 11'],
        permissions: ['microphone'],
        launchOptions: chromiumMediaLaunchOptions,
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        permissions: ['microphone'],
        launchOptions: chromiumMediaLaunchOptions,
      },
    },
  ],
});
