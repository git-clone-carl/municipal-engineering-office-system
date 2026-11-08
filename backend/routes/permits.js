const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission, requireRole, logAudit, getClientIp } = require('../middleware/rbac');
const {
  ensureClientForUser, canViewPermit, notifyClient, notifyRole,
} = require('../middleware/access');

const router = express.Router();

const DEFAULT_REQUIREMENTS = {
  building: [
    'Certified True Copy of Title',
    'Tax Declaration',
    'Building Plans (Signed & Sealed)',
    'Bill of Materials',
    'Barangay Clearance',
    'Occupancy Permit Application',
  ],
  electrical: ['Electrical Plans', 'Load Computation', 'Tax Declaration', 'Barangay Clearance'],
  occupancy: ['Building Permit', 'Certificate of Completion', 'Fire Safety Certificate', 'Tax Declaration'],
  locational: ['Lot Plan', 'Tax Declaration', 'Barangay Clearance', 'Zoning Clearance'],
  certificate: ['Application Form', 'Valid ID', 'Tax Declaration'],
};

const PERMIT_TYPES = ['building', 'electrical', 'occupancy', 'locational', 'certificate'];

function generateAppNo(type) {
  const prefix = { building: 'BP', electrical: 'EP', occupancy: 'OP', locational: 'LP', certificate: 'CP' }[type] || 'AP';
  const year = new Date().getFullYear();
  let sequence = db.prepare('SELECT COUNT(*) AS c FROM permits WHERE permit_type = ?').get(type).c + 1;
  let applicationNo = `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
  while (db.prepare('SELECT id FROM permits WHERE application_no = ?').get(applicationNo)) {
    sequence += 1;
    applicationNo = `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
  }
  return applicationNo;
}

function getFee(type) {
  const key = `permit_fee_${type}`;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? parseFloat(row.value) || 0 : 0;
}

/** Load a permit and enforce client ownership for viewer accounts. */
function loadPermit(req, res) {
  const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(req.params.id);
  if (!permit) {
    res.status(404).json({ error: 'Permit not found' });
    return null;
  }
  if (!canViewPermit(req.user, permit)) {
    res.status(403).json({ error: 'You do not have access to this application' });
    return null;
  }
  return permit;
}

router.get('/', authenticate, checkPermission('permits'), (req, res) => {
  const { search, status, type, page = 1, limit = 10 } = req.query;
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.min(200, Math.max(1, Number(limit) || 10));
  const offset = (pageNumber - 1) * limitNumber;
  let where = '1=1';
  const params = [];

  // Client accounts only ever see their own applications.
  if (req.user.role === 'viewer') {
    const client = ensureClientForUser(req.user);
    where += ' AND p.client_id = ?';
    params.push(client.id);
  }
  if (search) {
    where += ' AND (p.application_no LIKE ? OR c.full_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  if (status) { where += ' AND p.status = ?'; params.push(status); }
  if (type) { where += ' AND p.permit_type = ?'; params.push(type); }

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM permits p JOIN clients c ON p.client_id = c.id WHERE ${where}
  `).get(...params).c;
  const permits = db.prepare(`
    SELECT p.*, c.full_name as client_name, c.client_id as client_code,
           u.full_name as assigned_staff_name,
           (SELECT COUNT(*) FROM application_documents d WHERE d.permit_id = p.id) as document_count,
           (SELECT COUNT(*) FROM application_documents d WHERE d.permit_id = p.id AND d.status = 'requires_resubmission') as resubmission_count
    FROM permits p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN users u ON p.assigned_staff_id = u.id
    WHERE ${where}
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limitNumber, offset);

  res.json({ permits, total, page: pageNumber, limit: limitNumber });
});

