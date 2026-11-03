const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission, logAudit, getClientIp } = require('../middleware/rbac');

const router = express.Router();

function generateOR() {
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) as c FROM payments').get().c;
  return `OR-${year}-${String(count + 1).padStart(5, '0')}`;
}

router.get('/', authenticate, checkPermission('payments'), (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
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
    SELECT pay.*, c.full_name as client_name, p.application_no, p.permit_type,
           u.full_name as cashier_name
    FROM payments pay
    JOIN clients c ON pay.client_id = c.id
    JOIN permits p ON pay.permit_id = p.id
    LEFT JOIN users u ON pay.cashier_id = u.id
    WHERE ${where}
    ORDER BY pay.payment_date DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));
  res.json({ payments, total, page: Number(page), limit: Number(limit) });
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
    WHERE pay.permit_id = ? ORDER BY pay.payment_date DESC
  `).all(req.params.permitId);
  res.json({ permit, balance: permit.total_fee - permit.amount_paid, history });
});

router.post('/', authenticate, checkPermission('payments'), (req, res) => {
  const { permit_id, amount, payment_method = 'cash', notes } = req.body;
  if (!permit_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Permit ID and valid amount required' });
  }
  const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(permit_id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  const balance = permit.total_fee - permit.amount_paid;
  if (amount > balance) {
    return res.status(400).json({ error: `Amount exceeds balance of ₱${balance.toFixed(2)}` });
  }
  const or_number = generateOR();
  const result = db.prepare(`
    INSERT INTO payments (or_number, permit_id, client_id, amount, payment_method, cashier_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(or_number, permit_id, permit.client_id, amount, payment_method, req.user.id, notes || '');
  const newPaid = permit.amount_paid + amount;
  let newStatus = permit.status;
  if (newPaid >= permit.total_fee && ['submitted', 'for_review', 'for_payment'].includes(permit.status)) {
    newStatus = 'for_approval';
  } else if (permit.status === 'submitted' || permit.status === 'for_review') {
    newStatus = 'for_payment';
  }
  db.prepare('UPDATE permits SET amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newPaid, newStatus, permit_id);
  logAudit(req.user.id, req.user.username, req.user.role, `Payment ${or_number} for ${permit.application_no}`, getClientIp(req));
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    SELECT id, 'Payment Received', ?, 'success' FROM users WHERE role IN ('engineering_staff','municipal_engineer','admin')
  `).run(`Payment of ₱${amount} received for ${permit.application_no}`);
  res.status(201).json({ id: result.lastInsertRowid, or_number, balance: permit.total_fee - newPaid });
});

router.get('/:id/receipt', authenticate, checkPermission('payments'), (req, res) => {
  const payment = db.prepare(`
    SELECT pay.*, c.full_name as client_name, c.address, p.application_no, p.permit_type,
           u.full_name as cashier_name
    FROM payments pay
    JOIN clients c ON pay.client_id = c.id
    JOIN permits p ON pay.permit_id = p.id
    LEFT JOIN users u ON pay.cashier_id = u.id
    WHERE pay.id = ?
  `).get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  const office = db.prepare('SELECT * FROM office_info WHERE id = 1').get();
  res.json({ payment, office });
});

module.exports = router;
