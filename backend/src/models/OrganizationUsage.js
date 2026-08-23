const mongoose = require('mongoose');

const OrganizationUsageSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    organizationName: { type: String, required: true, index: true },
    ownerEmail: { type: String, required: true },
    ownerName: { type: String, default: '' },
    plan: { type: String, default: 'free', index: true },
    tierType: {
      type: String,
      enum: ['organization', 'individual', 'free', 'enterprise'],
      default: 'organization',
      index: true,
    },

    storage: {
      usedBytes: { type: Number, default: 0 },
      usedFormatted: { type: String, default: '0 MB' },
      limitBytes: { type: Number, default: 10737418240 }, // 10 GB default
      limitFormatted: { type: String, default: '10.0 GB' },
      percent: { type: Number, default: 0 },
      fileCount: { type: Number, default: 0 },
      healthScore: { type: Number, default: 100 },
      status: {
        type: String,
        enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'LIMIT_REACHED'],
        default: 'NOMINAL',
      },
    },

    users: {
      activeUsers: { type: Number, default: 1 },
      maxUsers: { type: Number, default: 3 },
      percent: { type: Number, default: 33.3 },
      capacityScore: { type: Number, default: 33.3 },
      status: {
        type: String,
        enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'LIMIT_REACHED'],
        default: 'NOMINAL',
      },
    },

    apiRequests: {
      currentMonthRequests: { type: Number, default: 0 },
      maxRequests: { type: Number, default: 100000 },
      percent: { type: Number, default: 0 },
      capacityScore: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'LIMIT_REACHED'],
        default: 'NOMINAL',
      },
    },

    databaseRecords: {
      leadsCount: { type: Number, default: 0 },
      maxLeads: { type: Number, default: 15000 },
      leadsPercent: { type: Number, default: 0 },
      groupsCount: { type: Number, default: 0 },
      maxGroups: { type: Number, default: 25 },
      totalRecords: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'LIMIT_REACHED'],
        default: 'NOMINAL',
      },
    },

    campaigns: {
      activeCampaigns: { type: Number, default: 0 },
      maxConcurrent: { type: Number, default: 5 },
      totalCampaignsThisMonth: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'LIMIT_REACHED'],
        default: 'NOMINAL',
      },
    },

    messages: {
      whatsappSent: { type: Number, default: 0 },
      smsSent: { type: Number, default: 0 },
      emailSent: { type: Number, default: 0 },
      totalMessages: { type: Number, default: 0 },
      monthlyLimit: { type: Number, default: 50000 },
      percent: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'LIMIT_REACHED'],
        default: 'NOMINAL',
      },
    },

    growthMetrics: {
      storageGrowthRate: { type: Number, default: 0 },
      usersGrowthRate: { type: Number, default: 0 },
      recordsGrowthRate: { type: Number, default: 0 },
      apiGrowthRate: { type: Number, default: 0 },
      velocityScore: { type: Number, default: 0 },
    },

    overallStatus: {
      type: String,
      enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'LIMIT_REACHED'],
      default: 'NOMINAL',
      index: true,
    },
    nearLimitCount: { type: Number, default: 0, index: true },
    overallCapacityPercent: { type: Number, default: 0, index: true },

    lastAggregatedAt: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

OrganizationUsageSchema.index({ overallStatus: 1, overallCapacityPercent: -1 });
OrganizationUsageSchema.index({ 'storage.percent': -1 });
OrganizationUsageSchema.index({ 'users.percent': -1 });
OrganizationUsageSchema.index({ 'apiRequests.percent': -1 });

module.exports = mongoose.models.OrganizationUsage ||
  mongoose.model('OrganizationUsage', OrganizationUsageSchema);
