# n8n: failed Jenkins build → Jira, email, Excel tracker

When the nightly Jenkins build fails, `post { failure }` in the Jenkinsfile runs
`node reporting/failure-payload.mts` and POSTs the JSON to n8n. The workflow
`workflows/test-failure-to-jira.json` then:

1. **Few failures** (≤ `massFailureThreshold`, default 5): one Jira **Bug** per failed test.
   It first searches for an open Bug in project QA with labels `auto-test` and `at-<id>`
   (id = hash of file + title, stable across builds). If one is found it adds a comment
   "Failed again in build #N", otherwise it creates `[Auto] <title>` with the error,
   file:line, suite and build link (labels `auto-test`, `nightly`, `at-<id>`).
2. **Mass failure** (> threshold real failures): one Bug `[Auto] Build #N: <count> tests failed`
   listing every failure, label `auto-test-mass`. If one is already open it gets a comment
   instead. Usually an environment problem, so there's one issue rather than dozens.
3. **Unexpected passes** (a `test.fail()` test that passed, so the known bug may be fixed): one
   **Task** each, `[Auto] Known bug may be fixed: <title>`, asking you to verify the fix and
   remove `test.fail()`. Uses the same `at-<id>` de-dup.
4. One **email** digest: the mass issue or new bugs and repeats, then the unexpected passes.
   If the build failed with no failed tests (stack didn't start, no results.json), only a
   short email is sent.
5. One row per failed test appended to the **Excel tracker** `n8n/tracker/test-failures.xlsx`
   (Date, Job, Build, Suite, Test, Location, Kind, Jira key, New/Repeat).

No credentials are stored in this repo. They live in n8n's own encrypted store (the
`n8n-data` volume) and in Jenkins.

## Start

n8n is a service in `jenkins/docker-compose.yml`, on the same `jenkins` network as Jenkins:

```sh
docker compose -f jenkins/docker-compose.yml up -d n8n   # n8n only
docker compose -f jenkins/docker-compose.yml up -d       # with Jenkins
```

Open http://localhost:5678 (bound to 127.0.0.1 only) and create the owner account on first start.
Stop with `docker compose -f jenkins/docker-compose.yml stop n8n`. The workflows, credentials and
execution history are kept in the `n8n-data` volume. `down -v` wipes them.

## Import the workflow

1. **Workflows › Create › ⋯ › Import from File** → `n8n/workflows/test-failure-to-jira.json`.
2. Open the **Config** node and replace the placeholders:
   - `jiraSiteUrl`: `https://YOUR-SITE.atlassian.net`, your Jira Cloud site (no trailing slash)
   - `emailTo`, `emailFrom`: recipients (comma-separated) and the sender address
   - `jiraProject` (`QA`), `massFailureThreshold` (`5`), `trackerFile`: keep or change
3. Create the credentials below and select them in the nodes that show a warning.

## Credentials (created in the n8n UI)

**Jira Software Cloud API**: used by the 3 Jira nodes (`Jira: search open issue`, `Jira: add comment`,
`Jira: create issue`).
- Email: your Atlassian account email
- API token: create at https://id.atlassian.com/manage-profile/security/api-tokens
- Domain: the same `https://YOUR-SITE.atlassian.net` as in Config

The Jira nodes are HTTP Request nodes calling the Jira Cloud REST API v3 with this credential
(Authentication: Predefined credential type › Jira SW Cloud API). The built-in Jira node needs
numeric project and issue type ids picked from a list after the credential exists. With the REST API
the importable file can use project key `QA` and issue type names `Bug` and `Task` directly.

Jira project `QA` needs issue types **Bug** and **Task** and the Labels field on both create screens.

**SMTP**: used by `Email: digest` and `Email: no failed tests`.
- Gmail: host `smtp.gmail.com`, port `465`, SSL/TLS on, user = your Gmail address, password = an
  [app password](https://myaccount.google.com/apppasswords) (needs 2-Step Verification; your normal
  password won't work). `emailFrom` must be that Gmail address.
- Any other SMTP server works the same way.
- To use Gmail OAuth instead, replace the two Send Email nodes with Gmail nodes (Message › Send).

## Test it (no broken test needed)

1. In the editor, click **Execute workflow** (the Webhook listens for one test event), then:
   ```sh
   sh scripts/send-test-failure.sh few http://localhost:5678/webhook-test/test-failure
   ```
2. Check Jira (2 Bugs + 1 Task, titles start with `[Auto] [sample]`), the email and
   `n8n/tracker/test-failures.xlsx`.
3. Send the same sample again: the issues get comments instead of new issues ("Failed again").
4. `sh scripts/send-test-failure.sh mass …` sends 7 failures + 1 unexpected pass → one mass Bug
   (label `auto-test-mass`) + the Task.
5. Close the `[sample]` issues afterwards. Closed issues (status category Done) are not matched again.

## Activate

Toggle the workflow to **Active** (top right). The production URL is then
`/webhook/test-failure`, which is the default for `scripts/send-test-failure.sh`:

```sh
sh scripts/send-test-failure.sh few
```

## Jenkins credential

Jenkins reaches n8n by service name on the `jenkins` network:

1. Jenkins › **Manage Jenkins › Credentials › System › Global credentials › Add Credentials**
2. Kind **Secret text**, ID `n8n-webhook-url`, Secret `http://n8n:5678/webhook/test-failure`

The URL is kept in a credential, not in the Jenkinsfile, so it stays out of the repo and is masked in the log.
If the credential is missing or n8n is down, the build log shows a `WARNING: n8n ...` line and the build
stays FAILURE. The notification never hides the real failure.

## Excel tracker

`n8n/tracker/` (git-ignored) is bind-mounted at `/files/tracker`. `N8N_RESTRICT_FILE_ACCESS_TO`
limits n8n's file nodes to that folder. The workflow creates `test-failures.xlsx` on the first failure
and rewrites it with the new rows appended. Close the file in Excel before a run, or the write can fail.

## Payload

`node reporting/failure-payload.mts [results.json]` (Jenkins env: `JOB_NAME`, `BUILD_NUMBER`, `BUILD_URL`,
`SUITE`). Example: `samples/few-failures.json`.

- `counts.failed`: real failures only. `counts.unexpectedPasses`: test.fail() tests that passed.
  Expected failures and flaky tests are not failures.
- `failures`: up to 20, unexpected passes first. Each has `id`, `kind` (`failure` | `unexpected-pass`),
  `project`, `location` (file:line), `title` and `error` (first error line). `moreFailures`: how many weren't listed.
- `resultsFound: false`: there was no reports/results.json (the build failed before the tests ran).
