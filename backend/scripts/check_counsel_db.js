const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mobile-crm');
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({
    $or: [
      { role: { $regex: 'counsel', $options: 'i' } },
      { companyRole: { $regex: 'counsel', $options: 'i' } },
      { workStatus: { $regex: 'counsel', $options: 'i' } }
    ]
  }).toArray();
  console.log('Users count:', users.length);
  users.forEach(u => console.log('User:', u.email, 'role:', u.role, 'companyRole:', u.companyRole, 'workStatus:', u.workStatus));

  const mems = await db.collection('workspacememberships').find({
    role: { $regex: 'counsel', $options: 'i' }
  }).toArray();
  console.log('Memberships count:', mems.length);
  mems.forEach(m => console.log('Membership:', m._id, 'role:', m.role));

  const invs = await db.collection('invitations').find({
    role: { $regex: 'counsel', $options: 'i' }
  }).toArray();
  console.log('Invitations count:', invs.length);
  invs.forEach(i => console.log('Invitation:', i._id, 'role:', i.role));

  await mongoose.disconnect();
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
