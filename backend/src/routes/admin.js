const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const monitoringController = require('../monitoring/controllers/monitoringController');
const { protect, adminOnly, managerOrAdminOnly } = require('../middleware/auth');

router.use(protect);

// 1. Overview / Dashboard
router.get('/metrics', adminOnly, adminController.getOverviewMetrics);
router.get('/overview', adminOnly, adminController.getOverviewMetrics);
router.get('/plans', adminOnly, adminController.getAdminPlans);
router.get('/alerts-queue', adminOnly, adminController.getAdminAlerts);

// 2. Leads & Lead Sources
router.route('/leads')
  .get(managerOrAdminOnly, adminController.getAdminLeads)
  .post(managerOrAdminOnly, adminController.createAdminLead);

router.route('/leads/:id')
  .patch(managerOrAdminOnly, adminController.updateAdminLead);

router.patch('/leads/:id/stage', managerOrAdminOnly, adminController.updateLeadStage);
router.patch('/leads/:id/status', managerOrAdminOnly, adminController.updateLeadStatus);
router.post('/leads/:id/convert', managerOrAdminOnly, adminController.convertLeadWithPlan);

// Follow-ups
router.post('/leads/:id/followups', managerOrAdminOnly, adminController.scheduleFollowUp);
router.patch('/followups/:id', managerOrAdminOnly, adminController.updateFollowUp);
router.patch('/followups/:id/complete', managerOrAdminOnly, adminController.completeFollowUp);
router.patch('/followups/:id/postpone', managerOrAdminOnly, adminController.postponeFollowUp);

// 3. Lead Distribution Centre
router.route('/distribution-rules')
  .get(adminOnly, adminController.getLeadDistributionRules)
  .post(adminOnly, adminController.saveLeadDistributionRule);

router.delete('/distribution-rules/:id', adminOnly, adminController.deleteLeadDistributionRule);
router.post('/agents/reassign-leads', adminOnly, adminController.reassignAgentLeads);

// 4. Pipelines Centre
router.route('/pipeline-settings')
  .get(adminOnly, adminController.getPipelineSettings)
  .post(adminOnly, adminController.savePipelineSettings);

// 5. Agents & Managers Hierarchy
router.route('/agents')
  .get(managerOrAdminOnly, adminController.getHierarchy)
  .post(adminOnly, adminController.createAdminAgent);

router.patch('/agents/:id', adminOnly, adminController.updateAdminAgent);
router.get('/agents/:id/activity-logs', adminOnly, adminController.getAgentActivityLogs);
router.get('/analytics/agents-performance', managerOrAdminOnly, adminController.getAgentsPerformance);

// 6. Forms Centre
router.route('/form-schemas')
  .get(adminOnly, adminController.getFormSchemas)
  .post(adminOnly, adminController.saveFormSchema);

// 7. Template Centre
router.route('/templates')
  .get(managerOrAdminOnly, adminController.getAdminTemplates)
  .post(adminOnly, adminController.createAdminTemplate);
router.delete('/templates/:id', adminOnly, adminController.deleteAdminTemplate);

// 8. Catalogue Centre
router.route('/catalogues')
  .get(managerOrAdminOnly, adminController.getAdminCatalogues)
  .post(adminOnly, adminController.createAdminCatalogueItem);
router.delete('/catalogues/:id', adminOnly, adminController.deleteAdminCatalogueItem);

// 9. Integration Centre
router.get('/integrations-status', adminOnly, adminController.getIntegrationsStatus);
router.post('/integrations/credentials', adminOnly, adminController.saveIntegrationCredentials);

// 10. Campaigns & Ads
router.route('/campaigns')
  .get(managerOrAdminOnly, adminController.getCampaigns)
  .post(adminOnly, adminController.createCampaign);
router.delete('/campaigns/:id', adminOnly, adminController.deleteCampaign);
router.get('/campaigns-overview', managerOrAdminOnly, adminController.getCampaignMetrics);

// 11. Commission Engine
router.route('/commission-rules')
  .get(adminOnly, adminController.getCommissionRules)
  .post(adminOnly, adminController.saveCommissionRule);

router.delete('/commission-rules/:id', adminOnly, adminController.deleteCommissionRule);
router.get('/commission-payouts', managerOrAdminOnly, adminController.getCommissionPayouts);

// 12. Coupon Engine
router.route('/coupons')
  .get(adminOnly, adminController.getCoupons)
  .post(adminOnly, adminController.createCoupon);

router.delete('/coupons/:id', adminOnly, adminController.deleteCoupon);

// 13. Notification & Broadcast Centre
router.get('/broadcasts', adminOnly, adminController.getBroadcasts);
router.post('/broadcasts', adminOnly, adminController.sendBroadcast);
router.post('/alerts', adminOnly, adminController.sendBroadcast);

// 14. Universal & Individual Analytics
router.get('/analytics/universal', adminOnly, adminController.getUniversalAnalytics);

