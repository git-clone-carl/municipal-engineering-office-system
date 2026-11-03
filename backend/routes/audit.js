const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

const router = express.Router();

router.get('/', authenticate, checkPermission('audit_logs'), (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (username LIKE ? OR action LIKE ? OR role LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM audit_logs WHERE ${where}`).get(...params).c;
  const logs = db.prepare(`
    SELECT id, username, role, action, ip_address,
           date(created_at) as date, time(created_at) as time, created_at
    FROM audit_logs WHERE ${where}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));
  res.json({ logs, total, page: Number(page), limit: Number(limit) });
});

module.exports = router;
