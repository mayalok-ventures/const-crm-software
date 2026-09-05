const express = require('express');
const router = express.Router();

const { protect, superAdminOnly } = require('../../middleware/auth');

// Controllers
const overviewController = require('../controllers/overviewController');
const organisationController = require('../controllers/organisationController');
const userController = require('../controllers/userController');
const revenueController = require('../controllers/revenueController');
const leadController = require('../controllers/leadController');
const integrationController = require('../controllers/integrationController');
const systemController = require('../controllers/systemController');
const auditController = require('../controllers/auditController');
const featureFlagController = require('../controllers/featureFlagController');

// All SuperAdmin routes require JWT protect + superAdminOnly role check
router.use(protect, superAdminOnly);

// 1. Overview Command Center
router.get('/overview', overviewController.getOverview);

// 2. Tenant / Organisation Management & Lifecycle State Machine
router.get('/organisations', organisationController.getOrganisations);
router.get('/organisations/:id', organisationController.getOrganisationById);
router.get('/organisations/:id/lifecycle', organisationController.getLifecycle);
router.post('/organisations/:id/lifecycle', organisationController.transitionLifecycle);
router.post('/organisations/:id/lifecycle/transition', organisationController.transitionLifecycle);
router.post('/organisations/:id/activate', organisationController.activateTenant);
router.post('/organisations/:id/suspend', organisationController.suspendTenant);
router.post('/organisations/:id/cancel', organisationController.cancelTenant);
router.post('/organisations/:id/archive', organisationController.archiveTenant);
router.patch('/organisations/:id/status', organisationController.updateStatus);
router.patch('/organisations/:id/plan', organisationController.updatePlan);
router.post('/impersonate', organisationController.impersonateUser);

// 3. User & Role Management
router.get('/users', userController.getUsers);

// 4. Revenue, Subscriptions & Billing
router.get('/revenue', revenueController.getRevenueDashboard);
router.post('/revenue/reconcile', revenueController.triggerReconciliation);
router.get('/revenue/review-queue', revenueController.getManualReviewIssues);
router.post('/revenue/review-queue/resolve', revenueController.resolveManualReview);

// 5. Global CRM Platform Observability
router.get('/leads', leadController.getGlobalLeads);

// 6. Integrations Telemetry
router.get('/integrations', integrationController.getIntegrationsTelemetry);

// 7. System Health & Error Logs
router.get('/health', systemController.getHealth);
router.get('/error-logs', systemController.getErrorLogs);

// 8. Platform Audit Logs
router.get('/audit-logs', auditController.getAuditLogs);

// 9. Feature Flags
router.get('/feature-flags', featureFlagController.getFeatureFlags);
router.patch('/feature-flags/:flagId', featureFlagController.toggleFeatureFlag);

// 10. Global Cross-Entity Search
router.get('/search', featureFlagController.globalSearch);

// 11. Dynamic Plan Catalog & Feature Entitlements
const planCatalogController = require('../controllers/planCatalogController');
router.get('/plans', planCatalogController.listPlans);
router.post('/plans', planCatalogController.createPlan);
router.get('/plans/:id', planCatalogController.getPlan);
router.put('/plans/:id', planCatalogController.updatePlan);
router.patch('/plans/:id', planCatalogController.updatePlan);
router.post('/plans/:id/publish', planCatalogController.publishPlan);
router.post('/plans/:id/archive', planCatalogController.archivePlan);
router.post('/plans/:id/duplicate', planCatalogController.duplicatePlan);
router.delete('/plans/:id', planCatalogController.deletePlan);
router.post('/plans/:id/delete', planCatalogController.deletePlan);

// 12. Promotional Coupons & Redemption Tracking
const couponController = require('../controllers/couponController');
router.get('/coupons', couponController.listCoupons);
router.post('/coupons', couponController.createCoupon);
router.get('/coupons/:id', couponController.getCoupon);
router.put('/coupons/:id', couponController.updateCoupon);
router.patch('/coupons/:id', couponController.updateCoupon);
router.post('/coupons/:id/activate', couponController.activateCoupon);
router.post('/coupons/:id/deactivate', couponController.deactivateCoupon);
router.post('/coupons/:id/archive', couponController.archiveCoupon);
router.delete('/coupons/:id', couponController.archiveCoupon);
router.get('/coupons/:id/redemptions', couponController.getRedemptions);

module.exports = router;
