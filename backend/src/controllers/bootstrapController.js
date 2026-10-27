const mongoose = require('mongoose');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const WorkspaceMembership = require('../models/WorkspaceMembership');
const Role = require('../models/Role');
const Notification = require('../models/Notification');
const Lead = require('../models/Lead');
const Integration = require('../models/Integration');
const { cacheService } = require('../config/redis');
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');

/**
 * Invalidate cached bootstrap payloads across Redis and in-memory stores
 */
async function invalidateBootstrapCache(userId, workspaceId) {
  try {
    if (userId && workspaceId) {
      await cacheService.delKey(`bootstrap:${userId}:${workspaceId}`);
    } else if (userId) {
      await cacheService.delPattern(`bootstrap:${userId}:*`);
    } else if (workspaceId) {
      await cacheService.delPattern(`bootstrap:*:${workspaceId}`);
    }
  } catch (err) {
    console.warn('[Bootstrap Cache Invalidation Error]', err.message);
  }
}

/**
 * High-performance CRM App Bootstrap Controller
 * Consolidates /auth/me, /workspace/current, /workspace/members, unread notifications,
 * and due follow-ups into a single ultra-fast parallel query with lean projections.
 * Backed by Redis distributed caching layer for 0ms cold starts.
 */
async function getBootstrapData(req, res) {
  try {
    const user = req.user;
    const workspaceId = req.workspaceId || req.workspace?._id;
    const cacheKey = `bootstrap:${user._id}:${workspaceId || 'none'}`;

    const cached = await cacheService.getJson(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        timestamp: Date.now(),
        cached: true,
      });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const membersPromise = workspaceId
      ? WorkspaceMembership.find({ workspaceId, status: 'active' })
          .populate('userId', 'name email usercode role avatar isActive')
          .lean()
      : Promise.resolve([]);

    const unreadNotificationsPromise = Notification.countDocuments({
      userId: user._id,
      isRead: false,
    });

    const dueFollowUpsPromise = workspaceId
      ? Lead.countDocuments({
          workspaceId,
          followUpDate: { $lte: now, $ne: null },
          followUpStatus: { $nin: ['completed', 'cancelled', 'none'] },
          status: { $nin: ['closed', 'lost', 'Closed', 'Lost', 'converted', 'not_interested'] },
        })
      : Promise.resolve(0);

    const todayFollowUpsPromise = workspaceId
      ? Lead.countDocuments({
          workspaceId,
          followUpDate: { $gte: startOfToday, $lte: endOfToday },
          status: { $nin: ['closed', 'lost', 'Closed', 'Lost', 'converted', 'not_interested'] },
        })
      : Promise.resolve(0);

    const integrationsPromise = workspaceId
      ? Integration.find({ workspaceId })
          .select('provider status name metadata.lastSyncAt')
          .lean()
      : Promise.resolve([]);

    const [members, unreadNotifications, dueFollowUps, todayFollowUps, integrations] =
      await Promise.all([
        membersPromise,
        unreadNotificationsPromise,
        dueFollowUpsPromise,
        todayFollowUpsPromise,
        integrationsPromise,
      ]);

    const formattedMembers = members.map((m) => ({
      membershipId: m._id,
      role: m.role,
      scope: m.scope,
      user: m.userId,
      usercode: m.userId?.usercode,
      name: m.userId?.name,
      email: m.userId?.email,
      avatar: m.userId?.avatar,
      isActive: m.userId?.isActive,
    }));

    // Resolve authoritative effective permissions
    let effectivePermissions = [];
    if (user.role === 'superadmin' || user.isAdmin || req.membership?.role === 'owner') {
      effectivePermissions = Object.keys(PERMISSIONS).map((key) => ({ key, scope: 'workspace' }));
    } else if (req.membership?.role === 'custom' && req.membership?.customRoleId) {
      const Role = mongoose.models.Role || require('../models/Role');
      const customRole = await Role.findById(req.membership.customRoleId).lean();
      if (customRole && Array.isArray(customRole.permissions)) {
        effectivePermissions = customRole.permissions;
      } else {
        effectivePermissions = DEFAULT_ROLE_PERMISSIONS.counsellor;
      }
    } else if (req.membership && typeof req.membership.getEffectivePermissions === 'function') {
      effectivePermissions = await req.membership.getEffectivePermissions();
    } else if (req.membership?.role && DEFAULT_ROLE_PERMISSIONS[req.membership.role]) {
      effectivePermissions = DEFAULT_ROLE_PERMISSIONS[req.membership.role];
    } else {
      effectivePermissions = DEFAULT_ROLE_PERMISSIONS.counsellor;
    }

    const responsePayload = {
      success: true,
      timestamp: Date.now(),
      effectivePermissions,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        usercode: user.usercode,
        role: user.role,
        workspaceRole: req.membership?.role || user.workspaceRole || 'owner',
        effectivePermissions,
        industryType: user.industryType,
        educationSubProfile: user.educationSubProfile,
        plan: user.plan || 'pro',
        planEndDate: user.planEndDate,
        subscriptionLifecycle: user.subscriptionLifecycle,
      },
      workspace: req.workspace
        ? {
            _id: req.workspace._id,
            id: req.workspace._id,
            name: req.workspace.name,
            industryType: req.workspace.industryType,
            subProfile: req.workspace.subProfile,
            ownerId: req.workspace.ownerId,
            settings: req.workspace.settings,
          }
        : null,
      membership: req.membership
        ? {
            ...(req.membership.toObject ? req.membership.toObject() : req.membership),
            effectivePermissions,
          }
        : null,
      members: formattedMembers,
      counts: {
        unreadNotifications,
        dueFollowUps,
        todayFollowUps,
      },
      integrations,
    };

    // Cache in Redis for 45 seconds (invalidated automatically on membership/lead changes)
    await cacheService.setJson(cacheKey, responsePayload, 45);

    res.json(responsePayload);
  } catch (error) {
    console.error('[Bootstrap Error]', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve bootstrap context' });
  }
}

module.exports = {
  getBootstrapData,
  invalidateBootstrapCache,
};

