const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { protect } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

router.use(protect);
router.use(resolveWorkspace);

// List all automation rules
router.get('/', requirePermission('automations.view'), automationController.getAutomations);

// Canonical capability registry (triggers, conditions, actions, variables)
router.get('/capabilities', requirePermission('automations.view'), automationController.getCapabilities);

// Create a new automation rule
router.post('/', requirePermission('automations.manage'), automationController.createAutomation);

// Global execution logs stream
router.get('/logs', requirePermission('automations.view'), automationController.getAutomationLogs);

// Retry a failed execution log
router.post('/logs/:logId/retry', requirePermission('automations.manage'), automationController.retryAutomationLog);

// Test/preview an automation template with live or sample data
router.post('/test', requirePermission('automations.manage'), automationController.testAutomation);

// Duplicate rule as draft
router.post('/:id/duplicate', requirePermission('automations.manage'), automationController.duplicateAutomation);

// Set rule status (active, paused, draft)
router.patch('/:id/status', requirePermission('automations.manage'), automationController.setAutomationStatus);

// Get single rule by ID
router.get('/:id', requirePermission('automations.view'), automationController.getAutomation);

// Update rule
router.put('/:id', requirePermission('automations.manage'), automationController.updateAutomation);

// Toggle rule active status
router.patch('/:id/toggle', requirePermission('automations.manage'), automationController.toggleAutomation);

// Delete rule
router.delete('/:id', requirePermission('automations.manage'), automationController.deleteAutomation);

// Get execution logs for a specific rule
router.get('/:id/logs', requirePermission('automations.view'), automationController.getAutomationLogs);

module.exports = router;
