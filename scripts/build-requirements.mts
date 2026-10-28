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
    defects: ['BUG-002', 'BUG-004'],
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
    defects: ['BUG-001', 'BUG-005'],
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

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await workbook.xlsx.writeFile(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
