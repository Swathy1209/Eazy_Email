const fs = require('fs/promises');

/**
 * Best-effort removal of an uploaded temp file. Logs but does not throw.
 * @param {string | undefined} filePath
 */
async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.error('Failed to delete upload file:', filePath, err);
    }
  }
}

module.exports = { safeUnlink };
