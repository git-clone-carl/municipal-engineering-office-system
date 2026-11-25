import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/UI';
import bg1 from '../bg/b1.jpg';
import bg2 from '../bg/b2.jpg';
import bg3 from '../bg/b3.jpg';
import bg4 from '../bg/b4.jpg';
import bg5 from '../bg/b5.jpg';
import bg6 from '../bg/b6.jpg';

const BACKGROUNDS = [bg1, bg2, bg3, bg4, bg5, bg6];

const ROLES = [
  { key: 'engineering_staff', label: 'Staff', title: 'Engineering Staff' },
  { key: 'municipal_engineer', label: 'Engr.', title: 'Municipal Engineer' },
  { key: 'admin', label: 'Admin', title: 'System Administrator' },
];

export default function Login() {
  const { login, register } = useAuth();

  const [selectedRole, setSelectedRole] = useState('engineering_staff');
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [signupModalOpen, setSignupModalOpen] = useState(false);

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Sign up state (no email required)
  const [signupForm, setSignupForm] = useState({
    full_name: '',
    username: '',
    password: '',
    confirm_password: '',
  });
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('remember_user');
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setBgIndex((i) => (i + 1) % BACKGROUNDS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleRoleChange = (roleKey) => {
    setSelectedRole(roleKey);
    setAuthMode('login');
    setLoginError('');
    setSignupError('');
  };

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
        role: selectedRole,
      });
    } catch (err) {
      setSignupError(err.message || 'Sign up failed');
    } finally {
      setSignupLoading(false);
    }
  };

  const activeRoleObj = ROLES.find((r) => r.key === selectedRole) || ROLES[0];
  const isStaff = selectedRole === 'engineering_staff';

  const renderSignupFields = () => (
    <>
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
    </>
  );

  return (
    <div className="fb-login-page">
      <div className="login-bg">
        {BACKGROUNDS.map((src, i) => (
          <img key={src} src={src} alt="" className={`login-bg-img ${i === bgIndex ? 'active' : ''}`} />
        ))}
        <div className="login-bg-overlay" />
      </div>

      <div className="fb-login-container">
        {/* Left Branding Column with MEO Logo */}
        <div className="fb-login-brand">
          <img src="/gumacalogo.png" alt="MEO Logo" className="fb-meo-logo" />
          <div className="fb-brand-badge">Official Engineering Portal</div>
          <h1 className="fb-brand-title">Municipal Engineering Office</h1>
          <p className="fb-brand-subtitle">
            Streamlined permit applications, PDF document review, and real-time engineering approvals.
          </p>
          <div className="fb-brand-highlights">
            <span>Permit Processing</span>
            <span>PDF Review &amp; Archive</span>
            <span>Real-Time Updates</span>
          </div>
        </div>

        {/* Right Login Card Column */}
        <div className="fb-login-card-wrap">
          <div className="fb-login-card">
            <div className="fb-card-header">
              <h2>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
              <p>{activeRoleObj.title}</p>
            </div>

            {/* Role Tabs: Staff | Engr. | Admin */}
            <div className="fb-role-tabs" role="tablist" aria-label="Account Role">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  aria-selected={selectedRole === r.key}
                  className={`fb-role-tab ${selectedRole === r.key ? 'active' : ''}`}
                  onClick={() => handleRoleChange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* For Engr. and Admin: Show both Log In and Sign Up toggles */}
            {!isStaff && (
              <div className="fb-auth-toggle">
                <button
                  type="button"
                  className={`fb-auth-toggle-btn ${authMode === 'login' ? 'active' : ''}`}
                  onClick={() => { setAuthMode('login'); setSignupError(''); }}
                >
                  Log In
                </button>
                <button
                  type="button"
                  className={`fb-auth-toggle-btn ${authMode === 'signup' ? 'active' : ''}`}
                  onClick={() => { setAuthMode('signup'); setLoginError(''); }}
                >
                  Sign Up
                </button>
              </div>
            )}

            {authMode === 'login' ? (
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

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
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

                {/* For Staff: Sign Up button at the bottom like Facebook */}
                {isStaff && (
                  <>
                    <div className="fb-divider" />
                    <div style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn fb-signup-btn"
                        onClick={() => {
                          setSignupError('');
                          setSignupForm({ full_name: '', username: '', password: '', confirm_password: '' });
                          setSignupModalOpen(true);
                        }}
                      >
                        Sign Up
                      </button>
                    </div>
                  </>
                )}
              </form>
            ) : (
              <form onSubmit={handleSignupSubmit}>
                {renderSignupFields()}
                <button
                  type="submit"
                  className="btn fb-signup-btn"
                  style={{ width: '100%' }}
                  disabled={signupLoading}
                >
                  {signupLoading ? 'Creating account...' : `Sign Up as ${activeRoleObj.label}`}
                </button>
              </form>
            )}
          </div>
          <p className="fb-login-footer">
            <strong>MEO</strong> &middot; Municipal Engineering Office System
          </p>
        </div>
      </div>

      {/* Staff Sign Up Modal (triggered from Sign Up button at the bottom of Staff Login) */}
      <Modal
        open={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
        title="Sign Up — Engineering Staff"
      >
        <form onSubmit={handleSignupSubmit}>
          {renderSignupFields()}
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
