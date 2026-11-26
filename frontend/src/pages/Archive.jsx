import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  PERMIT_TYPES, STATUS_LABELS, DOCUMENT_STATUS_LABELS,
  formatCurrency, formatDateTime, formatFileSize,
} from '../components/UI';

export default function Archive() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('permits');
  const [search, setSearch] = useState('');
  const [permits, setPermits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pData, dData] = await Promise.all([
        api.getPermits({ search, archived: '1', page: 1, limit: 100 }),
        api.getArchivedDocuments({ search }),
      ]);
      setPermits(pData.permits || []);
      setDocuments(dData.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const restorePermit = async (permit) => {
    setError('');
    setSuccess('');
    try {
      await api.restorePermit(permit.id);
      setSuccess(`Restored permit application ${permit.application_no}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const restoreDocument = async (doc) => {
    setError('');
    setSuccess('');
    try {
      await api.restoreDocument(doc.id);
      setSuccess(`Restored PDF "${doc.original_name}".`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePermit = async (permit) => {
    if (!confirm(`Permanently delete permit ${permit.application_no}? This cannot be undone.`)) return;
    setError('');
    setSuccess('');
    try {
      await api.deletePermit(permit.id);
      setSuccess(`Deleted permit application ${permit.application_no}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteDocument = async (doc) => {
    if (!confirm(`Permanently delete PDF "${doc.original_name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await api.deleteDocument(doc.id);
      setSuccess(`Deleted PDF "${doc.original_name}".`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">Archive</h1>
      <p className="page-subtitle">Manage and restore archived permit applications and PDF documents</p>

      {error && <div className="login-error">{error}</div>}
      {success && <div className="badge badge-active" style={{ display: 'inline-block', marginBottom: 12 }}>{success}</div>}

      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`tab ${tab === 'permits' ? 'active' : ''}`}
            onClick={() => setTab('permits')}
          >
            Archived Permits ({permits.length})
          </button>
          <button
            type="button"
            className={`tab ${tab === 'documents' ? 'active' : ''}`}
            onClick={() => setTab('documents')}
          >
            Archived PDF Files ({documents.length})
          </button>
        </div>

        <input
          className="form-control"
          style={{ width: 260 }}
          placeholder="Search archive..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="loading">Loading archive...</div>
          ) : tab === 'permits' ? (
            <table>
              <thead>
                <tr>
                  <th>Application No.</th>
                  <th>Client</th>
                  <th>Permit Type</th>
                  <th>Status</th>
                  <th>Total Fee</th>
                  <th>Archived At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {permits.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No archived permit applications.</td></tr>
                ) : permits.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.application_no}</strong></td>
                    <td>{p.client_name}</td>
                    <td>{PERMIT_TYPES[p.permit_type] || p.permit_type}</td>
                    <td><span className={`badge badge-${p.status}`}>{STATUS_LABELS[p.status] || p.status}</span></td>
                    <td>{formatCurrency(p.total_fee)}</td>
                    <td>{p.archived_at ? formatDateTime(p.archived_at) : '-'}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/permits?open=${p.id}`)}
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => restorePermit(p)}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => deletePermit(p)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Application No.</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Archived At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No archived PDF files.</td></tr>
                ) : documents.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.original_name}</strong>
                      <div className="doc-meta">{d.document_no} · {formatFileSize(d.file_size)}</div>
                    </td>
                    <td>{d.application_no}</td>
                    <td>{d.client_name}</td>
                    <td>{d.document_type}</td>
                    <td><span className={`badge badge-${d.status}`}>{DOCUMENT_STATUS_LABELS[d.status] || d.status}</span></td>
                    <td>{d.archived_at ? formatDateTime(d.archived_at) : '-'}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/permits?open=${d.permit_id}`)}
                      >
                        Open Permit
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => restoreDocument(d)}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteDocument(d)}
                      >
                        Delete
                      </button>
                    </td>
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
