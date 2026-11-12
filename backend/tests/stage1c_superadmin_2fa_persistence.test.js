/**
 * Stage 1c Reproduction & Verification: SuperAdmin 2FA Persistence across Reboots
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.ADMIN_EMAIL = 'admin_stage1c@crm.com';
process.env.ADMIN_PASSWORD = 'AdminSecurePassword@123';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const { seedSuperAdmin } = require('../src/utils/seedSuperAdmin');

describe('Stage 1c: SuperAdmin 2FA Persistence across Server Boot', function () {
  this.timeout(30000);
  let mongoServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('1. Initial boot seeds SuperAdmin successfully', async () => {
    await seedSuperAdmin();
    const admin = await User.findOne({ email: 'admin_stage1c@crm.com' });
    assert.ok(admin, 'SuperAdmin was not seeded');
    assert.strictEqual(admin.role, 'superadmin');
    assert.strictEqual(admin.isAdmin, true);
  });

  it('2. SuperAdmin enables 2FA and second boot NEVER clears 2FA or secret', async () => {
    // SuperAdmin configures and enables 2FA
    const admin = await User.findOne({ email: 'admin_stage1c@crm.com' });
    admin.twoFactorEnabled = true;
    admin.twoFactorSecret = 'JBSWY3DPEHPK3PXP';
    admin.tokenVersion = 3;
    await admin.save();

    // Verify 2FA is active before reboot
    const adminPre = await User.findOne({ email: 'admin_stage1c@crm.com' });
    assert.strictEqual(adminPre.twoFactorEnabled, true);

    // Simulate server reboot / redeploy by calling seedSuperAdmin again
    await seedSuperAdmin();

    // Fetch account after reboot
    const adminPost = await User.findOne({ email: 'admin_stage1c@crm.com' });
    assert.strictEqual(adminPost.twoFactorEnabled, true, 'VULNERABILITY: seedSuperAdmin reset twoFactorEnabled to false on reboot!');
    assert.strictEqual(adminPost.twoFactorSecret, 'JBSWY3DPEHPK3PXP', 'twoFactorSecret was lost on reboot!');
    assert.strictEqual(adminPost.tokenVersion, 3, 'tokenVersion was lost on reboot!');
  });
});
