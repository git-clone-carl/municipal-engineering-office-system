const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'municipal-engineering-lan-secret-key-2024';

/**
 * Verify the JWT and then re-read the account on every request. This means a
 * deactivated account or a role change takes effect immediately instead of
 * waiting for the 8 hour token to expire. The database is the source of truth
 * for role-based access - never the token payload alone.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(
      'SELECT id, user_id, username, full_name, role FROM users WHERE id = ? AND status = ?'
    ).get(payload.id, 'active');
    if (!user) return res.status(401).json({ error: 'Account is inactive or no longer exists' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

module.exports = { authenticate, signToken, JWT_SECRET };
