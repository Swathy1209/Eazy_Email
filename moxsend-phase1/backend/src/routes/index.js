const { Router } = require('express');
const uploadRoutes = require('./upload.routes');
const jobRoutes = require('./job.routes');
const aiRoutes = require('./ai.routes');

const router = Router();

router.use('/api', uploadRoutes);
router.use('/api', jobRoutes);
router.use('/api', aiRoutes);

module.exports = router;
