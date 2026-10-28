/**
 * Database checks for the expense CRUD API: every action is made through the API and
 * the stored row is read back with tests/db/db.helper.ts (read-only). Response bodies
 * are covered by tests/api/expenses.spec.ts; these tests only check what was written.
 */
import { test, expect, validExpense, uniqueTitle } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { CATEGORIES } from '../../schemas/expense.schema';
import { expectExpenseRow, getExpenseById, getExpensesByTitles } from './db.helper';

const EXPENSES = '/api/expenses';

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

    const stored: [string, Record<string, unknown>][] = [
      ['a 200-character title', { title: `${uniqueTitle()} `.padEnd(200, 'x') }],
      ['the minimum amount 0.01', { amount: 0.01 }],
      ['the maximum amount 1000000', { amount: 1000000 }],
      ['the amount 999999.99', { amount: 999999.99 }],
      ['a leap-day date', { date: '2028-02-29' }],
      ['a future date', { date: '2099-12-31' }],
      ['an old date', { date: '1900-01-01' }],
      ...CATEGORIES.map((category): [string, Record<string, unknown>] => [`category ${category}`, { category }]),
    ];

    for (const [name, overrides] of stored) {
      test(`POST stores ${name} exactly`, { tag: '@regression' }, async ({ apiContext, cleanup }) => {
        const input = validExpense(overrides);

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status(), await res.text()).toBe(201);
        const { id } = await res.json();
        cleanup.track(apiContext, id);
        await expectExpenseRow(await getExpenseById(id), input, env.adminEmail);
      });
    }

    test('POSTing the same expense twice stores two rows', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
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
      { name: 'amount is -0.01', overrides: { amount: -0.01 } },
      { name: 'amount has a thousands separator ("1,000")', overrides: { amount: '1,000' } },
      { name: 'amount has a decimal comma ("12,50")', overrides: { amount: '12,50' } },
      // An undefined override drops the field from the JSON body.
      { name: 'amount is missing', overrides: { amount: undefined } },
      { name: 'category is missing', overrides: { category: undefined } },
      { name: 'date is missing', overrides: { date: undefined } },
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

    test('PUT by another regular user returns 404 and leaves the row unchanged', async ({ userApiContext, createExpense }) => {
      const adminExpense = await createExpense();

      const res = await userApiContext.put(`${EXPENSES}/${adminExpense.id}`, {
        data: validExpense({ title: 'hijacked', amount: 1 }),
      });

      // Soft so the DB check below still runs and reports what changed.
      expect.soft(res.status()).toBe(404);
      await expectExpenseRow(await getExpenseById(adminExpense.id), adminExpense, env.adminEmail);
    });

    test('DELETE by another regular user returns 404 and keeps the row', async ({ userApiContext, createExpense }) => {
      const adminExpense = await createExpense();

      const res = await userApiContext.delete(`${EXPENSES}/${adminExpense.id}`);

      expect.soft(res.status()).toBe(404);
      await expectExpenseRow(await getExpenseById(adminExpense.id), adminExpense, env.adminEmail);
    });

    test("PUT by the admin on a user's expense returns 403 and leaves the row unchanged", async ({ apiContext, userApiContext, createExpense }) => {
      const userExpense = await createExpense({}, userApiContext);

      const res = await apiContext.put(`${EXPENSES}/${userExpense.id}`, {
        data: validExpense({ title: 'changed by admin', amount: 1 }),
      });

      expect.soft(res.status()).toBe(403);
      await expectExpenseRow(await getExpenseById(userExpense.id), userExpense, env.userEmail);
    });

    test("DELETE by the admin on a user's expense returns 403 and keeps the row", async ({ apiContext, userApiContext, createExpense }) => {
      const userExpense = await createExpense({}, userApiContext);

      const res = await apiContext.delete(`${EXPENSES}/${userExpense.id}`);

      expect.soft(res.status()).toBe(403);
      await expectExpenseRow(await getExpenseById(userExpense.id), userExpense, env.userEmail);
    });
  });
});
