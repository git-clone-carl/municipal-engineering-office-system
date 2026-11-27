const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

/**
 * Document upload configuration (PDF and Image files).
 *
 * Files are stored outside the web root with randomised names. The API never
 * returns a storage path or public URL: documents are streamed through an
 * authenticated endpoint after an ownership/role check.
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads', 'documents');

const MAX_FILE_SIZE = Number(process.env.MAX_PDF_SIZE || 10 * 1024 * 1024); // 10 MB

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    cb(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${ext}`);
  },
});

function isAllowedFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  return ALLOWED_MIMES.has(file.mimetype) && ALLOWED_EXTS.has(ext);
}

const pdfUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedFile(file)) {
      return cb(new Error('Only PDF or image files (JPG, PNG, WEBP) are allowed'));
    }
    cb(null, true);
  },
});

const pdfMultipleUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 15 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedFile(file)) {
      return cb(new Error('Only PDF or image files (JPG, PNG, WEBP) are allowed'));
    }
    cb(null, true);
  },
});

/** Multer wrapper that turns upload errors into clean 400 responses. */
function uploadPdf(req, res, next) {
  pdfUpload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB.`
        : err.message || 'Upload failed';
      return res.status(400).json({ error: message });
    }
    next();
  });
}

function uploadMultiplePdfs(req, res, next) {
  pdfMultipleUpload.array('files', 15)(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB.`
        : err.message || 'Upload failed';
      return res.status(400).json({ error: message });
    }
    next();
  });
}

/** Verify the file starts with a valid PDF, JPEG, PNG, or WEBP magic signature. */
function isPdfSignature(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(12);
    const bytes = fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    if (bytes < 4) return false;
    // PDF: %PDF-
    if (bytes >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return true;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    // WEBP: RIFF....WEBP
    if (bytes >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return true;
    return false;
  } catch {
    return false;
  }
}

function removeUploadedFile(file) {
  if (!file?.path) return;
  try { fs.unlinkSync(file.path); } catch { /* ignore */ }
}

function removeUploadedFiles(files) {
  if (!Array.isArray(files)) return;
  for (const file of files) removeUploadedFile(file);
}

function documentPath(storedName) {
  const safe = path.basename(String(storedName || ''));
  return path.join(UPLOAD_DIR, safe);
}

module.exports = {
  UPLOAD_DIR,
  MAX_FILE_SIZE,
  uploadPdf,
  uploadMultiplePdfs,
  isPdfSignature,
  removeUploadedFile,
  removeUploadedFiles,
  documentPath,
};
