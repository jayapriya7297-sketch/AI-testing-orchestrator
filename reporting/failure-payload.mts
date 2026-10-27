/**
 * Prints the JSON payload for the n8n failure webhook (n8n/workflows/test-failure-to-jira.json):
 * node reporting/failure-payload.mts [results.json] > reports/failure-payload.json
 * Build info comes from the Jenkins env (JOB_NAME, BUILD_NUMBER, BUILD_URL) and SUITE.
 */
import { createHash } from 'node:crypto';
import { collect, countStatuses, firstErrorLine, readReport, statusOf, titleOf, type Entry } from './results.mts';

const MAX_LISTED = 20;

type Kind = 'failure' | 'unexpected-pass';

// Stable across builds: the Jira label at-<id> finds the open issue for the same test.
const shortId = (file: string, title: string): string =>
  createHash('sha256').update(`${file}\n${title}`).digest('hex').slice(0, 10);

// A test.fail() test that passed: the pinned app bug may be fixed.
const kindOf = ({ test }: Entry): Kind => (test.expectedStatus === 'failed' ? 'unexpected-pass' : 'failure');

const report = readReport(process.argv[2]);
const entries = report ? collect(report) : [];
const counts = countStatuses(entries);
const failed = entries.filter(({ test }) => statusOf(test) === 'Failed');
const unexpectedPasses = failed.filter((e) => kindOf(e) === 'unexpected-pass');
const realFailures = failed.filter((e) => kindOf(e) === 'failure');
// Unexpected passes first: each gets its own Jira task, so they must not be cut off.
const listed = [...unexpectedPasses, ...realFailures].slice(0, MAX_LISTED);

const payload = {
  job: process.env.JOB_NAME ?? 'local',
  build: Number(process.env.BUILD_NUMBER ?? 0),
  buildUrl: process.env.BUILD_URL ?? '',
  suite: process.env.SUITE ?? 'full',
  resultsFound: report !== undefined,
  counts: {
    passed: counts.Passed,
    failed: realFailures.length,
    unexpectedPasses: unexpectedPasses.length,
    expectedFailures: counts['Expected failure'],
    flaky: counts.Flaky,
    skipped: counts.Skipped,
  },
  failures: listed.map((entry) => {
    const title = titleOf(entry);
    return {
      id: shortId(entry.spec.file, title),
      kind: kindOf(entry),
      project: entry.test.projectName,
      location: `${entry.spec.file}:${entry.spec.line}`,
      title,
      error: firstErrorLine(entry.test),
    };
  }),
  moreFailures: failed.length - listed.length,
};

console.log(JSON.stringify(payload, null, 2));
