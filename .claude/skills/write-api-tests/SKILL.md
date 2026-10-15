---
name: write-api-tests
description: Write Playwright API tests for an Expense Manager endpoint or feature. Use when asked to add, extend or review API tests.
---

# Write API tests

Rules: follow CLAUDE.md and tests/CLAUDE.md. This skill is only the procedure.

1. Read the route and validation code in app/api for the endpoint(s) named.
   Note the status codes and error shapes the API actually returns.
2. List the test cases and WAIT for the user's approval before writing code:
   - Happy path per method (create, get, list, update, delete)
   - 401 without a token and with an invalid token
   - 400 for missing, wrong-type and out-of-range fields, and an invalid
     category; assert the {error, details:[{field, message}]} shape
   - Another user's data: get/update/delete returns 403 or 404
   - 404 for unknown ids
   - Export/import if in scope: xlsx content type, parseable file,
     import errors include row
3. If a second user is needed and missing, add USER_EMAIL / USER_PASSWORD
   to .env.example and fixtures/env.ts, plus a fixture for that user.
4. Write tests in tests/api/<feature>.spec.ts; add or update a schema in
   schemas/ if the response shape is new.
5. Run: npx playwright test tests/api/<feature>.spec.ts
6. Handle failures as tests/CLAUDE.md says (test bug / app bug / environment).
7. Summarise: cases added, passed, failed, app bugs found.