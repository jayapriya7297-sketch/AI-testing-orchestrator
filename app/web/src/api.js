const TOKEN_KEY = 'expense_token';
const USER_KEY = 'expense_user';

export const CATEGORIES = ['Food', 'Travel', 'Office', 'Utilities', 'Entertainment', 'Other'];

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error) || `Request failed (${status})`);
    this.status = status;
    this.details = (body && body.details) || [];
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  return token && user ? { token, user: JSON.parse(user) } : null;
}

export function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data);
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  listExpenses: (category) =>
    request(`/expenses${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  createExpense: (expense) => request('/expenses', { method: 'POST', body: expense }),
  updateExpense: (id, expense) => request(`/expenses/${id}`, { method: 'PUT', body: expense }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
  exportExpenses: (category) =>
    request(`/expenses/export${category ? `?category=${encodeURIComponent(category)}` : ''}`, {
      raw: true,
    }).then((res) => res.blob()),
  importExpenses: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/expenses/import', { method: 'POST', body: form });
  },
};
