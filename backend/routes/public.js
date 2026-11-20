const express = require('express');
const db = require('../database/db');
const { logAudit, getClientIp } = require('../middleware/rbac');
const { notifyRole } = require('../middleware/access');
const {
  uploadMultiplePdfs, isPdfSignature, removeUploadedFiles,
} = require('../middleware/upload');
const {
  PERMIT_TYPES, PERMIT_PREFIXES, ELECTRICAL_SUBTYPES,
  ELECTRICAL_REQUIREMENTS, DEFAULT_REQUIREMENTS, getRequirementsForPermit,
} = require('../constants/permits');
const { isValidEmail, sendPermitStatusEmail } = require('../utils/mailer');

const router = express.Router();

function generateAppNo(type) {
  const prefix = PERMIT_PREFIXES[type] || 'AP';
  const year = new Date().getFullYear();
  let sequence = db.prepare('SELECT COUNT(*) AS c FROM permits WHERE permit_type = ?').get(type).c + 1;
  let applicationNo = `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
  while (db.prepare('SELECT id FROM permits WHERE application_no = ?').get(applicationNo)) {
    sequence += 1;
    applicationNo = `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
  }
  return applicationNo;
}

function generateClientCode() {
  const year = new Date().getFullYear();
  let sequence = db.prepare('SELECT COUNT(*) AS c FROM clients').get().c + 1;
  let clientCode = `CL-${year}-${String(sequence).padStart(5, '0')}`;
  while (db.prepare('SELECT id FROM clients WHERE client_id = ?').get(clientCode)) {
    sequence += 1;
    clientCode = `CL-${year}-${String(sequence).padStart(5, '0')}`;
  }
  return clientCode;
}

function generateDocumentNo() {
  const year = new Date().getFullYear();
  let sequence = db.prepare('SELECT COUNT(*) AS c FROM application_documents').get().c + 1;
  let documentNo = `DOC-${year}-${String(sequence).padStart(5, '0')}`;
  while (db.prepare('SELECT id FROM application_documents WHERE document_no = ?').get(documentNo)) {
    sequence += 1;
    documentNo = `DOC-${year}-${String(sequence).padStart(5, '0')}`;
  }
  return documentNo;
}

function getFee(type) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`permit_fee_${type}`);
  return row ? parseFloat(row.value) || 0 : 0;
}

router.get('/requirements', (_req, res) => {
  const office = db.prepare('SELECT office_name, municipality, address, contact_number FROM office_info WHERE id = 1').get();
  res.json({
    requirements: DEFAULT_REQUIREMENTS,
    electricalSubtypes: ELECTRICAL_REQUIREMENTS,
    office,
  });
});

