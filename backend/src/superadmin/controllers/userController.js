const mongoose = require('mongoose');
const User = require('../../models/User');
const { invalidateUserAuthCache } = require('../../utils/authCache');
const { auditService } = require('../../monitoring/audit/auditService');

exports.getUsers = async (req, res) => {
  try {
    const { search, role, status, organisationId, companyId, page = 1, limit = 20 } = req.query;
    const query = { role: { $ne: 'superadmin' } };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }
    if (role && role !== 'all') {
      query.role = role;
    }
    if (status && status !== 'all') {
      if (status === 'banned' || status === 'suspended') {
        query.$or = [{ isActive: false }, { userStatus: 'banned' }, { 'suspension.isSuspended': true }];
      } else {
        query.isActive = status === 'active';
      }
    }

    const targetOrg = organisationId || companyId;
    if (targetOrg && mongoose.Types.ObjectId.isValid(targetOrg)) {
      const orgOid = new mongoose.Types.ObjectId(targetOrg);
      query.$or = [{ companyId: orgOid }, { _id: orgOid }, { currentWorkspace: orgOid }, { workspaceId: orgOid }];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('-password -twoFactorSecret -twoFactorTempSecret -twoFactorRecoveryCodes')
        .populate('companyId', 'name companyInfo')
        .populate('managerId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    console.error('SuperAdmin Get Users Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch platform users' });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'manager', 'agent', 'counsellor', 'user'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'superadmin' || user.isAdmin === true) {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin accounts' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();
    invalidateUserAuthCache(user._id);

    try {
      await auditService.record({
        actor: req.user,
        action: 'USER_ROLE_CHANGED',
        resourceType: 'User',
        resourceId: user._id,
        resourceName: user.name || user.email,
        metadata: { oldRole, newRole: role, email: user.email },
        ip: req.ip,
      });
    } catch (e) {
      console.warn('[Audit Warning]:', e.message);
    }

    res.json({ success: true, message: `User role updated to ${role} successfully`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, userStatus, action, reason } = req.body;

    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot modify your own Super Admin account' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'superadmin' || user.isAdmin === true) {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin accounts' });
    }

    // Determine ban vs unban action
    const isBanning = action === 'ban' || userStatus === 'banned' || userStatus === 'suspended' || isActive === false;

    if (isBanning) {
      user.isActive = false;
      user.userStatus = 'banned';
      user.employeeStatus = 'suspended';
      user.suspension = {
        isSuspended: true,
        level: 99,
        reason: reason || 'Banned by Super Admin',
        suspendedAt: new Date(),
        suspendedUntil: null,
      };
      // Invalidate JWT tokens immediately
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    } else {
      user.isActive = true;
      user.userStatus = 'active';
      user.employeeStatus = 'active';
      user.suspension = {
        isSuspended: false,
        level: 0,
        reason: null,
        suspendedAt: null,
        suspendedUntil: null,
      };
    }

    await user.save();
    invalidateUserAuthCache(user._id);

    try {
      await auditService.record({
        actor: req.user,
        action: isBanning ? 'USER_BANNED' : 'USER_UNBANNED',
        resourceType: 'User',
        resourceId: user._id,
        resourceName: user.name || user.email,
        metadata: { reason: reason || '', email: user.email, newStatus: user.userStatus },
        ip: req.ip,
      });
    } catch (e) {
      console.warn('[Audit Warning]:', e.message);
    }

    res.json({
      success: true,
      message: `User ${user.name || user.email} has been ${isBanning ? 'banned' : 'reactivated'} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        userStatus: user.userStatus,
        suspension: user.suspension,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.banUser = async (req, res) => {
  req.body = { ...req.body, action: 'ban', isActive: false, userStatus: 'banned' };
  return exports.updateUserStatus(req, res);
};

exports.unbanUser = async (req, res) => {
  req.body = { ...req.body, action: 'unban', isActive: true, userStatus: 'active' };
  return exports.updateUserStatus(req, res);
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own Super Admin account' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'superadmin' || user.isAdmin === true) {
      return res.status(403).json({ success: false, message: 'Cannot delete Super Admin accounts' });
    }

    const WorkspaceMembership = mongoose.models.WorkspaceMembership || require('../../models/WorkspaceMembership');
    const Lead = mongoose.models.Lead || require('../../models/Lead');

    // 1. Remove all workspace memberships for this user
    await WorkspaceMembership.deleteMany({ userId: id });

    // 2. Unassign any leads currently assigned to this user to preserve business continuity
    await Lead.updateMany(
      { assignedTo: id },
      { $set: { assignedTo: null, assignedToName: 'Unassigned', assignmentReason: 'Previous agent deleted by SuperAdmin' } }
    );

    // 3. Delete user document
    await User.findByIdAndDelete(id);

    // 4. Invalidate auth cache
    invalidateUserAuthCache(id);

    // 5. Audit log
    try {
      await auditService.record({
        actor: req.user,
        action: 'USER_PERMANENTLY_DELETED',
        resourceType: 'User',
        resourceId: id,
        resourceName: user.name || user.email,
        metadata: { email: user.email, phone: user.phone, role: user.role },
        ip: req.ip,
      });
    } catch (e) {
      console.warn('[Audit Warning]:', e.message);
    }

    res.json({ success: true, message: `User ${user.name || user.email} permanently deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeUserFromOrganisation = async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'superadmin' || user.isAdmin === true) {
      return res.status(403).json({ success: false, message: 'Cannot remove Super Admin accounts' });
    }

    const WorkspaceMembership = mongoose.models.WorkspaceMembership || require('../../models/WorkspaceMembership');
    const Lead = mongoose.models.Lead || require('../../models/Lead');

    // Delete membership in this workspace
    await WorkspaceMembership.deleteMany({
      $or: [
        { workspaceId: orgId, userId },
        {
          workspaceId: mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : null,
          userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null,
        },
      ],
    });

    // Clear user's association if it pointed to this workspace
    if (
      String(user.companyId) === String(orgId) ||
      String(user.currentWorkspace) === String(orgId) ||
      String(user.workspaceId) === String(orgId)
    ) {
      user.companyId = null;
      user.currentWorkspace = null;
      user.workspaceId = null;
      await user.save();
    }

    // Unassign leads in this workspace assigned to this user
    await Lead.updateMany(
      { workspaceId: orgId, assignedTo: userId },
      { $set: { assignedTo: null, assignedToName: 'Unassigned', assignmentReason: 'User removed from organisation' } }
    );

    invalidateUserAuthCache(userId);

    try {
      await auditService.record({
        actor: req.user,
        action: 'USER_REMOVED_FROM_ORGANISATION',
        resourceType: 'WorkspaceMembership',
        resourceId: orgId,
        resourceName: user.name || user.email,
        metadata: { orgId, userId, userEmail: user.email },
        ip: req.ip,
      });
    } catch (e) {
      console.warn('[Audit Warning]:', e.message);
    }

    res.json({ success: true, message: `User ${user.name || user.email} removed from organisation successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
