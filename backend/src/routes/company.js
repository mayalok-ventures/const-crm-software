const express = require('express');
const router = express.Router();
const {
  getCompanyAgents,
  createCompanyAgent,
  joinCompany,
  leaveCompany,
  approveAgentLeave,
  rejectAgentLeave,
  updateAgentPermissions,
  removeAgent,
  updateCompanySettings,
  getCompanyDashboard,
  exportCompanyAnalytics,
} = require('../controllers/companyController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/agents', getCompanyAgents);
router.post('/agents', createCompanyAgent);
router.post('/join', joinCompany);
router.post('/leave', leaveCompany);
router.post('/agents/:agentId/approve-leave', approveAgentLeave);
router.post('/agents/:agentId/reject-leave', rejectAgentLeave);
router.put('/agents/:agentId/permissions', updateAgentPermissions);
router.delete('/agents/:agentId', removeAgent);
router.put('/settings', updateCompanySettings);
router.get('/dashboard', getCompanyDashboard);
router.get('/analytics/export', exportCompanyAnalytics);

module.exports = router;
