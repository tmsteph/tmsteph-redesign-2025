import { defineConfig } from '@playwright/test';

const isTermux = Boolean(process.env.TERMUX_VERSION);
const chromiumExecutablePath = '/data/data/com.termux/files/usr/bin/chromium-browser';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    launchOptions: isTermux
      ? {
          executablePath: chromiumExecutablePath,
          args: ['--no-sandbox', '--disable-dev-shm-usage']
        }
      : undefined
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
