import ExcelJS from 'exceljs';
import type { APIRequestContext } from '@playwright/test';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
