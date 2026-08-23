const User = require('../../models/User');

exports.getUsers = async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;
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
