---
name: write-ui-tests
description: Write Playwright UI tests for an Expense Manager screen or user journey. Use when asked to add, extend or review UI tests.
---

# Write UI tests

Rules: follow CLAUDE.md and tests/CLAUDE.md. This skill is only the procedure.

1. Read the screen's components and its page object in pages/. If the page
   object is missing or incomplete, follow the add-page-object steps first.
2. List the test cases and WAIT for the user's approval before writing code:
   - Main user journey (happy path)
   - Form validation messages shown in the UI
   - Empty and error states (e.g. API returns 500: use page.route to mock)
   - Logged-out access redirects to login
   - What another user's data looks like in the UI, if relevant
3. Write tests in tests/ui/<feature>.spec.ts:
   - Arrange data through the API, act in the UI, assert in the UI
   - Add a DB check after create, edit or delete where it proves the result
4. Run: npx playwright test tests/ui/<feature>.spec.ts
   On failure, open the trace (npx playwright show-trace) before changing code.
5. Handle failures as tests/CLAUDE.md says.
6. Summarise: cases added, passed, failed, app bugs found, testids added.