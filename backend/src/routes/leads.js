const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getLeads, getLead, createLead, updateLead,
  addNote, deleteLead, getTodayFollowUps, getDueFollowUps, getTags, trackMessage, trackCall,
  reassignLead, exportLeads, importLeads
} = require('../controllers/leadsController');
const { protect, checkPlanExpiry } = require('../middleware/auth');
const { enforceExportGating } = require('../middleware/antiFraud');

// Multer in-memory storage for Excel/CSV parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB file size limit
});

router.use(protect);

// Export & Import Routes
router.get('/export', enforceExportGating, exportLeads);
router.post('/import', checkPlanExpiry, upload.single('file'), importLeads);

// Lead Standard Routes
router.get('/follow-ups/today', getTodayFollowUps);
router.get('/follow-ups/due', getDueFollowUps);
router.get('/tags', getTags);
router.post('/:id/track-message', checkPlanExpiry, trackMessage);
router.post('/:id/track-call', checkPlanExpiry, trackCall);
router.put('/:id/reassign', checkPlanExpiry, reassignLead);
router.route('/').get(getLeads).post(checkPlanExpiry, createLead);
router.route('/:id').get(getLead).put(checkPlanExpiry, updateLead).delete(deleteLead);
router.post('/:id/notes', checkPlanExpiry, addNote);

module.exports = router;
