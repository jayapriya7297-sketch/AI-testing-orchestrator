import { useState } from 'react';
import { api } from '../api.js';

export default function LoginPage({ onLogin, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      onLogin(await api.login(email, password));
    } catch (err) {
      setError(err.details.length ? err.details.map((d) => d.message).join('. ') : err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <h1>Expense Manager</h1>
      <form onSubmit={handleSubmit} noValidate data-testid="login-form">
        {notice && (
          <p className="message info" role="status" data-testid="login-notice">
            {notice}
          </p>
        )}
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="login-email"
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="login-password"
        />
        {error && (
          <p className="message error" role="alert" data-testid="login-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} data-testid="login-submit">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
