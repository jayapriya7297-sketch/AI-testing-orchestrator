/**
 * Builds requirements/expenses.xlsx (npm run requirements:build): the Expense Manager
 * requirements, one row per requirement, acceptance criteria one per line in the cell.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ExcelJS from 'exceljs';

type Requirement = {
  id: string;
  title: string;
  story: string;
  criteria: string[];
  priority: 'High' | 'Medium' | 'Low';
  status: 'Implemented' | 'Planned';
  /** Bug ids from docs/bugs-found.md. */
  defects?: string[];
};

/** One "Code map" row: which requirements a code path touches (read by scripts/analyze-change.mts). */
type CodeMapRow = {
  /** Glob relative to the repo root (path.matchesGlob: * stays within one directory). */
  pattern: string;
  /** Requirement ids, 'ALL' (every Implemented requirement) or '—' (none). */
  requirements: string;
  risk: 'High' | 'Medium' | 'Low';
  /** Spec files to run for a requirement with no traceability rows; empty for High (full suite). */
  fallbackSpecs?: string[];
  notes: string;
};

const OUT = path.join(import.meta.dirname, '../requirements/expenses.xlsx');

const REQUIREMENTS: Requirement[] = [
  {
    id: 'REQ-001',
    title: 'Login',
    story: 'As a user I want to log in so I can see my expenses',
    criteria: [
      'Valid email and password opens the expense list',
      'Wrong password shows an error and stays on login',
      'Email is case-insensitive and trimmed',
    ],
    priority: 'High',
    status: 'Implemented',
  },
  {
    id: 'REQ-002',
    title: 'Add expense',
    story: 'As a user I want to add an expense',
    criteria: [
      'Title, amount, category and date are required',
      'A whitespace-only title counts as missing; title is at most 200 characters',
      'Amount must be > 0, at most 1,000,000 (inclusive), max 2 decimals',
      'Amount uses a dot decimal (12.50); no thousands separator',
      'Category is one of: Food, Travel, Office, Utilities, Entertainment, Other',
      'Date is any real date in YYYY-MM-DD format; future dates are allowed',
      'Duplicate expenses (same title, amount, category and date) are allowed',
      'Success message and the new row appear in the list',
      'The success message stays until the user opens Add or Edit or another message (e.g. an error) replaces it; filtering, Export and Import keep it',
      'The new row follows the date sort (newest first); on the same date the newest expense (higher id) comes first',
    ],
    priority: 'High',
    status: 'Implemented',
    defects: ['BUG-002', 'BUG-004 (closed, by design)'],
  },
  {
    id: 'REQ-003',
    title: 'Edit expense',
    story: 'As a user I want to correct an expense',
    criteria: [
      'Edit form opens with current values',
      'Saved changes appear in the list',
      'Cancel keeps the original values',
    ],
    priority: 'High',
    status: 'Implemented',
  },
  {
    id: 'REQ-004',
    title: 'Delete expense',
    story: 'As a user I want to delete an expense',
    criteria: ['Delete asks for confirmation', 'Confirm removes it; Cancel keeps it'],
    priority: 'Medium',
    status: 'Implemented',
  },
  {
    id: 'REQ-005',
    title: 'Filter by category',
    story: 'As a user I want to see one category',
    criteria: ['Selecting a category shows only that category', '"All" shows every expense'],
    priority: 'Medium',
    status: 'Implemented',
  },
  {
    id: 'REQ-006',
    title: 'Export to Excel',
    story: 'As a user I want to download my expenses',
    criteria: [
      'Export downloads an .xlsx with one row per visible expense',
      'Export respects the current category filter',
    ],
    priority: 'Medium',
    status: 'Implemented',
  },
  {
    id: 'REQ-007',
    title: 'Import from Excel',
    story: 'As a user I want to bulk-add expenses',
    criteria: [
      'A valid file adds all rows and shows how many were imported',
      'Any invalid row rejects the whole file and lists row errors',
    ],
    priority: 'Medium',
    status: 'Implemented',
  },
  {
    id: 'REQ-008',
    title: 'Data privacy',
    story: 'As a user I want only my own expenses visible',
    criteria: [
      "A regular user sees only their own expenses in the list, export and detail views; another user's expense returns 404",
      "A regular user cannot edit or delete another user's expense (404)",
      "The admin can view every user's expenses (list, export, detail)",
      "The admin can edit and delete only their own expenses; another user's returns 403",
    ],
    priority: 'High',
    status: 'Implemented',
    defects: ['BUG-001 (fixed)', 'BUG-005'],
  },
  {
    id: 'REQ-009',
    title: 'Search by title',
    story: 'As a user I want to find an expense by name',
    criteria: [
      'Typing in a search box filters the list by title (case-insensitive)',
      'No match shows "No expenses found"',
    ],
    priority: 'Low',
    status: 'Planned',
  },
  {
    id: 'REQ-010',
    title: 'Monthly total',
    story: 'As a user I want to see what I spent this month',
    criteria: ['The list shows a total for the current month', 'The total updates after add, edit or delete'],
    priority: 'Low',
    status: 'Planned',
  },
];

