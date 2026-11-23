const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const db = require('../database/db');
const { validateEmailFormat, verifyEmailDeliverable } = require('./validation');

const ENV_PATHS = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
];

const LOGO_PATHS = [
  path.join(__dirname, '..', '..', 'frontend', 'public', 'gumacalogo.png'),
  path.join(__dirname, '..', '..', 'frontend', 'gumacalogo.png'),
];

const LOGO_CID = 'gumaca-logo';

function getLogoAttachment() {
  for (const logoPath of LOGO_PATHS) {
    if (fs.existsSync(logoPath)) {
      return {
        filename: 'gumacalogo.png',
        path: logoPath,
        cid: LOGO_CID,
        contentDisposition: 'inline',
      };
    }
  }
  return null;
}

function readDotEnvValues() {
  const merged = {};
  for (const envPath of ENV_PATHS) {
    try {
      if (fs.existsSync(envPath)) {
        const parsed = dotenv.parse(fs.readFileSync(envPath));
        for (const [k, v] of Object.entries(parsed)) {
          if (merged[k] === undefined && v !== '') merged[k] = v;
        }
      }
    } catch {
      /* ignore unreadable .env */
    }
  }
  return merged;
}

const PERMIT_LABELS = {
  building: 'Building Permit',
  electrical: 'Electrical Permit',
  occupancy: 'Occupancy Permit',
  annual_inspection: 'Certificate of Annual Inspection',
  certificate: 'Certificate',
};

function isValidEmail(email) {
  return validateEmailFormat(email).valid;
}

function getSetting(key) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? String(row.value || '').trim() : '';
  } catch {
    return '';
  }
}

function getSmtpConfig() {
  const dbHost = getSetting('smtp_host');
  const dbUser = getSetting('smtp_user');
  const dbPass = getSetting('smtp_pass');
  const useDb = Boolean(dbHost && dbUser && dbPass);
  const envFile = readDotEnvValues();

  const envVal = (key) => String(envFile[key] || process.env[key] || '').trim();

  const host = String(useDb ? dbHost : (envVal('SMTP_HOST') || dbHost || '')).trim();
  const portRaw = Number(useDb ? getSetting('smtp_port') : (envVal('SMTP_PORT') || getSetting('smtp_port') || 587));
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 587;
  const secureRaw = String(
    useDb ? getSetting('smtp_secure') : (envVal('SMTP_SECURE') || getSetting('smtp_secure') || '')
  ).trim().toLowerCase();
  const secure = secureRaw === 'true' || secureRaw === '1' || port === 465;
  const user = String(useDb ? dbUser : (envVal('SMTP_USER') || dbUser || '')).trim();
  const passRaw = String(useDb ? dbPass : (envVal('SMTP_PASS') || dbPass || '')).trim();
  const pass = host.toLowerCase().includes('gmail') ? passRaw.replace(/\s+/g, '') : passRaw;
  const from = String(
    useDb ? (getSetting('smtp_from') || dbUser) : (envVal('SMTP_FROM') || getSetting('smtp_from') || user)
  ).trim();

  return { host, port, secure, user, pass, from };
}

function isMailerConfigured() {
  const cfg = getSmtpConfig();
  return Boolean(cfg.host && cfg.user && cfg.pass);
}

