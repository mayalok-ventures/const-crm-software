const mongoose = require('mongoose');

const incentivePolicySchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  priority: {
    type: Number,
    default: 0,
    index: true,
  },
  conditions: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  calculationType: {
    type: String,
    enum: ['FINAL_OWNER', 'FIRST_HANDLER', 'CLOSER', 'SPLIT', 'CUSTOM'],
    default: 'FINAL_OWNER',
    index: true,
  },
  firstHandlerPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  closerPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  finalOwnerPercentage: {
    type: Number,
    default: 100,
    min: 0,
    max: 100,
  },
  customRules: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  effectiveFrom: {
    type: Date,
    default: Date.now,
  },
  effectiveTo: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  version: {
    type: Number,
    default: 1,
  },
}, { timestamps: true });

// Production-grade indexes
incentivePolicySchema.index({ tenantId: 1, isActive: 1 });
incentivePolicySchema.index({ tenantId: 1, priority: -1 });

module.exports = mongoose.models.IncentivePolicy || mongoose.model('IncentivePolicy', incentivePolicySchema);
