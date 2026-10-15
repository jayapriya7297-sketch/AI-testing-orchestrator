/**
 * Database checks for POST /api/expenses/import: the rows inserted match the valid
 * rows in the file, and a file with any invalid row inserts nothing (all-or-nothing).
 * Response bodies are covered by tests/api/expenses-file.spec.ts.
 */
import { test, expect, uniqueTitle } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { buildXlsx, uploadXlsx } from '../../fixtures/xlsx';
import { expectExpenseRow, getExpensesByTitles } from './db.helper';

test.describe('Expense import in the database', { tag: '@db' }, () => {
  test('inserts one row per valid row, owned by the caller', { tag: '@smoke' }, async ({ apiContext, cleanup }) => {
    const titles = [uniqueTitle('import'), uniqueTitle('import'), uniqueTitle('import')];
    cleanup.trackTitles(apiContext, titles);
    const expected = [
      { title: titles[0], amount: 10.5, category: 'Food', date: '2026-10-01' },
      { title: titles[1], amount: 200, category: 'Travel', date: '2026-10-02' },
      { title: titles[2], amount: 7.25, category: 'Other', date: '2026-10-03' },
    ];
    const file = await buildXlsx([
      ['title', 'amount', 'category', 'date'],
      [titles[0], 10.5, 'Food', '2026-10-01'],
      [titles[1], 200, 'Travel', '2026-10-02'],
      [titles[2], 7.25, 'Other', new Date(Date.UTC(2026, 9, 3))],
    ]);

    const res = await uploadXlsx(apiContext, file);

    expect(res.status(), await res.text()).toBe(201);
    const rows = await getExpensesByTitles(titles);
    expect(rows).toHaveLength(3);
    for (const e of expected) {
      await expectExpenseRow(rows.find((r) => r.title === e.title) ?? null, e, env.adminEmail);
    }
  });

  test('ignores the ID and Created By columns of an export file', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
    const title = uniqueTitle('import');
    cleanup.trackTitles(apiContext, [title]);
    const file = await buildXlsx([
      ['ID', 'Title', 'Amount', 'Category', 'Date', 'Created By'],
      [987654, title, 33.3, 'Office', '2026-10-04', env.userEmail],
    ]);

    const res = await uploadXlsx(apiContext, file);

    expect(res.status(), await res.text()).toBe(201);
    const rows = await getExpensesByTitles([title]);
    expect(rows).toHaveLength(1);
    await expectExpenseRow(rows[0], { title, amount: 33.3, category: 'Office', date: '2026-10-04' }, env.adminEmail);
    expect(rows[0].id).not.toBe(987654);
  });

  test('inserts nothing for blank rows', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
    const titles = [uniqueTitle('import'), uniqueTitle('import')];
    cleanup.trackTitles(apiContext, titles);
    const file = await buildXlsx([
      ['title', 'amount', 'category', 'date'],
      [titles[0], 1, 'Food', '2026-10-01'],
      ['  ', '', ' ', ''],
      [titles[1], 2, 'Food', '2026-10-01'],
    ]);

    const res = await uploadXlsx(apiContext, file);

    expect(res.status(), await res.text()).toBe(201);
    const rows = await getExpensesByTitles(titles);
    expect(rows.map((r) => r.title).sort()).toEqual([...titles].sort());
  });

  test('inserts nothing, not even the valid rows, when any row is invalid', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
    const titles = [uniqueTitle('import'), uniqueTitle('import'), uniqueTitle('import')];
    cleanup.trackTitles(apiContext, titles);
    const file = await buildXlsx([
      ['title', 'amount', 'category', 'date'],
      [titles[0], 10, 'Food', '2026-10-01'],
      [titles[1], 'abc', 'Food', '2026-10-01'],
      [titles[2], 5, 'Groceries', '2026-10-01'],
    ]);

    const res = await uploadXlsx(apiContext, file);

    expect(res.status()).toBe(400);
    expect(await getExpensesByTitles(titles)).toEqual([]);
  });
});
