const nodemailer = require('nodemailer');
const db = require('../database/db');

const PERMIT_LABELS = {
  building: 'Building Permit',
  electrical: 'Electrical Permit',
  occupancy: 'Occupancy Permit',
  annual_inspection: 'Certificate of Annual Inspection',
  certificate: 'Certificate',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
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
  const host = (process.env.SMTP_HOST || getSetting('smtp_host')).trim();
  const port = Number(process.env.SMTP_PORT || getSetting('smtp_port') || 587);
  const secureRaw = process.env.SMTP_SECURE || getSetting('smtp_secure') || '';
  const secure = secureRaw === 'true' || secureRaw === '1' || port === 465;
  const user = (process.env.SMTP_USER || getSetting('smtp_user')).trim();
  const pass = (process.env.SMTP_PASS || getSetting('smtp_pass')).trim();
  const from = (process.env.SMTP_FROM || getSetting('smtp_from') || user).trim();

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
      port: cfg.port || 587,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
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

/**
 * Send an email notification to the client when a permit is approved or rejected.
 * Never throws; returns { sent, to, error } so workflow endpoints remain reliable.
 */
async function sendPermitDecisionEmail({
  to,
  clientName,
  applicationNo,
  permitType,
  decision,
  remarks = '',
  totalFee = 0,
  projectLocation = '',
  office = null,
}) {
  const recipient = String(to || '').trim();
  if (!isValidEmail(recipient)) {
    return { sent: false, to: recipient, error: 'Client has no valid email address on file.' };
  }

  const mailCtx = createTransporter();
  if (!mailCtx) {
    console.warn(`[mailer] SMTP not configured. Skipped ${decision} email for ${applicationNo} (${recipient}).`);
    return { sent: false, to: recipient, error: 'SMTP is not configured in Settings.' };
  }

  const officeName = office?.office_name || 'Office of the Municipal Engineer / Building Official';
  const municipality = office?.municipality || 'Municipality of Gumaca, Quezon';
  const permitLabel = PERMIT_LABELS[permitType] || permitType || 'Permit';
  const isApproved = decision === 'approved';

  const subject = isApproved
    ? `Permit Application Approved - ${applicationNo}`
    : `Permit Application Not Approved - ${applicationNo}`;

  const statusHeading = isApproved ? 'APPLICATION APPROVED' : 'APPLICATION NOT APPROVED (REJECTED)';
  const accentColor = isApproved ? '#15803d' : '#b91c1c';
  const accentBg = isApproved ? '#f0fdf4' : '#fef2f2';
  const accentBorder = isApproved ? '#bbf7d0' : '#fecaca';

  const nextStepsText = isApproved
    ? 'Your permit application has been approved by the Municipal Engineer / Building Official. You may now proceed to the Municipal Engineering Office / Municipal Treasurer\'s Office to settle the assessed permit fee and claim your permit.'
    : 'Unfortunately, your permit application was not approved at this time. Please review the remarks below and coordinate with the Municipal Engineering Office to address the items noted.';

  const remarksHtml = remarks
    ? `<div style="margin-top: 16px; padding: 12px 14px; background: #f9fafb; border-left: 4px solid ${accentColor}; border-radius: 4px;">
         <div style="font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; margin-bottom: 4px;">
           ${isApproved ? 'Engineer Remarks' : 'Reason for Rejection'}
         </div>
         <div style="font-size: 14px; color: #111827; white-space: pre-wrap;">${escapeHtml(remarks)}</div>
       </div>`
    : '';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #7f1d1d; color: #ffffff; padding: 20px 24px; text-align: center;">
        <div style="font-size: 12px; letter-spacing: 0.5px; opacity: 0.9;">Republic of the Philippines</div>
        <div style="font-size: 17px; font-weight: 700; margin-top: 2px;">${escapeHtml(municipality)}</div>
        <div style="font-size: 13px; margin-top: 2px; opacity: 0.95;">${escapeHtml(officeName)}</div>
      </div>

      <div style="padding: 24px;">
        <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: ${accentColor}; background: ${accentBg}; border: 1px solid ${accentBorder}; margin-bottom: 16px;">
          ${statusHeading}
        </div>

        <p style="margin: 0 0 12px; font-size: 14px;">Dear <strong>${escapeHtml(clientName || 'Applicant')}</strong>,</p>
        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.55;">${escapeHtml(nextStepsText)}</p>

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
          ${isApproved ? `
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Assessed Fee</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${escapeHtml(formatPhp(totalFee))}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Status</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: ${accentColor};">${isApproved ? 'Approved' : 'Rejected'}</td>
          </tr>
        </table>

        ${remarksHtml}

        <p style="margin: 22px 0 0; font-size: 12.5px; color: #6b7280;">
          This is an automated notification from the ${escapeHtml(officeName)}, ${escapeHtml(municipality)}.
          ${office?.contact_number ? `For inquiries, please contact ${escapeHtml(office.contact_number)}.` : ''}
        </p>
      </div>
    </div>
  `;

  const text = [
    `${municipality} - ${officeName}`,
    '',
    `Status: ${statusHeading}`,
    `Dear ${clientName || 'Applicant'},`,
    '',
    nextStepsText,
    '',
    `Application No.: ${applicationNo}`,
    `Permit Type: ${permitLabel}`,
    `Project Location: ${projectLocation || '-'}`,
    ...(isApproved ? [`Assessed Fee: ${formatPhp(totalFee)}`] : []),
    ...(remarks ? ['', `${isApproved ? 'Remarks' : 'Reason for Rejection'}: ${remarks}`] : []),
  ].join('\n');

  try {
    await mailCtx.transporter.sendMail({
      from: `"${officeName}" <${mailCtx.from}>`,
      to: recipient,
      subject,
      text,
      html,
    });
    return { sent: true, to: recipient };
  } catch (err) {
    console.error(`[mailer] Failed to send ${decision} email to ${recipient}:`, err.message);
    return { sent: false, to: recipient, error: err.message };
  }
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
  await mailCtx.transporter.sendMail({
    from: `"Municipal Engineering Office" <${mailCtx.from}>`,
    to: recipient,
    subject: 'Test Email - Municipal Engineering Office System',
    text: 'This is a test email confirming that Nodemailer SMTP settings are working properly.',
    html: '<p>This is a test email confirming that <strong>Nodemailer SMTP settings</strong> are working properly in the Municipal Engineering Office System.</p>',
  });
  return { sent: true, to: recipient };
}

module.exports = {
  isValidEmail,
  getSmtpConfig,
  isMailerConfigured,
  sendPermitDecisionEmail,
  sendTestEmail,
};
