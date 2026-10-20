/**
 * File-based workflows of the Expense Manager (a real business requirement):
 * - export returns a valid .xlsx
 * - headers match the expected structure
 * - exported rows match the API list
 * - filter-by-category export works
 * - invalid file types or malformed Excel files return 400
 * - row-level validation errors are reported correctly
 * - import rejects bad rows without importing partial data
 * - import limits and file-size checks work
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { test, expect, uniqueTitle } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { errorSchema, importErrorSchema, validationErrorSchema } from '../../schemas/error.schema';
import type { Expense } from '../../schemas/expense.schema';
import { importSuccessSchema } from '../../schemas/expense.schema';
import { expectSchema } from '../../schemas/validate';
import {
  buildXlsx,
  expectExportMatchesList,
  FILES_DIR as FILES,
  readExport,
  uploadXlsx as upload,
  XLSX_TYPE,
  type Cell,
} from '../../fixtures/xlsx';

const EXPORT = '/api/expenses/export';
const IMPORT = '/api/expenses/import';

async function listIds(ctx: APIRequestContext, category?: string): Promise<number[]> {
  const res = await ctx.get('/api/expenses', { params: category ? { category } : {} });
  return ((await res.json()) as Expense[]).map((e) => e.id);
}

test.describe('GET /api/expenses/export', { tag: ['@api', '@file'] }, () => {
  test('returns 200 with an xlsx attachment', { tag: '@smoke' }, async ({ apiContext }) => {
    const res = await apiContext.get(EXPORT);

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe(XLSX_TYPE);
    expect(res.headers()['content-disposition']).toBe('attachment; filename="expenses.xlsx"');
  });

  test('returns a parseable workbook with the expected header row', { tag: '@regression' }, async ({ apiContext }) => {
    const res = await apiContext.get(EXPORT);

    const { headers } = await readExport(await res.body());
    expect(headers).toEqual(['ID', 'Title', 'Amount', 'Category', 'Date', 'Created By']);
  });

  test('exports the same expenses as GET /api/expenses with matching values', { tag: '@regression' }, async ({ apiContext, createExpense }) => {
    const created = await createExpense({ amount: 123.45, category: 'Office', date: '2026-10-05' });
    const before = await listIds(apiContext);

    const res = await apiContext.get(EXPORT);
    const after = await listIds(apiContext);

    expect(res.status()).toBe(200);
    const { rows } = await readExport(await res.body());
    expectExportMatchesList(rows.map((r) => r.id), before, after);
    expect(rows.find((r) => r.id === created.id)).toEqual({
      id: created.id,
      title: created.title,
      amount: 123.45,
      category: 'Office',
      date: '2026-10-05',
      createdBy: env.adminEmail,
    });
  });

  test('exports only the requested category with ?category', { tag: '@regression' }, async ({ apiContext, createExpense }) => {
    const utilities = await createExpense({ category: 'Utilities' });
    const food = await createExpense({ category: 'Food' });
    const before = await listIds(apiContext, 'Utilities');

    const res = await apiContext.get(EXPORT, { params: { category: 'Utilities' } });
    const after = await listIds(apiContext, 'Utilities');

    expect(res.status()).toBe(200);
    const { rows } = await readExport(await res.body());
    expect(rows.every((r) => r.category === 'Utilities')).toBe(true);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(utilities.id);
    expect(ids).not.toContain(food.id);
    expectExportMatchesList(ids, before, after);
  });

  test('returns 400 for an unknown category filter', { tag: '@regression' }, async ({ apiContext }) => {
    const res = await apiContext.get(EXPORT, { params: { category: 'Bogus' } });

    expect(res.status()).toBe(400);
    expectSchema(await res.json(), validationErrorSchema);
  });

  test('returns 401 without a token', { tag: '@regression' }, async ({ request }) => {
    const res = await request.get(EXPORT);

    expect(res.status()).toBe(401);
    expectSchema(await res.json(), errorSchema);
  });
});

test.describe('POST /api/expenses/import', { tag: ['@api', '@file'] }, () => {
  test.describe('valid files', () => {
    test('returns 201 and creates every row owned by the caller', { tag: '@smoke' }, async ({ apiContext, cleanup }) => {
      const titles = [uniqueTitle('import'), uniqueTitle('import'), uniqueTitle('import')];
      cleanup.trackTitles(apiContext, titles);
      const file = await buildXlsx([
        ['title', 'amount', 'category', 'date'],
        [titles[0], 10.5, 'Food', '2026-10-01'],
        [titles[1], 200, 'Travel', '2026-10-02'],
        [titles[2], 7.25, 'Other', new Date(Date.UTC(2026, 9, 3))],
      ]);

      const res = await upload(apiContext, file);

      expect(res.status(), await res.text()).toBe(201);
      const body = await res.json();
      expectSchema(body, importSuccessSchema);
      expect(body).toEqual({ imported: 3 });
      const list = (await (await apiContext.get('/api/expenses')).json()) as Expense[];
      const imported = list.filter((e) => titles.includes(e.title));
      expect(imported.map(({ id, ...rest }) => rest)).toEqual(
        expect.arrayContaining([
          { title: titles[0], amount: 10.5, category: 'Food', date: '2026-10-01', created_by: env.adminEmail },
          { title: titles[1], amount: 200, category: 'Travel', date: '2026-10-02', created_by: env.adminEmail },
          { title: titles[2], amount: 7.25, category: 'Other', date: '2026-10-03', created_by: env.adminEmail },
        ]),
      );
      expect(imported).toHaveLength(3);
    });

    test('matches headers case-insensitively and ignores extra export columns', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
      const title = uniqueTitle('import');
      cleanup.trackTitles(apiContext, [title]);
      const file = await buildXlsx([
        ['ID', 'Title', 'Amount', 'Category', 'Date', 'Created By'],
        [987654, title, 33.3, 'Office', '2026-10-04', 'someone-else@test.com'],
      ]);

      const res = await upload(apiContext, file);

      expect(res.status(), await res.text()).toBe(201);
      expect(await res.json()).toEqual({ imported: 1 });
      const list = (await (await apiContext.get('/api/expenses')).json()) as Expense[];
      const row = list.find((e) => e.title === title);
      expect(row).toMatchObject({ amount: 33.3, category: 'Office', created_by: env.adminEmail });
      expect(row?.id).not.toBe(987654);
    });

    test('skips blank rows and does not count them', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
      const titles = [uniqueTitle('import'), uniqueTitle('import')];
      cleanup.trackTitles(apiContext, titles);
      const file = await buildXlsx([
        ['title', 'amount', 'category', 'date'],
        [titles[0], 1, 'Food', '2026-10-01'],
        ['  ', '', ' ', ''],
        [titles[1], 2, 'Food', '2026-10-01'],
      ]);

      const res = await upload(apiContext, file);

      expect(res.status(), await res.text()).toBe(201);
      expect(await res.json()).toEqual({ imported: 2 });
    });
  });

  test.describe('invalid files', { tag: '@regression' }, () => {
    test('returns 400 with row numbers for invalid rows and imports nothing', async ({ apiContext, cleanup }) => {
      const validTitle = uniqueTitle('import');
      cleanup.trackTitles(apiContext, [validTitle]);
      const file = await buildXlsx([
        ['title', 'amount', 'category', 'date'],
        [validTitle, 10, 'Food', '2026-10-01'],
        [uniqueTitle('import'), 'abc', 'Food', '2026-10-01'],
        [uniqueTitle('import'), 5, 'Groceries', '2026-10-01'],
      ]);

      const res = await upload(apiContext, file);

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, importErrorSchema);
      expect(body.details).toEqual([
        { row: 3, field: 'amount', message: 'Amount must be a number' },
        { row: 4, field: 'category', message: 'Category must be one of: Food, Travel, Office, Utilities, Entertainment, Other' },
      ]);
      const list = (await (await apiContext.get('/api/expenses')).json()) as Expense[];
      expect(list.map((e) => e.title)).not.toContain(validTitle);
    });

    test('returns 400 naming a missing column on row 1', async ({ apiContext }) => {
      const file = await buildXlsx([
        ['title', 'amount', 'category'],
        [uniqueTitle('import'), 10, 'Food'],
      ]);

      const res = await upload(apiContext, file);

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, importErrorSchema);
      expect(body.details).toEqual([{ row: 1, field: 'date', message: 'Missing column "date"' }]);
    });

    const fileErrors: { name: string; file: () => Promise<{ buffer: Buffer; name: string }>; error: string }[] = [
      {
        name: 'the file is a .csv',
        file: async () => ({ buffer: fs.readFileSync(path.join(FILES, 'expenses.csv')), name: 'expenses.csv' }),
        error: 'Upload a single .xlsx file in the "file" field',
      },
      {
        name: 'the .xlsx file is malformed',
        file: async () => ({ buffer: fs.readFileSync(path.join(FILES, 'malformed.xlsx')), name: 'malformed.xlsx' }),
        error: 'File is not a valid .xlsx workbook',
      },
      {
        name: 'the workbook has only a header row',
        file: async () => ({ buffer: await buildXlsx([['title', 'amount', 'category', 'date']]), name: 'empty.xlsx' }),
        error: 'Workbook has no data rows',
      },
      {
        name: 'the workbook has more than 1000 rows',
        file: async () => ({
          buffer: await buildXlsx([
            ['title', 'amount', 'category', 'date'],
            ...Array.from({ length: 1001 }, (_, i): Cell[] => [`too-many ${Date.now()} ${i}`, 1, 'Food', '2026-10-01']),
          ]),
          name: 'too-many.xlsx',
        }),
        error: 'Import is limited to 1000 rows',
      },
      {
        name: 'the file is larger than 5 MB',
        file: async () => ({ buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 'a'), name: 'huge.xlsx' }),
        error: 'File must be at most 5 MB',
      },
    ];

    for (const c of fileErrors) {
      test(`returns 400 when ${c.name}`, async ({ apiContext }) => {
        const { buffer, name } = await c.file();

        const res = await upload(apiContext, buffer, name);

        expect(res.status()).toBe(400);
        const body = await res.json();
        expectSchema(body, errorSchema);
        expect(body.error).toBe(c.error);
      });
    }

    test('returns 400 when no file is uploaded', async ({ apiContext }) => {
      const res = await apiContext.post(IMPORT, { multipart: { note: 'no file here' } });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, errorSchema);
      expect(body.error).toBe('No file uploaded; send an .xlsx file in the "file" field');
    });

    test('returns 400 when the file is sent in the wrong field', async ({ apiContext }) => {
      const buffer = await buildXlsx([['title', 'amount', 'category', 'date']]);

      const res = await apiContext.post(IMPORT, {
        multipart: { upload: { name: 'expenses.xlsx', mimeType: XLSX_TYPE, buffer } },
      });

      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe('Upload a single .xlsx file in the "file" field');
    });
  });

  test('returns 401 without a token', { tag: '@regression' }, async ({ request }) => {
    const file = await buildXlsx([['title', 'amount', 'category', 'date'], ['x', 1, 'Food', '2026-10-01']]);

    const res = await request.post(IMPORT, {
      multipart: { file: { name: 'expenses.xlsx', mimeType: XLSX_TYPE, buffer: file } },
    });

    expect(res.status()).toBe(401);
    expectSchema(await res.json(), errorSchema);
  });
});