function createTransporter() {
  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return null;
  }
  return {
    transporter: nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    }),
    from: cfg.from || cfg.user,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPhp(amount) {
  return `PHP ${Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'pending' || value === 'submitted') return 'submitted';
  if (value === 'for_review' || value === 'under_review') return 'for_review';
  if (value === 'for_approval' || value === 'pending_approval') return 'for_approval';
  if (value === 'approved') return 'approved';
  if (value === 'rejected' || value === 'disapproved') return 'rejected';
  if (value === 'released') return 'released';
  return 'submitted';
}

function getStatusTemplate(status, applicationNo) {
  switch (status) {
    case 'submitted':
      return {
        subject: `Permit Application Received (Pending) - ${applicationNo}`,
        statusHeading: 'APPLICATION PENDING (SUBMITTED)',
        statusLabel: 'Pending (Submitted)',
        accentColor: '#b45309',
        accentBg: '#fffbeb',
        accentBorder: '#fde68a',
        showFee: true,
        feeLabel: 'Estimated Fee',
        remarksLabel: 'Notes',
        bodyText:
          'Your permit application has been received by the Municipal Engineering Office and is currently pending review. You will receive further email updates as your application progresses.',
      };
    case 'for_review':
      return {
        subject: `Permit Application Under Review (Pending) - ${applicationNo}`,
        statusHeading: 'APPLICATION PENDING (UNDER REVIEW)',
        statusLabel: 'Pending (Under Review)',
        accentColor: '#1d4ed8',
        accentBg: '#eff6ff',
        accentBorder: '#bfdbfe',
        showFee: true,
        feeLabel: 'Assessed Fee',
        remarksLabel: 'Staff Remarks',
        bodyText:
          'Your permit application is now under review by our engineering staff. We will notify you once it is forwarded to the Municipal Engineer / Building Official for approval.',
      };
    case 'for_approval':
      return {
        subject: `Permit Application Pending Approval - ${applicationNo}`,
        statusHeading: 'APPLICATION PENDING APPROVAL',
        statusLabel: 'Pending Approval (For Approval)',
        accentColor: '#b45309',
        accentBg: '#fffbeb',
        accentBorder: '#fde68a',
        showFee: true,
        feeLabel: 'Assessed Fee',
        remarksLabel: 'Remarks',
        bodyText:
          'The initial review of your permit application is complete. Your application has been forwarded to the Municipal Engineer / Building Official and is currently pending final approval.',
      };
    case 'approved':
      return {
        subject: `Permit Application Approved - ${applicationNo}`,
        statusHeading: 'APPLICATION APPROVED',
        statusLabel: 'Approved',
        accentColor: '#15803d',
        accentBg: '#f0fdf4',
        accentBorder: '#bbf7d0',
        showFee: true,
        feeLabel: 'Assessed Fee',
        remarksLabel: 'Engineer Remarks',
        bodyText:
          "Your permit application has been approved by the Municipal Engineer / Building Official. You may now proceed to the Municipal Engineering Office / Municipal Treasurer's Office to settle the assessed permit fee and claim your permit.",
      };
    case 'rejected':
      return {
        subject: `Permit Application Disapproved - ${applicationNo}`,
        statusHeading: 'APPLICATION DISAPPROVED (REJECTED)',
        statusLabel: 'Disapproved (Rejected)',
        accentColor: '#b91c1c',
        accentBg: '#fef2f2',
        accentBorder: '#fecaca',
        showFee: false,
        feeLabel: 'Assessed Fee',
        remarksLabel: 'Reason for Disapproval',
        bodyText:
          'Unfortunately, your permit application was disapproved at this time. Please review the remarks below and coordinate with the Municipal Engineering Office to address the items noted.',
      };
    case 'released':
      return {
        subject: `Permit Released - ${applicationNo}`,
        statusHeading: 'PERMIT RELEASED',
        statusLabel: 'Released',
        accentColor: '#15803d',
        accentBg: '#f0fdf4',
        accentBorder: '#bbf7d0',
        showFee: true,
        feeLabel: 'Total Fee Paid',
        remarksLabel: 'Remarks',
        bodyText:
          'Your permit has been officially released by the Municipal Engineering Office. Thank you for completing the permitting process.',
      };
    default:
      return {
        subject: `Permit Application Update - ${applicationNo}`,
        statusHeading: 'APPLICATION STATUS UPDATE',
        statusLabel: status,
        accentColor: '#374151',
        accentBg: '#f9fafb',
        accentBorder: '#e5e7eb',
        showFee: false,
        feeLabel: 'Assessed Fee',
        remarksLabel: 'Remarks',
        bodyText: 'There is an update regarding your permit application.',
      };
  }
}

/**
 * Send an email notification to the client whenever a permit is pending
 * (submitted, under review, or pending approval), approved, disapproved/rejected, or released.
 * Never throws; returns { sent, to, messageId, error } so workflow endpoints remain reliable.
 */
async function sendPermitStatusEmail({
  to,
  clientName,
  applicationNo,
  permitType,
  status,
  decision,
  remarks = '',
  totalFee = 0,
  projectLocation = '',
  office = null,
}) {
  const recipient = String(to || '').trim();
  const normalizedStatus = normalizeStatus(status || decision);

  if (!isValidEmail(recipient)) {
    return { sent: false, to: recipient, error: 'Client has no valid email address on file.' };
  }

  const mailCtx = createTransporter();
  if (!mailCtx) {
    console.warn(`[mailer] SMTP not configured. Skipped ${normalizedStatus} email for ${applicationNo} (${recipient}).`);
    return { sent: false, to: recipient, error: 'SMTP is not configured in Settings or .env.' };
  }

  const officeName = office?.office_name || 'Office of the Municipal Engineer / Building Official';
  const safeOfficeName = String(officeName).replace(/["\r\n]/g, '');
  const municipality = office?.municipality || 'Municipality of Gumaca, Quezon';
  const permitLabel = PERMIT_LABELS[permitType] || permitType || 'Permit';
  const tpl = getStatusTemplate(normalizedStatus, applicationNo);
  const logoAttachment = getLogoAttachment();
  const headerContentHtml = logoAttachment
    ? `<img src="cid:${LOGO_CID}" alt="Municipality of Gumaca - ${escapeHtml(officeName)}" style="display: block; margin: 0 auto; max-height: 64px; width: auto; max-width: 100%; border: 0;" />`
    : `<div style="font-size: 12px; letter-spacing: 0.5px; opacity: 0.9;">Republic of the Philippines</div>
       <div style="font-size: 17px; font-weight: 700; margin-top: 2px;">${escapeHtml(municipality)}</div>
       <div style="font-size: 13px; margin-top: 2px; opacity: 0.95;">${escapeHtml(officeName)}</div>`;

  const remarksHtml = remarks
    ? `<div style="margin-top: 16px; padding: 12px 14px; background: #f9fafb; border-left: 4px solid ${tpl.accentColor}; border-radius: 4px;">
         <div style="font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; margin-bottom: 4px;">
           ${escapeHtml(tpl.remarksLabel)}
         </div>
         <div style="font-size: 14px; color: #111827; white-space: pre-wrap;">${escapeHtml(remarks)}</div>
       </div>`
    : '';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #7f1d1d; color: #ffffff; padding: 18px 24px; text-align: center;">
        ${headerContentHtml}
      </div>

      <div style="padding: 24px;">
        <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: ${tpl.accentColor}; background: ${tpl.accentBg}; border: 1px solid ${tpl.accentBorder}; margin-bottom: 16px;">
          ${escapeHtml(tpl.statusHeading)}
        </div>

        <p style="margin: 0 0 12px; font-size: 14px;">Dear <strong>${escapeHtml(clientName || 'Applicant')}</strong>,</p>
        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.55;">${escapeHtml(tpl.bodyText)}</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; margin-bottom: 8px;">
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 42%;">Application No.</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${escapeHtml(applicationNo)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Permit Type</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(permitLabel)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Project Location</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(projectLocation || '-')}</td>
          </tr>
          ${tpl.showFee ? `
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${escapeHtml(tpl.feeLabel)}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${escapeHtml(formatPhp(totalFee))}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Status</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: ${tpl.accentColor};">${escapeHtml(tpl.statusLabel)}</td>
          </tr>
        </table>

        ${remarksHtml}

        <p style="margin: 22px 0 0; font-size: 12.5px; color: #6b7280;">
          This is an automated notification from the ${escapeHtml(officeName)}, ${escapeHtml(municipality)}.
        </p>
      </div>
    </div>
  `;

  const text = [
    `${municipality} - ${officeName}`,
    '',
    `Status: ${tpl.statusHeading}`,
    `Dear ${clientName || 'Applicant'},`,
    '',
    tpl.bodyText,
    '',
    `Application No.: ${applicationNo}`,
    `Permit Type: ${permitLabel}`,
    `Project Location: ${projectLocation || '-'}`,
    ...(tpl.showFee ? [`${tpl.feeLabel}: ${formatPhp(totalFee)}`] : []),
    `Current Status: ${tpl.statusLabel}`,
    ...(remarks ? ['', `${tpl.remarksLabel}: ${remarks}`] : []),
  ].join('\n');

  try {
    const info = await mailCtx.transporter.sendMail({
      from: `"${safeOfficeName}" <${mailCtx.from}>`,
      to: recipient,
      subject: tpl.subject,
      text,
      html,
      ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
    });
    console.log(`[mailer] Sent ${normalizedStatus} email for ${applicationNo} to ${recipient} (messageId: ${info.messageId})`);
    return { sent: true, to: recipient, messageId: info.messageId || null };
  } catch (err) {
    console.error(`[mailer] Failed to send ${normalizedStatus} email to ${recipient}:`, err.message);
    return { sent: false, to: recipient, error: err.message };
  }
}

/** Backwards-compatible wrapper for approve/reject callers. */
async function sendPermitDecisionEmail(params) {
  return sendPermitStatusEmail({
    ...params,
    status: params?.status || params?.decision,
  });
}

async function sendTestEmail(to) {
  const recipient = String(to || '').trim();
  if (!isValidEmail(recipient)) {
    throw new Error('Please provide a valid recipient email address.');
  }
  const mailCtx = createTransporter();
  if (!mailCtx) {
    throw new Error('SMTP is not configured. Please fill in SMTP Host, Username, and Password first.');
  }
  const logoAttachment = getLogoAttachment();
  const logoHtml = logoAttachment
    ? `<div style="background: #7f1d1d; padding: 14px 20px; text-align: center; border-radius: 6px; margin-bottom: 14px;"><img src="cid:${LOGO_CID}" alt="Municipality of Gumaca" style="display: block; margin: 0 auto; max-height: 52px; width: auto; max-width: 100%; border: 0;" /></div>`
    : '';
  const info = await mailCtx.transporter.sendMail({
    from: `"Municipal Engineering Office" <${mailCtx.from}>`,
    to: recipient,
    subject: 'Test Email - Municipal Engineering Office System',
    text: 'This is a test email confirming that Nodemailer SMTP settings are working properly.',
    html: `${logoHtml}<p>This is a test email confirming that <strong>Nodemailer SMTP settings</strong> are working properly in the Municipal Engineering Office System.</p>`,
    ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
  });
  return { sent: true, to: recipient, messageId: info.messageId || null };
}

const verificationCodes = new Map();

function pruneExpiredCodes() {
  const now = Date.now();
  for (const [key, entry] of verificationCodes.entries()) {
    if (entry.expiresAt < now) {
      verificationCodes.delete(key);
    }
  }
}

async function sendEmailVerificationCode(email) {
  const check = await verifyEmailDeliverable(email);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid email address.');
  }

  const mailCtx = createTransporter();
  if (!mailCtx) {
    throw new Error('SMTP is not configured on the server. Email format and domain were checked, but a verification email cannot be sent yet.');
  }

  pruneExpiredCodes();
  const key = check.email;
  const existing = verificationCodes.get(key);
  if (existing && existing.lastSentAt && Date.now() - existing.lastSentAt < 30 * 1000) {
    throw new Error('Please wait 30 seconds before requesting another verification code.');
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const logoAttachment = getLogoAttachment();
  const logoHtml = logoAttachment
    ? `<div style="background: #7f1d1d; padding: 14px 20px; text-align: center; border-radius: 6px; margin-bottom: 14px;"><img src="cid:${LOGO_CID}" alt="Municipality of Gumaca" style="display: block; margin: 0 auto; max-height: 52px; width: auto; max-width: 100%; border: 0;" /></div>`
    : '';

  await mailCtx.transporter.sendMail({
    from: `"Municipal Engineering Office" <${mailCtx.from}>`,
    to: key,
    subject: 'Email Verification Code - Municipal Engineering Office',
    text: `Your Municipal Engineering Office email verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 480px;">
        ${logoHtml}
        <h2 style="margin: 0 0 8px; color: #7f1d1d;">Email Verification</h2>
        <p style="margin: 0 0 14px;">Use this 6-digit code to verify your email address for your permit application:</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px 16px; background: #f3f4f6; border-radius: 8px; text-align: center; color: #111827; margin-bottom: 14px;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      </div>
    `,
    ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
  });

  verificationCodes.set(key, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    lastSentAt: Date.now(),
    attempts: 0,
    verified: false,
  });

  return { sent: true, to: key };
}

function verifyEmailVerificationCode(email, code) {
  const format = validateEmailFormat(email);
  if (!format.valid) {
    return { verified: false, error: format.error };
  }
  const key = format.email;
  const entry = verificationCodes.get(key);
  if (!entry) {
    return { verified: false, error: 'No verification code found for this email. Please send a new code.' };
  }
  if (Date.now() > entry.expiresAt) {
    verificationCodes.delete(key);
    return { verified: false, error: 'Verification code has expired. Please request a new code.' };
  }
  entry.attempts += 1;
  if (entry.attempts > 5) {
    verificationCodes.delete(key);
    return { verified: false, error: 'Too many invalid attempts. Please request a new code.' };
  }
  if (String(code || '').trim() !== entry.code) {
    return { verified: false, error: 'Incorrect verification code. Please check your inbox and try again.' };
  }
  entry.verified = true;
  return { verified: true, email: key };
}

module.exports = {
  isValidEmail,
  getSmtpConfig,
  isMailerConfigured,
  sendPermitStatusEmail,
  sendPermitDecisionEmail,
  sendTestEmail,
  sendEmailVerificationCode,
  verifyEmailVerificationCode,
};
