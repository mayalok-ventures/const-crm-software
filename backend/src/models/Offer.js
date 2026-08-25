const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  lead_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
  },
  title: {
    type: String,
    required: [true, 'Offer title is required'],
    trim: true,
  },
  code: {
    type: String,
    uppercase: true,
    trim: true,
  },
  discount_pct: {
    type: Number,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100%'],
    default: null,
  },
  discountPct: {
    type: Number,
    default: null,
  },
  discount_fixed: {
    type: Number,
    min: [0, 'Fixed discount must be positive'],
    default: null,
  },
  discountFixed: {
    type: Number,
    default: null,
  },
  applied: {
    type: Boolean,
    default: false,
  },
  applied_at: {
    type: Date,
    default: null,
  },
  appliedAt: {
    type: Date,
    default: null,
  },
  valid_until: {
    type: Date,
    default: null,
  },
  validUntil: {
    type: Date,
    default: null,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  schemeType: {
    type: String,
    enum: ['flat_discount', 'percentage_discount', 'free_parking', 'free_club', 'modular_kitchen', 'subvention_20_80', 'clp_plan', 'custom'],
    default: 'flat_discount',
  },
  applicableProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  }],
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'ARCHIVED'],
    default: 'ACTIVE',
  },
  valid_from: {
    type: Date,
    default: Date.now,
  },
  validFrom: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

offerSchema.pre('save', function (next) {
  if (this.agent_id && !this.agentId) this.agentId = this.agent_id;
  if (this.agentId && !this.agent_id) this.agent_id = this.agentId;
  if (this.lead_id && !this.leadId) this.leadId = this.lead_id;
  if (this.leadId && !this.lead_id) this.lead_id = this.leadId;
  if (this.discount_pct !== undefined && this.discountPct === undefined) this.discountPct = this.discount_pct;
  if (this.discountPct !== undefined && this.discount_pct === undefined) this.discount_pct = this.discountPct;
  if (this.discount_fixed !== undefined && this.discountFixed === undefined) this.discountFixed = this.discount_fixed;
  if (this.discountFixed !== undefined && this.discount_fixed === undefined) this.discount_fixed = this.discountFixed;
  if (this.applied_at && !this.appliedAt) this.appliedAt = this.applied_at;
  if (this.appliedAt && !this.applied_at) this.applied_at = this.appliedAt;
  next();
});

offerSchema.index({ code: 1 });
offerSchema.index({ lead_id: 1 });

module.exports = mongoose.models.Offer || mongoose.model('Offer', offerSchema);
