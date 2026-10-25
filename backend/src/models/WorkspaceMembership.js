const mongoose = require('mongoose');
const { DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');

const workspaceMembershipSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['owner', 'manager', 'counsellor', 'auditor', 'custom'],
    default: 'counsellor',
    set: (v) => {
      if (!v) return v;
      const lower = String(v).toLowerCase().trim();
      if (lower === 'counselor' || lower === 'agent' || lower === 'telecaller') return 'counsellor';
      return lower;
    },
    index: true,
  },
  customRoleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null,
  },
  team: {
    type: String,
    trim: true,
    default: '',
  },
  status: {
    type: String,
    enum: ['active', 'invited', 'deactivated'],
    default: 'active',
    index: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  deactivatedAt: {
    type: Date,
    default: null,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

workspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMembershipSchema.index({ workspaceId: 1, role: 1, status: 1 });

/**
 * Resolves effective permissions for a membership record
 */
workspaceMembershipSchema.methods.getEffectivePermissions = async function() {
  if (this.role === 'custom' && this.customRoleId) {
    const Role = mongoose.models.Role || require('./Role');
    const customRole = await Role.findById(this.customRoleId).lean();
    if (customRole && Array.isArray(customRole.permissions)) {
      return customRole.permissions;
    }
  }

  return DEFAULT_ROLE_PERMISSIONS[this.role] || DEFAULT_ROLE_PERMISSIONS.counsellor;
};

/**
 * Checks if the member has a specific permission key and scope
 */
workspaceMembershipSchema.methods.hasPermission = async function(permissionKey, requiredScope = null) {
  if (this.status !== 'active') return false;
  if (this.role === 'owner') return true; // Owner has all permissions

  const permissions = await this.getEffectivePermissions();
  const match = permissions.find(p => p.key === permissionKey);

  if (!match) return false;
  if (!requiredScope) return true;

  // Scope hierarchy: workspace > team > own
  const scopeLevels = { workspace: 3, team: 2, own: 1, restricted: 0 };
  const memberScopeLevel = scopeLevels[match.scope] || 0;
  const reqScopeLevel = scopeLevels[requiredScope] || 0;

  return memberScopeLevel >= reqScopeLevel;
};

workspaceMembershipSchema.post(['save', 'findOneAndUpdate', 'findByIdAndUpdate', 'updateOne', 'deleteOne', 'findOneAndDelete'], function (doc) {
  try {
    const { invalidateWorkspaceCache, invalidateUserAuthCache } = require('../utils/authCache');
    const userId = doc?.userId;
    const wsId = doc?.workspaceId;
    if (userId) invalidateUserAuthCache(userId);
    if (wsId) invalidateWorkspaceCache(wsId);
  } catch (_) {}
});

module.exports = mongoose.models.WorkspaceMembership || mongoose.model('WorkspaceMembership', workspaceMembershipSchema);

