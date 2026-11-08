const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

/**
 * PDF upload configuration.
 *
 * Files are stored outside the web root with randomised names. The API never
 * returns a storage path or public URL: documents are streamed through an
 * authenticated endpoint after an ownership/role check.
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads', 'documents');

const MAX_FILE_SIZE = Number(process.env.MAX_PDF_SIZE || 10 * 1024 * 1024); // 10 MB

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    cb(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${ext}`);
  },
});

const pdfUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf'
      && path.extname(file.originalname || '').toLowerCase() === '.pdf';
    if (!isPdf) return cb(new Error('Only PDF files are allowed'));
    cb(null, true);
  },
});

/** Multer wrapper that turns upload errors into clean 400 responses. */
function uploadPdf(req, res, next) {
  pdfUpload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `PDF is too large. Maximum size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB.`
        : err.message || 'Upload failed';
      return res.status(400).json({ error: message });
    }
    next();
  });
}

/** Verify the file really starts with a PDF signature. */
function isPdfSignature(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(5);
    const bytes = fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);
    return bytes >= 5 && buffer.toString('ascii') === '%PDF-';
  } catch {
    return false;
  }
}

function removeUploadedFile(file) {
  if (!file?.path) return;
  try { fs.unlinkSync(file.path); } catch { /* ignore */ }
}

function documentPath(storedName) {
  const safe = path.basename(String(storedName || ''));
  return path.join(UPLOAD_DIR, safe);
}

module.exports = {
  UPLOAD_DIR,
  MAX_FILE_SIZE,
  uploadPdf,
  isPdfSignature,
  removeUploadedFile,
  documentPath,
};
