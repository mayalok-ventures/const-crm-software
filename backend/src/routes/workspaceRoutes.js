const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

// Public invitation verification & acceptance
router.get('/invitations/:token/verify', workspaceController.verifyInvitation);
router.post('/invitations/:token/accept', optionalAuth, workspaceController.acceptInvitation);

// Authenticated workspace routes
router.use(protect);
router.use(resolveWorkspace);

// Current Workspace
router.route('/current')
  .get(workspaceController.getCurrentWorkspace)
  .put(requirePermission('workspace.settings.edit'), workspaceController.updateWorkspace);

// Team Members
router.get('/members', requirePermission('members.view'), workspaceController.getMembers);
router.put('/members/:id/role', requirePermission('members.edit_role'), workspaceController.updateMemberRole);
router.put('/members/:id/permissions', requirePermission('roles.manage'), workspaceController.updateMemberPermissions);
router.delete('/members/:id', requirePermission('members.deactivate'), workspaceController.deactivateMember);

// Invitations
router.route('/invitations')
  .get(requirePermission('members.invite'), workspaceController.getInvitations)
  .post(requirePermission('members.invite'), workspaceController.inviteMember);

router.delete('/invitations/:id', requirePermission('members.invite'), workspaceController.revokeInvitation);
router.post('/invitations/:id/resend', requirePermission('members.invite'), workspaceController.resendInvitation);

// Roles
router.route('/roles')
  .get(requirePermission('members.view'), workspaceController.getRoles)
  .post(requirePermission('roles.manage'), workspaceController.createCustomRole);

router.put('/roles/system/:roleName', requirePermission('roles.manage'), workspaceController.updateSystemRole);

router.route('/roles/:id')
  .put(requirePermission('roles.manage'), workspaceController.updateCustomRole)
  .delete(requirePermission('roles.manage'), workspaceController.deleteCustomRole);

module.exports = router;
