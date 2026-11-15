import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  Modal, CustomSelect, CustomDatePicker, Icon,
  PERMIT_TYPES, formatCurrency, formatFileSize,
} from '../components/UI';
import bg1 from '../bg/b1.jpg';
import bg2 from '../bg/b2.jpg';
import bg3 from '../bg/b3.jpg';
import bg4 from '../bg/b4.jpg';
import bg5 from '../bg/b5.jpg';
import bg6 from '../bg/b6.jpg';

const BACKGROUNDS = [bg1, bg2, bg3, bg4, bg5, bg6];

const FALLBACK_REQUIREMENTS = {
  building: [
    'Certified True Copy of Title',
    'Tax Declaration',
    'Building Plans (Signed & Sealed)',
    'Bill of Materials',
    'Barangay Clearance',
    'Occupancy Permit Application',
  ],
  electrical: ['Electrical Plans', 'Load Computation', 'Tax Declaration', 'Barangay Clearance'],
  occupancy: ['Building Permit', 'Certificate of Completion', 'Fire Safety Certificate', 'Tax Declaration'],
  locational: ['Lot Plan', 'Tax Declaration', 'Barangay Clearance', 'Zoning Clearance'],
  certificate: ['Application Form', 'Valid ID', 'Tax Declaration'],
};

const FORM_STEPS = ['Applicant & Permit Details', 'Upload Requirements', 'Review & Submit'];

const createEmptyClientForm = () => ({
  full_name: '',
  contact_number: '',
  email: '',
  address: '',
  permit_type: 'building',
  application_date: new Date().toISOString().split('T')[0],
  project_location: '',
  nature_of_construction: '',
  building_type: '',
  total_floor_area: '',
  num_storeys: 1,
  notes: '',
});

