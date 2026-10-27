const express = require('express');
const router = express.Router();
const { getAnalytics, exportAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

router.use(protect);
router.use(resolveWorkspace);

router.get('/export', requirePermission('reports.export'), exportAnalytics);
router.get('/', requirePermission('reports.view'), getAnalytics);

module.exports = router;
