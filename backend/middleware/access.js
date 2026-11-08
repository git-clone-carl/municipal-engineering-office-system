const db = require('../database/db');

/**
 * Shared authorization / ownership helpers.
 *
 * Client accounts use the existing "viewer" role. A viewer may only see the
 * applications and documents that belong to the client record linked to their
 * user account. Staff, engineers and administrators can see all applications;
 * cashiers have no document access by default.
 */

function getOwnClient(userId) {
  return db.prepare('SELECT * FROM clients WHERE user_id = ?').get(userId) || null;
}

function generateClientId() {
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) AS c FROM clients').get().c;
  return `CL-${year}-${String(count + 1).padStart(5, '0')}`;
}

/**
 * Return the client profile linked to a viewer account, creating and linking
 * one on first use if the account predates the client-portal feature.
 */
function ensureClientForUser(user) {
  const existing = getOwnClient(user.id);
  if (existing) return existing;
  const clientId = generateClientId();
  const result = db.prepare(`
    INSERT INTO clients (client_id, full_name, user_id, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(clientId, user.full_name, user.id);
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(result.lastInsertRowid));
}

function canViewPermit(user, permit) {
  if (!user || !permit) return false;
  if (['admin', 'engineering_staff', 'municipal_engineer'].includes(user.role)) return true;
  if (user.role === 'viewer') {
    const client = getOwnClient(user.id);
    return !!client && Number(permit.client_id) === Number(client.id);
  }
  return false;
}

function canManageDocuments(user) {
  return !!user && ['admin', 'engineering_staff', 'municipal_engineer'].includes(user.role);
}

function canViewDocuments(user, permit) {
  if (canManageDocuments(user)) return true;
  return canViewPermit(user, permit);
}

const CLIENT_UPLOAD_STATUSES = ['submitted', 'for_review', 'for_approval', 'rejected'];

function canUploadDocuments(user, permit) {
  if (!user || !permit) return false;
  if (canManageDocuments(user)) return CLIENT_UPLOAD_STATUSES.includes(permit.status);
  if (user.role !== 'viewer') return false;
  const client = getOwnClient(user.id);
  return !!client
    && Number(client.id) === Number(permit.client_id)
    && CLIENT_UPLOAD_STATUSES.includes(permit.status);
}

function notifyUser(userId, title, message, type = 'info', permitId = null) {
  if (!userId) return;
  db.prepare(`
    INSERT INTO notifications (user_id, permit_id, title, message, type)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, permitId, title, message, type);
}

function notifyRole(roles, title, message, type = 'info', permitId = null) {
  const placeholders = roles.map(() => '?').join(', ');
  db.prepare(`
    INSERT INTO notifications (user_id, permit_id, title, message, type)
    SELECT id, ?, ?, ?, ? FROM users WHERE role IN (${placeholders}) AND status = 'active'
  `).run(permitId, title, message, type, ...roles);
}

function notifyClient(permitId, title, message, type = 'info') {
  const row = db.prepare(`
    SELECT c.user_id
    FROM permits p JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `).get(permitId);
  if (row?.user_id) notifyUser(row.user_id, title, message, type, permitId);
}

module.exports = {
  CLIENT_UPLOAD_STATUSES,
  getOwnClient,
  ensureClientForUser,
  generateClientId,
  canViewPermit,
  canManageDocuments,
  canViewDocuments,
  canUploadDocuments,
  notifyUser,
  notifyRole,
  notifyClient,
};
