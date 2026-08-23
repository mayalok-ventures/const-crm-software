const mongoose = require('mongoose');

const DeploymentPolicySchema = new mongoose.Schema(
  {
    environment: {
      type: String,
      enum: ['production', 'staging', 'development'],
      default: 'production',
      unique: true,
      index: true,
    },
    autoRollbackEnabled: { type: Boolean, default: false }, // Explicit default false per user safety requirement
    requireHealthCheckPass: { type: Boolean, default: true },
    requireSmokeTestsPass: { type: Boolean, default: true },
    minHealthScore: { type: Number, default: 90 },
    maxErrorRateThreshold: { type: Number, default: 5.0 },
    maxLatencyP95Ms: { type: Number, default: 500 },
    evaluationWindowMinutes: { type: Number, default: 15 },
    allowAutoRollbackOnlyIfHealthBelow: { type: Number, default: 50 },
    requireAdminApproval: { type: Boolean, default: true },
    notificationChannels: [{ type: String }],
    updatedBy: { type: String, default: 'DevOps Admin' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.DeploymentPolicy ||
  mongoose.model('DeploymentPolicy', DeploymentPolicySchema);
