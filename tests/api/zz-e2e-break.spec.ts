import { test, expect } from '@playwright/test';

// TEMPORARY: fails on purpose to check Jenkins → n8n → Jira/email/Excel end to end
// (n8n/README.md). Remove this file after the check.
test('E2E check: health returns 201 (deliberately wrong)', { tag: ['@api', '@smoke'] }, async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(201);
});
