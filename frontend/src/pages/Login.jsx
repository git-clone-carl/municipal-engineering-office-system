import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Modal } from '../components/UI';
import bg1 from '../bg/b1.jpg';
import bg2 from '../bg/b2.jpg';
import bg3 from '../bg/b3.jpg';
import bg4 from '../bg/b4.jpg';
import bg5 from '../bg/b5.jpg';
import bg6 from '../bg/b6.jpg';

const BACKGROUNDS = [bg1, bg2, bg3, bg4, bg5, bg6];

export default function Login() {
  const { login, register } = useAuth();

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // General UI state
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: '', username: '', password: '', confirm: '', email: '', contact_number: '', address: '',
  });
  const [registerError, setRegisterError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('remember_user');
    if (saved) { setUsername(saved); setRemember(true); }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setBgIndex((i) => (i + 1) % BACKGROUNDS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await login(username, password);
      if (remember) localStorage.setItem('remember_user', username);
      else localStorage.removeItem('remember_user');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError('');
    if (registerForm.password !== registerForm.confirm) {
      setRegisterError('Passwords do not match');
      return;
    }
    setRegisterLoading(true);
    try {
      await register({
        full_name: registerForm.full_name,
        username: registerForm.username,
        password: registerForm.password,
        email: registerForm.email,
        contact_number: registerForm.contact_number,
        address: registerForm.address,
      });
      setRegisterOpen(false);
    } catch (err) {
      setRegisterError(err.message || 'Registration failed');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        {BACKGROUNDS.map((src, i) => (
          <img key={src} src={src} alt="" className={`login-bg-img ${i === bgIndex ? 'active' : ''}`} />
        ))}
        <div className="login-bg-overlay" />
      </div>

      <div className="login-card" style={{ maxWidth: 440 }}>
        {/* Seamless Header Banner matching gumacalogo.png background 100% */}
        <div className="login-header-banner">
          <img src="/gumacalogo.png" alt="Municipality of Gumaca" className="login-gumaca-banner" />
        </div>

        <div className="login-body">
          <h1>MUNICIPAL ENGINEERING OFFICE</h1>
          <p className="subtitle">Municipality of Gumaca, Quezon • Official Portal</p>

          {error && <div className="login-error">{error}</div>}
          {successMsg && (
            <div className="badge badge-active" style={{ width: '100%', padding: '10px', textAlign: 'center', marginBottom: 16 }}>
              {successMsg}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input
                  className="form-control"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <div className="password-field">
                  <input
                    className="form-control"
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
              <button className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: 8 }} disabled={loading}>
                {loading ? 'Signing in...' : 'SIGN IN'}
              </button>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 0 }}>
                <label htmlFor="remember" className="ui-checkbox-label">
                  <input type="checkbox" id="remember" className="ui-checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember Me</span>
                </label>
                <button
                  type="button"
                  className="terms-link"
                  onClick={() => setTermsOpen(true)}
                >
                  Terms &amp; Services
                </button>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '11px', marginTop: 12 }}
                onClick={() => { setRegisterError(''); setRegisterOpen(true); }}
              >
                Create Client Account
              </button>
            </form>
        </div>
      </div>

      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Create Client Account"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRegisterOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleRegisterSubmit} disabled={registerLoading}>
              {registerLoading ? 'Creating...' : 'Create Account'}
            </button>
          </>
        }
      >
        {registerError && <div className="login-error">{registerError}</div>}
        <p className="page-subtitle" style={{ marginBottom: 12 }}>
          Client accounts can submit permit applications and upload PDF requirements.
          Staff, Engineer and Cashier accounts are created by the System Administrator.
        </p>
        <div className="form-group">
          <label>Full Name *</label>
          <input className="form-control" value={registerForm.full_name} onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Username *</label>
            <input className="form-control" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input className="form-control" value={registerForm.contact_number} onChange={(e) => setRegisterForm({ ...registerForm, contact_number: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Email</label>
          <input className="form-control" type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Address</label>
          <input className="form-control" value={registerForm.address} onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Password * (min. 6 characters)</label>
            <input className="form-control" type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Confirm Password *</label>
            <input className="form-control" type="password" value={registerForm.confirm} onChange={(e) => setRegisterForm({ ...registerForm, confirm: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal open={termsOpen} onClose={() => setTermsOpen(false)} title="Terms of Service & Data Privacy Notice" large>
        <div className="terms-content">
          <h4>1. Terms of Service</h4>
          <p>
            By accessing the Municipal Engineering Office Online Portal of the Municipality of Gumaca, Quezon,
            you agree to use this system solely for official and lawful purposes. Unauthorized access, tampering,
            or misuse of this portal is prohibited and may be subject to applicable laws and administrative sanctions.
          </p>

          <h4>2. Data Privacy Act of 2012 (Republic Act No. 10173)</h4>
          <p>
            The Municipality of Gumaca, through its Municipal Engineering Office, is committed to protecting your
            personal information in accordance with the <strong>Data Privacy Act of 2012 (RA 10173)</strong> and
            its Implementing Rules and Regulations, as supervised by the <strong>National Privacy Commission (NPC)</strong>.
          </p>

          <h4>3. Personal Data Collected</h4>
          <p>
            We collect only personal information necessary for the processing of permit applications, payments,
            and official records &mdash; such as full name, address, contact details, and permit-related documents.
          </p>

          <h4>4. Purpose and Consent</h4>
          <p>
            Your data is processed solely for the legitimate functions of the Municipal Engineering Office.
            By using this portal, you consent to the collection, use, and storage of your personal information
            for these declared purposes only.
          </p>

          <h4>5. Rights of the Data Subject</h4>
          <p>
            Under RA 10173, you have the right to be informed, to access, to object, to rectify or correct,
            to erasure or blocking, to data portability, and to lodge complaints before the National Privacy
            Commission regarding the processing of your personal data.
          </p>

          <h4>6. Security Measures</h4>
          <p>
            We implement appropriate organizational, physical, and technical security measures to safeguard your
            personal information from unauthorized access, disclosure, alteration, or destruction.
          </p>

          <h4>7. Questions or Concerns</h4>
          <p>
            For inquiries or complaints regarding data privacy, you may contact the Municipal Engineering Office
            of Gumaca, Quezon, or file a complaint with the National Privacy Commission.
          </p>
        </div>
      </Modal>
    </div>
  );
}