router.get('/:id', authenticate, checkPermission('permits'), (req, res) => {
  const permitRow = loadPermit(req, res);
  if (!permitRow) return;

  const permit = db.prepare(`
    SELECT p.*, c.full_name as client_name, c.client_id as client_code, c.contact_number, c.address,
           c.email as client_email,
           u.full_name as assigned_staff_name,
           e.full_name as approved_by_name,
           r.full_name as rejected_by_name
    FROM permits p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN users u ON p.assigned_staff_id = u.id
    LEFT JOIN users e ON p.approved_by = e.id
    LEFT JOIN users r ON p.rejected_by = r.id
    WHERE p.id = ?
  `).get(req.params.id);

  const requirements = db.prepare('SELECT * FROM permit_requirements WHERE permit_id = ?').all(req.params.id);
  const approvals = db.prepare(`
    SELECT a.*, u.full_name AS engineer_name
    FROM approval_records a
    LEFT JOIN users u ON a.engineer_id = u.id
    WHERE a.permit_id = ?
    ORDER BY a.created_at DESC, a.id DESC
  `).all(req.params.id);
  const documents = db.prepare(`
    SELECT d.id, d.document_no, d.document_type, d.original_name, d.file_size, d.status,
           d.remarks, d.uploaded_at, d.reviewed_at, d.requirement_id,
           u.full_name AS uploaded_by_name, r.full_name AS reviewed_by_name
    FROM application_documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    LEFT JOIN users r ON d.reviewed_by = r.id
    WHERE d.permit_id = ?
    ORDER BY d.uploaded_at DESC, d.id DESC
  `).all(req.params.id);
  const paymentHistory = db.prepare(`
    SELECT pay.id, pay.or_number, pay.amount, pay.payment_method, pay.payment_date,
           u.full_name AS cashier_name
    FROM payments pay
    LEFT JOIN users u ON pay.cashier_id = u.id
    WHERE pay.permit_id = ?
    ORDER BY pay.payment_date DESC, pay.id DESC
  `).all(req.params.id);

  res.json({ ...permit, requirements, approvals, documents, payments: paymentHistory });
});

router.post('/', authenticate, checkPermission('permits'), (req, res) => {
  const {
    permit_type, client_id, application_date, project_location, nature_of_construction,
    building_type, total_floor_area, num_storeys, assigned_staff_id, notes,
  } = req.body;

  if (!PERMIT_TYPES.includes(permit_type)) {
    return res.status(400).json({ error: 'A valid permit type is required' });
  }

  // Clients may only file for their own linked client record.
  let resolvedClientId = client_id;
  let resolvedStaffId = assigned_staff_id || null;
  if (req.user.role === 'viewer') {
    const ownClient = ensureClientForUser(req.user);
    resolvedClientId = ownClient.id;
    resolvedStaffId = null;
  }

  if (!resolvedClientId) {
    return res.status(400).json({ error: 'Permit type and client are required' });
  }
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(resolvedClientId);
  if (!client) return res.status(400).json({ error: 'Client not found' });

  const application_no = generateAppNo(permit_type);
  const total_fee = getFee(permit_type);

  const result = db.prepare(`
    INSERT INTO permits (application_no, permit_type, client_id, application_date, project_location,
      nature_of_construction, building_type, total_floor_area, num_storeys, assigned_staff_id, total_fee, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    application_no, permit_type, resolvedClientId,
    application_date || new Date().toISOString().split('T')[0],
    project_location || '', nature_of_construction || '', building_type || '',
    Number(total_floor_area) || 0, Number(num_storeys) || 1,
    resolvedStaffId, total_fee, notes || '',
  );

  const permitId = Number(result.lastInsertRowid);
  const insertReq = db.prepare('INSERT INTO permit_requirements (permit_id, requirement_name) VALUES (?, ?)');
  for (const requirement of DEFAULT_REQUIREMENTS[permit_type] || []) {
    insertReq.run(permitId, requirement);
  }

  logAudit(req.user.id, req.user.username, req.user.role,
    `Created permit ${application_no}`, getClientIp(req));
  notifyRole(
    ['engineering_staff', 'municipal_engineer', 'admin'],
    'New Permit Application',
    `New ${permit_type} permit application ${application_no} was submitted`,
    'info',
    permitId,
  );
  notifyClient(permitId, 'Application Submitted',
    `Your ${permit_type} permit application ${application_no} was submitted successfully`, 'info');

  res.status(201).json({ id: permitId, application_no });
});

/**
 * General application update. Status is intentionally NOT accepted here:
 * every workflow transition goes through a dedicated, validated endpoint so a
 * user cannot skip staff review or engineer approval by editing a form.
 */
router.put('/:id', authenticate, checkPermission('permits'), (req, res) => {
  const permit = loadPermit(req, res);
  if (!permit) return;
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Clients cannot edit a submitted application' });
  }

  // Financial fields (total_fee, amount_paid) are deliberately excluded. They
  // are set from system settings at creation and by the payment transaction.
  const fields = ['project_location', 'nature_of_construction', 'building_type', 'total_floor_area',
    'num_storeys', 'assigned_staff_id', 'notes'];
  const updates = [];
  const values = [];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }
  if (updates.length) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);
    db.prepare(`UPDATE permits SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  logAudit(req.user.id, req.user.username, req.user.role,
    `Updated permit ${permit.application_no}`, getClientIp(req));
  res.json({ success: true });
});

router.put('/:id/requirements/:reqId', authenticate, checkPermission('permits'),
  requireRole('admin', 'engineering_staff', 'municipal_engineer'), (req, res) => {
    const permit = loadPermit(req, res);
    if (!permit) return;
    const { status } = req.body;
    if (!['pending', 'submitted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid requirement status' });
    }
    const requirement = db.prepare(
      'SELECT id FROM permit_requirements WHERE id = ? AND permit_id = ?'
    ).get(req.params.reqId, req.params.id);
    if (!requirement) return res.status(404).json({ error: 'Requirement not found' });
    db.prepare(`
      UPDATE permit_requirements SET status = ?,
        submitted_at = CASE WHEN ? = 'submitted' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = ? AND permit_id = ?
    `).run(status, status, req.params.reqId, req.params.id);
    logAudit(req.user.id, req.user.username, req.user.role,
      `Updated requirement on ${permit.application_no}`, getClientIp(req));
    res.json({ success: true });
  });

