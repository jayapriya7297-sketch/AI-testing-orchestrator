/**
 * Builds reports/results.xlsx (npm run report:excel) from the Playwright JSON reporter
 * output in reports/results.json: a Summary sheet, one Results row per test and a
 * Known bugs sheet for the tests pinned with test.fail().
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ExcelJS from 'exceljs';
import type { JSONReport, JSONReportSpec, JSONReportSuite, JSONReportTest } from '@playwright/test/reporter';

const ROOT = path.join(import.meta.dirname, '..');
const IN = path.join(ROOT, 'reports/results.json');
const OUT = path.join(ROOT, 'reports/results.xlsx');

type Status = 'Passed' | 'Failed' | 'Expected failure' | 'Flaky' | 'Skipped';

/** Cell fill (ARGB) per status. */
const STATUS_FILL: Record<Status, string> = {
  Passed: 'FFC6EFCE',
  Failed: 'FFFFC7CE',
  'Expected failure': 'FFFFEB9C',
  Flaky: 'FFF8CBAD',
  Skipped: 'FFD9D9D9',
};

type Entry = { spec: JSONReportSpec; test: JSONReportTest; describePath: string[] };

/** Every test in the report, with the describe blocks it sits in. */
function collect(suite: JSONReportSuite, describePath: string[], out: Entry[]): void {
  for (const spec of suite.specs) {
    for (const test of spec.tests) out.push({ spec, test, describePath });
  }
  // The top-level suite is the file; nested suites are describe blocks.
  for (const child of suite.suites ?? []) collect(child, [...describePath, child.title], out);
}

function statusOf(test: JSONReportTest): Status {
  if (test.status === 'skipped') return 'Skipped';
  if (test.status === 'flaky') return 'Flaky';
  if (test.status === 'unexpected') return 'Failed';
  return test.expectedStatus === 'failed' ? 'Expected failure' : 'Passed';
}

const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

function firstErrorLine(test: JSONReportTest): string {
  const last = test.results.at(-1);
  const message = last?.errors[0]?.message ?? last?.error?.message;
  if (message) return stripAnsi(message).split('\n')[0].trim();
  // A test.fail() test that passes has no error of its own.
  if (test.status === 'unexpected' && test.expectedStatus === 'failed') return 'Expected to fail, but passed';
  return '';
}

function failAnnotation(test: JSONReportTest) {
  const all = [...test.annotations, ...(test.results.at(-1)?.annotations ?? [])];
  return all.find((a) => a.type === 'fail');
}

/** BUG-nnn from the annotation, else from the test's source up to the test.fail() line. */
function bugId(spec: JSONReportSpec, description: string | undefined, location?: { file: string; line: number }): string {
  const fromDescription = description?.match(/BUG-\d{3}/);
  if (fromDescription) return fromDescription[0];
  if (location && fs.existsSync(location.file)) {
    const lines = fs.readFileSync(location.file, 'utf8').split('\n');
    const source = lines.slice(Math.max(0, spec.line - 1), location.line).join('\n');
    const fromSource = source.match(/BUG-\d{3}/);
    if (fromSource) return fromSource[0];
  }
  return '(no id)';
}

function stillFails(status: Status): string {
  if (status === 'Expected failure') return 'Yes';
  if (status === 'Failed') return 'No – passed: bug may be fixed, remove test.fail()';
  return status;
}

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: Partial<ExcelJS.Column>[]): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  return sheet;
}

