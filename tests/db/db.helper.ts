import { expect } from '@playwright/test';
import { Pool } from 'pg';
import { env } from '../../fixtures/env';

/** An expenses row as stored. amount is NUMERIC (pg returns a string, e.g. "42.50"); date is formatted as YYYY-MM-DD. */
export type ExpenseRow = {
  id: number;
  title: string;
  amount: string;
  category: string;
  date: string;
  created_by: number;
  created_by_email: string;
};

export type UserRow = { id: number; email: string; role: 'admin' | 'user' };

let pool: Pool | undefined;

function db(): Pool {
  if (!env.databaseUrl) {
    throw new Error('Missing environment variable DATABASE_URL; copy it from .env.example into .env');
  }
  pool ??= new Pool({ connectionString: env.databaseUrl, max: 2 });
  return pool;
}

const SELECT_EXPENSE = `
  SELECT e.id, e.title, e.amount::text AS amount, e.category,
         to_char(e.date, 'YYYY-MM-DD') AS date, e.created_by, u.email AS created_by_email
  FROM expenses e JOIN users u ON u.id = e.created_by`;

// Read-only helpers: tests never write to the database directly.

export async function getExpenseById(id: number): Promise<ExpenseRow | null> {
  const { rows } = await db().query<ExpenseRow>(`${SELECT_EXPENSE} WHERE e.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getExpensesByTitles(titles: string[]): Promise<ExpenseRow[]> {
  const { rows } = await db().query<ExpenseRow>(
    `${SELECT_EXPENSE} WHERE e.title = ANY($1::text[]) ORDER BY e.id`,
    [titles],
  );
  return rows;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await db().query<UserRow>('SELECT id, email, role FROM users WHERE email = $1', [email]);
  return rows[0] ?? null;
}

/**
 * Asserts the stored row matches an API-level expense (amount as a number, date as
 * YYYY-MM-DD) and is owned by ownerEmail: created_by holds that user's id.
 */
export async function expectExpenseRow(
  row: ExpenseRow | null,
  expected: { title: unknown; amount: unknown; category: unknown; date: unknown },
  ownerEmail: string,
): Promise<void> {
  const owner = await getUserByEmail(ownerEmail);
  expect(owner, `user ${ownerEmail} in the database`).not.toBeNull();
  expect(row, 'expense row in the database').not.toBeNull();
  expect(row).toMatchObject({
    title: expected.title,
    amount: Number(expected.amount).toFixed(2),
    category: expected.category,
    date: expected.date,
    created_by: owner?.id,
    created_by_email: ownerEmail,
  });
}

/** Closes the pool; called once per worker by the dbConnection fixture in fixtures/expenses.ts. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
