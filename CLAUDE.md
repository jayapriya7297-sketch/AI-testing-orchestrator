# AI Test Orchestrator

QA portfolio project: an Expense Manager app (app/) and a Playwright framework
(repo root) testing UI, API, DB and Excel files. Test generation from
requirements runs as the /generate-tests skill. A local Jenkins runs the nightly
full regression; on failure n8n files Jira issues, emails a digest and updates an
Excel tracker. Planned, not built yet: generator/ (API-key script for automated
generation).

## Stack
- App: React + Vite (served by nginx), Express API (CommonJS), PostgreSQL 16, Docker Compose
- Tests: Playwright + TypeScript; pg (DB), exceljs (Excel), ajv (schemas)
- AI: Claude Code skills incl. /generate-tests; Anthropic SDK script planned in generator/

## Setup and commands
- Node 26 (see .nvmrc); the fixture scripts need built-in TypeScript type stripping
- First time: cp .env.example .env (commit .env.example only, never .env)
- Start: docker compose up -d --build
- Reseed: docker compose down -v && docker compose up -d --build
  (seed SQL runs only on a fresh volume)
- Tests: npm test · npm run test:api · test:ui · test:db · test:db:all · test:smoke · report
- Excel report: npm run report:excel (after a test run)
- In Docker (as CI): npm run test:docker · test:docker:smoke. Fresh DB (down -v), full
  stack, suite + Excel report in the tests container, then down (also stops your local stack)
- AI drafts: RUN_REVIEW=1 npx playwright test --project=review
- Type-check: npx tsc --noEmit
- Ports: web 5173 · api 3000 · postgres 5432 (db expenses, user qa_user)

## App architecture (app/)
- db/init/: 01-schema.sql (users, expenses), 02-seed.sql (2 users, 20 expenses),
  mounted into Postgres docker-entrypoint-initdb.d
- api/ (Express, CommonJS): src/app.js wires routes; src/auth.js JWT + requireAuth;
  src/validate.js shared expense validator (CRUD and xlsx import);
  src/routes/expenses.js CRUD + /export + /import
  - Errors:
    - 400 {error, details:[{field, message}]} for validation (import adds row)
    - 400 {error} only for invalid or oversized JSON and file-level import errors
    - 401 {error} for a missing or invalid token and for wrong login credentials
    - 404 {error} (unknown /api routes: "Not found")
    - 500 {error: "Internal server error"} for unhandled errors
  - Categories: Food, Travel, Office, Utilities, Entertainment, Other
- web/ (React + Vite): nginx serves on 5173 and proxies /api to the api service.
  data-testid on every input, button, row and message: rows expense-row-{id},
  edit-button-{id}, delete-button-{id} then confirm-delete-{id};
  form fields form-title, form-amount, form-category, form-date

## Test harness (repo root)
- playwright.config.ts projects:
  - setup: tests/auth.setup.ts, UI login saved to .auth/user.json
  - api: tests/api, baseURL API_URL
  - db: tests/db, no baseURL (use apiContext or full URLs)
  - ui: tests/ui, baseURL WEB_URL, depends on setup, uses the saved storageState
  - review: review/specs, exists only when RUN_REVIEW=1, depends on setup
