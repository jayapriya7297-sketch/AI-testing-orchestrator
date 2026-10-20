import { defineConfig, devices } from '@playwright/test';
import { env } from './fixtures/env';

export const STORAGE_STATE = '.auth/user.json';

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: env.webUrl },
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.apiUrl },
    },
    {
      name: 'db',
      testDir: './tests/db',
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.webUrl,
        storageState: STORAGE_STATE,
      },
    },
    // AI-generated drafts in review/specs: only with RUN_REVIEW=1, so they never run in the normal suite.
    ...(process.env.RUN_REVIEW === '1'
      ? [
          {
            name: 'review',
            testDir: './review/specs',
            dependencies: ['setup'],
            use: {
              ...devices['Desktop Chrome'],
              baseURL: env.webUrl,
              storageState: STORAGE_STATE,
            },
          },
        ]
      : []),
  ],
});
