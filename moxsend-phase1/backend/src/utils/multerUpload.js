const path = require('path');
const multer = require('multer');
const { MAX_FILE_BYTES } = require('../services/csvConstants');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

/**
 * Multer instance configured for single CSV uploads.
 */
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

module.exports = { upload };
