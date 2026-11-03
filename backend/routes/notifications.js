const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission, logAudit, getClientIp } = require('../middleware/rbac');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id IS NULL OR user_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(req.user.id);
  const unread = db.prepare(`
    SELECT COUNT(*) as c FROM notifications
    WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0
  `).get(req.user.id).c;
  res.json({ notifications, unread });
});

router.put('/:id/read', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/read-all', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id IS NULL OR user_id = ?').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
