const mongoose = require('mongoose');

/**
 * LeadDistributionRule Schema
 * Governs automated lead assignment across active Agents and Managers
 * Strategies: 'manual', 'round_robin', 'weighted', 'manager_routed', 'rule_based'
 */
const leadDistributionRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    strategy: {
      type: String,
      required: true,
      enum: ['manual', 'round_robin', 'weighted', 'manager_routed', 'rule_based'],
      default: 'round_robin',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 1, // Higher priority rules evaluate first in rule_based mode
    },
    // Triggers / Conditions for Rule-Based Distribution
    conditions: {
      sources: [{
        type: String,
        enum: [
          'manual', 'signup', 'meta', 'google', 'facebook', 'instagram',
          'google_ads', 'meta_ads', 'website', 'organic', 'referral',
          'partner', 'import', 'webhook', 'api'
        ],
      }],
      campaignNames: [{ type: String, trim: true }],
      utmSources: [{ type: String, trim: true }],
      locations: [{ type: String, trim: true }],
      servicesOrProducts: [{ type: String, trim: true }],
      minBudget: { type: Number, default: null },
      maxBudget: { type: Number, default: null },
    },
    // Target Agents / Managers
    assignees: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['manager', 'agent'],
          default: 'agent',
        },
        weight: {
          type: Number,
          default: 1, // Used in weighted distribution (e.g. 50% vs 30% vs 20%)
          min: 1,
        },
        maxActiveLeadsCap: {
          type: Number,
          default: 50, // Capacity limit
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
    // State tracking for Round-Robin pointer
    lastAssignedIndex: {
      type: Number,
      default: -1,
    },
    // Fallback Assignee if all targets reach lead capacity
    fallbackUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

leadDistributionRuleSchema.index({ isActive: 1, priority: -1 });

module.exports = mongoose.model('LeadDistributionRule', leadDistributionRuleSchema);
