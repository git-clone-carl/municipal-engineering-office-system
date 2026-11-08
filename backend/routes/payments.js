const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission, requireRole, logAudit, getClientIp } = require('../middleware/rbac');
const { getOwnClient, notifyClient, notifyRole } = require('../middleware/access');

const router = express.Router();

const PAYMENT_METHODS = ['cash', 'check', 'gcash', 'bank_transfer'];

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function generateOR() {
  const year = new Date().getFullYear();
  const prefix = `OR-${year}-`;
  const row = db.prepare(`
    SELECT MAX(CAST(substr(or_number, ?) AS INTEGER)) AS max_seq
    FROM payments WHERE or_number LIKE ?
  `).get(prefix.length + 1, `${prefix}%`);
  let sequence = Number(row?.max_seq || 0) + 1;
  let orNumber = `${prefix}${String(sequence).padStart(5, '0')}`;
  while (db.prepare('SELECT id FROM payments WHERE or_number = ?').get(orNumber)) {
    sequence += 1;
    orNumber = `${prefix}${String(sequence).padStart(5, '0')}`;
  }
  return orNumber;
}

router.get('/', authenticate, checkPermission('payments'), (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.min(100, Math.max(1, Number(limit) || 10));
  const offset = (pageNumber - 1) * limitNumber;
  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (pay.or_number LIKE ? OR c.full_name LIKE ? OR p.application_no LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  const total = db.prepare(`
    SELECT COUNT(*) as c FROM payments pay
    JOIN clients c ON pay.client_id = c.id
    JOIN permits p ON pay.permit_id = p.id
    WHERE ${where}
  `).get(...params).c;
  const payments = db.prepare(`
    SELECT pay.*, c.full_name as client_name, p.application_no, p.permit_type, p.status AS permit_status,
           u.full_name as cashier_name
    FROM payments pay
    JOIN clients c ON pay.client_id = c.id
    JOIN permits p ON pay.permit_id = p.id
    LEFT JOIN users u ON pay.cashier_id = u.id
    WHERE ${where}
    ORDER BY pay.payment_date DESC, pay.id DESC LIMIT ? OFFSET ?
  `).all(...params, limitNumber, offset);
  res.json({ payments, total, page: pageNumber, limit: limitNumber });
});

/**
 * Approved applications that are ready for cashier processing.
 * The Cashier dashboard uses this list; the payment POST endpoint repeats all
 * of these checks server-side before accepting money.
 */
router.get('/pending', authenticate, checkPermission('payments'),
  requireRole('admin', 'cashier'), (req, res) => {
    const permits = db.prepare(`
      SELECT p.id, p.application_no, p.permit_type, p.status, p.total_fee, p.amount_paid,
             p.approved_at, c.full_name AS client_name, c.client_id AS client_code,
             e.full_name AS approved_by_name
      FROM permits p
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN users e ON p.approved_by = e.id
      WHERE p.status = 'approved' AND p.amount_paid < p.total_fee
      ORDER BY p.approved_at ASC, p.id ASC
    `).all();
    res.json({ permits });
  });

router.get('/permit/:permitId', authenticate, checkPermission('payments'), (req, res) => {
  const permit = db.prepare(`
    SELECT p.*, c.full_name as client_name, c.client_id as client_code
    FROM permits p JOIN clients c ON p.client_id = c.id WHERE p.id = ?
  `).get(req.params.permitId);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  const history = db.prepare(`
    SELECT pay.*, u.full_name as cashier_name
    FROM payments pay LEFT JOIN users u ON pay.cashier_id = u.id
    WHERE pay.permit_id = ? ORDER BY pay.payment_date DESC, pay.id DESC
  `).all(req.params.permitId);
  res.json({
    permit,
    balance: round2(permit.total_fee - permit.amount_paid),
    payment_allowed: permit.status === 'approved' && permit.amount_paid < permit.total_fee,
    history,
  });
});

router.post('/', authenticate, checkPermission('payments'),
  requireRole('cashier'), (req, res, next) => {
    const { permit_id, amount, payment_method = 'cash', notes } = req.body;

    const permitId = Number(permit_id);
    const paymentAmount = round2(amount);
    if (!Number.isInteger(permitId) || permitId <= 0) {
      return res.status(400).json({ error: 'A valid permit application is required' });
    }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'A valid payment amount is required' });
    }
    if (!PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(permitId);
    if (!permit) return res.status(404).json({ error: 'Permit application not found' });

    // Core business rule: money can only be accepted AFTER engineer approval.
    if (permit.status === 'paid') {
      return res.status(409).json({ error: 'This application has already been paid' });
    }
    if (permit.status !== 'approved') {
      return res.status(409).json({
        error: `Payment is not allowed while the application status is "${permit.status}". Engineer approval is required first.`,
      });
    }

    const balance = round2(permit.total_fee - permit.amount_paid);
    if (balance <= 0) {
      return res.status(409).json({ error: 'This application has already been fully paid' });
    }
    if (Math.abs(paymentAmount - balance) > 0.005) {
      return res.status(400).json({
        error: `Payment must equal the remaining balance of PHP ${balance.toFixed(2)}. Full payment is required.`,
      });
    }

    let paymentId;
    let orNumber;
    try {
      db.exec('BEGIN IMMEDIATE');
      // Re-read inside the transaction to prevent duplicate/parallel payments.
      const current = db.prepare('SELECT * FROM permits WHERE id = ?').get(permitId);
      if (!current || current.status !== 'approved' || current.amount_paid >= current.total_fee) {
        throw Object.assign(new Error('This application is no longer eligible for payment'), { statusCode: 409 });
      }
      orNumber = generateOR();
      const result = db.prepare(`
        INSERT INTO payments (or_number, permit_id, client_id, amount, payment_method, cashier_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(orNumber, permitId, current.client_id, paymentAmount, payment_method, req.user.id, notes || '');
      paymentId = Number(result.lastInsertRowid);
      db.prepare(`
        UPDATE permits SET amount_paid = total_fee, status = 'paid',
          payment_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(permitId);
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }

    logAudit(req.user.id, req.user.username, req.user.role,
      `Payment ${orNumber} of PHP ${paymentAmount.toFixed(2)} for ${permit.application_no}`, getClientIp(req));
    notifyClient(permitId, 'Payment Received',
      `Payment received for ${permit.application_no}. Official Receipt ${orNumber}.`, 'success');
    notifyRole(['engineering_staff', 'municipal_engineer', 'admin'], 'Payment Completed',
      `${permit.application_no} was paid in full. OR ${orNumber}.`, 'success', permitId);

    res.status(201).json({
      id: paymentId,
      or_number: orNumber,
      amount: paymentAmount,
      balance: 0,
      status: 'paid',
    });
  });

router.get('/:id/receipt', authenticate, (req, res) => {
  const payment = db.prepare(`
    SELECT pay.*, c.full_name as client_name, c.address, c.contact_number, c.email,
           p.application_no, p.permit_type, p.project_location, p.total_fee, p.amount_paid, p.status AS permit_status,
           u.full_name as cashier_name, u.user_id AS cashier_code
    FROM payments pay
    JOIN clients c ON pay.client_id = c.id
    JOIN permits p ON pay.permit_id = p.id
    LEFT JOIN users u ON pay.cashier_id = u.id
    WHERE pay.id = ?
  `).get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const allowedRoles = ['admin', 'cashier', 'municipal_engineer'];
  let allowed = allowedRoles.includes(req.user.role);
  if (!allowed && req.user.role === 'viewer') {
    const client = getOwnClient(req.user.id);
    allowed = !!client && Number(client.id) === Number(payment.client_id);
  }
  if (!allowed) return res.status(403).json({ error: 'You do not have access to this receipt' });

  const office = db.prepare('SELECT * FROM office_info WHERE id = 1').get();
  res.json({ payment, office });
});

module.exports = router;
