const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { subscribeRealtime } = require('../utils/events');

const router = express.Router();

router.get('/stream', (req, res) => {
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  const token = req.query.token || headerToken;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let user;
  try {
    const payload = jwt.verify(String(token), JWT_SECRET);
    user = db.prepare(
      'SELECT id, user_id, username, full_name, role FROM users WHERE id = ? AND status = ?'
    ).get(payload.id, 'active');
    if (!user) return res.status(401).json({ error: 'Account inactive' });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ userId: user.id, role: user.role })}\n\n`);

  const unsubscribe = subscribeRealtime((msg) => {
    const { payload } = msg;
    const matchesUser = !payload.userId || Number(payload.userId) === Number(user.id);
    const matchesRole = !payload.roles || payload.roles.includes(user.role);
    if (matchesUser && matchesRole) {
      res.write(`event: update\ndata: ${JSON.stringify(msg)}\n\n`);
    }
  });

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

router.get('/', authenticate, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id IS NULL OR user_id = ?
    ORDER BY created_at DESC, id DESC LIMIT 30
  `).all(req.user.id);
  const unread = db.prepare(`
    SELECT COUNT(*) as c FROM notifications
    WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0
  `).get(req.user.id).c;
  res.json({ notifications, unread });
});

router.put('/:id/read', authenticate, (req, res) => {
  db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE id = ? AND (user_id IS NULL OR user_id = ?)
  `).run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.put('/read-all', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id IS NULL OR user_id = ?').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
