import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE } from '../playwright.config';
import { env } from '../fixtures/env';
import { LoginPage } from '../pages/LoginPage';
import { ExpensesPage } from '../pages/ExpensesPage';

setup('authenticate as admin', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const expensesPage = new ExpensesPage(page);

  await loginPage.goto();
  await loginPage.login(env.adminEmail, env.adminPassword);

  await expect(expensesPage.userEmail).toHaveText(env.adminEmail);
  await page.context().storageState({ path: STORAGE_STATE });
});
