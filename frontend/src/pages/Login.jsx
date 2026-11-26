import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Modal, CustomSelect } from '../components/UI';
import engineeringBg from '../bg/engineering-bg.jpg';

const SIGNUP_ROLE_OPTIONS = [
  { value: 'engineering_staff', label: 'Staff (Engineering Staff)' },
  { value: 'municipal_engineer', label: 'Municipal Engineer' },
  { value: 'admin', label: 'System Administrator' },
];

export default function Login() {
  const { login, register } = useAuth();

  const [signupModalOpen, setSignupModalOpen] = useState(false);

  // Unified Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Sign up state (role selectable inside Sign Up modal, no email required)
  const [signupForm, setSignupForm] = useState({
    full_name: '',
    role: 'engineering_staff',
    username: '',
    password: '',
    confirm_password: '',
  });
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('remember_user');
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
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

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');
    const fullName = signupForm.full_name.trim();
    const cleanUser = signupForm.username.trim();
    if (!fullName || !cleanUser || !signupForm.password) {
      setSignupError('Full name, username, and password are required.');
      return;
    }
    if (cleanUser.length < 3) {
      setSignupError('Username must be at least 3 characters.');
      return;
    }
    if (signupForm.password.length < 6) {
      setSignupError('Password must be at least 6 characters.');
      return;
    }
    if (signupForm.password !== signupForm.confirm_password) {
      setSignupError('Passwords do not match.');
      return;
    }

    setSignupLoading(true);
    try {
      await register({
        full_name: fullName,
        username: cleanUser,
        password: signupForm.password,
        role: signupForm.role,
      });
    } catch (err) {
      setSignupError(err.message || 'Sign up failed');
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="fb-login-page">
      <div className="login-bg">
        <img src={engineeringBg} alt="" className="login-bg-img active" />
        <div className="login-bg-overlay" />
      </div>

      <div className="fb-login-centered">
        {/* Centered Logo & Title */}
        <div className="fb-centered-brand">
          <img src="/gumacalogo.png" alt="MEO Logo" className="fb-meo-logo-centered" />
          <h1 className="fb-brand-title-centered">Municipal Engineering Office</h1>
          <p className="fb-brand-subtitle-centered">
            Permit Management &amp; Engineering System
          </p>
        </div>

        {/* Single Unified Login Card (FB-style) */}
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
                  >
                    {showPassword ? 'Hide' : 'Show'}
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

              <div className="fb-divider" />

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="btn fb-signup-btn"
                  onClick={() => {
                    setSignupError('');
                    setSignupForm({
                      full_name: '',
                      role: 'engineering_staff',
                      username: '',
                      password: '',
                      confirm_password: '',
                    });
                    setSignupModalOpen(true);
                  }}
                >
                  Create New Account
                </button>
              </div>
            </form>
          </div>
          <p className="fb-login-footer">
            <strong>MEO</strong> &middot; Municipality of Gumaca, Quezon
          </p>
        </div>
      </div>

      {/* Sign Up Modal with Role Selection */}
      <Modal
        open={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
        title="Create New Account"
      >
        <form onSubmit={handleSignupSubmit}>
          {signupError && <div className="login-error">{signupError}</div>}
          <div className="form-group">
            <label>Full Name *</label>
            <input
              className="form-control"
              placeholder="Enter full name"
              value={signupForm.full_name}
              onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Role *</label>
            <CustomSelect
              value={signupForm.role}
              onChange={(val) => setSignupForm({ ...signupForm, role: val })}
              options={SIGNUP_ROLE_OPTIONS}
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label>Username *</label>
            <input
              className="form-control"
              placeholder="Choose a username"
              value={signupForm.username}
              onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input
              className="form-control"
              type="password"
              placeholder="At least 6 characters"
              value={signupForm.password}
              onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              className="form-control"
              type="password"
              placeholder="Re-enter password"
              value={signupForm.confirm_password}
              onChange={(e) => setSignupForm({ ...signupForm, confirm_password: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSignupModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn fb-signup-btn" disabled={signupLoading}>
              {signupLoading ? 'Creating account...' : 'Sign Up'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
