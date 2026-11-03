import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Icon, Modal, Pagination, PERMIT_TYPES, formatCurrency, formatDateTime, CustomSelect } from '../components/UI';

const emptyForm = { permit_id: '', amount: '', payment_method: 'cash', notes: '' };

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [permits, setPermits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getPayments({ search, page, limit: 10 })
      .then((d) => { setPayments(d.payments); setTotal(d.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search]);
  useEffect(() => {
    api.getPermits({ page: 1, limit: 1000, status: '' }).then((d) => setPermits(d.permits));
  }, []);

  const openRecord = async () => {
    setForm(emptyForm);
    setSelected(null);
    setError('');
    setModal('record');
  };

  const fetchPermit = async (permitId) => {
    if (!permitId) return;
    try {
      const d = await api.getPermitPayments(permitId);
      setSelected(d);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    try {
      await api.createPayment({
        permit_id: Number(form.permit_id),
        amount: Number(form.amount),
        payment_method: form.payment_method,
        notes: form.notes,
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openReceipt = async (payment) => {
    const data = await api.getReceipt(payment.id);
    setSelected(data);
    setModal('receipt');
  };

  return (
    <div>
      <h1 className="page-title">Payments</h1>
      <p className="page-subtitle">Record collections and print official receipts</p>

      <div className="toolbar">
        <div className="toolbar-left">
          <input className="form-control" style={{ width: 260 }} placeholder="Search OR, client, application..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary" onClick={openRecord}><Icon name="plus" size={16} /> Record Payment</button>
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
                    <td><button className="btn-icon" onClick={() => openReceipt(p)}><Icon name="print" size={16} /></button></td>
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
            <button className="btn btn-primary" onClick={handleSave}>Save Payment</button>
          </>
        }
      >
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label>Permit Application</label>
            <CustomSelect
              value={form.permit_id}
              style={{ width: '100%' }}
              onChange={async (val) => {
                setForm({ ...form, permit_id: val });
                await fetchPermit(val);
              }}
              placeholder="Select permit"
              options={[
                { value: '', label: 'Select permit' },
                ...permits.map((p) => ({ value: String(p.id), label: `${p.application_no} - ${p.client_name}` }))
              ]}
            />
        </div>
        {selected?.permit && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <div className="doc-field"><span className="label">Client</span><span>{selected.permit.client_name}</span></div>
              <div className="doc-field"><span className="label">Permit Type</span><span>{PERMIT_TYPES[selected.permit.permit_type]}</span></div>
              <div className="doc-field"><span className="label">Total Fee</span><span>{formatCurrency(selected.permit.total_fee)}</span></div>
              <div className="doc-field"><span className="label">Amount Paid</span><span>{formatCurrency(selected.permit.amount_paid)}</span></div>
              <div className="doc-field"><span className="label">Balance</span><span>{formatCurrency(selected.balance)}</span></div>
              <div className="doc-field"><span className="label">Status</span><span>{selected.balance <= 0 ? <span className="badge badge-paid">PAID</span> : 'Unpaid / Partial'}</span></div>
            </div>
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label>Amount</label>
            <input className="form-control" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
              ]}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea className="form-control" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>

      <Modal open={modal === 'receipt'} onClose={() => setModal(null)} title="Official Receipt Preview" large>
        {selected?.payment && (
          <div className="permit-document">
            <div className="doc-header">
              <h2>{selected.office.office_name}</h2>
              <div>{selected.office.municipality}</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>OFFICIAL RECEIPT</div>
            </div>
            <div className="doc-field"><span className="label">OR Number</span><span>{selected.payment.or_number}</span></div>
            <div className="doc-field"><span className="label">Date</span><span>{formatDateTime(selected.payment.payment_date)}</span></div>
            <div className="doc-field"><span className="label">Client</span><span>{selected.payment.client_name}</span></div>
            <div className="doc-field"><span className="label">Address</span><span>{selected.payment.address || '-'}</span></div>
            <div className="doc-field"><span className="label">Application No.</span><span>{selected.payment.application_no}</span></div>
            <div className="doc-field"><span className="label">Permit Type</span><span>{PERMIT_TYPES[selected.payment.permit_type]}</span></div>
            <div className="doc-field"><span className="label">Amount Paid</span><span>{formatCurrency(selected.payment.amount)}</span></div>
            <div className="doc-field"><span className="label">Cashier</span><span>{selected.payment.cashier_name || '-'}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
