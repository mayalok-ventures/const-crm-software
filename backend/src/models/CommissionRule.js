const mongoose = require('mongoose');

/**
 * CommissionRule Schema
 * Governs calculation policies for Agents and Managers.
 */
const commissionRuleSchema = new mongoose.Schema(
  {
    ruleName: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
    },
    targetRole: {
      type: String,
      required: [true, 'Target role is required'],
      enum: {
        values: ['MANAGER', 'AGENT'],
        message: '{VALUE} is not a valid target role. Must be MANAGER or AGENT',
      },
      uppercase: true,
      default: 'AGENT',
      index: true,
    },
    commissionType: {
      type: String,
      required: [true, 'Commission type is required'],
      enum: {
        values: ['PERCENTAGE', 'FLAT', 'STAGE_BASED'],
        message: '{VALUE} is not a valid commission type. Must be PERCENTAGE, FLAT, or STAGE_BASED',
      },
      uppercase: true,
      default: 'PERCENTAGE',
    },
    value: {
      type: Number,
      required: [true, 'Commission value rate/amount is required'],
      min: [0, 'Commission value cannot be negative'],
      validate: {
        validator: function (val) {
          if (this.commissionType === 'PERCENTAGE') {
            return val >= 0 && val <= 100;
          }
          return val >= 0;
        },
        message: 'Percentage rate must be between 0 and 100',
      },
    },
    stageThreshold: {
      type: String,
      default: 'payment_done',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin creator user ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

commissionRuleSchema.index({ isActive: 1, targetRole: 1 });

module.exports = mongoose.models.CommissionRule || mongoose.model('CommissionRule', commissionRuleSchema);
