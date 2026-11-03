/**
 * Optional maintenance command: `npm run init-db`
 *
 * The API provisions the database (schema + seed data) automatically when it
 * starts - see ./db.js and ./schema.js - so this command is only needed to
 * re-check or repair an existing installation. It is safe to run at any time:
 * existing data, users, settings and RBAC customisations are never overwritten.
 */
const path = require('path');
const { getDatabaseStatus, EXPECTED_TABLES } = require('./schema');

// Requiring ./db applies the schema and logs anything it had to create/repair.
const db = require('./db');

const dbPath = path.join(__dirname, 'municipal.db');
const status = getDatabaseStatus(db);

console.log('');
console.log(`Database file: ${dbPath}`);
console.log(`Tables (${status.tables.length}): ${status.tables.join(', ')}`);
console.log(`Rows: users=${status.users} clients=${status.clients} permits=${status.permits} payments=${status.payments}`);

if (status.missingTables.length) {
  console.error(`ERROR: missing tables -> ${status.missingTables.join(', ')} (expected: ${EXPECTED_TABLES.join(', ')})`);
  process.exitCode = 1;
} else if (status.users === 0) {
  console.error('ERROR: no user accounts found. Delete municipal.db* and run this command again.');
  process.exitCode = 1;
} else {
  console.log('Database is up to date and ready. Default login: admin / admin123');
}

db.close();
