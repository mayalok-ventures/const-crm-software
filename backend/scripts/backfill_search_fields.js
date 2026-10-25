/**
 * Idempotent Search Fields Backfill Script
 * Usage: node backend/scripts/backfill_search_fields.js
 * 
 * Safely populates `nameLower`, `companyLower`, and `phoneDigits` in batches.
 * Safe to interrupt and resume (only updates records missing normalized fields).
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function backfill() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const leadsCollection = db.collection('leads');

  const filter = {
    $or: [
      { nameLower: { $exists: false } },
      { nameLower: '' },
      { phoneDigits: { $exists: false } },
      { companyLower: { $exists: false } },
    ],
  };

  const totalToUpdate = await leadsCollection.countDocuments(filter);
  console.log(`Found ${totalToUpdate} leads requiring search fields normalization.`);

  if (totalToUpdate === 0) {
    console.log('No backfill needed.');
    await mongoose.disconnect();
    return;
  }

  const BATCH_SIZE = 1000;
  let processed = 0;

  const cursor = leadsCollection.find(filter).project({
    _id: 1,
    name: 1,
    company: 1,
    phone: 1,
  }).batchSize(BATCH_SIZE);

  let bulkOps = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const nameLower = doc.name ? String(doc.name).toLowerCase().trim() : '';
    const companyLower = doc.company ? String(doc.company).toLowerCase().trim() : '';
    const phoneDigits = doc.phone ? String(doc.phone).replace(/\D/g, '') : '';

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            nameLower,
            companyLower,
            phoneDigits,
          },
        },
      },
    });

    if (bulkOps.length >= BATCH_SIZE) {
      await leadsCollection.bulkWrite(bulkOps, { ordered: false });
      processed += bulkOps.length;
      console.log(`Processed ${processed}/${totalToUpdate} leads (${((processed / totalToUpdate) * 100).toFixed(1)}%)...`);
      bulkOps = [];
    }
  }

  if (bulkOps.length > 0) {
    await leadsCollection.bulkWrite(bulkOps, { ordered: false });
    processed += bulkOps.length;
  }

  console.log(`\nBackfill complete! Normalized ${processed} leads.`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
