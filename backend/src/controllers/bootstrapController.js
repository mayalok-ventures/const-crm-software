const User = require('../models/User');
const Workspace = require('../models/Workspace');
const WorkspaceMembership = require('../models/WorkspaceMembership');
const Notification = require('../models/Notification');
const Lead = require('../models/Lead');
const Integration = require('../models/Integration');

/**
 * High-performance CRM App Bootstrap Controller
 * Consolidates /auth/me, /workspace/current, /workspace/members, unread notifications,
 * and due follow-ups into a single ultra-fast parallel query with lean projections.
 */
async function getBootstrapData(req, res) {
  try {
    const user = req.user;
    const workspaceId = req.workspaceId || req.workspace?._id;

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

    res.json({
      success: true,
      timestamp: Date.now(),
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        usercode: user.usercode,
        role: user.role,
        workspaceRole: req.membership?.role || user.workspaceRole || 'owner',
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
      membership: req.membership || null,
      members: formattedMembers,
      counts: {
        unreadNotifications,
        dueFollowUps,
        todayFollowUps,
      },
      integrations,
    });
  } catch (error) {
    console.error('[Bootstrap Error]', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve bootstrap context' });
  }
}

module.exports = {
  getBootstrapData,
};
