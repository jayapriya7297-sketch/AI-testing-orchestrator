// AI-generated draft for REQ-010 (Monthly total). Review before moving to tests/.
// Feature: review/features/REQ-010.feature · Traceability: review/traceability.xlsx
//
// Status Planned: there is no monthly total yet. Missing before these can run:
// - a data-testid on the monthly total (e.g. "monthly-total"; the developer decides).
//   The existing footer "expense-total" sums every listed expense, not this month's.
// - ExpensesPage.monthlyTotal
// Parallel-safe: other workers add and delete expenses, so each test compares the total
// with the sum of this month's rows on the page (as REQ-002 scenario 23 does with the
// count), never with a value read before the change.
import { test, expect, uniqueTitle } from '../../fixtures/expenses';
import { ExpensesPage } from '../../pages/ExpensesPage';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Local date as YYYY-MM-DD; which timezone defines "this month" is open (questions/REQ-010.md Q1). */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const today = isoDate(new Date());
const thisMonth = today.slice(0, 7);
const lastMonth = isoDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));

/** Sum of the amounts of the rows on the page dated this month, formatted like the list ("$1,234.50"). */
async function expectedMonthlyTotal(expensesPage: ExpensesPage): Promise<string> {
  const dates = await expensesPage.cells('date').allTextContents();
  const amounts = await expensesPage.cells('amount').allTextContents();
  const cents = dates.reduce(
    (sum, date, i) =>
      date.startsWith(thisMonth) ? sum + Math.round(Number(amounts[i].replace(/[$,]/g, '')) * 100) : sum,
    0,
  );
  return usd.format(cents / 100);
}

test.describe('REQ-010 Monthly total', { tag: ['@generated', '@REQ-010', '@ui'] }, () => {
  test.fixme(true, 'REQ-010 planned: not built yet');

  let expensesPage: ExpensesPage;

  test.beforeEach(async ({ page }) => {
    expensesPage = new ExpensesPage(page);
    await expensesPage.goto();
    await expect(expensesPage.table).toBeVisible();
  });

  test("REQ-010 the monthly total equals the sum of this month's rows shown", { tag: '@smoke' }, async ({
    page,
    createExpense,
  }) => {
    const expense = await createExpense({ amount: 12.34, date: today });
    await page.reload();
    await expect(expensesPage.row(expense.id)).toBeVisible();

    const expected = await expectedMonthlyTotal(expensesPage);

    // TODO(REQ-010): await expect(expensesPage.monthlyTotal).toHaveText(expected)
    //   (missing: ExpensesPage.monthlyTotal)
  });

  test('REQ-010 an expense from another month is left out of the total', { tag: '@regression' }, async ({
    page,
    createExpense,
  }) => {
    // A large amount so including it by mistake cannot go unnoticed.
    const expense = await createExpense({ amount: 999999.99, date: lastMonth });
    await page.reload();
    await expect(expensesPage.row(expense.id)).toBeVisible();

    const expected = await expectedMonthlyTotal(expensesPage);

    // TODO(REQ-010): await expect(expensesPage.monthlyTotal).toHaveText(expected)
  });

  test('REQ-010 the total includes an expense added this month', { tag: '@regression' }, async ({
    apiContext,
    cleanup,
  }) => {
    const title = uniqueTitle('ui-total');
    cleanup.trackTitles(apiContext, [title]);

    await expensesPage.openAddForm();
    await expensesPage.form.save({ title, amount: '45.67', category: 'Food', date: today });

    await expect(expensesPage.successMessage).toHaveText('Expense added');
    await expect(expensesPage.rowByTitle(title)).toHaveCount(1);
    const expected = await expectedMonthlyTotal(expensesPage);

    // TODO(REQ-010): await expect(expensesPage.monthlyTotal).toHaveText(expected)
  });

  test('REQ-010 the total follows an edited amount', { tag: '@regression' }, async ({ page, createExpense }) => {
    const expense = await createExpense({ amount: 10, date: today });
    await page.reload();

    await expensesPage.openEdit(expense.id);
    await expensesPage.form.save({ amount: '76.54' });

    await expect(expensesPage.successMessage).toHaveText('Expense updated');
    await expect(expensesPage.row(expense.id).getByTestId('expense-amount')).toHaveText('$76.54');
    const expected = await expectedMonthlyTotal(expensesPage);

    // TODO(REQ-010): await expect(expensesPage.monthlyTotal).toHaveText(expected)
  });

  test('REQ-010 the total drops a deleted expense', { tag: '@regression' }, async ({ page, createExpense }) => {
    const expense = await createExpense({ amount: 33.33, date: today });
    await page.reload();

    await expensesPage.deleteExpense(expense.id);

    await expect(expensesPage.successMessage).toHaveText('Expense deleted');
    await expect(expensesPage.row(expense.id)).toHaveCount(0);
    const expected = await expectedMonthlyTotal(expensesPage);

    // TODO(REQ-010): await expect(expensesPage.monthlyTotal).toHaveText(expected)
  });
});
