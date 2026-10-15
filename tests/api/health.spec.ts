import { test, expect } from '@playwright/test';
import Ajv from 'ajv';

const healthSchema = {
  type: 'object',
  properties: {
    status: { const: 'OK' },
    db: { const: 'up' },
  },
  required: ['status', 'db'],
  additionalProperties: false,
};

test('GET /api/health reports API and DB up @smoke @api', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  const body = await response.json();
  const validate = new Ajv().compile(healthSchema);
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
});
