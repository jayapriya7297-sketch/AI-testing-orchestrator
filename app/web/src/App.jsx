import { useEffect, useState } from 'react';
import { clearSession, getSession, saveSession, setUnauthorizedHandler } from './api.js';
import LoginPage from './pages/LoginPage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';

export default function App() {
  const [session, setSession] = useState(getSession);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setSession(null);
      setNotice('Your session has expired. Please log in again.');
    });
  }, []);

  function handleLogin(newSession) {
    saveSession(newSession);
    setNotice('');
    setSession(newSession);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  return session ? (
    <ExpensesPage user={session.user} onLogout={handleLogout} />
  ) : (
    <LoginPage onLogin={handleLogin} notice={notice} />
  );
}
