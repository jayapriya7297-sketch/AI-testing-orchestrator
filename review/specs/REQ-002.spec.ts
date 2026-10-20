// AI-generated draft for REQ-002 (Add expense). Review before moving to tests/.
// Feature: review/features/REQ-002.feature · Traceability: review/traceability.xlsx
import { test, expect, uniqueTitle, validExpense } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { ExpensesPage } from '../../pages/ExpensesPage';
import type { ExpenseField, ExpenseFormValues } from '../../pages/ExpenseForm';
import { fixtureWithUniqueTitles, XLSX_TYPE } from '../../fixtures/xlsx';
import { validationErrorSchema } from '../../schemas/error.schema';
import { CATEGORIES, expenseSchema } from '../../schemas/expense.schema';
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

    // C4: dot decimal only, no thousands separator
    for (const amount of ['1,000', '12,50']) {
      test(`REQ-002 POST with amount "${amount}" returns 400 "Amount must be a number" and stores nothing`, { tag: ['@regression', '@db'] }, async ({
        apiContext,
      }) => {
        const input = validExpense({ amount });

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expectSchema(body, validationErrorSchema);
        expect(body.details).toEqual([{ field: 'amount', message: 'Amount must be a number' }]);
        expect(await getExpensesByTitles([input.title as string])).toHaveLength(0);
      });
    }

    // C5: each of the six categories is accepted
    for (const category of CATEGORIES) {
      test(`REQ-002 POST with category ${category} returns 201 and stores it`, { tag: ['@regression', '@db'] }, async ({
        apiContext,
        cleanup,
      }) => {
        const input = validExpense({ category });

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status(), await res.text()).toBe(201);
        const body = await res.json();
        cleanup.track(apiContext, body.id);
        expectSchema(body, expenseSchema);
        await expectExpenseRow(await getExpenseById(body.id), input, env.adminEmail);
      });
    }

    // C6: any real YYYY-MM-DD date, future dates allowed
    for (const [name, date] of [
      ['a future date', '2099-12-31'],
      ['an old date', '1900-01-01'],
    ] as const) {
      test(`REQ-002 POST with ${name} (${date}) returns 201 and stores it`, { tag: ['@regression', '@db'] }, async ({
        apiContext,
        cleanup,
      }) => {
        const input = validExpense({ date });

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status(), await res.text()).toBe(201);
        const body = await res.json();
        cleanup.track(apiContext, body.id);
        expect(body.date).toBe(date);
        await expectExpenseRow(await getExpenseById(body.id), input, env.adminEmail);
      });
    }

    // C7: duplicates allowed
    test('REQ-002 POSTing the same expense twice returns 201 twice and stores two rows', { tag: ['@regression', '@db'] }, async ({
      apiContext,
      cleanup,
    }) => {
      const input = validExpense();

      const first = await apiContext.post(EXPENSES, { data: input });
      const second = await apiContext.post(EXPENSES, { data: input });

      expect(first.status()).toBe(201);
      expect(second.status()).toBe(201);
      const [a, b] = [await first.json(), await second.json()];
      cleanup.track(apiContext, a.id);
      cleanup.track(apiContext, b.id);
      expect(b.id).not.toBe(a.id);
      const rows = await getExpensesByTitles([input.title as string]);
      expect(rows).toHaveLength(2);
      for (const row of rows) await expectExpenseRow(row, input, env.adminEmail);
    });
  });

  test.describe('UI: form rules', { tag: '@ui' }, () => {
    let expensesPage: ExpensesPage;

    test.beforeEach(async ({ page }) => {
      expensesPage = new ExpensesPage(page);
      await expensesPage.goto();
      await expect(expensesPage.table).toBeVisible();
    });

    // C5
    test('REQ-002 the category dropdown offers exactly the six categories', { tag: '@regression' }, async () => {
      await expensesPage.openAddForm();

      await expect(expensesPage.form.category.getByRole('option')).toHaveText([
        'Select a category',
        ...CATEGORIES,
      ]);
    });

    // C6
    test('REQ-002 adding an expense with a future date shows it in the list', { tag: ['@regression', '@db'] }, async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues({ date: '2099-12-31' });
      cleanup.trackTitles(apiContext, [values.title]);

      await expensesPage.openAddForm();
      await expensesPage.form.save(values);

      await expect(expensesPage.successMessage).toHaveText('Expense added');
      await expect(expensesPage.rowByTitle(values.title).getByTestId('expense-date')).toHaveText('2099-12-31');
      const rows = await getExpensesByTitles([values.title]);
      expect(rows).toHaveLength(1);
      await expectExpenseRow(rows[0], values, env.adminEmail);
    });

    // C7
    test('REQ-002 adding the same expense twice shows two rows', { tag: ['@regression', '@db'] }, async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);

      await expensesPage.openAddForm();
      await expensesPage.form.save(values);
      await expect(expensesPage.successMessage).toHaveText('Expense added');
      await expensesPage.openAddForm();
      await expensesPage.form.save(values);

      await expect(expensesPage.successMessage).toHaveText('Expense added');
      await expect(expensesPage.rowByTitle(values.title)).toHaveCount(2);
      expect(await getExpensesByTitles([values.title])).toHaveLength(2);
    });
  });

  // C9: the message stays until the user opens Add or Edit or another message replaces it;
  // filtering, Export and Import keep it. C10: date sort, newest first; same date: higher id first.
  test.describe('UI: success message and list order', { tag: '@ui' }, () => {
    let expensesPage: ExpensesPage;

    test.beforeEach(async ({ page }) => {
      expensesPage = new ExpensesPage(page);
      await expensesPage.goto();
      await expect(expensesPage.table).toBeVisible();
    });

    async function addExpense(values: Required<ExpenseFormValues>): Promise<void> {
      await expensesPage.openAddForm();
      await expensesPage.form.save(values);
      await expect(expensesPage.successMessage).toHaveText('Expense added');
    }

    test('REQ-002 "Expense added" is still shown 10 minutes later with no action', { tag: '@regression' }, async ({
      page,
      apiContext,
      cleanup,
    }) => {
      await page.clock.install();
      await page.reload();
      await expect(expensesPage.table).toBeVisible();
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);

      await addExpense(values);
      await page.clock.fastForward('10:00');

      await expect(expensesPage.successMessage).toHaveText('Expense added');
    });

    test('REQ-002 opening the Add form hides the success message', { tag: '@regression' }, async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);

      await expensesPage.openAddForm();

      await expect(expensesPage.successMessage).toBeHidden();
    });

    test('REQ-002 opening Edit hides the success message', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);

      await expensesPage.rowByTitle(values.title).getByRole('button', { name: 'Edit' }).click();

      await expect(expensesPage.form.heading).toHaveText('Edit expense');
      await expect(expensesPage.successMessage).toBeHidden();
    });

    test('REQ-002 an error message replaces the success message', { tag: '@regression' }, async ({
      page,
      apiContext,
      cleanup,
      createExpense,
    }) => {
      const other = await createExpense();
      await page.reload();
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);
      await page.route(/\/api\/expenses\/\d+$/, (route) =>
        route.request().method() === 'DELETE'
          ? route.fulfill({ status: 500, json: { error: 'Internal server error' } })
          : route.fallback(),
      );

      await expensesPage.deleteExpense(other.id);

      await expect(expensesPage.errorMessage).toHaveText('Internal server error');
      await expect(expensesPage.successMessage).toBeHidden();
    });

    test('REQ-002 filtering by category keeps the success message', { tag: '@regression' }, async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues({ category: 'Food' });
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);

      await expensesPage.filterByCategory('Travel');

      await expect(expensesPage.successMessage).toHaveText('Expense added');
    });

    test('REQ-002 Export keeps the success message', { tag: ['@regression', '@file'] }, async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);

      const download = await expensesPage.exportFile();

      expect(download.suggestedFilename()).toBe('expenses.xlsx');
      await expect(expensesPage.successMessage).toHaveText('Expense added');
    });

    test('REQ-002 Import keeps the success message', { tag: ['@regression', '@file'] }, async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues();
      const file = await fixtureWithUniqueTitles('valid-3-rows.xlsx');
      cleanup.trackTitles(apiContext, [values.title, ...file.titles]);
      await addExpense(values);

      const res = await expensesPage.importFile({ ...file, mimeType: XLSX_TYPE });

      expect(res.status()).toBe(201);
      await expect(expensesPage.importMessage).toHaveText('Imported 3 expenses');
      await expect(expensesPage.successMessage).toHaveText('Expense added');
    });

    test('REQ-002 a back-dated new expense appears in date order', { tag: '@regression' }, async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues({ date: '2020-01-15' });
      cleanup.trackTitles(apiContext, [values.title]);

      await addExpense(values);

      await expect(expensesPage.rowByTitle(values.title)).toHaveCount(1);
      const dates = await expensesPage.cells('date').allTextContents();
      expect(dates).toEqual([...dates].sort().reverse());
    });

    test('REQ-002 on the same date the newer expense is listed first', { tag: '@regression' }, async ({
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
  });
});
