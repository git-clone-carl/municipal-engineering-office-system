import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Icon, Modal, Pagination, PERMIT_TYPES, STATUS_LABELS, formatCurrency, formatDate, CustomSelect, CustomDatePicker } from '../components/UI';

const STEPS = ['Application Details', 'Requirements', 'Payment', 'Review'];
const emptyForm = {
  permit_type: 'building',
  client_id: '',
  application_date: new Date().toISOString().split('T')[0],
  project_location: '',
  nature_of_construction: '',
  building_type: '',
  total_floor_area: '',
  num_storeys: 1,
  assigned_staff_id: '',
  notes: '',
};

export default function Permits() {
  const { hasAccess } = useAuth();
  const [permits, setPermits] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [step, setStep] = useState(0);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPermit, setSelectedPermit] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getPermits({ search, status, type, page, limit: 10 })
      .then((d) => {
        setPermits(d.permits);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
  }, [page, search, status, type]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.getClients({ search: '', page: 1, limit: 1000 }).then((d) => setClients(d.clients));
    api.getStaff().then(setStaff);
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === String(form.client_id)),
    [clients, form.client_id]
  );

  const openCreate = () => {
    setForm(emptyForm);
    setStep(0);
    setError('');
    setSelectedPermit(null);
    setModal('create');
  };

  const openView = async (permit) => {
    const data = await api.getPermit(permit.id);
    setSelectedPermit(data);
    setModal('view');
  };

  const openPreview = async (permit) => {
    const data = await api.getPermitPreview(permit.id);
    setSelectedPermit(data);
    setModal('preview');
  };

  const handleCreate = async () => {
    if (!form.client_id) {
      setError('Please select a client.');
      setStep(0);
      return;
    }
    try {
      await api.createPermit({
        ...form,
        client_id: Number(form.client_id),
        assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null,
        total_floor_area: Number(form.total_floor_area || 0),
        num_storeys: Number(form.num_storeys || 1),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = async (permitId, newStatus) => {
    try {
      await api.updatePermit(permitId, { status: newStatus });
      load();
      if (selectedPermit?.id === permitId) {
        setSelectedPermit(await api.getPermit(permitId));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApprove = async (permitId) => {
    try {
      await api.approvePermit(permitId);
      load();
      setSelectedPermit(await api.getPermit(permitId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRelease = async (permitId) => {
    try {
      await api.releasePermit(permitId);
      load();
      setSelectedPermit(await api.getPermit(permitId));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">Permit Applications</h1>
      <p className="page-subtitle">Process permit requests and track requirements</p>

      <div className="toolbar">
        <div className="toolbar-left">
          <input
            className="form-control"
            style={{ width: 220 }}
            placeholder="Search application or client..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <CustomSelect
            value={type}
            onChange={(val) => { setType(val); setPage(1); }}
            placeholder="All Types"
            options={[
              { value: '', label: 'All Types' },
              ...Object.entries(PERMIT_TYPES).map(([k, v]) => ({ value: k, label: v }))
            ]}
          />
          <CustomSelect
            value={status}
            onChange={(val) => { setStatus(val); setPage(1); }}
            placeholder="All Status"
            options={[
              { value: '', label: 'All Status' },
              ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))
            ]}
          />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={16} /> New Application
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading">Loading permits...</div> : (
            <table>
              <thead>
                <tr>
                  <th>Application No.</th>
                  <th>Client</th>
                  <th>Permit Type</th>
                  <th>Status</th>
                  <th>Fee</th>
                  <th>Paid</th>
                  <th>Assigned Staff</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {permits.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No permit applications found.</td></tr>
                ) : permits.map((p) => (
                  <tr key={p.id}>
                    <td>{p.application_no}</td>
                    <td>{p.client_name}</td>
                    <td>{PERMIT_TYPES[p.permit_type] || p.permit_type}</td>
                    <td><span className={`badge badge-${p.status}`}>{STATUS_LABELS[p.status]}</span></td>
                    <td>{formatCurrency(p.total_fee)}</td>
                    <td>{formatCurrency(p.amount_paid)}</td>
                    <td>{p.assigned_staff_name || '-'}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => openView(p)} title="View"><Icon name="view" size={16} /></button>
                      <button className="btn-icon" onClick={() => openPreview(p)} title="Preview"><Icon name="print" size={16} /></button>
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
        open={modal === 'create'}
        onClose={() => setModal(null)}
        title="New Permit Application"
        large
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            {step > 0 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Back</button>}
            {step < STEPS.length - 1
              ? <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next</button>
              : <button className="btn btn-primary" onClick={handleCreate}>Submit Application</button>}
          </>
        }
      >
        <div className="stepper">
          {STEPS.map((label, i) => (
            <div key={label} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
              <div className="step-num">{i + 1}</div>
              <div className="step-label">{label}</div>
            </div>
          ))}
        </div>
        {error && <div className="login-error">{error}</div>}

        {step === 0 && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Permit Type</label>
                <CustomSelect
                  value={form.permit_type}
                  onChange={(val) => setForm({ ...form, permit_type: val })}
                  options={Object.entries(PERMIT_TYPES).map(([key, label]) => ({ value: key, label }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label>Application Date</label>
                <CustomDatePicker
                  value={form.application_date}
                  onChange={(val) => setForm({ ...form, application_date: val })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Client</label>
              <CustomSelect
                value={form.client_id}
                onChange={(val) => setForm({ ...form, client_id: val })}
                placeholder="Select client"
                options={clients.map((c) => ({ value: c.id, label: `${c.client_id} - ${c.full_name}` }))}
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label>Project Location</label>
              <input className="form-control" value={form.project_location} onChange={(e) => setForm({ ...form, project_location: e.target.value })} />
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label>Nature of Construction</label>
                <input className="form-control" value={form.nature_of_construction} onChange={(e) => setForm({ ...form, nature_of_construction: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Building Type</label>
                <input className="form-control" value={form.building_type} onChange={(e) => setForm({ ...form, building_type: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Assigned Staff</label>
                <CustomSelect
                  value={form.assigned_staff_id}
                  onChange={(val) => setForm({ ...form, assigned_staff_id: val })}
                  placeholder="Unassigned"
                  options={staff.map((s) => ({ value: s.id, label: s.full_name }))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="card">
            <div className="card-body">
              <p style={{ marginBottom: 12 }}>Required documents for <strong>{PERMIT_TYPES[form.permit_type]}</strong> will be created automatically upon submission.</p>
              <ul style={{ paddingLeft: 20 }}>
                {(form.permit_type === 'building'
                  ? ['Certified True Copy of Title', 'Tax Declaration', 'Building Plans (Signed & Sealed)', 'Bill of Materials', 'Barangay Clearance', 'Occupancy Permit Application']
                  : form.permit_type === 'electrical'
                    ? ['Electrical Plans', 'Load Computation', 'Tax Declaration', 'Barangay Clearance']
                    : form.permit_type === 'occupancy'
                      ? ['Building Permit', 'Certificate of Completion', 'Fire Safety Certificate', 'Tax Declaration']
                      : form.permit_type === 'locational'
                        ? ['Lot Plan', 'Tax Declaration', 'Barangay Clearance', 'Zoning Clearance']
                        : ['Application Form', 'Valid ID', 'Tax Declaration']
                ).map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Estimated Floor Area</label>
                  <input className="form-control" type="number" value={form.total_floor_area} onChange={(e) => setForm({ ...form, total_floor_area: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Number of Storeys</label>
                  <input className="form-control" type="number" value={form.num_storeys} onChange={(e) => setForm({ ...form, num_storeys: e.target.value })} />
                </div>
              </div>
              <p>Permit fees are calculated from system settings and will be ready for cashier processing after submission.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card">
            <div className="card-body">
              <div className="form-group"><label>Selected Client</label><p>{selectedClient ? `${selectedClient.client_id} - ${selectedClient.full_name}` : 'No client selected'}</p></div>
              <div className="form-group"><label>Permit Type</label><p>{PERMIT_TYPES[form.permit_type]}</p></div>
              <div className="form-group"><label>Project Location</label><p>{form.project_location || '-'}</p></div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={modal === 'view'}
        onClose={() => setModal(null)}
        title={selectedPermit ? `Application ${selectedPermit.application_no}` : 'Application Details'}
        large
        footer={selectedPermit && (
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Close</button>
            {selectedPermit.status === 'submitted' && <button className="btn btn-secondary" onClick={() => handleUpdateStatus(selectedPermit.id, 'for_review')}>Mark For Review</button>}
            {selectedPermit.status === 'for_review' && <button className="btn btn-secondary" onClick={() => handleUpdateStatus(selectedPermit.id, 'for_payment')}>Mark For Payment</button>}
            {selectedPermit.status === 'for_approval' && <button className="btn btn-success" onClick={() => handleApprove(selectedPermit.id)}>Approve</button>}
            {selectedPermit.status === 'approved' && <button className="btn btn-primary" onClick={() => handleRelease(selectedPermit.id)}>Release</button>}
          </>
        )}
      >
        {selectedPermit && (
          <div className="form-row">
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header"><h3>Application Details</h3></div>
                <div className="card-body">
                  <div className="doc-field"><span className="label">Application No.</span><span>{selectedPermit.application_no}</span></div>
                  <div className="doc-field"><span className="label">Client</span><span>{selectedPermit.client_name}</span></div>
                  <div className="doc-field"><span className="label">Permit Type</span><span>{PERMIT_TYPES[selectedPermit.permit_type]}</span></div>
                  <div className="doc-field"><span className="label">Application Date</span><span>{formatDate(selectedPermit.application_date)}</span></div>
                  <div className="doc-field"><span className="label">Project Location</span><span>{selectedPermit.project_location || '-'}</span></div>
                  <div className="doc-field"><span className="label">Assigned Staff</span><span>{selectedPermit.assigned_staff_name || '-'}</span></div>
                  <div className="doc-field"><span className="label">Status</span><span><span className={`badge badge-${selectedPermit.status}`}>{STATUS_LABELS[selectedPermit.status]}</span></span></div>
                  <div className="doc-field"><span className="label">Total Fee</span><span>{formatCurrency(selectedPermit.total_fee)}</span></div>
                  <div className="doc-field"><span className="label">Amount Paid</span><span>{formatCurrency(selectedPermit.amount_paid)}</span></div>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h3>Requirements Checklist</h3></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Requirement</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {selectedPermit.requirements?.map((r) => (
                        <tr key={r.id}>
                          <td>{r.requirement_name}</td>
                          <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                          <td>
                            <select
                              className="form-control"
                              value={r.status}
                              onChange={(e) => handleRequirementToggle(selectedPermit.id, r.id, e.target.value)}
                            >
                              <option value="pending">Pending</option>
                              <option value="submitted">Submitted</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div>
              <div className="card">
                <div className="card-header"><h3>Application Status</h3></div>
                <div className="card-body">
                  <div className="status-tracker">
                    {statusOrder.map((s, index) => {
                      const currentIndex = statusOrder.indexOf(selectedPermit.status);
                      const stateClass = index < currentIndex ? 'done' : index === currentIndex ? 'current' : '';
                      return (
                        <div key={s}>
                          <div className={`status-step ${stateClass}`}>
                            <div className="status-dot" />
                            <div>
                              <strong>{STATUS_LABELS[s]}</strong>
                              <div style={{ fontSize: 12, color: 'var(--green-800)' }}>{index <= currentIndex ? 'Reached' : 'Pending'}</div>
                            </div>
                          </div>
                          {index < statusOrder.length - 1 && <div className="status-line" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal === 'preview'} onClose={() => setModal(null)} title="Printable Permit Preview" large>
        {selectedPermit && (
          <div className="permit-document">
            <div className="doc-header">
              <h2>{selectedPermit.office.office_name}</h2>
              <div>{selectedPermit.office.municipality}</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>BUILDING PERMIT</div>
            </div>
            <div className="doc-field"><span className="label">Application No.</span><span>{selectedPermit.permit.application_no}</span></div>
            <div className="doc-field"><span className="label">Client Name</span><span>{selectedPermit.permit.client_name}</span></div>
            <div className="doc-field"><span className="label">Address</span><span>{selectedPermit.permit.client_address}</span></div>
            <div className="doc-field"><span className="label">Project Location</span><span>{selectedPermit.permit.project_location}</span></div>
            <div className="doc-field"><span className="label">Nature of Construction</span><span>{selectedPermit.permit.nature_of_construction}</span></div>
            <div className="doc-field"><span className="label">Permit Type</span><span>{PERMIT_TYPES[selectedPermit.permit.permit_type]}</span></div>
            <div className="doc-field"><span className="label">Issued Date</span><span>{formatDate(selectedPermit.permit.issued_date)}</span></div>
            <div className="qr"><img src={selectedPermit.qrCode} alt="QR Code" style={{ width: 130, height: 130 }} /></div>
            <div className="signature">{selectedPermit.office.municipal_engineer}<br />Municipal Engineer</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