export default function Login() {
  const { login } = useAuth();

  // Client application form state
  const [step, setStep] = useState(0);
  const [clientForm, setClientForm] = useState(createEmptyClientForm);
  const [requirementsMap, setRequirementsMap] = useState(FALLBACK_REQUIREMENTS);
  const [requirementFiles, setRequirementFiles] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);

  // Staff login modal state (triggered from subtle left button)
  const [staffLoginOpen, setStaffLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [termsOpen, setTermsOpen] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('remember_user');
    if (saved) { setUsername(saved); setRemember(true); }
  }, []);

  useEffect(() => {
    api.getPublicRequirements()
      .then((res) => {
        if (res?.requirements) setRequirementsMap(res.requirements);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setBgIndex((i) => (i + 1) % BACKGROUNDS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const requiredDocs = requirementsMap[clientForm.permit_type] || FALLBACK_REQUIREMENTS[clientForm.permit_type] || [];

  const handleReqFileChange = (reqName, file) => {
    setFormError('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFormError(`"${file.name}" is not a PDF file. Only PDF files are allowed.`);
      return;
    }
    setRequirementFiles((prev) => ({ ...prev, [reqName]: file }));
  };

  const handleNextStep = () => {
    setFormError('');
    if (step === 0) {
      if (!clientForm.full_name.trim() || !clientForm.contact_number.trim() || !clientForm.address.trim()) {
        setFormError('Please fill in your Full Name, Contact Number, and Address.');
        return;
      }
      if (!clientForm.project_location.trim()) {
        setFormError('Please enter the Project Location.');
        return;
      }
    }
    if (step === 1) {
      const missing = requiredDocs.filter((r) => !requirementFiles[r]);
      if (missing.length > 0) {
        setFormError(`You cannot proceed without uploading all required PDF documents. Missing: ${missing.join(', ')}`);
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleClientSubmit = async () => {
    setFormError('');
    const missing = requiredDocs.filter((r) => !requirementFiles[r]);
    if (missing.length > 0) {
      setFormError(`Please upload all required PDF documents. Missing: ${missing.join(', ')}`);
      setStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(clientForm).forEach(([k, v]) => fd.append(k, String(v ?? '')));
      fd.append('requirement_names', JSON.stringify(requiredDocs));
      requiredDocs.forEach((reqName) => {
        fd.append('files', requirementFiles[reqName]);
      });

      const result = await api.submitPublicApplication(fd);
      setSubmittedResult(result);
    } catch (err) {
      setFormError(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const resetClientForm = () => {
    setClientForm(createEmptyClientForm());
    setRequirementFiles({});
    setFormError('');
    setSubmittedResult(null);
    setStep(0);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(username, password);
      if (remember) localStorage.setItem('remember_user', username);
      else localStorage.removeItem('remember_user');
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ padding: '24px 16px' }}>
      <div className="login-bg">
        {BACKGROUNDS.map((src, i) => (
          <img key={src} src={src} alt="" className={`login-bg-img ${i === bgIndex ? 'active' : ''}`} />
        ))}
        <div className="login-bg-overlay" />
      </div>

      {/* Subtle hidden staff login button on the left */}
      <button
        type="button"
        onClick={() => { setLoginError(''); setStaffLoginOpen(true); }}
        title="Staff Login"
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: 30,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 11px',
          borderRadius: 999,
          border: '1px solid rgba(255, 255, 255, 0.22)',
          background: 'rgba(17, 24, 39, 0.35)',
          backdropFilter: 'blur(6px)',
          color: 'rgba(255, 255, 255, 0.72)',
          fontSize: 11.5,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: 0.45,
          transition: 'opacity 0.2s ease, background 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(17, 24, 39, 0.75)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.45'; e.currentTarget.style.background = 'rgba(17, 24, 39, 0.35)'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>Staff</span>
      </button>

      <div className="login-card" style={{ maxWidth: 760, width: '100%' }}>
        <div className="login-header-banner">
          <img src="/gumacalogo.png" alt="Municipality of Gumaca" className="login-gumaca-banner" />
        </div>

        <div className="login-body" style={{ padding: '24px 28px' }}>
          <h1>MUNICIPAL ENGINEERING OFFICE</h1>
          <p className="subtitle" style={{ marginBottom: 18 }}>
            Municipality of Gumaca, Quezon • Client Permit Application Form
          </p>

          {submittedResult ? (
            <div style={{ textAlign: 'center', padding: '12px 4px' }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(22, 163, 74, 0.14)', color: 'var(--green-800)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                }}
              >
                <Icon name="check" size={28} />
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Application Submitted!</h2>
              <p className="page-subtitle" style={{ marginBottom: 18 }}>
                Your permit application and required PDF documents have been received by the Municipal Engineering Office.
              </p>

              <div
                style={{
                  textAlign: 'left',
                  padding: 16,
                  borderRadius: 'var(--radius-subcard)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-subcard)',
                  marginBottom: 18,
                }}
              >
                <div className="doc-field"><span className="label">Application No.</span><strong>{submittedResult.application_no}</strong></div>
                <div className="doc-field"><span className="label">Client ID</span><span>{submittedResult.client_code}</span></div>
                <div className="doc-field"><span className="label">Applicant Name</span><span>{submittedResult.client_name}</span></div>
                <div className="doc-field"><span className="label">Permit Type</span><span>{PERMIT_TYPES[submittedResult.permit_type] || submittedResult.permit_type}</span></div>
                <div className="doc-field"><span className="label">Project Location</span><span>{submittedResult.project_location}</span></div>
                <div className="doc-field"><span className="label">Uploaded Requirements</span><span>{submittedResult.uploaded_count} PDF file(s)</span></div>
                <div className="doc-field"><span className="label">Estimated Permit Fee</span><strong>{formatCurrency(submittedResult.total_fee)}</strong></div>
              </div>

              <button type="button" className="btn btn-primary" onClick={resetClientForm}>
                Submit Another Application
              </button>
            </div>
          ) : (
            <>
              <div className="stepper" style={{ marginBottom: 18 }}>
                {FORM_STEPS.map((label, i) => (
                  <div key={label} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                    <div className="step-num">{i + 1}</div>
                    <div className="step-label">{label}</div>
                  </div>
                ))}
              </div>

              {formError && <div className="login-error" style={{ marginBottom: 14 }}>{formError}</div>}

              {step === 0 && (
                <div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        className="form-control"
                        placeholder="e.g. Juan Dela Cruz"
                        value={clientForm.full_name}
                        onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Contact Number *</label>
                      <input
                        className="form-control"
                        placeholder="e.g. 0917-123-4567"
                        value={clientForm.contact_number}
                        onChange={(e) => setClientForm({ ...clientForm, contact_number: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Address *</label>
                      <input
                        className="form-control"
                        placeholder="Barangay, Municipality, Province"
                        value={clientForm.address}
                        onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Email (Optional)</label>
                      <input
                        className="form-control"
                        type="email"
                        placeholder="name@example.com"
                        value={clientForm.email}
                        onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Permit Type *</label>
                      <CustomSelect
                        value={clientForm.permit_type}
                        onChange={(val) => {
                          setClientForm({ ...clientForm, permit_type: val });
                          setRequirementFiles({});
                        }}
                        options={Object.entries(PERMIT_TYPES).map(([key, label]) => ({ value: key, label }))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Application Date</label>
                      <CustomDatePicker
                        value={clientForm.application_date}
                        onChange={(val) => setClientForm({ ...clientForm, application_date: val })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Project Location *</label>
                    <input
                      className="form-control"
                      placeholder="Exact site / barangay of the project"
                      value={clientForm.project_location}
                      onChange={(e) => setClientForm({ ...clientForm, project_location: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Nature of Construction</label>
                      <input
                        className="form-control"
                        placeholder="e.g. New Construction, Renovation"
                        value={clientForm.nature_of_construction}
                        onChange={(e) => setClientForm({ ...clientForm, nature_of_construction: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Building Type</label>
                      <input
                        className="form-control"
                        placeholder="e.g. Residential, Commercial"
                        value={clientForm.building_type}
                        onChange={(e) => setClientForm({ ...clientForm, building_type: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Estimated Floor Area (sq)</label>
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        placeholder="Enter floor area in sq"
                        value={clientForm.total_floor_area}
                        onChange={(e) => setClientForm({ ...clientForm, total_floor_area: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Number of Storeys</label>
                      <input
                        className="form-control"
                        type="number"
                        min="1"
                        value={clientForm.num_storeys}
                        onChange={(e) => setClientForm({ ...clientForm, num_storeys: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Notes / Remarks (Optional)</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={clientForm.notes}
                      onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <p style={{ marginBottom: 12, fontSize: 13.5 }}>
                    Upload all required PDF documents for <strong>{PERMIT_TYPES[clientForm.permit_type]}</strong>. You cannot proceed without uploading every requirement.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {requiredDocs.map((reqName) => {
                      const file = requirementFiles[reqName];
                      return (
                        <div
                          key={reqName}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-subcard)',
                            border: `1px solid ${file ? 'var(--green-600)' : 'var(--border-color)'}`,
                            background: file ? 'rgba(22, 163, 74, 0.06)' : 'var(--bg-subcard)',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{reqName} *</div>
                            <div style={{ fontSize: 12, color: file ? 'var(--green-800)' : 'var(--text-light)' }}>
                              {file ? `Uploaded: ${file.name} (${formatFileSize(file.size)})` : 'Required (PDF only, max 10 MB)'}
                            </div>
                          </div>
                          <label className="btn btn-secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap', margin: 0 }}>
                            <Icon name="upload" size={14} /> {file ? 'Change PDF' : 'Upload PDF'}
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              style={{ display: 'none' }}
                              onChange={(e) => handleReqFileChange(reqName, e.target.files?.[0])}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 'var(--radius-subcard)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-subcard)',
                      marginBottom: 12,
                    }}
                  >
                    <div className="doc-field"><span className="label">Full Name</span><span>{clientForm.full_name}</span></div>
                    <div className="doc-field"><span className="label">Contact Number</span><span>{clientForm.contact_number}</span></div>
                    <div className="doc-field"><span className="label">Address</span><span>{clientForm.address}</span></div>
                    <div className="doc-field"><span className="label">Permit Type</span><span>{PERMIT_TYPES[clientForm.permit_type]}</span></div>
                    <div className="doc-field"><span className="label">Project Location</span><span>{clientForm.project_location}</span></div>
                    <div className="doc-field">
                      <span className="label">Estimated Floor Area (sq)</span>
                      <span>{clientForm.total_floor_area ? `${clientForm.total_floor_area} sq` : '-'}</span>
                    </div>
                    <div className="doc-field"><span className="label">Number of Storeys</span><span>{clientForm.num_storeys || 1}</span></div>
                  </div>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 'var(--radius-subcard)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-subcard)',
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Uploaded Requirements ({requiredDocs.length})</strong>
                    {requiredDocs.map((reqName) => (
                      <div key={reqName} className="doc-field">
                        <span className="label">{reqName}</span>
                        <span>{requirementFiles[reqName]?.name || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 10 }}>
                <button type="button" className="terms-link" onClick={() => setTermsOpen(true)}>
                  Terms &amp; Services
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  {step > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setFormError(''); setStep((s) => s - 1); }}
                      disabled={submitting}
                    >
                      Back
                    </button>
                  )}
                  {step < FORM_STEPS.length - 1 ? (
                    <button type="button" className="btn btn-primary" onClick={handleNextStep}>
                      Next
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={handleClientSubmit} disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Staff Login Modal */}
      <Modal
        open={staffLoginOpen}
        onClose={() => setStaffLoginOpen(false)}
        title="Staff & Official Login"
      >
        {loginError && <div className="login-error">{loginError}</div>}
        <form onSubmit={handleLoginSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              className="form-control"
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
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label htmlFor="remember" className="ui-checkbox-label">
              <input type="checkbox" id="remember" className="ui-checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember Me</span>
            </label>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', padding: '11px' }} disabled={loginLoading}>
            {loginLoading ? 'Signing in...' : 'SIGN IN TO DASHBOARD'}
          </button>
        </form>
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
