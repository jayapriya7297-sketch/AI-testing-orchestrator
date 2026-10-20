#!/bin/sh
# Runs the suite in the tests container against a fresh stack (npm run test:docker[:smoke]).
# Usage: scripts/test-docker.sh [--grep @smoke]; always takes the stack down, keeps the tests' exit code.
set -u
cd "$(dirname "$0")/.."

fail() {
  echo "test-docker: $*" >&2
  exit 1
}

# The Playwright image must match the installed @playwright/test (same browsers).
PLAYWRIGHT_VERSION=$(node -p 'require("./package-lock.json").packages["node_modules/@playwright/test"]?.version ?? ""') ||
  fail "could not read package-lock.json"
[ -n "$PLAYWRIGHT_VERSION" ] ||
  fail "@playwright/test is not in package-lock.json; run npm install first"
IMAGE="mcr.microsoft.com/playwright:v$PLAYWRIGHT_VERSION-noble"
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker manifest inspect "$IMAGE" >/dev/null 2>&1 ||
  fail "no image $IMAGE for @playwright/test $PLAYWRIGHT_VERSION (package-lock.json).
  Pin @playwright/test to a version with a published image (https://mcr.microsoft.com/en-us/artifact/mar/playwright/tags), or check your network."
export PLAYWRIGHT_VERSION
echo "test-docker: using $IMAGE"

docker compose --profile test down -v
docker compose up -d --build --wait || { docker compose --profile test down; exit 1; }

docker compose --profile test run --rm --build tests \
  sh -c 'npx playwright test "$@"; status=$?; node reporting/build-report.mts; exit $status' sh "$@"
status=$?

docker compose --profile test down
exit $status
