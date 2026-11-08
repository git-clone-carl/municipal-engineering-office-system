import { Icon, PERMIT_TYPES, formatCurrency, formatDateTime, printElement } from './UI';

/**
 * Official receipt layout. The body uses the "receipt-print-area" class so the
 * @media print rules hide the application chrome and print only this document.
 */
export default function Receipt({ data }) {
  if (!data?.payment) return null;
  const { payment, office } = data;

  return (
    <div className="receipt-modal">
      <div className="receipt-actions no-print">
        <button type="button" className="btn btn-primary" onClick={printElement}>
          <Icon name="print" size={16} /> Print Receipt
        </button>
      </div>

      <div className="permit-document receipt-print-area">
        <div className="doc-header receipt-header">
          <div className="receipt-republic">Republic of the Philippines</div>
          <h2>{office?.office_name || 'Municipal Engineering Office'}</h2>
          <div>{office?.municipality || 'Gumaca, Quezon'}</div>
          <div>{office?.address || ''}</div>
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
        <div className="doc-field"><span className="label">Permit / Application</span><span>{PERMIT_TYPES[payment.permit_type] || payment.permit_type}</span></div>
        <div className="doc-field">
          <span className="label">Payment For</span>
          <span>
            {PERMIT_TYPES[payment.permit_type] || payment.permit_type} fees
            {payment.project_location ? ` - ${payment.project_location}` : ''}
          </span>
        </div>
        <div className="doc-field"><span className="label">Payment Method</span><span>{String(payment.payment_method || 'cash').replace(/_/g, ' ')}</span></div>
        {payment.notes && <div className="doc-field"><span className="label">Notes</span><span>{payment.notes}</span></div>}

        <div className="receipt-amount-row">
          <span>AMOUNT PAID</span>
          <strong>{formatCurrency(payment.amount)}</strong>
        </div>

        <div className="doc-field"><span className="label">Total Permit Fee</span><span>{formatCurrency(payment.total_fee)}</span></div>
        <div className="doc-field"><span className="label">Total Paid</span><span>{formatCurrency(payment.amount_paid)}</span></div>
        <div className="doc-field">
          <span className="label">Application Status</span>
          <span>{String(payment.permit_status || '').replace(/_/g, ' ').toUpperCase()}</span>
        </div>

        <div className="receipt-footer">
          <div className="signature">
            <strong>{payment.cashier_name || '-'}</strong><br />
            Cashier{payment.cashier_code ? ` (${payment.cashier_code})` : ''}
          </div>
          <div className="receipt-note">
            This is a system-generated official receipt. Keep this receipt for your records.
          </div>
        </div>
      </div>
    </div>
  );
}