// 15. Activity Centre & Audit Logs
router.get('/activity-logs', adminOnly, adminController.getActivityLogs);
router.get('/subscriptions/audit-logs', adminOnly, adminController.getActivityLogs);

// 16. Permission & Security Settings
router.route('/security-settings')
  .get(adminOnly, adminController.getSecuritySettings)
  .post(adminOnly, adminController.updateSecuritySettings);

// 17. System Health & Infrastructure Monitoring
router.get('/system-health', adminOnly, adminController.getSystemHealth);
router.get('/monitoring/servers', adminOnly, monitoringController.getServers);
router.get('/monitoring/servers/:serverId', adminOnly, monitoringController.getServerDetails);
router.get('/monitoring/servers/:serverId/current', adminOnly, monitoringController.getCurrentMetric);
router.get('/monitoring/servers/:serverId/history', adminOnly, monitoringController.getMetricHistory);
router.get('/monitoring/servers/:serverId/health', adminOnly, monitoringController.getServerHealth);
router.get('/monitoring/api-performance', adminOnly, monitoringController.getApiPerformance);

// Server Heartbeat Routes
router.get('/servers', adminOnly, monitoringController.getServers);
router.get('/servers/:id', adminOnly, monitoringController.getServerDetails);
router.get('/servers/:id/health', adminOnly, monitoringController.getServerHealth);
router.get('/servers/:id/heartbeat-history', adminOnly, monitoringController.getHeartbeatHistory);
router.get('/servers/:id/status-events', adminOnly, monitoringController.getStatusEvents);

// 18. Error Tracking Centre
const errorTrackingController = require('../monitoring/controllers/errorTrackingController').errorTrackingController;
router.get('/errors/stats', adminOnly, errorTrackingController.getErrorStats);
router.get('/errors/groups', adminOnly, errorTrackingController.getErrorGroups);
router.get('/errors/groups/:fingerprint', adminOnly, errorTrackingController.getErrorGroupDetails);
router.patch('/errors/groups/:fingerprint/status', adminOnly, errorTrackingController.updateErrorGroupStatus);
router.post('/errors/groups/:fingerprint/notes', adminOnly, errorTrackingController.addErrorGroupNote);

// 19. Structured System Logging Centre
const loggingController = require('../monitoring/controllers/loggingController').loggingController;
router.get('/logs', adminOnly, loggingController.getLogs);
router.get('/logs/stream', adminOnly, loggingController.getLiveStream);
router.get('/logs/:id', adminOnly, loggingController.getLogById);

// 20. Security Monitoring & Abuse Detection Centre
const securityController = require('../monitoring/controllers/securityController').securityController;
router.get('/security/stats', adminOnly, securityController.getSecurityStats);
router.get('/security/events', adminOnly, securityController.getSecurityEvents);
router.get('/security/incidents', adminOnly, securityController.getSecurityIncidents);
router.get('/security/incidents/:id', adminOnly, securityController.getSecurityIncidentDetails);
router.patch('/security/incidents/:id/status', adminOnly, securityController.updateIncidentStatus);
router.post('/security/incidents/:id/notes', adminOnly, securityController.addIncidentNote);
router.get('/security/blocked-ips', adminOnly, securityController.getBlockedIps);
router.post('/security/blocked-ips', adminOnly, securityController.blockIp);
router.delete('/security/blocked-ips/:ip', adminOnly, securityController.unblockIp);
router.get('/security/rules', adminOnly, securityController.getSecurityRules);
router.patch('/security/rules/:ruleId', adminOnly, securityController.updateSecurityRule);

// 21. Immutable Audit Logging System
const auditController = require('../monitoring/controllers/auditController').auditController;
router.get('/audit/timeline', adminOnly, auditController.getAuditTimeline);
router.get('/audit/stats', adminOnly, auditController.getAuditStats);
router.get('/audit/export', adminOnly, auditController.exportAuditLogs);
router.post('/audit/archive', adminOnly, auditController.archiveAuditLogs);
router.get('/audit/:id', adminOnly, auditController.getAuditLogById);

// 22. MongoDB Database Monitoring Module
const databaseController = require('../monitoring/controllers/databaseController').default || require('../monitoring/controllers/databaseController');
router.get('/database/overview', adminOnly, databaseController.getDatabaseOverview);
router.get('/database/collections', adminOnly, databaseController.getDatabaseCollections);
router.get('/database/metrics', adminOnly, databaseController.getDatabaseMetrics);
router.get('/database/slow-queries', adminOnly, databaseController.getSlowQueries);
router.post('/database/ping', adminOnly, databaseController.pingDatabase);

