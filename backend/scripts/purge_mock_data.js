require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const path = require('path');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Subscription = require('../src/models/Subscription');
const Transaction = require('../src/models/Transaction');
const Workspace = require('../src/models/Workspace');
const { seedSuperAdmin } = require('../src/utils/seedSuperAdmin');

async function purgeMockData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to database: ${mongoose.connection.name}`);

    // 1. Delete legacy / unauthorized superadmin accounts
    const delAdmin = await User.deleteMany({
      email: { $in: ['admin@yourapp.com', 'admin@crm.com'] }
    });
    console.log(`Deleted legacy admin accounts: ${delAdmin.deletedCount}`);

    // 2. Delete all fake / test / mock accounts generated during test runs
    const delTestUsers = await User.deleteMany({
      email: { $regex: /_179|tenant_|test|apex|eduguide|pathfinder|benchmark|example\.com/i }
    });
    console.log(`Deleted fake test users: ${delTestUsers.deletedCount}`);

    // 3. Delete any other superadmin except superadmin@sahyak.com
    const delOtherSA = await User.deleteMany({
      role: 'superadmin',
      email: { $ne: 'superadmin@sahyak.com' }
    });
    console.log(`Deleted other unauthorized superadmins: ${delOtherSA.deletedCount}`);

    // 4. Clear all fake test leads
    const delLeads = await Lead.deleteMany({});
    console.log(`Cleared fake leads: ${delLeads.deletedCount}`);

    // 5. Clear fake subscriptions & transactions
    const delSubs = await Subscription.deleteMany({});
    console.log(`Cleared fake subscriptions: ${delSubs.deletedCount}`);

    const delTx = await Transaction.deleteMany({});
    console.log(`Cleared fake transactions: ${delTx.deletedCount}`);

    // 6. Clean orphan test workspaces (workspaces not owned by our legitimate users)
    const validUserIds = (await User.find({})).map(u => u._id);
    const delWs = await Workspace.deleteMany({
      $or: [
        { name: { $regex: /test|apex|eduguide|pathfinder|audit|consultant|bob/i } },
        { owner: { $nin: validUserIds } }
      ]
    });
    console.log(`Cleaned test workspaces: ${delWs.deletedCount}`);

    // 7. Ensure single verified superadmin exists
    await seedSuperAdmin();

    // 8. Report final database state
    const remainingUsers = await User.find({}).select('email name role createdAt');
    console.log('\n--- REAL ACTIVE USERS REMAINING IN DATABASE ---');
    console.table(remainingUsers.map(u => ({ id: u._id.toString(), email: u.email, name: u.name, role: u.role })));

    await mongoose.disconnect();
    console.log('\nPurge complete. Database holds only real users and single superadmin.');
  } catch (err) {
    console.error('Error during purge:', err);
    process.exit(1);
  }
}

purgeMockData();
