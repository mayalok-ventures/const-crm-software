require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const OrganizationUsage = require('../src/models/OrganizationUsage');
const UsageSnapshot = require('../src/models/UsageSnapshot');
const UsageAlert = require('../src/models/UsageAlert');

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB:', mongoUri.split('@')[1] || mongoUri);

  const orgs = await OrganizationUsage.find({}).lean();
  console.log(`\n=== TOTAL ORGANIZATIONS IN USAGE MONITOR: ${orgs.length} ===`);
  for (const o of orgs) {
    console.log(`\n🏢 ${o.organizationName} (${o.plan})`);
    console.log(`   Storage:    ${o.storage.usedFormatted} / ${o.storage.limitFormatted} (${o.storage.percent}%) [Health: ${o.storage.healthScore}%, Status: ${o.storage.status}]`);
    console.log(`   Users:      ${o.users.activeUsers} / ${o.users.maxUsers} (${o.users.percent}%) [Capacity: ${o.users.capacityScore}%, Status: ${o.users.status}]`);
    console.log(`   API:        ${o.apiRequests.currentMonthRequests.toLocaleString()} / ${o.apiRequests.maxRequests.toLocaleString()} (${o.apiRequests.percent}%) [Capacity: ${o.apiRequests.capacityScore}%, Status: ${o.apiRequests.status}]`);
    console.log(`   DB Records: ${o.databaseRecords.totalRecords} (Leads: ${o.databaseRecords.leadsCount})`);
    console.log(`   Overall:    ${o.overallStatus} (Capacity: ${o.overallCapacityPercent}%, Velocity: ${o.growthMetrics?.velocityScore || 0}/100)`);
  }

  const snapshotsCount = await UsageSnapshot.countDocuments();
  const alertsCount = await UsageAlert.countDocuments();
  console.log(`\n📈 Historical Usage Snapshots: ${snapshotsCount}`);
  console.log(`⚠️ Active Usage Alerts: ${alertsCount}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
