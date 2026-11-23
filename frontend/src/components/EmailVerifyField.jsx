import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { filterEmailInput, validateEmailFormat } from '../utils/validation';

export default function EmailVerifyField({
  label = 'Email Address *',
  value,
  onChange,
  placeholder = 'name@gmail.com',
  required = true,
}) {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(null); // { valid, message, suggestion, mxChecked, smtpConfigured }
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');

  const normalized = String(value || '').trim().toLowerCase();
  const isOtpVerified = Boolean(normalized && verifiedEmail === normalized);

  useEffect(() => {
    if (!normalized) {
      setStatus(null);
      setCodeSent(false);
      setCodeInput('');
      return;
    }
    if (verifiedEmail && verifiedEmail !== normalized) {
      setVerifiedEmail('');
    }
    setCodeSent(false);
    setCodeInput('');
  }, [normalized, verifiedEmail]);

  const runCheck = async (target = value) => {
    const clean = String(target || '').trim();
    if (!clean) {
      setStatus(null);
      return null;
    }
    const local = validateEmailFormat(clean);
    if (!local.valid) {
      const next = { valid: false, message: local.error, suggestion: local.suggestion };
      setStatus(next);
      return next;
    }
    setChecking(true);
    try {
      const res = await api.validateEmail(clean);
      const next = {
        valid: Boolean(res.valid),
        message: res.valid
          ? (res.mxChecked ? 'Email format & mail server verified.' : (res.warning || 'Email format is valid.'))
          : res.error,
        suggestion: res.suggestion,
        mxChecked: res.mxChecked,
        smtpConfigured: res.smtpConfigured,
      };
      setStatus(next);
      return next;
    } catch (err) {
      const next = { valid: false, message: err.message || 'Unable to validate email.' };
      setStatus(next);
      return next;
    } finally {
      setChecking(false);
    }
  };

  const handleSendCode = async () => {
    const check = await runCheck(value);
    if (!check?.valid) return;
    setSendingCode(true);
    try {
      await api.sendEmailCode(value);
      setCodeSent(true);
      setStatus((prev) => ({
        ...(prev || { valid: true }),
        message: `Verification code sent to ${normalized}. Check your inbox.`,
      }));
    } catch (err) {
      setStatus({
        valid: check.valid,
        message: err.message || 'Could not send verification code.',
        smtpConfigured: check.smtpConfigured,
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirmCode = async () => {
    if (codeInput.trim().length !== 6) {
      setStatus((prev) => ({ ...(prev || {}), valid: false, message: 'Enter the 6-digit verification code.' }));
      return;
    }
    setVerifyingCode(true);
    try {
      const res = await api.verifyEmailCode(value, codeInput.trim());
      if (res.verified) {
        setVerifiedEmail(normalized);
        setCodeSent(false);
        setCodeInput('');
        setStatus({ valid: true, message: 'Gmail / email inbox verified.' });
      }
    } catch (err) {
      setStatus((prev) => ({ ...(prev || {}), valid: false, message: err.message || 'Invalid verification code.' }));
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <div className="form-group">
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>{label}</span>
        {isOtpVerified && (
          <span className="badge badge-active" style={{ fontSize: 11, padding: '2px 8px' }}>
            Verified
          </span>
        )}
      </label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          className="form-control"
          type="email"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setStatus(null);
            onChange(filterEmailInput(e.target.value));
          }}
          onBlur={() => {
            if (String(value || '').trim()) runCheck(value);
          }}
          required={required}
        />
        {!isOtpVerified && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', padding: '8px 10px', fontSize: 12 }}
            onClick={handleSendCode}
            disabled={checking || sendingCode || !String(value || '').trim()}
            title="Send a 6-digit verification code to confirm this email works"
          >
            {sendingCode ? 'Sending...' : checking ? 'Checking...' : 'Verify'}
          </button>
        )}
      </div>

      {codeSent && !isOtpVerified && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
          <input
            className="form-control"
            style={{ maxWidth: 160 }}
            placeholder="6-digit code"
            maxLength={6}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={handleConfirmCode}
            disabled={verifyingCode}
          >
            {verifyingCode ? 'Checking...' : 'Confirm'}
          </button>
        </div>
      )}

      {status && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: status.valid ? 'var(--green-800, #166534)' : 'var(--red-700, #b91c1c)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span>{status.message}</span>
          {status.suggestion && (
            <button
              type="button"
              onClick={() => {
                onChange(status.suggestion);
                runCheck(status.suggestion);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--primary, #7f1d1d)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Use {status.suggestion}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
