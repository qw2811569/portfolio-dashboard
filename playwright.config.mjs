import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 120000,
  reporter: [
    ['html', { outputFolder: 'test-results', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  outputDir: '.playwright-artifacts',
  use: {
    actionTimeout: 20000,
    navigationTimeout: 60000,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'ios-safari', use: { ...devices['iPhone 14'] } },
  ],
})
