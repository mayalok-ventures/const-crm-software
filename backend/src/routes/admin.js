const express = require('express');
const router = express.Router();
const { 
  getGlobalMetrics, getCapturedLeads, getUsers, assignPlan, toggleUserStatus, deleteUser,
  getCoupons, createCoupon, deleteCoupon, sendCustomAlert,
  suspendUser, getAbuseLogs,
  overrideSubscription, getAuditLogs, unbanWhatsAppFingerprint,
  // New Unified CRM Endpoints
  createAdminLead, updateAdminLead, updateLeadStatus, updateLeadStage, getAdminLeads,
  scheduleFollowUp, postponeFollowUp, completeFollowUp, updateFollowUp,
  convertLeadWithPlan, refundPayment, getAdminPlans, getAdminAlerts,
  createAdminOffer, applyOfferToLead,
  getAdminAgents, createAdminAgent, updateAdminAgent, getAgentActivityLogs, getAgentsPerformance, reassignAgentLeads,
  getActivityLogs, getAdminTemplates, createAdminTemplate,
  purgeFakeDataAndCleanSlate, purgeTestDataOnly
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

// Clean Slate Purge (Deletes all test/fake data & users, preserving SuperAdmin)
router.post('/clean-slate', purgeFakeDataAndCleanSlate);
// Selective Test Data Purge (Deletes ONLY test/fake accounts & leads, 100% preserving real users)
router.post('/purge-test-data', purgeTestDataOnly);

// 1. Global Metrics & Inbound Captured Leads
router.get('/metrics', getGlobalMetrics);
router.get('/captured-leads', getCapturedLeads);
router.get('/plans', getAdminPlans);
router.get('/alerts-queue', getAdminAlerts);

// 2. Leads Management & 5-Stage Pipeline
router.route('/leads')
  .get(getAdminLeads)
  .post(createAdminLead);

router.route('/leads/:id')
  .patch(updateAdminLead);

router.patch('/leads/:id/stage', updateLeadStage);
router.patch('/leads/:id/status', updateLeadStatus);
router.post('/leads/:id/convert', convertLeadWithPlan);

// 3. Follow-Ups with Mandatory Notes & Postpone Remarks
router.post('/leads/:id/followups', scheduleFollowUp);
router.patch('/followups/:id', updateFollowUp);
router.patch('/followups/:id/complete', completeFollowUp);
router.patch('/followups/:id/postpone', postponeFollowUp);

// 4. Payments & Refunds
router.post('/payments/:id/refund', refundPayment);

// 4. Offers & Discounts Engine
router.post('/offers', createAdminOffer);
router.post('/leads/:id/apply-offer', applyOfferToLead);

// 5. Agent Roster Hierarchy & Performance
router.route('/agents')
  .get(getAdminAgents)
  .post(createAdminAgent);

router.patch('/agents/:id', updateAdminAgent);
router.get('/agents/:id/activity-logs', getAgentActivityLogs);
router.get('/analytics/agents-performance', getAgentsPerformance);
router.post('/agents/reassign-leads', reassignAgentLeads);

// 6. Activity Logs & CSV Export
router.get('/activity-logs', getActivityLogs);

// 7. Message Templates
router.route('/templates')
  .get(getAdminTemplates)
  .post(createAdminTemplate);

// 8. User Management & Overrides
router.get('/users', getUsers);
router.put('/users/:id/plan', assignPlan);
router.put('/users/:id/status', toggleUserStatus);
router.post('/users/:id/suspend', suspendUser);
router.delete('/users/:id', deleteUser);

// 9. Enterprise Subscription Overrides & Anti-Fraud
router.post('/subscriptions/override', overrideSubscription);
router.get('/subscriptions/audit-logs', getAuditLogs);
router.post('/subscriptions/unban-wa', unbanWhatsAppFingerprint);

// 10. Promo Coupons & Alerts
router.route('/coupons').get(getCoupons).post(createCoupon);
router.delete('/coupons/:id', deleteCoupon);
router.post('/alerts', sendCustomAlert);
router.get('/abuse-logs', getAbuseLogs);

module.exports = router;
