const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission, logAudit, getClientIp } = require('../middleware/rbac');

const router = express.Router();

function generateClientId() {
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
  return `CL-${year}-${String(count + 1).padStart(5, '0')}`;
}

router.get('/', authenticate, checkPermission('clients'), (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (full_name LIKE ? OR client_id LIKE ? OR email LIKE ? OR contact_number LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM clients WHERE ${where}`).get(...params).c;
  const clients = db.prepare(`
    SELECT * FROM clients WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));
  res.json({ clients, total, page: Number(page), limit: Number(limit) });
});

router.get('/:id', authenticate, checkPermission('clients'), (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

router.post('/', authenticate, checkPermission('clients'), (req, res) => {
  const { full_name, contact_number, email, address } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Client name is required' });
  const client_id = generateClientId();
  const result = db.prepare(`
    INSERT INTO clients (client_id, full_name, contact_number, email, address)
    VALUES (?, ?, ?, ?, ?)
  `).run(client_id, full_name, contact_number || '', email || '', address || '');
  logAudit(req.user.id, req.user.username, req.user.role, `Created client ${full_name}`, getClientIp(req));
  res.status(201).json({ id: result.lastInsertRowid, client_id });
});

router.put('/:id', authenticate, checkPermission('clients'), (req, res) => {
  const { full_name, contact_number, email, address } = req.body;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  db.prepare(`
    UPDATE clients SET full_name=?, contact_number=?, email=?, address=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(full_name || client.full_name, contact_number ?? client.contact_number, email ?? client.email, address ?? client.address, req.params.id);
  logAudit(req.user.id, req.user.username, req.user.role, `Updated client ${client.full_name}`, getClientIp(req));
  res.json({ success: true });
});

router.delete('/:id', authenticate, checkPermission('clients'), (req, res) => {
  const client = db.prepare('SELECT full_name FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const hasPermits = db.prepare('SELECT id FROM permits WHERE client_id = ? LIMIT 1').get(req.params.id);
  if (hasPermits) return res.status(400).json({ error: 'Cannot delete client with existing permits' });
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, req.user.role, `Deleted client ${client.full_name}`, getClientIp(req));
  res.json({ success: true });
});

module.exports = router;
