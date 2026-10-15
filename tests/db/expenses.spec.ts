/**
 * Database checks for the expense CRUD API: every action is made through the API and
 * the stored row is read back with tests/db/db.helper.ts (read-only). Response bodies
 * are covered by tests/api/expenses.spec.ts; these tests only check what was written.
 */
import { test, expect, validExpense, uniqueTitle } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { expectExpenseRow, getExpenseById, getExpensesByTitles } from './db.helper';

const EXPENSES = '/api/expenses';

// Known app bug BUG-001 (docs/bugs-found.md): no ownership check on /api/expenses, so
// another user can change or delete any expense.
const IDOR_BUG = 'App bug BUG-001: no ownership check on /api/expenses (IDOR)';

test.describe('Expenses CRUD in the database', { tag: '@db' }, () => {
  test.describe('successful writes', () => {
    test('POST stores a row matching the input, owned by the caller', { tag: '@smoke' }, async ({ apiContext, cleanup }) => {
      const input = validExpense({ amount: 19.99, category: 'Travel', date: '2026-10-02' });

      const res = await apiContext.post(EXPENSES, { data: input });

      expect(res.status(), await res.text()).toBe(201);
      const { id } = await res.json();
      cleanup.track(apiContext, id);
      await expectExpenseRow(await getExpenseById(id), input, env.adminEmail);
    });

    test('POST stores the regular user as owner when they create an expense', { tag: '@regression' }, async ({ userApiContext, createExpense }) => {
      const created = await createExpense({}, userApiContext);

      await expectExpenseRow(await getExpenseById(created.id), created, env.userEmail);
    });

    test('POST stores a trimmed title and a numeric-string amount as NUMERIC', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
      const title = uniqueTitle();

      const res = await apiContext.post(EXPENSES, { data: validExpense({ title: `   ${title}   `, amount: '12.50' }) });

      expect(res.status(), await res.text()).toBe(201);
      const { id } = await res.json();
      cleanup.track(apiContext, id);
      const row = await getExpenseById(id);
      expect(row?.title).toBe(title);
      expect(row?.amount).toBe('12.50');
    });

    for (const [name, overrides] of [
      ['a 200-character title', { title: `${uniqueTitle()} `.padEnd(200, 'x') }],
      ['the minimum amount 0.01', { amount: 0.01 }],
      ['the maximum amount 1000000', { amount: 1000000 }],
      ['a leap-day date', { date: '2028-02-29' }],
    ] as const) {
      test(`POST stores ${name} exactly`, { tag: '@regression' }, async ({ apiContext, cleanup }) => {
        const input = validExpense(overrides);

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status(), await res.text()).toBe(201);
        const { id } = await res.json();
        cleanup.track(apiContext, id);
        await expectExpenseRow(await getExpenseById(id), input, env.adminEmail);
      });
    }

    test('PUT stores the new values and keeps the id and owner', { tag: '@regression' }, async ({ apiContext, createExpense }) => {
      const created = await createExpense();
      const update = validExpense({ amount: 75, category: 'Office', date: '2026-10-10' });

      const res = await apiContext.put(`${EXPENSES}/${created.id}`, { data: update });

      expect(res.status(), await res.text()).toBe(200);
      const row = await getExpenseById(created.id);
      await expectExpenseRow(row, update, env.adminEmail);
      expect(row?.id).toBe(created.id);
    });

    test('DELETE removes the row', { tag: '@regression' }, async ({ apiContext, createExpense }) => {
      const created = await createExpense();

      const res = await apiContext.delete(`${EXPENSES}/${created.id}`);

      expect(res.status()).toBe(204);
      expect(await getExpenseById(created.id)).toBeNull();
    });
  });

  test.describe('rejected requests', { tag: '@regression' }, () => {
    const unauthorized = [
      { label: 'without a token', headers: {} },
      { label: 'with an invalid token', headers: { Authorization: 'Bearer not.a.jwt' } },
    ] as const;

    for (const auth of unauthorized) {
      test(`POST ${auth.label} inserts no row`, async ({ request }) => {
        const input = validExpense();

        const res = await request.post(`${env.apiUrl}${EXPENSES}`, { data: input, headers: auth.headers });

        expect(res.status()).toBe(401);
        expect(await getExpensesByTitles([input.title as string])).toEqual([]);
      });

      for (const method of ['put', 'delete'] as const) {
        test(`${method.toUpperCase()} ${auth.label} leaves the row unchanged`, async ({ request, createExpense }) => {
          const created = await createExpense();

          const res = await request[method](`${env.apiUrl}${EXPENSES}/${created.id}`, {
            data: validExpense({ amount: 1 }),
            headers: auth.headers,
          });

          expect(res.status()).toBe(401);
          await expectExpenseRow(await getExpenseById(created.id), created, env.adminEmail);
        });
      }
    }

    const invalid: { name: string; overrides: Record<string, unknown> }[] = [
      { name: 'title is only whitespace', overrides: { title: '    ' } },
      { name: 'title is longer than 200 characters', overrides: { title: `${uniqueTitle()} `.padEnd(201, 'x') } },
      { name: 'amount is not a number', overrides: { amount: 'abc' } },
      { name: 'amount is zero', overrides: { amount: 0 } },
      { name: 'amount is negative', overrides: { amount: -5 } },
      { name: 'amount is above 1000000', overrides: { amount: 1000000.01 } },
      { name: 'amount has 3 decimal places', overrides: { amount: 10.123 } },
      { name: 'category is not allowed', overrides: { category: 'Groceries' } },
      { name: 'date does not exist', overrides: { date: '2026-02-30' } },
    ];

    for (const c of invalid) {
      test(`POST inserts no row when ${c.name}`, async ({ apiContext }) => {
        const input = validExpense(c.overrides);
        const title = input.title as string;

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status()).toBe(400);
        expect(await getExpensesByTitles([title, title.trim(), title.slice(0, 200)])).toEqual([]);
      });
    }

    test('PUT with an invalid body leaves the row unchanged', async ({ apiContext, createExpense }) => {
      const created = await createExpense();

      const res = await apiContext.put(`${EXPENSES}/${created.id}`, {
        data: validExpense({ amount: -1, category: 'Nope' }),
      });

      expect(res.status()).toBe(400);
      await expectExpenseRow(await getExpenseById(created.id), created, env.adminEmail);
    });

    test('PUT by another user leaves the row unchanged', async ({ userApiContext, createExpense }) => {
      test.fail(true, IDOR_BUG);
      const adminExpense = await createExpense();

      const res = await userApiContext.put(`${EXPENSES}/${adminExpense.id}`, {
        data: validExpense({ title: 'hijacked', amount: 1 }),
      });

      // Soft so the DB check below still runs and reports what the bug changed.
      expect.soft([403, 404]).toContain(res.status());
      await expectExpenseRow(await getExpenseById(adminExpense.id), adminExpense, env.adminEmail);
    });

    test('DELETE by another user keeps the row', async ({ userApiContext, createExpense }) => {
      test.fail(true, IDOR_BUG);
      const adminExpense = await createExpense();

      const res = await userApiContext.delete(`${EXPENSES}/${adminExpense.id}`);

      expect.soft([403, 404]).toContain(res.status());
      await expectExpenseRow(await getExpenseById(adminExpense.id), adminExpense, env.adminEmail);
    });
  });
});
