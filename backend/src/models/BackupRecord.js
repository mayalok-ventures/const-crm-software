const mongoose = require('mongoose');

const BackupRecordSchema = new mongoose.Schema(
  {
    backupId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, required: true, index: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BackupPolicy' },
    status: {
      type: String,
      enum: ['RUNNING', 'SUCCESS', 'FAILED', 'VERIFICATION_FAILED', 'EXPIRED'],
      default: 'RUNNING',
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    durationMs: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    formattedSize: { type: String, default: '0 MB' },
    location: {
      target: { type: String, default: 'S3' },
      path: { type: String, required: true },
      bucket: { type: String, default: '' },
      region: { type: String, default: 'us-east-1' },
      isExternal: { type: Boolean, default: true },
    },
    checksum: {
      algorithm: { type: String, default: 'SHA256' },
      value: { type: String, default: '' },
      verified: { type: Boolean, default: false },
    },
    verification: {
      status: {
        type: String,
        enum: ['PENDING', 'PASSED', 'FAILED', 'SKIPPED'],
        default: 'PENDING',
        index: true,
      },
      fileHeaderValid: { type: Boolean, default: false },
      archiveIntegrityValid: { type: Boolean, default: false },
      decompressionTestValid: { type: Boolean, default: false },
      simulatedRestoreValid: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      failureReason: { type: String, default: '' },
      verifiedBy: { type: String, default: 'SYSTEM_VERIFIER' },
    },
    retentionExpiresAt: { type: Date, required: true, index: true },
    isRetained: { type: Boolean, default: true },
    metadata: {
      databaseName: { type: String, default: 'mobile-crm' },
      collectionsCount: { type: Number, default: 0 },
      documentsCount: { type: Number, default: 0 },
      storageEngine: { type: String, default: 'WiredTiger' },
      backupEngineVersion: { type: String, default: '1.0.0' },
    },
    failureDetails: {
      code: { type: String },
      message: { type: String },
    },
  },
  { timestamps: true }
);

BackupRecordSchema.index({ completedAt: -1, status: 1 });
BackupRecordSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.BackupRecord ||
  mongoose.model('BackupRecord', BackupRecordSchema);
