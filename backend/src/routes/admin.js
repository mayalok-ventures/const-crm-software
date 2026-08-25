const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const monitoringController = require('../monitoring/controllers/monitoringController');
const { protect, adminOnly, managerOrAdminOnly, superAdminOnly } = require('../middleware/auth');

router.use(protect);

// 1. Overview / Dashboard (Tenant Scoped)
router.get('/metrics', adminOnly, adminController.getOverviewMetrics);
router.get('/overview', adminOnly, adminController.getOverviewMetrics);
router.get('/plans', superAdminOnly, adminController.getAdminPlans);
router.get('/plans/hierarchy', superAdminOnly, adminController.getPlanHierarchy);
router.post('/plans', superAdminOnly, adminController.createAdminPlan);
router.put('/plans/:id', superAdminOnly, adminController.updateAdminPlan);
router.delete('/plans/:id', superAdminOnly, adminController.deleteAdminPlan);
router.get('/alerts-queue', adminOnly, adminController.getAdminAlerts);

// 2. Leads & Lead Sources (Tenant Scoped)
router.route('/leads')
  .get(managerOrAdminOnly, adminController.getAdminLeads)
  .post(managerOrAdminOnly, adminController.createAdminLead);

router.route('/leads/:id')
  .patch(managerOrAdminOnly, adminController.updateAdminLead);

router.patch('/leads/:id/stage', managerOrAdminOnly, adminController.updateLeadStage);
router.patch('/leads/:id/status', managerOrAdminOnly, adminController.updateLeadStatus);
router.post('/leads/:id/convert', managerOrAdminOnly, adminController.convertLeadWithPlan);
router.post('/leads/:id/close-deal', managerOrAdminOnly, adminController.closeLeadWithCommission);
router.post('/leads/:id/assign-plan', managerOrAdminOnly, adminController.assignLeadPlan);

// Follow-ups (Tenant Scoped)
router.post('/leads/:id/followups', managerOrAdminOnly, adminController.scheduleFollowUp);
router.post('/leads/:id/follow-up/cancel', managerOrAdminOnly, adminController.cancelFollowUp);
router.post('/leads/:id/followup/cancel', managerOrAdminOnly, adminController.cancelFollowUp);
router.patch('/followups/:id', managerOrAdminOnly, adminController.updateFollowUp);
router.patch('/followups/:id/complete', managerOrAdminOnly, adminController.completeFollowUp);
router.patch('/followups/:id/postpone', managerOrAdminOnly, adminController.postponeFollowUp);

// 3. Lead Distribution Centre (Tenant Scoped)
router.route('/distribution-rules')
  .get(adminOnly, adminController.getLeadDistributionRules)
  .post(adminOnly, adminController.saveLeadDistributionRule);

router.delete('/distribution-rules/:id', adminOnly, adminController.deleteLeadDistributionRule);
router.post('/agents/reassign-leads', adminOnly, adminController.reassignAgentLeads);

// 4. Pipelines Centre (Tenant Scoped)
router.route('/pipeline-settings')
  .get(adminOnly, adminController.getPipelineSettings)
  .post(adminOnly, adminController.savePipelineSettings);

router.get('/pipelines/config', adminOnly, adminController.getPipelineConfig);
router.put('/pipelines/config', adminOnly, adminController.updatePipelineConfig);

// 5. Agents & Managers Hierarchy (Tenant Scoped)
router.route('/agents')
  .get(managerOrAdminOnly, adminController.getHierarchy)
  .post(adminOnly, adminController.createAdminAgent);

router.patch('/agents/:id', adminOnly, adminController.updateAdminAgent);
router.get('/agents/:id/activity-logs', adminOnly, adminController.getAgentActivityLogs);
router.get('/analytics/agents-performance', managerOrAdminOnly, adminController.getAgentsPerformance);

// 6. Forms Centre (Tenant Scoped)
router.route('/form-schemas')
  .get(adminOnly, adminController.getFormSchemas)
  .post(adminOnly, adminController.saveFormSchema);

// 7. Template Centre (Tenant Scoped)
router.route('/templates')
  .get(managerOrAdminOnly, adminController.getAdminTemplates)
  .post(adminOnly, adminController.createAdminTemplate);
