/**
 * Change-impact analysis (npm run analyze:change -- [range] [-- pathspec], or --files a b ...):
 * matches changed files to the "Code map" sheet of requirements/expenses.xlsx, finds tests for
 * the affected requirements in review/traceability.xlsx (else the row's fallback specs), and
 * prints a Markdown report with the overall risk and ready-to-run Playwright commands.
 * The report is also written to reports/change-impact.md. Used by /analyze-change.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ExcelJS from 'exceljs';

type Risk = 'High' | 'Medium' | 'Low';
type CodeMapRow = { pattern: string; requirements: string[]; risk: Risk; fallbackSpecs: string[]; notes: string };
type Requirement = { id: string; title: string; priority: string; status: string };
type TracedTest = { requirement: string; spec: string; title: string; status: string };

const ROOT = path.join(import.meta.dirname, '..');
const REQUIREMENTS_XLSX = path.join(ROOT, 'requirements/expenses.xlsx');
const TRACEABILITY_XLSX = path.join(ROOT, 'review/traceability.xlsx');
const OUT = path.join(ROOT, 'reports/change-impact.md');
const RISK_ORDER: Risk[] = ['Low', 'Medium', 'High'];

const maxRisk = (risks: Risk[]): Risk =>
  risks.reduce<Risk>((a, b) => (RISK_ORDER.indexOf(b) > RISK_ORDER.indexOf(a) ? b : a), 'Low');
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
const uniq = <T,>(items: T[]): T[] => [...new Set(items)];

/** Rows of a sheet as cell texts, header row skipped. */
async function readSheet(file: string, sheetName: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`No sheet "${sheetName}" in ${path.relative(ROOT, file)}`);
  const rows: string[][] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    rows.push(Array.from({ length: sheet.columnCount }, (_, i) => row.getCell(i + 1).text.trim()));
  });
  return rows;
}

