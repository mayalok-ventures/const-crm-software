const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getLeads, getLead, createLead, updateLead,
  addNote, deleteLead, getTodayFollowUps, getDueFollowUps, getTags, trackMessage, trackCall,
  reassignLead, bulkTransferLeads, releaseLead, exportLeads, importLeads, toggleLeadOrgSharing,
  addChildInquiry, updateChildInquiry, deleteChildInquiry,
  scheduleFollowUp, delayFollowUp, completeFollowUp, rescheduleFollowUp, cancelFollowUp,
} = require('../controllers/leadsController');
const { protect, checkPlanExpiry } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');
const { enforceExportGating } = require('../middleware/antiFraud');

// Multer in-memory storage for Excel/CSV parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB file size limit
});

router.use(protect);
router.use(resolveWorkspace);

// Export & Import Routes
router.get('/export', requirePermission('leads.export'), enforceExportGating, exportLeads);
router.post('/import', requirePermission('leads.create'), checkPlanExpiry, upload.single('file'), importLeads);

// Follow-Up & Alarm Endpoints
router.get('/follow-ups/today', requirePermission('activities.view'), getTodayFollowUps);
router.get('/follow-ups/due', requirePermission('activities.view'), getDueFollowUps);
router.post('/:id/follow-up', requirePermission('followups.create'), checkPlanExpiry, scheduleFollowUp);
router.post('/:id/follow-up/delay', requirePermission('followups.reschedule'), checkPlanExpiry, delayFollowUp);
router.post('/:id/follow-up/reschedule', requirePermission('followups.reschedule'), checkPlanExpiry, rescheduleFollowUp);
router.post('/:id/follow-up/complete', requirePermission('followups.complete'), checkPlanExpiry, completeFollowUp);
router.post('/:id/follow-up/cancel', requirePermission(['followups.delete', 'followups.reschedule']), checkPlanExpiry, cancelFollowUp);
router.delete('/:id/follow-up', requirePermission('followups.delete'), checkPlanExpiry, cancelFollowUp);
// Aliases for backward compatibility
router.post('/:id/followups', requirePermission('followups.create'), checkPlanExpiry, scheduleFollowUp);
router.post('/:id/followups/delay', requirePermission('followups.reschedule'), checkPlanExpiry, delayFollowUp);
router.post('/:id/followups/reschedule', requirePermission('followups.reschedule'), checkPlanExpiry, rescheduleFollowUp);
router.post('/:id/followups/complete', requirePermission('followups.complete'), checkPlanExpiry, completeFollowUp);
router.post('/:id/followups/cancel', requirePermission(['followups.delete', 'followups.reschedule']), checkPlanExpiry, cancelFollowUp);
router.delete('/:id/followups', requirePermission('followups.delete'), checkPlanExpiry, cancelFollowUp);
router.get('/tags', getTags);
router.post('/:id/track-message', requirePermission('whatsapp.send_one_to_one'), checkPlanExpiry, trackMessage);
router.post('/:id/track-call', requirePermission('activities.create'), checkPlanExpiry, trackCall);
router.put('/:id/reassign', requirePermission('leads.assign'), checkPlanExpiry, reassignLead);
router.post('/:id/reassign', requirePermission('leads.assign'), checkPlanExpiry, reassignLead);
router.put('/:id/release', requirePermission('leads.edit'), checkPlanExpiry, releaseLead);
router.post('/:id/release', requirePermission('leads.edit'), checkPlanExpiry, releaseLead);
router.put('/:id/share-organization', requirePermission('leads.edit'), checkPlanExpiry, toggleLeadOrgSharing);

// K-12 Parent-Child Multi-Inquiry Sub-routes
router.post('/:id/children', requirePermission('leads.edit'), checkPlanExpiry, addChildInquiry);
router.put('/:id/children/:childId', requirePermission('leads.edit'), checkPlanExpiry, updateChildInquiry);
router.delete('/:id/children/:childId', requirePermission('leads.edit'), checkPlanExpiry, deleteChildInquiry);

// Bulk Transfer & Reassignment Endpoints
router.post('/transfer', requirePermission(['leads.transfer', 'leads.assign']), checkPlanExpiry, bulkTransferLeads);
router.post('/bulk-transfer', requirePermission(['leads.transfer', 'leads.assign']), checkPlanExpiry, bulkTransferLeads);

router.route('/')
  .get(requirePermission('leads.view'), getLeads)
  .post(requirePermission('leads.create'), checkPlanExpiry, createLead);

router.route('/:id')
  .get(requirePermission('leads.view'), getLead)
  .put(requirePermission('leads.edit'), checkPlanExpiry, updateLead)
  .delete(requirePermission('leads.delete'), deleteLead);

router.post('/:id/notes', requirePermission('activities.create'), checkPlanExpiry, addNote);

module.exports = router;

