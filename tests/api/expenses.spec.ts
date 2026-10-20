import ExcelJS from 'exceljs';
import { test, expect, validExpense, uniqueTitle } from '../../fixtures/expenses';
import { env } from '../../fixtures/env';
import { errorSchema, validationErrorSchema } from '../../schemas/error.schema';
import { CATEGORIES, expenseSchema, expenseListSchema, type Expense } from '../../schemas/expense.schema';
import { expectSchema } from '../../schemas/validate';

const EXPENSES = '/api/expenses';
const UNKNOWN_ID = 999999999;

// Known app bug (IDOR / OWASP API1 BOLA): routes/expenses.js looks up, updates and
// deletes by id only and never compares created_by with req.user, so any logged-in
// user can read, edit and delete every other user's expenses. These tests assert the
// secure behaviour and are marked test.fail() until the API enforces ownership.
const IDOR_BUG = 'App bug BUG-001: no ownership check on /api/expenses (IDOR); see comment at top of file';

test.describe('Expenses CRUD', { tag: '@api' }, () => {
  test.describe('happy path', () => {
    test('POST returns 201 with the created expense owned by the caller', { tag: '@smoke' }, async ({ apiContext, cleanup }) => {
      const input = validExpense({ amount: 19.99, category: 'Travel', date: '2026-10-02' });

      const res = await apiContext.post(EXPENSES, { data: input });

      expect(res.status()).toBe(201);
      const body = await res.json();
      cleanup.track(apiContext, body.id);
      expectSchema(body, expenseSchema);
      expect(body).toMatchObject({ ...input, created_by: env.adminEmail });
    });

    test('GET /:id returns 200 with the expense', { tag: '@smoke' }, async ({ apiContext, createExpense }) => {
      const created = await createExpense();

      const res = await apiContext.get(`${EXPENSES}/${created.id}`);

      expect(res.status()).toBe(200);
      const body = await res.json();
      expectSchema(body, expenseSchema);
      expect(body).toEqual(created);
    });

    test('GET list returns 200 and includes a new expense', { tag: '@regression' }, async ({ apiContext, createExpense }) => {
      const created = await createExpense();

      const res = await apiContext.get(EXPENSES);

      expect(res.status()).toBe(200);
      const body = (await res.json()) as Expense[];
      expectSchema(body, expenseListSchema);
      expect(body).toContainEqual(created);
    });

    test('GET list with ?category returns only that category', { tag: '@regression' }, async ({ apiContext, createExpense }) => {
      const travel = await createExpense({ category: 'Travel' });
      const food = await createExpense({ category: 'Food' });

      const res = await apiContext.get(EXPENSES, { params: { category: 'Travel' } });

      expect(res.status()).toBe(200);
      const body = (await res.json()) as Expense[];
      expectSchema(body, expenseListSchema);
      expect(body.every((e) => e.category === 'Travel')).toBe(true);
      expect(body.map((e) => e.id)).toContain(travel.id);
      expect(body.map((e) => e.id)).not.toContain(food.id);
    });

    test('PUT returns 200 with the updated expense and persists it', { tag: '@regression' }, async ({ apiContext, createExpense }) => {
      const created = await createExpense();
      const update = validExpense({ amount: 75, category: 'Office', date: '2026-10-10' });

      const res = await apiContext.put(`${EXPENSES}/${created.id}`, { data: update });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expectSchema(body, expenseSchema);
      expect(body).toEqual({ ...update, id: created.id, created_by: created.created_by });
      const reread = await apiContext.get(`${EXPENSES}/${created.id}`);
      expect(await reread.json()).toEqual(body);
    });

    test('DELETE returns 204 and the expense is gone', { tag: '@regression' }, async ({ apiContext, createExpense }) => {
      const created = await createExpense();

      const res = await apiContext.delete(`${EXPENSES}/${created.id}`);

      expect(res.status()).toBe(204);
      expect(await res.text()).toBe('');
      const reread = await apiContext.get(`${EXPENSES}/${created.id}`);
      expect(reread.status()).toBe(404);
    });

    test('POST trims the title and accepts a numeric-string amount', { tag: '@regression' }, async ({ apiContext, cleanup }) => {
      const title = uniqueTitle();

      const res = await apiContext.post(EXPENSES, {
        data: validExpense({ title: `   ${title}   `, amount: '12.50' }),
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      cleanup.track(apiContext, body.id);
      expect(body.title).toBe(title);
      expect(body.amount).toBe(12.5);
    });

    const accepted: [string, Record<string, unknown>][] = [
      ['a 200-character title', { title: `${uniqueTitle()} `.padEnd(200, 'x') }],
      ['the minimum amount 0.01', { amount: 0.01 }],
      ['the maximum amount 1000000', { amount: 1000000 }],
      ['the amount 999999.99', { amount: 999999.99 }],
      ['a leap-day date', { date: '2028-02-29' }],
      ['a future date', { date: '2099-12-31' }],
      ['an old date', { date: '1900-01-01' }],
      ...CATEGORIES.map((category): [string, Record<string, unknown>] => [`category ${category}`, { category }]),
    ];

    for (const [name, overrides] of accepted) {
      test(`POST returns 201 for ${name}`, { tag: '@regression' }, async ({ apiContext, cleanup }) => {
        const input = validExpense(overrides);

        const res = await apiContext.post(EXPENSES, { data: input });

        expect(res.status(), await res.text()).toBe(201);
        const body = await res.json();
        cleanup.track(apiContext, body.id);
        expectSchema(body, expenseSchema);
        expect(body).toMatchObject(input);
      });
    }
  });

  test.describe('authentication', { tag: '@regression' }, () => {
    const calls = [
      { name: 'GET list', method: 'get', path: EXPENSES },
      { name: 'GET /:id', method: 'get', path: `${EXPENSES}/${UNKNOWN_ID}` },
      { name: 'POST', method: 'post', path: EXPENSES },
      { name: 'PUT', method: 'put', path: `${EXPENSES}/${UNKNOWN_ID}` },
      { name: 'DELETE', method: 'delete', path: `${EXPENSES}/${UNKNOWN_ID}` },
    ] as const;

    for (const call of calls) {
      test(`${call.name} returns 401 without a token`, async ({ request }) => {
        const res = await request[call.method](call.path, { data: validExpense() });

        expect(res.status()).toBe(401);
        const body = await res.json();
        expectSchema(body, errorSchema);
        expect(body.error).toBe('Authentication token missing');
      });

      test(`${call.name} returns 401 with an invalid token`, async ({ request }) => {
        const res = await request[call.method](call.path, {
          data: validExpense(),
          headers: { Authorization: 'Bearer not.a.jwt' },
        });

        expect(res.status()).toBe(401);
        const body = await res.json();
        expectSchema(body, errorSchema);
        expect(body.error).toBe('Invalid or expired token');
      });
    }

    test('returns 401 for a real token with a tampered signature', async ({ request }) => {
      const login = await request.post('/api/auth/login', {
        data: { email: env.adminEmail, password: env.adminPassword },
      });
      const token: string = (await login.json()).token;
      const sig = token.split('.')[2];
      const tampered = `${token.slice(0, -sig.length)}${sig.startsWith('A') ? 'B' : 'A'}${sig.slice(1)}`;

      const res = await request.get(EXPENSES, { headers: { Authorization: `Bearer ${tampered}` } });

      expect(res.status()).toBe(401);
      expect((await res.json()).error).toBe('Invalid or expired token');
    });

    test('returns 401 for a non-Bearer authorization scheme', async ({ request }) => {
      const res = await request.get(EXPENSES, { headers: { Authorization: 'Basic YWRtaW46YWRtaW4=' } });

      expect(res.status()).toBe(401);
      expect((await res.json()).error).toBe('Authentication token missing');
    });
  });

  test.describe('validation', { tag: '@regression' }, () => {
    test('POST returns 400 listing every field when the body is empty', async ({ apiContext }) => {
      const res = await apiContext.post(EXPENSES, { data: {} });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, validationErrorSchema);
      expect(body.details).toEqual([
        { field: 'title', message: 'Title is required' },
        { field: 'amount', message: 'Amount is required' },
        { field: 'category', message: 'Category is required' },
        { field: 'date', message: 'Date is required' },
      ]);
    });

    // An undefined override drops the field from the JSON body.
    const invalid: { name: string; overrides: Record<string, unknown>; field: string; message: string }[] = [
      { name: 'title is missing', overrides: { title: undefined }, field: 'title', message: 'Title is required' },
      { name: 'amount is missing', overrides: { amount: undefined }, field: 'amount', message: 'Amount is required' },
      { name: 'category is missing', overrides: { category: undefined }, field: 'category', message: 'Category is required' },
      { name: 'date is missing', overrides: { date: undefined }, field: 'date', message: 'Date is required' },
      { name: 'title is only whitespace', overrides: { title: '    ' }, field: 'title', message: 'Title is required' },
      { name: 'title is longer than 200 characters', overrides: { title: 'x'.repeat(201) }, field: 'title', message: 'Title must be at most 200 characters' },
      { name: 'amount is not a number', overrides: { amount: 'abc' }, field: 'amount', message: 'Amount must be a number' },
      { name: 'amount is a boolean', overrides: { amount: true }, field: 'amount', message: 'Amount must be a number' },
      { name: 'amount is zero', overrides: { amount: 0 }, field: 'amount', message: 'Amount must be greater than 0' },
      { name: 'amount is negative', overrides: { amount: -5 }, field: 'amount', message: 'Amount must be greater than 0' },
      { name: 'amount is -0.01', overrides: { amount: -0.01 }, field: 'amount', message: 'Amount must be greater than 0' },
      { name: 'amount has a thousands separator ("1,000")', overrides: { amount: '1,000' }, field: 'amount', message: 'Amount must be a number' },
      { name: 'amount has a decimal comma ("12,50")', overrides: { amount: '12,50' }, field: 'amount', message: 'Amount must be a number' },
      { name: 'amount is above 1000000', overrides: { amount: 1000000.01 }, field: 'amount', message: 'Amount must be at most 1000000' },
      { name: 'amount has 3 decimal places', overrides: { amount: 10.123 }, field: 'amount', message: 'Amount must have at most 2 decimal places' },
      { name: 'category is not allowed', overrides: { category: 'Groceries' }, field: 'category', message: 'Category must be one of: Food, Travel, Office, Utilities, Entertainment, Other' },
      { name: 'category has the wrong case', overrides: { category: 'food' }, field: 'category', message: 'Category must be one of: Food, Travel, Office, Utilities, Entertainment, Other' },
      { name: 'date does not exist', overrides: { date: '2026-02-30' }, field: 'date', message: 'Date must be a valid date in YYYY-MM-DD format' },
      { name: 'date is DD/MM/YYYY', overrides: { date: '15/10/2026' }, field: 'date', message: 'Date must be a valid date in YYYY-MM-DD format' },
      { name: 'date is not zero-padded', overrides: { date: '2026-1-5' }, field: 'date', message: 'Date must be a valid date in YYYY-MM-DD format' },
    ];

    for (const c of invalid) {
      test(`POST returns 400 when ${c.name}`, async ({ apiContext }) => {
        const res = await apiContext.post(EXPENSES, { data: validExpense(c.overrides) });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expectSchema(body, validationErrorSchema);
        expect(body.details).toEqual([{ field: c.field, message: c.message }]);
      });
    }

    test('POST returns 400 "Title must be a string" when title is a number', async ({ apiContext }) => {
      // App bug: validate.js coerces a non-string title to '' before the type check, so it
      // reports "Title is required" and the "Title must be a string" branch is unreachable.
      test.fail(true, 'App bug: non-string title reports "Title is required" (validate.js)');
      const res = await apiContext.post(EXPENSES, { data: validExpense({ title: 12345 }) });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, validationErrorSchema);
      expect(body.details).toEqual([{ field: 'title', message: 'Title must be a string' }]);
    });

    test('PUT returns 400 for an invalid body and leaves the expense unchanged', async ({ apiContext, createExpense }) => {
      const created = await createExpense();

      const res = await apiContext.put(`${EXPENSES}/${created.id}`, {
        data: validExpense({ amount: -1, category: 'Nope' }),
      });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, validationErrorSchema);
      expect(body.details.map((d: { field: string }) => d.field)).toEqual(['amount', 'category']);
      const reread = await apiContext.get(`${EXPENSES}/${created.id}`);
      expect(await reread.json()).toEqual(created);
    });

    for (const method of ['get', 'put', 'delete'] as const) {
      test(`${method.toUpperCase()} /:id returns 400 for a non-numeric id`, async ({ apiContext }) => {
        const res = await apiContext[method](`${EXPENSES}/abc`, { data: validExpense() });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expectSchema(body, validationErrorSchema);
        expect(body.details).toEqual([{ field: 'id', message: 'Id must be a positive integer' }]);
      });
    }

    test('GET list returns 400 for an unknown category filter', async ({ apiContext }) => {
      const res = await apiContext.get(EXPENSES, { params: { category: 'Bogus' } });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, validationErrorSchema);
      expect(body.details[0].field).toBe('category');
    });

    test('POST returns 400 when the body is not valid JSON', async ({ apiContext }) => {
      const res = await apiContext.post(EXPENSES, {
        headers: { 'Content-Type': 'application/json' },
        data: '{"title": "broken",',
      });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expectSchema(body, errorSchema);
      expect(body.error).toBe('Request body is not valid JSON');
    });
  });

  test.describe('unknown ids', { tag: '@regression' }, () => {
    for (const method of ['get', 'put', 'delete'] as const) {
      test(`${method.toUpperCase()} /:id returns 404 for an id that does not exist`, async ({ apiContext }) => {
        const res = await apiContext[method](`${EXPENSES}/${UNKNOWN_ID}`, { data: validExpense() });

        expect(res.status()).toBe(404);
        const body = await res.json();
        expectSchema(body, errorSchema);
        expect(body.error).toBe('Expense not found');
      });

      test(`${method.toUpperCase()} /:id returns 400 or 404 (not 500) for an id beyond the integer range`, async ({ apiContext }) => {
        // App bug BUG-003 (docs/bugs-found.md): parseId accepts any digits and Postgres rejects
        // the out-of-range integer, so the API answers 500 "Internal server error".
        test.fail(true, 'App bug BUG-003: oversized id returns 500');
        const res = await apiContext[method](`${EXPENSES}/99999999999`, { data: validExpense() });

        expect([400, 404]).toContain(res.status());
        expectSchema(await res.json(), res.status() === 400 ? validationErrorSchema : errorSchema);
      });
    }
  });

  test.describe('another user\'s expense', { tag: '@regression' }, () => {
    test('a user can GET their own expense (control)', async ({ userApiContext, createExpense }) => {
      const own = await createExpense({}, userApiContext);

      const res = await userApiContext.get(`${EXPENSES}/${own.id}`);

      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ id: own.id, created_by: env.userEmail });
    });

    test('GET returns 403 or 404 for another user\'s expense', async ({ userApiContext, createExpense }) => {
      test.fail(true, IDOR_BUG);
      const adminExpense = await createExpense();

      const res = await userApiContext.get(`${EXPENSES}/${adminExpense.id}`);

      expect([403, 404]).toContain(res.status());
    });

    test('PUT returns 403 or 404 for another user\'s expense and leaves it unchanged', async ({ apiContext, userApiContext, createExpense }) => {
      test.fail(true, IDOR_BUG);
      const adminExpense = await createExpense();

      const res = await userApiContext.put(`${EXPENSES}/${adminExpense.id}`, {
        data: validExpense({ title: 'hijacked', amount: 1 }),
      });

      expect([403, 404]).toContain(res.status());
      const reread = await apiContext.get(`${EXPENSES}/${adminExpense.id}`);
      expect(await reread.json()).toEqual(adminExpense);
    });

    test('DELETE returns 403 or 404 for another user\'s expense and keeps it', async ({ apiContext, userApiContext, createExpense }) => {
      test.fail(true, IDOR_BUG);
      const adminExpense = await createExpense();

      const res = await userApiContext.delete(`${EXPENSES}/${adminExpense.id}`);

      expect([403, 404]).toContain(res.status());
      const reread = await apiContext.get(`${EXPENSES}/${adminExpense.id}`);
      expect(reread.status()).toBe(200);
    });

    test('GET list does not include another user\'s expense', async ({ userApiContext, createExpense }) => {
      test.fail(true, IDOR_BUG);
      const adminExpense = await createExpense();

      const res = await userApiContext.get(EXPENSES);

      expect(res.status()).toBe(200);
      const body = (await res.json()) as Expense[];
      expect(body.every((e) => e.created_by === env.userEmail)).toBe(true);
      expect(body.map((e) => e.id)).not.toContain(adminExpense.id);
    });

    test('export does not include another user\'s expense', { tag: '@file' }, async ({ userApiContext, createExpense }) => {
      test.fail(true, IDOR_BUG);
      const adminExpense = await createExpense();

      const res = await userApiContext.get(`${EXPENSES}/export`);

      expect(res.status()).toBe(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load((await res.body()) as unknown as ExcelJS.Buffer);
      const ids: unknown[] = [];
      workbook.worksheets[0].eachRow((row, n) => {
        if (n > 1) ids.push(row.getCell(1).value);
      });
      expect(ids).not.toContain(adminExpense.id);
    });
  });
});
