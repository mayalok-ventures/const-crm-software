const mongoose = require('mongoose');

const BackupIncidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: [
        'BACKUP_MISSED',
        'BACKUP_FAILED',
        'BACKUP_TOO_OLD',
        'VERIFICATION_FAILED',
        'STORAGE_UNAVAILABLE',
        'CORRUPTED_CHECKSUM',
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'HIGH',
    },
    status: {
      type: String,
      enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'],
      default: 'OPEN',
      index: true,
    },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BackupPolicy' },
    backupId: { type: String },
    title: { type: String, required: true },
    message: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    detectedAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    resolutionNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

BackupIncidentSchema.index({ status: 1, detectedAt: -1 });

module.exports =
  mongoose.models.BackupIncident ||
  mongoose.model('BackupIncident', BackupIncidentSchema);
