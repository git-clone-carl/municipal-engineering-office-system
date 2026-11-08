import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  Icon, Modal, CustomSelect, DOCUMENT_STATUS_LABELS, formatDate, formatFileSize,
} from './UI';
import PdfViewer from './PdfViewer';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const UPLOADABLE_PERMIT_STATUSES = ['submitted', 'for_review', 'for_approval', 'rejected'];

export default function DocumentsPanel({ permit, user, onChanged }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [file, setFile] = useState(null);
  const [uploadType, setUploadType] = useState('Supporting Document');
  const [requirementId, setRequirementId] = useState('');
  const [reviewStatus, setReviewStatus] = useState('accepted');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const isClient = user?.role === 'viewer';
  const canReview = ['admin', 'engineering_staff', 'municipal_engineer'].includes(user?.role);
  const permitAllowsUpload = UPLOADABLE_PERMIT_STATUSES.includes(permit?.status);
  const canUpload = permitAllowsUpload && (isClient || ['admin', 'engineering_staff'].includes(user?.role));
  const canDownload = canReview || isClient;

  const load = useCallback(async () => {
    if (!permit?.id) return;
    setLoading(true);
    try {
      const data = await api.getPermitDocuments(permit.id);
      setDocuments(data.documents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [permit?.id]);

  useEffect(() => { load(); }, [load]);

  const resetMessages = () => { setError(''); setSuccess(''); };

  const validateFile = (selected) => {
    if (!selected) return 'Please choose a PDF file.';
    const isPdf = selected.type === 'application/pdf' || /\.pdf$/i.test(selected.name);
    if (!isPdf) return 'Only PDF files are allowed.';
    if (selected.size > MAX_PDF_BYTES) return 'PDF is too large. Maximum size is 10 MB.';
    return '';
  };

  const openUpload = () => {
    resetMessages();
    setFile(null);
    setUploadType('Supporting Document');
    setRequirementId('');
    setUploadOpen(true);
  };

  const openReplace = (doc) => {
    resetMessages();
    setFile(null);
    setReplaceTarget(doc);
  };

  const openReview = (doc) => {
    resetMessages();
    setReviewTarget(doc);
    setReviewStatus(doc.status === 'accepted' ? 'accepted' : 'accepted');
    setReviewRemarks('');
  };

  const submitUpload = async () => {
    const validation = validateFile(file);
    if (validation) return setError(validation);
    setSaving(true);
    resetMessages();
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', uploadType || 'Supporting Document');
      if (requirementId) formData.append('requirement_id', requirementId);
      await api.uploadDocument(permit.id, formData);
      setUploadOpen(false);
      setSuccess('Document uploaded. It is now pending review.');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitReplace = async () => {
    const validation = validateFile(file);
    if (validation) return setError(validation);
    setSaving(true);
    resetMessages();
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.replaceDocument(replaceTarget.id, formData);
      setReplaceTarget(null);
      setSuccess('Document replaced and reset to pending review.');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async () => {
    if (['rejected', 'requires_resubmission'].includes(reviewStatus) && !reviewRemarks.trim()) {
      return setError('Remarks are required when rejecting or requesting resubmission.');
    }
    setSaving(true);
    resetMessages();
    try {
      await api.updateDocumentStatus(reviewTarget.id, reviewStatus, reviewRemarks.trim());
      setReviewTarget(null);
      setSuccess(`Document marked ${DOCUMENT_STATUS_LABELS[reviewStatus]}.`);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const download = async (doc) => {
    try {
      const blob = await api.getDocumentBlob(doc.id, true);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = doc.original_name || 'document.pdf';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  const requirementOptions = [
    { value: '', label: 'Other / Supporting document' },
    ...(permit?.requirements || []).map((r) => ({ value: String(r.id), label: r.requirement_name })),
  ];

  return (
    <div className="card documents-panel">
      <div className="card-header">
        <h3>Application Documents (PDF)</h3>
        {canUpload && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={openUpload}>
            <Icon name="upload" size={14} /> Upload PDF
          </button>
        )}
      </div>

      {error && <div className="login-error" style={{ margin: 12 }}>{error}</div>}
      {success && <div className="badge badge-active" style={{ margin: 12, display: 'inline-block' }}>{success}</div>}

      <div className="table-wrap">
        {loading ? <div className="loading">Loading documents...</div> : (
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No PDF documents uploaded yet.</td></tr>
              ) : documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="doc-name-cell">
                      <Icon name="file" size={16} />
                      <div>
                        <strong>{doc.original_name}</strong>
                        <div className="doc-meta">{doc.document_no} · {formatFileSize(doc.file_size)}</div>
                      </div>
                    </div>
                  </td>
                  <td>{doc.document_type}</td>
                  <td>{formatDate(doc.uploaded_at)}</td>
                  <td>
                    <span className={`badge badge-${doc.status}`}>{DOCUMENT_STATUS_LABELS[doc.status] || doc.status}</span>
                  </td>
                  <td className="doc-remarks">
                    {doc.remarks || '-'}
                    {doc.reviewed_by_name && <div className="doc-meta">by {doc.reviewed_by_name}</div>}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn-icon" title="View PDF" onClick={() => setViewTarget(doc)}>
                        <Icon name="view" size={16} />
                      </button>
                      {canDownload && (
                        <button type="button" className="btn-icon" title="Download PDF" onClick={() => download(doc)}>
                          <Icon name="download" size={16} />
                        </button>
                      )}
                      {canUpload && doc.status !== 'accepted' && (
                        <button type="button" className="btn-icon" title="Replace PDF" onClick={() => openReplace(doc)}>
                          <Icon name="refresh" size={16} />
                        </button>
                      )}
                      {canReview && (
                        <button type="button" className="btn-icon" title="Review document" onClick={() => openReview(doc)}>
                          <Icon name="check" size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload PDF Document"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setUploadOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitUpload} disabled={saving}>
              {saving ? 'Uploading...' : 'Upload PDF'}
            </button>
          </>
        }
      >
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label>Requirement</label>
          <CustomSelect
            value={requirementId}
            onChange={(value) => {
              setRequirementId(value);
              const requirement = (permit.requirements || []).find((r) => String(r.id) === String(value));
              setUploadType(requirement ? requirement.requirement_name : 'Supporting Document');
            }}
            options={requirementOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div className="form-group">
          <label>Document Type / Description</label>
          <input className="form-control" value={uploadType} onChange={(e) => setUploadType(e.target.value)} />
        </div>
        <div className="form-group">
          <label>PDF File (max 10 MB)</label>
          <input
            className="form-control"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
      </Modal>

      <Modal
        open={!!replaceTarget}
        onClose={() => setReplaceTarget(null)}
        title={`Replace ${replaceTarget?.document_type || 'Document'}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReplaceTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitReplace} disabled={saving}>
              {saving ? 'Uploading...' : 'Replace PDF'}
            </button>
          </>
        }
      >
        {error && <div className="login-error">{error}</div>}
        <p className="page-subtitle">The replacement resets the document status to Pending Review.</p>
        <div className="form-group">
          <label>New PDF File (max 10 MB)</label>
          <input
            className="form-control"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
      </Modal>

      <Modal
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title={`Review ${reviewTarget?.original_name || 'Document'}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReviewTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitReview} disabled={saving}>
              {saving ? 'Saving...' : 'Save Decision'}
            </button>
          </>
        }
      >
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label>Document Status</label>
          <CustomSelect
            value={reviewStatus}
            onChange={setReviewStatus}
            options={[
              { value: 'accepted', label: 'Accepted' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'requires_resubmission', label: 'Requires Resubmission' },
              { value: 'pending_review', label: 'Pending Review' },
            ]}
            style={{ width: '100%' }}
          />
        </div>
        <div className="form-group">
          <label>Remarks {['rejected', 'requires_resubmission'].includes(reviewStatus) ? '*' : '(optional)'}</label>
          <textarea
            className="form-control"
            rows={4}
            value={reviewRemarks}
            onChange={(e) => setReviewRemarks(e.target.value)}
            placeholder="Explain what the client needs to correct..."
          />
        </div>
      </Modal>

      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="PDF Viewer" large>
        {viewTarget && (
          <PdfViewer
            document={viewTarget}
            canDownload={canDownload}
            onClose={() => setViewTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}
