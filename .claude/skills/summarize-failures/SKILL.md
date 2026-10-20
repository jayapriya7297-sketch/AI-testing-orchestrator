---
name: summarize-failures
description: Read the last Playwright run (reports/results.json), classify each failed test as app bug, test bug or environment issue with evidence, and write reports/failure-summary.md. Use when asked to summarize, triage or classify test failures.
---

# Summarize failures

Rules: follow CLAUDE.md and tests/CLAUDE.md. This skill is only the procedure.
Never change code, tests, config or docs; the only file written is reports/failure-summary.md.

1. Read reports/results.json (run the tests first if it is missing). Select tests whose
   status is "unexpected", plus "flaky" ones (mark them flaky). Skip expected failures
   (test.fail() that failed). A test.fail() test that passed is "unexpected" with no error:
   list it as a possibly fixed bug, not a failure. No failures: write a one-line summary and stop.
2. For each failure gather the evidence:
   - the error message and stack (strip ANSI codes), from the last retry
   - attachments: error-context.md (call log, page snapshot), screenshot, and trace.zip
     when present (unzip into the scratchpad and read the actions and network entries)
   - the spec at the failing line, plus the page object, fixture and helper it uses
   - if the app looks wrong, the matching route or component in app/ (read only)
3. Classify each failure, citing the evidence:
   - Environment issue: ECONNREFUSED, socket hang up, 502/503 from nginx, DB connection
     errors, missing .env values, browser not installed, setup project failed. Check
     `docker compose ps` when services are involved.
   - Test bug: wrong expected value, stale locator or missing testid, depends on another
     test's data or order, timing (no auto-waiting), test contradicts the requirement.
   - App bug: the app contradicts requirements/expenses.xlsx, CLAUDE.md (error format,
     categories) or the test rules, and the test's expectation is right.
   When unsure, give the most likely class and say what would confirm it.
4. Check docs/bugs-found.md for a matching BUG-nnn (same endpoint or screen and symptom).
   Cite it, or say "none (new)" for an app bug that is not listed.
5. Write reports/failure-summary.md:
   - header: run date, totals (failed, flaky, expected failures, possibly fixed)
   - one section per failure: Test (project, file:line, title), Error (first lines),
     Likely cause, Classification with evidence, Known bug, Suggested next step
   - when several failures share a cause (e.g. API down), say so once at the top
6. Report to the user: the path, one line per failure (class and next step), and anything
   that needs their decision (new app bugs to log, possibly fixed bugs).
