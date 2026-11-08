# Municipal Engineering Permit Processing System

Full-stack LAN/online Municipal Engineering Office system with role-based access
control, PDF requirement management, engineering approval, cashier payments and
official receipt printing.

## Tech Stack

- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Database: SQLite (`node:sqlite`, one central database file)
- Auth: JWT + server-side RBAC + per-record ownership checks
- Uploads: PDF files stored on the server, streamed only through authenticated API routes

## Project Structure

- `frontend` - React web application
- `backend` - Express API + SQLite database + uploaded PDFs

## Requirements

- Node.js 22.5+ (24.x or 26.x recommended - the API uses the built-in `node:sqlite` module)
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

The API provisions SQLite itself: on first start it creates
`backend/database/municipal.db` with the full schema, migrations and seed data
(default accounts, role permissions, office information, permit fees).

Verify or repair an existing installation at any time (idempotent - existing
data, users, settings and RBAC customisations are never overwritten):

```bash
cd backend
npm run init-db
```

Existing databases from older revisions are migrated automatically, including a
one-time rebuild of the `permits` table to add the `paid` status. Existing rows
are copied unchanged and child records are preserved.

### 3) Start backend API

```bash
cd backend
npm start
```

Backend runs on `http://localhost:3001` and `http://<host-local-ip>:3001` (LAN).

Health check: `GET /api/health`

### 4) Start frontend (development)

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173` and `http://<host-local-ip>:5173`.
Vite proxies `/api` to the backend on the same host.

### 5) Single-port LAN/online deployment (optional)

Build the React app once; the Express server will then serve both the API and
the web app on port 3001:

```bash
cd frontend
npm run build

cd ../backend
npm start
```

Open `http://<host-local-ip>:3001` from any laptop on the same network.

## Multi-Laptop / Centralized Access

Only the host computer runs the backend and holds the database. Every other
laptop uses a browser and points at the host's LAN IP - no separate database is
created on client laptops.

1. Connect all laptops to the same LAN/Wi-Fi.
2. Find the host IPv4 address (`ip addr` on Linux, `ipconfig` on Windows).
3. Allow inbound TCP port `3001` (production build) or `5173` (Vite dev) in the
   host firewall.
4. Open `http://<host-ip>:3001` (or `:5173`) on each laptop.
5. Log in with different accounts/roles. All reads and writes go to the same
   central SQLite database, so status changes, documents, payments and
   notifications are shared immediately (list pages poll every 20 seconds, and
   notifications poll every 20 seconds).

Example five-laptop demo:

| Laptop | Account | Role |
| --- | --- | --- |
| 1 | client account created in the portal | Client |
| 2 | `staff` | WNGR Staff |
| 3 | `engineer` | Municipal Engineer |
| 4 | `cashier` | Cashier |
| 5 | `admin` | System Administrator |

For an online server, run `npm run build` then `npm start` behind HTTPS (reverse
proxy such as Nginx/Caddy). Set a strong `JWT_SECRET` environment variable and
restrict `UPLOAD_DIR`/`DB_PATH` permissions to the service account.

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `HOST` | `0.0.0.0` | Bind address (LAN access) |
| `JWT_SECRET` | built-in dev value | **Change for production** |
| `DB_PATH` | `backend/database/municipal.db` | Central database file |
| `UPLOAD_DIR` | `backend/uploads/documents` | PDF storage directory |
| `MAX_PDF_SIZE` | `10485760` (10 MB) | Maximum PDF upload size |
| `SEED_DEMO_USERS` | enabled | Set `false` to seed only the admin account |

## Permit Workflow

1. **Client** submits an application and uploads PDF requirements.
2. **WNGR Staff** marks it `For Review`, checks the documents and forwards it to
   the engineer (`For Approval`).
3. **Municipal Engineer** approves (`Approved`) or rejects (`Rejected`) with
   remarks. Every decision is written to the database and to
   `approval_records`.
4. **Cashier** can process payment only when the application is `Approved`.
   Full payment changes the status to `Paid` inside a database transaction.
5. **WNGR Staff** releases the permit (`Released`) after payment.
6. **Official Receipt** can be viewed and printed from the Payments page or the
   client's application details.

Status transitions are enforced by dedicated server endpoints. The generic
permit update endpoint no longer accepts `status`, `total_fee` or `amount_paid`.

## Roles and Permissions

- **Client** (`viewer`): own applications and documents only, own receipts,
  dashboard limited to own figures.
- **WNGR Staff** (`engineering_staff`): all applications, requirements, document
  review, forward to engineer, release paid permits.
- **Municipal Engineer** (`municipal_engineer`): all applications and documents,
  approve/reject with remarks, approval history, read-only payments.
- **Cashier** (`cashier`): approved applications awaiting payment, payment
  processing, receipt viewing/printing. No document access by default.
- **System Administrator** (`admin`): users, roles, audit logs, document
  register, reports, settings, backups. Cannot approve permits or bypass the
  cashier payment rule.

All authorization is enforced in the backend. Hiding buttons in the frontend is
only a convenience.

## PDF Documents

