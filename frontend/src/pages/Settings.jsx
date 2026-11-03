import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatDateTime } from '../components/UI';

export default function Settings() {
  const [tab, setTab] = useState('office');
  const [office, setOffice] = useState(null);
  const [system, setSystem] = useState({});
  const [backupInfo, setBackupInfo] = useState({ backups: [], lastBackup: null });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [officeData, systemData, backupData] = await Promise.all([
        api.getOfficeInfo(),
        api.getSystemSettings(),
        api.getBackupInfo(),
      ]);
      setOffice(officeData);
      setSystem(systemData);
      setBackupInfo(backupData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveOffice = async () => {
    await api.updateOfficeInfo(office);
    alert('Office information updated.');
  };

  const saveSystem = async () => {
    await api.updateSystemSettings(system);
    alert('System settings updated.');
  };

  const backupNow = async () => {
    await api.createBackup();
    await load();
    alert('Backup created successfully.');
  };

  const restore = async (filename) => {
    if (!confirm(`Restore backup ${filename}?`)) return;
    const result = await api.restoreBackup(filename);
    alert(result.message);
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Manage office, LAN, security, and backup settings</p>

      <div className="tabs">
        <button className={`tab ${tab === 'office' ? 'active' : ''}`} onClick={() => setTab('office')}>Office Info</button>
        <button className={`tab ${tab === 'system' ? 'active' : ''}`} onClick={() => setTab('system')}>LAN Configuration</button>
        <button className={`tab ${tab === 'backup' ? 'active' : ''}`} onClick={() => setTab('backup')}>Backup / Restore</button>
      </div>

      {tab === 'office' && office && (
        <div className="card">
          <div className="card-header">
            <h3>Office Information</h3>
            <button className="btn btn-primary" onClick={saveOffice}>Save Changes</button>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label>Office Name</label>
                <input className="form-control" value={office.office_name || ''} onChange={(e) => setOffice({ ...office, office_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Municipality</label>
                <input className="form-control" value={office.municipality || ''} onChange={(e) => setOffice({ ...office, municipality: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Contact Number</label>
                <input className="form-control" value={office.contact_number || ''} onChange={(e) => setOffice({ ...office, contact_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-control" value={office.email || ''} onChange={(e) => setOffice({ ...office, email: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input className="form-control" value={office.address || ''} onChange={(e) => setOffice({ ...office, address: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Municipal Engineer</label>
              <input className="form-control" value={office.municipal_engineer || ''} onChange={(e) => setOffice({ ...office, municipal_engineer: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {tab === 'system' && (
        <div className="card">
          <div className="card-header">
            <h3>LAN Configuration</h3>
            <button className="btn btn-primary" onClick={saveSystem}>Save Changes</button>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label>Server Name</label>
                <input className="form-control" value={system.server_name || ''} onChange={(e) => setSystem({ ...system, server_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Local IP Address</label>
                <input className="form-control" value={system.local_ip || ''} onChange={(e) => setSystem({ ...system, local_ip: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Subnet Mask</label>
                <input className="form-control" value={system.subnet_mask || ''} onChange={(e) => setSystem({ ...system, subnet_mask: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Gateway</label>
                <input className="form-control" value={system.gateway || ''} onChange={(e) => setSystem({ ...system, gateway: e.target.value })} />
              </div>
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label>Building Permit Fee</label>
                <input className="form-control" value={system.permit_fee_building || ''} onChange={(e) => setSystem({ ...system, permit_fee_building: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Electrical Permit Fee</label>
                <input className="form-control" value={system.permit_fee_electrical || ''} onChange={(e) => setSystem({ ...system, permit_fee_electrical: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Occupancy Permit Fee</label>
                <input className="form-control" value={system.permit_fee_occupancy || ''} onChange={(e) => setSystem({ ...system, permit_fee_occupancy: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Locational Clearance Fee</label>
                <input className="form-control" value={system.permit_fee_locational || ''} onChange={(e) => setSystem({ ...system, permit_fee_locational: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Certificate Fee</label>
                <input className="form-control" value={system.permit_fee_certificate || ''} onChange={(e) => setSystem({ ...system, permit_fee_certificate: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'backup' && (
        <div className="card">
          <div className="card-header">
            <h3>Database Backup</h3>
            <button className="btn btn-primary" onClick={backupNow}>Backup Now</button>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>Last Backup</label>
              <p>{backupInfo.lastBackup ? `${backupInfo.lastBackup.filename} - ${formatDateTime(backupInfo.lastBackup.date)}` : 'No backup created yet.'}</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Filename</th><th>Size</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {backupInfo.backups.map((backup) => (
                    <tr key={backup.filename}>
                      <td>{backup.filename}</td>
                      <td>{(backup.size / 1024).toFixed(2)} KB</td>
                      <td>{formatDateTime(backup.date)}</td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => restore(backup.filename)}>Restore</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