function parseArgs(argv: string[]): { label: string; files: string[] } {
  if (argv[0] === '--files') return { label: 'files given with --files', files: argv.slice(1) };
  const sep = argv.indexOf('--');
  const range = (sep === -1 ? argv : argv.slice(0, sep))[0] ?? 'main...HEAD';
  const pathspec = sep === -1 ? [] : argv.slice(sep + 1);
  let out: string;
  try {
    out = execFileSync('git', ['diff', '--name-only', range, '--', ...pathspec], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    console.error(`git diff failed for range "${range}": ${(err as { stderr?: string }).stderr?.trim() || err}`);
    process.exit(1);
  }
  const label = pathspec.length ? `${range} -- ${pathspec.join(' ')}` : range;
  return { label, files: out.split('\n').filter(Boolean) };
}

async function main(): Promise<void> {
  const { label, files } = parseArgs(process.argv.slice(2));

  const requirements: Requirement[] = (await readSheet(REQUIREMENTS_XLSX, 'Requirements')).map((r) => ({
    id: r[0], title: r[1], priority: r[4], status: r[5],
  }));
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const implemented = requirements.filter((r) => r.status === 'Implemented').map((r) => r.id);

  const codeMap: CodeMapRow[] = (await readSheet(REQUIREMENTS_XLSX, 'Code map')).map((r) => ({
    pattern: r[0],
    requirements: r[1] === 'ALL' ? implemented : r[1].split(',').map((s) => s.trim()).filter((s) => /^REQ-\d+$/.test(s)),
    risk: r[2] as Risk,
    fallbackSpecs: r[3].split(/\s+/).filter(Boolean),
    notes: r[4],
  }));

  // "Spec file" and "Test title" may hold several values joined by " + "; pair them by position.
  const traced: TracedTest[] = [];
  for (const r of await readSheet(TRACEABILITY_XLSX, 'Traceability')) {
    const [requirement, , , specCell, titleCell, , status] = r;
    const specs = specCell.split(' + ').filter(Boolean);
    const titles = titleCell.split(' + ').filter(Boolean);
    titles.forEach((full, i) => {
      const spec = specs.length === titles.length ? specs[i] : specs[0];
      if (spec) traced.push({ requirement, spec, title: full.split(' > ').at(-1)!, status });
    });
  }

  // Match files to rows.
  const warnings: string[] = [];
  const fileRows = files.map((file) => ({ file, rows: codeMap.filter((row) => path.matchesGlob(file, row.pattern)) }));
  const unmapped = fileRows.filter((f) => f.rows.length === 0).map((f) => f.file);
  const matchedRows = uniq(fileRows.flatMap((f) => f.rows));

  const riskCandidates = matchedRows.map((r) => r.risk);
  if (unmapped.length) riskCandidates.push('Medium');
  const overall = files.length ? maxRisk(riskCandidates) : 'Low';
  const fullSuite = overall === 'High';
  const deciders = fileRows
    .filter((f) => (f.rows.length ? maxRisk(f.rows.map((r) => r.risk)) : 'Medium') === overall)
    .map((f) => f.file);

  // Requirements and their tests.
  const affected = uniq(matchedRows.flatMap((r) => r.requirements)).sort();
  for (const id of affected) if (!reqById.has(id)) warnings.push(`Code map names ${id}, which is not in the Requirements sheet`);
  const suiteTests = traced.filter((t) => affected.includes(t.requirement) && t.spec.startsWith('tests/'));
  const draftTests = traced.filter(
    (t) => affected.includes(t.requirement) && t.spec.startsWith('review/') && !t.status.startsWith('fixme'),
  );
  const gaps = affected.filter((id) => !suiteTests.some((t) => t.requirement === id));
  const fallbackByReq = new Map(
    gaps.map((id) => [id, uniq(matchedRows.filter((r) => r.requirements.includes(id)).flatMap((r) => r.fallbackSpecs))]),
  );

  const changedSpecs = files.filter((f) => /^tests\/.*\.spec\.ts$/.test(f) && fs.existsSync(path.join(ROOT, f)));
  const changedDraftSpecs = files.filter((f) => /^review\/specs\/.*\.spec\.ts$/.test(f) && fs.existsSync(path.join(ROOT, f)));
  const fallbackSpecs = uniq([...fallbackByReq.values()].flat()).sort();
  const fileSpecs = uniq([...fallbackSpecs, ...changedSpecs]).sort();
  // Traced tests in a spec that already runs as a whole file are left out of --grep.
  const grepTests = suiteTests.filter((t) => !fileSpecs.includes(t.spec));
  const grepTitles = uniq(grepTests.map((t) => t.title));
  const draftSpecs = uniq([...draftTests.map((t) => t.spec), ...changedDraftSpecs]).sort();

  // Commands.
  const commands: string[] = [];
  if (fullSuite) {
    commands.push('npm test');
  } else {
    commands.push(`npx playwright test --grep ${shellQuote(['@smoke', ...grepTitles.map(escapeRegex)].join('|'))}`);
    if (fileSpecs.length) commands.push(`npx playwright test ${fileSpecs.join(' ')}`);
  }
  const draftCommand = draftSpecs.length ? `RUN_REVIEW=1 npx playwright test --project=review ${draftSpecs.join(' ')}` : '';

  // Report.
  const md: string[] = [];
  md.push(`# Change impact: ${label}`, '', `${new Date().toISOString().slice(0, 10)} · ${files.length} changed file(s) · overall risk **${overall}**`, '');

  md.push('## Changed files', '');
  if (!files.length) md.push('No changed files.');
  else {
    md.push('| File | Code map pattern(s) | Risk |', '|---|---|---|');
    for (const f of fileRows) {
      md.push(`| ${f.file} | ${f.rows.map((r) => r.pattern).join(', ') || '**unmapped**'} | ${f.rows.length ? maxRisk(f.rows.map((r) => r.risk)) : '—'} |`);
    }
  }
  md.push('');

  if (unmapped.length || warnings.length) {
    md.push('## Warnings', '');
    for (const f of unmapped) md.push(`- ${f} matches no Code map row: add a row to scripts/build-requirements.mts (counted as Medium)`);
    for (const w of warnings) md.push(`- ${w}`);
    md.push('');
  }

  md.push('## Affected requirements', '');
  if (!affected.length) md.push('None.');
  else {
    md.push('| ID | Title | Priority | Tests from |', '|---|---|---|---|');
    for (const id of affected) {
      const r = reqById.get(id);
      md.push(`| ${id} | ${r?.title ?? '?'} | ${r?.priority ?? '?'} | ${gaps.includes(id) ? 'fallback specs' : `traceability (${suiteTests.filter((t) => t.requirement === id).length})`} |`);
    }
  }
  md.push('');

  md.push('## Tests to run', '');
  if (fullSuite) md.push(`Full suite: High-risk shared code changed (${deciders.join(', ')}).`, '');
  md.push('- Smoke: every test tagged @smoke');
  for (const spec of uniq(suiteTests.map((t) => t.spec))) {
    const titles = uniq(suiteTests.filter((t) => t.spec === spec).map((t) => t.title));
    if (fileSpecs.includes(spec)) {
      md.push(`- ${spec} (traced, ${titles.length} test(s); the whole file runs as a fallback or changed spec)`);
      continue;
    }
    md.push(`- ${spec} (traced)`);
    for (const title of titles) md.push(`  - ${title}`);
  }
  if (fallbackSpecs.length) md.push(`- Fallback specs: ${fallbackSpecs.join(', ')}`);
  if (changedSpecs.length) md.push(`- Changed specs: ${changedSpecs.join(', ')}`);
  if (draftSpecs.length) md.push(`- Review drafts (optional): ${draftSpecs.join(', ')}`);
  md.push('');

  md.push('## Traceability gaps', '');
  if (!gaps.length) md.push('None: every affected requirement has traceability rows.');
  else {
    md.push('Requirements with no rows in review/traceability.xlsx (backfill later):', '');
    for (const id of gaps) {
      const specs = fallbackByReq.get(id)!;
      const using = fullSuite ? 'covered by the full suite' : specs.length ? `fallback: ${specs.join(', ')}` : 'no fallback specs: smoke only';
      md.push(`- ${id} ${reqById.get(id)?.title ?? ''}: ${using}`);
    }
  }
  md.push('');

  md.push('## Overall risk', '', `**${overall}**${files.length ? `, set by ${deciders.join(', ')}` : ''}.`, '');

  md.push('## Commands', '', '```sh', ...commands, '```', '');
  if (draftCommand) md.push('Optional, review drafts:', '', '```sh', draftCommand, '```', '');

  const report = md.join('\n');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, report);
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
