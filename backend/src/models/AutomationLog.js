const mongoose = require('mongoose');

/**
 * AutomationLog Schema
 * Audits every automated trigger and execution for transparency, debugging, and analytics:
 * - Lead creation triggers (WhatsApp/Email)
 * - Pipeline stage transitions
 * - Inbound WhatsApp chatbot interactions and keyword menu choices
 */
const automationLogSchema = new mongoose.Schema(
  {
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AutomationRule',
      required: true,
      index: true,
    },
    ruleName: {
      type: String,
      default: '',
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
      default: null,
    },
    leadName: {
      type: String,
      default: '',
    },
    leadPhone: {
      type: String,
      default: '',
    },
    recipientPhone: {
      type: String,
      default: '',
    },
    leadEmail: {
      type: String,
      default: '',
    },
    recipientEmail: {
      type: String,
      default: '',
    },
    triggerType: {
      type: String,
      required: true,
      index: true,
    },
    triggerDetails: {
      type: String,
      default: '',
    },
    channel: {
      type: String,
      default: 'whatsapp',
    },
    actionType: {
      type: String,
      default: 'send_whatsapp',
    },
    actionPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped', 'pending'],
      required: true,
      index: true,
    },
    messageSent: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    scheduledFor: {
      type: Date,
      default: null,
      index: true,
    },
    executionDurationMs: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    executedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

automationLogSchema.index({ workspaceId: 1, timestamp: -1 });
automationLogSchema.index({ ruleId: 1, timestamp: -1 });

module.exports = mongoose.model('AutomationLog', automationLogSchema);
