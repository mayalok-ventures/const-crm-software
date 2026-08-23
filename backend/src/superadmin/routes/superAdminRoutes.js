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

// 2. Tenant / Organisation Management
router.get('/organisations', organisationController.getOrganisations);
router.get('/organisations/:id', organisationController.getOrganisationById);
router.patch('/organisations/:id/status', organisationController.updateStatus);
router.patch('/organisations/:id/plan', organisationController.updatePlan);
router.post('/impersonate', organisationController.impersonateUser);

// 3. User & Role Management
router.get('/users', userController.getUsers);

// 4. Revenue, Subscriptions & Billing
router.get('/revenue', revenueController.getRevenueDashboard);

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

module.exports = router;
