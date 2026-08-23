import mongoose, { Schema, Document } from 'mongoose';

export type ResourceThresholdStatus = 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'LIMIT_REACHED';

export interface IResourceStorageUsage {
  usedBytes: number;
  usedFormatted: string; // e.g. "7.2 GB"
  limitBytes: number;
  limitFormatted: string; // e.g. "10.0 GB"
  percent: number; // e.g. 72.0
  fileCount: number;
  healthScore: number; // e.g. 73% (100 - penalty)
  status: ResourceThresholdStatus;
}

export interface IResourceUsersUsage {
  activeUsers: number;
  maxUsers: number;
  percent: number;
  capacityScore: number;
  status: ResourceThresholdStatus;
}

export interface IResourceApiUsage {
  currentMonthRequests: number;
  maxRequests: number;
  percent: number;
  capacityScore: number;
  status: ResourceThresholdStatus;
}

export interface IResourceDatabaseUsage {
  leadsCount: number;
  maxLeads: number;
  leadsPercent: number;
  groupsCount: number;
  maxGroups: number;
  totalRecords: number;
  status: ResourceThresholdStatus;
}

export interface IResourceCampaignUsage {
  activeCampaigns: number;
  maxConcurrent: number;
  totalCampaignsThisMonth: number;
  status: ResourceThresholdStatus;
}

export interface IResourceMessageUsage {
  whatsappSent: number;
  smsSent: number;
  emailSent: number;
  totalMessages: number;
  monthlyLimit: number;
  percent: number;
  status: ResourceThresholdStatus;
}

export interface IResourceGrowthMetrics {
  storageGrowthRate: number; // % change vs previous week
  usersGrowthRate: number;
  recordsGrowthRate: number;
  apiGrowthRate: number;
  velocityScore: number; // 0 - 100 aggregate growth score
}

export interface IOrganizationUsage {
  organizationId: mongoose.Types.ObjectId | string;
  organizationName: string;
  ownerEmail: string;
  ownerName?: string;
  plan: string;
  tierType: 'organization' | 'individual' | 'free' | 'enterprise';
  
  storage: IResourceStorageUsage;
  users: IResourceUsersUsage;
  apiRequests: IResourceApiUsage;
  databaseRecords: IResourceDatabaseUsage;
  campaigns: IResourceCampaignUsage;
  messages: IResourceMessageUsage;
  growthMetrics: IResourceGrowthMetrics;

  overallStatus: ResourceThresholdStatus;
  nearLimitCount: number; // number of resources >= 80%
  overallCapacityPercent: number; // max or weighted capacity

  lastAggregatedAt: Date;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOrganizationUsageDocument extends IOrganizationUsage, Document {}

const OrganizationUsageSchema: Schema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
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
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

OrganizationUsageSchema.index({ overallStatus: 1, overallCapacityPercent: -1 });
OrganizationUsageSchema.index({ 'storage.percent': -1 });
OrganizationUsageSchema.index({ 'users.percent': -1 });
OrganizationUsageSchema.index({ 'apiRequests.percent': -1 });

export default mongoose.models.OrganizationUsage ||
  mongoose.model<IOrganizationUsageDocument>('OrganizationUsage', OrganizationUsageSchema);
