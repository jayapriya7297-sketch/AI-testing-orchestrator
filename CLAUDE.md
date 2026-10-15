# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

The system under test (Expense Manager app) lives in `app/`. The Playwright harness is at the repo root; generator/ and reporting/ are not built yet.

## Test harness (repo root)

- npm scripts: `test`, `test:api`, `test:ui`, `test:smoke` (`--grep @smoke`), `report`.
- `playwright.config.ts` projects: `setup` (`tests/auth.setup.ts`, logs in via UI → `.auth/user.json`), `api` (`tests/api`, baseURL `API_URL`), `ui` (`tests/ui`, baseURL `WEB_URL`, depends on setup, uses the saved storageState). Reports: `playwright-report/`, `reports/junit.xml`, `reports/results.json`.
- `fixtures/env.ts` loads `.env`; all URLs and credentials (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) come from there. `fixtures/api.ts` exports `test` with an `apiContext` fixture (admin Bearer token attached).
- UI auth lives in localStorage (`expense_token`, `expense_user`). For a logged-out test, use `test.use({ storageState: { cookies: [], origins: [] } })`.
- TypeScript 7: `tsconfig.json` uses `module: preserve` + `moduleResolution: bundler` (`node10` was removed). Type-check: `npx tsc --noEmit`.

## Architecture (app/)

- `app/db/init/` — `01-schema.sql` (users, expenses) and `02-seed.sql` (2 users, 20 expenses). Mounted into Postgres `docker-entrypoint-initdb.d`, so they run **only on a fresh volume**. Reseed: `docker compose down -v && docker compose up -d --build`.
- `app/api/` — Express (CommonJS). `src/app.js` wires routes; `src/auth.js` JWT sign + `requireAuth`; `src/validate.js` shared expense validator (used by CRUD and xlsx import); `src/routes/expenses.js` CRUD + `/export` + `/import`.
  - Errors: 400 `{error, details:[{field, message}]}` (import adds `row`), 401 `{error}` for missing/invalid token, 404 `{error}`.
  - Categories: Food, Travel, Office, Utilities, Entertainment, Other.
- `app/web/` — React + Vite, built and served by nginx on 5173; nginx proxies `/api` to the api service. Every input, button, table row and message has a `data-testid` (rows: `expense-row-{id}`, row actions: `edit-button-{id}`, `delete-button-{id}` → `confirm-delete-{id}`).
- Setup: `cp .env.example .env` before the first `docker compose up`.

# AI Test Orchestrator

## Stack
- App: React (Vite) frontend, Node/Express API, PostgreSQL 16, all in Docker Compose
- DB: Postgres 16, database expenses, user qa_user, password qa_pass, port 5432
  (values in .env; commit .env.example only)
- Tests: Playwright + TypeScript for UI and API; pg for DB checks; exceljs for Excel files
- AI: Anthropic SDK (@anthropic-ai/sdk) in generator/ and reporting/
- CI: GitHub Actions (PR), Jenkins (nightly), n8n (notifications, Jira)

## Commands
- Start stack: docker compose up -d --build
- Run all tests: npx playwright test
- UI only: npx playwright test --project=ui
- API only: npx playwright test --project=api
- Generate tests: npm run generate -- requirements/expenses.xlsx

## Ports
- Web UI: 5173 · API: 3000 · Postgres: 5432

## Test conventions
- Page Object Model in pages/; one class per page
- Locators: getByRole or getByTestId only; no XPath, no CSS chains
- Never use waitForTimeout; rely on auto-waiting and expect()
- Each test creates its own data through the API and cleans it up
- Tags in titles: @smoke, @regression, @api, @ui, @db, @file
- Secrets only from environment variables; never commit .env

## AI-generated tests
- Generator writes to review/ only; a human moves approved specs to tests/

## Working style
- Plan before large changes; work in small, testable slices
- Run the relevant tests after every change and fix failures before moving on