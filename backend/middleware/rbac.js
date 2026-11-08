const db = require('../database/db');

const ROLE_KEYS = ['admin', 'engineering_staff', 'cashier', 'municipal_engineer', 'viewer'];

/** Hard role gate for actions that must never be delegated through the RBAC matrix. */
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Your role is not authorized for this action' });
    }
    next();
  };
}

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

module.exports = { ROLE_KEYS, checkPermission, requireRole, logAudit, getClientIp };
