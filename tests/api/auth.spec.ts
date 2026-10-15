import { test, expect } from '@playwright/test';
import { env } from '../../fixtures/env';
import { loginResponseSchema } from '../../schemas/auth.schema';
import { errorSchema, validationErrorSchema } from '../../schemas/error.schema';
import { expenseListSchema } from '../../schemas/expense.schema';
import { expectSchema } from '../../schemas/validate';

const LOGIN = '/api/auth/login';

test.describe('POST /api/auth/login', { tag: '@api' }, () => {
  test.describe('valid credentials', () => {
    test('returns 200 with a token and the admin user', { tag: '@smoke' }, async ({ request }) => {
      const res = await request.post(LOGIN, {
        data: { email: env.adminEmail, password: env.adminPassword },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expectSchema(body, loginResponseSchema);
      expect(body.user).toMatchObject({ email: env.adminEmail, role: 'admin' });
      expect(JSON.stringify(body)).not.toContain('password');
    });

    test('returns role "user" for the regular user', { tag: '@regression' }, async ({ request }) => {
      const res = await request.post(LOGIN, {
        data: { email: env.userEmail, password: env.userPassword },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expectSchema(body, loginResponseSchema);
      expect(body.user).toMatchObject({ email: env.userEmail, role: 'user' });
    });

    test('returns a token that authorises GET /api/expenses', { tag: '@regression' }, async ({ request }) => {
      const login = await request.post(LOGIN, {
        data: { email: env.adminEmail, password: env.adminPassword },
      });
      const { token } = await login.json();

      const res = await request.get('/api/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status()).toBe(200);
      expectSchema(await res.json(), expenseListSchema);
    });

    test('accepts the email with surrounding spaces and different case', { tag: '@regression' }, async ({ request }) => {
      const res = await request.post(LOGIN, {
        data: { email: `  ${env.adminEmail.toUpperCase()}  `, password: env.adminPassword },
      });

      expect(res.status()).toBe(200);
      expect((await res.json()).user.email).toBe(env.adminEmail);
    });
  });

  test.describe('invalid credentials', { tag: '@regression' }, () => {
    test('returns 401 for a wrong password', async ({ request }) => {
      const res = await request.post(LOGIN, {
        data: { email: env.adminEmail, password: `${env.adminPassword}-wrong` },
      });

      expect(res.status()).toBe(401);
      const body = await res.json();
      expectSchema(body, errorSchema);
      expect(body.error).toBe('Invalid email or password');
    });

    test('returns 401 with the same message for an unknown email', async ({ request }) => {
      const res = await request.post(LOGIN, {
        data: { email: `nobody-${Date.now()}@test.com`, password: env.adminPassword },
      });

      expect(res.status()).toBe(401);
      const body = await res.json();
      expectSchema(body, errorSchema);
      expect(body.error).toBe('Invalid email or password');
    });
  });

  test.describe('validation', { tag: '@regression' }, () => {
    const cases: { name: string; data: Record<string, unknown>; fields: string[] }[] = [
      { name: 'email is missing', data: { password: 'x' }, fields: ['email'] },
      { name: 'password is missing', data: { email: 'a@test.com' }, fields: ['password'] },
      { name: 'both are missing', data: {}, fields: ['email', 'password'] },
      { name: 'email is not a string', data: { email: 123, password: 'x' }, fields: ['email'] },
      { name: 'email is blank', data: { email: '   ', password: 'x' }, fields: ['email'] },
      { name: 'password is an empty string', data: { email: 'a@test.com', password: '' }, fields: ['password'] },
    ];

    for (const c of cases) {
      test(`returns 400 when ${c.name}`, async ({ request }) => {
        const res = await request.post(LOGIN, { data: c.data });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expectSchema(body, validationErrorSchema);
        expect(body.details.map((d: { field: string }) => d.field)).toEqual(c.fields);
      });
    }

    test('returns 400 when the body is not valid JSON', async ({ request }) => {
      const res = await request.post(LOGIN, {
        headers: { 'Content-Type': 'application/json' },
        data: '{"email": "admin@test.com",',
      });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, errorSchema);
      expect(body.error).toBe('Request body is not valid JSON');
    });
  });
});
