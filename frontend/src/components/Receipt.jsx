import {
  Icon, PERMIT_TYPES, formatCurrency, formatDateTime,
  printDocumentHtml, buildFormalHeaderHtml, escapeHtml,
} from './UI';
import { parseFeeBreakdown } from '../constants/fees';

/**
 * Order of Payment layout. Printing uses a standalone formal HTML document
 * via printDocumentHtml so the website chrome never clips or splits the document.
 */
export default function Receipt({ data }) {
  if (!data?.payment) return null;
  const { payment, office } = data;

  const isPaid = payment.status !== 'pending';
  const permitLabel = PERMIT_TYPES[payment.permit_type] || payment.permit_type;
  const paymentFor = `${permitLabel} fees${payment.project_location ? ` - ${payment.project_location}` : ''}`;
  const paymentMethod = String(payment.payment_method || 'cash').replace(/_/g, ' ').toUpperCase();
  const appStatus = String(payment.permit_status || '').replace(/_/g, ' ').toUpperCase();
  const paymentStatusLabel = isPaid ? 'PAID' : "UNPAID — PAY AT MUNICIPAL TREASURER'S OFFICE";
  const breakdownItems = parseFeeBreakdown(payment.fee_breakdown);
  const totalAmt = Number(payment.amount || payment.total_fee || 0);

  const handlePrint = () => {
    const headerHtml = buildFormalHeaderHtml({
      office,
      title: 'ORDER OF PAYMENT',
    });

    const bodyHtml = `
      <div class="receipt-box">
        ${headerHtml}
        <div class="meta-row">
          <div>
            <span class="meta-label">Order No.</span>
            <span class="meta-val">${escapeHtml(payment.or_number)}</span>
          </div>
          <div style="text-align: right;">
            <span class="meta-label">Date &amp; Time</span>
            <span class="meta-val">${escapeHtml(formatDateTime(payment.payment_date))}</span>
          </div>
        </div>

        <table class="kv-table">
          <tr><td class="kv-key">Payor / Client</td><td class="kv-val"><strong>${escapeHtml(payment.client_name)}</strong></td></tr>
          <tr><td class="kv-key">Address</td><td class="kv-val">${escapeHtml(payment.address || '-')}</td></tr>
          <tr><td class="kv-key">Application No.</td><td class="kv-val">${escapeHtml(payment.application_no)}</td></tr>
          <tr><td class="kv-key">Permit / Application</td><td class="kv-val">${escapeHtml(permitLabel)}</td></tr>
          <tr><td class="kv-key">Payment For</td><td class="kv-val">${escapeHtml(paymentFor)}</td></tr>
          <tr><td class="kv-key">Payment Method</td><td class="kv-val">${escapeHtml(paymentMethod)}</td></tr>
          <tr><td class="kv-key">Payment Status</td><td class="kv-val"><strong>${escapeHtml(paymentStatusLabel)}</strong></td></tr>
          ${payment.notes ? `<tr><td class="kv-key">Notes</td><td class="kv-val">${escapeHtml(payment.notes)}</td></tr>` : ''}
        </table>

        <div class="amount-box">
          <span>${isPaid ? 'AMOUNT PAID' : 'TOTAL ORDER OF PAYMENT'}</span>
          <strong>${escapeHtml(formatCurrency(totalAmt))}</strong>
        </div>

        ${breakdownItems.length > 0 ? `
          <table class="kv-table" style="margin-bottom: 10px;">
            <tr><td class="kv-key" colspan="2"><strong>Itemized Fees</strong></td></tr>
            ${breakdownItems.map((item) => `
              <tr><td class="kv-key">${escapeHtml(item.label)}</td><td class="kv-val">${escapeHtml(formatCurrency(item.amount))}</td></tr>
            `).join('')}
          </table>
        ` : ''}

        <table class="kv-table">
          <tr><td class="kv-key">LGU (80%)</td><td class="kv-val">${escapeHtml(formatCurrency(totalAmt * 0.8))}</td></tr>
          <tr><td class="kv-key">DPWH (5%)</td><td class="kv-val">${escapeHtml(formatCurrency(totalAmt * 0.05))}</td></tr>
          <tr><td class="kv-key">OBO (15%)</td><td class="kv-val">${escapeHtml(formatCurrency(totalAmt * 0.15))}</td></tr>
          <tr><td class="kv-key">Total Permit Fee</td><td class="kv-val">${escapeHtml(formatCurrency(payment.total_fee))}</td></tr>
          <tr><td class="kv-key">Total Paid</td><td class="kv-val">${escapeHtml(formatCurrency(payment.amount_paid))}</td></tr>
          <tr><td class="kv-key">Application Status</td><td class="kv-val">${escapeHtml(appStatus)}</td></tr>
        </table>

        <div class="signatory-grid">
          <div class="sig-block left" style="max-width: 260px;">
            <div class="sig-line">${escapeHtml(payment.cashier_name || '-')}</div>
            <div class="sig-role">Issued By${payment.cashier_code ? ` (${escapeHtml(payment.cashier_code)})` : ''}</div>
          </div>
        </div>

        <div class="doc-note">
          Present this Order of Payment at the Municipal Treasurer&apos;s Office for payment, then return with your official treasurer&apos;s receipt to mark your permit as paid.
        </div>
      </div>
    `;

    printDocumentHtml({
      title: `Order of Payment - ${payment.or_number}`,
      bodyHtml,
      pageSize: 'A4 portrait',
    });
  };

  return (
    <div className="receipt-modal">
      <div className="receipt-actions no-print">
        <button type="button" className="btn btn-primary" onClick={handlePrint}>
          <Icon name="print" size={16} /> Print Order of Payment
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
          <div className="receipt-title">ORDER OF PAYMENT</div>
        </div>

        <div className="receipt-summary-row">
          <div className="receipt-or">
            <span className="label">Order No.</span>
            <strong>{payment.or_number}</strong>
          </div>
          <div className="receipt-date">
            <span className="label">Date</span>
            <strong>{formatDateTime(payment.payment_date)}</strong>
          </div>
        </div>

        <div className="doc-field"><span className="label">Payor / Client</span><span>{payment.client_name}</span></div>
        <div className="doc-field"><span className="label">Address</span><span>{payment.address || '-'}</span></div>
        <div className="doc-field"><span className="label">Application No.</span><span>{payment.application_no}</span></div>
        <div className="doc-field"><span className="label">Permit / Application</span><span>{permitLabel}</span></div>
        <div className="doc-field">
          <span className="label">Payment For</span>
          <span>{paymentFor}</span>
        </div>
        <div className="doc-field"><span className="label">Payment Method</span><span>{paymentMethod}</span></div>
        <div className="doc-field">
          <span className="label">Payment Status</span>
          <span>
            <span className={`badge badge-${isPaid ? 'paid' : 'for_payment'}`}>
              {isPaid ? 'Paid' : "Unpaid (Treasurer's Office)"}
            </span>
          </span>
        </div>
        {payment.notes && <div className="doc-field"><span className="label">Notes</span><span>{payment.notes}</span></div>}

        {breakdownItems.length > 0 && (
          <div style={{ margin: '12px 0', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-subcard)', border: '1px solid var(--border-color)' }}>
            <strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Itemized Fees</strong>
            {breakdownItems.map((item) => (
              <div key={item.key || item.label} className="doc-field">
                <span className="label">{item.label}</span>
                <span>{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="receipt-amount-row">
          <span>{isPaid ? 'AMOUNT PAID' : 'TOTAL ORDER OF PAYMENT'}</span>
          <strong>{formatCurrency(totalAmt)}</strong>
        </div>

        <div className="doc-field"><span className="label">LGU (80%)</span><span>{formatCurrency(totalAmt * 0.8)}</span></div>
        <div className="doc-field"><span className="label">DPWH (5%)</span><span>{formatCurrency(totalAmt * 0.05)}</span></div>
        <div className="doc-field"><span className="label">OBO (15%)</span><span>{formatCurrency(totalAmt * 0.15)}</span></div>
        <div className="doc-field"><span className="label">Total Permit Fee</span><span>{formatCurrency(payment.total_fee)}</span></div>
        <div className="doc-field"><span className="label">Total Paid</span><span>{formatCurrency(payment.amount_paid)}</span></div>
        <div className="doc-field">
          <span className="label">Application Status</span>
          <span>{appStatus}</span>
        </div>

        <div className="receipt-footer">
          <div className="signature">
            <strong>{payment.cashier_name || '-'}</strong><br />
            Issued By{payment.cashier_code ? ` (${payment.cashier_code})` : ''}
          </div>
          <div className="receipt-note">
            Present this Order of Payment at the Municipal Treasurer&apos;s Office for payment, then return with your receipt to mark your application as paid.
          </div>
        </div>
      </div>
    </div>
  );
}
