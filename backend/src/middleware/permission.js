const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const WorkspaceMembership = require('../models/WorkspaceMembership');
const { DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');
const { workspaceContextCache } = require('../utils/authCache');

/**
 * Resolves verified workspace and membership context for the authenticated user.
 * Guarantees frictionless solo-user default: if no workspace exists, creates one automatically.
 */
const resolveWorkspace = async (req, res, next) => {
  const wsStart = req._perf ? process.hrtime.bigint() : null;
  const finishWs = () => {
    if (req._perf && wsStart) {
      req._perf.wsMs = Number(process.hrtime.bigint() - wsStart) / 1e6;
    }
  };
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Superadmins can inspect any workspace if explicitly requested, or bypass tenant isolation for platform tasks
    if (req.user.role === 'superadmin' || req.user.isAdmin) {
      const explicitWsId = req.headers['x-workspace-id'] || req.query.workspaceId;
      if (explicitWsId && mongoose.Types.ObjectId.isValid(explicitWsId)) {
        const ws = await Workspace.findById(explicitWsId).lean();
        if (ws) {
          req.workspace = ws;
          req.workspaceId = ws._id;
          req.tenantId = ws._id;
          req.membership = { role: 'owner', status: 'active', hasPermission: async () => true };
          finishWs();
          return next();
        }
      }
    }

    // Check if client requested a specific workspace
    const requestedWsId = req.headers['x-workspace-id'] || req.query.workspaceId;
    const cacheKey = `${req.user._id}_${requestedWsId || 'default'}`;
    const cachedContext = workspaceContextCache.get(cacheKey);

    if (cachedContext && cachedContext.workspace && !cachedContext.workspace.deletedAt) {
      req.workspace = cachedContext.workspace;
      req.workspaceId = cachedContext.workspace._id;
      req.tenantId = cachedContext.workspace._id;
      req.membership = cachedContext.membership;

      req.user.workspaceId = cachedContext.workspace._id;
      req.user.workspaceRole = cachedContext.membership?.role || 'owner';
      req.user.membership = cachedContext.membership;
      finishWs();
      return next();
    }

    let membership = null;
    if (requestedWsId && mongoose.Types.ObjectId.isValid(requestedWsId)) {
      membership = await WorkspaceMembership.findOne({
        workspaceId: requestedWsId,
        userId: req.user._id,
        status: 'active',
      }).populate('workspaceId');
      
      // Strict negative authorization: reject if user is not an active member of requested workspace
      if (!membership) {
        return res.status(403).json({ message: 'Access denied: You are not an active member of this workspace' });
      }
    }

    // Otherwise, find the user's primary active membership
    if (!membership) {
      membership = await WorkspaceMembership.findOne({
        userId: req.user._id,
        status: 'active',
      }).populate('workspaceId');
    }

    let workspace = membership?.workspaceId;

    // Solo-user default: automatically find or create their workspace
    if (!workspace || workspace.deletedAt) {
      workspace = await Workspace.findOrCreateSoloWorkspace(req.user);
      membership = await WorkspaceMembership.findOne({
        workspaceId: workspace._id,
        userId: req.user._id,
      });
    }

    workspaceContextCache.set(cacheKey, { workspace, membership }, 30000);

    req.workspace = workspace;
    req.workspaceId = workspace._id;
    req.tenantId = workspace._id; // Backward compatibility with legacy code
    req.membership = membership;

    if (req.user) {
      req.user.workspaceId = workspace._id;
      req.user.workspaceRole = membership?.role || 'owner';
      req.user.membership = membership;
    }

    finishWs();
    next();
  } catch (error) {
    console.error('[resolveWorkspace Error]', error);
    res.status(500).json({ message: 'Failed to resolve workspace context' });
  }
};

/**
 * Middleware factory enforcing fine-grained RBAC permissions.
 * Usage: router.get('/leads/export', resolveWorkspace, requirePermission('leads.export'), exportLeads);
 */
const requirePermission = (permissionKey, requiredScope = null) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Superadmins bypass workspace permissions
    if (req.user.role === 'superadmin' || req.user.isAdmin) {
      return next();
    }

    // Ensure workspace context is resolved
    if (!req.membership) {
      await new Promise((resolve) => resolveWorkspace(req, res, resolve));
      if (!req.membership) {
        return res.status(403).json({ message: 'No active workspace membership found' });
      }
    }

    // Owner has unrestricted workspace authority
    if (req.membership.role === 'owner') {
      return next();
    }

    // If no permissionKey was provided, basic workspace membership is sufficient
    if (!permissionKey) {
      return next();
    }

    const hasAccess = await req.membership.hasPermission(permissionKey, requiredScope);
    if (!hasAccess) {
      return res.status(403).json({
        code: 'PERMISSION_DENIED',
        message: `Forbidden: Missing required permission '${permissionKey}'`,
      });
    }

    next();
  };
};

/**
 * Helper to build database query conditions enforcing tenant boundary and permission scope.
 */
const buildScopedQuery = (req, baseQuery = {}) => {
  const wsId = req.workspaceId || req.tenantId || req.user?._id;
  const conditions = {
    $or: [
      { workspaceId: wsId },
      { workspaceId: { $in: [null, undefined] }, userId: req.user?._id },
    ],
  };

  // If member has 'own' scope on leads/activities and is not owner/manager
  if (req.membership && req.membership.role === 'counsellor') {
    conditions.$and = [
      {
        $or: [
          { assignedTo: req.user._id },
          { userId: req.user._id },
          { currentOwnerId: req.user._id },
        ],
      },
    ];
  }

  return { ...baseQuery, ...conditions };
};

const resolveTenantId = (user) => {
  if (!user) return null;
  return user._id;
};

module.exports = {
  resolveWorkspace,
  requirePermission,
  buildScopedQuery,
  resolveTenantId,
};