- Reports: playwright-report/, reports/junit.xml, reports/results.json
- Docker runner: tests service in docker-compose.yml (profile test, not started by a plain
  up), built from tests.Dockerfile (mcr.microsoft.com/playwright:v<version>-noble, Node 24;
  <version> comes from package-lock.json via the build arg PLAYWRIGHT_VERSION, and the build
  fails if it doesn't match the installed @playwright/test) with npm ci inside; tests.Dockerfile.dockerignore
  keeps out node_modules and .env. Uses WEB_URL http://web:5173, API_URL http://api:3000,
  DATABASE_URL db:5432; mounts reports/, playwright-report/, test-results/ to the host.
  scripts/test-docker.sh [playwright args] drives it, keeps the tests' exit code and chowns
  the mounted result folders to the host user (the container runs as root)
- Traces: retain-on-failure (trace.zip in test-results/ for every failed test)
- fixtures/env.ts loads .env: WEB_URL, API_URL, DATABASE_URL, ADMIN_EMAIL,
  ADMIN_PASSWORD, USER_EMAIL, USER_PASSWORD
- UI auth is stored in localStorage (expense_token, expense_user)
- TypeScript 7: tsconfig uses module: preserve + moduleResolution: bundler (node10 removed)

## Where things live

### Rules and docs
- Test rules: tests/CLAUDE.md. Read it before changing tests, pages/, fixtures/ or schemas/
- docs/bugs-found.md: app bugs found by tests (BUG-nnn), pinned with test.fail() where a
  test covers them
- docs/examples/: sample /summarize-failures output (failure-summary-test-bug.md,
  failure-summary-environment.md)

### Fixtures and helpers
- fixtures/api.ts: apiContext (admin) and userApiContext (USER_EMAIL), Bearer token attached
- fixtures/expenses.ts: createExpense + cleanup (auto-delete), validExpense, uniqueTitle,
  and the dbConnection fixture that closes the pg pool per worker
- fixtures/xlsx.ts: buildXlsx, uploadXlsx, readExport, expectExportMatchesList,
  fixtureWithUniqueTitles (unique title suffix for upload files that insert rows),
  fixtureColumn (one column of a fixtures/files workbook)
- fixtures/files/: upload files; malformed ones are uploaded as-is
- tests/db/db.helper.ts: read-only pg queries (getExpenseById, getExpensesByTitles,
  getUserByEmail) and expectExpenseRow. DB specs: tests/db/*.spec.ts (project db, tag @db)
- schemas/: ajv schemas (auth, expense, error); expectSchema() in schemas/validate.ts

### Scripts
- npm run fixtures:files: scripts/build-fixture-files.mts rebuilds the generated upload
  files (not malformed.xlsx or expenses.csv, which are kept by hand)
- npm run requirements:build: scripts/build-requirements.mts rebuilds requirements/expenses.xlsx

### Reporting
- npm run report:excel: reporting/build-report.mts turns reports/results.json into
  reports/results.xlsx (Summary, Results, Known bugs from test.fail() annotations)
- reports/failure-summary.md: written by /summarize-failures (reports/ is gitignored)
- reporting/results.mts: shared reader for results.json (statuses, counts);
  reporting/job-summary.mts prints the Markdown summary for CI;
  reporting/failure-payload.mts prints the n8n webhook JSON (counts, up to 20 failed tests
  with id = hash of file + title, kind failure | unexpected-pass; test.fail() is not a failure)

### CI
- .github/workflows/ci.yml: GitHub Actions (see CI)
- Jenkinsfile + jenkins/ (Dockerfile, Dockerfile.dockerignore, docker-compose.yml): local
  Jenkins (see Jenkins)

### n8n (n8n/, see n8n/README.md)
- workflows/test-failure-to-jira.json: importable, no credentials; placeholders in its Config node
- samples/few-failures.json, samples/mass-failure.json: sample webhook payloads
- tracker/: Excel tracker test-failures.xlsx (git-ignored, bind-mounted into n8n)
- scripts/send-test-failure.sh [few|mass] [url]: POSTs a sample payload to the webhook

### Requirements and AI drafts
- requirements/expenses.xlsx: REQ-001..010 (story, acceptance criteria, priority,
  status, linked defects)
- review/: AI-generated drafts only; a human moves approved specs to tests/
  - review/features/<ID>.feature (Gherkin), review/specs/<ID>.spec.ts,
    review/questions/<ID>.md (open questions), review/traceability.xlsx
    (one row per scenario, incl. ones covered in tests/)

### Skills (.claude/skills/)
- /write-api-tests: API tests for an endpoint or feature
- /write-db-tests: DB checks on API or UI actions
- /add-page-object: page object for a UI screen
- /write-ui-tests: UI tests for a screen or user journey
- /write-file-tests: Excel export/import tests (UI or API) with DB checks
- /generate-tests: requirements → Gherkin + Playwright drafts in review/
- /summarize-failures: classify failed tests (app / test / environment) into
  reports/failure-summary.md; never changes code

## CI (.github/workflows/ci.yml)
- GitHub Actions, one job on ubuntu-latest: pull_request and push to main run smoke;
  "Run workflow" (workflow_dispatch) takes suite smoke | full
- Runs npm run test:docker[:smoke] with .env copied from .env.example (demo values, no
  secrets); host Node from .nvmrc only reads package-lock.json and writes the summary
- Job summary from reporting/job-summary.mts; artifacts (14 days, uploaded even on failure):
  playwright-report-<suite>, reports-<suite>, traces-<suite> (test-results/)
- timeout 20 min; one run per branch, a newer push cancels the older one

## Jenkins (jenkins/, Jenkinsfile)
- Local, nightly full regression; separate from the app's docker-compose.yml
- Start: docker compose -f jenkins/docker-compose.yml up -d --build → http://localhost:8080
  - First-time admin password:
    docker compose -f jenkins/docker-compose.yml exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
  - Stop: docker compose -f jenkins/docker-compose.yml down (keeps jobs, config, image cache)
  - Reset: ... down -v (wipes Jenkins home and the dind image cache)
- Three services on the "jenkins" network: jenkins (custom image: Docker CLI + compose +
  buildx, Node from .nvmrc, plugins preinstalled), jenkins-docker (docker:dind, TLS) and
  n8n (n8nio/n8n pinned, 127.0.0.1:5678, volume n8n-data, ../n8n/tracker at /files/tracker,
  N8N_RESTRICT_FILE_ACCESS_TO=/files/tracker)
  - dind mounts the same jenkins-data volume at /var/jenkins_home, so the bind mounts in
    scripts/test-docker.sh resolve there
  - the test stack's ports (5173/3000/5432) exist only inside dind, no clash with the dev stack
- Job nightly-regression: Pipeline from SCM (this repo, branch main, script path Jenkinsfile)
  - cron('H 2 * * *'), Europe/Amsterdam; runs only while Docker Desktop and Jenkins are up
  - parameter SUITE full | smoke (cron builds: full); CI=true as in GitHub Actions
  - npm run test:docker[:smoke] (scripts/test-docker.sh unchanged), timeout 45 min,
    keeps 20 builds, no concurrent builds
  - Publishes JUnit (reports/junit.xml), "Playwright report" (HTML; the CSP is relaxed in
    jenkins/docker-compose.yml so it renders), artifacts reports/** and test-results/**
  - post failure: node reporting/failure-payload.mts, curl POST to the URL in the Secret text
    credential n8n-webhook-url (http://n8n:5678/webhook/test-failure); a missing credential or
    unreachable n8n only logs a WARNING, the build stays FAILURE; cleanWs last

## n8n workflow (n8n/workflows/test-failure-to-jira.json)
- Webhook POST /webhook/test-failure → Config (Jira site, emails, project QA,
  massFailureThreshold 5, tracker path) → one Jira action per work item, via HTTP Request
  nodes on the Jira Cloud REST API v3 (Jira SW Cloud credential; project key and issue type
  names, no ids):
  - failure (≤ threshold): open Bug with labels auto-test + at-<id>? comment "Failed again
    in build #N" : create "[Auto] <title>" (labels auto-test, nightly, at-<id>)
  - more than threshold real failures: one Bug "[Auto] Build #N: <count> tests failed",
    label auto-test-mass (comment if open)
  - unexpected-pass: Task "[Auto] Known bug may be fixed: <title>", same at-<id> de-dup
- Then one email digest (SMTP) and one tracker row per failed test; no failed tests in
  the payload → short email only
- Credentials (Jira, SMTP) are created in the n8n UI only, never in files

## Working style
- Plan before large changes; work in small, testable slices
- Run the relevant tests after every change and fix failures before moving on
- When adding a skill, folder or rule file, update "Where things live"