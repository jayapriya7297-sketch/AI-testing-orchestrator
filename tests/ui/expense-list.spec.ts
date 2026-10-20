import { test, expect, uniqueTitle } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { LoginPage } from '../../pages/LoginPage';
import { ExpensesPage } from '../../pages/ExpensesPage';
import type { Category } from '../../schemas/expense.schema';

const CATEGORIES: Category[] = ['Food', 'Travel', 'Office', 'Utilities', 'Entertainment', 'Other'];

// Seeded Travel expenses (app/db/init/02-seed.sql). Other specs add rows in parallel,
// so tests check that these are present rather than exact counts.
const SEEDED_TRAVEL = ['Flight to Berlin', 'Taxi to airport', 'Hotel Munich', 'Train ticket'];

const LIST_URL = /\/api\/expenses(\?.*)?$/;

test.describe('expense list', () => {
  let expensesPage: ExpensesPage;

  test.beforeEach(async ({ page }) => {
    expensesPage = new ExpensesPage(page);
  });

  test.describe('with data', () => {
    test.beforeEach(async () => {
      await expensesPage.goto();
      await expect(expensesPage.table).toBeVisible();
    });

    test('shows seeded expenses with their values @smoke @ui', async () => {
      const row = expensesPage.rowByTitle('Flight to Berlin');

      await expect(row.getByTestId('expense-amount')).toHaveText('$412.00');
      await expect(row.getByTestId('expense-category')).toHaveText('Travel');
      await expect(row.getByTestId('expense-date')).toHaveText('2026-09-02');
      await expect(row.getByTestId('expense-created-by')).toHaveText(env.adminEmail);
      await expect(expensesPage.rowByTitle('Printer paper')).toBeVisible();
      await expect(expensesPage.rowByTitle('Mobile phone plan')).toBeVisible();
    });

    test('shows an expense created via the API with its values @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense({ amount: 1234.5, category: 'Office', date: '2026-10-02' });

      await page.reload();

      const row = expensesPage.row(expense.id);
      await expect(row.getByTestId('expense-title')).toHaveText(expense.title);
      await expect(row.getByTestId('expense-amount')).toHaveText('$1,234.50');
      await expect(row.getByTestId('expense-category')).toHaveText('Office');
      await expect(row.getByTestId('expense-date')).toHaveText('2026-10-02');
      await expect(row.getByTestId('expense-created-by')).toHaveText(env.adminEmail);
    });

    test('lists expenses by date, newest first @ui @regression', async () => {
      const dates = await expensesPage.cells('date').allTextContents();

      expect(dates.length).toBeGreaterThan(1);
      expect(dates).toEqual([...dates].sort().reverse());
    });

    test('a back-dated new expense appears in date order @ui @regression', async ({ apiContext, cleanup }) => {
      const title = uniqueTitle('ui-test');
      cleanup.trackTitles(apiContext, [title]);

      await expensesPage.openAddForm();
      await expensesPage.form.save({ title, amount: '42.50', category: 'Food', date: '2020-01-15' });

      await expect(expensesPage.successMessage).toHaveText('Expense added');
      await expect(expensesPage.rowByTitle(title)).toHaveCount(1);
      const dates = await expensesPage.cells('date').allTextContents();
      expect(dates).toEqual([...dates].sort().reverse());
    });

    test('on the same date the newer expense is listed first @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const older = await createExpense({ date: '2020-02-20' });
      const newer = await createExpense({ date: '2020-02-20' });
      await page.reload();
      await expect(expensesPage.row(newer.id)).toBeVisible();

      const titles = await expensesPage.cells('title').allTextContents();

      expect(newer.id).toBeGreaterThan(older.id);
      expect(titles.indexOf(newer.title)).toBeLessThan(titles.indexOf(older.title));
    });

    test('footer count matches the number of rows shown @ui @regression', async () => {
      const rowCount = await expensesPage.rows.count();

      expect(rowCount).toBeGreaterThan(0);
      await expect(expensesPage.expenseCount).toHaveText(String(rowCount));
    });
  });

  test.describe('category filter', () => {
    test.beforeEach(async () => {
      await expensesPage.goto();
      await expect(expensesPage.table).toBeVisible();
    });

    test('Travel shows only Travel expenses, including the seeded ones @smoke @ui', async () => {
      await expensesPage.filterByCategory('Travel');
      await expect(expensesPage.loading).toBeHidden();

      for (const title of SEEDED_TRAVEL) {
        await expect(expensesPage.rowByTitle(title)).toBeVisible();
      }
      await expect(expensesPage.rowByTitle('Team lunch')).toHaveCount(0);
      await expect(expensesPage.cells('category').filter({ hasNotText: /^Travel$/ })).toHaveCount(0);
    });

    for (const category of CATEGORIES) {
      test(`${category} shows only ${category} expenses @ui @regression`, async ({
        createExpense,
      }) => {
        const expense = await createExpense({ category });

        await expensesPage.filterByCategory(category);
        await expect(expensesPage.loading).toBeHidden();

        await expect(expensesPage.row(expense.id)).toBeVisible();
        await expect(
          expensesPage.cells('category').filter({ hasNotText: new RegExp(`^${category}$`) }),
        ).toHaveCount(0);
        await expect(expensesPage.expenseCount).toHaveText(
          String(await expensesPage.rows.count()),
        );
      });
    }

    test('switching back to All shows every category again @ui @regression', async () => {
      await expensesPage.filterByCategory('Travel');
      await expect(expensesPage.loading).toBeHidden();
      await expect(expensesPage.rowByTitle('Team lunch')).toHaveCount(0);

      await expensesPage.filterByCategory('All');
      await expect(expensesPage.loading).toBeHidden();

      await expect(expensesPage.categoryFilter).toHaveValue('');
      await expect(expensesPage.rowByTitle('Team lunch')).toBeVisible();
      await expect(expensesPage.rowByTitle('Flight to Berlin')).toBeVisible();
      await expect(expensesPage.rowByTitle('Printer paper')).toBeVisible();
    });
  });

  test.describe('empty and error states', () => {
    test('shows "No expenses found." when the API returns no expenses @ui @regression', async ({
      page,
    }) => {
      await page.route(LIST_URL, (route) => route.fulfill({ json: [] }));

      await expensesPage.goto();

      await expect(expensesPage.emptyState).toHaveText('No expenses found.');
      await expect(expensesPage.table).toBeHidden();
    });

    test('shows the server error when the list API returns 500 @ui @regression', async ({
      page,
    }) => {
      await page.route(LIST_URL, (route) =>
        route.fulfill({ status: 500, json: { error: 'Internal server error' } }),
      );

      await expensesPage.goto();

      await expect(expensesPage.errorMessage).toHaveText('Internal server error');
      await expect(expensesPage.table).toBeHidden();
    });
  });

  test.describe('as a regular user', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("does not show admin's expenses @ui @regression", async ({ page, createExpense }) => {
      // App bug BUG-001 (docs/bugs-found.md): the list returns every user's expenses.
      test.fail();
      const adminExpense = await createExpense();
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.login(env.userEmail, env.userPassword);
      await expect(expensesPage.userEmail).toHaveText(env.userEmail);
      await expect(expensesPage.table).toBeVisible();

      await expect(expensesPage.row(adminExpense.id)).toHaveCount(0);
    });
  });
});