function finish(sheet: ExcelJS.Worksheet, statusKey?: string): void {
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  if (!statusKey) return;
  const col = sheet.getColumn(statusKey);
  col.eachCell((cell, rowNumber) => {
    const argb = STATUS_FILL[cell.value as Status];
    if (rowNumber > 1 && argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  });
}

async function main(): Promise<void> {
  if (!fs.existsSync(IN)) {
    console.error(`No ${path.relative(ROOT, IN)}: run the tests first (npx playwright test).`);
    process.exit(1);
  }
  const report: JSONReport = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const entries: Entry[] = [];
  for (const suite of report.suites) collect(suite, [], entries);

  const counts: Record<Status, number> = { Passed: 0, Failed: 0, 'Expected failure': 0, Flaky: 0, Skipped: 0 };
  for (const { test } of entries) counts[statusOf(test)]++;

  const workbook = new ExcelJS.Workbook();

  const summary = addSheet(workbook, 'Summary', [
    { header: 'Metric', key: 'metric', width: 22 },
    { header: 'Value', key: 'value', width: 22 },
  ]);
  const runDate = new Date(report.stats.startTime);
  const rows: [string, ExcelJS.CellValue][] = [
    ['Run date', runDate], // row 2
    ['Total', entries.length], // row 3
    ['Passed', counts.Passed], // row 4
    ['Failed', counts.Failed], // row 5
    ['Expected failures', counts['Expected failure']], // row 6
    ['Skipped', counts.Skipped], // row 7
    ['Flaky', counts.Flaky], // row 8
    ['Duration (s)', Math.round(report.stats.duration / 100) / 10], // row 9
  ];
  for (const [metric, value] of rows) summary.addRow({ metric, value });
  const runnable = entries.length - counts.Skipped;
  const rate = (n: number): number => (runnable ? n / runnable : 0);
  summary.addRow({
    metric: 'Suite pass rate',
    value: {
      formula: 'IF(B3-B7=0,0,(B4+B6+B8)/(B3-B7))',
      result: rate(counts.Passed + counts['Expected failure'] + counts.Flaky),
    },
  });
  summary.addRow({
    metric: 'Product pass rate',
    value: { formula: 'IF(B3-B7=0,0,B4/(B3-B7))', result: rate(counts.Passed) },
  });
  summary.getCell('B2').numFmt = 'yyyy-mm-dd hh:mm';
  summary.getCell('B10').numFmt = '0.0%';
  summary.getCell('B11').numFmt = '0.0%';
  summary.addRow({});
  summary.addRow({ metric: "Passed + Expected failures = Playwright's \"passed\" count" });
  summary.addRow({ metric: 'Suite pass rate counts expected failures and flaky tests as passing; Product pass rate counts only clean passes' });
  for (const [row, status] of [[4, 'Passed'], [5, 'Failed'], [6, 'Expected failure'], [7, 'Skipped'], [8, 'Flaky']] as const) {
    summary.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[status] } };
  }
  summary.autoFilter = 'A1:B11';

  const results = addSheet(workbook, 'Results', [
    { header: 'Project', key: 'project', width: 9 },
    { header: 'File', key: 'file', width: 34 },
    { header: 'Title', key: 'title', width: 80 },
    { header: 'Tags', key: 'tags', width: 22 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Duration (s)', key: 'duration', width: 12 },
    { header: 'Retries', key: 'retries', width: 9 },
    { header: 'Error', key: 'error', width: 80 },
  ]);
  for (const { spec, test, describePath } of entries) {
    results.addRow({
      project: test.projectName,
      file: spec.file,
      title: [...describePath, spec.title].join(' › '),
      // The JSON reporter stores tags without the leading @.
      tags: spec.tags.map((t) => `@${t}`).join(' '),
      status: statusOf(test),
      duration: (test.results.at(-1)?.duration ?? 0) / 1000,
      retries: Math.max(0, test.results.length - 1),
      error: firstErrorLine(test),
    });
  }
  results.getColumn('duration').numFmt = '0.00';
  finish(results, 'status');

  const bugs = addSheet(workbook, 'Known bugs', [
    { header: 'Project', key: 'project', width: 9 },
    { header: 'File:line', key: 'where', width: 34 },
    { header: 'Title', key: 'title', width: 70 },
    { header: 'BUG id', key: 'bug', width: 10 },
    { header: 'Reason', key: 'reason', width: 60 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Still fails as expected', key: 'stillFails', width: 44 },
  ]);
  for (const { spec, test, describePath } of entries) {
    const annotation = failAnnotation(test);
    if (!annotation) continue;
    const status = statusOf(test);
    bugs.addRow({
      project: test.projectName,
      where: `${spec.file}:${spec.line}`,
      title: [...describePath, spec.title].join(' › '),
      bug: bugId(spec, annotation.description, annotation.location),
      reason: annotation.description ?? '',
      status,
      stillFails: stillFails(status),
    });
  }
  finish(bugs, 'status');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await workbook.xlsx.writeFile(OUT);
  console.log(
    `${path.relative(ROOT, OUT)}: ${entries.length} tests, ${counts.Passed} passed, ${counts.Failed} failed, ` +
      `${counts['Expected failure']} expected failures, ${counts.Skipped} skipped, ${counts.Flaky} flaky`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
