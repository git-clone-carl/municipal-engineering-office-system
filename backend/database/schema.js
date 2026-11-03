/**
 * Canonical SQLite schema + seed data for the Municipal Engineering system.
 *
 * This is the single source of truth for the database structure. It is applied
 * automatically (and idempotently) by ./db.js the first time the API starts, so
 * a fresh install on a new computer provisions itself without any manual step.
 *
 * Everything here must stay in sync with the route queries in ../routes/*.js.
 */

const os = require('os');
const bcrypt = require('bcryptjs');

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'engineering_staff', 'cashier', 'municipal_engineer', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE,
    full_name TEXT NOT NULL,
    contact_number TEXT,
    email TEXT,
    address TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS permits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no TEXT UNIQUE NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    permit_type TEXT NOT NULL CHECK(permit_type IN ('building', 'electrical', 'occupancy', 'locational', 'certificate')),
    application_date DATE DEFAULT (date('now')),
    project_location TEXT,
    nature_of_construction TEXT,
    building_type TEXT,
    total_floor_area REAL DEFAULT 0,
    num_storeys INTEGER DEFAULT 1,
    assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'submitted'
      CHECK(status IN ('submitted', 'for_review', 'for_payment', 'for_approval', 'approved', 'released', 'rejected')),
    total_fee REAL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    notes TEXT,
    issued_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS permit_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    permit_id INTEGER NOT NULL REFERENCES permits(id) ON DELETE CASCADE,
    requirement_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'submitted')),
    submitted_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    or_number TEXT UNIQUE NOT NULL,
    permit_id INTEGER NOT NULL REFERENCES permits(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    role TEXT,
    action TEXT NOT NULL,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT UNIQUE NOT NULL,
    admin INTEGER NOT NULL DEFAULT 0,
    engineering_staff INTEGER NOT NULL DEFAULT 0,
    cashier INTEGER NOT NULL DEFAULT 0,
    municipal_engineer INTEGER NOT NULL DEFAULT 0,
    viewer INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS office_info (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    office_name TEXT DEFAULT 'Municipal Engineering Office',
    municipality TEXT DEFAULT 'Gumaca, Quezon',
    address TEXT,
    contact_number TEXT,
    email TEXT,
    municipal_engineer TEXT
  );

`;

/**
 * Indexes are created after ensureColumns() so databases from an older revision
 * get any missing column first. Each statement is best-effort.
 */
const INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_clients_full_name ON clients(full_name)',
  'CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status)',
  'CREATE INDEX IF NOT EXISTS idx_permits_client ON permits(client_id)',
  'CREATE INDEX IF NOT EXISTS idx_permits_application_date ON permits(application_date)',
  'CREATE INDEX IF NOT EXISTS idx_permit_requirements_permit ON permit_requirements(permit_id)',
  'CREATE INDEX IF NOT EXISTS idx_payments_permit ON payments(permit_id)',
  'CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)',
];

/**
 * Columns that older/partial databases (e.g. one created by an earlier version
 * of the project, or a database copied over from another computer) may be
 * missing. They are added in place so single queries keep working.
 * SQLite only allows constant defaults when adding a column, so no
 * CURRENT_TIMESTAMP defaults are used here - values are backfilled afterwards.
 */
const ADDITIVE_COLUMNS = {
  users: {
    user_id: 'TEXT',
    status: "TEXT DEFAULT 'active'",
    updated_at: 'DATETIME',
  },
  clients: {
    client_id: 'TEXT',
    contact_number: 'TEXT',
    email: 'TEXT',
    address: 'TEXT',
    user_id: 'INTEGER REFERENCES users(id)',
    updated_at: 'DATETIME',
  },
  permits: {
    application_no: 'TEXT',
    application_date: 'DATE',
    project_location: 'TEXT',
    nature_of_construction: 'TEXT',
    building_type: 'TEXT',
    total_floor_area: 'REAL DEFAULT 0',
    num_storeys: 'INTEGER DEFAULT 1',
    assigned_staff_id: 'INTEGER REFERENCES users(id)',
    status: "TEXT DEFAULT 'submitted'",
    total_fee: 'REAL DEFAULT 0',
    amount_paid: 'REAL DEFAULT 0',
    notes: 'TEXT',
    issued_date: 'DATE',
    created_at: 'DATETIME',
    updated_at: 'DATETIME',
  },
  permit_requirements: {
    requirement_name: 'TEXT',
    status: "TEXT DEFAULT 'pending'",
    submitted_at: 'DATETIME',
  },
  payments: {
    permit_id: 'INTEGER REFERENCES permits(id)',
    client_id: 'INTEGER REFERENCES clients(id)',
    payment_method: "TEXT DEFAULT 'cash'",
    cashier_id: 'INTEGER REFERENCES users(id)',
    notes: 'TEXT',
    payment_date: 'DATETIME',
  },
  audit_logs: {
    username: 'TEXT',
    role: 'TEXT',
    ip_address: 'TEXT',
    created_at: 'DATETIME',
  },
  notifications: {
    is_read: 'INTEGER DEFAULT 0',
    type: "TEXT DEFAULT 'info'",
    created_at: 'DATETIME',
  },
  role_permissions: {
    admin: 'INTEGER DEFAULT 0',
    engineering_staff: 'INTEGER DEFAULT 0',
    cashier: 'INTEGER DEFAULT 0',
    municipal_engineer: 'INTEGER DEFAULT 0',
    viewer: 'INTEGER DEFAULT 0',
  },
};

// Safe (WHERE ... IS NULL) backfills for columns that were just added.
const BACKFILL_SQL = [
  "UPDATE users SET status = 'active' WHERE status IS NULL",
  'UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL',
  'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL',
  'UPDATE clients SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL',
  'UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL',
  'UPDATE permits SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL',
  'UPDATE permits SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL',
  "UPDATE permits SET application_date = date(created_at) WHERE application_date IS NULL",
  'UPDATE permits SET total_fee = 0 WHERE total_fee IS NULL',
  'UPDATE permits SET amount_paid = 0 WHERE amount_paid IS NULL',
  'UPDATE payments SET payment_date = CURRENT_TIMESTAMP WHERE payment_date IS NULL',
  'UPDATE audit_logs SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL',
];

// Role / module matrix used both for seeding and for the RBAC screen.
// (users, settings and rbac modules are reserved for the System Administrator.)
const ROLE_MODULES = [
  { module: 'dashboard', admin: 1, engineering_staff: 1, cashier: 1, municipal_engineer: 1, viewer: 1 },
  { module: 'clients', admin: 1, engineering_staff: 1, cashier: 0, municipal_engineer: 1, viewer: 1 },
  { module: 'permits', admin: 1, engineering_staff: 1, cashier: 0, municipal_engineer: 1, viewer: 0 },
  { module: 'payments', admin: 1, engineering_staff: 0, cashier: 1, municipal_engineer: 1, viewer: 0 },
  { module: 'reports', admin: 1, engineering_staff: 1, cashier: 1, municipal_engineer: 1, viewer: 1 },
  { module: 'audit_logs', admin: 1, engineering_staff: 0, cashier: 0, municipal_engineer: 1, viewer: 0 },
  { module: 'users', admin: 1, engineering_staff: 0, cashier: 0, municipal_engineer: 0, viewer: 0 },
  { module: 'settings', admin: 1, engineering_staff: 0, cashier: 0, municipal_engineer: 0, viewer: 0 },
  { module: 'rbac', admin: 1, engineering_staff: 0, cashier: 0, municipal_engineer: 0, viewer: 0 },
];

// Seeded once, only when the users table is empty.
const DEMO_USERS = [
  { username: 'admin', password: 'admin123', full_name: 'System Administrator', role: 'admin', user_id: 'USR-001' },
  { username: 'engineer', password: 'engineer123', full_name: 'Engr. Juan Dela Cruz', role: 'municipal_engineer', user_id: 'USR-002' },
  { username: 'staff', password: 'staff123', full_name: 'Engr. Maria Santos', role: 'engineering_staff', user_id: 'USR-003' },
  { username: 'cashier', password: 'cashier123', full_name: 'Ana Reyes', role: 'cashier', user_id: 'USR-004' },
  { username: 'viewer', password: 'viewer123', full_name: 'Pedro Penduko', role: 'viewer', user_id: 'USR-005' },
];

/** First non-internal IPv4 address, used as the default LAN IP on a new install. */
function detectLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function defaultSettings() {
  return {
    server_name: 'MEO-SERVER',
    local_ip: detectLanIp(),
    subnet_mask: '255.255.255.0',
    gateway: '192.168.1.1',
    permit_fee_building: '5000',
    permit_fee_electrical: '2000',
    permit_fee_occupancy: '1500',
    permit_fee_locational: '1000',
    permit_fee_certificate: '500',
  };
}

const DEFAULT_OFFICE = {
  office_name: 'Municipal Engineering Office',
  municipality: 'Gumaca, Quezon',
  address: 'Municipal Hall, Gumaca, Quezon',
  contact_number: '(042) 123-4567',
  email: 'engineering@gumaca.gov.ph',
  municipal_engineer: 'Engr. Juan Dela Cruz',
};

// Tables created by older revisions of this project that the current routes no
// longer use. Detected only to warn the operator (their data is left untouched).
const LEGACY_TABLES = ['permit_applications', 'requirements_checklist'];

const EXPECTED_TABLES = [
  'users', 'clients', 'permits', 'permit_requirements', 'payments',
  'audit_logs', 'role_permissions', 'notifications', 'settings', 'office_info',
];

function tableExists(db, table) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
}

function listTables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
}

function countRows(db, table) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
}

/** True when every table the API needs already exists. */
function isDatabaseReady(db) {
  return EXPECTED_TABLES.every((table) => tableExists(db, table));
}

/** Tables from older revisions still present in this database file. */
function findLegacyTables(db) {
  return LEGACY_TABLES.filter((table) => tableExists(db, table));
}

function createTables(db) {
  db.exec(SCHEMA_SQL);
}

/** Best-effort index creation so a legacy table can never block start-up. */
function createIndexes(db) {
  const failed = [];
  for (const sql of INDEX_SQL) {
    try {
      db.exec(sql);
    } catch (err) {
      failed.push(`${sql} (${err.message})`);
    }
  }
  return failed;
}

/** Add any missing column from ADDITIVE_COLUMNS, then backfill safe defaults. */
function ensureColumns(db) {
  const added = [];
  for (const [table, columns] of Object.entries(ADDITIVE_COLUMNS)) {
    if (!tableExists(db, table)) continue;
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const [column, definition] of Object.entries(columns)) {
      if (existing.has(column)) continue;
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      added.push(`${table}.${column}`);
    }
  }
  if (added.length) {
    for (const sql of BACKFILL_SQL) {
      try {
        db.exec(sql);
      } catch {
        /* ignore: column may not exist in this database */
      }
    }
  }
  return added;
}

/** Insert-or-ignore so administrator customisations are never overwritten. */
function seedRolePermissions(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO role_permissions
      (module, admin, engineering_staff, cashier, municipal_engineer, viewer)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const m of ROLE_MODULES) {
    insert.run(m.module, m.admin, m.engineering_staff, m.cashier, m.municipal_engineer, m.viewer);
  }
}

function seedOfficeInfo(db) {
  if (db.prepare('SELECT id FROM office_info WHERE id = 1').get()) return false;
  db.prepare(`
    INSERT INTO office_info (id, office_name, municipality, address, contact_number, email, municipal_engineer)
    VALUES (1, ?, ?, ?, ?, ?, ?)
  `).run(
    DEFAULT_OFFICE.office_name, DEFAULT_OFFICE.municipality, DEFAULT_OFFICE.address,
    DEFAULT_OFFICE.contact_number, DEFAULT_OFFICE.email, DEFAULT_OFFICE.municipal_engineer,
  );
  return true;
}

function seedSettings(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings())) insert.run(key, value);
}

/** Default accounts are created only on a brand new (empty) users table. */
function seedUsers(db) {
  if (countRows(db, 'users') > 0) return [];
  const insert = db.prepare(`
    INSERT INTO users (user_id, username, password, full_name, role, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `);
  const created = [];
  for (const u of DEMO_USERS) {
    if (process.env.SEED_DEMO_USERS === 'false' && u.username !== 'admin') continue;
    insert.run(u.user_id, u.username, bcrypt.hashSync(u.password, 10), u.full_name, u.role);
    created.push(u);
  }
  return created;
}

/**
 * Bring the database up to date. Safe to call on every start:
 *  - missing tables and indexes are created (CREATE ... IF NOT EXISTS)
 *  - missing columns are added to databases created by older revisions
 *  - seed rows are inserted only when they are missing, so administrator
 *    changes (custom RBAC matrix, deleted users, settings) are never reverted
 */
function ensureDatabase(db) {
  const wasReady = isDatabaseReady(db);
  const tablesBefore = listTables(db);

  createTables(db);
  const columnsAdded = ensureColumns(db);
  const indexErrors = createIndexes(db);

  seedRolePermissions(db);
  seedSettings(db);
  const officeCreated = seedOfficeInfo(db);
  const usersCreated = seedUsers(db);

  return {
    freshInstall: !wasReady,
    tablesBefore,
    tablesCreated: listTables(db).filter((table) => !tablesBefore.includes(table)),
    columnsAdded,
    indexErrors,
    officeCreated,
    usersCreated,
    legacyTables: findLegacyTables(db),
  };
}

/** Row counts / missing tables, used by the init-db command and health checks. */
function getDatabaseStatus(db) {
  const tables = listTables(db);
  const status = {
    tables,
    missingTables: EXPECTED_TABLES.filter((table) => !tables.includes(table)),
  };
  for (const table of ['users', 'clients', 'permits', 'payments']) {
    status[table] = tables.includes(table) ? countRows(db, table) : 0;
  }
  return status;
}

/** Human readable provisioning messages shared by db.js and init.js. */
function reportProvisioning(result) {
  const lines = [];
  if (result.freshInstall) {
    lines.push('Database not initialised yet - creating schema automatically.');
    if (result.tablesCreated.length) lines.push(`Tables created: ${result.tablesCreated.join(', ')}`);
  } else if (result.tablesCreated.length) {
    lines.push(`Added missing tables: ${result.tablesCreated.join(', ')}`);
  }
  if (result.columnsAdded.length) {
    lines.push(`Added missing columns: ${result.columnsAdded.join(', ')}`);
  }
  if (result.officeCreated) lines.push('Default office information seeded.');
  if (result.indexErrors && result.indexErrors.length) {
    lines.push(`WARNING: could not create ${result.indexErrors.length} index(es): ${result.indexErrors.join(' | ')}`);
  }
  if (result.usersCreated.length) {
    lines.push('Default accounts created:');
    for (const u of result.usersCreated) lines.push(`  ${u.role.padEnd(18)} ${u.username} / ${u.password}`);
    lines.push('Change these passwords from the Users module before going live.');
  }
  if (result.legacyTables.length) {
    lines.push(`Note: unused legacy tables found (${result.legacyTables.join(', ')}). ` +
      'They are ignored by the current version and can be dropped once verified.');
  }
  return lines;
}

module.exports = {
  SCHEMA_SQL,
  ROLE_MODULES,
  DEMO_USERS,
  EXPECTED_TABLES,
  createTables,
  createIndexes,
  ensureColumns,
  seedRolePermissions,
  seedOfficeInfo,
  seedSettings,
  seedUsers,
  ensureDatabase,
  getDatabaseStatus,
  reportProvisioning,
  isDatabaseReady,
  findLegacyTables,
  detectLanIp,
};



