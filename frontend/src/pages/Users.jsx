import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Icon, Modal, Pagination, ROLE_LABELS, CustomSelect } from '../components/UI';

const emptyForm = { username: '', password: '', full_name: '', role: 'viewer', status: 'active' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getUsers({ search, page, limit: 10 })
      .then((d) => {
        setUsers(d.users);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setError('');
    setModal('create');
  };

  const openEdit = (u) => {
    setForm({ ...u, password: '' });
    setError('');
    setModal('edit');
  };

  const handleSave = async () => {
    try {
      if (modal === 'create') {
        await api.createUser(form);
      } else {
        const payload = { full_name: form.full_name, role: form.role, status: form.status };
        if (form.password) payload.password = form.password;
        await api.updateUser(form.id, payload);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">User Management</h1>
      <p className="page-subtitle">Create and manage user accounts by role</p>

      <div className="toolbar">
        <div className="toolbar-left">
          <input className="form-control" style={{ width: 260 }} placeholder="Search user..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Icon name="plus" size={16} /> Add New User</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading">Loading users...</div> : (
            <table>
              <thead>
                <tr><th>User ID</th><th>Full Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">No users found.</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.user_id}</td>
                    <td>{u.full_name}</td>
                    <td>{u.username}</td>
                    <td>{ROLE_LABELS[u.role]}</td>
                    <td><span className={`badge badge-${u.status}`}>{u.status}</span></td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => openEdit(u)}><Icon name="edit" size={16} /></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(u.id)}><Icon name="delete" size={16} /></button>
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
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Create User' : 'Edit User'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </>
        }
      >
        {error && <div className="login-error">{error}</div>}
        {modal === 'create' && (
          <div className="form-group">
            <label>Username</label>
            <input className="form-control" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
        )}
        <div className="form-group">
          <label>Full Name</label>
          <input className="form-control" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Role</label>
            <CustomSelect
              value={form.role}
              onChange={(val) => setForm({ ...form, role: val })}
              options={Object.entries(ROLE_LABELS).map(([key, label]) => ({ value: key, label }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <CustomSelect
              value={form.status}
              onChange={(val) => setForm({ ...form, status: val })}
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div className="form-group">
          <label>{modal === 'create' ? 'Password' : 'New Password (optional)'}</label>
          <input className="form-control" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
