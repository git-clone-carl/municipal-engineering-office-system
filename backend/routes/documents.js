const express = require('express');
const fs = require('fs');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission, requireRole, logAudit, getClientIp } = require('../middleware/rbac');
const {
  canViewDocuments, canUploadDocuments, notifyClient, notifyRole,
} = require('../middleware/access');
const {
  uploadPdf, isPdfSignature, removeUploadedFile, documentPath,
} = require('../middleware/upload');

const router = express.Router();

const REVIEW_STATUSES = ['accepted', 'rejected', 'requires_resubmission', 'pending_review'];

function generateDocumentNo() {
  const year = new Date().getFullYear();
  let sequence = db.prepare('SELECT COUNT(*) AS c FROM application_documents').get().c + 1;
  let documentNo = `DOC-${year}-${String(sequence).padStart(5, '0')}`;
  while (db.prepare('SELECT id FROM application_documents WHERE document_no = ?').get(documentNo)) {
    sequence += 1;
    documentNo = `DOC-${year}-${String(sequence).padStart(5, '0')}`;
  }
  return documentNo;
}

function loadPermitById(permitId) {
  return db.prepare('SELECT * FROM permits WHERE id = ?').get(permitId) || null;
}

function loadDocument(id) {
  return db.prepare('SELECT * FROM application_documents WHERE id = ?').get(id) || null;
}

function documentMetadata(doc) {
  // Never expose stored_name / filesystem paths to the browser.
  return {
    id: doc.id,
    document_no: doc.document_no,
    permit_id: doc.permit_id,
    requirement_id: doc.requirement_id,
    document_type: doc.document_type,
    original_name: doc.original_name,
    mime_type: doc.mime_type,
    file_size: doc.file_size,
    status: doc.status,
    remarks: doc.remarks,
    uploaded_by: doc.uploaded_by,
    uploaded_by_name: doc.uploaded_by_name || null,
    reviewed_by: doc.reviewed_by,
    reviewed_by_name: doc.reviewed_by_name || null,
    reviewed_at: doc.reviewed_at,
    uploaded_at: doc.uploaded_at,
    updated_at: doc.updated_at,
  };
}

function listDocuments(permitId) {
  return db.prepare(`
    SELECT d.*, u.full_name AS uploaded_by_name, r.full_name AS reviewed_by_name
    FROM application_documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    LEFT JOIN users r ON d.reviewed_by = r.id
    WHERE d.permit_id = ?
    ORDER BY d.uploaded_at DESC, d.id DESC
  `).all(permitId).map(documentMetadata);
}

router.get('/permit/:permitId', authenticate, checkPermission('permits'), (req, res) => {
  const permit = loadPermitById(req.params.permitId);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  if (!canViewDocuments(req.user, permit)) {
    return res.status(403).json({ error: 'You do not have access to these documents' });
  }
  res.json({ documents: listDocuments(permit.id) });
});

router.post('/permit/:permitId', authenticate, checkPermission('permits'), uploadPdf, (req, res) => {
  const permit = loadPermitById(req.params.permitId);
  if (!permit) {
    removeUploadedFile(req.file);
    return res.status(404).json({ error: 'Permit not found' });
  }
  if (!canUploadDocuments(req.user, permit)) {
    removeUploadedFile(req.file);
    return res.status(403).json({ error: 'Documents can no longer be uploaded for this application' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'A PDF file is required' });
  }
  if (!isPdfSignature(req.file.path)) {
    removeUploadedFile(req.file);
    return res.status(400).json({ error: 'The uploaded file is not a valid PDF' });
  }

  let requirement = null;
  if (req.body.requirement_id) {
    requirement = db.prepare(
      'SELECT * FROM permit_requirements WHERE id = ? AND permit_id = ?'
    ).get(req.body.requirement_id, permit.id);
    if (!requirement) {
      removeUploadedFile(req.file);
      return res.status(400).json({ error: 'Requirement does not belong to this application' });
    }
  }

  const documentType = String(
    req.body.document_type || requirement?.requirement_name || 'Supporting Document',
  ).trim().slice(0, 150) || 'Supporting Document';

  const documentNo = generateDocumentNo();
  const result = db.prepare(`
    INSERT INTO application_documents
      (document_no, permit_id, client_id, requirement_id, document_type, original_name,
       stored_name, mime_type, file_size, status, uploaded_by, uploaded_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?, 'pending_review', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    documentNo, permit.id, permit.client_id, requirement?.id || null, documentType,
    req.file.originalname, req.file.filename, req.file.size, req.user.id,
  );

  if (requirement && requirement.status !== 'submitted') {
    db.prepare(`
      UPDATE permit_requirements SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(requirement.id);
  }

  logAudit(req.user.id, req.user.username, req.user.role,
    `Uploaded document ${documentNo} for ${permit.application_no}`, getClientIp(req));
  if (req.user.role === 'viewer') {
    notifyRole(['engineering_staff', 'municipal_engineer', 'admin'], 'New Document Uploaded',
      `${req.user.full_name} uploaded ${documentType} for ${permit.application_no}`, 'info', permit.id);
  } else {
    notifyClient(permit.id, 'New Document Uploaded',
      `${documentType} was uploaded to your application ${permit.application_no}`, 'info');
  }

  const created = loadDocument(Number(result.lastInsertRowid));
  res.status(201).json({ document: documentMetadata(created) });
});

