import { useCallback, useEffect, useRef, useState } from 'react';
import { api, CATEGORIES } from '../api.js';
import ExpenseForm from '../components/ExpenseForm.jsx';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function ExpensesPage({ user, onLogout }) {
  const [expenses, setExpenses] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | expense
  const [confirmingId, setConfirmingId] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null); // { ok, message, details }
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await api.listExpenses(category));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(message) {
    setError('');
    setSuccess(message);
  }

  async function handleSave(values) {
    if (editing === 'new') {
      await api.createExpense(values);
      flash('Expense added');
    } else {
      await api.updateExpense(editing.id, values);
      flash('Expense updated');
    }
    setEditing(null);
    await load();
  }

  async function handleDelete(id) {
    setConfirmingId(null);
    try {
      await api.deleteExpense(id);
      flash('Expense deleted');
      await load();
    } catch (err) {
      setSuccess('');
      setError(err.message);
    }
  }

  async function handleExport() {
    try {
      const blob = await api.exportExpenses(category);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'expenses.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSuccess('');
      setError(err.message);
    }
  }

  async function handleImport() {
    if (!importFile) {
      setImportResult({ ok: false, message: 'Choose an .xlsx file to import', details: [] });
      return;
    }
    try {
      const { imported } = await api.importExpenses(importFile);
      setImportResult({ ok: true, message: `Imported ${imported} expense${imported === 1 ? '' : 's'}`, details: [] });
      setImportFile(null);
      if (fileInput.current) fileInput.current.value = '';
      await load();
    } catch (err) {
      setImportResult({ ok: false, message: err.message, details: err.details });
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <main className="page">
      <header className="topbar">
        <h1>Expense Manager</h1>
        <div className="user">
          <span data-testid="user-email">{user.email}</span>
          <button type="button" className="secondary" onClick={onLogout} data-testid="logout-button">
            Log out
          </button>
        </div>
      </header>

      {success && (
        <p className="message success" role="status" data-testid="success-message">
          {success}
        </p>
      )}
      {error && (
        <p className="message error" role="alert" data-testid="error-message">
          {error}
        </p>
      )}

      <section className="toolbar">
        <label htmlFor="category-filter">Category</label>
        <select
          id="category-filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          data-testid="category-filter"
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setSuccess('');
            setEditing('new');
          }}
          data-testid="add-expense-button"
        >
          Add expense
        </button>
        <button type="button" className="secondary" onClick={handleExport} data-testid="export-button">
          Export
        </button>
        <span className="import">
          <label htmlFor="import-input" className="visually-hidden">
            Import file
          </label>
          <input
            id="import-input"
            ref={fileInput}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setImportResult(null);
              setImportFile(e.target.files[0] || null);
            }}
            data-testid="import-input"
          />
          <button type="button" className="secondary" onClick={handleImport} data-testid="import-button">
            Import
          </button>
        </span>
      </section>

      {importResult && (
        <div
          className={`message ${importResult.ok ? 'success' : 'error'}`}
          role={importResult.ok ? 'status' : 'alert'}
          data-testid={importResult.ok ? 'import-message' : 'import-error'}
        >
          {importResult.message}
          {importResult.details.length > 0 && (
            <ul>
              {importResult.details.map((d, i) => (
                <li key={i}>
                  Row {d.row}, {d.field}: {d.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <ExpenseForm
          key={editing === 'new' ? 'new' : editing.id}
          expense={editing === 'new' ? null : editing}
          onSubmit={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <p data-testid="loading">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="empty" data-testid="empty-state">
          No expenses found.
        </p>
      ) : (
        <table data-testid="expenses-table">
          <thead>
            <tr>
              <th>Title</th>
              <th className="num">Amount</th>
              <th>Category</th>
              <th>Date</th>
              <th>Created by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} data-testid={`expense-row-${e.id}`}>
                <td data-testid="expense-title">{e.title}</td>
                <td className="num" data-testid="expense-amount">
                  {currency.format(e.amount)}
                </td>
                <td data-testid="expense-category">{e.category}</td>
                <td data-testid="expense-date">{e.date}</td>
                <td data-testid="expense-created-by">{e.created_by}</td>
                <td className="row-actions">
                  {confirmingId === e.id ? (
                    <>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(e.id)}
                        data-testid={`confirm-delete-${e.id}`}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setConfirmingId(null)}
                        data-testid={`cancel-delete-${e.id}`}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setSuccess('');
                          setEditing(e);
                        }}
                        data-testid={`edit-button-${e.id}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => setConfirmingId(e.id)}
                        data-testid={`delete-button-${e.id}`}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>
                <span data-testid="expense-count">{expenses.length}</span> expenses
              </td>
              <td className="num" data-testid="expense-total">
                {currency.format(total)}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      )}
    </main>
  );
}
