const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedSuperAdmin = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'superadmin@sahyak.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Kunalxca2026@';

    // Purge legacy / unauthorized admin accounts (admin@yourapp.com, admin@crm.com)
    await User.deleteMany({
      email: { $in: ['admin@yourapp.com', 'admin@crm.com'] }
    });
    await User.deleteMany({
      role: 'superadmin',
      email: { $ne: adminEmail }
    });

    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      admin = await User.create({
        name: 'Super Admin',
        email: adminEmail,
        password: adminPassword,
        username: 'SUPERADMIN',
        role: 'superadmin',
        isAdmin: true,
        userStatus: 'active',
        workStatus: 'company_owner',
        companyRole: 'owner',
        twoFactorEnabled: false,
        plan: 'enterprise',
      });
      console.log(`\n👑 [ADMIN SEED] Initialized Single SuperAdmin: ${admin.email}`);
    } else {
      let updated = false;
      if (admin.role !== 'superadmin') { admin.role = 'superadmin'; updated = true; }
      if (!admin.isAdmin) { admin.isAdmin = true; updated = true; }
      if (admin.userStatus !== 'active') { admin.userStatus = 'active'; updated = true; }
      if (admin.suspension?.isSuspended) {
        admin.suspension.isSuspended = false;
        updated = true;
      }
      const passwordMatch = await bcrypt.compare(adminPassword, admin.password);
      if (!passwordMatch) {
        admin.password = adminPassword;
        updated = true;
      }
      // Security preservation: NEVER weaken or clear twoFactorEnabled, twoFactorSecret, or tokenVersion
      if (updated) await admin.save({ validateBeforeSave: false });
      console.log(`\n👑 [ADMIN SEED] SuperAdmin verified: ${admin.email}`);
    }
  } catch (err) {
    console.warn('[ADMIN SEED] Notice:', err.message);
  }
};

module.exports = { seedSuperAdmin };
