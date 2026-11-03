# Municipal Engineering LAN System

Full-stack LAN-based Municipal Engineering Office Management System with role-based access control.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite (`node:sqlite`)
- Auth: JWT + RBAC permission matrix

## Project Structure

- `frontend` - React web application
- `backend` - Express API + SQLite database

## Requirements

- Node.js 22.5+ (24.x recommended - the API uses the built-in `node:sqlite` module)
- npm

## Setup

### 1) Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2) Database (created automatically)

The API provisions SQLite itself: on the first start it creates
`backend/database/municipal.db` with the full schema plus seed data (default
accounts, role permissions, office information, permit fees). No manual step is
required, so a fresh clone/install on a new computer just works.

Verify or repair an existing installation at any time (idempotent - existing
data, users, settings and RBAC customisations are never overwritten):

```bash
cd backend
npm run init-db
```

`*.db` files are git-ignored, so every computer that installs this project
creates its own local database the first time the API starts.

### 3) Start backend API

```bash
cd backend
npm start
```

Backend runs on:

- `http://localhost:3001`
- `http://<your-local-ip>:3001` (LAN)

Health check:

- `GET /api/health`

### 4) Start frontend app

```bash
cd frontend
npm run dev
```

Frontend runs on:

- `http://localhost:5173`
- `http://<your-local-ip>:5173` (LAN)

The frontend is configured to call backend API at `/api` (proxied by Vite in dev mode).

## Default Login

Accounts created automatically on a brand new database (only when the `users`
table is empty - existing accounts are never touched). Set
`SEED_DEMO_USERS=false` to create only the `admin` account on install.

| Role | Username | Password |
| --- | --- | --- |
| System Administrator | `admin` | `admin123` |
| Municipal Engineer | `engineer` | `engineer123` |
| Engineering Staff | `staff` | `staff123` |
| Cashier | `cashier` | `cashier123` |
| Viewer / Citizen | `viewer` | `viewer123` |

Change credentials immediately after first login.

## Troubleshooting

`Error: no such table: users`

- Cause: the SQLite file is missing or was created empty (database files are
  git-ignored, so a fresh clone/install has no data yet).
- Fix: just restart the API (`npm start`). The schema is provisioned on startup
  and the console reports what was created.
- If it still fails, delete the database files and restart - they will be
  re-created and re-seeded:
  - `backend/database/municipal.db`
  - `backend/database/municipal.db-shm`
  - `backend/database/municipal.db-wal`

`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`

- Node.js is too old. Install Node.js 24.x (or 22.5+ with the
  `--experimental-sqlite` flag).

## Main Modules

- Dashboard
- Client Management
- Permit Applications
- Payments / Official Receipt
- Reports
- Audit Logs
- User Management
- RBAC Matrix
- Settings (office, LAN config, backup/restore)

## Build Check

Frontend production build:

```bash
cd frontend
npm run build
```

Backend database schema check (creates/repairs the SQLite file and prints the
table list and row counts):

```bash
cd backend
npm run init-db
```

Both commands were verified successfully.