/** Staff: mark a newly submitted application as under review. */
router.post('/:id/review', authenticate, checkPermission('permits'),
  requireRole('admin', 'engineering_staff'), (req, res) => {
    const permit = loadPermit(req, res);
    if (!permit) return;
    if (permit.status !== 'submitted') {
      return res.status(409).json({ error: `Application cannot be reviewed from status "${permit.status}"` });
    }
    db.prepare(`
      UPDATE permits SET status = 'for_review',
        assigned_staff_id = COALESCE(assigned_staff_id, ?),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, permit.id);
    logAudit(req.user.id, req.user.username, req.user.role,
      `Marked permit ${permit.application_no} for review`, getClientIp(req));
    notifyClient(permit.id, 'Application Under Review',
      `Your application ${permit.application_no} is now under review by WNGR staff`, 'info');
    res.json({ success: true, status: 'for_review' });
  });

/** Staff: forward a reviewed application to the Municipal Engineer. */
router.post('/:id/forward', authenticate, checkPermission('permits'),
  requireRole('admin', 'engineering_staff'), (req, res) => {
    const permit = loadPermit(req, res);
    if (!permit) return;
    if (permit.status !== 'for_review') {
      return res.status(409).json({ error: `Application cannot be forwarded from status "${permit.status}"` });
    }
    db.prepare(`
      UPDATE permits SET status = 'for_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(permit.id);
    logAudit(req.user.id, req.user.username, req.user.role,
      `Forwarded permit ${permit.application_no} for approval`, getClientIp(req));
    notifyRole(['municipal_engineer'], 'Application Awaiting Approval',
      `Application ${permit.application_no} was forwarded for engineering approval`, 'warning', permit.id);
    notifyClient(permit.id, 'Forwarded for Approval',
      `Your application ${permit.application_no} was forwarded to the Municipal Engineer`, 'info');
    res.json({ success: true, status: 'for_approval' });
  });

/**
 * Municipal Engineer approval. Payment is NOT required at this stage: the
 * cashier only processes payment after the engineer has approved.
 */
router.post('/:id/approve', authenticate, checkPermission('permits'),
  requireRole('municipal_engineer'), (req, res) => {
    const permit = loadPermit(req, res);
    if (!permit) return;
    if (permit.status !== 'for_approval') {
      return res.status(409).json({
        error: `Only applications with status "for_approval" can be approved (current: ${permit.status})`,
      });
    }
    const remarks = String(req.body?.remarks || '').trim();

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        UPDATE permits SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP,
          rejected_by = NULL, rejected_at = NULL, rejection_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.user.id, permit.id);
      db.prepare(`
        INSERT INTO approval_records (permit_id, engineer_id, decision, remarks, previous_status, new_status)
        VALUES (?, ?, 'approved', ?, ?, 'approved')
      `).run(permit.id, req.user.id, remarks, permit.status);
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }

    logAudit(req.user.id, req.user.username, req.user.role,
      `Approved permit ${permit.application_no}${remarks ? `: ${remarks}` : ''}`, getClientIp(req));
    notifyClient(permit.id, 'Application Approved',
      `Your application ${permit.application_no} was approved by the Municipal Engineer`, 'success');
    notifyRole(['cashier'], 'Approved Application Ready for Payment',
      `Application ${permit.application_no} is approved and ready for payment`, 'success', permit.id);
    notifyRole(['engineering_staff', 'admin'], 'Application Approved',
      `Application ${permit.application_no} was approved by the Municipal Engineer`, 'success', permit.id);

    res.json({ success: true, status: 'approved' });
  });

