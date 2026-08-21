const mongoose = require('mongoose');

/**
 * Campaign Schema
 * Ingests and tracks advertising spend, platform attribution, and ROI/ROAS across Meta, Google, and other ad networks.
 */
const campaignSchema = new mongoose.Schema(
  {
    campaignName: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    platform: {
      type: String,
      required: [true, 'Ad platform is required'],
      enum: {
        values: ['META', 'GOOGLE', 'OTHER'],
        message: '{VALUE} is not a supported ad platform',
      },
      uppercase: true,
      index: true,
    },
    campaignId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    budget: {
      type: Number,
      default: 0,
      min: [0, 'Budget cannot be negative'],
    },
    amountSpent: {
      type: Number,
      default: 0,
      min: [0, 'Amount spent cannot be negative'],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
      validate: {
        validator: function (val) {
          return !val || !this.startDate || val >= this.startDate;
        },
        message: 'endDate must be equal to or after startDate',
      },
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
        message: '{VALUE} is not a valid campaign status',
      },
      default: 'DRAFT',
      uppercase: true,
      index: true,
    },
    leadsGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenueGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },
    utmSource: {
      type: String,
      default: '',
      trim: true,
    },
    utmMedium: {
      type: String,
      default: '',
      trim: true,
    },
    utmCampaign: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index for ROI Reporting
campaignSchema.index({ platform: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
