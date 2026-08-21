/**
 * SCRIPT: WIPE LOCAL MONGODB DATABASE
 * File: backend/scripts/wipe_local_db.js
 *
 * Drops all collections from local MongoDB and re-initializes the fresh Single Admin account.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { seedSuperAdmin } = require('../src/utils/seedSuperAdmin');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function wipeDatabase() {
  console.log('\n🧹 ========================================================');
  console.log('   LOCAL MONGODB DATABASE WIPE & RESET UTILITY');
  console.log('========================================================\n');

  try {
    console.log(`Connecting to: ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB.');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log('ℹ️ Database is already completely empty (0 collections).');
    } else {
      console.log(`Found ${collections.length} collections. Dropping all data...`);
      for (const col of collections) {
        try {
          await db.collection(col.name).drop();
          console.log(`  🗑️ Dropped collection: ${col.name}`);
        } catch (e) {
          console.warn(`  ⚠️ Could not drop ${col.name}: ${e.message}`);
        }
      }
      console.log('✅ All collections successfully dropped and wiped.');
    }

    // Re-seed default Admin
    console.log('\n👑 Re-initializing clean Single Admin account...');
    await seedSuperAdmin();
    console.log('✅ Default SuperAdmin (admin@crm.com / Admin@123) is ready.');

    console.log('\n✨ Database wipe and clean initialization completed successfully.\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error wiping database:', err.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

wipeDatabase();
