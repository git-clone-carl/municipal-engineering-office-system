const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { ensureClientForUser } = require('../middleware/access');

const router = express.Router();

/**
 * Client accounts (viewer role) only see their own figures. Staff, engineers,
 * cashiers and administrators see office-wide figures as before.
 */
function scope(req) {
  if (req.user.role !== 'viewer') return { sql: '', params: [] };
  const client = ensureClientForUser(req.user);
  return { sql: ' AND p.client_id = ?', params: [client.id], client };
}

router.get('/stats', authenticate, checkPermission('dashboard'), (req, res) => {
  const { sql, params, client } = scope(req);
  const totalClients = client ? 1 : db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
  const pendingRequests = db.prepare(`
    SELECT COUNT(*) as c FROM permits p
    WHERE p.status IN ('submitted','for_review','for_payment','for_approval')${sql}
  `).get(...params).c;
  const approvedPermits = db.prepare(`
    SELECT COUNT(*) as c FROM permits p WHERE p.status IN ('approved','paid','released')${sql}
  `).get(...params).c;
  const releasedDocs = db.prepare(`
    SELECT COUNT(*) as c FROM permits p WHERE p.status = 'released'${sql}
  `).get(...params).c;
  const forApproval = db.prepare(`
    SELECT COUNT(*) as c FROM permits p WHERE p.status = 'for_approval'${sql}
  `).get(...params).c;
  const awaitingPayment = db.prepare(`
    SELECT COUNT(*) as c FROM permits p WHERE p.status = 'approved' AND p.amount_paid < p.total_fee${sql}
  `).get(...params).c;

  const paymentScope = client ? ' AND pay.client_id = ?' : '';
  const todayTransactions = db.prepare(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as total FROM payments pay
    WHERE date(payment_date) = date('now')${paymentScope}
  `).get(...params);
  const monthlyRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM payments pay
    WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')${paymentScope}
  `).get(...params).total;

  res.json({
    totalClients,
    pendingRequests,
    approvedPermits,
    releasedDocs,
    forApproval,
    awaitingPayment,
    todayTransactions: todayTransactions.c,
    todayRevenue: todayTransactions.total,
    monthlyRevenue,
  });
});

router.get('/monthly-permits', authenticate, checkPermission('dashboard'), (req, res) => {
  const { sql, params } = scope(req);
  const data = db.prepare(`
    SELECT strftime('%Y-%m', p.application_date) as month, COUNT(*) as count
    FROM permits p
    WHERE p.application_date >= date('now', '-12 months')${sql}
    GROUP BY month ORDER BY month
  `).all(...params);
  res.json(data);
});

router.get('/status-distribution', authenticate, checkPermission('dashboard'), (req, res) => {
  const { sql, params } = scope(req);
  const data = db.prepare(`
    SELECT p.status, COUNT(*) as count FROM permits p WHERE 1=1${sql} GROUP BY p.status
  `).all(...params);
  res.json(data);
});

router.get('/weekly-transactions', authenticate, checkPermission('dashboard'), (req, res) => {
  const client = req.user.role === 'viewer' ? ensureClientForUser(req.user) : null;
  const paymentScope = client ? ' AND pay.client_id = ?' : '';
  const params = client ? [client.id] : [];
  const data = db.prepare(`
    SELECT date(pay.payment_date) as day, COUNT(*) as count, COALESCE(SUM(pay.amount),0) as total
    FROM payments pay WHERE pay.payment_date >= date('now', '-7 days')${paymentScope}
    GROUP BY day ORDER BY day
  `).all(...params);
  res.json(data);
});

router.get('/recent-activities', authenticate, checkPermission('dashboard'), (req, res) => {
  const { sql, params } = scope(req);
  const activities = db.prepare(`
    SELECT p.application_no, c.full_name as client_name, p.permit_type, p.status,
           u.full_name as assigned_staff, p.updated_at as date_time
    FROM permits p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN users u ON p.assigned_staff_id = u.id
    WHERE 1=1${sql}
    ORDER BY p.updated_at DESC LIMIT 10
  `).all(...params);
  res.json(activities);
});

module.exports = router;
