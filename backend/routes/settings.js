const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { checkPermission, logAudit, getClientIp } = require('../middleware/rbac');

const router = express.Router();
const dbPath = path.join(__dirname, '..', 'database', 'municipal.db');
const backupsDir = path.join(__dirname, '..', 'backups');

router.get('/office', authenticate, (req, res) => {
  const office = db.prepare('SELECT * FROM office_info WHERE id = 1').get();
  res.json(office);
});

router.put('/office', authenticate, checkPermission('settings'), (req, res) => {
  const { office_name, municipality, address, contact_number, email, municipal_engineer } = req.body;
  db.prepare(`
    UPDATE office_info SET office_name=?, municipality=?, address=?, contact_number=?, email=?, municipal_engineer=?
    WHERE id=1
  `).run(office_name, municipality, address, contact_number, email, municipal_engineer);
  logAudit(req.user.id, req.user.username, req.user.role, 'Updated office information', getClientIp(req));
  res.json({ success: true });
});

router.get('/system', authenticate, checkPermission('settings'), (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

router.put('/system', authenticate, checkPermission('settings'), (req, res) => {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [key, value] of Object.entries(req.body)) {
    upsert.run(key, String(value));
  }
  logAudit(req.user.id, req.user.username, req.user.role, 'Updated system settings', getClientIp(req));
  res.json({ success: true });
});

router.get('/rbac', authenticate, checkPermission('rbac'), (req, res) => {
  const matrix = db.prepare('SELECT * FROM role_permissions ORDER BY module').all();
  res.json(matrix);
});

router.put('/rbac', authenticate, checkPermission('rbac'), (req, res) => {
  const { permissions } = req.body;
  const update = db.prepare(`
    UPDATE role_permissions SET admin=1, engineering_staff=?, cashier=?, municipal_engineer=?, viewer=?
    WHERE module=?
  `);
  for (const p of permissions) {
    update.run(p.engineering_staff, p.cashier, p.municipal_engineer, p.viewer, p.module);
  }
  logAudit(req.user.id, req.user.username, req.user.role, 'Updated RBAC permissions', getClientIp(req));
  res.json({ success: true });
});

router.get('/backup/info', authenticate, checkPermission('settings'), (req, res) => {
  const files = fs.existsSync(backupsDir)
    ? fs.readdirSync(backupsDir).filter((f) => f.endsWith('.db')).map((f) => {
        const stat = fs.statSync(path.join(backupsDir, f));
        return { filename: f, size: stat.size, date: stat.mtime };
      }).sort((a, b) => b.date - a.date)
    : [];
  res.json({ lastBackup: files[0] || null, backups: files });
});

router.post('/backup', authenticate, checkPermission('settings'), (req, res) => {
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.db`;
  const dest = path.join(backupsDir, filename);
  fs.copyFileSync(dbPath, dest);
  logAudit(req.user.id, req.user.username, req.user.role, `Database backup created: ${filename}`, getClientIp(req));
  const stat = fs.statSync(dest);
  res.json({ success: true, filename, size: stat.size, date: stat.mtime });
});

router.post('/restore', authenticate, checkPermission('settings'), (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Filename required' });
  const src = path.join(backupsDir, filename);
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'Backup file not found' });
  fs.copyFileSync(src, dbPath);
  logAudit(req.user.id, req.user.username, req.user.role, `Database restored from: ${filename}`, getClientIp(req));
  res.json({ success: true, message: 'Database restored. Please restart the server.' });
});

router.get('/permit/:id/preview', authenticate, checkPermission('permits'), async (req, res) => {
  const permit = db.prepare(`
    SELECT p.*, c.full_name as client_name, c.address as client_address
    FROM permits p JOIN clients c ON p.client_id = c.id WHERE p.id = ?
  `).get(req.params.id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  const office = db.prepare('SELECT * FROM office_info WHERE id = 1').get();
  const verifyUrl = `PERMIT:${permit.application_no}:${permit.id}`;
  const qrCode = await QRCode.toDataURL(verifyUrl);
  res.json({ permit, office, qrCode });
});

module.exports = router;
