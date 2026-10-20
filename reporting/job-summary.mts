/**
 * Prints a short Markdown summary of reports/results.json for the CI job summary:
 * node reporting/job-summary.mts [suite] >> "$GITHUB_STEP_SUMMARY"
 */
import { collect, countStatuses, firstErrorLine, readReport, statusOf, titleOf } from './results.mts';

const MAX_LISTED = 20;

const suite = process.argv[2] ?? 'tests';
const lines: string[] = [`## Playwright: ${suite}`, ''];
const report = readReport();

if (!report) {
  lines.push('No results: the run failed before the tests ran (see the log of the test step).');
} else {
  const entries = collect(report);
  const counts = countStatuses(entries);
  lines.push(
    '| Passed | Failed | Expected failures | Flaky | Skipped | Total | Duration |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| ${counts.Passed} | ${counts.Failed} | ${counts['Expected failure']} | ${counts.Flaky} | ${counts.Skipped} | ` +
      `${entries.length} | ${(report.stats.duration / 1000).toFixed(1)} s |`,
  );
  if (counts['Expected failure']) lines.push('', 'Expected failures are known app bugs pinned with test.fail() (docs/bugs-found.md).');
  if (report.errors.length) lines.push('', `Run errors: ${report.errors.length} (see the log).`);

  const problems = entries.filter(({ test }) => ['Failed', 'Flaky'].includes(statusOf(test)));
  if (problems.length) {
    lines.push('', '### Failed and flaky tests', '');
    for (const entry of problems.slice(0, MAX_LISTED)) {
      const error = firstErrorLine(entry.test);
      lines.push(
        `- **${statusOf(entry.test)}** \`${entry.spec.file}:${entry.spec.line}\` [${entry.test.projectName}] ${titleOf(entry)}` +
          (error ? `: ${error}` : ''),
      );
    }
    if (problems.length > MAX_LISTED) lines.push(`- … and ${problems.length - MAX_LISTED} more (see the reports artifact)`);
  }
}

console.log(lines.join('\n'));
