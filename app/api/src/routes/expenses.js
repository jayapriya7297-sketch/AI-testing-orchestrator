const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { pool } = require('../db');
const { validateExpense, CATEGORIES } = require('../validate');

const router = express.Router();

const MAX_IMPORT_ROWS = 1000;
const IMPORT_COLUMNS = ['title', 'amount', 'category', 'date'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/\.xlsx$/i.test(file.originalname)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }
    return cb(null, true);
  },
});

const SELECT_EXPENSES = `
  SELECT e.id, e.title, e.amount, e.category, e.date, u.email AS created_by
  FROM expenses e JOIN users u ON u.id = e.created_by`;

function parseId(raw) {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

function validationError(res, details) {
  return res.status(400).json({ error: 'Validation failed', details });
}

// Ownership (REQ-008, BUG-001): a regular user reads and writes only their own
// expenses (404 otherwise); the admin reads every expense but edits and deletes
// only their own (403 for another user's).
const isAdmin = (user) => user.role === 'admin';

async function listExpenses(user, category) {
  const params = [];
  const where = [];
  if (!isAdmin(user)) {
    params.push(user.id);
    where.push(`e.created_by = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`e.category = $${params.length}`);
  }
  let sql = SELECT_EXPENSES;
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY e.date DESC, e.id DESC';
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function findExpense(id, user) {
  const { rows } = isAdmin(user)
    ? await pool.query(`${SELECT_EXPENSES} WHERE e.id = $1`, [id])
    : await pool.query(`${SELECT_EXPENSES} WHERE e.id = $1 AND e.created_by = $2`, [id, user.id]);
  return rows[0] || null;
}

// Sends 404 or 403 and returns false when the user may not edit or delete expense id.
async function checkWriteAccess(id, user, res) {
  const { rows } = await pool.query('SELECT created_by FROM expenses WHERE id = $1', [id]);
  const owned = rows.length > 0 && rows[0].created_by === Number(user.id);
  if (owned) return true;
  if (rows.length && isAdmin(user)) {
    res.status(403).json({ error: 'You can only edit or delete your own expenses' });
  } else {
    res.status(404).json({ error: 'Expense not found' });
  }
  return false;
}

function categoryFilter(req, res) {
  const { category } = req.query;
  if (category === undefined || category === '') return { ok: true, category: null };
  if (!CATEGORIES.includes(category)) {
    validationError(res, [
      { field: 'category', message: `Category must be one of: ${CATEGORIES.join(', ')}` },
    ]);
    return { ok: false };
  }
  return { ok: true, category };
}

router.get('/', async (req, res, next) => {
  try {
    const filter = categoryFilter(req, res);
    if (!filter.ok) return undefined;
    return res.json(await listExpenses(req.user, filter.category));
  } catch (err) {
    return next(err);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const filter = categoryFilter(req, res);
    if (!filter.ok) return undefined;
    const expenses = await listExpenses(req.user, filter.category);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenses');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Title', key: 'title', width: 32 },
      { header: 'Amount', key: 'amount', width: 12, style: { numFmt: '0.00' } },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Created By', key: 'created_by', width: 24 },
    ];
    sheet.getRow(1).font = { bold: true };
    expenses.forEach((e) => sheet.addRow(e));

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return next(err);
  }
});

function cellToValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) return cellToValue(value.result);
    if ('text' in value) return cellToValue(value.text);
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('');
  }
  return typeof value === 'string' ? value.trim() : value;
}

router.post(
  '/import',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File must be at most 5 MB'
            : 'Upload a single .xlsx file in the "file" field';
        return res.status(400).json({ error: message });
      }
      return next(err);
    });
  },
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded; send an .xlsx file in the "file" field' });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'File is not a valid .xlsx workbook' });
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.actualRowCount < 2) {
      return res.status(400).json({ error: 'Workbook has no data rows' });
    }

    // Locate columns by header name so extra columns (e.g. from export) are ignored.
    const columnIndex = {};
    sheet.getRow(1).eachCell((cell, col) => {
      const name = String(cellToValue(cell.value)).toLowerCase();
      if (IMPORT_COLUMNS.includes(name)) columnIndex[name] = col;
    });
    const missing = IMPORT_COLUMNS.filter((c) => !columnIndex[c]);
    if (missing.length) {
      return res.status(400).json({
        error: 'Import failed',
        details: missing.map((c) => ({ row: 1, field: c, message: `Missing column "${c}"` })),
      });
    }

    const details = [];
    const toInsert = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const raw = {};
      IMPORT_COLUMNS.forEach((c) => {
        raw[c] = cellToValue(row.getCell(columnIndex[c]).value);
      });
      if (IMPORT_COLUMNS.every((c) => raw[c] === '')) return;
      const { errors, value } = validateExpense(raw);
      errors.forEach((e) => details.push({ row: rowNumber, ...e }));
      if (value) toInsert.push(value);
    });

    if (details.length) {
      return res.status(400).json({ error: 'Import failed', details });
    }
    if (toInsert.length === 0) {
      return res.status(400).json({ error: 'Workbook has no data rows' });
    }
    if (toInsert.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `Import is limited to ${MAX_IMPORT_ROWS} rows` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const e of toInsert) {
        await client.query(
          'INSERT INTO expenses (title, amount, category, date, created_by) VALUES ($1, $2, $3, $4, $5)',
          [e.title, e.amount, e.category, e.date, req.user.id],
        );
      }
      await client.query('COMMIT');
      return res.status(201).json({ imported: toInsert.length });
    } catch (err) {
      await client.query('ROLLBACK');
      return next(err);
    } finally {
      client.release();
    }
  },
);

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return validationError(res, [{ field: 'id', message: 'Id must be a positive integer' }]);
    const expense = await findExpense(id, req.user);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    return res.json(expense);
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { errors, value } = validateExpense(req.body);
    if (errors.length) return validationError(res, errors);
    const { rows } = await pool.query(
      'INSERT INTO expenses (title, amount, category, date, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [value.title, value.amount, value.category, value.date, req.user.id],
    );
    return res.status(201).json(await findExpense(rows[0].id, req.user));
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return validationError(res, [{ field: 'id', message: 'Id must be a positive integer' }]);
    const { errors, value } = validateExpense(req.body);
    if (errors.length) return validationError(res, errors);
    if (!(await checkWriteAccess(id, req.user, res))) return undefined;
    const { rowCount } = await pool.query(
      'UPDATE expenses SET title = $1, amount = $2, category = $3, date = $4 WHERE id = $5 AND created_by = $6',
      [value.title, value.amount, value.category, value.date, id, req.user.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Expense not found' });
    return res.json(await findExpense(id, req.user));
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return validationError(res, [{ field: 'id', message: 'Id must be a positive integer' }]);
    if (!(await checkWriteAccess(id, req.user, res))) return undefined;
    const { rowCount } = await pool.query('DELETE FROM expenses WHERE id = $1 AND created_by = $2', [
      id,
      req.user.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: 'Expense not found' });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
