const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'WARNING', 'INFO'],
      default: 'WARNING',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'],
      default: 'OPEN',
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    triggeredAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    acknowledgedBy: { type: String, default: '' },
    resolvedBy: { type: String, default: '' },
    resolutionNotes: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    trigger: {
      metric: { type: String, default: '' },
      operator: { type: String, default: '' },
      threshold: { type: mongoose.Schema.Types.Mixed, default: null },
      value: { type: mongoose.Schema.Types.Mixed, default: null },
      ruleId: { type: String, default: '' },
      alertId: { type: String, default: '' },
    },
    affectedResources: {
      serverId: { type: String, default: '' },
      endpoint: { type: String, default: '' },
      database: { type: String, default: '' },
      service: { type: String, default: 'crm-backend' },
      component: { type: String, default: '' },
    },
    // Backward compatibility
    serverId: { type: String, index: true },
    type: { type: String, default: 'SYSTEM_ANOMALY', index: true },
    events: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, required: true },
        reason: { type: String, required: true },
      },
    ],
    relatedAlerts: [
      {
        alertId: { type: String },
        title: { type: String },
        metricName: { type: String },
        metricValue: { type: mongoose.Schema.Types.Mixed },
        severity: { type: String },
        triggeredAt: { type: Date },
      },
    ],
    relatedErrors: [
      {
        errorGroupId: { type: String },
        name: { type: String },
        message: { type: String },
        count: { type: Number, default: 1 },
        lastSeen: { type: Date },
      },
    ],
    relatedLogs: [
      {
        logId: { type: String },
        level: { type: String },
        message: { type: String },
        timestamp: { type: Date },
        module: { type: String },
      },
    ],
    timeline: [
      {
        timestamp: { type: Date, required: true, default: Date.now },
        event: { type: String, required: true },
        description: { type: String, required: true },
        actor: { type: String, default: 'SYSTEM' },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    escalationLevel: { type: Number, default: 1 },
    lastNotifiedAt: { type: Date, default: null },
    fingerprint: { type: String, index: true },
  },
  { timestamps: true }
);

IncidentSchema.index({ status: 1, severity: 1, startedAt: -1 });

module.exports = mongoose.models.Incident || mongoose.model('Incident', IncidentSchema);
