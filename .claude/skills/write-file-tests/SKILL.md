---
name: write-file-tests
description: Write Playwright tests for Expense Manager Excel export and import (UI or API), with DB checks. Use when asked to add, extend or review file upload/download tests.
---

# Write file tests

Rules: follow CLAUDE.md and tests/CLAUDE.md. This skill is only the procedure.

1. Read the export/import routes in app/api, the UI handlers and the page object.
   Review the existing file specs (tests/api, tests/ui) and don't duplicate them.
   Note filters, error messages, and whether import is all-or-nothing.
2. List the test cases and WAIT for the user's approval before writing code:
   - Export: headers, every row matches GET /api/expenses, filtered export
   - Valid import: success message, rows listed, DB has exactly those rows
   - Mixed import: failing row numbers shown; DB shows whether valid rows saved
   - Each malformed file: clear error, 400 (not 500), no new rows
3. Add upload files to scripts/build-fixture-files.mts, run npm run fixtures:files.
   Files that insert rows: upload via fixtureWithUniqueTitles (fixtures/xlsx.ts)
   and assert "exactly these rows". Files that must insert nothing: upload as-is;
   assert no rows for their titles, or the 400 when they have none.
4. Write tests in tests/<layer>/<feature>.spec.ts. Compare exports with
   readExport + expectExportMatchesList; cleanup.trackTitles every imported title.
5. Run the spec, then npx playwright test <spec> --repeat-each=3 for flakiness.
6. Handle failures as tests/CLAUDE.md says (test bug / app bug / environment).
7. Summarise: cases added, passed, failed, app behaviour found, app bugs found.
