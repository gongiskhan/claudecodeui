import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // Run tests sequentially for worktree tests to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid conflicts with database/file operations
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4567',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'PORT=3456 npm run server',
      port: 3456,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'VITE_PORT=4567 npm run client',
      port: 4567,
      reuseExistingServer: !process.env.CI,
    }
  ],
});