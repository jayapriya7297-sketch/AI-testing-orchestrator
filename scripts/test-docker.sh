#!/bin/sh
# Runs the suite in the tests container against a fresh stack (npm run test:docker[:smoke]).
# Usage: scripts/test-docker.sh [--grep @smoke]; always takes the stack down, keeps the tests' exit code.
set -u

docker compose --profile test down -v
docker compose up -d --build --wait || { docker compose --profile test down; exit 1; }

docker compose --profile test run --rm --build tests \
  sh -c 'npx playwright test "$@"; status=$?; node reporting/build-report.mts; exit $status' sh "$@"
status=$?

docker compose --profile test down
exit $status
