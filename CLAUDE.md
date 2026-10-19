# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

The system under test (Expense Manager app) lives in `app/`. The Playwright harness is at the repo root; generator/ and reporting/ are not built yet.

# AI Test Orchestrator

QA portfolio project: an Expense Manager app (app/) and a Playwright framework
(repo root) testing UI, API, DB and Excel files. Planned, not built yet:
generator/ (LLM test generation), reporting/, CI (GitHub Actions, Jenkins, n8n).

## Stack
- App: React + Vite (served by nginx), Express API (CommonJS), PostgreSQL 16, Docker Compose
- Tests: Playwright + TypeScript; pg (DB), exceljs (Excel), ajv (schemas)
- AI (planned): Anthropic SDK in generator/ and reporting/

## Setup and commands
- First time: cp .env.example .env (commit .env.example only, never .env)
- Start: docker compose up -d --build
- Reseed: docker compose down -v && docker compose up -d --build
  (seed SQL runs only on a fresh volume)
- Tests: npm test · npm run test:api · test:ui · test:db · test:db:all · test:smoke · report
- Type-check: npx tsc --noEmit
- Ports: web 5173 · api 3000 · postgres 5432 (db expenses, user qa_user)

## App architecture (app/)
- db/init/: 01-schema.sql (users, expenses), 02-seed.sql (2 users, 20 expenses),
  mounted into Postgres docker-entrypoint-initdb.d
- api/ (Express, CommonJS): src/app.js wires routes; src/auth.js JWT + requireAuth;
  src/validate.js shared expense validator (CRUD and xlsx import);
  src/routes/expenses.js CRUD + /export + /import
  - Errors: 400 {error, details:[{field, message}]} (import adds row),
    401 {error} for missing or invalid token, 404 {error}
  - Categories: Food, Travel, Office, Utilities, Entertainment, Other
- web/ (React + Vite): nginx serves on 5173 and proxies /api to the api service.
  data-testid on every input, button, row and message: rows expense-row-{id},
  edit-button-{id}, delete-button-{id} then confirm-delete-{id}

## Test harness (repo root)
- playwright.config.ts projects: setup (tests/auth.setup.ts, UI login saved to
  .auth/user.json), api (tests/api, baseURL API_URL), db (tests/db, no baseURL: use apiContext or full URLs),
  ui (tests/ui, baseURL WEB_URL,
  depends on setup, uses the saved storageState)
- Reports: playwright-report/, reports/junit.xml, reports/results.json
- fixtures/env.ts loads .env: all URLs and credentials (ADMIN_EMAIL, ADMIN_PASSWORD)
- fixtures/api.ts exports test with an apiContext fixture (admin Bearer token)
- UI auth is stored in localStorage (expense_token, expense_user)
- TypeScript 7: tsconfig uses module: preserve + moduleResolution: bundler (node10 removed)

## Where things live
- Test rules: tests/CLAUDE.md. Read it before changing tests, pages/, fixtures/ or schemas/
- fixtures/api.ts: apiContext (admin) and userApiContext (USER_EMAIL); fixtures/expenses.ts:
  createExpense + cleanup (auto-delete) and validExpense/uniqueTitle; fixtures/files/: upload files
- schemas/: ajv schemas (auth, expense, error) and expectSchema() in schemas/validate.ts
- docs/bugs-found.md: app bugs found by tests (BUG-nnn); pinned with test.fail() in the specs
- tests/db/db.helper.ts: read-only pg queries (getExpenseById, getExpensesByTitles,
  getUserByEmail) and expectExpenseRow; the pool is closed per worker by the
  dbConnection fixture in fixtures/expenses.ts. DB specs: tests/db/*.spec.ts (project db, tag @db)
- fixtures/xlsx.ts: buildXlsx and uploadXlsx for import tests
- Skills in .claude/skills/: /write-api-tests (API tests for an endpoint or feature),
  /write-db-tests (DB checks on API or UI actions)
- AI-generated drafts go to review/ only; a human moves approved specs to tests/
- /add-page-object: page object for a UI screen
- /write-ui-tests: UI tests for a screen or user journey
<!-- - Prompt log: docs/prompts.md -->

## Working style
- Plan before large changes; work in small, testable slices
- Run the relevant tests after every change and fix failures before moving on
- When adding a skill, folder or rule file, update "Where things live"