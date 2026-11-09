/**
 * Safe Migration Script: User tokenVersion Default Backfill (Stage B3)
 *
 * Scans all User documents where `tokenVersion` is undefined or null,
 * and sets `tokenVersion: 0` for safe session lifecycle tracking.
 *
 * Usage:
 *   node backend/src/scripts/backfillTokenVersion.js           (Dry Run by default)
 *   node backend/src/scripts/backfillTokenVersion.js --apply   (Applies updates)
 */

const mongoose = require('mongoose');

async function runTokenVersionBackfill(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log('='.repeat(75));
  console.log('🛠️  BACKFILL: User tokenVersion Default Initialization');
  console.log(`🔒 Mode: ${isApply ? 'APPLY (Active Database Writes)' : 'DRY RUN (Read Only Preview)'}`);
  console.log('='.repeat(75));

  const User = mongoose.models.User || require('../models/User');

  const query = {
    $or: [
      { tokenVersion: null },
      { tokenVersion: { $exists: false } },
    ],
  };

  const totalUnset = await User.countDocuments(query);
  console.log(`📊 Found ${totalUnset} user(s) with missing tokenVersion.`);

  if (totalUnset === 0) {
    console.log('✅ All users already possess an initialized tokenVersion. Zero actions required.\n');
    return { total: 0, updated: 0 };
  }

  let scanned = 0;
  let updatedCount = 0;
  const cursor = User.find(query).cursor();

  for await (const user of cursor) {
    scanned++;
    if (scanned % 500 === 0) {
      console.log(`  ⏳ Processed ${scanned}/${totalUnset} users...`);
    }

    updatedCount++;
    if (isApply) {
      await User.updateOne({ _id: user._id }, { $set: { tokenVersion: 0 } });
    }
  }

  console.log('\n' + '='.repeat(75));
  console.log(`SUMMARY: ${updatedCount} user(s) ${isApply ? 'updated to tokenVersion: 0' : 'would be updated (dry run)'}.`);
  console.log('='.repeat(75) + '\n');

  return { total: totalUnset, updated: updatedCount, mode: isApply ? 'apply' : 'dry-run' };
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  mongoose.connect(mongoUri)
    .then(async () => {
      await runTokenVersionBackfill();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal TokenVersion Backfill Error:', err.message);
      process.exit(1);
    });
}

module.exports = { runTokenVersionBackfill };
