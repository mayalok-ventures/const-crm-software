import mongoose, { Schema, Document } from 'mongoose';

export interface IUsageLimit {
  organizationId: mongoose.Types.ObjectId | string;
  plan: string;
  tierType: string;

  storageLimitBytes: number; // bytes
  maxUsers: number;
  maxApiRequests: number; // monthly
  maxLeads: number;
  maxGroups: number;
  maxConcurrentCampaigns: number;
  maxMonthlyMessages: number;
  maxRecipientsPerCampaign: number;

  isCustomOverride: boolean;
  customOverrides?: Record<string, any>;
  notes?: string;
  updatedBy?: string;
}

export interface IUsageLimitDocument extends IUsageLimit, Document {}

const UsageLimitSchema: Schema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
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
    customOverrides: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String, default: '' },
    updatedBy: { type: String, default: 'system' },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.UsageLimit ||
  mongoose.model<IUsageLimitDocument>('UsageLimit', UsageLimitSchema);
