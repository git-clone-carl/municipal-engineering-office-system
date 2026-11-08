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

/**
 * Public self-registration is for Client accounts only. Role selection is
 * intentionally ignored here: accepting a client-supplied role would allow
 * anyone to register as an administrator. Staff/engineer/cashier accounts are
 * created by an administrator through /api/users.
 */
router.post('/register', (req, res) => {
  const {
    username, password, full_name, email, contact_number, address,
  } = req.body;

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Full name, username, and password are required' });
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const cleanUsername = String(username).trim();
  const cleanName = String(full_name).trim();
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (existingUser) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const user_id = `USR-${String(count + 1).padStart(3, '0')}`;
  const userRole = 'viewer'; // Client portal account

  let newUserId;
  let linkedClientId;
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare(`
      INSERT INTO users (user_id, username, password, full_name, role, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(user_id, cleanUsername, hash, cleanName, userRole);
    newUserId = Number(result.lastInsertRowid);

    // Link to an existing unlinked client with the same name, or create one.
    const existingClient = db.prepare(
      'SELECT id FROM clients WHERE full_name = ? AND user_id IS NULL ORDER BY id LIMIT 1'
    ).get(cleanName);
    if (existingClient) {
      db.prepare(`
        UPDATE clients SET user_id = ?, email = COALESCE(NULLIF(?, ''), email),
          contact_number = COALESCE(NULLIF(?, ''), contact_number),
          address = COALESCE(NULLIF(?, ''), address), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newUserId, email || '', contact_number || '', address || '', existingClient.id);
      linkedClientId = existingClient.id;
    } else {
      const clientCount = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
      const client_id = `CL-${new Date().getFullYear()}-${String(clientCount + 1).padStart(5, '0')}`;
      const clientResult = db.prepare(`
        INSERT INTO clients (client_id, full_name, contact_number, email, address, user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(client_id, cleanName, contact_number || '', email || '', address || '', newUserId);
      linkedClientId = Number(clientResult.lastInsertRowid);
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }

  const newUser = {
    id: newUserId,
    user_id,
    username: cleanUsername,
    full_name: cleanName,
    role: userRole,
  };

  const token = signToken(newUser);
  logAudit(newUser.id, newUser.username, newUser.role, 'Created client account', getClientIp(req));

  res.status(201).json({
    token,
    user: { ...newUser, client_id: linkedClientId },
  });
});


router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, user_id, username, full_name, role, status FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const client = db.prepare('SELECT id, client_id FROM clients WHERE user_id = ?').get(user.id);
  res.json({ ...user, client_id: client?.client_id || null, client_record_id: client?.id || null });
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
