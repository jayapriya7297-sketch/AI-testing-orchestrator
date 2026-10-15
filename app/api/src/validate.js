const CATEGORIES = ['Food', 'Travel', 'Office', 'Utilities', 'Entertainment', 'Other'];
const MAX_AMOUNT = 1000000;

function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Validates an expense payload. Returns { errors, value } where errors is a list of
 * { field, message } and value is the normalised expense when errors is empty.
 */
function validateExpense(input) {
  const errors = [];
  const body = input && typeof input === 'object' ? input : {};

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (body.title === undefined || body.title === null || title === '') {
    errors.push({ field: 'title', message: 'Title is required' });
  } else if (typeof body.title !== 'string') {
    errors.push({ field: 'title', message: 'Title must be a string' });
  } else if (title.length > 200) {
    errors.push({ field: 'title', message: 'Title must be at most 200 characters' });
  }

  let amount = body.amount;
  if (amount === undefined || amount === null || amount === '') {
    errors.push({ field: 'amount', message: 'Amount is required' });
  } else {
    if (typeof amount === 'string' && /^-?\d+(\.\d+)?$/.test(amount.trim())) {
      amount = Number(amount.trim());
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a number' });
    } else if (amount <= 0) {
      errors.push({ field: 'amount', message: 'Amount must be greater than 0' });
    } else if (amount > MAX_AMOUNT) {
      errors.push({ field: 'amount', message: `Amount must be at most ${MAX_AMOUNT}` });
    } else if (Math.round(amount * 100) / 100 !== amount) {
      errors.push({ field: 'amount', message: 'Amount must have at most 2 decimal places' });
    }
  }

  const category = body.category;
  if (category === undefined || category === null || category === '') {
    errors.push({ field: 'category', message: 'Category is required' });
  } else if (!CATEGORIES.includes(category)) {
    errors.push({ field: 'category', message: `Category must be one of: ${CATEGORIES.join(', ')}` });
  }

  const date = body.date;
  if (date === undefined || date === null || date === '') {
    errors.push({ field: 'date', message: 'Date is required' });
  } else if (!isRealDate(date)) {
    errors.push({ field: 'date', message: 'Date must be a valid date in YYYY-MM-DD format' });
  }

  return { errors, value: errors.length ? null : { title, amount, category, date } };
}

module.exports = { validateExpense, CATEGORIES };
