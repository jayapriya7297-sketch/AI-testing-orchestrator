// AI-generated draft for REQ-008 (Data privacy). Review before moving to tests/.
// Feature: review/features/REQ-008.feature · Traceability: review/traceability.xlsx
import * as fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { readExport } from '../../fixtures/xlsx';
import { LoginPage } from '../../pages/LoginPage';
import { ExpensesPage } from '../../pages/ExpensesPage';
import { expenseListSchema, type Expense } from '../../schemas/expense.schema';
import { expectSchema } from '../../schemas/validate';

const EXPENSES = '/api/expenses';
const IDOR_BUG = 'App bug BUG-001: no ownership check on /api/expenses (IDOR), docs/bugs-found.md';

test.describe('REQ-008 Data privacy', { tag: ['@generated', '@REQ-008'] }, () => {
  test.describe('UI as the regular user', { tag: '@ui' }, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let expensesPage: ExpensesPage;

    test.beforeEach(async ({ page }) => {
      expensesPage = new ExpensesPage(page);
      await new LoginPage(page).goto();
    });

    async function loginAsUser(page: Page): Promise<void> {
      await new LoginPage(page).login(env.userEmail, env.userPassword);
      await expect(expensesPage.userEmail).toHaveText(env.userEmail);
      await expect(expensesPage.table).toBeVisible();
    }

    test('REQ-008 a regular user sees their own new expense in the list', { tag: '@smoke' }, async ({
      page,
      userApiContext,
      createExpense,
    }) => {
      const own = await createExpense({}, userApiContext);

      await loginAsUser(page);

      const row = expensesPage.row(own.id);
      await expect(row.getByTestId('expense-title')).toHaveText(own.title);
      await expect(row.getByTestId('expense-created-by')).toHaveText(env.userEmail);
    });

    test("REQ-008 a regular user's Export contains only their own expenses", { tag: ['@regression', '@file'] }, async ({
      page,
      createExpense,
    }) => {
      test.fail(true, IDOR_BUG);
      const adminExpense = await createExpense();
      await loginAsUser(page);

      const download = await expensesPage.exportFile();

      const { rows } = await readExport(fs.readFileSync(await download.path()));
      expect(rows.filter((r) => r.createdBy !== env.userEmail)).toEqual([]);
      expect(rows.map((r) => r.id)).not.toContain(adminExpense.id);
    });
  });

  test.describe('API', { tag: '@api' }, () => {
    test("REQ-008 a regular user's list filtered by category leaves out another user's expense", { tag: '@regression' }, async ({
      userApiContext,
      createExpense,
    }) => {
      test.fail(true, IDOR_BUG);
      const own = await createExpense({ category: 'Utilities' }, userApiContext);
      const adminExpense = await createExpense({ category: 'Utilities' });

      const res = await userApiContext.get(EXPENSES, { params: { category: 'Utilities' } });

      expect(res.status()).toBe(200);
      const body = (await res.json()) as Expense[];
      expectSchema(body, expenseListSchema);
      expect(body.map((e) => e.id)).toContain(own.id);
      expect(body.filter((e) => e.created_by !== env.userEmail)).toEqual([]);
      expect(body.map((e) => e.id)).not.toContain(adminExpense.id);
    });
  });
});
