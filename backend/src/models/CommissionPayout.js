const mongoose = require('mongoose');

/**
 * CommissionPayout Schema (IMMUTABLE FINANCIAL LEDGER)
 * An append-only historical audit ledger of all closed deals and earnings.
 * Core financial values (saleValue, commissionEarned, appliedRuleId) are immutable
 * once saved to protect ledger integrity against subsequent rule modifications.
 */
const commissionPayoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Beneficiary user ID is required'],
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: [true, 'Lead ID is required'],
      index: true,
    },
    saleValue: {
      type: Number,
      required: [true, 'Sale value is required'],
      min: [0, 'Sale value cannot be negative'],
    },
    commissionEarned: {
      type: Number,
      required: [true, 'Commission earned is required'],
      min: [0, 'Commission earned cannot be negative'],
    },
    appliedRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommissionRule',
      required: [true, 'Applied CommissionRule ID reference is required'],
      index: true,
    },
    ruleNameSnapshot: {
      type: String,
      default: '',
      trim: true,
    },
    calculationSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['PENDING', 'APPROVED', 'PAID'],
        message: '{VALUE} is not a valid payout status',
      },
      default: 'PENDING',
      uppercase: true,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    transactionReference: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index for Agent Payout History & Tax Ledger
commissionPayoutSchema.index({ userId: 1, createdAt: -1 });
commissionPayoutSchema.index({ status: 1, createdAt: -1 });
commissionPayoutSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Immutability Guard: Prevent editing core financial terms after creation
commissionPayoutSchema.pre('save', function (next) {
  if (!this.isNew) {
    if (this.isModified('saleValue') || this.isModified('commissionEarned') || this.isModified('appliedRuleId') || this.isModified('leadId') || this.isModified('userId')) {
      return next(new Error('IMMUTABILITY VIOLATION: Historical CommissionPayout financial values cannot be modified once generated.'));
    }
  }
  next();
});

// Immutability Guard for findOneAndUpdate / updateOne
commissionPayoutSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
  const update = this.getUpdate();
  const modifiedFields = update.$set ? Object.keys(update.$set) : Object.keys(update);
  const prohibited = ['saleValue', 'commissionEarned', 'appliedRuleId', 'leadId', 'userId'];
  const hasProhibited = prohibited.some(p => modifiedFields.includes(p) || (update.$set && update.$set[p] !== undefined));
  if (hasProhibited) {
    return next(new Error('IMMUTABILITY VIOLATION: Modifying financial calculation terms on historical payouts is strictly prohibited.'));
  }
  next();
});

module.exports = mongoose.models.CommissionPayout || mongoose.model('CommissionPayout', commissionPayoutSchema);
