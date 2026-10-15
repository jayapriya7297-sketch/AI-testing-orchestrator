import type { APIRequestContext } from '@playwright/test';
import { test as apiTest, expect } from './api';
import type { Category, Expense } from '../schemas/expense.schema';
import { closeDb } from '../tests/db/db.helper';

export type ExpenseInput = {
  title: unknown;
  amount: unknown;
  category: unknown;
  date: unknown;
};

let counter = 0;

/** Title unique across parallel workers and runs, e.g. "api-test 1739999999999-4821-3". */
export function uniqueTitle(prefix = 'api-test'): string {
  counter += 1;
  return `${prefix} ${Date.now()}-${process.pid}-${counter}`;
}

export function validExpense(overrides: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    title: uniqueTitle(),
    amount: 42.5,
    category: 'Food' satisfies Category,
    date: '2026-10-01',
    ...overrides,
  };
}

type Cleanup = {
  /** Deletes the expense with ctx after the test; a 404 (already deleted) is fine. */
  track(ctx: APIRequestContext, id: number): void;
  /** Deletes every expense whose title is in titles (for imports, which return no ids). */
  trackTitles(ctx: APIRequestContext, titles: string[]): void;
};

type ExpenseFixtures = {
  cleanup: Cleanup;
  /** Creates an expense as admin via the API and deletes it after the test. */
  createExpense: (overrides?: Partial<ExpenseInput>, ctx?: APIRequestContext) => Promise<Expense>;
};

type WorkerFixtures = {
  /** Closes the read-only DB pool (tests/db/db.helper.ts) when the worker exits. */
  dbConnection: void;
};

export const test = apiTest.extend<ExpenseFixtures, WorkerFixtures>({
  dbConnection: [
    async ({}, use) => {
      await use();
      await closeDb();
    },
    { scope: 'worker', auto: true },
  ],
  // Depends on both contexts so they are torn down after the cleanup runs.
  cleanup: async ({ apiContext, userApiContext }, use) => {
    const ids: { ctx: APIRequestContext; id: number }[] = [];
    const titleSets: { ctx: APIRequestContext; titles: string[] }[] = [];
    await use({
      track: (ctx, id) => ids.push({ ctx, id }),
      trackTitles: (ctx, titles) => titleSets.push({ ctx, titles }),
    });
    for (const { ctx, titles } of titleSets) {
      const list = (await (await ctx.get('/api/expenses')).json()) as Expense[];
      list.filter((e) => titles.includes(e.title)).forEach((e) => ids.push({ ctx, id: e.id }));
    }
    for (const { ctx, id } of ids) {
      const res = await ctx.delete(`/api/expenses/${id}`);
      expect([204, 404], `cleanup of expense ${id}`).toContain(res.status());
    }
  },
  createExpense: async ({ apiContext, cleanup }, use) => {
    await use(async (overrides = {}, ctx = apiContext) => {
      const res = await ctx.post('/api/expenses', { data: validExpense(overrides) });
      expect(res.status(), await res.text()).toBe(201);
      const expense = (await res.json()) as Expense;
      cleanup.track(ctx, expense.id);
      return expense;
    });
  },
});

export { expect };
