const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Integration = require('../models/Integration');
const User = require('../models/User');

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: 'connect4adm@gmail.com' }).lean();
  console.log('User:', {
    _id: String(user._id),
    email: user.email,
    workStatus: user.workStatus,
    companyRole: user.companyRole,
    companyId: user.companyId,
  });

  const allMeta = await Integration.find({ provider: 'meta' }).lean();
  console.log('All Meta Integrations in DB:', allMeta.map(m => ({
    _id: String(m._id),
    userId: String(m.userId),
    companyId: m.companyId ? String(m.companyId) : null,
    provider: m.provider,
    status: m.status,
    accountName: m.accountName,
    pageName: m.pageName,
  })));

  const uid = user._id;
  const isOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';
  const companyId = user?.companyId || (isOwner ? uid : null);

  let query;
  if (companyId) {
    query = {
      $or: [
        { companyId },
        { userId: uid },
      ],
      provider: 'meta',
      status: { $ne: 'disconnected' },
    };
  } else {
    query = {
      userId: uid,
      provider: 'meta',
      status: { $ne: 'disconnected' },
    };
  }

  console.log('Constructed Query:', JSON.stringify(query, null, 2));
  const results = await Integration.find(query).lean();
  console.log('Results Count:', results.length);

  await mongoose.disconnect();
}
debug().catch(console.error);
