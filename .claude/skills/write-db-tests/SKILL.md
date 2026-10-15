---
name: write-db-tests
description: Add database validation (Postgres) to Expense Manager tests, checking that API or UI actions left the right rows behind. Use when asked to add, extend or review DB checks.
---

# Write DB tests

Rules: follow CLAUDE.md and tests/CLAUDE.md. This skill is only the procedure.

1. Read app/db/init/01-schema.sql for the tables and columns involved, and the
   API route code for what each action should write. Note column types
   (e.g. NUMERIC amounts come back as strings from pg, dates as Date objects;
   the helper selects dates with to_char(..., 'YYYY-MM-DD') to avoid timezone shifts).
2. Reuse tests/db/db.helper.ts (getExpenseById, getExpensesByTitles,
   getUserByEmail, expectExpenseRow); add read-only helpers there if needed.
   The pool is closed per worker by the dbConnection fixture in
   fixtures/expenses.ts, so specs must import test from fixtures/expenses.
   Do not add a Playwright globalTeardown: it runs in another process and
   cannot close the workers' pools.
3. List the DB checks and WAIT for the user's approval before writing code:
   - After create: row exists and every field matches the input;
     created_by is the logged-in user
   - After update: row has the new values; unchanged fields stay the same
   - After delete: row no longer exists
   - After a rejected request (400, 401, 403/404 cross-user): the row is
     unchanged, or no new row was inserted
   - Import: number of rows inserted equals valid rows in the file;
     invalid rows inserted nothing
4. Write the checks in tests/db/<feature>.spec.ts (project db, no baseURL),
   not in the API specs: make the action through the API, assert only the status,
   then check the rows. Tag @db plus @smoke or @regression.
5. Run: npm run test:db
6. Handle failures as tests/CLAUDE.md says. A DB check that fails because of
   a known bug (see docs/bugs-found.md) gets test.fail() with the bug id.
7. Summarise: checks added, passed, failed, and any new data bugs found.