router.post('/apply', uploadMultiplePdfs, async (req, res, next) => {
  try {
    const files = req.files || [];
    const fail = (status, message) => {
      removeUploadedFiles(files);
      return res.status(status).json({ error: message });
    };

    const {
      full_name,
      contact_number,
      email,
      address,
      permit_type,
      electrical_subtype,
      application_date,
      project_location,
      nature_of_construction,
      building_type,
      total_floor_area,
      num_storeys,
      notes,
    } = req.body;

    const cleanName = String(full_name || '').trim();
    const cleanContact = String(contact_number || '').trim();
    const cleanEmail = String(email || '').trim();
    const cleanAddress = String(address || '').trim();
    const cleanLocation = String(project_location || '').trim();

    if (!cleanName || !cleanContact || !cleanAddress) {
      return fail(400, 'Full name, contact number, and address are required.');
    }
    if (!isValidEmail(cleanEmail)) {
      return fail(400, 'A valid email address is required.');
    }
    if (!PERMIT_TYPES.includes(permit_type)) {
      return fail(400, 'Please select a valid permit type.');
    }
    if (!cleanLocation) {
      return fail(400, 'Project location is required.');
    }

    let requirementNames = [];
    try {
      requirementNames = JSON.parse(req.body.requirement_names || '[]');
    } catch {
      return fail(400, 'Invalid requirements metadata.');
    }

    const resolvedSubtype = permit_type === 'electrical'
      ? (ELECTRICAL_SUBTYPES.includes(electrical_subtype) ? electrical_subtype : 'electrification')
      : null;
    const expectedReqs = getRequirementsForPermit(permit_type, resolvedSubtype);
    if (files.length !== requirementNames.length) {
      return fail(400, 'Uploaded files do not match the requirements list.');
    }

    const fileByReq = new Map();
    for (let i = 0; i < files.length; i += 1) {
      const reqName = String(requirementNames[i] || '').trim();
      const file = files[i];
      if (!isPdfSignature(file.path)) {
        return fail(400, `File "${file.originalname}" is not a valid PDF.`);
      }
      if (reqName) fileByReq.set(reqName, file);
    }

    const missingReqs = expectedReqs.filter((r) => !fileByReq.has(r));
    if (missingReqs.length > 0) {
      return fail(400, `Please upload all required PDF documents. Missing: ${missingReqs.join(', ')}`);
    }

    const application_no = generateAppNo(permit_type);
    const total_fee = getFee(permit_type);

    let clientId;
    let clientCode;
    let permitId;

    db.exec('BEGIN IMMEDIATE');
    try {
      const existingClient = db.prepare(
        'SELECT id, client_id FROM clients WHERE LOWER(full_name) = LOWER(?) AND user_id IS NULL ORDER BY id LIMIT 1'
      ).get(cleanName);

      if (existingClient) {
        clientId = existingClient.id;
        clientCode = existingClient.client_id;
        db.prepare(`
          UPDATE clients SET
            contact_number = COALESCE(NULLIF(?, ''), contact_number),
            email = COALESCE(NULLIF(?, ''), email),
            address = COALESCE(NULLIF(?, ''), address),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(cleanContact, cleanEmail, cleanAddress, clientId);
      } else {
        clientCode = generateClientCode();
        const clientRes = db.prepare(`
          INSERT INTO clients (client_id, full_name, contact_number, email, address, user_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(clientCode, cleanName, cleanContact, cleanEmail, cleanAddress);
        clientId = Number(clientRes.lastInsertRowid);
      }

      const permitRes = db.prepare(`
        INSERT INTO permits (
          application_no, permit_type, electrical_subtype, client_id, application_date, project_location,
          nature_of_construction, building_type, total_floor_area, num_storeys,
          assigned_staff_id, total_fee, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      `).run(
        application_no,
        permit_type,
        resolvedSubtype,
        clientId,
        application_date || new Date().toISOString().split('T')[0],
        cleanLocation,
        String(nature_of_construction || '').trim(),
        String(building_type || '').trim(),
        Number(total_floor_area) || 0,
        Number(num_storeys) || 1,
        total_fee,
        String(notes || '').trim(),
      );
      permitId = Number(permitRes.lastInsertRowid);

      const insertReq = db.prepare(`
        INSERT INTO permit_requirements (permit_id, requirement_name, status, submitted_at)
        VALUES (?, ?, 'submitted', CURRENT_TIMESTAMP)
      `);
      const insertDoc = db.prepare(`
        INSERT INTO application_documents
          (document_no, permit_id, client_id, requirement_id, document_type, original_name,
           stored_name, mime_type, file_size, status, uploaded_by, uploaded_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?, 'pending_review', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      for (const reqName of expectedReqs) {
        const reqRes = insertReq.run(permitId, reqName);
        const reqId = Number(reqRes.lastInsertRowid);
        const file = fileByReq.get(reqName);
        const docNo = generateDocumentNo();
        insertDoc.run(
          docNo, permitId, clientId, reqId, reqName,
          file.originalname, file.filename, file.size,
        );
      }

      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      removeUploadedFiles(files);
      throw err;
    }

    logAudit(null, cleanName, 'client',
      `Submitted public ${permit_type} permit application ${application_no}`, getClientIp(req));
    notifyRole(
      ['engineering_staff', 'municipal_engineer', 'admin'],
      'New Permit Application',
      `New ${permit_type} permit application ${application_no} submitted by ${cleanName}`,
      'info',
      permitId,
    );

    const office = db.prepare('SELECT * FROM office_info WHERE id = 1').get();
    const emailResult = await sendPermitStatusEmail({
      to: cleanEmail,
      clientName: cleanName,
      applicationNo: application_no,
      permitType: permit_type,
      status: 'submitted',
      remarks: String(notes || '').trim(),
      totalFee: total_fee,
      projectLocation: cleanLocation,
      office,
    });

    res.status(201).json({
      permit_id: permitId,
      application_no,
      client_code: clientCode,
      client_name: cleanName,
      permit_type,
      project_location: cleanLocation,
      total_fee,
      uploaded_count: expectedReqs.length,
      status: 'submitted',
      email_sent: emailResult.sent,
      email_to: emailResult.to || null,
      email_error: emailResult.error || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
