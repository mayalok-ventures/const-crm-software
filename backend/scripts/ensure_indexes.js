/**
 * Production-Safe Idempotent Index Creation Script for MongoDB Atlas / Production
 * Usage: node backend/scripts/ensure_indexes.js
 * 
 * Note for Production (Atlas / AppSail):
 * - Runs with background: true (or modern non-blocking index creation) so it doesn't block ongoing write/read operations.
 * - Safe to run multiple times (idempotent).
 * - Masks credentials in logs.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
const safeUri = MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

async function run() {
  console.log(`Connecting to database (${safeUri})...`);
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  });
  console.log('✅ Connected to MongoDB.');

  const db = mongoose.connection.db;

  const collectionsIndexes = {
    leads: [
      { key: { companyId: 1, phone: 1 }, options: { sparse: true } },
      { key: { workspaceId: 1, nameLower: 1 }, options: {} },
      { key: { workspaceId: 1, phoneDigits: 1 }, options: {} },
      { key: { workspaceId: 1, companyLower: 1 }, options: {} },
      { key: { workspaceId: 1, status: 1, updatedAt: -1 }, options: {} },
      { key: { workspaceId: 1, assignedTo: 1, updatedAt: -1 }, options: {} },
      { key: { workspaceId: 1, campaignGroupId: 1 }, options: {} },
      { key: { workspaceId: 1, updatedAt: -1 }, options: {} },
      { key: { workspaceId: 1, createdAt: -1 }, options: {} },
      { key: { 'metadata.metaLeadId': 1 }, options: { sparse: true } },
      { key: { 'metadata.googleLeadId': 1 }, options: { sparse: true } },
    ],
    integrations: [
      { key: { companyId: 1, provider: 1, accountId: 1 }, options: { unique: true, sparse: true } },
      { key: { companyId: 1, provider: 1, status: 1 }, options: {} },
      { key: { googleKeyHash: 1 }, options: { sparse: true } },
      { key: { 'websiteFormConfig.formKey': 1 }, options: { sparse: true } },
    ],
    lead_source_subscriptions: [
      { key: { companyId: 1, integrationId: 1, externalSourceId: 1 }, options: { unique: true, sparse: true } },
      { key: { companyId: 1, destinationCampaignGroupId: 1 }, options: {} },
      { key: { companyId: 1, status: 1 }, options: {} },
    ],
    campaigns: [
      { key: { companyId: 1, status: 1 }, options: {} },
      { key: { companyId: 1, campaignType: 1 }, options: {} },
      { key: { companyId: 1, createdAt: -1 }, options: {} },
    ],
    users: [
      { key: { email: 1 }, options: { unique: true } },
      { key: { companyId: 1, role: 1 }, options: {} },
    ],
    automations: [
      { key: { companyId: 1, status: 1 }, options: {} },
      { key: { companyId: 1, trigger: 1 }, options: {} },
    ],
  };

  for (const [colName, indexes] of Object.entries(collectionsIndexes)) {
    console.log(`\nEnsuring indexes on collection: ${colName}...`);
    const col = db.collection(colName);
    for (const idx of indexes) {
      try {
        const keyDesc = JSON.stringify(idx.key);
        await col.createIndex(idx.key, { background: true, ...idx.options });
        console.log(`  ✓ Created/verified index ${keyDesc}`);
      } catch (err) {
        console.warn(`  ⚠️ Index notice for ${JSON.stringify(idx.key)}:`, err.message);
      }
    }
  }

  console.log('\n✅ All critical database indexes ensured successfully.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Index creation failed:', err.message);
  process.exit(1);
});
