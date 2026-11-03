const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const db = require('./database/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const permitRoutes = require('./routes/permits');
const paymentRoutes = require('./routes/payments');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/permits', permitRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);

function lanAddresses() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', lan_ips: lanAddresses(), port: PORT });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ./database/db provisions the schema and seed data automatically when it is
// loaded, so installing on a new computer only needs "npm install && npm start".
// The old manual "npm run init-db" step is optional (re-run/verify only).
try {
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (users === 0) {
    console.warn('No user accounts found. Run "npm run init-db" to reseed the default accounts.');
  }
} catch (err) {
  console.error(`Database check failed: ${err.message}`);
  console.error('Fix: stop the server, delete backend/database/municipal.db* and start again.');
  process.exit(1);
}

app.listen(PORT, HOST, () => {
  console.log(`Municipal Engineering API running on http://localhost:${PORT}`);
  const ips = lanAddresses();
  if (ips.length) {
    for (const ip of ips) console.log(`LAN access: http://${ip}:${PORT}`);
  } else {
    console.log(`LAN access: http://<your-local-ip>:${PORT}`);
  }
});
