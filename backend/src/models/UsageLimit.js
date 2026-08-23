const mongoose = require('mongoose');

const UsageLimitSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    plan: { type: String, required: true, default: 'team_starter' },
    tierType: { type: String, default: 'organization' },

    storageLimitBytes: { type: Number, default: 10737418240 }, // 10GB default
    maxUsers: { type: Number, default: 3 },
    maxApiRequests: { type: Number, default: 100000 },
    maxLeads: { type: Number, default: 15000 },
    maxGroups: { type: Number, default: 25 },
    maxConcurrentCampaigns: { type: Number, default: 5 },
    maxMonthlyMessages: { type: Number, default: 50000 },
    maxRecipientsPerCampaign: { type: Number, default: 2500 },

    isCustomOverride: { type: Boolean, default: false },
    customOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
    notes: { type: String, default: '' },
    updatedBy: { type: String, default: 'system' },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.UsageLimit ||
  mongoose.model('UsageLimit', UsageLimitSchema);
