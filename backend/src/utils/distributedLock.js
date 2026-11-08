const mongoose = require('mongoose');

// Schema for Distributed Locks backed by MongoDB
const distributedLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // Lock key
    ownerId: { type: String, required: true },
    acquiredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
  },
  { _id: false, timestamps: false }
);

let LockModel;
function getLockModel() {
  if (!LockModel) {
    LockModel = mongoose.models.DistributedLock || mongoose.model('DistributedLock', distributedLockSchema, 'distributed_locks');
  }
  return LockModel;
}

/**
 * Attempt to acquire a distributed lock.
 * @param {string} lockKey - Unique identifier for the lock
 * @param {number} ttlMs - Duration for which the lock is valid (milliseconds)
 * @param {string} [ownerId] - Optional worker/process identifier
 * @returns {Promise<{ acquired: boolean, lockKey: string, ownerId: string, release: Function }>}
 */
async function acquireDistributedLock(lockKey, ttlMs = 30000, ownerId = null) {
  if (mongoose.connection.readyState !== 1) {
    return { acquired: false, reason: 'DB_NOT_CONNECTED' };
  }

  const Model = getLockModel();
  const owner = ownerId || `${process.pid}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    // Atomic acquisition:
    // Update existing lock if expired or owned by the same owner
    const result = await Model.findOneAndUpdate(
      {
        _id: lockKey,
        $or: [
          { expiresAt: { $lte: now } },
          { ownerId: owner },
        ],
      },
      {
        $set: {
          ownerId: owner,
          acquiredAt: now,
          expiresAt,
        },
      },
      { upsert: false, new: true }
    );

    if (result) {
      return {
        acquired: true,
        lockKey,
        ownerId: owner,
        release: () => releaseDistributedLock(lockKey, owner),
      };
    }

    // If update didn't match existing doc, attempt insert (if doc never existed)
    try {
      await Model.create({
        _id: lockKey,
        ownerId: owner,
        acquiredAt: now,
        expiresAt,
      });
      return {
        acquired: true,
        lockKey,
        ownerId: owner,
        release: () => releaseDistributedLock(lockKey, owner),
      };
    } catch (insertErr) {
      if (insertErr.code === 11000) {
        // Concurrently inserted by another node
        return { acquired: false, reason: 'LOCKED' };
      }
      throw insertErr;
    }
  } catch (err) {
    console.warn(`[DistributedLock] Error acquiring lock for ${lockKey}:`, err.message);
    return { acquired: false, error: err.message };
  }
}

/**
 * Release a previously acquired distributed lock.
 */
async function releaseDistributedLock(lockKey, ownerId) {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    const Model = getLockModel();
    const res = await Model.deleteOne({ _id: lockKey, ownerId });
    return res.deletedCount > 0;
  } catch (err) {
    console.warn(`[DistributedLock] Error releasing lock for ${lockKey}:`, err.message);
    return false;
  }
}

/**
 * Execute an async function guarded by a distributed lock.
 * If lock is held by another instance, execution is safely skipped.
 */
async function withDistributedLock(lockKey, ttlMs, fn) {
  const lock = await acquireDistributedLock(lockKey, ttlMs);
  if (!lock.acquired) {
    return { executed: false, skipped: true, reason: lock.reason || 'LOCKED' };
  }
  try {
    const result = await fn();
    return { executed: true, result };
  } finally {
    await lock.release();
  }
}

module.exports = {
  acquireDistributedLock,
  releaseDistributedLock,
  withDistributedLock,
  getLockModel,
};
