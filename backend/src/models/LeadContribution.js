const mongoose = require('mongoose');

const leadContributionSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  ownershipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeadOwnership',
    default: null,
  },
  contributionType: {
    type: String,
    default: 'MANUAL',
    trim: true,
  },
  activityCount: {
    type: Number,
    default: 0,
  },
  contributionScore: {
    type: Number,
    default: 0,
  },
  percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  startAt: {
    type: Date,
    default: Date.now,
  },
  endAt: {
    type: Date,
    default: null,
  },
  calculatedBy: {
    type: String,
    default: 'system',
    trim: true,
  },
  calculationVersion: {
    type: Number,
    default: 1,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

// Production-grade indexes
leadContributionSchema.index({ tenantId: 1, leadId: 1, userId: 1 });
leadContributionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.models.LeadContribution || mongoose.model('LeadContribution', leadContributionSchema);
