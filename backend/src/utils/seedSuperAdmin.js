const User = require('../models/User');

const seedSuperAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@crm.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminPhone = '9999999999';

    let admin = await User.findOne({
      $or: [
        { email: adminEmail.toLowerCase() },
        { username: 'SUPERADMIN' },
        { role: 'superadmin' }
      ]
    });

    if (!admin) {
      admin = await User.create({
        name: 'Platform Super Admin',
        email: adminEmail.toLowerCase(),
        phone: adminPhone,
        password: adminPassword,
        username: 'SUPERADMIN',
        usercode: 'ADM-000001',
        role: 'superadmin',
        isAdmin: true,
        workStatus: 'company_owner',
        companyRole: 'owner',
        plan: 'pro',
        companyInfo: {
          companyName: 'Universal Agency Cloud Central',
        }
      });
      console.log(`\n👑 [SUPERADMIN SEED] Created Super Admin: ${admin.email} (Username: SUPERADMIN / Pass: ${adminPassword})`);
    } else {
      // Ensure superadmin attributes are present
      let updated = false;
      if (admin.role !== 'superadmin') { admin.role = 'superadmin'; updated = true; }
      if (!admin.isAdmin) { admin.isAdmin = true; updated = true; }
      if (!admin.username) { admin.username = 'SUPERADMIN'; updated = true; }
      if (!admin.usercode) { admin.usercode = 'ADM-000001'; updated = true; }
      if (updated) await admin.save({ validateBeforeSave: false });
    }
  } catch (err) {
    console.warn('[SUPERADMIN SEED] Notice:', err.message);
  }
};

module.exports = { seedSuperAdmin };
