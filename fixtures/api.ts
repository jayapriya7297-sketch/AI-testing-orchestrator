import { test as base, expect, request, type APIRequestContext } from '@playwright/test';
import { env } from './env';

type ApiFixtures = {
  /** Request context against API_URL with an admin Bearer token already attached. */
  apiContext: APIRequestContext;
  /** Request context against API_URL with the regular (non-admin) user's Bearer token. */
  userApiContext: APIRequestContext;
};

/** Logs in via the API and returns the JWT. */
export async function loginToken(email: string, password: string): Promise<string> {
  const anonymous = await request.newContext({ baseURL: env.apiUrl });
  const response = await anonymous.post('/api/auth/login', { data: { email, password } });
  expect(response.status(), `API login failed for ${email}: ${await response.text()}`).toBe(200);
  const { token } = (await response.json()) as { token: string };
  await anonymous.dispose();
  return token;
}

async function authedContext(email: string, password: string): Promise<APIRequestContext> {
  const token = await loginToken(email, password);
  return request.newContext({
    baseURL: env.apiUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

export const test = base.extend<ApiFixtures>({
  apiContext: async ({}, use) => {
    const authed = await authedContext(env.adminEmail, env.adminPassword);
    await use(authed);
    await authed.dispose();
  },
  userApiContext: async ({}, use) => {
    const authed = await authedContext(env.userEmail, env.userPassword);
    await use(authed);
    await authed.dispose();
  },
});

export { expect };
