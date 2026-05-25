const { Router } = require('express');
const {
  getJobResult,
  getJobStatus,
  getJobResultDownload,
  postJobRetry,
  postUploadToDatabase,
} = require('../controllers/job.controller');
const { getStoredLeads } = require('../controllers/leads.controller');

const router = Router();

router.get('/stored-leads', getStoredLeads);
router.get('/result/:jobId/download', getJobResultDownload);
router.post('/result/:jobId/upload-to-database', postUploadToDatabase);
router.post('/retry/:jobId', postJobRetry);
router.get('/result/:jobId', getJobResult);
router.get('/status/:jobId', getJobStatus);

module.exports = router;
