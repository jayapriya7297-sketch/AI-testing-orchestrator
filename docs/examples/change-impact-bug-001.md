# Change impact: d45b3fd^..d45b3fd -- app/

2026-10-30 · 1 changed file(s) · overall risk **Medium**

## Changed files

| File | Code map pattern(s) | Risk |
|---|---|---|
| app/api/src/routes/expenses.js | app/api/src/routes/expenses.js | Medium |

## Affected requirements

| ID | Title | Priority | Tests from |
|---|---|---|---|
| REQ-002 | Add expense | High | traceability (74) |
| REQ-003 | Edit expense | High | fallback specs |
| REQ-004 | Delete expense | Medium | fallback specs |
| REQ-005 | Filter by category | Medium | fallback specs |
| REQ-006 | Export to Excel | Medium | fallback specs |
| REQ-007 | Import from Excel | Medium | fallback specs |
| REQ-008 | Data privacy | High | traceability (18) |

## Tests to run

- Smoke: every test tagged @smoke
- tests/ui/expense-crud.spec.ts (traced, 21 test(s); the whole file runs as a fallback or changed spec)
- tests/api/expenses.spec.ts (traced, 44 test(s); the whole file runs as a fallback or changed spec)
- tests/db/expenses.spec.ts (traced, 23 test(s); the whole file runs as a fallback or changed spec)
- tests/ui/expense-list.spec.ts (traced, 4 test(s); the whole file runs as a fallback or changed spec)
- Fallback specs: tests/api/expenses-file.spec.ts, tests/api/expenses.spec.ts, tests/db/expenses-import.spec.ts, tests/db/expenses.spec.ts, tests/ui/expense-crud.spec.ts, tests/ui/expense-files.spec.ts, tests/ui/expense-list.spec.ts
- Review drafts (optional): review/specs/REQ-008.spec.ts

## Traceability gaps

Requirements with no rows in review/traceability.xlsx (backfill later):

- REQ-003 Edit expense: fallback: tests/api/expenses.spec.ts, tests/api/expenses-file.spec.ts, tests/db/expenses.spec.ts, tests/db/expenses-import.spec.ts, tests/ui/expense-crud.spec.ts, tests/ui/expense-list.spec.ts, tests/ui/expense-files.spec.ts
- REQ-004 Delete expense: fallback: tests/api/expenses.spec.ts, tests/api/expenses-file.spec.ts, tests/db/expenses.spec.ts, tests/db/expenses-import.spec.ts, tests/ui/expense-crud.spec.ts, tests/ui/expense-list.spec.ts, tests/ui/expense-files.spec.ts
- REQ-005 Filter by category: fallback: tests/api/expenses.spec.ts, tests/api/expenses-file.spec.ts, tests/db/expenses.spec.ts, tests/db/expenses-import.spec.ts, tests/ui/expense-crud.spec.ts, tests/ui/expense-list.spec.ts, tests/ui/expense-files.spec.ts
- REQ-006 Export to Excel: fallback: tests/api/expenses.spec.ts, tests/api/expenses-file.spec.ts, tests/db/expenses.spec.ts, tests/db/expenses-import.spec.ts, tests/ui/expense-crud.spec.ts, tests/ui/expense-list.spec.ts, tests/ui/expense-files.spec.ts
- REQ-007 Import from Excel: fallback: tests/api/expenses.spec.ts, tests/api/expenses-file.spec.ts, tests/db/expenses.spec.ts, tests/db/expenses-import.spec.ts, tests/ui/expense-crud.spec.ts, tests/ui/expense-list.spec.ts, tests/ui/expense-files.spec.ts

## Overall risk

**Medium**, set by app/api/src/routes/expenses.js.

## Commands

```sh
npx playwright test --grep '@smoke'
npx playwright test tests/api/expenses-file.spec.ts tests/api/expenses.spec.ts tests/db/expenses-import.spec.ts tests/db/expenses.spec.ts tests/ui/expense-crud.spec.ts tests/ui/expense-files.spec.ts tests/ui/expense-list.spec.ts
```

Optional, review drafts:

```sh
RUN_REVIEW=1 npx playwright test --project=review review/specs/REQ-008.spec.ts
```

