// AI-generated draft for REQ-002 (Add expense). Review before moving to tests/.
// Feature: review/features/REQ-002.feature · Traceability: review/traceability.xlsx
import { test, expect, uniqueTitle, validExpense } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { ExpensesPage } from '../../pages/ExpensesPage';
import type { ExpenseField, ExpenseFormValues } from '../../pages/ExpenseForm';
import { validationErrorSchema } from '../../schemas/error.schema';
import { expenseSchema } from '../../schemas/expense.schema';
import { expectSchema } from '../../schemas/validate';
import { expectExpenseRow, getExpenseById, getExpensesByTitles } from '../../tests/db/db.helper';

const EXPENSES = '/api/expenses';
const LIST_URL = /\/api\/expenses$/;

const REQUIRED: { field: ExpenseField; message: string }[] = [
  { field: 'title', message: 'Title is required' },
  { field: 'amount', message: 'Amount is required' },
  { field: 'category', message: 'Category is required' },
  { field: 'date', message: 'Date is required' },
];

function formValues(overrides: ExpenseFormValues = {}): Required<ExpenseFormValues> {
  return { title: uniqueTitle('ui-test'), amount: '42.50', category: 'Food', date: '2026-10-03', ...overrides };
}

test.describe('REQ-002 Add expense', { tag: ['@generated', '@REQ-002'] }, () => {
  test.describe('UI', { tag: '@ui' }, () => {
    let expensesPage: ExpensesPage;

    test.beforeEach(async ({ page }) => {
      expensesPage = new ExpensesPage(page);
      await expensesPage.goto();
      await expect(expensesPage.table).toBeVisible();
      await expensesPage.openAddForm();
    });

    for (const { field, message } of REQUIRED) {
      test(`REQ-002 leaving only ${field} empty shows "${message}" and stores nothing`, { tag: '@regression' }, async ({
        page,
        apiContext,
        cleanup,
      }) => {
        const values = formValues({ [field]: '' });
        cleanup.trackTitles(apiContext, [values.title]);
        const created = page.waitForResponse(
          (res) => LIST_URL.test(res.url()) && res.request().method() === 'POST',
        );

        await expensesPage.form.save(values);

        // The 400 proves nothing was stored when the title is the empty field.
        expect((await created).status()).toBe(400);
        await expect(expensesPage.form.fieldError(field)).toHaveText(message);
        await expect(expensesPage.form.fieldErrors).toHaveCount(1);
        await expect(expensesPage.form.formError).toHaveText('Validation failed');
        await expect(expensesPage.form.root).toBeVisible();
        if (values.title) expect(await getExpensesByTitles([values.title])).toHaveLength(0);
      });
    }

    for (const { amount, shown } of [
      { amount: '0.01', shown: '$0.01' },
      { amount: '1000000', shown: '$1,000,000.00' },
    ]) {
      test(`REQ-002 adding amount ${amount} shows "Expense added" and a row with ${shown}`, { tag: '@regression' }, async ({
        apiContext,
        cleanup,
      }) => {
        const values = formValues({ amount });
        cleanup.trackTitles(apiContext, [values.title]);

        await expensesPage.form.save(values);

        await expect(expensesPage.successMessage).toHaveText('Expense added');
        await expect(expensesPage.rowByTitle(values.title).getByTestId('expense-amount')).toHaveText(shown);
        const rows = await getExpensesByTitles([values.title]);
        expect(rows).toHaveLength(1);
        await expectExpenseRow(rows[0], values, env.adminEmail);
      });
    }

    test('REQ-002 the new row appears once without a page reload and the count matches the list', { tag: ['@regression', '@db'] }, async ({
      page,
      apiContext,
      cleanup,
    }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      let navigations = 0;
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) navigations += 1;
      });

      await expensesPage.form.save(values);

      await expect(expensesPage.successMessage).toHaveText('Expense added');
      await expect(expensesPage.rowByTitle(values.title)).toHaveCount(1);
      expect(navigations, 'main-frame navigations after submitting').toBe(0);
      // Other workers add expenses in parallel, so compare with the rows shown, not "before + 1".
      await expect(expensesPage.expenseCount).toHaveText(String(await expensesPage.rows.count()));
      // The list can hide a duplicate insert that lands after it refreshed; the DB cannot.
      expect(await getExpensesByTitles([values.title])).toHaveLength(1);
    });
  });

  test.describe('API', { tag: '@api' }, () => {
    for (const { field, message } of REQUIRED) {
      test(`REQ-002 POST without ${field} returns 400 naming only ${field}`, { tag: '@regression' }, async ({
        apiContext,
      }) => {
        const input: Record<string, unknown> = validExpense();
        delete input[field];

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expectSchema(body, validationErrorSchema);
        expect(body.details).toEqual([{ field, message }]);
        if (field !== 'title') expect(await getExpensesByTitles([input.title as string])).toHaveLength(0);
      });
    }

    test('REQ-002 POST with amount -0.01 returns 400 "Amount must be greater than 0"', { tag: '@regression' }, async ({
      apiContext,
    }) => {
      const input = validExpense({ amount: -0.01 });

      const res = await apiContext.post(EXPENSES, { data: input });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, validationErrorSchema);
      expect(body.details).toEqual([{ field: 'amount', message: 'Amount must be greater than 0' }]);
      expect(await getExpensesByTitles([input.title as string])).toHaveLength(0);
    });

    for (const amount of [0.01, 1000000, 999999.99]) {
      test(`REQ-002 POST with amount ${amount} returns 201 and stores it exactly`, { tag: ['@regression', '@db'] }, async ({
        apiContext,
        cleanup,
      }) => {
        const input = validExpense({ amount });

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status(), await res.text()).toBe(201);
        const body = await res.json();
        cleanup.track(apiContext, body.id);
        expectSchema(body, expenseSchema);
        expect(body).toMatchObject(input);
        await expectExpenseRow(await getExpenseById(body.id), input, env.adminEmail);
      });
    }
  });
});
