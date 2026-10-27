const mongoose = require('mongoose');

const pipelineStageSchema = new mongoose.Schema({
  stageId: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Stage name is required'],
    trim: true,
  },
  category: {
    type: String,
    enum: ['open', 'won', 'lost'],
    default: 'open',
  },
  order: {
    type: Number,
    required: true,
    default: 0,
  },
  probability: {
    type: Number,
    min: [0, 'Probability cannot be less than 0%'],
    max: [100, 'Probability cannot exceed 100%'],
    default: 50,
  },
  colorCode: {
    type: String,
    default: '#6366f1',
    trim: true,
  },
  slaHours: {
    type: Number,
    min: [0, 'SLA hours cannot be negative'],
    default: 24,
  },
}, { _id: true });

const DEFAULT_ADMISSION_STAGES = [
  { stageId: 'new_lead', name: 'Lead Received', category: 'open', order: 0, probability: 15, colorCode: '#6366f1', slaHours: 4 },
  { stageId: 'contacted', name: 'Tele-Counselling', category: 'open', order: 1, probability: 30, colorCode: '#0ea5e9', slaHours: 12 },
  { stageId: 'shortlisted', name: 'Colleges Shortlisted', category: 'open', order: 2, probability: 50, colorCode: '#8b5cf6', slaHours: 24 },
  { stageId: 'site_visit_scheduled', name: 'Campus Visit Arranged', category: 'open', order: 3, probability: 70, colorCode: '#f59e0b', slaHours: 48 },
  { stageId: 'negotiation', name: 'Quota & Seat Booking', category: 'open', order: 4, probability: 85, colorCode: '#ec4899', slaHours: 48 },
  { stageId: 'converted', name: 'Admission Confirmed', category: 'won', order: 5, probability: 100, colorCode: '#10b981', slaHours: 72 },
  { stageId: 'lost', name: 'Not Interested', category: 'lost', order: 6, probability: 0, colorCode: '#ef4444', slaHours: 72 },
];

const pipelineSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Pipeline name is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  stages: {
    type: [pipelineStageSchema],
    default: DEFAULT_ADMISSION_STAGES,
  },
}, {
  timestamps: true,
  strict: true,
});

pipelineSchema.index({ workspaceId: 1, isActive: 1 });
pipelineSchema.index({ companyId: 1, isActive: 1 });
pipelineSchema.index({ name: 1, isActive: 1 });
pipelineSchema.index({ createdBy: 1 });

/**
 * Ensures workspace has a default pipeline
 */
pipelineSchema.statics.seedDefaultPipelines = async function(workspaceId, createdBy) {
  if (!workspaceId) return null;

  let defaultPipeline = await this.findOne({ workspaceId, isDefault: true, isActive: true });
  if (!defaultPipeline) {
    defaultPipeline = await this.findOne({ workspaceId, isActive: true });
  }

  if (!defaultPipeline) {
    defaultPipeline = await this.create({
      workspaceId,
      createdBy,
      name: 'College Admissions',
      description: 'Standard admissions counseling lifecycle from initial inquiry to admission confirmation',
      isDefault: true,
      isActive: true,
      stages: DEFAULT_ADMISSION_STAGES,
    });
  }

  return defaultPipeline;
};

module.exports = mongoose.models.Pipeline || mongoose.model('Pipeline', pipelineSchema);
module.exports.DEFAULT_ADMISSION_STAGES = DEFAULT_ADMISSION_STAGES;
