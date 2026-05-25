const { asyncHandler } = require('../utils/asyncHandler');
const { safeUnlink } = require('../utils/fileCleanup');
const {
  acceptCsvUpload,
  assertValidUpload,
} = require('../services/upload.service');

/**
 * Handles POST /api/upload — validates metadata, parses CSV, enqueues processing.
 */
const uploadCsv = asyncHandler(async (req, res) => {
  const filePath = req.file?.path;

  try {
    await assertValidUpload(req.file);
    const payload = await acceptCsvUpload(filePath);
    res.status(202).json(payload);
  } finally {
    await safeUnlink(filePath);
  }
});

module.exports = {
  uploadCsv,
};
