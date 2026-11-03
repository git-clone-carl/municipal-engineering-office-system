import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ROLE_LABELS } from '../components/UI';

// Admin is not editable here; its full access is enforced on the backend.
const ALL_ROLES = ['admin', 'engineering_staff', 'cashier', 'municipal_engineer', 'viewer'];
const roles = ALL_ROLES.filter((role) => role !== 'admin');

export default function RBAC() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getRbac().then((d) => setPermissions(d)).finally(() => setLoading(false));
  }, []);

  const toggle = (rowIndex, role) => {
    setPermissions((prev) => prev.map((row, index) => index === rowIndex ? { ...row, [role]: row[role] ? 0 : 1 } : row));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateRbac(permissions);
      alert('RBAC permissions updated successfully.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Role-Based Access Control</h1>
      <p className="page-subtitle">Control module access for each role</p>

      <div className="card">
        <div className="card-header">
          <h3>Role Permissions Matrix</h3>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading">Loading RBAC...</div> : (
            <table>
              <thead>
                <tr>
                  <th>Module / Permission</th>
                  {roles.map((role) => <th key={role}>{ROLE_LABELS[role]}</th>)}
                </tr>
              </thead>
              <tbody>
                {permissions.map((row, index) => (
                  <tr key={row.module}>
                    <td style={{ textTransform: 'capitalize' }}>{row.module.replace(/_/g, ' ')}</td>
                    {roles.map((role) => (
                      <td key={role}>
                        <input type="checkbox" className="ui-checkbox" checked={!!row[role]} onChange={() => toggle(index, role)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