const EXPENSE_CRUD = 'REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008';

const CODE_MAP: CodeMapRow[] = [
  // API
  { pattern: 'app/api/src/app.js', requirements: 'ALL', risk: 'High', notes: 'Middleware: JSON limit, route wiring, /api 404, error handler (400/500)' },
  { pattern: 'app/api/src/server.js', requirements: 'ALL', risk: 'High', notes: 'API startup' },
  { pattern: 'app/api/src/db.js', requirements: 'ALL', risk: 'High', notes: 'pg pool; DATE and NUMERIC type parsers used by every read' },
  { pattern: 'app/api/src/auth.js', requirements: 'ALL', risk: 'High', notes: 'JWT sign/verify, requireAuth on every /api/expenses route; role used by REQ-008' },
  { pattern: 'app/api/src/routes/auth.js', requirements: 'REQ-001', risk: 'High', notes: 'POST /api/auth/login; every test logs in through it' },
  { pattern: 'app/api/src/validate.js', requirements: 'REQ-002, REQ-003, REQ-007', risk: 'High', notes: 'Shared expense validator for CRUD and xlsx import' },
  {
    pattern: 'app/api/src/routes/expenses.js',
    requirements: EXPENSE_CRUD,
    risk: 'Medium',
    fallbackSpecs: [
      'tests/api/expenses.spec.ts',
      'tests/api/expenses-file.spec.ts',
      'tests/db/expenses.spec.ts',
      'tests/db/expenses-import.spec.ts',
      'tests/ui/expense-crud.spec.ts',
      'tests/ui/expense-list.spec.ts',
      'tests/ui/expense-files.spec.ts',
    ],
    notes: 'CRUD, ?category filter, /export, /import, ownership checks (REQ-008)',
  },
  { pattern: 'app/api/*', requirements: 'ALL', risk: 'High', notes: 'package.json, lockfile, Dockerfile: dependencies and runtime' },
  // Web
  { pattern: 'app/web/src/api.js', requirements: 'ALL', risk: 'High', notes: 'Shared fetch client, Bearer token, localStorage session, 401 handler' },
  { pattern: 'app/web/src/App.jsx', requirements: 'ALL', risk: 'High', notes: 'Session routing between Login and Expenses' },
  { pattern: 'app/web/src/main.jsx', requirements: 'ALL', risk: 'High', notes: 'Web entry point' },
  { pattern: 'app/web/src/pages/LoginPage.jsx', requirements: 'REQ-001', risk: 'Medium', fallbackSpecs: ['tests/ui/login.spec.ts'], notes: 'Login form and errors, session-expired notice' },
  {
    pattern: 'app/web/src/pages/ExpensesPage.jsx',
    requirements: EXPENSE_CRUD,
    risk: 'Medium',
    fallbackSpecs: ['tests/ui/expense-crud.spec.ts', 'tests/ui/expense-list.spec.ts', 'tests/ui/expense-files.spec.ts'],
    notes: 'List, sort, filter, delete confirm, export/import, messages; REQ-009/010 will land here',
  },
  { pattern: 'app/web/src/components/ExpenseForm.jsx', requirements: 'REQ-002, REQ-003', risk: 'Medium', fallbackSpecs: ['tests/ui/expense-crud.spec.ts'], notes: 'Add/Edit form, client-side validation' },
  { pattern: 'app/web/src/styles.css', requirements: '—', risk: 'Low', notes: 'Visual only; smoke covers it' },
  { pattern: 'app/web/*', requirements: 'ALL', risk: 'High', notes: 'nginx.conf (/api proxy), vite.config.js, index.html, Dockerfile, package files' },
  // Database and stack
  { pattern: 'app/db/init/01-schema.sql', requirements: 'ALL', risk: 'High', notes: 'Tables and constraints; needs a reseed (down -v)' },
  { pattern: 'app/db/init/02-seed.sql', requirements: 'ALL', risk: 'High', notes: 'Seed users and 20 expenses that tests count on; needs a reseed (down -v)' },
  { pattern: 'docker-compose.yml', requirements: 'ALL', risk: 'High', notes: 'Service wiring, env, ports' },
  // Test harness
  { pattern: 'playwright.config.ts', requirements: 'ALL', risk: 'High', notes: 'Test projects, baseURLs, reporters' },
  { pattern: 'fixtures/**', requirements: 'ALL', risk: 'High', notes: 'Shared test fixtures and upload files' },
  { pattern: 'pages/**', requirements: 'ALL', risk: 'High', notes: 'Page objects used by every UI test' },
  { pattern: 'schemas/**', requirements: 'ALL', risk: 'High', notes: 'ajv response schemas' },
  { pattern: 'tests/auth.setup.ts', requirements: 'ALL', risk: 'High', notes: 'UI login state for the ui project' },
  { pattern: 'tests/db/db.helper.ts', requirements: 'ALL', risk: 'High', notes: 'Shared DB query helpers' },
  { pattern: 'tests/**/*.spec.ts', requirements: '—', risk: 'Low', notes: 'The changed spec itself is added to the run' },
  { pattern: 'package.json', requirements: 'ALL', risk: 'High', notes: 'Test dependencies and scripts' },
  { pattern: 'package-lock.json', requirements: 'ALL', risk: 'High', notes: 'Locked versions; also sets the Playwright image version' },
  { pattern: '.nvmrc', requirements: 'ALL', risk: 'Medium', notes: 'Node version for local runs and CI' },
  // Tooling, CI and docs
  { pattern: 'tests.Dockerfile', requirements: '—', risk: 'Medium', notes: 'Docker test runner; verify with npm run test:docker:smoke' },
  { pattern: '.github/**', requirements: '—', risk: 'Medium', notes: 'CI workflow; verify on the PR run' },
  { pattern: 'review/**', requirements: '—', risk: 'Low', notes: 'AI drafts, not in the suite (optional review run)' },
  { pattern: 'requirements/**', requirements: '—', risk: 'Low', notes: 'Requirements data; check traceability is still in sync' },
  { pattern: 'scripts/**', requirements: '—', risk: 'Low', notes: 'Tooling; run the changed script' },
  { pattern: 'reporting/**', requirements: '—', risk: 'Low', notes: 'Excel report, CI summary, n8n payload' },
  { pattern: 'Jenkinsfile', requirements: '—', risk: 'Low', notes: 'Nightly pipeline' },
  { pattern: 'jenkins/**', requirements: '—', risk: 'Low', notes: 'Local Jenkins stack' },
  { pattern: 'n8n/**', requirements: '—', risk: 'Low', notes: 'Failure-to-Jira workflow' },
  { pattern: '.claude/**', requirements: '—', risk: 'Low', notes: 'Skills and settings' },
  { pattern: '**/*.md', requirements: '—', risk: 'Low', notes: 'Docs (CLAUDE.md, docs/, READMEs)' },
  { pattern: '.env.example', requirements: '—', risk: 'Low', notes: 'Demo config template, no secrets' },
  { pattern: '.gitignore', requirements: '—', risk: 'Low', notes: 'Repo hygiene' },
];

