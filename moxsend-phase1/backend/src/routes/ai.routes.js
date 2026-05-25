const { Router } = require('express');
const { postSubjectLines, postCohortEmail, postRefineEmail, postSubjectOptimizer, postBenchmarkRun } = require('../controllers/ai.controller');
const { basicRateLimit } = require('../middleware/rateLimit.middleware');

const router = Router();

router.post('/ai/subject-lines', basicRateLimit({ windowMs: 60_000, max: 60 }), postSubjectLines);
router.post('/ai/subject-optimizer', basicRateLimit({ windowMs: 60_000, max: 60 }), postSubjectOptimizer);
router.post('/ai/cohort-email', basicRateLimit({ windowMs: 60_000, max: 20 }), postCohortEmail);
router.post('/ai/refine-email', basicRateLimit({ windowMs: 60_000, max: 60 }), postRefineEmail);
router.post('/ai/benchmark-run', basicRateLimit({ windowMs: 60_000, max: 20 }), postBenchmarkRun);



module.exports = router;
