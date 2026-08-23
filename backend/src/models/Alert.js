const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    ruleId: { type: String, required: true, index: true },
    incidentId: { type: String, index: true },
    title: { type: String, required: true },
    metricName: { type: String, required: true, index: true },
    metricValue: { type: mongoose.Schema.Types.Mixed, required: true },
    threshold: { type: mongoose.Schema.Types.Mixed, required: true },
    operator: { type: String, required: true },
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'WARNING', 'INFO'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED', 'SILENCED'],
      default: 'TRIGGERED',
      index: true,
    },
    fingerprint: { type: String, required: true, index: true },
    targetResource: {
      type: { type: String, default: 'SERVER' },
      identifier: { type: String, default: 'default' },
      name: { type: String, default: '' },
    },
    triggeredAt: { type: Date, required: true, default: Date.now, index: true },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: '' },
    silencedUntil: { type: Date, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
