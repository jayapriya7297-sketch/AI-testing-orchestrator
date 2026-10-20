# Failure summary

> Example output of /summarize-failures. Demo: the api container was stopped
> (`docker compose stop api`) before running one API test, then started again.

- Run: 2026-10-20 15:42 UTC (`npx playwright test tests/api/health.spec.ts`, 0.2 s)
- Failed: 1 · Flaky: 0 · Expected failures (test.fail(), skipped here): 0 · Possibly fixed bugs: 0

**Shared cause:** the API service is not running (`docker compose ps`: api `Exited (0)`,
db and web healthy). Any API test, and any UI test that calls the API, fails the same way
until the API is started again.

## 1. GET /api/health reports API and DB up

- **Test:** [api] tests/api/health.spec.ts:14 (fails at line 15, the request itself), tags @smoke @api
- **Error:**
  ```
  AggregateError: apiRequestContext.get: connect ECONNREFUSED ::1:3000
  connect ECONNREFUSED 127.0.0.1:3000
  - → GET http://localhost:3000/api/health
  ```
- **Likely cause:** nothing is listening on port 3000 (API_URL in .env). The api container
  is stopped (`Exited (0)`, so it was stopped cleanly and did not crash).
- **Classification: environment issue.** Evidence:
  - ECONNREFUSED on both IPv6 and IPv4 means the request never reached the server,
    so no status code or body was returned
  - The test failed after 22 ms at the first request, before any assertion ran
  - The test and the app are unchanged; this test passed in the full run at 15:41
- **Known bug:** none. This is an environment problem, not an app defect.
- **Suggested next step:** `docker compose start api` (or `docker compose up -d`), wait for
  the API to answer, then rerun. If it exits again, check `docker compose logs api`.
