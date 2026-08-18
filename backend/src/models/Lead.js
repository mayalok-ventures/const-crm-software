const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, default: 'Agent' },
  createdAt: { type: Date, default: Date.now },
});

const editHistorySchema = new mongoose.Schema({
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changes: { type: mongoose.Schema.Types.Map, of: mongoose.Schema.Types.Mixed }
}, { _id: false });

const leadActivitySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'lead_created',
      'status_changed',
      'assigned_agent',
      'site_visit_scheduled',
      'site_visit_completed',
      'note_added',
      'message_sent',
      'message_received',
      'recording_added',
      'project_linked',
      'lead_updated',
    ],
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  performerName: {
    type: String,
    default: 'System',
  },
  details: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const leadSchema = new mongoose.Schema({
  // Creator / Lead Owner
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Organization / Company Association
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Assigned Agent (Under assigned lead sharing mode)
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedToName: { type: String, default: '' },

  // Linked Project / Package Offering Pre-set
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  project: { type: String, default: '' },

  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  company: { type: String, trim: true },
  tags: [{ type: String, trim: true }],

  // Standardized 6 Services
  service_required: {
    type: String,
    enum: [
      'digital_marketing',
      'web_development',
      'seo_optimization',
      'crm_automation',
      'branding_design',
      'cloud_infrastructure'
    ],
    default: 'digital_marketing',
    lowercase: true,
    trim: true,
  },
  monthly_spend: {
    type: Number,
    default: 0,
    min: [0, 'Monthly spend cannot be negative'],
  },
  goal_timeline: {
    type: String,
    enum: ['immediate', 'within_1_month', '1_to_3_months', '3_to_6_months', 'flexible'],
    default: 'immediate',
    trim: true,
  },

  // Sales Pipeline Stage (Exact 5 baseline stages)
  status: {
    type: String,
    enum: [
      'new_lead',
      'contacted',
      'not_interested',
      'converted',
      'payment_done',
      // Legacy compatibility
      'new',
      'site_visit_scheduled',
      'negotiation',
      'closed',
      'lost'
    ],
    default: 'new_lead',
    trim: true,
  },

  // Plan Selection, Payable & Paid Tracking
  selected_plan_id: { type: String, default: null },
  selectedPlanId: { type: String, default: null },
  payable_amount: { type: Number, default: 0, min: 0 },
  payableAmount: { type: Number, default: 0, min: 0 },
  paid_amount: { type: Number, default: 0, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },

  // Concurrency & Optimistic Locking Version
  version: { type: Number, default: 1 },

  // Soft Deletion
  deletedAt: { type: Date, default: null },

  // Deal Dimensions & Revenue Tracking
  propertyType: { type: String, default: '' },
  budget: { type: String, default: '' },
  closedDealAmount: { type: Number, default: null },
  location: { type: String, default: '' },
  profession: { type: String, default: '' },
  areasOfInterest: [{ type: String, trim: true }],
  siteVisitDate: { type: Date, default: null },

  // Dynamic Custom Form Fields & Metadata (agent_custom_price, admin_flag, etc.)
  customData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      offers_applied: [],
      payable_amount: 0,
      agent_custom_price: false,
      admin_flag: false,
      custom_price_reason: '',
      whatsapp_connected: false,
      templates_sent: [],
    },
  },

  notes: [noteSchema],
  followUpDate: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  followUpNotified: { type: Boolean, default: false },
  lastContactedAt: { type: Date, default: null },
  
  // Activity Audit Trail
  leadActivities: [leadActivitySchema],

  // Change Log
  editHistory: [editHistorySchema],

  // Template usage tracking
  templateUsageCount: { type: Number, default: 0 },
  messageSentCount: { type: Number, default: 0 },

  source: {
    type: String,
    enum: ['signup', 'agent_manual', 'import', 'other', 'platform_registration', 'Auto-Signup', 'manual', 'meta_webhook', 'google_webhook'],
    default: 'agent_manual',
  },
  utmCampaign: {
    type: String,
    default: '',
    trim: true,
  },
  utmMedium: {
    type: String,
    default: '',
    trim: true,
  },
  utmSource: {
    type: String,
    default: '',
    trim: true,
  },

  // Lost Deal Categorization & Context
  lostReason: {
    type: String,
    default: '',
    trim: true,
  },
  lostReasonDetail: {
    type: String,
    default: '',
    trim: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual aliases for camelCase / snake_case interoperability
leadSchema.virtual('serviceRequired')
  .get(function() { return this.service_required; })
  .set(function(v) { this.service_required = v; });

leadSchema.virtual('monthlySpend')
  .get(function() { return this.monthly_spend; })
  .set(function(v) { this.monthly_spend = v; });

leadSchema.virtual('goalTimeline')
  .get(function() { return this.goal_timeline; })
  .set(function(v) { this.goal_timeline = v; });

leadSchema.virtual('selectedPlanId')
  .get(function() { return this.selected_plan_id; })
  .set(function(v) { this.selected_plan_id = v; });

leadSchema.virtual('payableAmount')
  .get(function() { return this.payable_amount; })
  .set(function(v) { this.payable_amount = v; });

leadSchema.virtual('paidAmount')
  .get(function() { return this.paid_amount; })
  .set(function(v) { this.paid_amount = v; });

// Indexes for fast queries
leadSchema.index({ userId: 1 });
leadSchema.index({ companyId: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ companyId: 1, status: 1 });
leadSchema.index({ userId: 1, followUpDate: 1 });
// Multi-tenant phone uniqueness: unique within the company when linked, or unique per solo user when unlinked
leadSchema.index(
  { companyId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { companyId: { $exists: true, $type: 'objectId' } } }
);
leadSchema.index(
  { userId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { companyId: { $eq: null } } }
);
leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ status: 1, service_required: 1, assignedTo: 1 });
leadSchema.index({ deletedAt: 1, createdAt: -1 });
leadSchema.index({ name: 'text', phone: 'text', company: 'text', email: 'text', project: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
