require('dotenv').config();
const mongoose = require('mongoose');

async function inspect() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile_crm';
  await mongoose.connect(uri);
  const User = require('../models/User');
  const Lead = require('../models/Lead');

  const users = await User.find({}, { name: 1, email: 1, phone: 1, role: 1, industryType: 1, createdAt: 1 }).lean();
  const leads = await Lead.find({}, { name: 1, email: 1, phone: 1, source: 1, userId: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(30).lean();

  console.log(`=== USERS IN DB (${users.length}) ===`);
  console.log(JSON.stringify(users, null, 2));

  console.log(`=== LATEST LEADS IN DB (${leads.length}) ===`);
  console.log(JSON.stringify(leads, null, 2));

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
