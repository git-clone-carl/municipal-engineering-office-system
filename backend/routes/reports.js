const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

const router = express.Router();

router.get('/collection', authenticate, checkPermission('reports'), (req, res) => {
  const { from, to } = req.query;
  let where = '1=1';
  const params = [];
  if (from) { where += ' AND date(pay.payment_date) >= ?'; params.push(from); }
  if (to) { where += ' AND date(pay.payment_date) <= ?'; params.push(to); }

  const summary = db.prepare(`
    SELECT p.permit_type, COUNT(pay.id) as transaction_count, COALESCE(SUM(pay.amount),0) as total_amount
    FROM payments pay
    JOIN permits p ON pay.permit_id = p.id
    WHERE ${where}
    GROUP BY p.permit_type ORDER BY total_amount DESC
  `).all(...params);

  const grandTotal = summary.reduce((s, r) => s + r.total_amount, 0);
  const details = db.prepare(`
    SELECT pay.or_number, pay.payment_date, c.full_name as client_name, p.permit_type,
           pay.amount, u.full_name as cashier
    FROM payments pay
    JOIN clients c ON pay.client_id = c.id
    JOIN permits p ON pay.permit_id = p.id
    LEFT JOIN users u ON pay.cashier_id = u.id
    WHERE ${where}
    ORDER BY pay.payment_date DESC
  `).all(...params);

  res.json({ summary, grandTotal, details, from, to });
});

router.get('/permits', authenticate, checkPermission('reports'), (req, res) => {
  const { from, to, status, type } = req.query;
  let where = '1=1';
  const params = [];
  if (from) { where += ' AND date(p.application_date) >= ?'; params.push(from); }
  if (to) { where += ' AND date(p.application_date) <= ?'; params.push(to); }
  if (status) { where += ' AND p.status = ?'; params.push(status); }
  if (type) { where += ' AND p.permit_type = ?'; params.push(type); }

  const permits = db.prepare(`
    SELECT p.*, c.full_name as client_name, u.full_name as assigned_staff
    FROM permits p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN users u ON p.assigned_staff_id = u.id
    WHERE ${where} ORDER BY p.application_date DESC
  `).all(...params);

  const statusCounts = db.prepare(`
    SELECT p.status, COUNT(*) as count FROM permits p
    JOIN clients c ON p.client_id = c.id
    WHERE ${where} GROUP BY p.status
  `).all(...params);

  res.json({ permits, statusCounts, total: permits.length });
});

module.exports = router;
