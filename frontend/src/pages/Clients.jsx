import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Icon, Modal, Pagination } from '../components/UI';

const emptyForm = { full_name: '', contact_number: '', email: '', address: '' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getClients({ search, page, limit: 10 })
      .then((d) => { setClients(d.clients); setTotal(d.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search]);

  const openCreate = () => { setForm(emptyForm); setError(''); setModal('create'); };
  const openEdit = (c) => { setForm(c); setError(''); setModal('edit'); };
  const openView = (c) => { setForm(c); setModal('view'); };

  const handleSave = async () => {
    try {
      if (modal === 'create') await api.createClient(form);
      else await api.updateClient(form.id, form);
      setModal(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this client?')) return;
    try {
      await api.deleteClient(id);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <h1 className="page-title">Client Management</h1>
      <p className="page-subtitle">Manage client records</p>

      <div className="toolbar">
        <div className="toolbar-left">
          <input className="form-control" style={{ width: 260 }} placeholder="Search clients..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={16} /> Add New Client
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading">Loading...</div> : (
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Client Name</th><th>Contact</th><th>Email</th><th>Address</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">No clients found. Add your first client.</td></tr>
                ) : clients.map((c) => (
                  <tr key={c.id}>
                    <td>{c.client_id}</td>
                    <td>{c.full_name}</td>
                    <td>{c.contact_number || '-'}</td>
                    <td>{c.email || '-'}</td>
                    <td>{c.address || '-'}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" title="View" onClick={() => openView(c)}><Icon name="view" size={16} /></button>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(c)}><Icon name="edit" size={16} /></button>
                      <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(c.id)}><Icon name="delete" size={16} /></button>
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

      <Modal open={!!modal && modal !== 'view'} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add New Client' : 'Edit Client'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>}>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label>Full Name *</label>
          <input className="form-control" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Contact Number</label>
            <input className="form-control" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Address</label>
          <textarea className="form-control" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </Modal>

      <Modal open={modal === 'view'} onClose={() => setModal(null)} title="Client Details">
        <div className="form-group"><label>Client ID</label><p>{form.client_id}</p></div>
        <div className="form-group"><label>Full Name</label><p>{form.full_name}</p></div>
        <div className="form-group"><label>Contact</label><p>{form.contact_number || '-'}</p></div>
        <div className="form-group"><label>Email</label><p>{form.email || '-'}</p></div>
        <div className="form-group"><label>Address</label><p>{form.address || '-'}</p></div>
      </Modal>
    </div>
  );
}