/** Municipal Engineer rejection. Remarks are mandatory. */
router.post('/:id/reject', authenticate, checkPermission('permits'),
  requireRole('municipal_engineer'), (req, res) => {
    const permit = loadPermit(req, res);
    if (!permit) return;
    if (permit.status !== 'for_approval') {
      return res.status(409).json({
        error: `Only applications with status "for_approval" can be rejected (current: ${permit.status})`,
      });
    }
    const remarks = String(req.body?.remarks || '').trim();
    if (!remarks) {
      return res.status(400).json({ error: 'Rejection remarks are required' });
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        UPDATE permits SET status = 'rejected', rejected_by = ?, rejected_at = CURRENT_TIMESTAMP,
          rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.user.id, remarks, permit.id);
      db.prepare(`
        INSERT INTO approval_records (permit_id, engineer_id, decision, remarks, previous_status, new_status)
        VALUES (?, ?, 'rejected', ?, ?, 'rejected')
      `).run(permit.id, req.user.id, remarks, permit.status);
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }

    logAudit(req.user.id, req.user.username, req.user.role,
      `Rejected permit ${permit.application_no}: ${remarks}`, getClientIp(req));
    notifyClient(permit.id, 'Application Rejected',
      `Your application ${permit.application_no} was rejected. Reason: ${remarks}`, 'danger');
    notifyRole(['engineering_staff', 'admin'], 'Application Rejected',
      `Application ${permit.application_no} was rejected. Reason: ${remarks}`, 'danger', permit.id);

    res.json({ success: true, status: 'rejected' });
  });

/** Staff: release a fully paid permit. */
router.post('/:id/release', authenticate, checkPermission('permits'),
  requireRole('admin', 'engineering_staff'), (req, res) => {
    const permit = loadPermit(req, res);
    if (!permit) return;
    if (permit.status !== 'paid') {
      return res.status(409).json({
        error: `Permit must be fully paid before release (current: ${permit.status})`,
      });
    }
    db.prepare(`
      UPDATE permits SET status = 'released', issued_date = date('now'), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(permit.id);
    logAudit(req.user.id, req.user.username, req.user.role,
      `Released permit ${permit.application_no}`, getClientIp(req));
    notifyClient(permit.id, 'Permit Released',
      `Your permit ${permit.application_no} has been released`, 'success');
    res.json({ success: true, status: 'released' });
  });

module.exports = router;
