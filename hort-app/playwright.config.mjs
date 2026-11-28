import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8094',
    actionTimeout: 15_000,
    viewport: { width: 393, height: 852 },
    screenshot: 'only-on-failure',
    // Traces can record the synthetic credentials entered during login.
    trace: 'off',
    launchOptions: process.env.HORT_E2E_CHROMIUM
      ? { executablePath: process.env.HORT_E2E_CHROMIUM }
      : {},
  },
  webServer: {
    command: 'npx expo start --web --port 8094',
    url: 'http://127.0.0.1:8094',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8214/api/v1/',
    },
  },
});
