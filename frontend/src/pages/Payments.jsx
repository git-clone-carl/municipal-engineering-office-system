import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  Icon, Modal, Pagination, PERMIT_TYPES, formatCurrency, formatDateTime, CustomSelect,
} from '../components/UI';
import Receipt from '../components/Receipt';

const emptyForm = { permit_id: '', amount: '', payment_method: 'cash', notes: '' };

export default function Payments() {
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';
  const canSeePending = ['cashier', 'admin'].includes(user?.role);

  const [payments, setPayments] = useState([]);
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api.getPayments({ search, page, limit: 10 })
      .then((d) => { setPayments(d.payments); setTotal(d.total); })
      .catch((err) => { if (!silent) setError(err.message); })
      .finally(() => { if (!silent) setLoading(false); });
  };

  const loadPending = (silent = false) => {
    if (!canSeePending) { setPendingLoading(false); return; }
    if (!silent) setPendingLoading(true);
    api.getPendingPayments()
      .then((d) => setPending(d.permits || []))
      .catch((err) => { if (!silent) setError(err.message); })
      .finally(() => { if (!silent) setPendingLoading(false); });
  };

  useEffect(() => { load(); }, [page, search]);
  useEffect(() => { loadPending(); }, []);

  useEffect(() => {
    const timer = setInterval(() => { load(true); loadPending(true); }, 20000);
    return () => clearInterval(timer);
  }, [page, search, canSeePending]);

  const openRecord = (permit = null) => {
    setForm({
      ...emptyForm,
      permit_id: permit ? String(permit.id) : '',
      amount: permit ? String(permit.total_fee - permit.amount_paid) : '',
    });
    setSelected(permit ? {
      permit: {
        ...permit,
        amount_paid: permit.amount_paid,
      },
      balance: permit.total_fee - permit.amount_paid,
      payment_allowed: true,
    } : null);
    setError('');
    setModal('record');
    if (permit) fetchPermit(permit.id);
  };

  const fetchPermit = async (permitId) => {
    if (!permitId) { setSelected(null); return; }
    try {
      const data = await api.getPermitPayments(permitId);
      setSelected(data);
      setForm((current) => ({
        ...current,
        permit_id: String(permitId),
        amount: String(Math.max(0, data.balance)),
      }));
      if (!data.payment_allowed) {
        setError(data.permit.status === 'paid'
          ? 'This application has already been paid.'
          : `Payment is disabled. Application status: ${data.permit.status}.`);
      } else {
        setError('');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    if (!selected?.payment_allowed) {
      setError('Payment is not allowed for this application.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await api.createPayment({
        permit_id: Number(form.permit_id),
        amount: Number(form.amount),
        payment_method: form.payment_method,
        notes: form.notes,
      });
      setModal(null);
      load(true);
      loadPending(true);
      const receipt = await api.getReceipt(result.id);
      setReceiptData(receipt);
      setModal('receipt');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openReceipt = async (payment) => {
    try {
      const data = await api.getReceipt(payment.id);
      setReceiptData(data);
      setModal('receipt');
    } catch (err) {
      setError(err.message);
    }
  };

  const paymentOptions = pending.map((p) => ({
    value: String(p.id),
    label: `${p.application_no} - ${p.client_name} (${formatCurrency(p.total_fee - p.amount_paid)})`,
  }));

  return (
    <div>
      <h1 className="page-title">Payments</h1>
      <p className="page-subtitle">
        {isCashier
          ? 'Process payments for engineer-approved applications and print official receipts'
          : 'View payment transactions and official receipts'}
      </p>

      {error && !modal && <div className="login-error">{error}</div>}

      {canSeePending && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Approved Applications Awaiting Payment</h3>
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
                    <tr><td colSpan={7} className="empty-state">No approved applications awaiting payment.</td></tr>
                  ) : pending.map((p) => (
                    <tr key={p.id}>
                      <td>{p.application_no}</td>
                      <td>{p.client_name}</td>
                      <td>{PERMIT_TYPES[p.permit_type] || p.permit_type}</td>
                      <td>{formatCurrency(p.total_fee - p.amount_paid)}</td>
                      <td>{p.approved_by_name || '-'}</td>
                      <td>{formatDateTime(p.approved_at)}</td>
                      <td>
                        {isCashier ? (
                          <button className="btn btn-primary btn-sm" onClick={() => openRecord(p)}>
                            <Icon name="payments" size={14} /> Process Payment
                          </button>
                        ) : (
                          <span className="doc-meta">Cashier action</span>
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
          <input className="form-control" style={{ width: 260 }} placeholder="Search OR, client, application..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {isCashier && (
          <button className="btn btn-primary" onClick={() => openRecord()}>
            <Icon name="plus" size={16} /> Record Payment
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading">Loading payments...</div> : (
            <table>
              <thead>
                <tr>
                  <th>OR No.</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Application</th>
                  <th>Permit Type</th>
                  <th>Amount</th>
                  <th>Cashier</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No payment records found.</td></tr>
                ) : payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.or_number}</td>
                    <td>{formatDateTime(p.payment_date)}</td>
                    <td>{p.client_name}</td>
                    <td>{p.application_no}</td>
                    <td>{PERMIT_TYPES[p.permit_type]}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>{p.cashier_name || '-'}</td>
                    <td>
                      <button className="btn-icon" title="View / Print Receipt" onClick={() => openReceipt(p)}>
                        <Icon name="print" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0 16px' }}>
          <Pagination page={page} limit={10} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal
        open={modal === 'record'}
        onClose={() => setModal(null)}
        title="Record Payment"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selected?.payment_allowed}>
              {saving ? 'Saving...' : 'Confirm Payment'}
            </button>
          </>
        }
      >
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label>Permit Application (engineer-approved only)</label>
          <CustomSelect
            value={form.permit_id}
            style={{ width: '100%' }}
            onChange={async (val) => {
              setForm({ ...form, permit_id: val, amount: '' });
              await fetchPermit(val);
            }}
            placeholder={pending.length ? 'Select approved application' : 'No approved applications available'}
            options={[{ value: '', label: 'Select application' }, ...paymentOptions]}
          />
        </div>
        {selected?.permit && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <div className="doc-field"><span className="label">Client</span><span>{selected.permit.client_name}</span></div>
              <div className="doc-field"><span className="label">Permit Type</span><span>{PERMIT_TYPES[selected.permit.permit_type]}</span></div>
              <div className="doc-field"><span className="label">Application Status</span><span><span className={`badge badge-${selected.permit.status}`}>{String(selected.permit.status).replace(/_/g, ' ')}</span></span></div>
              <div className="doc-field"><span className="label">Total Fee</span><span>{formatCurrency(selected.permit.total_fee)}</span></div>
              <div className="doc-field"><span className="label">Amount Paid</span><span>{formatCurrency(selected.permit.amount_paid)}</span></div>
              <div className="doc-field"><span className="label">Balance</span><span>{formatCurrency(selected.balance)}</span></div>
              <div className="doc-field">
                <span className="label">Payment</span>
                <span>{selected.payment_allowed
                  ? <span className="badge badge-approved">ENABLED</span>
                  : <span className="badge badge-rejected">DISABLED</span>}</span>
              </div>
            </div>
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label>Amount (full balance)</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              readOnly={!selected?.payment_allowed}
            />
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <CustomSelect
              value={form.payment_method}
              style={{ width: '100%' }}
              onChange={(val) => setForm({ ...form, payment_method: val })}
              placeholder="Select method"
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'check', label: 'Check' },
                { value: 'gcash', label: 'GCash' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
              ]}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea className="form-control" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <p className="page-subtitle">
          The backend verifies the application is Approved, fully unpaid and that you are signed in as Cashier.
        </p>
      </Modal>

      <Modal open={modal === 'receipt'} onClose={() => { setModal(null); setReceiptData(null); }} title="Official Receipt" large>
        {receiptData && <Receipt data={receiptData} />}
      </Modal>
    </div>
  );
}
