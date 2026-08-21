const mongoose = require('mongoose');

const leadOwnershipSchema = new mongoose.Schema({
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
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  ownershipType: {
    type: String,
    enum: ['CLAIM', 'ASSIGN', 'TRANSFER', 'FORCE_TRANSFER', 'REASSIGN'],
    required: true,
    index: true,
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  endedAt: {
    type: Date,
    default: null,
  },
  isCurrent: {
    type: Boolean,
    default: true,
    index: true,
  },
  source: {
    type: String,
    default: '',
    trim: true,
  },
  releaseReason: {
    type: String,
    default: '',
    trim: true,
  },
  transferRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeadTransferRequest',
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

// Production-grade indexes
leadOwnershipSchema.index({ tenantId: 1, ownerUserId: 1, isCurrent: 1 });
leadOwnershipSchema.index({ tenantId: 1, startedAt: 1 });

// Critical partial unique index to prevent two users from owning the same lead concurrently
leadOwnershipSchema.index(
  { tenantId: 1, leadId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);

module.exports = mongoose.models.LeadOwnership || mongoose.model('LeadOwnership', leadOwnershipSchema);
