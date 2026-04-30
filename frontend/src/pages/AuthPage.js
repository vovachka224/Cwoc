import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        await register(form.username, form.displayName, form.password);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🍄</div>
          <h1>Cwoc</h1>
          <p>Fast. Simple. Secure.</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>
            Sign In
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>
            Register
          </button>
        </div>

        <form onSubmit={handle}>
          <div className="field">
            <label>@username</label>
            <input
              type="text"
              placeholder="your_username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          {mode === 'register' && (
            <div className="field">
              <label>Display Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
                required
              />
            </div>
          )}
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
