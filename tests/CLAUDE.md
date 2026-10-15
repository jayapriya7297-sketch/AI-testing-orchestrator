# Test rules

## Always
- Each test creates its own data via the API with unique values (e.g. a timestamp)
  and cleans it up; never rely on test order or another test's data
- Config only from fixtures/env.ts; no hard-coded URLs, credentials or secrets
- No waitForTimeout or sleeps; use expect() and auto-waiting
- Titles state the expected result ("returns 400 when amount is negative");
  group with test.describe

## API
- Use apiContext from fixtures/api.ts; check status AND body; validate bodies
  with schemas/ (ajv)
- Cover 401, 400, 403/404 (another user's data) and 404, not only happy paths

## UI
- Locators: getByTestId or getByRole only. Missing testid: add it to the
  component and report it
- Page objects hold locators and actions; assertions stay in specs
- Set up data via the API in beforeEach
- Logged-out tests: test.use({ storageState: { cookies: [], origins: [] } })

## DB and files
- DB checks are read-only via tests/db/db.helper.ts; always close connections
- Downloads: page.waitForEvent('download'), parse with exceljs, compare with the API
- Uploads live in fixtures/; include one malformed-file case

## Tags
- Layer tag on every test: @api, @ui, @db or @file
- @smoke: one fast happy path per critical feature (< 5 s each, suite < 2 min)
- @regression: negative, edge and permission cases

## Failures
- Classify each failure: test bug, app bug or environment issue
- Test bug: fix it. App bug: don't change app code without asking; mark the
  test with test.fail() plus a comment, and report it
- Never delete or skip a failing test to make the suite green