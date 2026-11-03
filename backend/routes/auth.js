const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { signToken, authenticate } = require('../middleware/auth');
const { logAudit, getClientIp } = require('../middleware/rbac');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = ?').get(username, 'active');
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user);
  logAudit(user.id, user.username, user.role, 'Logged in', getClientIp(req));
  res.json({
    token,
    user: {
      id: user.id,
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    },
  });
});

router.post('/register', (req, res) => {
  const { username, password, full_name, role = 'viewer' } = req.body;

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Full name, username, and password are required' });
  }

  if (username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existingUser) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  const allowedRoles = ['admin', 'engineering_staff', 'cashier', 'municipal_engineer', 'viewer'];
  const userRole = allowedRoles.includes(role) ? role : 'viewer';

  const hash = bcrypt.hashSync(password, 10);
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const user_id = `USR-${String(count + 1).padStart(3, '0')}`;

  const result = db.prepare(`
    INSERT INTO users (user_id, username, password, full_name, role, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(user_id, username.trim(), hash, full_name.trim(), userRole);

  const newUserId = Number(result.lastInsertRowid);

  // Auto-connect Citizen/Viewer registrations with a linked Client profile if viewer
  if (userRole === 'viewer') {
    const existingClient = db.prepare('SELECT id FROM clients WHERE full_name = ?').get(full_name.trim());
    if (!existingClient) {
      const clientCount = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
      const client_id = `CLT-${String(clientCount + 1).padStart(3, '0')}`;
      db.prepare(`
        INSERT INTO clients (client_id, full_name, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(client_id, full_name.trim());
    }
  }

  const newUser = {
    id: newUserId,
    user_id,
    username: username.trim(),
    full_name: full_name.trim(),
    role: userRole,
  };

  const token = signToken(newUser);
  logAudit(newUser.id, newUser.username, newUser.role, 'Created account', getClientIp(req));

  res.status(201).json({
    token,
    user: newUser,
  });
});


router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, user_id, username, full_name, role, status FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.get('/permissions', authenticate, (req, res) => {
  const perms = db.prepare('SELECT * FROM role_permissions').all();
  const role = req.user.role;
  const allowed = perms.filter((p) => p[role]).map((p) => p.module);
  res.json({ modules: allowed, matrix: perms });
});

router.get('/lan-status', (req, res) => {
  const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('server_name','local_ip','subnet_mask','gateway')").all();
  const config = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  res.json({ connected: true, ...config });
});

module.exports = router;