async function main(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Requirements', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Title', key: 'title', width: 20 },
    { header: 'User story', key: 'story', width: 45 },
    { header: 'Acceptance criteria', key: 'criteria', width: 65 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Status', key: 'status', width: 13 },
    { header: 'Linked defects', key: 'defects', width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const r of REQUIREMENTS) {
    sheet.addRow({ ...r, criteria: r.criteria.join('\n'), defects: r.defects?.join(', ') ?? '' });
  }
  sheet.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true };
  });

  const codeMap = workbook.addWorksheet('Code map', { views: [{ state: 'frozen', ySplit: 1 }] });
  codeMap.columns = [
    { header: 'Code path pattern', key: 'pattern', width: 38 },
    { header: 'Requirement IDs', key: 'requirements', width: 30 },
    { header: 'Risk', key: 'risk', width: 9 },
    { header: 'Fallback specs', key: 'fallbackSpecs', width: 40 },
    { header: 'Notes', key: 'notes', width: 60 },
  ];
  codeMap.getRow(1).font = { bold: true };
  for (const r of CODE_MAP) {
    codeMap.addRow({ ...r, fallbackSpecs: r.fallbackSpecs?.join('\n') ?? '' });
  }
  codeMap.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true };
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await workbook.xlsx.writeFile(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
