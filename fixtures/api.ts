import { test as base, expect, request, type APIRequestContext } from '@playwright/test';
import { env } from './env';

type ApiFixtures = {
  /** Request context against API_URL with an admin Bearer token already attached. */
  apiContext: APIRequestContext;
};

export const test = base.extend<ApiFixtures>({
  apiContext: async ({}, use) => {
    const anonymous = await request.newContext({ baseURL: env.apiUrl });
    const response = await anonymous.post('/api/auth/login', {
      data: { email: env.adminEmail, password: env.adminPassword },
    });
    expect(response.status(), `API login failed: ${await response.text()}`).toBe(200);
    const { token } = (await response.json()) as { token: string };
    await anonymous.dispose();

    const authed = await request.newContext({
      baseURL: env.apiUrl,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await use(authed);
    await authed.dispose();
  },
});

export { expect };
