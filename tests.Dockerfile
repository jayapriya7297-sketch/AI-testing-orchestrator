# Test runner for the Playwright suite (docker compose --profile test, see scripts/test-docker.sh).
# Keep the tag equal to the @playwright/test version in package-lock.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /work

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npx", "playwright", "test"]
