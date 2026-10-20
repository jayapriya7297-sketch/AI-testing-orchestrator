// AI-generated draft for REQ-009 (Search by title). Review before moving to tests/.
// Feature: review/features/REQ-009.feature · Traceability: review/traceability.xlsx
//
// Status Planned: there is no search box yet. Missing before these can run:
// - a data-testid on the search input (e.g. "search-input"; the developer decides)
// - ExpensesPage.searchInput (and probably a search(text) method)
// The TODO lines mark where the search is typed; the assertions use existing locators.
import { test, expect, uniqueTitle } from '../../fixtures/expenses';
import { ExpensesPage } from '../../pages/ExpensesPage';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('REQ-009 Search by title', { tag: ['@generated', '@REQ-009', '@ui'] }, () => {
  test.fixme(true, 'REQ-009 planned: not built yet');

  let expensesPage: ExpensesPage;

  test.beforeEach(async ({ page }) => {
    expensesPage = new ExpensesPage(page);
    await expensesPage.goto();
    await expect(expensesPage.table).toBeVisible();
  });

  test("REQ-009 typing an expense's unique title shows only matching rows", { tag: '@smoke' }, async ({
    page,
    createExpense,
  }) => {
    const expense = await createExpense({ title: uniqueTitle('ui-search') });
    await page.reload();

    // TODO(REQ-009): type expense.title into the search box (missing: ExpensesPage.searchInput)

    await expect(expensesPage.row(expense.id)).toBeVisible();
    await expect(expensesPage.cells('title').filter({ hasNotText: expense.title })).toHaveCount(0);
  });

  test('REQ-009 search ignores case', { tag: '@regression' }, async ({ page, createExpense }) => {
    const expense = await createExpense({ title: uniqueTitle('ui-search') });
    await page.reload();

    // TODO(REQ-009): type expense.title.toUpperCase() into the search box (missing: ExpensesPage.searchInput)

    await expect(expensesPage.row(expense.id)).toBeVisible();
    await expect(
      expensesPage.cells('title').filter({ hasNotText: new RegExp(escapeRegExp(expense.title), 'i') }),
    ).toHaveCount(0);
  });

  test('REQ-009 a search with no match shows "No expenses found"', { tag: '@regression' }, async () => {
    const noMatch = uniqueTitle('no-such-expense');

    // TODO(REQ-009): type noMatch into the search box (missing: ExpensesPage.searchInput)

    // The app's empty state reads "No expenses found." today; see review/questions/REQ-009.md Q3.
    await expect(expensesPage.emptyState).toContainText('No expenses found');
    await expect(expensesPage.rows).toHaveCount(0);
  });
});
