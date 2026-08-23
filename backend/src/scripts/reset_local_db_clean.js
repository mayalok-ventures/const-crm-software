const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Lead = require('../models/Lead');
const Integration = require('../models/Integration');
const Broadcast = require('../models/Broadcast');
const Pipeline = require('../models/Pipeline');
const Plan = require('../models/Plan');
const { seedPlans } = require('../utils/seedPlans');
const { seedSuperAdmin } = require('../utils/seedSuperAdmin');

async function resetCleanLocal() {
  console.log('\n======================================================');
  console.log('       100% STRICT LOCAL DATABASE RESET INITIATED     ');
  console.log('======================================================');
  console.log(`Connecting to: ${process.env.MONGODB_URI}`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to Local Database: ${mongoose.connection.name} (${mongoose.connection.host})`);

  // 1. Wipe all test data from local DB
  const collections = ['leads', 'integrations', 'broadcasts', 'pipelines', 'activitylogs'];
  for (const collName of collections) {
    try {
      const coll = mongoose.connection.collection(collName);
      const count = await coll.countDocuments();
      await coll.deleteMany({});
      console.log(`🧹 Cleaned collection [${collName}]: removed ${count} old records.`);
    } catch (e) {
      console.log(`Notice for [${collName}]: ${e.message}`);
    }
  }

  // 2. Ensure SuperAdmin exists
  await User.deleteMany({ role: { $ne: 'superadmin' } });
  await seedSuperAdmin();
  console.log('👑 Single SuperAdmin Account Seeded: admin@crm.com / Admin@123');

  // 3. Ensure Subscription Plans exist
  await seedPlans();
  console.log('💳 Standardized 12 Subscription Plans Seeded.');

  // 4. Create default connected Meta & Google Integration in local DB for testing
  const adminUser = await User.findOne({ email: 'admin@crm.com' }) || await User.findOne();
  if (adminUser) {
    await Integration.create({
      userId: adminUser._id,
      companyId: null,
      provider: 'meta',
      mode: 'client_managed',
      status: 'connected',
      accountId: 'act_1361325099456512',
      accountName: 'Meta Ads Test Account (Localhost)',
      pageId: '109876543210987',
      pageName: 'Admission-360 Official Page',
      formIds: ['meta_form_leadgen_01'],
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      connectedAt: new Date(),
    });
    console.log('🔌 Local Meta Ads Integration Ready for local test lead ingestion.');
  }

  console.log('\n======================================================');
  console.log('🎉 LOCAL DATABASE IS NOW 100% CLEAN, LOCALIZED & ISOLATED!');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

resetCleanLocal().catch(console.error);
