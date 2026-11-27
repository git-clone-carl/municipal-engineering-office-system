import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  Modal, Pagination, PERMIT_TYPES, formatCurrency, formatDateTime,
} from '../components/UI';
import Receipt from '../components/Receipt';

export default function Payments() {
  const { user } = useAuth();
  const canProcessPayment = ['admin', 'engineering_staff'].includes(user?.role);
  const canSeePending = ['admin', 'engineering_staff', 'municipal_engineer'].includes(user?.role);

  const [payments, setPayments] = useState([]);
  const [pending, setPending] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [receiptData, setReceiptData] = useState(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.getPayments({ search, page, limit: 10 })
      .then((d) => { setPayments(d.payments); setTotal(d.total); })
      .catch((err) => { if (!silent) setError(err.message); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [page, search]);

  const loadPending = useCallback((silent = false) => {
    if (!canSeePending) { setPendingLoading(false); return; }
    if (!silent) setPendingLoading(true);
    api.getPendingPayments()
      .then((d) => setPending(d.permits || []))
      .catch((err) => { if (!silent) setError(err.message); })
      .finally(() => { if (!silent) setPendingLoading(false); });
  }, [canSeePending]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPending(); }, [loadPending]);

  useEffect(() => {
    const timer = setInterval(() => { load(true); loadPending(true); }, 10000);
    return () => clearInterval(timer);
  }, [load, loadPending]);

  const handleIssueOrder = async (permit) => {
    setError('');
    setSuccess('');
    setBusyId(`issue-${permit.id}`);
    try {
      const result = await api.issueOrderOfPayment(permit.id);
      setSuccess(`Order of Payment ${result.or_number} issued for ${permit.application_no}. Client may now pay at the Treasurer's Office.`);
      load(true);
      loadPending(true);
      const data = await api.getReceipt(result.id);
      setReceiptData(data);
      setModal('receipt');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (payment) => {
    if (!confirm(`Confirm that client returned with Treasurer's Office receipt and mark ${payment.or_number} (${payment.application_no}) as PAID?`)) {
      return;
    }
    setError('');
    setSuccess('');
    setBusyId(`paid-${payment.id}`);
    try {
      await api.markPaymentPaid(payment.id);
      setSuccess(`${payment.application_no} (${payment.or_number}) has been marked as PAID and is now ready for release.`);
      load(true);
      loadPending(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const openOrderModal = async (payment) => {
    setError('');
    try {
      const data = await api.getReceipt(payment.id);
      setReceiptData(data);
      setModal('receipt');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">Order of Payment &amp; Payments</h1>
      <p className="page-subtitle">
        Issue Order of Payment for engineer-approved permits, then mark as paid once the client returns from the Treasurer&apos;s Office with their receipt.
      </p>

      {error && !modal && <div className="login-error">{error}</div>}
      {success && <div className="badge badge-active" style={{ display: 'inline-block', marginBottom: 14 }}>{success}</div>}

      {canSeePending && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Approved Applications — Ready for Order of Payment</h3>
            <span className="badge badge-approved">{pending.length} ready</span>
          </div>
          <div className="table-wrap">
            {pendingLoading ? <div className="loading">Loading approved applications...</div> : (
              <table>
                <thead>
                  <tr>
                    <th>Application No.</th>
                    <th>Client</th>
                    <th>Permit Type</th>
                    <th>Amount Due</th>
                    <th>Approved By</th>
                    <th>Approved At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 ? (
                    <tr><td colSpan={7} className="empty-state">No approved applications awaiting Order of Payment.</td></tr>
                  ) : pending.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.application_no}</strong></td>
                      <td>{p.client_name}</td>
                      <td>{PERMIT_TYPES[p.permit_type] || p.permit_type}</td>
                      <td>{formatCurrency(p.total_fee - p.amount_paid)}</td>
                      <td>{p.approved_by_name || '-'}</td>
                      <td>{formatDateTime(p.approved_at)}</td>
                      <td>
                        {canProcessPayment ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busyId === `issue-${p.id}`}
                            onClick={() => handleIssueOrder(p)}
                          >
                            {busyId === `issue-${p.id}` ? 'Issuing...' : 'Issue Order of Payment'}
                          </button>
                        ) : (
                          <span className="doc-meta">Staff action</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-left">
          <input
            className="form-control"
            style={{ width: 280 }}
            placeholder="Search Order No., client, application..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading">Loading payment records...</div> : (
            <table>
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Application</th>
                  <th>Permit Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Issued By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={9} className="empty-state">No Order of Payment records found.</td></tr>
                ) : payments.map((p) => {
                  const isPending = p.status === 'pending';
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.or_number}</strong></td>
                      <td>{formatDateTime(p.payment_date)}</td>
                      <td>{p.client_name}</td>
                      <td>{p.application_no}</td>
                      <td>{PERMIT_TYPES[p.permit_type] || p.permit_type}</td>
                      <td>{formatCurrency(p.amount)}</td>
                      <td>
                        <span className={`badge badge-${isPending ? 'for_payment' : 'paid'}`}>
                          {isPending ? 'Unpaid (Order Issued)' : 'Paid'}
                        </span>
                      </td>
                      <td>{p.cashier_name || '-'}</td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openOrderModal(p)}
                        >
                          Order of Payment
                        </button>
                        {isPending && canProcessPayment && (
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            disabled={busyId === `paid-${p.id}`}
                            onClick={() => handleMarkPaid(p)}
                          >
                            {busyId === `paid-${p.id}` ? 'Saving...' : 'Mark as Paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0 16px' }}>
          <Pagination page={page} limit={10} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal
        open={modal === 'receipt'}
        onClose={() => { setModal(null); setReceiptData(null); }}
        title="Order of Payment"
        large
      >
        {receiptData && <Receipt data={receiptData} />}
      </Modal>
    </div>
  );
}
