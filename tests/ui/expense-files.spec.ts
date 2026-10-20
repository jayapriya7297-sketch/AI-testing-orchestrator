/**
 * Excel export and import through the UI. API-level coverage (headers, 401, csv, size and
 * row limits) lives in tests/api/expenses-file.spec.ts; these tests drive the Export button
 * and the import form, check the messages shown and confirm the result in the DB.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import type { Expense } from '../../schemas/expense.schema';
import { ExpensesPage } from '../../pages/ExpensesPage';
import {
  expectExportMatchesList,
  fixtureColumn,
  fixtureWithUniqueTitles,
  FILES_DIR,
  readExport,
  XLSX_TYPE,
} from '../../fixtures/xlsx';
import { expectExpenseRow, getExpensesByTitles } from '../db/db.helper';

const CATEGORY_ERROR = 'Category must be one of: Food, Travel, Office, Utilities, Entertainment, Other';

async function list(ctx: APIRequestContext, category?: string): Promise<Expense[]> {
  const res = await ctx.get('/api/expenses', { params: category ? { category } : {} });
  expect(res.status()).toBe(200);
  return (await res.json()) as Expense[];
}

test.describe('expense files', () => {
  let expensesPage: ExpensesPage;

  test.beforeEach(async ({ page }) => {
    expensesPage = new ExpensesPage(page);
    await expensesPage.goto();
    await expect(expensesPage.table).toBeVisible();
  });

  test.describe('export', () => {
    test('Export downloads expenses.xlsx whose rows match GET /api/expenses @smoke @ui @file', async ({
      apiContext,
      createExpense,
    }) => {
      const created = await createExpense({ amount: 123.45, category: 'Office', date: '2026-10-05' });
      const before = await list(apiContext);

      const download = await expensesPage.exportFile();
      const after = await list(apiContext);

      expect(download.suggestedFilename()).toBe('expenses.xlsx');
      const { headers, rows } = await readExport(fs.readFileSync(await download.path()));
      expect(headers).toEqual(['ID', 'Title', 'Amount', 'Category', 'Date', 'Created By']);
      expectExportMatchesList(rows.map((r) => r.id), before.map((e) => e.id), after.map((e) => e.id));
      // Rows unchanged between the two list calls must be exported with the same values.
      const unchanged = before.filter((b) => {
        const a = after.find((e) => e.id === b.id);
        return a && JSON.stringify(a) === JSON.stringify(b);
      });
      for (const e of unchanged) {
        expect(rows.find((r) => r.id === e.id), `exported row ${e.id}`).toEqual({
          id: e.id,
          title: e.title,
          amount: e.amount,
          category: e.category,
          date: e.date,
          createdBy: e.created_by,
        });
      }
      expect(rows.find((r) => r.id === created.id)).toEqual({
        id: created.id,
        title: created.title,
        amount: 123.45,
        category: 'Office',
        date: '2026-10-05',
        createdBy: env.adminEmail,
      });
    });

    test('Export after filtering by category exports only that category @ui @file @regression', async ({
      page,
      apiContext,
      createExpense,
    }) => {
      const utilities = await createExpense({ category: 'Utilities' });
      const food = await createExpense({ category: 'Food' });
      await page.reload();
      await expensesPage.filterByCategory('Utilities');
      const before = await list(apiContext, 'Utilities');

      const download = await expensesPage.exportFile();
      const after = await list(apiContext, 'Utilities');

      const { rows } = await readExport(fs.readFileSync(await download.path()));
      expect(rows.every((r) => r.category === 'Utilities')).toBe(true);
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(utilities.id);
      expect(ids).not.toContain(food.id);
      expectExportMatchesList(ids, before.map((e) => e.id), after.map((e) => e.id));
    });
  });

  test.describe('import', () => {
    test('importing a valid file shows "Imported 3 expenses" and stores exactly those rows @smoke @ui @file', async ({
      apiContext,
      cleanup,
    }) => {
      const file = await fixtureWithUniqueTitles('valid-3-rows.xlsx');
      cleanup.trackTitles(apiContext, file.titles);

      const res = await expensesPage.importFile({ ...file, mimeType: XLSX_TYPE });

      expect(res.status()).toBe(201);
      await expect(expensesPage.importMessage).toHaveText('Imported 3 expenses');
      await expect(expensesPage.importError).toBeHidden();
      for (const title of file.titles) {
        await expect(expensesPage.rowByTitle(title)).toHaveCount(1);
      }
      const rows = await getExpensesByTitles(file.titles);
      expect(rows).toHaveLength(3);
      const expected = [
        { amount: 12.5, category: 'Food', date: '2026-10-01' },
        { amount: 300, category: 'Travel', date: '2026-10-02' },
        { amount: 7.25, category: 'Office', date: '2026-10-03' },
      ];
      for (const [i, values] of expected.entries()) {
        await expectExpenseRow(
          rows.find((r) => r.title === file.titles[i]) ?? null,
          { title: file.titles[i], ...values },
          env.adminEmail,
        );
      }
    });

    test('importing a file with invalid rows lists the failing row numbers and saves nothing @ui @file @regression', async ({
      apiContext,
      cleanup,
    }) => {
      const file = await fixtureWithUniqueTitles('mixed-valid-invalid.xlsx');
      cleanup.trackTitles(apiContext, file.titles);

      const res = await expensesPage.importFile({ ...file, mimeType: XLSX_TYPE });

      expect(res.status()).toBe(400);
      await expect(expensesPage.importError).toContainText('Import failed');
      await expect(expensesPage.importError.getByRole('listitem')).toHaveText([
        'Row 4, amount: Amount must be greater than 0',
        `Row 5, category: ${CATEGORY_ERROR}`,
      ]);
      await expect(expensesPage.importMessage).toBeHidden();
      // The import is all-or-nothing: the two valid rows (2 and 3) are not saved either.
      expect(await getExpensesByTitles(file.titles)).toHaveLength(0);
      for (const title of file.titles) {
        await expect(expensesPage.rowByTitle(title)).toHaveCount(0);
      }
    });

    const malformed: { file: string; message: string; details: string[]; titleColumn?: string }[] = [
      {
        file: 'wrong-headers.xlsx',
        message: 'Import failed',
        details: ['Row 1, title: Missing column "title"', 'Row 1, amount: Missing column "amount"'],
        titleColumn: 'name',
      },
      {
        file: 'missing-amount-column.xlsx',
        message: 'Import failed',
        details: ['Row 1, amount: Missing column "amount"'],
        titleColumn: 'title',
      },
      { file: 'empty-sheet.xlsx', message: 'Workbook has no data rows', details: [] },
      { file: 'not-excel.xlsx', message: 'File is not a valid .xlsx workbook', details: [] },
    ];

    for (const c of malformed) {
      test(`importing ${c.file} shows "${c.message}" and adds no rows @ui @file @regression`, async ({
        apiContext,
        cleanup,
      }) => {
        // Uploaded as-is: these files must never insert, so fixed titles are safe.
        const titles = c.titleColumn ? await fixtureColumn(c.file, c.titleColumn) : [];
        cleanup.trackTitles(apiContext, titles);

        const res = await expensesPage.importFile(path.join(FILES_DIR, c.file));

        // 400, not 500. Files without titles have nothing to look up; the 400 proves nothing was stored.
        expect(res.status()).toBe(400);
        await expect(expensesPage.importError).toContainText(c.message);
        await expect(expensesPage.importError.getByRole('listitem')).toHaveText(c.details);
        await expect(expensesPage.importMessage).toBeHidden();
        expect(await getExpensesByTitles(titles)).toHaveLength(0);
      });
    }
  });
});
