const mongoose = require('mongoose');

const BackupPolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: '' },
    scheduleCron: { type: String, required: true, default: '0 2 * * *' },
    maxAgeHours: { type: Number, required: true, default: 26 },
    retentionDays: { type: Number, required: true, default: 30 },
    storageTarget: {
      type: String,
      enum: ['S3', 'GCS', 'AZURE', 'OFFSITE_REMOTE', 'LOCAL_STAGING'],
      default: 'S3',
    },
    isExternalRequired: { type: Boolean, default: true },
    mandatoryVerification: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.BackupPolicy ||
  mongoose.model('BackupPolicy', BackupPolicySchema);