- Multiple PDF attachments per application.
- PDF-only validation by MIME type, extension and file signature.
- 10 MB default size limit (configurable).
- Statuses: `Pending Review`, `Accepted`, `Rejected`, `Requires Resubmission`.
- Staff/Engineer/Admin can add remarks when rejecting or requesting resubmission.
- Clients can upload additional documents or replace a non-accepted document.
- Files are stored with randomized names outside the web root. The API never
  returns a public URL; documents are streamed through an authenticated endpoint
  after an ownership/role check.
- The in-app viewer supports the browser's PDF page navigation and toolbar, plus
  application zoom, fullscreen, download (permission-based) and open-in-tab.

## Payments and Official Receipts

Payment is server-side blocked unless all of these are true:

1. The application exists.
2. Its status is `Approved` (not Pending/Under Review/For Approval/Rejected/Paid).
3. The signed-in user has the `cashier` role.
4. It has not already been paid.
5. The amount equals the remaining balance (full payment).

The insert of the payment and the permit status update happen in one
`BEGIN IMMEDIATE` transaction, preventing duplicate or inconsistent payments.

Receipts include office/municipality information, OR number, client information,
application reference, payment description, amount, payment date/method and
cashier information. The **Print Receipt** button opens the browser's native
print dialog; a print-only CSS layout hides the navigation and dashboard. Silent
automatic printing is not used because it is not supported consistently by
browsers.

## Database Changes / Migration Summary

New tables:

- `application_documents` - uploaded PDF metadata, status and review remarks
- `approval_records` - engineer approval/rejection history

New/changed columns:

- `permits.status` now also allows `paid`
- `permits.approved_by`, `approved_at`, `rejected_by`, `rejected_at`,
  `rejection_reason`, `payment_date`
- `payments.receipt_printed_at`
- `notifications.permit_id`

Indexes were added for documents and approval records. Schema changes are applied
idempotently on API start; `npm run init-db` prints a summary. See
`backend/database/schema.js` for the canonical schema and migration functions.

## Default Login

Accounts are created automatically only when the `users` table is empty.

| Role | Username | Password |
| --- | --- | --- |
| System Administrator | `admin` | `admin123` |
| Municipal Engineer | `engineer` | `engineer123` |
| WNGR Staff | `staff` | `staff123` |
| Cashier | `cashier` | `cashier123` |
| Client / Viewer | `viewer` | `viewer123` |

Change credentials immediately after first login. Clients can also self-register
from the login screen; public registration always creates a Client account and
can never select an elevated role.

## Verification / Build Check

Backend and frontend checks performed during development:

- 105-assertion API E2E workflow test covering all five roles, document
  upload/permissions, approval/rejection, payment rules, receipts, admin
  controls, audit logs and reports (`ALL 105 ASSERTIONS PASSED`).
- Headless-Firefox UI workflow test: login as all five roles, role-based
  navigation, client self-registration, client application creation, PDF
  upload/view/review, staff review/forward, engineer approval, cashier
  payment/receipt and staff release.
- Legacy-database migration test (existing permits, payments and related rows
  preserved while the `permits` status constraint was widened).
- Frontend production build (`npm run build`) and backend syntax checks.

To repeat the build and schema checks:

```bash
cd backend
npm run init-db

cd ../frontend
npm run build
```

## Troubleshooting

`Error: no such table: users`

- Restart the API; the schema is provisioned on startup.
- If it still fails, stop the API, delete `backend/database/municipal.db*` and
  restart (this recreates seed data; back up first if you have real records).

`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`

- Node.js is too old. Install Node.js 24.x/26.x (or 22.5+ with
  `--experimental-sqlite`).

PDF upload returns 400

- Confirm the file is a real PDF under `MAX_PDF_SIZE` (default 10 MB).
- Check that the permit is still in an uploadable stage (`Submitted`,
  `For Review`, `For Approval` or `Rejected`).

Printing shows the whole dashboard

- Use the **Print Receipt** button inside the receipt dialog, not the browser
  menu on the dashboard page.

## Known Limitations

- The embedded PDF viewer relies on the browser's built-in PDF engine. Page
  navigation and the browser's own zoom controls are provided by that engine;
  the app's zoom uses a CSS transform and fullscreen uses the Fullscreen API.
  Behaviour can differ slightly between Chrome, Edge and Firefox.
- Notifications use short polling, not push/websocket delivery.
- Receipt printing uses the browser print dialog. Margins/paper size are chosen
  there; there is no server-side PDF receipt export.
- This is a LAN-oriented deployment: plain HTTP, one shared SQLite database.
  For access outside a trusted network, place it behind HTTPS/reverse proxy and
  firewall rules.
- Uploaded PDFs are stored outside the web root and streamed only through
  authenticated endpoints, but they are not encrypted at rest. Back up both
  `backend/database/municipal.db` and `backend/uploads/` together.
- Verification was API/E2E and browser-workflow based. The browser test was a
  development smoke test with headless Firefox/WebDriver, not a full regression
  suite, and no real multi-laptop hardware test was run.
- Existing legacy status `for_payment` is retained for old records; new flow
  uses `approved` as the payment-ready state.
