# Test runner for the Playwright suite (docker compose --profile test, see scripts/test-docker.sh).
# PLAYWRIGHT_VERSION is the @playwright/test version from package-lock.json, passed in by
# scripts/test-docker.sh. The default only makes a direct build fail with a readable image name.
ARG PLAYWRIGHT_VERSION=missing-run-npm-run-test-docker
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION

WORKDIR /work

COPY package.json package-lock.json ./
RUN npm ci

# The browsers in the image belong to one Playwright version; fail if npm ci installed another.
RUN installed=$(node -p "require('@playwright/test/package.json').version"); \
  if [ "$installed" != "$PLAYWRIGHT_VERSION" ]; then \
    echo "@playwright/test $installed (npm ci) does not match image playwright:v$PLAYWRIGHT_VERSION-noble" >&2; \
    exit 1; \
  fi

COPY . .

CMD ["npx", "playwright", "test"]
