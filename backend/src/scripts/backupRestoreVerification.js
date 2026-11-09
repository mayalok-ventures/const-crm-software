const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { BSON } = require('mongodb');

/**
 * Deterministic SHA-256 checksum of an array of MongoDB documents.
 * Sorts documents by _id and serializes stable JSON.
 */
function computeCollectionChecksum(docs) {
  const sortedDocs = [...docs].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  const serialized = JSON.stringify(sortedDocs, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
  });
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Execute local database backup and restore verification drill.
 */
async function runBackupRestoreDrill({ uri, targetUri, outputDir }) {
  const dumpDir = outputDir || path.resolve(__dirname, '../../scratch/backup_drill');
  if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

  const srcConn = await mongoose.createConnection(uri).asPromise();
  const tgtConn = await mongoose.createConnection(targetUri).asPromise();

  const collectionsToTest = ['users', 'workspaces', 'leads'];
  const telemetry = {
    collections: {},
    totalDocs: 0,
    dumpElapsedMs: 0,
    restoreElapsedMs: 0,
    dumpDocsPerSec: 0,
    restoreDocsPerSec: 0,
    checksumParity: true,
  };

  console.log('\n--- 1. BACKUP PHASE (BSON DUMP & CHECKSUM) ---');
  const t0Dump = Date.now();
  for (const colName of collectionsToTest) {
    const col = srcConn.collection(colName);
    const docs = await col.find({}).toArray();
    const count = docs.length;
    telemetry.totalDocs += count;

    const checksum = computeCollectionChecksum(docs);
    const bsonBuffer = BSON.serialize({ docs });

    const archivePath = path.join(dumpDir, `${colName}.bson`);
    fs.writeFileSync(archivePath, bsonBuffer);

    telemetry.collections[colName] = {
      count,
      preDumpChecksum: checksum,
      archiveSizeKb: Math.round(bsonBuffer.byteLength / 1024),
    };
    console.log(`  [DUMP] ${colName}: ${count} docs -> ${telemetry.collections[colName].archiveSizeKb} KB (SHA-256: ${checksum.slice(0, 12)}...)`);
  }
  telemetry.dumpElapsedMs = Date.now() - t0Dump;
  telemetry.dumpDocsPerSec = Math.round((telemetry.totalDocs / Math.max(1, telemetry.dumpElapsedMs)) * 1000);
  console.log(`Backup completed: ${telemetry.totalDocs} docs in ${telemetry.dumpElapsedMs}ms (${telemetry.dumpDocsPerSec} docs/sec)`);

  console.log('\n--- 2. RESTORATION PHASE (BSON RESTORE & VERIFY) ---');
  const t0Restore = Date.now();
  for (const colName of collectionsToTest) {
    const archivePath = path.join(dumpDir, `${colName}.bson`);
    const fileBuf = fs.readFileSync(archivePath);
    const deserialized = BSON.deserialize(fileBuf);
    const docsToRestore = deserialized.docs || [];

    const tgtCol = tgtConn.collection(colName);
    await tgtCol.deleteMany({});
    if (docsToRestore.length > 0) {
      await tgtCol.insertMany(docsToRestore, { ordered: false });
    }

    const restoredDocs = await tgtCol.find({}).toArray();
    const postChecksum = computeCollectionChecksum(restoredDocs);

    telemetry.collections[colName].restoredCount = restoredDocs.length;
    telemetry.collections[colName].postRestoreChecksum = postChecksum;
    const match = telemetry.collections[colName].preDumpChecksum === postChecksum;
    telemetry.collections[colName].checksumMatch = match;
    if (!match) telemetry.checksumParity = false;

    console.log(`  [RESTORE] ${colName}: ${restoredDocs.length} docs restored (Checksum Match: ${match ? 'YES' : 'NO'})`);
  }
  telemetry.restoreElapsedMs = Date.now() - t0Restore;
  telemetry.restoreDocsPerSec = Math.round((telemetry.totalDocs / Math.max(1, telemetry.restoreElapsedMs)) * 1000);
  console.log(`Restoration completed: ${telemetry.totalDocs} docs in ${telemetry.restoreElapsedMs}ms (${telemetry.restoreDocsPerSec} docs/sec)`);

  await srcConn.close();
  await tgtConn.close();

  // Cleanup drill files
  try {
    for (const colName of collectionsToTest) {
      const p = path.join(dumpDir, `${colName}.bson`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch (_) {}

  return telemetry;
}

module.exports = { runBackupRestoreDrill, computeCollectionChecksum };
