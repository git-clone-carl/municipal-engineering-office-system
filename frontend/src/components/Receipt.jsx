import {
  Icon, PERMIT_TYPES, formatCurrency, formatDateTime,
  printDocumentHtml, buildFormalHeaderHtml, escapeHtml,
} from './UI';

/**
 * Official receipt layout. Printing uses a standalone formal HTML document
 * via printDocumentHtml so the website chrome never clips or splits the receipt.
 */
export default function Receipt({ data }) {
  if (!data?.payment) return null;
  const { payment, office } = data;

  const permitLabel = PERMIT_TYPES[payment.permit_type] || payment.permit_type;
  const paymentFor = `${permitLabel} fees${payment.project_location ? ` - ${payment.project_location}` : ''}`;
  const paymentMethod = String(payment.payment_method || 'cash').replace(/_/g, ' ').toUpperCase();
  const appStatus = String(payment.permit_status || '').replace(/_/g, ' ').toUpperCase();

  const handlePrint = () => {
    const headerHtml = buildFormalHeaderHtml({
      office,
      title: 'OFFICIAL RECEIPT',
    });

    const bodyHtml = `
      <div class="receipt-box">
        ${headerHtml}
        <div class="meta-row">
          <div>
            <span class="meta-label">OR Number</span>
            <span class="meta-val">${escapeHtml(payment.or_number)}</span>
          </div>
          <div style="text-align: right;">
            <span class="meta-label">Date &amp; Time</span>
            <span class="meta-val">${escapeHtml(formatDateTime(payment.payment_date))}</span>
          </div>
        </div>

        <table class="kv-table">
          <tr><td class="kv-key">Received From</td><td class="kv-val"><strong>${escapeHtml(payment.client_name)}</strong></td></tr>
          <tr><td class="kv-key">Address</td><td class="kv-val">${escapeHtml(payment.address || '-')}</td></tr>
          <tr><td class="kv-key">Application No.</td><td class="kv-val">${escapeHtml(payment.application_no)}</td></tr>
          <tr><td class="kv-key">Permit / Application</td><td class="kv-val">${escapeHtml(permitLabel)}</td></tr>
          <tr><td class="kv-key">Payment For</td><td class="kv-val">${escapeHtml(paymentFor)}</td></tr>
          <tr><td class="kv-key">Payment Method</td><td class="kv-val">${escapeHtml(paymentMethod)}</td></tr>
          ${payment.notes ? `<tr><td class="kv-key">Notes</td><td class="kv-val">${escapeHtml(payment.notes)}</td></tr>` : ''}
        </table>

        <div class="amount-box">
          <span>AMOUNT PAID</span>
          <strong>${escapeHtml(formatCurrency(payment.amount))}</strong>
        </div>

        <table class="kv-table">
          <tr><td class="kv-key">Total Permit Fee</td><td class="kv-val">${escapeHtml(formatCurrency(payment.total_fee))}</td></tr>
          <tr><td class="kv-key">Total Paid</td><td class="kv-val">${escapeHtml(formatCurrency(payment.amount_paid))}</td></tr>
          <tr><td class="kv-key">Application Status</td><td class="kv-val">${escapeHtml(appStatus)}</td></tr>
        </table>

        <div class="signatory-grid">
          <div class="sig-block left" style="max-width: 260px;">
            <div class="sig-line">${escapeHtml(payment.cashier_name || '-')}</div>
            <div class="sig-role">Processed By${payment.cashier_code ? ` (${escapeHtml(payment.cashier_code)})` : ''}</div>
          </div>
        </div>

        <div class="doc-note">
          This is a system-generated official receipt. Keep this receipt for your records.
        </div>
      </div>
    `;

    printDocumentHtml({
      title: `Official Receipt - ${payment.or_number}`,
      bodyHtml,
      pageSize: 'A4 portrait',
    });
  };

  return (
    <div className="receipt-modal">
      <div className="receipt-actions no-print">
        <button type="button" className="btn btn-primary" onClick={handlePrint}>
          <Icon name="print" size={16} /> Print Receipt
        </button>
      </div>

      <div className="permit-document receipt-print-area">
        <div className="doc-header receipt-header">
          <div style={{ background: 'var(--gumaca-maroon)', padding: '12px 18px', borderRadius: 10, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <img
              src="/gumacalogo.png"
              alt="Municipality of Gumaca"
              style={{ display: 'block', maxHeight: 62, width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <h2>{office?.office_name || 'Municipal Engineering Office'}</h2>
          {office?.address && <div>{office.address}</div>}
          {office?.contact_number && <div>Tel: {office.contact_number}</div>}
          <div className="receipt-title">OFFICIAL RECEIPT</div>
        </div>

        <div className="receipt-summary-row">
          <div className="receipt-or">
            <span className="label">OR Number</span>
            <strong>{payment.or_number}</strong>
          </div>
          <div className="receipt-date">
            <span className="label">Date</span>
            <strong>{formatDateTime(payment.payment_date)}</strong>
          </div>
        </div>

        <div className="doc-field"><span className="label">Received From</span><span>{payment.client_name}</span></div>
        <div className="doc-field"><span className="label">Address</span><span>{payment.address || '-'}</span></div>
        <div className="doc-field"><span className="label">Application No.</span><span>{payment.application_no}</span></div>
        <div className="doc-field"><span className="label">Permit / Application</span><span>{permitLabel}</span></div>
        <div className="doc-field">
          <span className="label">Payment For</span>
          <span>{paymentFor}</span>
        </div>
        <div className="doc-field"><span className="label">Payment Method</span><span>{paymentMethod}</span></div>
        {payment.notes && <div className="doc-field"><span className="label">Notes</span><span>{payment.notes}</span></div>}

        <div className="receipt-amount-row">
          <span>AMOUNT PAID</span>
          <strong>{formatCurrency(payment.amount)}</strong>
        </div>

        <div className="doc-field"><span className="label">Total Permit Fee</span><span>{formatCurrency(payment.total_fee)}</span></div>
        <div className="doc-field"><span className="label">Total Paid</span><span>{formatCurrency(payment.amount_paid)}</span></div>
        <div className="doc-field">
          <span className="label">Application Status</span>
          <span>{appStatus}</span>
        </div>

        <div className="receipt-footer">
          <div className="signature">
            <strong>{payment.cashier_name || '-'}</strong><br />
            Processed By{payment.cashier_code ? ` (${payment.cashier_code})` : ''}
          </div>
          <div className="receipt-note">
            This is a system-generated official receipt. Keep this receipt for your records.
          </div>
        </div>
      </div>
    </div>
  );
}
