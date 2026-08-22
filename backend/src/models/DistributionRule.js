const mongoose = require('mongoose');

const assignedAgentSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Agent ID is required'],
  },
  weightPercentage: {
    type: Number,
    min: [0, 'Weight percentage cannot be negative'],
    max: [100, 'Weight percentage cannot exceed 100'],
    default: 0,
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { _id: true });

const distributionRuleSchema = new mongoose.Schema({
  ruleName: {
    type: String,
    required: [true, 'Rule name is required'],
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  conditions: {
    sourceType: {
      type: String,
      enum: ['ALL', 'Manual', 'Signup', 'Meta', 'Google', 'Form', 'SOURCE_A_MANUAL', 'SOURCE_B_SIGNUP', 'SOURCE_C_ADS'],
      default: 'ALL',
    },
    campaignId: {
      type: String,
      default: null,
      trim: true,
    },
    location: {
      type: String,
      default: null,
      trim: true,
    },
  },
  strategy: {
    routingMethod: {
      type: String,
      enum: ['ROUND_ROBIN', 'WEIGHTED', 'MANAGER_ROUTED'],
      default: 'ROUND_ROBIN',
      required: true,
    },
  },
  targets: {
    assignedAgents: {
      type: [assignedAgentSchema],
      default: [],
    },
  },
  stats: {
    leadsRoutedCount: { type: Number, default: 0 },
    lastRoutedAt: { type: Date, default: null },
    lastAssignedAgentIndex: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
  strict: true,
});

distributionRuleSchema.index({ isActive: 1, priority: 1 });
distributionRuleSchema.index({ 'conditions.sourceType': 1 });
distributionRuleSchema.index({ createdBy: 1 });

module.exports = mongoose.models.DistributionRule || mongoose.model('DistributionRule', distributionRuleSchema);
