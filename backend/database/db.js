const fs = require('fs');
const path = require('path');
const { ensureDatabase, reportProvisioning } = require('./schema');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch {
  console.error('This backend uses the built-in "node:sqlite" module, which needs Node.js 22.5 or newer.');
  console.error(`Running Node.js: ${process.version}`);
  console.error('Install Node.js 24.x (or newer) and run "npm start" again.');
  process.exit(1);
}

// The database file is git-ignored on purpose: every computer that installs this
// project gets its own database, provisioned automatically the first time the
// API starts (schema + seed data live in ./schema.js).
const dbPath = path.join(__dirname, 'municipal.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Idempotent: creates any missing table/column and seeds missing default rows,
// so a fresh install never fails with "no such table: users".
for (const line of reportProvisioning(ensureDatabase(db))) {
  console.log(line);
}

module.exports = db;
