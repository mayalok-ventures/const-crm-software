const mongoose = require('mongoose');

/**
 * WebhookEvent Schema
 *
 * Implements the durable, persistent inbound queue for all third-party webhook events.
 * The HTTP endpoint verifies signatures, writes to this collection first, and immediately
 * returns HTTP 200 OK. The ingestion worker consumes events with exponential backoff,
 * concurrency locking, and dead-letter handling.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['meta', 'google', 'website', 'sheets', 'custom'],
      required: [true, 'Provider is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    integrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Integration',
      default: null,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    externalLeadId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    isTest: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Whitelisted headers only (never store Authorization or bearer tokens)
    headers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rawBody: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'dead_letter'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lockedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    lastError: {
      message: { type: String, default: '' },
      stack: { type: String, default: '' },
      code: { type: String, default: '' },
      timestamp: { type: Date, default: null },
    },
    processedLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique partial index on (provider, integrationId, externalLeadId) where externalLeadId is non-empty
webhookEventSchema.index(
  { provider: 1, integrationId: 1, externalLeadId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalLeadId: { $gt: '' },
      integrationId: { $exists: true, $type: 'objectId' },
    },
  }
);

// Worker polling query index: find pending or retryable jobs
webhookEventSchema.index({ status: 1, nextAttemptAt: 1, attempts: 1 });

// Stale-lock recovery index: find jobs stuck in 'processing' past timeout
webhookEventSchema.index({ status: 1, lockedAt: 1 });

// Multi-tenant audit log index
webhookEventSchema.index({ companyId: 1, createdAt: -1 });
webhookEventSchema.index({ integrationId: 1, createdAt: -1 });

module.exports = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema);
