# Failure summary

> Example output of /summarize-failures. Demo: one assertion in a scratch copy of
> tests/api/auth.spec.ts was changed from 200 to 201 on purpose; the scratch file was then deleted.

- Run: 2026-10-20 15:42 UTC (`npx playwright test tests/api/zz-scratch-broken.spec.ts`, 0.6 s)
- Failed: 1 · Flaky: 0 · Expected failures (test.fail(), skipped here): 0 · Possibly fixed bugs: 0
- Passed: 12

## 1. POST /api/auth/login › valid credentials › returns 200 with a token and the admin user

- **Test:** [api] tests/api/zz-scratch-broken.spec.ts:12 (fails at line 17), tags @api @smoke
- **Error:**
  ```
  Error: expect(received).toBe(expected) // Object.is equality
  Expected: 201
  Received: 200
  ```
- **Likely cause:** the assertion expects 201, but a successful login returns 200. The test's
  own title says "returns 200", and the same test in tests/api/auth.spec.ts:17 expects 200
  and passes. The scratch copy differs from it only on that line.
- **Classification: test bug.** Evidence:
  - The trace (trace.zip, network entry) shows `POST /api/auth/login` answered `200 OK`
  - app/api/src/routes/auth.js:32 ends a valid login with `res.json(...)`, which sends 200.
    A login creates no resource, so 200 is correct and 201 would be wrong.
  - Every other assertion in the test was never reached, and the other 12 tests in the file
    passed, so the API and environment are healthy.
- **Known bug:** none. This is not an app bug, and docs/bugs-found.md has no login entry.
- **Suggested next step:** change line 17 back to `expect(res.status()).toBe(200)`, or delete
  the scratch file, because tests/api/auth.spec.ts already covers this case.
