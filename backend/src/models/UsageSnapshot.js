const mongoose = require('mongoose');

const UsageSnapshotSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    timestamp: { type: Date, required: true, index: true },
    granularity: {
      type: String,
      enum: ['hourly', 'daily'],
      default: 'daily',
      index: true,
    },

    storageUsedBytes: { type: Number, default: 0 },
    storageLimitBytes: { type: Number, default: 10737418240 },
    storagePercent: { type: Number, default: 0 },
    fileCount: { type: Number, default: 0 },

    activeUsers: { type: Number, default: 1 },
    maxUsers: { type: Number, default: 3 },
    usersPercent: { type: Number, default: 33.3 },

    apiRequests: { type: Number, default: 0 },
    maxApiRequests: { type: Number, default: 100000 },
    apiPercent: { type: Number, default: 0 },

    leadsCount: { type: Number, default: 0 },
    maxLeads: { type: Number, default: 15000 },
    leadsPercent: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },

    campaignsActive: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

UsageSnapshotSchema.index({ organizationId: 1, timestamp: -1 });

module.exports = mongoose.models.UsageSnapshot ||
  mongoose.model('UsageSnapshot', UsageSnapshotSchema);
