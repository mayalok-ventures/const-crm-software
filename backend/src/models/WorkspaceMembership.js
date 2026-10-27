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
  permissionOverrides: [{
    key: {
      type: String,
      required: true,
      trim: true,
    },
    scope: {
      type: String,
      enum: ['own', 'team', 'workspace', 'restricted'],
      default: 'workspace',
    },
    granted: {
      type: Boolean,
      required: true,
    },
  }],
}, {
  timestamps: true,
});

workspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMembershipSchema.index({ workspaceId: 1, role: 1, status: 1 });

/**
 * Resolves effective permissions for a membership record
 * Prioritizes:
 * 1. Owner role -> all permissions in catalogue
 * 2. Custom role -> Role.findById(this.customRoleId)
 * 3. Dynamic workspace-level rolePermissions (Workspace.rolePermissions) or Role document
 * 4. System static fallback DEFAULT_ROLE_PERMISSIONS
 * 5. Per-member explicit permissionOverrides (granted: true / false)
 */
workspaceMembershipSchema.methods.getEffectivePermissions = async function() {
  const { PERMISSIONS } = require('../config/permissions');
  const Workspace = mongoose.models.Workspace || require('./Workspace');
  const Role = mongoose.models.Role || require('./Role');

  if (this.role === 'owner') {
    return Object.keys(PERMISSIONS).map(key => ({ key, scope: 'workspace' }));
  }

  let basePermissions = [];

  if (this.role === 'custom' && this.customRoleId) {
    const customRole = await Role.findById(this.customRoleId).lean();
    if (customRole && Array.isArray(customRole.permissions)) {
      basePermissions = customRole.permissions;
    }
  } else {
    // Check if workspace owner dynamically edited this standard role's permissions
    const ws = await Workspace.findById(this.workspaceId).select('rolePermissions').lean();
    let wsRolePerms = null;
    if (ws && ws.rolePermissions) {
      wsRolePerms = ws.rolePermissions instanceof Map
        ? ws.rolePermissions.get(this.role)
        : ws.rolePermissions[this.role];
    }

    if (Array.isArray(wsRolePerms) && wsRolePerms.length > 0) {
      basePermissions = wsRolePerms;
    } else {
      // Also check if an explicit Role record exists for this role name in the workspace
      const roleDoc = await Role.findOne({ workspaceId: this.workspaceId, name: this.role }).lean();
      if (roleDoc && Array.isArray(roleDoc.permissions)) {
        basePermissions = roleDoc.permissions;
      } else {
        basePermissions = DEFAULT_ROLE_PERMISSIONS[this.role] || DEFAULT_ROLE_PERMISSIONS.counsellor;
      }
    }
  }

  // Merge per-member permission overrides if present
  if (Array.isArray(this.permissionOverrides) && this.permissionOverrides.length > 0) {
    const permMap = new Map();
    for (const p of basePermissions) {
      if (typeof p === 'string') {
        permMap.set(p, { key: p, scope: 'workspace' });
      } else if (p && p.key) {
        permMap.set(p.key, { ...p });
      }
    }

    for (const override of this.permissionOverrides) {
      if (!override || !override.key) continue;
      if (override.granted === false) {
        permMap.delete(override.key);
      } else if (override.granted === true) {
        permMap.set(override.key, {
          key: override.key,
          scope: override.scope || 'workspace',
        });
      }
    }

    return Array.from(permMap.values());
  }

  return basePermissions;
};

/**
 * Checks if the member has a specific permission key and scope
 */
workspaceMembershipSchema.methods.hasPermission = async function(permissionKey, requiredScope = null) {
  if (this.status !== 'active') return false;
  const { PERMISSIONS } = require('../config/permissions');
  // Unknown permission keys fail closed safely (cannot be granted even to owner)
  if (!PERMISSIONS[permissionKey]) return false;
  if (this.role === 'owner') return true; // Owner has all permissions in catalogue

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

workspaceMembershipSchema.post(['save', 'findOneAndUpdate', 'findByIdAndUpdate', 'updateOne', 'deleteOne', 'findOneAndDelete', 'deleteMany'], function (doc) {
  try {
    const { invalidateWorkspaceCache, invalidateUserAuthCache } = require('../utils/authCache');
    const { invalidateBootstrapCache } = require('../controllers/bootstrapController');
    const query = this.getQuery ? this.getQuery() : null;
    const userId = doc?.userId || query?.userId;
    const wsId = doc?.workspaceId || query?.workspaceId;
    if (userId) invalidateUserAuthCache(userId);
    if (wsId) invalidateWorkspaceCache(wsId);
    if (userId || wsId) invalidateBootstrapCache(userId, wsId);
  } catch (_) {}
});

module.exports = mongoose.models.WorkspaceMembership || mongoose.model('WorkspaceMembership', workspaceMembershipSchema);