router.delete('/templates/:id', adminOnly, adminController.deleteAdminTemplate);

// 8. Catalogue Centre (Tenant Scoped)
router.route('/catalogues')
  .get(managerOrAdminOnly, adminController.getAdminCatalogues)
  .post(adminOnly, adminController.createAdminCatalogueItem);
router.delete('/catalogues/:id', adminOnly, adminController.deleteAdminCatalogueItem);

// 9. Integration Centre (Tenant Scoped)
router.get('/integrations-status', adminOnly, adminController.getIntegrationsStatus);
router.post('/integrations/credentials', adminOnly, adminController.saveIntegrationCredentials);

// 10. Campaigns & Ads (Tenant Scoped)
router.route('/campaigns')
  .get(managerOrAdminOnly, adminController.getCampaigns)
  .post(adminOnly, adminController.createCampaign);
router.delete('/campaigns/:id', adminOnly, adminController.deleteCampaign);
router.get('/campaigns-overview', managerOrAdminOnly, adminController.getCampaignMetrics);

// 11. Commission Engine (Tenant Scoped)
router.route('/commission-rules')
  .get(adminOnly, adminController.getCommissionRules)
  .post(adminOnly, adminController.saveCommissionRule);

router.delete('/commission-rules/:id', adminOnly, adminController.deleteCommissionRule);
router.get('/commission-payouts', managerOrAdminOnly, adminController.getCommissionPayouts);

// 12. Coupon Engine (Platform SuperAdmin Only)
router.route('/coupons')
  .get(superAdminOnly, adminController.getCoupons)
  .post(superAdminOnly, adminController.createCoupon);

router.delete('/coupons/:id', superAdminOnly, adminController.deleteCoupon);

// 13. Notification & Broadcast Centre (Tenant Scoped)
router.get('/broadcasts', adminOnly, adminController.getBroadcasts);
router.post('/broadcasts', adminOnly, adminController.sendBroadcast);
router.post('/broadcasts/audience-count', adminOnly, adminController.getBroadcastAudienceCount);
router.post('/alerts', adminOnly, adminController.sendBroadcast);

// 14. Universal & Individual Analytics (Tenant Scoped)
router.get('/analytics/universal', adminOnly, adminController.getUniversalAnalytics);

// 15. Activity Centre & Audit Logs (Tenant Scoped)
router.get('/activity-logs', adminOnly, adminController.getActivityLogs);
router.get('/manager-activities', adminOnly, adminController.getManagerActivities);
router.get('/subscriptions/audit-logs', adminOnly, adminController.getActivityLogs);

// 16. Permission & Security Settings (Tenant Scoped)
router.route('/security-settings')
  .get(adminOnly, adminController.getSecuritySettings)
  .post(adminOnly, adminController.updateSecuritySettings);

// 17. System Health & Infrastructure Monitoring (Platform SuperAdmin Only)
router.get('/system-health', superAdminOnly, adminController.getSystemHealth);
router.get('/monitoring/servers', superAdminOnly, monitoringController.getServers);
router.get('/monitoring/servers/:serverId', superAdminOnly, monitoringController.getServerDetails);
router.get('/monitoring/servers/:serverId/current', superAdminOnly, monitoringController.getCurrentMetric);
router.get('/monitoring/servers/:serverId/history', superAdminOnly, monitoringController.getMetricHistory);
router.get('/monitoring/servers/:serverId/health', superAdminOnly, monitoringController.getServerHealth);
router.get('/monitoring/api-performance', superAdminOnly, monitoringController.getApiPerformance);

// Server Heartbeat Routes (Platform SuperAdmin Only)
router.get('/servers', superAdminOnly, monitoringController.getServers);
router.get('/servers/:id', superAdminOnly, monitoringController.getServerDetails);
router.get('/servers/:id/health', superAdminOnly, monitoringController.getServerHealth);
router.get('/servers/:id/heartbeat-history', superAdminOnly, monitoringController.getHeartbeatHistory);
router.get('/servers/:id/status-events', superAdminOnly, monitoringController.getStatusEvents);

