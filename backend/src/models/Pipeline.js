const mongoose = require('mongoose');

const pipelineStageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Stage name is required'],
    trim: true,
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

const pipelineSchema = new mongoose.Schema({
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
    default: [
      { name: 'New Lead', order: 0, probability: 10, colorCode: '#3b82f6', slaHours: 2 },
      { name: 'Contacted', order: 1, probability: 30, colorCode: '#eab308', slaHours: 12 },
      { name: 'Follow-Up Scheduled', order: 2, probability: 50, colorCode: '#f97316', slaHours: 24 },
      { name: 'Negotiation', order: 3, probability: 80, colorCode: '#8b5cf6', slaHours: 48 },
      { name: 'Deal Won / Converted', order: 4, probability: 100, colorCode: '#10b981', slaHours: 72 },
      { name: 'Deal Lost', order: 5, probability: 0, colorCode: '#ef4444', slaHours: 72 },
    ],
  },
}, {
  timestamps: true,
  strict: true,
});

pipelineSchema.index({ name: 1, isActive: 1 });
pipelineSchema.index({ createdBy: 1 });

module.exports = mongoose.models.Pipeline || mongoose.model('Pipeline', pipelineSchema);
