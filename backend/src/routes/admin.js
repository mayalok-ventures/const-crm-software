const express = require('express');
const router = express.Router();
const { 
  getGlobalMetrics, getCapturedLeads, getUsers, assignPlan, toggleUserStatus, deleteUser,
  getCoupons, createCoupon, deleteCoupon, sendCustomAlert,
  suspendUser, getAbuseLogs,
  overrideSubscription, getAuditLogs, unbanWhatsAppFingerprint
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

// Global Metrics & Captured Leads
router.get('/metrics', getGlobalMetrics);
router.get('/captured-leads', getCapturedLeads);

// Users Management
router.get('/users', getUsers);
router.put('/users/:id/plan', assignPlan);
router.put('/users/:id/status', toggleUserStatus);
router.post('/users/:id/suspend', suspendUser);
router.delete('/users/:id', deleteUser);

// Enterprise Subscription Overrides & Anti-Fraud Auditing
router.post('/subscriptions/override', overrideSubscription);
router.get('/subscriptions/audit-logs', getAuditLogs);
router.post('/subscriptions/unban-wa', unbanWhatsAppFingerprint);

// Coupons
router.route('/coupons').get(getCoupons).post(createCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Alerts
router.post('/alerts', sendCustomAlert);

// Abuse logs
router.get('/abuse-logs', getAbuseLogs);

module.exports = router;
