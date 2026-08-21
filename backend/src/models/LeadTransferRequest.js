const mongoose = require('mongoose');

const leadTransferRequestSchema = new mongoose.Schema({
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
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  currentOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  requestedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  requestType: {
    type: String,
    enum: ['NORMAL', 'MANAGER_REQUEST', 'FORCE_TRANSFER', 'OWNER_TRANSFER'],
    default: 'NORMAL',
    index: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'EXECUTED'],
    default: 'PENDING',
    index: true,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  respondedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  incentivePolicySnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

// Production-grade indexes
leadTransferRequestSchema.index({ tenantId: 1, leadId: 1, status: 1 });
leadTransferRequestSchema.index({ tenantId: 1, requestedTo: 1, status: 1 });
leadTransferRequestSchema.index({ tenantId: 1, requestedBy: 1, createdAt: -1 });

module.exports = mongoose.models.LeadTransferRequest || mongoose.model('LeadTransferRequest', leadTransferRequestSchema);
