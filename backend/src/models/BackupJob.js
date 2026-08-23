const mongoose = require('mongoose');

const BackupJobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BackupPolicy' },
    name: { type: String, required: true, trim: true },
    jobType: {
      type: String,
      enum: ['FULL_SNAPSHOT', 'INCREMENTAL', 'OPLOG', 'COLLECTION_EXPORT'],
      default: 'FULL_SNAPSHOT',
    },
    lastRunAt: { type: Date },
    lastStatus: {
      type: String,
      enum: ['RUNNING', 'SUCCESS', 'FAILED', 'VERIFICATION_FAILED', 'EXPIRED'],
      default: 'SUCCESS',
    },
    nextScheduledAt: { type: Date },
    consecutiveFailures: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.BackupJob ||
  mongoose.model('BackupJob', BackupJobSchema);
