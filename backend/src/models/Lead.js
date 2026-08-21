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
      'call_initiated',
      'followup_scheduled',
      'followup_completed',
      'followup_postponed',
      'stall_locked',
      'event_pass',
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

const childSchema = new mongoose.Schema({
  childName: { type: String, required: true, trim: true },
  age: { type: Number, default: null },
  dob: { type: Date, default: null },
  gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
  gradeApplied: { type: String, trim: true, default: '' },
  previousSchool: { type: String, trim: true, default: '' },
  transportRequired: { type: Boolean, default: false },
  status: { type: String, default: 'Inquiry', trim: true },
  notes: { type: String, default: '' },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const leadSchema = new mongoose.Schema({
  // Creator / Lead Owner
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Organization / Company Association
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Single User to Organization Collaboration (Rule 4)
  sharedWithCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isSharedFromSingleUser: { type: Boolean, default: false },
  sharedByUserName: { type: String, default: '' },

  // Assigned Agent & Manager Hierarchy
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedToName: { type: String, default: '' },
  assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedManagerName: { type: String, default: '' },

  // Distribution Engine Metadata
  distributionRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadDistributionRule', default: null },
  distributionStrategy: { type: String, default: 'manual' },
  visibilityMode: { type: String, enum: ['shared', 'isolated'], default: 'shared' },

  // Primary Source Classification (Phase 4: Source A - Manual, Source B - User Signup, Source C - Ads)
  primarySource: {
    type: String,
    enum: ['SOURCE_A_MANUAL', 'SOURCE_B_SIGNUP', 'SOURCE_C_ADS', 'manual', 'signup', 'ads', 'webhook'],
    default: 'SOURCE_A_MANUAL',
    index: true,
  },

  // Linked Project / Package Offering Pre-set
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  project: { type: String, default: '' },

  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  company: { type: String, trim: true },
  tags: [{ type: String, trim: true }],

  // CoreSetu Subscription Plans (3 Individual, 3 Organization)
  service_required: {
    type: String,
    enum: [
      // 3 Individual Plans
      'basic_solo',
      'smart_solo',
      'power_solo',
      // 3 Organization Plans
      'team_starter',
      'business',
      'enterprise',
      // Dynamic & Backward Compatibility
      'custom_enterprise',
      'starter',
      'growth',
      'pro',
      'free',
      'digital_marketing',
      'web_development',
      'seo_optimization',
      'crm_automation',
      'branding_design',
      'cloud_infrastructure'
    ],
    default: 'smart_solo',
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

  // Sales Pipeline Stage (Supports Dynamic Tenant Pipeline Stages & Standard Stages)
  status: {
    type: String,
    default: 'new_lead',
    trim: true,
  },

  // Plan Selection, Payable & Paid Tracking
  selected_plan_id: { type: String, default: null },
  payable_amount: { type: Number, default: 0, min: 0 },
  paid_amount: { type: Number, default: 0, min: 0 },
  payment_method: { type: String, default: null },

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

  // K-12 Multi-Child / Dependents Sub-document Array
  // Solves the K-12 edge case: One parent phone number can hold multiple child inquiries without duplicate collision
  children: [childSchema],
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
  // Comprehensive Follow-Up & Alarm State
  activeFollowUp: {
    scheduledAt: { type: Date, default: null },
    note: { type: String, default: '', trim: true },
    status: { type: String, enum: ['none', 'scheduled', 'due', 'completed'], default: 'none' },
    delayCount: { type: Number, default: 0, min: 0, max: 2 },
    delayHistory: [{
      delayedAt: { type: Date, default: Date.now },
      delayedUntil: { type: Date, required: true },
      delayMinutes: { type: Number, required: true },
      reason: { type: String, default: '' },
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
    lastRungAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completionNote: { type: String, default: '', trim: true },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  followUpDate: { type: Date, default: null },
  followUpNote: { type: String, default: '', trim: true },
  followUpStatus: { type: String, enum: ['none', 'scheduled', 'due', 'completed'], default: 'none' },
  followUpDelayCount: { type: Number, default: 0, min: 0, max: 2 },
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
    enum: [
      'meta', 'google', 'facebook', 'instagram', 'google_ads', 'meta_ads',
      'website', 'organic', 'referral', 'partner', 'import', 'spreadsheet',
      'signup', 'agent_manual', 'manual', 'other', 'platform_registration',
      'auto-signup', 'meta_webhook', 'google_webhook', 'api', 'webhook'
    ],
    default: 'agent_manual',
    lowercase: true,
    trim: true,
  },
  leadSource: {
    provider: { type: String, default: '' },
    externalLeadId: { type: String, default: '' },
    integrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Integration', default: null },
    accountId: { type: String, default: null },
    pageId: { type: String, default: null },
    formId: { type: String, default: null },
    formName: { type: String, default: '' },
    campaignId: { type: String, default: null },
    campaignName: { type: String, default: '' },
    adSetId: { type: String, default: null },
    adSetName: { type: String, default: '' },
    adGroupId: { type: String, default: null },
    adGroupName: { type: String, default: '' },
    adId: { type: String, default: null },
    adName: { type: String, default: '' },
    importedAt: { type: Date, default: null },
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

const PLAN_DISPLAY_LABELS = {
  basic_solo: 'Basic Solo (₹399/mo)',
  smart_solo: 'Smart Solo (₹799/mo)',
  power_solo: 'Power Solo (₹1,299/mo)',
  team_starter: 'Team Starter (₹1,499/mo)',
  business: 'Business Agency (₹2,499/mo)',
  enterprise: 'Enterprise Command (₹4,999/mo)',
  custom_enterprise: 'Custom Enterprise',
};

// Virtual aliases for camelCase / snake_case interoperability
leadSchema.virtual('serviceRequired')
  .get(function() { return this.service_required; })
  .set(function(v) { this.service_required = v; });

leadSchema.virtual('serviceRequiredLabel')
  .get(function() { return PLAN_DISPLAY_LABELS[this.service_required] || this.service_required; });

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

leadSchema.virtual('paymentAmount')
  .get(function() { return this.paid_amount || this.payable_amount; })
  .set(function(v) { this.paid_amount = v; this.payable_amount = v; });

leadSchema.virtual('paymentMethod')
  .get(function() { return this.payment_method; })
  .set(function(v) { this.payment_method = v; });

leadSchema.virtual('dependents')
  .get(function() { return this.children; })
  .set(function(v) { this.children = v; });

// Indexes for fast queries
leadSchema.index({ userId: 1 });
leadSchema.index({ companyId: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ companyId: 1, status: 1 });
leadSchema.index({ userId: 1, followUpDate: 1 });
leadSchema.index({ followUpDate: 1, status: 1 });
leadSchema.index({ 'activeFollowUp.status': 1, 'activeFollowUp.scheduledAt': 1 });
// Multi-tenant phone uniqueness: unique within the company when linked, or unique per solo user when unlinked
leadSchema.index(
  { companyId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { companyId: { $exists: true, $type: 'objectId' } } }
);
leadSchema.index(
  { userId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { companyId: { $eq: null } } }
);
// Multi-tenant external lead ID idempotency: prevents duplicate webhook creations under high concurrency
leadSchema.index(
  { companyId: 1, 'leadSource.provider': 1, 'leadSource.externalLeadId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $exists: true, $type: 'objectId' },
      'leadSource.externalLeadId': { $gt: '' },
    },
  }
);
leadSchema.index(
  { userId: 1, 'leadSource.provider': 1, 'leadSource.externalLeadId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $eq: null },
      'leadSource.externalLeadId': { $gt: '' },
    },
  }
);
leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ status: 1, service_required: 1, assignedTo: 1 });
leadSchema.index({ deletedAt: 1, createdAt: -1 });
leadSchema.index({ name: 'text', phone: 'text', company: 'text', email: 'text', project: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
