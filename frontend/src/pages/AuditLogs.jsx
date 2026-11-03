import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Pagination } from '../components/UI';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAuditLogs({ search, page, limit: 20 })
      .then((d) => {
        setLogs(d.logs);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div>
      <h1 className="page-title">Audit Logs</h1>
      <p className="page-subtitle">Track system activity and security events</p>

      <div className="toolbar">
        <div className="toolbar-left">
          <input className="form-control" style={{ width: 280 }} placeholder="Search user, role, or action..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading">Loading logs...</div> : (
            <table>
              <thead>
                <tr><th>Log ID</th><th>User</th><th>Role</th><th>Action</th><th>Date</th><th>Time</th><th>IP Address</th></tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No audit logs found.</td></tr>
                ) : logs.map((log) => (
                  <tr key={log.id}>
                    <td>LOG-{String(log.id).padStart(5, '0')}</td>
                    <td>{log.username || '-'}</td>
                    <td>{log.role || '-'}</td>
                    <td>{log.action}</td>
                    <td>{log.date}</td>
                    <td>{log.time}</td>
                    <td>{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0 16px' }}>
          <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