router.post('/:id/replace', authenticate, checkPermission('permits'), uploadPdf, (req, res) => {
  const doc = loadDocument(req.params.id);
  if (!doc) {
    removeUploadedFile(req.file);
    return res.status(404).json({ error: 'Document not found' });
  }
  const permit = loadPermitById(doc.permit_id);
  if (!permit || !canUploadDocuments(req.user, permit)) {
    removeUploadedFile(req.file);
    return res.status(403).json({ error: 'You cannot replace this document' });
  }
  if (req.user.role === 'viewer' && doc.status === 'accepted') {
    removeUploadedFile(req.file);
    return res.status(409).json({ error: 'Accepted documents cannot be replaced' });
  }
  if (!req.file) return res.status(400).json({ error: 'A PDF file is required' });
  if (!isPdfSignature(req.file.path)) {
    removeUploadedFile(req.file);
    return res.status(400).json({ error: 'The uploaded file is not a valid PDF' });
  }

  const oldPath = documentPath(doc.stored_name);
  db.prepare(`
    UPDATE application_documents
    SET original_name = ?, stored_name = ?, mime_type = 'application/pdf', file_size = ?,
        status = 'pending_review', remarks = NULL, reviewed_by = NULL, reviewed_at = NULL,
        uploaded_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.file.originalname, req.file.filename, req.file.size, req.user.id, doc.id);
  try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch { /* best effort */ }

  logAudit(req.user.id, req.user.username, req.user.role,
    `Replaced document ${doc.document_no} for ${permit.application_no}`, getClientIp(req));
  notifyRole(['engineering_staff', 'municipal_engineer', 'admin'], 'Document Replaced',
    `${doc.document_type} was replaced for ${permit.application_no}`, 'info', permit.id);

  res.json({ document: documentMetadata(loadDocument(doc.id)) });
});

router.put('/:id/status', authenticate, checkPermission('permits'),
  requireRole('admin', 'engineering_staff', 'municipal_engineer'), (req, res) => {
    const doc = loadDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const permit = loadPermitById(doc.permit_id);
    if (!permit) return res.status(404).json({ error: 'Permit not found' });

    const status = String(req.body?.status || '');
    const remarks = String(req.body?.remarks || '').trim();
    if (!REVIEW_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid document status' });
    }
    if (['rejected', 'requires_resubmission'].includes(status) && !remarks) {
      return res.status(400).json({ error: 'Remarks are required for rejection or resubmission' });
    }

    db.prepare(`
      UPDATE application_documents
      SET status = ?, remarks = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, remarks || null, req.user.id, doc.id);

    if (status === 'accepted' && doc.requirement_id) {
      db.prepare(`
        UPDATE permit_requirements
        SET status = 'submitted', submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP)
        WHERE id = ?
      `).run(doc.requirement_id);
    }

    logAudit(req.user.id, req.user.username, req.user.role,
      `Document ${doc.document_no} marked ${status} for ${permit.application_no}`, getClientIp(req));

    const messages = {
      accepted: 'was accepted',
      rejected: 'was rejected',
      requires_resubmission: 'requires resubmission',
      pending_review: 'is pending review',
    };
    notifyClient(permit.id, 'Document Status Updated',
      `${doc.document_type} ${messages[status]}${remarks ? `. Remarks: ${remarks}` : ''}`,
      status === 'accepted' ? 'success' : status === 'pending_review' ? 'info' : 'warning');

    res.json({ success: true, document: documentMetadata(loadDocument(doc.id)) });
  });

router.get('/:id/file', authenticate, (req, res) => {
  const doc = loadDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const permit = loadPermitById(doc.permit_id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });

  // Cashier has no document access by default. Clients only see their own.
  if (!canViewDocuments(req.user, permit)) {
    return res.status(403).json({ error: 'You do not have access to this document' });
  }

  const filePath = documentPath(doc.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document file is missing on the server' });
  }

  const safeName = String(doc.original_name || 'document.pdf').replace(/["\r\n]/g, '');
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
});

/** Administrative document register (System Administrator). */
router.get('/records', authenticate, requireRole('admin'), (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNumber - 1) * limitNumber;
  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (d.document_no LIKE ? OR d.original_name LIKE ? OR p.application_no LIKE ? OR c.full_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (status) { where += ' AND d.status = ?'; params.push(status); }
  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM application_documents d
    JOIN permits p ON d.permit_id = p.id
    JOIN clients c ON d.client_id = c.id
    WHERE ${where}
  `).get(...params).c;
  const documents = db.prepare(`
    SELECT d.id, d.document_no, d.document_type, d.original_name, d.status, d.file_size,
           d.uploaded_at, d.remarks, p.application_no, c.full_name AS client_name,
           u.full_name AS uploaded_by_name
    FROM application_documents d
    JOIN permits p ON d.permit_id = p.id
    JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE ${where}
    ORDER BY d.uploaded_at DESC, d.id DESC LIMIT ? OFFSET ?
  `).all(...params, limitNumber, offset);
  res.json({ documents, total, page: pageNumber, limit: limitNumber });
});

module.exports = router;
