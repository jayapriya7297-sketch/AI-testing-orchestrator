# Jenkins: nightly full regression

A local Jenkins that runs the full Playwright suite every night in Docker, the same way as
`.github/workflows/ci.yml`. It is separate from the app's `docker-compose.yml`. When a build
fails, it notifies n8n, which files Jira issues (see [../n8n/README.md](../n8n/README.md)).

## What runs

`jenkins/docker-compose.yml` starts three services on the `jenkins` network:

| Service | Role |
|---|---|
| `jenkins` | Custom image (`jenkins/Dockerfile`): Docker CLI + compose + buildx, Node from `.nvmrc`, plugins preinstalled |
| `jenkins-docker` | `docker:dind` daemon. The test stack's ports (5173/3000/5432) exist only in here, so they never clash with your dev stack |
| `n8n` | Failure → Jira, email, Excel tracker. Bound to 127.0.0.1:5678 |

## Start and stop

```sh
docker compose -f jenkins/docker-compose.yml up -d --build   # → http://localhost:8080
docker compose -f jenkins/docker-compose.yml down            # stop, keeps jobs and image cache
docker compose -f jenkins/docker-compose.yml down -v         # reset: wipes Jenkins home and dind cache
```

First-time admin password:

```sh
docker compose -f jenkins/docker-compose.yml exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

In the setup wizard, choose **Select plugins to install → None**. The plugins the pipeline
needs are already in the image.

## Create the nightly job

1. **New Item** → name `nightly-regression` → **Pipeline**.
2. **Pipeline → Definition:** Pipeline script from SCM, **SCM:** Git, **Repository URL:** this
   repo, **Branch:** `*/main`, **Script Path:** `Jenkinsfile`.
   While the repo is private, add a GitHub credential (personal access token, read-only) under
   Credentials. Once it's public, none is needed.
3. Save, then **Build Now** once. The first build registers the `SUITE` parameter
   (`full` | `smoke`) and the cron trigger from the `Jenkinsfile`.

The `Jenkinsfile` defines the rest:
- runs `cron('H 2 * * *')` at about 02:00 Europe/Amsterdam (the JVM timezone is set in
  `jenkins/docker-compose.yml`), but only while Docker Desktop and Jenkins are up
- runs `npm run test:docker` (or `:smoke`), with a 45 min timeout, keeping 20 builds and never running two builds at once
- publishes JUnit (`reports/junit.xml`), the Playwright HTML report and the `reports/**` and `test-results/**` artifacts
- on failure, POSTs `node reporting/failure-payload.mts` to n8n

## n8n webhook (optional)

The failure step reads the webhook URL from a Jenkins **Secret text** credential with the id
`n8n-webhook-url`. [../n8n/README.md](../n8n/README.md#jenkins-credential) explains how to add
it. If it is missing or n8n is down, the build log shows a `WARNING` and the build stays FAILURE.
No credentials are stored in this repo.
