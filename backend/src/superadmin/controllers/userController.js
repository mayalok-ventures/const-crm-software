const mongoose = require('mongoose');
const User = require('../../models/User');

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
      query.isActive = status === 'active';
    }

    const targetOrg = organisationId || companyId;
    if (targetOrg && mongoose.Types.ObjectId.isValid(targetOrg)) {
      const orgOid = new mongoose.Types.ObjectId(targetOrg);
      query.$or = [{ companyId: orgOid }, { _id: orgOid }];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('-password')
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
    if (user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin accounts' });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, message: `User role updated to ${role} successfully`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, userStatus } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin accounts' });
    }

    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (userStatus) user.userStatus = userStatus;
    await user.save();

    res.json({ success: true, message: 'User status updated successfully', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot delete Super Admin accounts' });
    }

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
