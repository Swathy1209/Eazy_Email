const { Router } = require('express');
const { upload } = require('../utils/multerUpload');
const { uploadCsv } = require('../controllers/upload.controller');

const router = Router();

router.post('/upload', upload.single('file'), uploadCsv);

module.exports = router;
