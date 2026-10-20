import * as path from 'node:path';
import ExcelJS from 'exceljs';
import { expect, type APIRequestContext } from '@playwright/test';
import { uniqueTitle } from './expenses';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Upload files built by npm run fixtures:files (scripts/build-fixture-files.mts). */
export const FILES_DIR = path.join(__dirname, 'files');

export type Cell = string | number | Date | null;

/** Builds an in-memory .xlsx with one sheet; the first row is usually the header. */
export async function buildXlsx(rows: Cell[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Expenses');
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** POSTs buffer to /api/expenses/import in the "file" field. */
export function uploadXlsx(ctx: APIRequestContext, buffer: Buffer, name = 'expenses.xlsx') {
  return ctx.post('/api/expenses/import', { multipart: { file: { name, mimeType: XLSX_TYPE, buffer } } });
}

/**
 * Reads fixtures/files/<name> and appends a unique suffix to every title in the "title"
 * column, so files that insert rows stay unique across parallel workers and runs.
 * Returns the new workbook and the titles in row order.
 */
export async function fixtureWithUniqueTitles(name: string): Promise<{ name: string; buffer: Buffer; titles: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(FILES_DIR, name));
  const sheet = workbook.worksheets[0];
  const titleCol = (sheet.getRow(1).values as Cell[]).indexOf('title');
  const titles: string[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const cell = row.getCell(titleCol);
    cell.value = uniqueTitle(String(cell.value));
    titles.push(cell.value);
  });
  return { name, buffer: Buffer.from(await workbook.xlsx.writeBuffer()), titles };
}

/** Reads the data rows of a column (by header name) from fixtures/files/<name>, as-is. */
export async function fixtureColumn(name: string, header: string): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(FILES_DIR, name));
  const sheet = workbook.worksheets[0];
  const col = (sheet.getRow(1).values as Cell[]).indexOf(header);
  const values: string[] = [];
  sheet.eachRow((row, n) => {
    if (n > 1) values.push(String(row.getCell(col).value));
  });
  return values;
}

export type ExportRow = { id: number; title: string; amount: number; category: string; date: string; createdBy: string };

/** Parses an export workbook: header row plus one ExportRow per data row. */
export async function readExport(body: Buffer): Promise<{ headers: unknown[]; rows: ExportRow[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(body as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  const headers = (sheet.getRow(1).values as unknown[]).slice(1);
  const rows: ExportRow[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const v = row.values as Cell[];
    rows.push({
      id: v[1] as number,
      title: v[2] as string,
      amount: v[3] as number,
      category: v[4] as string,
      date: v[5] as string,
      createdBy: v[6] as string,
    });
  });
  return { headers, rows };
}

/**
 * Other workers create and delete expenses in parallel, so the export is compared with
 * the API list taken just before and just after it: every id present in both lists must
 * be exported, and nothing outside either list may be.
 */
export function expectExportMatchesList(exportedIds: number[], before: number[], after: number[]) {
  const stable = before.filter((id) => after.includes(id));
  const seen = new Set([...before, ...after]);
  expect(exportedIds).toEqual(expect.arrayContaining(stable));
  expect(exportedIds.filter((id) => !seen.has(id))).toEqual([]);
  expect(new Set(exportedIds).size).toBe(exportedIds.length);
}
