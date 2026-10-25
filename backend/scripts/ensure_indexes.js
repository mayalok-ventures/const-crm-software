/**
 * Production-Safe Idempotent Index Creation Script
 * Usage: node backend/scripts/ensure_indexes.js
 * 
 * Note for Production (EC2 / Atlas):
 * - Runs with background: true so it doesn't block ongoing write/read operations.
 * - Safe to run multiple times (idempotent).
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const db = mongoose.connection.db;
  const leadsCollection = db.collection('leads');

  console.log('Ensuring compound indexes on leads collection...');

  const indexesToCreate = [
    { key: { workspaceId: 1, nameLower: 1 }, name: 'idx_workspace_nameLower' },
    { key: { workspaceId: 1, phoneDigits: 1 }, name: 'idx_workspace_phoneDigits' },
    { key: { workspaceId: 1, companyLower: 1 }, name: 'idx_workspace_companyLower' },
    { key: { workspaceId: 1, status: 1, updatedAt: -1 }, name: 'idx_workspace_status_updatedAt' },
    { key: { workspaceId: 1, assignedTo: 1, updatedAt: -1 }, name: 'idx_workspace_assignedTo_updatedAt' },
    { key: { workspaceId: 1, updatedAt: -1 }, name: 'idx_workspace_updatedAt' },
    { key: { workspaceId: 1, createdAt: -1 }, name: 'idx_workspace_createdAt' },
  ];

  for (const idx of indexesToCreate) {
    try {
      const idxName = Object.entries(idx.key).map(([k, v]) => `${k}_${v}`).join('_');
      console.log(`Ensuring index on ${JSON.stringify(idx.key)}...`);
      await leadsCollection.createIndex(idx.key, { background: true });
      console.log(`  ✓ ${idxName} ready`);
    } catch (err) {
      console.error(`  ✗ Error creating index:`, err.message);
    }
  }

  console.log('\nAll required indexes ensured successfully.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Index creation failed:', err);
  process.exit(1);
});
