// @ts-check
const { defineConfig } = require('@playwright/test');
const isTermux = Boolean(process.env.TERMUX_VERSION);
const chromiumExecutablePath = '/data/data/com.termux/files/usr/bin/chromium-browser';
const configuredExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

module.exports = defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.js', 'tests/e2e/**/*.spec.cjs'],
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
    launchOptions: configuredExecutablePath
      ? {
          executablePath: configuredExecutablePath,
          args: ['--no-sandbox', '--disable-dev-shm-usage']
        }
      : isTermux
      ? {
          executablePath: chromiumExecutablePath,
          args: ['--no-sandbox', '--disable-dev-shm-usage']
        }
      : undefined,
  },
  webServer: {
    command: 'npm run start',
    port: 8000,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
