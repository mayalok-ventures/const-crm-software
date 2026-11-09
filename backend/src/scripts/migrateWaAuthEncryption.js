/**
 * WhatsApp Auth State Encryption Migration Script (RC-3 Item 3)
 *
 * Scans all documents in the `whatsappauths` collection.
 * Converts legacy unencrypted plaintext credentials or older key versions
 * into AES-256-GCM ciphertext encrypted under the active WA_ENCRYPTION_KEY with keyId.
 *
 * Safety Invariants:
 * 1. Default DRY-RUN mode: Read-only preview by default unless invoked with `--apply`.
 * 2. Mandatory Verify-Decrypt Step: Before persisting any encrypted string to MongoDB,
 *    the script deciphers it in-memory and asserts byte-for-byte identity against the plaintext.
 * 3. Idempotent: Documents already encrypted under the target keyId are safely skipped.
 * 4. Rollback Procedure:
 *    - The decryption engine in `mongoAuthState.js` is strictly backward-compatible.
 *    - To roll back to unencrypted state if needed, run with `--rollback` or restore from snapshot.
 *
 * Usage:
 *   node backend/src/scripts/migrateWaAuthEncryption.js           (Dry Run)
 *   node backend/src/scripts/migrateWaAuthEncryption.js --apply   (Persist to Database)
 *   node backend/src/scripts/migrateWaAuthEncryption.js --rollback (Decodes to Plaintext)
 */

const mongoose = require('mongoose');
const WhatsAppAuth = require('../models/WhatsAppAuth');
const {
  encryptAuthState,
  decryptAuthState,
  getActiveKeyId,
  resolveKey,
} = require('../services/mongoAuthState');

async function runWaAuthMigration(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  const isRollback = options.rollback || process.argv.includes('--rollback');
  const targetKeyId = options.keyId || getActiveKeyId();

  console.log('='.repeat(75));
  console.log('🔒 WHATSAPP AUTH CREDENTIALS ENCRYPTION MIGRATION');
  console.log(`Mode: ${isApply ? 'APPLY (Active Database Writes)' : isRollback ? 'ROLLBACK (Decrypt to Plaintext)' : 'DRY RUN (Preview Only)'}`);
  console.log(`Active Target Key ID: "${targetKeyId}"`);
  console.log('='.repeat(75));

  const activeKey = resolveKey(targetKeyId);
  if (!activeKey && !isRollback) {
    throw new Error(`Fatal: WA_ENCRYPTION_KEY for keyId "${targetKeyId}" is not configured. Aborting.`);
  }

  const totalDocs = await WhatsAppAuth.countDocuments();
  console.log(`📊 Discovered ${totalDocs} total WhatsAppAuth record(s) across all sessions.`);

  let alreadyUpToDate = 0;
  let migrated = 0;
  let failed = 0;
  let scanned = 0;

  const cursor = WhatsAppAuth.find().cursor();

  for await (const doc of cursor) {
    scanned++;
    if (scanned % 100 === 0) {
      console.log(`  ⏳ Processing ${scanned}/${totalDocs}...`);
    }

    try {
      const currentData = doc.data;

      if (isRollback) {
        if (!currentData.startsWith('enc:')) {
          alreadyUpToDate++;
          continue;
        }
        const plaintext = decryptAuthState(currentData);
        if (isApply) {
          await WhatsAppAuth.updateOne({ _id: doc._id }, { $set: { data: plaintext } });
        }
        migrated++;
        continue;
      }

      // Check if already encrypted with target key ID
      if (currentData.startsWith(`enc:${targetKeyId}:`)) {
        alreadyUpToDate++;
        continue;
      }

      // Decrypt to plaintext (whether legacy plaintext or older key)
      const plaintext = decryptAuthState(currentData);

      // Encrypt with active key
      const newCiphertext = encryptAuthState(plaintext, targetKeyId);

      // MANDATORY VERIFY-DECRYPT STEP
      const verified = decryptAuthState(newCiphertext);
      if (verified !== plaintext) {
        throw new Error(`Verification decryption mismatch for document ${doc._id} (key: ${doc.key})`);
      }

      if (isApply) {
        await WhatsAppAuth.updateOne({ _id: doc._id }, { $set: { data: newCiphertext } });
      }
      migrated++;
    } catch (docErr) {
      failed++;
      console.error(`❌ [Migration Error] Failed to process doc ${doc._id} (${doc.key}):`, docErr.message);
    }
  }

  console.log('\n' + '='.repeat(75));
  console.log('MIGRATION SUMMARY:');
  console.log(`  Total Inspected:    ${scanned}`);
  console.log(`  Already Up-to-Date: ${alreadyUpToDate}`);
  console.log(`  Successfully Migrated: ${migrated} ${isApply ? '(Written)' : '(Previewed)'}`);
  console.log(`  Errors / Failures:  ${failed}`);
  console.log('='.repeat(75) + '\n');

  if (failed > 0) {
    throw new Error(`Migration finished with ${failed} error(s).`);
  }

  return { scanned, alreadyUpToDate, migrated, failed, mode: isApply ? 'apply' : isRollback ? 'rollback' : 'dry-run' };
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  mongoose.connect(mongoUri)
    .then(async () => {
      await runWaAuthMigration();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal Migration Error:', err.message);
      process.exit(1);
    });
}

module.exports = { runWaAuthMigration };
