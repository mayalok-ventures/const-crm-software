const express = require('express');
const router = express.Router();
const { getAnalytics, exportAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.get('/export', protect, exportAnalytics);
router.get('/', protect, getAnalytics);

module.exports = router;
