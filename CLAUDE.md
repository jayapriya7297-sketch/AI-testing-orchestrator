# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository is a fresh scaffold: it contains only a one-line `README.md` (`# AI-testing-orchestrator`) and a standard GitHub Node.js `.gitignore`. There is no source code, package manifest, build tooling, test framework, or lint configuration yet. The `.gitignore` suggests the project is intended to be a Node.js/JavaScript (or TypeScript) project.

## Commands

None defined yet. Once a `package.json` (or equivalent) is added, update this section with the build, lint, test, and single-test commands.

## Architecture

Not yet established. Update this section as the orchestrator's core structure takes shape.

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