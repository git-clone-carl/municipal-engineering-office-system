const db = require('../database/db');

function checkPermission(module) {
  return (req, res, next) => {
    const perm = db.prepare('SELECT * FROM role_permissions WHERE module = ?').get(module);
    if (!perm) return res.status(403).json({ error: 'Module not found' });
    const role = req.user.role;
    const allowed = perm[role];
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied for this module' });
    }
    next();
  };
}

function logAudit(userId, username, role, action, ip) {
  db.prepare(`
    INSERT INTO audit_logs (user_id, username, role, action, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, username, role, action, ip);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

module.exports = { checkPermission, logAudit, getClientIp };
