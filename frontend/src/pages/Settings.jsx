import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatDateTime } from '../components/UI';

export default function Settings() {
  const [tab, setTab] = useState('office');
  const [office, setOffice] = useState(null);
  const [system, setSystem] = useState({});
  const [backupInfo, setBackupInfo] = useState({ backups: [], lastBackup: null });
  const [loading, setLoading] = useState(true);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

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

  const handleSendTestEmail = async () => {
    setEmailStatus(null);
    if (!testEmailTo.trim()) {
      setEmailStatus({ type: 'error', text: 'Please enter a recipient email address to test.' });
      return;
    }
    setTestingEmail(true);
    try {
      await api.updateSystemSettings(system);
      const res = await api.sendTestEmail(testEmailTo.trim());
      setEmailStatus({ type: 'success', text: res.message || 'Test email sent.' });
    } catch (err) {
      setEmailStatus({ type: 'error', text: err.message || 'Failed to send test email.' });
    } finally {
      setTestingEmail(false);
    }
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
        <button className={`tab ${tab === 'system' ? 'active' : ''}`} onClick={() => setTab('system')}>LAN &amp; Fees</button>
        <button className={`tab ${tab === 'email' ? 'active' : ''}`} onClick={() => setTab('email')}>Email (SMTP)</button>
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
                <label>Certificate of Annual Inspection Fee</label>
                <input className="form-control" value={system.permit_fee_annual_inspection || ''} onChange={(e) => setSystem({ ...system, permit_fee_annual_inspection: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Certificate Fee</label>
                <input className="form-control" value={system.permit_fee_certificate || ''} onChange={(e) => setSystem({ ...system, permit_fee_certificate: e.target.value })} />
              </div>
            </div>
            <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
            <h4 style={{ margin: '0 0 12px' }}>Printed Permit Signatories</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Assessed By (Name)</label>
                <input className="form-control" value={system.assessed_by_name || 'Engr. Jer Anthony F. Palo'} onChange={(e) => setSystem({ ...system, assessed_by_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Assessed By (Title)</label>
                <input className="form-control" value={system.assessed_by_title || 'Engineer III'} onChange={(e) => setSystem({ ...system, assessed_by_title: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Approved By (Name)</label>
                <input className="form-control" value={system.approved_by_name || 'Engr. Aireen Mañago-Ubas'} onChange={(e) => setSystem({ ...system, approved_by_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Approved By (Title)</label>
                <input className="form-control" value={system.approved_by_title || 'Building Official'} onChange={(e) => setSystem({ ...system, approved_by_title: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'email' && (
        <div className="card">
          <div className="card-header">
            <h3>Email Notification Settings (Nodemailer / SMTP)</h3>
            <button className="btn btn-primary" onClick={saveSystem}>Save SMTP Settings</button>
          </div>
          <div className="card-body">
            <p className="page-subtitle" style={{ marginBottom: 16 }}>
              Configure SMTP credentials so the system automatically emails clients when their permit application is pending (submitted, under review, or for approval), approved, disapproved/rejected, or released.
              For Gmail, use <code>smtp.gmail.com</code>, port <code>587</code>, and a Google App Password.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>SMTP Host</label>
                <input
                  className="form-control"
                  placeholder="e.g. smtp.gmail.com"
                  value={system.smtp_host || ''}
                  onChange={(e) => setSystem({ ...system, smtp_host: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>SMTP Port</label>
                <input
                  className="form-control"
                  placeholder="587 (TLS) or 465 (SSL)"
                  value={system.smtp_port || '587'}
                  onChange={(e) => setSystem({ ...system, smtp_port: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>SMTP Username (Email)</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="office@gmail.com"
                  value={system.smtp_user || ''}
                  onChange={(e) => setSystem({ ...system, smtp_user: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>SMTP Password / App Password</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder="App password"
                  value={system.smtp_pass || ''}
                  onChange={(e) => setSystem({ ...system, smtp_pass: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>From Email (optional, defaults to SMTP Username)</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="engineering@gumaca.gov.ph"
                  value={system.smtp_from || ''}
                  onChange={(e) => setSystem({ ...system, smtp_from: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Use SSL/TLS (Port 465)</label>
                <select
                  className="form-control"
                  value={system.smtp_secure || 'false'}
                  onChange={(e) => setSystem({ ...system, smtp_secure: e.target.value })}
                >
                  <option value="false">No (STARTTLS / Port 587)</option>
                  <option value="true">Yes (SSL / Port 465)</option>
                </select>
              </div>
            </div>

            <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
            <h4 style={{ margin: '0 0 10px' }}>Send Test Email</h4>
            {emailStatus && (
              <div
                className={emailStatus.type === 'error' ? 'login-error' : 'badge badge-active'}
                style={{ display: 'block', marginBottom: 12, padding: '8px 12px' }}
              >
                {emailStatus.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: 480 }}>
              <input
                className="form-control"
                type="email"
                placeholder="recipient@example.com"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
                disabled={testingEmail}
                onClick={handleSendTestEmail}
              >
                {testingEmail ? 'Sending...' : 'Send Test'}
              </button>
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
