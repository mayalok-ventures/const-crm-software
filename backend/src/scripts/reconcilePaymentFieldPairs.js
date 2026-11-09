/**
 * Idempotent Reconciliation Script: Payment Dual Field Pairs Reconciliation
 *
 * Scans Payment documents where snake_case and camelCase field pairs have drifted,
 * synchronizes them to match, and reports statistics.
 *
 * Default mode: DRY RUN (no modifications)
 * To apply updates: node src/scripts/reconcilePaymentFieldPairs.js --apply
 */

const mongoose = require('mongoose');

const DUAL_PAIRS = [
  ['lead_id', 'leadId'],
  ['agent_id', 'agentId'],
  ['transaction_id', 'transactionId'],
  ['verified_by_agent', 'verifiedByAgent'],
  ['verified_at', 'verifiedAt'],
  ['refunded_at', 'refundedAt'],
  ['refund_reason', 'refundReason'],
];

async function runReconciliation(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log(`\n============================================================`);
  console.log(`🛠️  RECONCILIATION: Payment Dual Field Pairs Synchronization`);
  console.log(`🔒 Mode: ${isApply ? 'APPLY (Active Database Writes)' : 'DRY RUN (Read Only Preview)'}`);
  console.log(`============================================================\n`);

  const Payment = require('../models/Payment');

  let totalScanned = 0;
  let driftedCount = 0;

  const cursor = Payment.find({}).cursor();

  for await (const pay of cursor) {
    totalScanned++;
    if (totalScanned % 500 === 0) {
      console.log(`  ⏳ Processed ${totalScanned} payments (Drifted: ${driftedCount})...`);
    }
    const updates = {};
    let needsUpdate = false;

    for (const [snake, camel] of DUAL_PAIRS) {
      const snakeVal = pay.get(snake);
      const camelVal = pay.get(camel);

      const sHas = snakeVal !== undefined && snakeVal !== null && snakeVal !== '';
      const cHas = camelVal !== undefined && camelVal !== null && camelVal !== '';

      if (sHas && !cHas) {
        updates[camel] = snakeVal;
        needsUpdate = true;
      } else if (cHas && !sHas) {
        updates[snake] = camelVal;
        needsUpdate = true;
      } else if (typeof snakeVal === 'boolean' && typeof camelVal !== 'boolean') {
        updates[camel] = snakeVal;
        needsUpdate = true;
      } else if (typeof camelVal === 'boolean' && typeof snakeVal !== 'boolean') {
        updates[snake] = camelVal;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      driftedCount++;
      if (isApply) {
        await Payment.collection.updateOne({ _id: pay._id }, { $set: updates });
      }
    }
  }

  console.log(`\n============================================================`);
  console.log(`📋 RECONCILIATION SUMMARY:`);
  console.log(`  - Total Payments Scanned:  ${totalScanned}`);
  console.log(`  - Drifted Documents Found: ${driftedCount}`);
  console.log(`  - Synchronized Documents:  ${isApply ? driftedCount : 0}`);
  console.log(`============================================================\n`);

  if (!isApply && driftedCount > 0) {
    console.log(`ℹ️  To synchronize these ${driftedCount} records, run:`);
    console.log(`   node src/scripts/reconcilePaymentFieldPairs.js --apply\n`);
  }

  return { total: totalScanned, drifted: driftedCount };
}

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB().then(async () => {
    try {
      await runReconciliation();
      process.exit(0);
    } catch (err) {
      console.error('Reconciliation error:', err);
      process.exit(1);
    }
  });
}

module.exports = { runReconciliation };
