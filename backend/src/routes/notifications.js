const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAllRead,
  markOneRead,
  streamNotifications
} = require('../controllers/notificationsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getNotifications);
router.get('/stream', streamNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markOneRead);

module.exports = router;
