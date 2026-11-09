const User = require('../models/User');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const { maskPhoneNumber } = require('../utils/phoneMasking');

// @desc  Get share dashboard data (read-only)
// @route GET /api/share/:token
// @access Public (token-based)
exports.getShareDashboard = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ shareToken: token, shareTokenEnabled: true }).lean();
    if (!user) return res.status(404).json({ message: 'Invalid or expired share link' });

    if (user.shareTokenExpiresAt && new Date(user.shareTokenExpiresAt) < new Date()) {
      return res.status(404).json({ message: 'Invalid or expired share link' });
    }

    const [leads, byStatus] = await Promise.all([
      Lead.find({ userId: user._id })
        .select('name phone company status tags followUpDate createdAt workspaceId')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
      Lead.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const stats = { new: 0, contacted: 0, follow_up: 0, closed: 0 };
    byStatus.forEach((s) => { if (stats[s._id] !== undefined) stats[s._id] = s.count; });

    let targetWorkspaceId = user.workspaceId;
    if (!targetWorkspaceId && leads.length > 0 && leads[0].workspaceId) {
      targetWorkspaceId = leads[0].workspaceId;
    }
    if (!targetWorkspaceId) {
      try {
        const WorkspaceMembership = require('../models/WorkspaceMembership');
        const mem = await WorkspaceMembership.findOne({ userId: user._id, status: 'active' }).select('workspaceId').lean();
        if (mem) targetWorkspaceId = mem.workspaceId;
      } catch (_) {}
    }

    if (targetWorkspaceId) {
      try {
        const Workspace = require('../models/Workspace');
        const ws = await Workspace.findById(targetWorkspaceId).select('settings').lean();
        if (ws?.settings?.maskLeadPhones) {
          leads.forEach((l) => {
            if (l.phone) l.phone = maskPhoneNumber(l.phone);
          });
        }
      } catch (_) {}
    }

    res.json({
      owner: { name: user.name },
      leads,
      stats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get notifications
// @route GET /api/notifications
// @access Private
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Mark all notifications read
// @route PUT /api/notifications/read-all
// @access Private
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
