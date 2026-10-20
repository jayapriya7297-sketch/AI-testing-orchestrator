/**
 * Rebuilds the upload files in fixtures/files/ (npm run fixtures:files).
 * Titles in valid-3-rows and mixed-valid-invalid are templates: the UI tests add a
 * unique suffix before uploading (fixtureWithUniqueTitles in fixtures/xlsx.ts).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ExcelJS from 'exceljs';

type Cell = string | number | null;

const DIR = path.join(import.meta.dirname, '../fixtures/files');
const HEADERS = ['title', 'amount', 'category', 'date'];

async function writeXlsx(name: string, rows: Cell[][]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Expenses');
  rows.forEach((r) => sheet.addRow(r));
  await workbook.xlsx.writeFile(path.join(DIR, name));
}

async function main(): Promise<void> {
  await writeXlsx('valid-3-rows.xlsx', [
    HEADERS,
    ['file-import lunch', 12.5, 'Food', '2026-10-01'],
    ['file-import taxi', 300, 'Travel', '2026-10-02'],
    ['file-import paper', 7.25, 'Office', '2026-10-03'],
  ]);
  await writeXlsx('mixed-valid-invalid.xlsx', [
    HEADERS,
    ['file-mixed coffee', 4.5, 'Food', '2026-10-01'],
    ['file-mixed train', 55, 'Travel', '2026-10-02'],
    ['file-mixed refund', -5, 'Other', '2026-10-03'],
    ['file-mixed apples', 3, 'Groceries', '2026-10-04'],
  ]);
  await writeXlsx('wrong-headers.xlsx', [
    ['name', 'price', 'category', 'date'],
    ['file-wrong-headers row', 10, 'Food', '2026-10-01'],
  ]);
  await writeXlsx('missing-amount-column.xlsx', [
    ['title', 'category', 'date'],
    ['file-missing-amount row', 'Food', '2026-10-01'],
  ]);
  await writeXlsx('empty-sheet.xlsx', [HEADERS]);
  fs.writeFileSync(path.join(DIR, 'not-excel.xlsx'), 'This is a plain text file renamed to .xlsx.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
