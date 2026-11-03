const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

const router = express.Router();

router.get('/stats', authenticate, checkPermission('dashboard'), (req, res) => {
  const totalClients = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
  const pendingRequests = db.prepare(`
    SELECT COUNT(*) as c FROM permits WHERE status IN ('submitted','for_review','for_payment','for_approval')
  `).get().c;
  const approvedPermits = db.prepare("SELECT COUNT(*) as c FROM permits WHERE status IN ('approved','released')").get().c;
  const releasedDocs = db.prepare("SELECT COUNT(*) as c FROM permits WHERE status = 'released'").get().c;
  const todayTransactions = db.prepare(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as total FROM payments WHERE date(payment_date) = date('now')
  `).get();
  const monthlyRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM payments
    WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')
  `).get().total;

  res.json({
    totalClients,
    pendingRequests,
    approvedPermits,
    releasedDocs,
    todayTransactions: todayTransactions.c,
    todayRevenue: todayTransactions.total,
    monthlyRevenue,
  });
});

router.get('/monthly-permits', authenticate, checkPermission('dashboard'), (req, res) => {
  const data = db.prepare(`
    SELECT strftime('%Y-%m', application_date) as month, COUNT(*) as count
    FROM permits
    WHERE application_date >= date('now', '-12 months')
    GROUP BY month ORDER BY month
  `).all();
  res.json(data);
});

router.get('/status-distribution', authenticate, checkPermission('dashboard'), (req, res) => {
  const data = db.prepare(`
    SELECT status, COUNT(*) as count FROM permits GROUP BY status
  `).all();
  res.json(data);
});

router.get('/weekly-transactions', authenticate, checkPermission('dashboard'), (req, res) => {
  const data = db.prepare(`
    SELECT date(payment_date) as day, COUNT(*) as count, COALESCE(SUM(amount),0) as total
    FROM payments WHERE payment_date >= date('now', '-7 days')
    GROUP BY day ORDER BY day
  `).all();
  res.json(data);
});

router.get('/recent-activities', authenticate, checkPermission('dashboard'), (req, res) => {
  const activities = db.prepare(`
    SELECT p.application_no, c.full_name as client_name, p.permit_type, p.status,
           u.full_name as assigned_staff, p.updated_at as date_time
    FROM permits p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN users u ON p.assigned_staff_id = u.id
    ORDER BY p.updated_at DESC LIMIT 10
  `).all();
  res.json(activities);
});

module.exports = router;
