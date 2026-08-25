require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PROD_URI = process.env.MONGO_URI || 'mongodb+srv://mayalokventures:Mflica2026crm@cluster0.j988j68.mongodb.net/mobile-crm?retryWrites=true&w=majority&appName=Cluster0';

async function cleanProductionDatabase() {
  console.log('\n======================================================');
  console.log('🧹 CORESETU CRM — PRODUCTION DATABASE CLEANUP');
  console.log('======================================================\n');
  console.log('📡 Connecting to Production MongoDB Cluster...');

  try {
    await mongoose.connect(PROD_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('✅ Connected to Production MongoDB:', mongoose.connection.host, '/', mongoose.connection.name);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`\n📦 Found ${collections.length} collections in production database.`);

    // Summary of existing counts
    console.log('\n--- Pre-Cleanup Document Counts ---');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(` • ${col.name}: ${count} documents`);
    }

    console.log('\n🚀 Starting cleanup of dummy data...');

    const collectionsToClear = [
      'leads',
      'projects',
      'inventories',
      'requirements',
      'opportunities',
      'eois',
      'bookings',
      'paymentschedules',
      'followups',
      'offers',
      'commissionrules',
      'commissionpayouts',
      'notifications',
      'activitylogs',
      'auditlogs',
      'campaigns',
      'groups',
      'whatsappmessages',
      'whatsapptemplates',
      'tenantconfigs',
      'users',
    ];

    let totalDeleted = 0;

    for (const colName of collectionsToClear) {
      const exists = collections.some((c) => c.name === colName);
      if (exists) {
        const result = await db.collection(colName).deleteMany({});
        console.log(`  🗑️ Cleared collection [${colName}]: ${result.deletedCount} documents deleted`);
        totalDeleted += result.deletedCount;
      }
    }

    console.log(`\n✨ Total documents removed: ${totalDeleted}`);

    // Seed Fresh Default Admin User
    console.log('\n👑 Seeding Fresh Single SuperAdmin Account...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    const adminUser = {
      name: 'Super Admin',
      email: 'admin@yourapp.com',
      password: hashedPassword,
      role: 'superadmin',
      isAdmin: true,
      subscriptionPlan: 'smart_team',
      subscriptionStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('users').insertOne(adminUser);
    console.log('✅ Fresh SuperAdmin created:');
    console.log('   Email:    admin@yourapp.com');
    console.log('   Password: Admin@123');
    console.log('   Role:     superadmin');

    console.log('\n======================================================');
    console.log('🏁 PRODUCTION DATABASE CLEANUP COMPLETED SUCCESSFULLY');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Error during database cleanup:', err.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed.');
  }
}

cleanProductionDatabase();
