---
name: add-page-object
description: Create or update a Playwright page object for a screen of the Expense Manager UI. Use when a page needs UI tests or its page object is missing locators.
---

# Add page object

Rules: follow CLAUDE.md and tests/CLAUDE.md. This skill is only the procedure.

1. Read the React component(s) for the screen in app/web. List every
   interactive element with its data-testid. If one is missing, add it to
   the component and say which ones you added.
2. Create or update pages/<Name>Page.ts:
   - Locators as readonly properties (getByTestId / getByRole)
   - Row-level helpers for dynamic ids, e.g. row(id), editButton(id)
   - Action methods for user steps: goto, fill, submit, filter, delete
   - No assertions, except a simple isLoaded() check
3. Add one smoke test in tests/ui/<name>.spec.ts that opens the screen and
   checks it loaded. Run it.
4. Summarise: locators, methods, and any testids added to the app.