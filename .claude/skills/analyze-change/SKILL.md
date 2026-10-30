---
name: analyze-change
description: Change-impact analysis for a git diff (a PR branch vs main, or a commit range) - matches changed files to the Code map in requirements/expenses.xlsx, finds the tests for the affected requirements in review/traceability.xlsx, and reports overall risk and a ready-to-run Playwright command. Use when asked which tests to run for a change, branch, PR or commit, or how risky a change is.
---

# Analyze change

Rules: follow CLAUDE.md. This skill only reads; never change code, tests, the Code map or
traceability, and don't run tests unless the user asks. The only file written is
reports/change-impact.md (by the script).

1. Pick the range from the request:
   - a branch or PR: `main...<branch>` (default `main...HEAD`)
   - one commit: `<sha>^..<sha>`; a range: `<from>..<to>`
   - only some paths: add `-- <pathspec>` (e.g. `-- app/`)
   - a PR number: `gh pr view <n> --json headRefName` first, then `main...origin/<branch>`
     (fetch it if missing)
2. Run `npm run analyze:change -- '<range>' [-- <pathspec>]` (quote the range: zsh may expand
   `^`). The script does the matching; don't redo it by hand:
   - each file is matched against every Code map row (glob, `*` stays within one directory)
   - any High row → full suite (`npm test`)
   - else traced test titles (tests/ only) + @smoke in one `--grep`, and fallback specs for
     requirements with no traceability rows plus changed specs as file paths
   - unmapped files are warned about and count as Medium
3. Read the report and reply with:
   - overall risk and the file that set it, in one line
   - affected requirements, the commands from the report (unchanged), and the draft
     command if there is one
   - warnings: unmapped files (suggest a Code map row: pattern, requirements, risk) and
     traceability gaps (suggest /generate-tests for those IDs to backfill)
   - your own judgement in at most 3 bullets, e.g. a schema or seed change needs a reseed
     (`docker compose down -v && docker compose up -d --build`) before running; a change
     the Code map can't see (the content of a Medium file touching ownership or auth logic)
     that justifies running more than the report says
4. If the user wants the tests run, start the stack (`docker compose up -d`) and run the
   commands; for failures use /summarize-failures.
