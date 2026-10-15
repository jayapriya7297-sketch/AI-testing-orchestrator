import { test, expect } from '@playwright/test';
import { env } from '../../fixtures/env';
import { LoginPage } from '../../pages/LoginPage';
import { ExpensesPage } from '../../pages/ExpensesPage';

// Start logged out so this test exercises the login form, not the saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test('admin can log in and sees the expense list @smoke @ui', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const expensesPage = new ExpensesPage(page);

  await loginPage.goto();
  await loginPage.login(env.adminEmail, env.adminPassword);

  await expect(expensesPage.userEmail).toHaveText(env.adminEmail);
  await expect(expensesPage.table).toBeVisible();
  await expect(expensesPage.rows.first()).toBeVisible();
});
