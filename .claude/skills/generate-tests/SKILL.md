---
name: generate-tests
description: Generate Gherkin scenarios and Playwright test drafts from requirements in requirements/expenses.xlsx into review/ for human approval. Use when asked to generate tests from requirements or user stories.
---

# Generate tests from requirements

Rules: follow CLAUDE.md and tests/CLAUDE.md. Output goes to review/ ONLY;
never write to tests/. A human approves and moves specs.

1. Read requirements/expenses.xlsx with exceljs (a short node one-off is fine).
   Scope: the IDs the user names (e.g. REQ-001 REQ-005), or all rows.
   Note each row's Status and Linked defects.
2. For each requirement, read what exists: the related pages/ objects,
   fixtures, and existing tests in tests/ for the same feature.
3. Show a plan and WAIT for approval: per requirement, the scenarios you
   will write (one or more per acceptance criterion, plus negative/edge
   cases), and any ambiguity or missing detail in the requirement
   (questions for the requirement owner).
4. Write review/features/<ID>.feature in Gherkin:
   Feature = the requirement title, a comment with the ID and user story,
   one Scenario per case, tagged @<ID> and @smoke or @regression.
5. Write review/specs/<ID>.spec.ts as a Playwright draft:
   - Reuse page objects and fixtures; never invent locators. If a needed
     data-testid or page object method is missing, list it instead of
     guessing.
   - Test titles start with the ID: "REQ-002 shows an error when amount is 0"
   - Tag @generated plus the layer tag
   - Status Planned: wrap with test.fixme('<ID> planned: not built yet')
   - Linked defect: mark the affected test with test.fail() and the bug id
6. If playwright.config.ts has no review project, add one (testDir
   ./review/specs) that is only included when RUN_REVIEW=1, so drafts
   never run in the normal suite.
7. Update review/traceability.xlsx: one row per scenario with
   ID | Scenario | Feature file | Spec file | Test title | Linked defects | Draft status.
8. Verify: npx tsc --noEmit, then RUN_REVIEW=1 npx playwright test --project=review.
   Don't fix app code. Mark each draft: passes / fails (known defect) /
   fixme (planned) / needs work (say why).
9. Summarise per requirement: scenarios written, verification result,
   overlaps with existing tests in tests/, open questions about the
   requirement, missing testids or page object methods.
   - Covered by an existing test: don't rewrite it. Add a traceability row
     with Draft status "covered by existing test", the existing spec file
     and its test title.
   - Behaviour the requirement doesn't state (even if a linked defect hints
     at it): don't test it. Ask instead, in review/questions/<ID>.md.