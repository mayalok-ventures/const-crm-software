const User = require('../models/User');
const Lead = require('../models/Lead');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const AbuseLog = require('../models/AbuseLog');
const waSession = require('../services/waSession');

// @desc  Get Global Platform Metrics & SaaS Overview
// @route GET /api/admin/metrics
// @access SuperAdmin / Admin
exports.getGlobalMetrics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCompanyOwners = await User.countDocuments({ workStatus: 'company_owner' });
    const totalSoloAgents = await User.countDocuments({ workStatus: 'independent_agent' });
    const totalLeads = await Lead.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const suspendedUsers = await User.countDocuments({ 'suspension.isSuspended': true });

    // Plan breakdown
    const plansAgg = await User.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);
    const planBreakdown = { free: 0, starter: 0, growth: 0, pro: 0 };
    plansAgg.forEach(p => { if (p._id) planBreakdown[p._id] = p.count; });

    // Recent platform signups (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSignups = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    res.json({
      totalUsers,
      totalCompanyOwners,
      totalSoloAgents,
      totalLeads,
      activeUsers,
      suspendedUsers,
      recentSignups,
      planBreakdown,
    });
  } catch (error) {
    console.error('getGlobalMetrics error:', error);
    res.status(500).json({ message: 'Failed to load global metrics' });
  }
};

// @desc  Get Captured Signups as Leads (SuperAdmin CRM)
// @route GET /api/admin/captured-leads
// @access SuperAdmin / Admin
exports.getCapturedLeads = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 100 } = req.query;
    const query = {
      $or: [
        { userId: req.user._id },
        { source: 'platform_registration' },
        { source: 'Auto-Signup' },
        { tags: 'platform_signup' },
        { tags: 'saas_lead' }
      ]
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = [{ $or: [{ name: rx }, { email: rx }, { phone: rx }, { company: rx }] }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [leads, total] = await Promise.all([
      Lead.find(query).sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Lead.countDocuments(query),
    ]);

    res.json({
      leads,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('getCapturedLeads error:', error);
    res.status(500).json({ message: 'Failed to fetch captured leads' });
  }
};

// @desc  List all users (admin)
// @route GET /api/admin/users
// @access Admin
exports.getUsers = async (req, res) => {
  try {
    const { search, plan, workStatus, page = 1, limit = 50 } = req.query;
    const query = {};
    if (plan) query.plan = plan;
    if (workStatus) query.workStatus = workStatus;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      query.$or = [
        { email: rx },
        { phone: rx },
        { name: rx },
        { usercode: rx },
        { username: rx },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(query),
    ]);

    // Add lead count per user
    const userIds = users.map((u) => u._id);
    const leadCounts = await Lead.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const leadMap = {};
    leadCounts.forEach((l) => { leadMap[l._id.toString()] = l.count; });

    const enriched = users.map((u) => ({
      ...u,
      leadCount: leadMap[u._id.toString()] || 0,
    }));

    res.json({ users: enriched, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Assign plan to user (manual activation)
// @route PUT /api/admin/users/:id/plan
// @access Admin
exports.assignPlan = async (req, res) => {
  try {
    const { plan, cycle, expiryDate, durationDays } = req.body;
    if (!plan) return res.status(400).json({ message: 'Plan identifier is required' });

    const { updateUserPlan } = require('../utils/subscriptionManager');
    const result = await updateUserPlan(req.params.id, plan, cycle || 'monthly', true, {
      expiryDate,
      durationDays,
      adminId: req.user._id,
      adminName: req.user.name,
      paymentMethod: 'admin_override',
    });

    const returnedUser = result.user.toObject ? result.user.toObject() : { ...result.user };
    delete returnedUser.password;
    delete returnedUser.twoFactorSecret;
    delete returnedUser.twoFactorOtp;
    returnedUser.subscriptionLifecycle = result.subscriptionLifecycle;

    res.json({
      message: `Plan updated to ${plan.toUpperCase()} successfully`,
      user: returnedUser,
      subscriptionLifecycle: result.subscriptionLifecycle,
    });
  } catch (error) {
    console.error('assignPlan error:', error);
    res.status(400).json({ message: error.message || 'Failed to update plan' });
  }
};

// @desc  Toggle user active/inactive status
// @route PUT /api/admin/users/:id/status
// @access Admin
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.json({ message: `User account ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Delete user account
// @route DELETE /api/admin/users/:id
// @access Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'superadmin' || user.isAdmin || user.email === 'admin@crm.com') {
      return res.status(403).json({ message: 'Super Admin accounts are protected and cannot be deleted.' });
    }

    await User.findByIdAndDelete(req.params.id);
    await Lead.deleteMany({ userId: req.params.id });

    res.json({ message: 'User and associated data permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get coupons
// @route GET /api/admin/coupons
// @access Admin
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create coupon
// @route POST /api/admin/coupons
// @access Admin
exports.createCoupon = async (req, res) => {
  try {
    const { code, discountPercent, planGranted, durationDays, maxUses, validUntil } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const exists = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (exists) return res.status(400).json({ message: 'Coupon code already exists' });

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      discountPercent: Number(discountPercent) || 0,
      planGranted: planGranted || 'pro',
      durationDays: Number(durationDays) || 30,
      maxUses: maxUses ? Number(maxUses) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive: true,
    });

    res.status(201).json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Delete coupon
// @route DELETE /api/admin/coupons/:id
// @access Admin
exports.deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Send custom notification/alert to all users or specific user
// @route POST /api/admin/alerts
// @access Admin
exports.sendCustomAlert = async (req, res) => {
  try {
    const { userId, title, message, type = 'system_alert' } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Title and message are required' });

    if (userId && userId !== 'all') {
      await Notification.create({ userId, title, message, type });
    } else {
      const users = await User.find({ isActive: true }).select('_id');
      const docs = users.map(u => ({ userId: u._id, title, message, type }));
      await Notification.insertMany(docs);
    }

    res.json({ message: 'Alert dispatched successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Suspend or unsuspend user with violation levels
// @route POST /api/admin/users/:id/suspend
// @access Admin
exports.suspendUser = async (req, res) => {
  try {
    const { level, reason, unsuspend } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (unsuspend) {
      user.suspension = {
        isSuspended: false,
        level: 0,
        reason: null,
        suspendedAt: null,
        suspendedUntil: null,
      };
      await user.save({ validateBeforeSave: false });
      return res.json({ message: 'Suspension lifted successfully', user });
    }

    const lvl = parseInt(level) || 1;
    let durationMs = 0;
    if (lvl === 1) durationMs = 24 * 60 * 60 * 1000;
    else if (lvl === 2) durationMs = 7 * 24 * 60 * 60 * 1000;
    else if (lvl === 3) durationMs = 30 * 24 * 60 * 60 * 1000;

    const now = new Date();
    const suspendedUntil = lvl === 4 ? null : new Date(now.getTime() + durationMs);

    user.suspension = {
      isSuspended: true,
      level: lvl,
      reason: reason || 'Terms violation',
      suspendedAt: now,
      suspendedUntil,
    };

    if (lvl === 4) {
      await waSession.disconnect(user._id).catch(() => {});
    }

    await user.save({ validateBeforeSave: false });
    res.json({ message: `User suspended at Level ${lvl}`, user });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get abuse logs
// @route GET /api/admin/abuse-logs
// @access Admin
exports.getAbuseLogs = async (req, res) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AbuseLog.find(query)
        .populate('userId', 'name email phone username')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AbuseLog.countDocuments(query),
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get abuse logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
