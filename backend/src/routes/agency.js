const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/permission');
const agencyController = require('../controllers/agencyController');

// All agency management endpoints are protected
router.use(protect);

// 1. Roles Management
router.post(
  '/roles',
  requirePermission(PERMISSIONS.ROLE_CREATE),
  agencyController.createRole
);
router.get(
  '/roles',
  requirePermission(PERMISSIONS.ROLE_VIEW),
  agencyController.getRoles
);
router.patch(
  '/roles/:id',
  requirePermission(PERMISSIONS.ROLE_EDIT),
  agencyController.updateRole
);
router.delete(
  '/roles/:id',
  requirePermission(PERMISSIONS.ROLE_DELETE),
  agencyController.deleteRole
);
router.patch(
  '/agents/:agentId',
  requirePermission(PERMISSIONS.ROLE_CREATE),
  agencyController.updateAgent
);

// 2. Lead Claims
router.post(
  '/leads/:id/claim',
  requirePermission(PERMISSIONS.LEAD_CLAIM),
  agencyController.claimLead
);

// 3. Lead Transfer Requests
router.post(
  '/leads/:id/transfer-request',
  requirePermission(PERMISSIONS.LEAD_TRANSFER_REQUEST),
  agencyController.requestTransfer
);
router.post(
  '/transfer-requests/:id/accept',
  agencyController.acceptTransfer
);
router.post(
  '/transfer-requests/:id/reject',
  agencyController.rejectTransfer
);
router.post(
  '/leads/:id/force-transfer',
  requirePermission(PERMISSIONS.LEAD_FORCE_TRANSFER),
  agencyController.forceTransfer
);

// 4. Global Activity Feed
router.get(
  '/activity',
  requirePermission(PERMISSIONS.ACTIVITY_VIEW),
  agencyController.getGlobalActivity
);

// 5. Incentive Policies & Modifications
router.post(
  '/incentive-policies',
  requirePermission(PERMISSIONS.AGENCY_SETTINGS_EDIT),
  agencyController.createIncentivePolicy
);
router.get(
  '/incentives',
  requirePermission(PERMISSIONS.INCENTIVE_VIEW_SELF),
  agencyController.getIncentives
);
router.patch(
  '/incentives/:id',
  requirePermission(PERMISSIONS.INCENTIVE_APPROVE),
  agencyController.updateIncentiveStatus
);

// 6. Unified Dashboards
router.get(
  '/dashboard',
  agencyController.getDashboard
);

module.exports = router;
