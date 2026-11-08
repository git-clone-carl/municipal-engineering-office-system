const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { ROLE_KEYS, checkPermission, logAudit, getClientIp } = require('../middleware/rbac');

const router = express.Router();

function activeAdminCount() {
  return db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND status = 'active'").get().c;
}

function generateUserId() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  return `USR-${String(count + 1).padStart(3, '0')}`;
}

router.get('/', authenticate, checkPermission('users'), (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (full_name LIKE ? OR username LIKE ? OR user_id LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where}`).get(...params).c;
  const users = db.prepare(`
    SELECT id, user_id, username, full_name, role, status, created_at
    FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));
  res.json({ users, total, page: Number(page), limit: Number(limit) });
});

router.get('/staff', authenticate, (req, res) => {
  const staff = db.prepare(`
    SELECT id, user_id, full_name, role FROM users
    WHERE status = 'active' AND role IN ('engineering_staff','municipal_engineer','admin')
    ORDER BY full_name
  `).all();
  res.json(staff);
});

router.post('/', authenticate, checkPermission('users'), (req, res) => {
  const { username, password, full_name, role, status = 'active' } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (!ROLE_KEYS.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Invalid account status' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(String(username).trim());
  if (exists) return res.status(400).json({ error: 'Username already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const user_id = generateUserId();
  const result = db.prepare(`
    INSERT INTO users (user_id, username, password, full_name, role, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user_id, String(username).trim(), hash, String(full_name).trim(), role, status);
  logAudit(req.user.id, req.user.username, req.user.role, `Created user ${username}`, getClientIp(req));
  res.status(201).json({ id: result.lastInsertRowid, user_id });
});

router.put('/:id', authenticate, checkPermission('users'), (req, res) => {
  const { full_name, role, status, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const nextRole = role || user.role;
  const nextStatus = status || user.status;
  if (!ROLE_KEYS.includes(nextRole)) return res.status(400).json({ error: 'Invalid role' });
  if (!['active', 'inactive'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid account status' });
  }
  if (Number(req.params.id) === req.user.id && (nextRole !== user.role || nextStatus !== 'active')) {
    return res.status(400).json({ error: 'You cannot change your own role or deactivate your own account' });
  }
  if (user.role === 'admin' && user.status === 'active'
    && (nextRole !== 'admin' || nextStatus !== 'active') && activeAdminCount() <= 1) {
    return res.status(400).json({ error: 'At least one active administrator account must remain' });
  }
  if (password && String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET full_name=?, role=?, status=?, password=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(full_name || user.full_name, nextRole, nextStatus, hash, req.params.id);
  } else {
    db.prepare('UPDATE users SET full_name=?, role=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(full_name || user.full_name, nextRole, nextStatus, req.params.id);
  }
  logAudit(req.user.id, req.user.username, req.user.role,
    `Updated user ${user.username} (role=${nextRole}, status=${nextStatus})`, getClientIp(req));
  res.json({ success: true });
});

router.delete('/:id', authenticate, checkPermission('users'), (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const user = db.prepare('SELECT username, role, status FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin' && user.status === 'active' && activeAdminCount() <= 1) {
    return res.status(400).json({ error: 'At least one active administrator account must remain' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, req.user.role, `Deleted user ${user.username}`, getClientIp(req));
  res.json({ success: true });
});

module.exports = router;
