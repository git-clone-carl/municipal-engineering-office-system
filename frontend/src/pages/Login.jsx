import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const SLIDESHOW_IMAGES = Array.from({ length: 12 }, (_, i) => `/slideshow/${i + 1}.jpg`);

export default function Login() {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('remember_user');
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex((i) => (i + 1) % SLIDESHOW_IMAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(username.trim(), password);
      if (remember) localStorage.setItem('remember_user', username.trim());
      else localStorage.removeItem('remember_user');
    } catch (err) {
      setLoginError(err.message || 'Invalid username or password');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="fb-login-page">
      <div className="login-bg">
        {SLIDESHOW_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`login-bg-img ${i === bgIndex ? 'active' : ''}`}
          />
        ))}
        <div className="login-bg-overlay" />
      </div>

      <div className="fb-login-centered">
        {/* Centered Logo Only */}
        <div className="fb-centered-brand">
          <img src="/gumacalogo.png" alt="Municipality of Gumaca" className="fb-meo-logo-centered" />
        </div>

        {/* Unified Login Card */}
        <div className="fb-login-card-wrap">
          <div className="fb-login-card">
            <form onSubmit={handleLoginSubmit}>
              {loginError && <div className="login-error">{loginError}</div>}
              <div className="form-group">
                <label>Username</label>
                <input
                  className="form-control fb-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <div className="password-field">
                  <input
                    className="form-control fb-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <label htmlFor="remember" className="ui-checkbox-label" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    id="remember"
                    className="ui-checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Remember Me</span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary fb-login-btn"
                disabled={loginLoading}
              >
                {loginLoading ? 'Logging in...' : 'Log In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
