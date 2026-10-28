# Bugs found

App bugs found by the API test suite. App code is not changed by the tests; each bug
is pinned with test.fail() until it is fixed (Playwright then reports the test as
unexpectedly passing, and the test.fail() line should be removed).

## BUG-001: Any user can read, edit and delete other users' expenses
- Status: Fixed (2026-10-28)
- Endpoint: GET, PUT, DELETE /api/expenses/:id; GET /api/expenses; GET /api/expenses/export
- Steps: user@test.com updates an expense created by admin
- Expected: 404 or 403 · Actual: 200, expense changed
  (GET also returns 200, DELETE returns 204 and removes it; the list and the
  export include every user's expenses)
- Cause: routes/expenses.js looks up, updates and deletes by id only and never
  compares created_by with req.user; ids are sequential, so every record is reachable
- Severity: High (BOLA, OWASP API #1)
- Fix: routes/expenses.js checks ownership by role (REQ-008, Q1 answered 2026-10-28).
  A regular user reads and writes only their own expenses; another user's returns 404.
  The admin reads every expense (list, export, GET by id) but edits and deletes only
  their own; another user's returns 403
- Test: the 8 test.fail() markers are removed and the tests now pass:
  tests/api/expenses.spec.ts ("a regular user and another user's expense", 5 tests),
  tests/db/expenses.spec.ts ("by another regular user", 2 tests),
  tests/ui/expense-list.spec.ts ("as a regular user", 1 test). Admin rules covered by
  tests/api/expenses.spec.ts ("the admin and another user's expense") and
  tests/db/expenses.spec.ts ("by the admin")

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

## BUG-004: Expense form has no client-side validation
- Screen: add/edit expense form (app/web/src/components/ExpenseForm.jsx)
- Steps: open "Add expense" and click "Add expense" with every field empty
- Expected: required/invalid fields flagged before submitting · Actual: the form
  has noValidate and no checks of its own, so every message ("Title is required",
  "Amount must be greater than 0", ...) appears only after a round trip to the API
- Cause: validation lives only in the API (src/validate.js); the form sends whatever is typed
- Severity: Low (UX only: the API still rejects bad input and the messages are shown)
- Test: none pinned; tests/ui/expense-crud.spec.ts ("form validation") checks the
  API-driven messages the form shows today

## BUG-005: The admin sees Edit and Delete on other users' expenses
- Screen: expense list (app/web/src/pages/ExpensesPage.jsx)
- Steps: log in as admin@test.com and click Edit or Delete on an expense created by
  user@test.com, then save or confirm
- Expected: no Edit or Delete button on expenses the admin doesn't own (REQ-008 Q3) ·
  Actual: both buttons are shown on every row; saving or confirming fails with the
  API's 403 "You can only edit or delete your own expenses"
- Cause: the row renders edit-button-{id} and delete-button-{id} for every expense and
  never compares created_by with the logged-in user; since BUG-001 was fixed, the
  admin's list includes other users' expenses
- Severity: Low (UX only: the API rejects the write and the row stays unchanged)
- Test: none yet; no code change planned for now
