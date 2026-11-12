const User = require('../models/User');

const seedSuperAdmin = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@crm.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      admin = await User.create({
        name: 'Admin',
        email: adminEmail,
        password: adminPassword,
        username: 'ADMIN',
        role: 'superadmin',
        isAdmin: true,
        userStatus: 'active',
        workStatus: 'company_owner',
        companyRole: 'owner',
        twoFactorEnabled: false,
        plan: 'enterprise',
      });
      console.log(`\n👑 [ADMIN SEED] Initialized Single Admin: ${admin.email}`);
    } else {
      let updated = false;
      if (admin.role !== 'superadmin') { admin.role = 'superadmin'; updated = true; }
      if (!admin.isAdmin) { admin.isAdmin = true; updated = true; }
      // Security preservation: NEVER weaken or clear twoFactorEnabled, twoFactorSecret, or tokenVersion
      if (updated) await admin.save({ validateBeforeSave: false });
    }
  } catch (err) {
    console.warn('[ADMIN SEED] Notice:', err.message);
  }
};

module.exports = { seedSuperAdmin };