// 23. Production-Grade Backup Monitoring Module
const backupController = require('../monitoring/controllers/backupController').default || require('../monitoring/controllers/backupController');
router.get('/backups/overview', adminOnly, backupController.getBackupOverview);
router.get('/backups/history', adminOnly, backupController.getBackupHistory);
router.get('/backups/policies', adminOnly, backupController.getBackupPolicies);
router.put('/backups/policies/:id', adminOnly, backupController.updateBackupPolicy);
router.get('/backups/incidents', adminOnly, backupController.getBackupIncidents);
router.post('/backups/incidents/:id/acknowledge', adminOnly, backupController.acknowledgeIncident);
router.post('/backups/incidents/:id/resolve', adminOnly, backupController.resolveIncident);
router.post('/backups/trigger', adminOnly, backupController.triggerManualBackup);
router.post('/backups/verify/:id', adminOnly, backupController.verifyBackupIntegrity);
router.get('/backups/records/:id', adminOnly, backupController.getBackupRecordById);

// 24. Reusable Alert and Incident Management Module
const alertController = require('../monitoring/controllers/alertController').default || require('../monitoring/controllers/alertController');
router.get('/alerts/overview', adminOnly, alertController.getAlertOverview);
router.get('/alerts/incidents', adminOnly, alertController.getIncidents);
router.get('/alerts/incidents/:id', adminOnly, alertController.getIncidentById);
router.post('/alerts/incidents/:id/acknowledge', adminOnly, alertController.acknowledgeIncident);
router.post('/alerts/incidents/:id/resolve', adminOnly, alertController.resolveIncident);
router.post('/alerts/incidents/:id/escalate', adminOnly, alertController.escalateIncident);
router.get('/alerts/rules', adminOnly, alertController.getAlertRules);
router.post('/alerts/rules', adminOnly, alertController.createAlertRule);
router.put('/alerts/rules/:id', adminOnly, alertController.updateAlertRule);
router.delete('/alerts/rules/:id', adminOnly, alertController.deleteAlertRule);
router.post('/alerts/rules/:id/toggle', adminOnly, alertController.toggleAlertRule);
router.get('/alerts/channels', adminOnly, alertController.getNotificationChannels);
router.post('/alerts/channels', adminOnly, alertController.createNotificationChannel);
router.put('/alerts/channels/:id', adminOnly, alertController.updateNotificationChannel);
router.delete('/alerts/channels/:id', adminOnly, alertController.deleteNotificationChannel);
router.post('/alerts/channels/:id/test', adminOnly, alertController.testNotificationChannel);
router.get('/alerts/deliveries', adminOnly, alertController.getNotificationDeliveries);
router.post('/alerts/simulate', adminOnly, alertController.simulateAnomaly);

// 25. Production-Grade Health Check Framework
const healthController = require('../monitoring/controllers/healthController').default || require('../monitoring/controllers/healthController');
router.get('/health', adminOnly, healthController.getHealth);
router.get('/health/live', adminOnly, healthController.getLive);
router.get('/health/ready', adminOnly, healthController.getReady);
router.get('/health/detailed', adminOnly, healthController.getDetailed);

// 26. External Integration Monitoring Module
const integrationMonitoringController = require('../monitoring/controllers/integrationMonitoringController').default || require('../monitoring/controllers/integrationMonitoringController');
router.get('/integrations/overview', adminOnly, integrationMonitoringController.getOverview);
router.get('/integrations/:id', adminOnly, integrationMonitoringController.getIntegrationById);
router.post('/integrations/:id/check', adminOnly, integrationMonitoringController.checkIntegration);
router.post('/integrations/record-telemetry', adminOnly, integrationMonitoringController.recordTelemetry);
router.put('/integrations/:id/thresholds', adminOnly, integrationMonitoringController.updateThresholds);

// 27. Multi-Tenant Resource Usage Monitoring Module
const usageMonitoringController = require('../monitoring/controllers/usageMonitoringController').default || require('../monitoring/controllers/usageMonitoringController');
router.get('/usage/overview', adminOnly, usageMonitoringController.getOverview);
router.get('/usage/organizations', adminOnly, usageMonitoringController.getOrganizations);
router.get('/usage/organizations/:id', adminOnly, usageMonitoringController.getOrganizationById);
router.put('/usage/organizations/:id/limits', adminOnly, usageMonitoringController.updateOrganizationLimits);
router.get('/usage/alerts', adminOnly, usageMonitoringController.getAlerts);
router.post('/usage/alerts/:id/acknowledge', adminOnly, usageMonitoringController.acknowledgeAlert);
router.post('/usage/recalculate', adminOnly, usageMonitoringController.triggerRecalculate);

// Preserved User Management Handlers
router.get('/users', adminOnly, adminController.getUsers);
router.put('/users/:id/plan', adminOnly, adminController.assignPlan);
router.put('/users/:id/status', adminOnly, adminController.toggleUserStatus);
router.post('/users/:id/suspend', adminOnly, adminController.suspendUser);
router.delete('/users/:id', adminOnly, adminController.deleteUser);
router.post('/clean-slate', adminOnly, adminController.purgeFakeDataAndCleanSlate);
router.post('/purge-test-data', adminOnly, adminController.purgeTestDataOnly);

module.exports = router;