// 18. Error Tracking Centre (Platform SuperAdmin Only)
const errorTrackingController = require('../monitoring/controllers/errorTrackingController').errorTrackingController;
router.get('/errors/stats', superAdminOnly, errorTrackingController.getErrorStats);
router.get('/errors/groups', superAdminOnly, errorTrackingController.getErrorGroups);
router.get('/errors/groups/:fingerprint', superAdminOnly, errorTrackingController.getErrorGroupDetails);
router.patch('/errors/groups/:fingerprint/status', superAdminOnly, errorTrackingController.updateErrorGroupStatus);
router.post('/errors/groups/:fingerprint/notes', superAdminOnly, errorTrackingController.addErrorGroupNote);

// 19. Structured System Logging Centre (Platform SuperAdmin Only)
const loggingController = require('../monitoring/controllers/loggingController').loggingController;
router.get('/logs', superAdminOnly, loggingController.getLogs);
router.get('/logs/stream', superAdminOnly, loggingController.getLiveStream);
router.get('/logs/:id', superAdminOnly, loggingController.getLogById);

// 20. Security Monitoring & Abuse Detection Centre (Platform SuperAdmin Only)
const securityController = require('../monitoring/controllers/securityController').securityController;
router.get('/security/stats', superAdminOnly, securityController.getSecurityStats);
router.get('/security/events', superAdminOnly, securityController.getSecurityEvents);
router.get('/security/incidents', superAdminOnly, securityController.getSecurityIncidents);
router.get('/security/incidents/:id', superAdminOnly, securityController.getSecurityIncidentDetails);
router.patch('/security/incidents/:id/status', superAdminOnly, securityController.updateIncidentStatus);
router.post('/security/incidents/:id/notes', superAdminOnly, securityController.addIncidentNote);
router.get('/security/blocked-ips', superAdminOnly, securityController.getBlockedIps);
router.post('/security/blocked-ips', superAdminOnly, securityController.blockIp);
router.delete('/security/blocked-ips/:ip', superAdminOnly, securityController.unblockIp);
router.get('/security/rules', superAdminOnly, securityController.getSecurityRules);
router.patch('/security/rules/:ruleId', superAdminOnly, securityController.updateSecurityRule);

// 21. Immutable Audit Logging System (Platform SuperAdmin Only)
const auditController = require('../monitoring/controllers/auditController').auditController;
router.get('/audit/timeline', superAdminOnly, auditController.getAuditTimeline);
router.get('/audit/stats', superAdminOnly, auditController.getAuditStats);
router.get('/audit/export', superAdminOnly, auditController.exportAuditLogs);
router.post('/audit/archive', superAdminOnly, auditController.archiveAuditLogs);
router.get('/audit/:id', superAdminOnly, auditController.getAuditLogById);

// 22. MongoDB Database Monitoring Module (Platform SuperAdmin Only)
const databaseController = require('../monitoring/controllers/databaseController').default || require('../monitoring/controllers/databaseController');
router.get('/database/overview', superAdminOnly, databaseController.getDatabaseOverview);
router.get('/database/collections', superAdminOnly, databaseController.getDatabaseCollections);
router.get('/database/metrics', superAdminOnly, databaseController.getDatabaseMetrics);
router.get('/database/slow-queries', superAdminOnly, databaseController.getSlowQueries);
router.post('/database/ping', superAdminOnly, databaseController.pingDatabase);

// 23. Production-Grade Backup Monitoring Module (Platform SuperAdmin Only)
const backupController = require('../monitoring/controllers/backupController').default || require('../monitoring/controllers/backupController');
router.get('/backups/overview', superAdminOnly, backupController.getBackupOverview);
router.get('/backups/history', superAdminOnly, backupController.getBackupHistory);
router.get('/backups/policies', superAdminOnly, backupController.getBackupPolicies);
router.put('/backups/policies/:id', superAdminOnly, backupController.updateBackupPolicy);
router.get('/backups/incidents', superAdminOnly, backupController.getBackupIncidents);
router.post('/backups/incidents/:id/acknowledge', superAdminOnly, backupController.acknowledgeIncident);
router.post('/backups/incidents/:id/resolve', superAdminOnly, backupController.resolveIncident);
router.post('/backups/trigger', superAdminOnly, backupController.triggerManualBackup);
router.post('/backups/verify/:id', superAdminOnly, backupController.verifyBackupIntegrity);
router.get('/backups/records/:id', superAdminOnly, backupController.getBackupRecordById);

