const mongoose = require('mongoose');

let supportsTransactions = null;

/**
 * Executes an async callback inside a MongoDB transaction session.
 * Gracefully degrades if running against a standalone MongoDB instance
 * (e.g. local dev / tests without a replica set).
 *
 * @param {Function} callback Function receiving { session }
 * @returns {Promise<any>} Result of callback
 */
async function withTransaction(callback) {
  // If we already detected this deployment does NOT support transactions (standalone)
  if (supportsTransactions === false) {
    return callback(null);
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (startErr) {
    if (supportsTransactions === null) {
      supportsTransactions = false;
      console.warn('[Transaction] Standalone MongoDB detected. Running without transaction session.');
    }
    return callback(null);
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    supportsTransactions = true;
    return result;
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    const isStandaloneError =
      msg.includes('replica set member') ||
      msg.includes('standalone') ||
      msg.includes('transaction numbers are only allowed on a replica set member') ||
      msg.includes('does not support transactions');

    if (isStandaloneError) {
      if (supportsTransactions !== false) {
        supportsTransactions = false;
        console.warn('[Transaction] Standalone MongoDB detected. Gracefully executing without transaction session.');
      }
      return callback(null);
    }

    throw err;
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }
}

module.exports = { withTransaction };
