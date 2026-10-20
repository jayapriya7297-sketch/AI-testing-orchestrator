import type { Page } from '@playwright/test';
import { test, expect, uniqueTitle } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { fixtureWithUniqueTitles, XLSX_TYPE } from '../../fixtures/xlsx';
import { ExpensesPage } from '../../pages/ExpensesPage';
import type { ExpenseField, ExpenseFormValues } from '../../pages/ExpenseForm';
import { CATEGORIES } from '../../schemas/expense.schema';
import { expectExpenseRow, getExpenseById, getExpensesByTitles } from '../db/db.helper';

type FilledForm = Required<ExpenseFormValues>;

function formValues(overrides: ExpenseFormValues = {}): FilledForm {
  return { title: uniqueTitle('ui-test'), amount: '42.50', category: 'Food', date: '2026-10-03', ...overrides };
}

/** Answers matching requests with a 500 and lets every other method through. */
async function failWith500(page: Page, url: RegExp, method: string): Promise<void> {
  await page.route(url, (route) =>
    route.request().method() === method
      ? route.fulfill({ status: 500, json: { error: 'Internal server error' } })
      : route.fallback(),
  );
}

const LIST_URL = /\/api\/expenses$/;
const ITEM_URL = /\/api\/expenses\/\d+$/;