// 24. Reusable Alert and Incident Management Module (Platform SuperAdmin Only)
const alertController = require('../monitoring/controllers/alertController').default || require('../monitoring/controllers/alertController');
router.get('/alerts/overview', superAdminOnly, alertController.getAlertOverview);
router.get('/alerts/incidents', superAdminOnly, alertController.getIncidents);
router.get('/alerts/incidents/:id', superAdminOnly, alertController.getIncidentById);
router.post('/alerts/incidents/:id/acknowledge', superAdminOnly, alertController.acknowledgeIncident);
router.post('/alerts/incidents/:id/resolve', superAdminOnly, alertController.resolveIncident);
router.post('/alerts/incidents/:id/escalate', superAdminOnly, alertController.escalateIncident);
router.get('/alerts/rules', superAdminOnly, alertController.getAlertRules);
router.post('/alerts/rules', superAdminOnly, alertController.createAlertRule);
router.put('/alerts/rules/:id', superAdminOnly, alertController.updateAlertRule);
router.delete('/alerts/rules/:id', superAdminOnly, alertController.deleteAlertRule);
router.post('/alerts/rules/:id/toggle', superAdminOnly, alertController.toggleAlertRule);
router.get('/alerts/channels', superAdminOnly, alertController.getNotificationChannels);
router.post('/alerts/channels', superAdminOnly, alertController.createNotificationChannel);
router.put('/alerts/channels/:id', superAdminOnly, alertController.updateNotificationChannel);
router.delete('/alerts/channels/:id', superAdminOnly, alertController.deleteNotificationChannel);
router.post('/alerts/channels/:id/test', superAdminOnly, alertController.testNotificationChannel);
router.get('/alerts/deliveries', superAdminOnly, alertController.getNotificationDeliveries);
router.post('/alerts/simulate', superAdminOnly, alertController.simulateAnomaly);

// 25. Production-Grade Health Check Framework (Platform SuperAdmin Only)
const healthController = require('../monitoring/controllers/healthController').default || require('../monitoring/controllers/healthController');
router.get('/health', superAdminOnly, healthController.getHealth);
router.get('/health/live', superAdminOnly, healthController.getLive);
router.get('/health/ready', superAdminOnly, healthController.getReady);
router.get('/health/detailed', superAdminOnly, healthController.getDetailed);

// 26. External Integration Monitoring Module (Platform SuperAdmin Only)
const integrationMonitoringController = require('../monitoring/controllers/integrationMonitoringController').default || require('../monitoring/controllers/integrationMonitoringController');
router.get('/integrations/overview', superAdminOnly, integrationMonitoringController.getOverview);
router.get('/integrations/:id', superAdminOnly, integrationMonitoringController.getIntegrationById);
router.post('/integrations/:id/check', superAdminOnly, integrationMonitoringController.checkIntegration);
router.post('/integrations/record-telemetry', superAdminOnly, integrationMonitoringController.recordTelemetry);
router.put('/integrations/:id/thresholds', superAdminOnly, integrationMonitoringController.updateThresholds);

// 27. Multi-Tenant Resource Usage Monitoring Module (Platform SuperAdmin Only)
const usageMonitoringController = require('../monitoring/controllers/usageMonitoringController').default || require('../monitoring/controllers/usageMonitoringController');
router.get('/usage/overview', superAdminOnly, usageMonitoringController.getOverview);
router.get('/usage/organizations', superAdminOnly, usageMonitoringController.getOrganizations);
router.get('/usage/organizations/:id', superAdminOnly, usageMonitoringController.getOrganizationById);
router.put('/usage/organizations/:id/limits', superAdminOnly, usageMonitoringController.updateOrganizationLimits);
router.get('/usage/alerts', superAdminOnly, usageMonitoringController.getAlerts);
router.post('/usage/alerts/:id/acknowledge', superAdminOnly, usageMonitoringController.acknowledgeAlert);
router.post('/usage/recalculate', superAdminOnly, usageMonitoringController.triggerRecalculate);

