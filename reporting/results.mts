/**
 * Reads the Playwright JSON reporter output (reports/results.json) into one entry per test
 * with a single status. Shared by build-report.mts (Excel) and job-summary.mts (CI summary).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { JSONReport, JSONReportSpec, JSONReportSuite, JSONReportTest } from '@playwright/test/reporter';

export const ROOT = path.join(import.meta.dirname, '..');
export const RESULTS_JSON = path.join(ROOT, 'reports/results.json');

export type Status = 'Passed' | 'Failed' | 'Expected failure' | 'Flaky' | 'Skipped';
export type Entry = { spec: JSONReportSpec; test: JSONReportTest; describePath: string[] };

export function readReport(file = RESULTS_JSON): JSONReport | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Every test in the report, with the describe blocks it sits in. */
export function collect(report: JSONReport): Entry[] {
  const out: Entry[] = [];
  const walk = (suite: JSONReportSuite, describePath: string[]): void => {
    for (const spec of suite.specs) {
      for (const test of spec.tests) out.push({ spec, test, describePath });
    }
    // The top-level suite is the file; nested suites are describe blocks.
    for (const child of suite.suites ?? []) walk(child, [...describePath, child.title]);
  };
  for (const suite of report.suites) walk(suite, []);
  return out;
}

export function statusOf(test: JSONReportTest): Status {
  if (test.status === 'skipped') return 'Skipped';
  if (test.status === 'flaky') return 'Flaky';
  if (test.status === 'unexpected') return 'Failed';
  return test.expectedStatus === 'failed' ? 'Expected failure' : 'Passed';
}

export function countStatuses(entries: Entry[]): Record<Status, number> {
  const counts: Record<Status, number> = { Passed: 0, Failed: 0, 'Expected failure': 0, Flaky: 0, Skipped: 0 };
  for (const { test } of entries) counts[statusOf(test)]++;
  return counts;
}

export const titleOf = ({ spec, describePath }: Entry): string => [...describePath, spec.title].join(' › ');

const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

export function firstErrorLine(test: JSONReportTest): string {
  const last = test.results.at(-1);
  const message = last?.errors[0]?.message ?? last?.error?.message;
  if (message) return stripAnsi(message).split('\n')[0].trim();
  // A test.fail() test that passes has no error of its own.
  if (test.status === 'unexpected' && test.expectedStatus === 'failed') return 'Expected to fail, but passed';
  return '';
}
