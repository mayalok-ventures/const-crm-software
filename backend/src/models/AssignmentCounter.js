const mongoose = require('mongoose');

/**
 * AssignmentCounter Schema
 *
 * Dedicated collection for strictly atomic concurrency-safe assignment pointers.
 * Keyed by integrationId and scopeKey ('default' or campaign/form override key).
 * Updated via atomic findOneAndUpdate({ integrationId, scopeKey }, { $inc: { counter: 1 } }, { upsert: true, new: true }).
 */
const assignmentCounterSchema = new mongoose.Schema(
  {
    integrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Integration',
      required: true,
      index: true,
    },
    scopeKey: {
      type: String,
      default: 'default',
      trim: true,
      index: true,
    },
    counter: {
      type: Number,
      default: 0,
    },
    lastAssignedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastAssignedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring exactly one atomic counter document per scope per integration
assignmentCounterSchema.index({ integrationId: 1, scopeKey: 1 }, { unique: true });

module.exports =
  mongoose.models.AssignmentCounter ||
  mongoose.model('AssignmentCounter', assignmentCounterSchema);