// 28. Secure API Key and Token Management Module (Platform SuperAdmin Only)
const apiKeyController = require('../monitoring/controllers/apiKeyController').default || require('../monitoring/controllers/apiKeyController');
router.get('/apikeys/overview', superAdminOnly, apiKeyController.getOverview);
router.get('/apikeys', superAdminOnly, apiKeyController.getKeys);
router.post('/apikeys', superAdminOnly, apiKeyController.createKey);
router.get('/apikeys/alerts', superAdminOnly, apiKeyController.getAlerts);
router.post('/apikeys/alerts/:id/resolve', superAdminOnly, apiKeyController.resolveAlert);
router.get('/apikeys/:id', superAdminOnly, apiKeyController.getKeyById);
router.put('/apikeys/:id', superAdminOnly, apiKeyController.updateKey);
router.post('/apikeys/:id/rotate', superAdminOnly, apiKeyController.rotateKey);
router.post('/apikeys/:id/revoke', superAdminOnly, apiKeyController.revokeKey);
router.post('/apikeys/:id/suspend', superAdminOnly, apiKeyController.suspendKey);
router.post('/apikeys/:id/reactivate', superAdminOnly, apiKeyController.reactivateKey);
router.delete('/apikeys/:id', superAdminOnly, apiKeyController.deleteKey);

// 29. Production Deployment Monitoring Module (Platform SuperAdmin Only)
const deploymentController = require('../monitoring/controllers/deploymentController').default || require('../monitoring/controllers/deploymentController');
router.get('/deployments/current', superAdminOnly, deploymentController.getCurrentOverview);
router.get('/deployments/overview', superAdminOnly, deploymentController.getCurrentOverview);
router.get('/deployments/history', superAdminOnly, deploymentController.getHistory);
router.get('/deployments/incidents', superAdminOnly, deploymentController.getIncidents);
router.post('/deployments/incidents/:id/resolve', superAdminOnly, deploymentController.resolveIncident);
router.get('/deployments/policy', superAdminOnly, deploymentController.getPolicy);
router.put('/deployments/policy', superAdminOnly, deploymentController.updatePolicy);
router.post('/deployments', superAdminOnly, deploymentController.createDeployment);
router.get('/deployments/:id', superAdminOnly, deploymentController.getDeploymentById);
router.post('/deployments/:id/stage', superAdminOnly, deploymentController.updateStage);
router.post('/deployments/:id/smoke-tests', superAdminOnly, deploymentController.runSmokeTests);
router.post('/deployments/:id/rollback', superAdminOnly, deploymentController.triggerRollback);
router.post('/deployments/webhook', deploymentController.ciCdWebhook); // Open/Token-protected for CI/CD pipelines

// 30. Comprehensive Platform Health Score Engine (Platform SuperAdmin Only)
const platformHealthController = require('../monitoring/controllers/platformHealthController').default || require('../monitoring/controllers/platformHealthController');
router.get('/platform-health', superAdminOnly, platformHealthController.getPlatformHealth);
router.get('/platform-health/components', superAdminOnly, platformHealthController.getAllComponents);
router.get('/platform-health/components/:componentId', superAdminOnly, platformHealthController.getComponentDetails);
router.get('/platform-health/history', superAdminOnly, platformHealthController.getHistory);
router.get('/platform-health/incidents', superAdminOnly, platformHealthController.getPlatformIncidents);
router.get('/platform-health/config', superAdminOnly, platformHealthController.getConfig);
router.put('/platform-health/config', superAdminOnly, platformHealthController.updateConfig);
router.post('/platform-health/recalculate', superAdminOnly, platformHealthController.recalculateNow);

// Platform User Management & Purge Handlers (Platform SuperAdmin Only)
router.get('/users', superAdminOnly, adminController.getUsers);
router.put('/users/:id/plan', superAdminOnly, adminController.assignPlan);
router.put('/users/:id/status', superAdminOnly, adminController.toggleUserStatus);
router.post('/users/:id/suspend', superAdminOnly, adminController.suspendUser);
router.delete('/users/:id', superAdminOnly, adminController.deleteUser);
router.post('/clean-slate', superAdminOnly, adminController.purgeFakeDataAndCleanSlate);
router.post('/purge-test-data', superAdminOnly, adminController.purgeTestDataOnly);

module.exports = router;

