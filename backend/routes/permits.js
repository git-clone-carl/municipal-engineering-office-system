const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission, logAudit, getClientIp } = require('../middleware/rbac');

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

function generateAppNo(type) {
  const prefix = { building: 'BP', electrical: 'EP', occupancy: 'OP', locational: 'LP', certificate: 'CP' }[type] || 'AP';
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) as c FROM permits WHERE permit_type = ?').get(type).c;
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

function getFee(type) {
  const key = `permit_fee_${type}`;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? parseFloat(row.value) : 0;
}

router.get('/', authenticate, checkPermission('permits'), (req, res) => {
  const { search, status, type, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];
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
           u.full_name as assigned_staff_name
    FROM permits p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN users u ON p.assigned_staff_id = u.id
    WHERE ${where}
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));
  res.json({ permits, total, page: Number(page), limit: Number(limit) });
});

router.get('/:id', authenticate, checkPermission('permits'), (req, res) => {
  const permit = db.prepare(`
    SELECT p.*, c.full_name as client_name, c.client_id as client_code, c.contact_number, c.address,
           u.full_name as assigned_staff_name
    FROM permits p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN users u ON p.assigned_staff_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  const requirements = db.prepare('SELECT * FROM permit_requirements WHERE permit_id = ?').all(req.params.id);
  res.json({ ...permit, requirements });
});

router.post('/', authenticate, checkPermission('permits'), (req, res) => {
  const {
    permit_type, client_id, application_date, project_location, nature_of_construction,
    building_type, total_floor_area, num_storeys, assigned_staff_id, notes,
  } = req.body;
  if (!permit_type || !client_id) {
    return res.status(400).json({ error: 'Permit type and client are required' });
  }
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(client_id);
  if (!client) return res.status(400).json({ error: 'Client not found' });
  const application_no = generateAppNo(permit_type);
  const total_fee = getFee(permit_type);
  const result = db.prepare(`
    INSERT INTO permits (application_no, permit_type, client_id, application_date, project_location,
      nature_of_construction, building_type, total_floor_area, num_storeys, assigned_staff_id, total_fee, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    application_no, permit_type, client_id,
    application_date || new Date().toISOString().split('T')[0],
    project_location || '', nature_of_construction || '', building_type || '',
    total_floor_area || 0, num_storeys || 1, assigned_staff_id || null, total_fee, notes || ''
  );
  const permitId = result.lastInsertRowid;
  const reqs = DEFAULT_REQUIREMENTS[permit_type] || [];
  const insertReq = db.prepare('INSERT INTO permit_requirements (permit_id, requirement_name) VALUES (?, ?)');
  for (const r of reqs) insertReq.run(permitId, r);
  logAudit(req.user.id, req.user.username, req.user.role, `Created permit ${application_no}`, getClientIp(req));
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    SELECT id, 'New Permit Application', ?, 'info' FROM users WHERE role IN ('engineering_staff','municipal_engineer','admin')
  `).run(`New ${permit_type} permit application ${application_no} submitted`);
  res.status(201).json({ id: permitId, application_no });
});

router.put('/:id', authenticate, checkPermission('permits'), (req, res) => {
  const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(req.params.id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  const fields = ['project_location', 'nature_of_construction', 'building_type', 'total_floor_area',
    'num_storeys', 'assigned_staff_id', 'status', 'notes', 'total_fee'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (updates.length) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);
    db.prepare(`UPDATE permits SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  logAudit(req.user.id, req.user.username, req.user.role, `Updated permit ${permit.application_no}`, getClientIp(req));
  res.json({ success: true });
});

router.put('/:id/requirements/:reqId', authenticate, checkPermission('permits'), (req, res) => {
  const { status } = req.body;
  db.prepare(`
    UPDATE permit_requirements SET status = ?, submitted_at = CASE WHEN ? = 'submitted' THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ? AND permit_id = ?
  `).run(status, status, req.params.reqId, req.params.id);
  res.json({ success: true });
});

router.post('/:id/approve', authenticate, checkPermission('permits'), (req, res) => {
  const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(req.params.id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  if (req.user.role !== 'municipal_engineer' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Municipal Engineer can approve permits' });
  }
  if (permit.amount_paid < permit.total_fee) {
    return res.status(400).json({ error: 'Full payment required before approval' });
  }
  db.prepare(`UPDATE permits SET status = 'approved', issued_date = date('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(req.params.id);
  logAudit(req.user.id, req.user.username, req.user.role, `Approved permit ${permit.application_no}`, getClientIp(req));
  res.json({ success: true });
});

router.post('/:id/release', authenticate, checkPermission('permits'), (req, res) => {
  const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(req.params.id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  if (permit.status !== 'approved') {
    return res.status(400).json({ error: 'Permit must be approved before release' });
  }
  db.prepare(`UPDATE permits SET status = 'released', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
  logAudit(req.user.id, req.user.username, req.user.role, `Released permit ${permit.application_no}`, getClientIp(req));
  res.json({ success: true });
});

module.exports = router;
