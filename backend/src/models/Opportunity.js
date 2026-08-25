const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant companyId is required'],
    index: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: [true, 'Lead ID is required'],
    index: true,
  },
  requirementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement',
    default: null,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Associated Project ID is required'],
    index: true,
  },
  inventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    default: null,
  },
  title: {
    type: String,
    required: [true, 'Deal title is required'],
    trim: true,
  },
  pipelineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pipeline',
    default: null,
  },
  stage: {
    type: String,
    default: 'Site Visit Scheduled',
    trim: true,
    index: true,
  },
  expectedValue: {
    type: Number,
    default: 0,
    min: [0, 'Expected value cannot be negative'],
  },
  probability: {
    type: Number,
    min: [0, 'Probability cannot be less than 0%'],
    max: [100, 'Probability cannot exceed 100%'],
    default: 50,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  expectedClosingDate: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['OPEN', 'WON', 'LOST', 'ABANDONED'],
    default: 'OPEN',
    index: true,
  },
  lostReason: {
    type: String,
    default: null,
  },
  lostRemarks: {
    type: String,
    default: '',
    trim: true,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
  stageHistory: [{
    fromStage: { type: String },
    toStage: { type: String, required: true },
    movedAt: { type: Date, default: Date.now },
    movedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remark: { type: String, default: '' },
  }],
}, { timestamps: true });

// Weighted Value Virtual
opportunitySchema.virtual('weightedValue').get(function () {
  return ((this.expectedValue || 0) * (this.probability || 0)) / 100;
});

// Compound Indexes for fast tenant pipelines
opportunitySchema.index({ companyId: 1, leadId: 1, status: 1 });
opportunitySchema.index({ companyId: 1, projectId: 1, stage: 1 });
opportunitySchema.index({ companyId: 1, assignedTo: 1, status: 1 });
opportunitySchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Opportunity || mongoose.model('Opportunity', opportunitySchema);
