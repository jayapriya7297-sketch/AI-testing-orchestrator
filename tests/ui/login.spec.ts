import { test, expect } from '@playwright/test';
import { env } from '../../fixtures/env';
import { LoginPage } from '../../pages/LoginPage';
import { ExpensesPage } from '../../pages/ExpensesPage';

// Start logged out so these tests exercise the login form, not the saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('login', () => {
  let loginPage: LoginPage;
  let expensesPage: ExpensesPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    expensesPage = new ExpensesPage(page);
    await loginPage.goto();
  });

  test('admin can log in and sees the expense list @smoke @ui', async () => {
    await loginPage.login(env.adminEmail, env.adminPassword);

    await expect(expensesPage.userEmail).toHaveText(env.adminEmail);
    await expect(expensesPage.table).toBeVisible();
    await expect(expensesPage.rows.first()).toBeVisible();
  });

  test('regular user logs in and sees their email in the header @ui @regression', async () => {
    await loginPage.login(env.userEmail, env.userPassword);

    await expect(expensesPage.userEmail).toHaveText(env.userEmail);
    await expect(expensesPage.table).toBeVisible();
  });

  test('accepts the email in a different case with surrounding spaces @ui @regression', async () => {
    await loginPage.login(`  ${env.adminEmail.toUpperCase()} `, env.adminPassword);

    await expect(expensesPage.userEmail).toHaveText(env.adminEmail);
  });

  test('shows "Invalid email or password" for a wrong password @ui @regression', async () => {
    await loginPage.login(env.adminEmail, 'wrong-password');

    await expect(loginPage.error).toHaveText('Invalid email or password');
    await expect(loginPage.email).toBeVisible();
    await expect(loginPage.submit).toBeEnabled();
    await expect(expensesPage.userEmail).toBeHidden();
  });

  test('shows "Invalid email or password" for an unknown email @ui @regression', async () => {
    await loginPage.login(`nobody-${Date.now()}@test.com`, env.adminPassword);

    await expect(loginPage.error).toHaveText('Invalid email or password');
    await expect(expensesPage.userEmail).toBeHidden();
  });

  test('shows both required messages when submitted empty @ui @regression', async () => {
    await loginPage.submit.click();

    await expect(loginPage.error).toHaveText('Email is required. Password is required');
    await expect(expensesPage.userEmail).toBeHidden();
  });

  test('shows the server error when the login API returns 500 @ui @regression', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 500, json: { error: 'Internal server error' } }),
    );

    await loginPage.login(env.adminEmail, env.adminPassword);

    await expect(loginPage.error).toHaveText('Internal server error');
    await expect(loginPage.submit).toBeEnabled();
    await expect(expensesPage.userEmail).toBeHidden();
  });

  test('logging out returns to the login form and clears the session @ui @regression', async ({
    page,
  }) => {
    await loginPage.login(env.adminEmail, env.adminPassword);
    await expect(expensesPage.userEmail).toHaveText(env.adminEmail);

    await expensesPage.logout();

    await expect(loginPage.email).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('expense_token'))).toBeNull();
    await page.reload();
    await expect(loginPage.email).toBeVisible();
    await expect(expensesPage.userEmail).toBeHidden();
  });
});

test.describe('logged-out access', () => {
  test('visiting the app without a session shows the login form, not the list @ui @regression', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const expensesPage = new ExpensesPage(page);

    await loginPage.goto();

    await expect(loginPage.email).toBeVisible();
    await expect(loginPage.submit).toBeVisible();
    await expect(expensesPage.table).toBeHidden();
    await expect(expensesPage.userEmail).toBeHidden();
  });

  test.describe('with an invalid stored token', () => {
    test.use({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: env.webUrl,
            localStorage: [
              { name: 'expense_token', value: 'invalid-token' },
              {
                name: 'expense_user',
                value: JSON.stringify({ id: 1, email: env.adminEmail, role: 'admin' }),
              },
            ],
          },
        ],
      },
    });

    test('returns to login with the "session has expired" notice @ui @regression', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      const expensesPage = new ExpensesPage(page);

      await loginPage.goto();

      await expect(loginPage.notice).toHaveText('Your session has expired. Please log in again.');
      await expect(loginPage.email).toBeVisible();
      await expect(expensesPage.table).toBeHidden();
      expect(await page.evaluate(() => localStorage.getItem('expense_token'))).toBeNull();
    });
  });
});
