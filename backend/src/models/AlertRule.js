const mongoose = require('mongoose');

const AlertRuleSchema = new mongoose.Schema(
  {
    ruleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    metric: {
      type: String,
      required: true,
      index: true,
    },
    operator: {
      type: String,
      required: true,
      enum: ['>', '<', '>=', '<=', '==', 'rate_increase', 'percentage_increase', 'absence_data'],
    },
    threshold: { type: mongoose.Schema.Types.Mixed, required: true },
    durationSeconds: { type: Number, default: 0 },
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'WARNING', 'INFO'],
      default: 'WARNING',
      index: true,
    },
    cooldownMinutes: { type: Number, default: 15 },
    channels: [{ type: String }],
    targetResource: {
      type: { type: String, default: 'ALL' },
      identifier: { type: String, default: '*' },
    },
    isActive: { type: Boolean, default: true, index: true },
    silenceUntil: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AlertRule || mongoose.model('AlertRule', AlertRuleSchema);
