import { useState } from 'react';
import { CATEGORIES } from '../api.js';

const EMPTY = { title: '', amount: '', category: '', date: '' };

export default function ExpenseForm({ expense, onSubmit, onCancel }) {
  const [values, setValues] = useState(
    expense
      ? { title: expense.title, amount: String(expense.amount), category: expense.category, date: expense.date }
      : EMPTY,
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSubmitting(true);
    try {
      await onSubmit({ ...values, amount: values.amount === '' ? '' : Number(values.amount) });
    } catch (err) {
      const byField = {};
      err.details.forEach((d) => {
        byField[d.field] = d.message;
      });
      setFieldErrors(byField);
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  const isEdit = Boolean(expense);

  function fieldError(field) {
    return (
      fieldErrors[field] && (
        <span className="field-error" data-testid={`error-${field}`}>
          {fieldErrors[field]}
        </span>
      )
    );
  }

  return (
    <form className="expense-form" onSubmit={handleSubmit} noValidate data-testid="expense-form">
      <h2>{isEdit ? 'Edit expense' : 'Add expense'}</h2>
      {formError && (
        <p className="message error" role="alert" data-testid="form-error">
          {formError}
        </p>
      )}
      <div className="fields">
        <div>
          <label htmlFor="expense-title">Title</label>
          <input id="expense-title" value={values.title} onChange={update('title')} data-testid="form-title" />
          {fieldError('title')}
        </div>
        <div>
          <label htmlFor="expense-amount">Amount</label>
          <input
            id="expense-amount"
            type="number"
            step="0.01"
            min="0"
            value={values.amount}
            onChange={update('amount')}
            data-testid="form-amount"
          />
          {fieldError('amount')}
        </div>
        <div>
          <label htmlFor="expense-category">Category</label>
          <select
            id="expense-category"
            value={values.category}
            onChange={update('category')}
            data-testid="form-category"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {fieldError('category')}
        </div>
        <div>
          <label htmlFor="expense-date">Date</label>
          <input id="expense-date" type="date" value={values.date} onChange={update('date')} data-testid="form-date" />
          {fieldError('date')}
        </div>
      </div>
      <div className="actions">
        <button type="submit" disabled={submitting} data-testid="expense-submit">
          {isEdit ? 'Save changes' : 'Add expense'}
        </button>
        <button type="button" className="secondary" onClick={onCancel} data-testid="expense-cancel">
          Cancel
        </button>
      </div>
    </form>
  );
}
