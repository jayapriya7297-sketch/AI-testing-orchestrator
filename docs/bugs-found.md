# Bugs found

App bugs found by the API test suite. App code is not changed by the tests; each bug
is pinned with test.fail() until it is fixed (Playwright then reports the test as
unexpectedly passing, and the test.fail() line should be removed).

## BUG-001: Any user can read, edit and delete other users' expenses
- Endpoint: GET, PUT, DELETE /api/expenses/:id; GET /api/expenses; GET /api/expenses/export
- Steps: user@test.com updates an expense created by admin
- Expected: 404 or 403 · Actual: 200, expense changed
  (GET also returns 200, DELETE returns 204 and removes it; the list and the
  export include every user's expenses)
- Cause: routes/expenses.js looks up, updates and deletes by id only and never
  compares created_by with req.user; ids are sequential, so every record is reachable
- Severity: High (BOLA, OWASP API #1)
- Test: tests/api/expenses.spec.ts ("another user's expense"), 5 tests marked test.fail();
  tests/db/expenses.spec.ts ("by another user"), 2 tests marked test.fail(): the row's
  values change and the row is removed; tests/ui/expense-list.spec.ts ("as a regular user"),
  1 test marked test.fail(): the user's list shows admin's expenses

## BUG-002: Non-string title returns "Title is required" instead of "Title must be a string"
- Endpoint: POST /api/expenses (also PUT /api/expenses/:id and xlsx import, which share the validator)
- Steps: admin POSTs a valid expense with "title": 12345
- Expected: 400, details [{field: "title", message: "Title must be a string"}] ·
  Actual: 400, message "Title is required"
- Cause: validate.js coerces a non-string title to '' before the type check, so the
  "must be a string" branch is unreachable
- Severity: Low (request is still rejected; the error message misleads API clients)
- Test: tests/api/expenses.spec.ts ("Title must be a string" when title is a number), marked test.fail()

## BUG-003: Id beyond the integer range returns 500 instead of 404
- Endpoint: GET, PUT, DELETE /api/expenses/:id
- Steps: admin calls GET /api/expenses/99999999999
- Expected: 404 (or 400 from id validation) · Actual: 500 {"error": "Internal server error"}
- Cause: parseId accepts any string of digits; Postgres rejects the value as out of
  range for the integer id column and the error falls through to the 500 handler
- Severity: Medium (user-triggerable server errors, noisy error logs)
- Test: tests/api/expenses.spec.ts ("unknown ids", beyond the integer range), 3 tests marked test.fail()