test.describe('expense CRUD', () => {
  let expensesPage: ExpensesPage;

  test.beforeEach(async ({ page }) => {
    expensesPage = new ExpensesPage(page);
    await expensesPage.goto();
    await expect(expensesPage.table).toBeVisible();
  });

  test.describe('add', () => {
    test('adding an expense shows "Expense added" and the new row @smoke @ui', async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues({ amount: '1234.56', category: 'Travel', date: '2026-10-04' });
      cleanup.trackTitles(apiContext, [values.title]);

      await expensesPage.openAddForm();
      await expect(expensesPage.form.heading).toHaveText('Add expense');
      await expensesPage.form.save(values);

      await expect(expensesPage.successMessage).toHaveText('Expense added');
      await expect(expensesPage.form.root).toBeHidden();
      const row = expensesPage.rowByTitle(values.title);
      await expect(row.getByTestId('expense-amount')).toHaveText('$1,234.56');
      await expect(row.getByTestId('expense-category')).toHaveText('Travel');
      await expect(row.getByTestId('expense-date')).toHaveText('2026-10-04');
      await expect(row.getByTestId('expense-created-by')).toHaveText(env.adminEmail);

      const rows = await getExpensesByTitles([values.title]);
      expect(rows).toHaveLength(1);
      await expectExpenseRow(rows[0], values, env.adminEmail);
    });

    test('cancelling the add form closes it and adds nothing @ui @regression', async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);

      await expensesPage.openAddForm();
      await expensesPage.form.fill(values);
      await expensesPage.form.cancel.click();

      await expect(expensesPage.form.root).toBeHidden();
      await expect(expensesPage.rowByTitle(values.title)).toHaveCount(0);
      expect(await getExpensesByTitles([values.title])).toHaveLength(0);
    });

    for (const { amount, shown } of [
      { amount: '0.01', shown: '$0.01' },
      { amount: '1000000', shown: '$1,000,000.00' },
    ]) {
      test(`adding amount ${amount} shows "Expense added" and a row with ${shown} @ui @regression`, async ({
        apiContext,
        cleanup,
      }) => {
        const values = formValues({ amount });
        cleanup.trackTitles(apiContext, [values.title]);

        await expensesPage.openAddForm();
        await expensesPage.form.save(values);

        await expect(expensesPage.successMessage).toHaveText('Expense added');
        await expect(expensesPage.rowByTitle(values.title).getByTestId('expense-amount')).toHaveText(shown);
        const rows = await getExpensesByTitles([values.title]);
        expect(rows).toHaveLength(1);
        await expectExpenseRow(rows[0], values, env.adminEmail);
      });
    }

    test('the new row appears once without a page reload and the count matches the list @ui @regression', async ({
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

      await expensesPage.openAddForm();
      await expensesPage.form.save(values);

      await expect(expensesPage.successMessage).toHaveText('Expense added');
      await expect(expensesPage.rowByTitle(values.title)).toHaveCount(1);
      expect(navigations, 'main-frame navigations after submitting').toBe(0);
      // Other workers add expenses in parallel, so compare with the rows shown, not "before + 1".
      await expect(expensesPage.expenseCount).toHaveText(String(await expensesPage.rows.count()));
      // The list can hide a duplicate insert that lands after it refreshed; the DB cannot.
      expect(await getExpensesByTitles([values.title])).toHaveLength(1);
    });

    test('adding an expense with a future date shows it in the list @ui @regression', async ({
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

    test('adding the same expense twice shows two rows @ui @regression', async ({ apiContext, cleanup }) => {
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

  test.describe('form validation', () => {
    test.beforeEach(async () => {
      await expensesPage.openAddForm();
    });

    test('an empty form shows all four required messages and stays open @ui @regression', async ({
      page,
    }) => {
      const created = page.waitForResponse(
        (res) => LIST_URL.test(res.url()) && res.request().method() === 'POST',
      );

      await expensesPage.form.submit.click();

      // Nothing identifies an empty expense in the DB, so the 400 proves nothing was stored.
      expect((await created).status()).toBe(400);
      await expect(expensesPage.form.formError).toHaveText('Validation failed');
      await expect(expensesPage.form.fieldError('title')).toHaveText('Title is required');
      await expect(expensesPage.form.fieldError('amount')).toHaveText('Amount is required');
      await expect(expensesPage.form.fieldError('category')).toHaveText('Category is required');
      await expect(expensesPage.form.fieldError('date')).toHaveText('Date is required');
      await expect(expensesPage.form.root).toBeVisible();
      await expect(expensesPage.successMessage).toBeHidden();
    });

    const required: { field: ExpenseField; message: string }[] = [
      { field: 'title', message: 'Title is required' },
      { field: 'amount', message: 'Amount is required' },
      { field: 'category', message: 'Category is required' },
      { field: 'date', message: 'Date is required' },
    ];

    for (const { field, message } of required) {
      test(`leaving only ${field} empty shows "${message}" and stores nothing @ui @regression`, async ({
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

    test('the category dropdown offers exactly the six categories @ui @regression', async () => {
      await expect(expensesPage.form.category.getByRole('option')).toHaveText([
        'Select a category',
        ...CATEGORIES,
      ]);
    });

    test('a whitespace-only title shows "Title is required" @ui @regression', async ({
      page,
    }) => {
      const values = formValues({ title: '   ' });
      const created = page.waitForResponse(
        (res) => LIST_URL.test(res.url()) && res.request().method() === 'POST',
      );

      await expensesPage.form.save(values);

      expect((await created).status()).toBe(400);
      await expect(expensesPage.form.fieldError('title')).toHaveText('Title is required');
      await expect(expensesPage.form.fieldErrors).toHaveCount(1);
    });

    const invalid: { name: string; values: ExpenseFormValues; field: 'title' | 'amount'; message: string }[] = [
      {
        name: 'a 201-character title',
        values: { title: `${uniqueTitle('ui-test')} `.padEnd(201, 'x') },
        field: 'title',
        message: 'Title must be at most 200 characters',
      },
      { name: 'amount 0', values: { amount: '0' }, field: 'amount', message: 'Amount must be greater than 0' },
      { name: 'amount -5', values: { amount: '-5' }, field: 'amount', message: 'Amount must be greater than 0' },
      {
        name: 'amount 1000000.01',
        values: { amount: '1000000.01' },
        field: 'amount',
        message: 'Amount must be at most 1000000',
      },
      {
        name: 'amount 1.234',
        values: { amount: '1.234' },
        field: 'amount',
        message: 'Amount must have at most 2 decimal places',
      },
    ];

    for (const { name, values: overrides, field, message } of invalid) {
      test(`${name} shows "${message}" and stores nothing @ui @regression`, async ({
        apiContext,
        cleanup,
      }) => {
        const values = formValues(overrides);
        cleanup.trackTitles(apiContext, [values.title]);

        await expensesPage.form.save(values);

        await expect(expensesPage.form.fieldError(field)).toHaveText(message);
        await expect(expensesPage.form.fieldErrors).toHaveCount(1);
        await expect(expensesPage.form.formError).toHaveText('Validation failed');
        expect(await getExpensesByTitles([values.title])).toHaveLength(0);
      });
    }

    test('fixing the invalid field and saving again adds the expense @ui @regression', async ({
      apiContext,
      cleanup,
    }) => {
      const values = formValues({ amount: '0' });
      cleanup.trackTitles(apiContext, [values.title]);

      await expensesPage.form.save(values);
      await expect(expensesPage.form.fieldError('amount')).toHaveText('Amount must be greater than 0');

      await expensesPage.form.save({ amount: '12.34' });

      await expect(expensesPage.successMessage).toHaveText('Expense added');
      await expect(expensesPage.form.root).toBeHidden();
      await expect(expensesPage.rowByTitle(values.title).getByTestId('expense-amount')).toHaveText(
        '$12.34',
      );
      const rows = await getExpensesByTitles([values.title]);
      expect(rows).toHaveLength(1);
      await expectExpenseRow(rows[0], { ...values, amount: '12.34' }, env.adminEmail);
    });
  });

  test.describe('edit', () => {
    test('the edit form opens filled with the current values @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense({ amount: 42.5, category: 'Office', date: '2026-10-06' });
      await page.reload();

      await expensesPage.openEdit(expense.id);

      await expect(expensesPage.form.heading).toHaveText('Edit expense');
      await expect(expensesPage.form.title).toHaveValue(expense.title);
      await expect(expensesPage.form.amount).toHaveValue('42.5');
      await expect(expensesPage.form.category).toHaveValue('Office');
      await expect(expensesPage.form.date).toHaveValue('2026-10-06');
      await expect(expensesPage.form.submit).toHaveText('Save changes');
    });

    test('editing every field shows "Expense updated" and the new values @smoke @ui', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();
      const values = formValues({ amount: '99.99', category: 'Travel', date: '2026-10-05' });

      await expensesPage.openEdit(expense.id);
      await expensesPage.form.save(values);

      await expect(expensesPage.successMessage).toHaveText('Expense updated');
      await expect(expensesPage.form.root).toBeHidden();
      const row = expensesPage.row(expense.id);
      await expect(row.getByTestId('expense-title')).toHaveText(values.title);
      await expect(row.getByTestId('expense-amount')).toHaveText('$99.99');
      await expect(row.getByTestId('expense-category')).toHaveText('Travel');
      await expect(row.getByTestId('expense-date')).toHaveText('2026-10-05');
      await expectExpenseRow(await getExpenseById(expense.id), values, env.adminEmail);
    });

    test('cancelling an edit leaves the expense unchanged @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();

      await expensesPage.openEdit(expense.id);
      await expensesPage.form.fill({ title: uniqueTitle('ui-test'), amount: '1.00' });
      await expensesPage.form.cancel.click();

      await expect(expensesPage.form.root).toBeHidden();
      await expect(expensesPage.row(expense.id).getByTestId('expense-title')).toHaveText(expense.title);
      await expectExpenseRow(await getExpenseById(expense.id), expense, env.adminEmail);
    });

    test('clearing the title shows "Title is required" and keeps the old values @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();

      await expensesPage.openEdit(expense.id);
      await expensesPage.form.save({ title: '' });

      await expect(expensesPage.form.fieldError('title')).toHaveText('Title is required');
      await expect(expensesPage.form.root).toBeVisible();
      await expectExpenseRow(await getExpenseById(expense.id), expense, env.adminEmail);
    });

    test('saving an expense deleted in the meantime shows "Expense not found" @ui @regression', async ({
      page,
      apiContext,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();
      await expensesPage.openEdit(expense.id);

      const deleted = await apiContext.delete(`/api/expenses/${expense.id}`);
      expect(deleted.status()).toBe(204);
      await expensesPage.form.save({ amount: '10.00' });

      await expect(expensesPage.form.formError).toHaveText('Expense not found');
      await expect(expensesPage.form.root).toBeVisible();
      expect(await getExpenseById(expense.id)).toBeNull();
    });
  });

  test.describe('delete', () => {
    test('Delete then Confirm shows "Expense deleted" and removes the row @smoke @ui', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();

      await expensesPage.deleteExpense(expense.id);

      await expect(expensesPage.successMessage).toHaveText('Expense deleted');
      await expect(expensesPage.row(expense.id)).toHaveCount(0);
      expect(await getExpenseById(expense.id)).toBeNull();
    });

    test('Delete asks for confirmation and deletes nothing yet @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();

      await expensesPage.deleteButton(expense.id).click();

      await expect(expensesPage.confirmDeleteButton(expense.id)).toBeVisible();
      await expect(expensesPage.cancelDeleteButton(expense.id)).toBeVisible();
      await expect(expensesPage.deleteButton(expense.id)).toBeHidden();
      await expect(expensesPage.editButton(expense.id)).toBeHidden();
      expect(await getExpenseById(expense.id)).not.toBeNull();
    });

    test('Cancel restores Edit and Delete and keeps the expense @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();

      await expensesPage.cancelDelete(expense.id);

      await expect(expensesPage.deleteButton(expense.id)).toBeVisible();
      await expect(expensesPage.editButton(expense.id)).toBeVisible();
      await expect(expensesPage.confirmDeleteButton(expense.id)).toBeHidden();
      await expect(expensesPage.row(expense.id)).toBeVisible();
      await expectExpenseRow(await getExpenseById(expense.id), expense, env.adminEmail);
    });
  });

  // The message stays until the user opens Add or Edit or another message replaces it;
  // filtering, Export and Import keep it (REQ-002).
  test.describe('success message', () => {
    async function addExpense(values: FilledForm): Promise<void> {
      await expensesPage.openAddForm();
      await expensesPage.form.save(values);
      await expect(expensesPage.successMessage).toHaveText('Expense added');
    }

    test('"Expense added" is still shown 10 minutes later with no action @ui @regression', async ({
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

    test('opening the Add form hides the success message @ui @regression', async ({ apiContext, cleanup }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);

      await expensesPage.openAddForm();

      await expect(expensesPage.successMessage).toBeHidden();
    });

    test('opening Edit hides the success message @ui @regression', async ({ apiContext, cleanup }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);

      await expensesPage.rowByTitle(values.title).getByRole('button', { name: 'Edit' }).click();

      await expect(expensesPage.form.heading).toHaveText('Edit expense');
      await expect(expensesPage.successMessage).toBeHidden();
    });

    test('an error message replaces the success message @ui @regression', async ({
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
      await failWith500(page, ITEM_URL, 'DELETE');

      await expensesPage.deleteExpense(other.id);

      await expect(expensesPage.errorMessage).toHaveText('Internal server error');
      await expect(expensesPage.successMessage).toBeHidden();
    });

    test('filtering by category keeps the success message @ui @regression', async ({ apiContext, cleanup }) => {
      const values = formValues({ category: 'Food' });
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);

      await expensesPage.filterByCategory('Travel');

      await expect(expensesPage.successMessage).toHaveText('Expense added');
    });

    test('Export keeps the success message @ui @file @regression', async ({ apiContext, cleanup }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      await addExpense(values);

      const download = await expensesPage.exportFile();

      expect(download.suggestedFilename()).toBe('expenses.xlsx');
      await expect(expensesPage.successMessage).toHaveText('Expense added');
    });

    test('Import keeps the success message @ui @file @regression', async ({ apiContext, cleanup }) => {
      const values = formValues();
      const file = await fixtureWithUniqueTitles('valid-3-rows.xlsx');
      cleanup.trackTitles(apiContext, [values.title, ...file.titles]);
      await addExpense(values);

      const res = await expensesPage.importFile({ ...file, mimeType: XLSX_TYPE });

      expect(res.status()).toBe(201);
      await expect(expensesPage.importMessage).toHaveText('Imported 3 expenses');
      await expect(expensesPage.successMessage).toHaveText('Expense added');
    });
  });

  test.describe('server errors', () => {
    test('a 500 on create keeps the form open with the error @ui @regression', async ({
      page,
      apiContext,
      cleanup,
    }) => {
      const values = formValues();
      cleanup.trackTitles(apiContext, [values.title]);
      await failWith500(page, LIST_URL, 'POST');

      await expensesPage.openAddForm();
      await expensesPage.form.save(values);

      await expect(expensesPage.form.formError).toHaveText('Internal server error');
      await expect(expensesPage.form.root).toBeVisible();
      await expect(expensesPage.successMessage).toBeHidden();
      expect(await getExpensesByTitles([values.title])).toHaveLength(0);
    });

    test('a 500 on update shows the error and keeps the old values @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();
      await failWith500(page, ITEM_URL, 'PUT');

      await expensesPage.openEdit(expense.id);
      await expensesPage.form.save({ amount: '10.00' });

      await expect(expensesPage.form.formError).toHaveText('Internal server error');
      await expect(expensesPage.form.root).toBeVisible();
      await expectExpenseRow(await getExpenseById(expense.id), expense, env.adminEmail);
    });

    test('a 500 on delete shows the error and keeps the row @ui @regression', async ({
      page,
      createExpense,
    }) => {
      const expense = await createExpense();
      await page.reload();
      await failWith500(page, ITEM_URL, 'DELETE');

      await expensesPage.deleteExpense(expense.id);

      await expect(expensesPage.errorMessage).toHaveText('Internal server error');
      await expect(expensesPage.row(expense.id)).toBeVisible();
      expect(await getExpenseById(expense.id)).not.toBeNull();
    });
  });
});
