const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────
// CANONICAL LEAD SOURCE NORMALIZATION
// ─────────────────────────────────────────────────────────────
function normalizeLeadSource(val) {
  if (!val) return 'MANUAL';
  const clean = String(val).trim().toUpperCase();
  
  if (['USER_SIGNUP', 'SIGNUP', 'AUTO-SIGNUP', 'AUTO_SIGNUP', 'AUTOSIGNUP', 'PLATFORM_REGISTRATION', 'PLATFORM SIGNUP', 'SOURCE_B_SIGNUP'].includes(clean)) {
    return 'USER_SIGNUP';
  }
  if (['ADS', 'META', 'GOOGLE', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE_ADS', 'META_ADS', 'META ADS', 'GOOGLE ADS', 'CAMPAIGN', 'SOURCE_C_ADS'].includes(clean)) {
    return 'ADS';
  }
  if (['WEBHOOK', 'META_WEBHOOK', 'GOOGLE_WEBHOOK', 'API', 'EXTERNAL_INGESTION'].includes(clean)) {
    return 'WEBHOOK';
  }
  if (['MANUAL', 'AGENT_MANUAL', 'DIRECT CALL', 'DIRECT_CALL', 'CALL', 'IMPORT', 'SPREADSHEET', 'REFERRAL', 'PARTNER', 'WEBSITE', 'ORGANIC', 'OTHER', 'SOURCE_A_MANUAL'].includes(clean)) {
    return 'MANUAL';
  }
  return 'MANUAL';
}

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
    trim: true,
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

const inquirySchema = new mongoose.Schema({
  inquiryId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  source: { type: String, required: true },
  externalLeadId: { type: String, default: '' },
  integrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Integration', default: null },
  formId: { type: String, default: '' },
  formName: { type: String, default: '' },
  campaignId: { type: String, default: '' },
  campaignName: { type: String, default: '' },
  course: { type: String, default: '' },
  city: { type: String, default: '' },
  customQuestions: { type: mongoose.Schema.Types.Mixed, default: {} },
  assignmentReason: { type: String, default: '' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'new_inquiry' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const leadSchema = new mongoose.Schema({
  // Multi-Tenant Workspace Boundary (Spec Section 5)
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },

  // Creator / Lead Owner
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Organization / Company Association
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Campaign Inbound Routing & Attribution Linkage
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
  campaignName: { type: String, default: '', trim: true, index: true },

  // Single User Ownership
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedToName: { type: String, default: '' },

  // Primary Source Classification (Canonical: MANUAL, USER_SIGNUP, ADS, WEBHOOK)
  primarySource: {
    type: String,
    enum: ['MANUAL', 'USER_SIGNUP', 'ADS', 'WEBHOOK'],
    default: 'MANUAL',
    set: normalizeLeadSource,
    index: true,
  },

  name: { type: String, default: '', trim: true },
  nameLower: { type: String, lowercase: true, trim: true, default: '' },
  phone: { type: String, default: '', trim: true },
  phoneDigits: { type: String, trim: true, default: '' },
  email: { type: String, lowercase: true, trim: true },
  company: { type: String, trim: true },
  companyLower: { type: String, lowercase: true, trim: true, default: '' },
  tags: [{ type: String, trim: true }],

  // Student Candidate Academic & Admission Profile
  targetStream: { type: String, default: '', trim: true }, // e.g. Engineering, Medical, MBA, Law, Pharmacy
  targetDomain: { type: String, default: '', trim: true }, // Alias for targetStream
  targetCourse: { type: String, default: '', trim: true }, // e.g. B.Tech Computer Science, MBBS, MBA Finance
  targetState: { type: String, default: '', trim: true },
  targetCity: { type: String, default: '', trim: true },
  academicScore: { type: String, default: '', trim: true }, // Formatted academic score (e.g. 55% or 82%)
  academicScore10th: { type: Number, default: null },
  academicScore12th: { type: Number, default: null },
  academicScoreGrad: { type: Number, default: null },
  entranceExam: { type: String, default: '', trim: true }, // e.g. NEET, JEE Main, CAT, CLAT, MAT
  entranceRank: { type: String, default: '', trim: true },
  quotaPreference: {
    type: String,
    default: '',
    trim: true
  },
  packageBudget: { type: String, default: '', trim: true }, // Candidate package budget range
  shortlistedColleges: [{
    collegeName: { type: String, trim: true },
    courseName: { type: String, trim: true },
    feeQuote: { type: Number, default: 0 },
    quota: { type: String, default: 'Merit' },
  }],
  campusVisitDate: { type: Date, default: null },
  tokenAdvancePaid: { type: Number, default: 0, min: 0 },
  admissionFinalFee: { type: Number, default: 0, min: 0 },

  // Personal & Guardian Details
  alternatePhone: { type: String, default: '', trim: true },
  dob: { type: Date, default: null },
  gender: { type: String, default: '', trim: true },
  category: { type: String, default: '', trim: true }, // e.g. General, OBC, SC, ST, EWS
  city: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  pincode: { type: String, default: '', trim: true },
  fatherName: { type: String, default: '', trim: true },
  fatherPhone: { type: String, default: '', trim: true },
  fatherOccupation: { type: String, default: '', trim: true },
  motherName: { type: String, default: '', trim: true },

  // Detailed Academic Qualifications (10th / 12th / Grad)
  tenthBoard: { type: String, default: '', trim: true },
  tenthPercentage: { type: Number, default: null },
  tenthYear: { type: String, default: '', trim: true },
  twelfthBoard: { type: String, default: '', trim: true },
  twelfthStream: { type: String, default: '', trim: true }, // PCM, PCB, PCMB, Commerce, Arts
  twelfthPercentage: { type: Number, default: null },
  twelfthGroupPercentage: { type: Number, default: null }, // PCM/PCB % for eligibility
  twelfthYear: { type: String, default: '', trim: true },
  gradDegree: { type: String, default: '', trim: true },
  gradCollege: { type: String, default: '', trim: true },
  gradPercentage: { type: Number, default: null },
  gradYear: { type: String, default: '', trim: true },

  // Entrance Exams & Competitive Scores
  entranceExamRollNo: { type: String, default: '', trim: true },
  entranceScore: { type: String, default: '', trim: true },
  entrancePercentile: { type: String, default: '', trim: true },

  // Consultation & College Preferences
  degreeLevel: { type: String, default: '', trim: true }, // UG / PG / Diploma
  preferredSpecialization: { type: String, default: '', trim: true },
  preferredColleges: { type: String, default: '', trim: true },

  // Commercial / Subscription Packages
  service_required: {
    type: String,
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

  // Sales Pipeline Stage (Default: Lead Received)
  status: {
    type: String,
    default: 'Lead Received',
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

  // Candidate Budget & Package Range
  budget: { type: String, default: '' },
  budgetMin: { type: Number, default: 0, min: 0 },
  budgetMax: { type: Number, default: 0, min: 0 },
  closedDealAmount: { type: Number, default: null },
  location: { type: String, default: '' },
  profession: { type: String, default: '' },
  areasOfInterest: [{ type: String, trim: true }],
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Catalogue', default: null },
  project: { type: String, default: '' },

  // Admission Consulting Domain Enhancements & Candidate Intent Scoring Engine
  temperature: {
    type: String,
    enum: ['HOT', 'WARM', 'COLD', null],
    default: 'WARM',
    set: (v) => (v ? String(v).toUpperCase().trim() : 'WARM'),
    index: true,
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true,
  },
  scoringBreakdown: [{
    factor: { type: String, required: true },
    points: { type: Number, required: true },
    appliedAt: { type: Date, default: Date.now }
  }],
  lostReason: {
    type: String,
    enum: [
      'Budget Exceeded',
      'Location / Distance',
      'Preferred Course Unavailable',
      'Opted for Government / Merit Seat',
      'Lost to Direct College',
      'Joined Other Institute',
      'Fake Lead / Not Interested',
      'Dropped Year',
      'Family Decision',
      'Invalid Contact / Unreachable',
      'No Response',
      'Other',
      null,
      '',
    ],
    default: '',
    trim: true,
  },
  admissionDetails: {
    college: { type: String, trim: true, default: '' },
    course: { type: String, trim: true, default: '' },
    feeAmount: { type: Number, default: 0 },
    admissionDate: { type: Date, default: null },
  },
  lostRemarks: { type: String, default: '', trim: true },
  pipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', default: null },
  pipelineStage: { type: String, default: 'Lead Received', trim: true },

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
    status: { type: String, enum: ['none', 'scheduled', 'due', 'completed', 'postponed', 'cancelled'], default: 'none' },
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
  followUpStatus: { type: String, enum: ['none', 'scheduled', 'due', 'completed', 'postponed', 'cancelled'], default: 'none' },
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
      'MANUAL', 'USER_SIGNUP', 'ADS', 'WEBHOOK',
      'meta', 'google', 'facebook', 'instagram', 'google_ads', 'meta_ads',
      'website', 'organic', 'referral', 'partner', 'import', 'spreadsheet', 'sheets',
      'custom', 'custom_webhook',
      'signup', 'agent_manual', 'manual', 'other', 'platform_registration',
      'auto-signup', 'meta_webhook', 'google_webhook', 'api', 'webhook',
      'website_form', 'whatsapp_inbound', 'whatsapp',
      'Auto-Signup', 'Direct Call', 'Meta Ads', 'Google Ads', 'Organic Search', 'Referral'
    ],
    default: 'MANUAL',
    trim: true,
  },
  leadSource: {
    provider: { type: String, default: '' },
    platform: { type: String, default: '', index: true }, // meta, google, sheets, website, custom, manual, signup
    connectionId: { type: String, default: null, index: true }, // pageId, customerId/accountId, sheetId, formKey
    connectionName: { type: String, default: '' },
    externalLeadId: { type: String, default: '', index: true },
    integrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Integration', default: null, index: true },
    accountId: { type: String, default: null },
    pageId: { type: String, default: null },
    formId: { type: String, default: null },
    formName: { type: String, default: '' },
    campaignId: { type: String, default: null, index: true },
    campaignName: { type: String, default: '' },
    adSetId: { type: String, default: null },
    adSetName: { type: String, default: '' },
    adGroupId: { type: String, default: null },
    adGroupName: { type: String, default: '' },
    adId: { type: String, default: null },
    adName: { type: String, default: '' },
    assignmentReason: { type: String, default: '' },
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

  // Multi-inquiry support for re-inquiries without phone collision (capped at 50)
  inquiries: [inquirySchema],
  assignmentReason: { type: String, default: '' },
  isTestLead: { type: Boolean, default: false, index: true },

  // Lost Deal Context
  lostReasonDetail: {
    type: String,
    default: '',
    trim: true,
  },
  releasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
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

leadSchema.virtual('tenthScore')
  .get(function() { return this.tenthPercentage ?? this.academicScore10th ?? null; })
  .set(function(v) {
    const num = v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : null;
    this.tenthPercentage = num;
    this.academicScore10th = num;
  });

leadSchema.virtual('twelfthScore')
  .get(function() { return this.twelfthPercentage ?? this.academicScore12th ?? null; })
  .set(function(v) {
    const num = v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : null;
    this.twelfthPercentage = num;
    this.academicScore12th = num;
  });

leadSchema.virtual('stream')
  .get(function() { return this.twelfthStream || this.targetStream || ''; })
  .set(function(v) { this.twelfthStream = v; });

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
// Partial filter guarantees that email-only leads (phone: empty or null) never collide
leadSchema.index(
  { companyId: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $exists: true, $type: 'objectId' },
      phone: { $exists: true, $type: 'string', $gt: '' },
    },
  }
);
leadSchema.index(
  { userId: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $eq: null },
      phone: { $exists: true, $type: 'string', $gt: '' },
    },
  }
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
leadSchema.index({ userId: 1, deletedAt: 1, status: 1 });
leadSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });
leadSchema.index({ userId: 1, deletedAt: 1, updatedAt: -1 });
leadSchema.index({ companyId: 1, deletedAt: 1, status: 1 });
leadSchema.index({ companyId: 1, deletedAt: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, deletedAt: 1, updatedAt: -1 });
leadSchema.index({ companyId: 1, deletedAt: 1, temperature: 1 });
leadSchema.index({ companyId: 1, deletedAt: 1, score: -1 });
leadSchema.index({ assignedTo: 1, deletedAt: 1, status: 1 });
leadSchema.index({ assignedTo: 1, deletedAt: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, deletedAt: 1, updatedAt: -1 });
leadSchema.index({ sharedWithCompanyId: 1, deletedAt: 1 });
leadSchema.index({ followUpDate: 1, deletedAt: 1 });
leadSchema.index({ 'leadActivities.timestamp': -1 });
// ─────────────────────────────────────────────────────────────
// CANONICAL LEAD SOURCE NORMALIZATION
// ─────────────────────────────────────────────────────────────
function normalizeLeadSource(val) {
  if (!val) return 'MANUAL';
  const clean = String(val).trim().toUpperCase();
  
  if (['USER_SIGNUP', 'SIGNUP', 'AUTO-SIGNUP', 'AUTO_SIGNUP', 'AUTOSIGNUP', 'PLATFORM_REGISTRATION', 'PLATFORM SIGNUP', 'SOURCE_B_SIGNUP'].includes(clean)) {
    return 'USER_SIGNUP';
  }
  if (['ADS', 'META', 'GOOGLE', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE_ADS', 'META_ADS', 'META ADS', 'GOOGLE ADS', 'CAMPAIGN', 'SOURCE_C_ADS'].includes(clean)) {
    return 'ADS';
  }
  if (['WEBHOOK', 'META_WEBHOOK', 'GOOGLE_WEBHOOK', 'API', 'EXTERNAL_INGESTION'].includes(clean)) {
    return 'WEBHOOK';
  }
  if (['MANUAL', 'AGENT_MANUAL', 'DIRECT CALL', 'DIRECT_CALL', 'CALL', 'IMPORT', 'SPREADSHEET', 'REFERRAL', 'PARTNER', 'WEBSITE', 'ORGANIC', 'OTHER', 'SOURCE_A_MANUAL'].includes(clean)) {
    return 'MANUAL';
  }
  return 'MANUAL';
}

leadSchema.pre('validate', function() {
  if (!this.primarySource && this.source) {
    this.primarySource = normalizeLeadSource(this.source);
  } else if (this.primarySource) {
    this.primarySource = normalizeLeadSource(this.primarySource);
  }

  if (this.name) {
    this.nameLower = this.name.toLowerCase().trim();
  } else {
    this.nameLower = '';
  }
  if (this.company) {
    this.companyLower = this.company.toLowerCase().trim();
  } else {
    this.companyLower = '';
  }
  if (this.phone) {
    this.phoneDigits = String(this.phone).replace(/\D/g, '');
  } else {
    this.phoneDigits = '';
  }
});

leadSchema.index({ workspaceId: 1, status: 1 });
leadSchema.index({ workspaceId: 1, status: 1, _id: -1 });
leadSchema.index({ workspaceId: 1, assignedTo: 1, _id: -1 });
leadSchema.index({ workspaceId: 1, pipelineId: 1, pipelineStage: 1, _id: -1 });
leadSchema.index({ workspaceId: 1, score: -1, _id: -1 });
leadSchema.index({ workspaceId: 1, createdAt: -1 });
leadSchema.index({ workspaceId: 1, assignedTo: 1 });
leadSchema.index({ workspaceId: 1, updatedAt: -1 });
leadSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
leadSchema.index({ workspaceId: 1, assignedTo: 1, updatedAt: -1 });
leadSchema.index({ userId: 1, status: 1, updatedAt: -1 });
leadSchema.index({ workspaceId: 1, campaignId: 1, status: 1 });
leadSchema.index({ workspaceId: 1, nameLower: 1 });
leadSchema.index({ workspaceId: 1, phoneDigits: 1 });
leadSchema.index({ workspaceId: 1, companyLower: 1 });
leadSchema.index({ workspaceId: 1, followUpDate: 1 });
leadSchema.index({ workspaceId: 1, 'activeFollowUp.status': 1, 'activeFollowUp.scheduledAt': 1 });

// Normalized Inbound Source Hierarchy & Filter Indexes
leadSchema.index({ companyId: 1, 'leadSource.platform': 1, createdAt: -1 });
leadSchema.index({ companyId: 1, 'leadSource.connectionId': 1, createdAt: -1 });
leadSchema.index({ companyId: 1, 'leadSource.campaignId': 1, createdAt: -1 });
leadSchema.index({ companyId: 1, assignedTo: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, isTestLead: 1, createdAt: -1 });
leadSchema.index({ userId: 1, 'leadSource.platform': 1, createdAt: -1 });
leadSchema.index({ userId: 1, 'leadSource.campaignId': 1, createdAt: -1 });
leadSchema.index({ 'leadSource.platform': 1, 'leadSource.campaignId': 1, createdAt: -1 });

leadSchema.pre('save', async function() {
  if (!this.primarySource && this.source) {
    this.primarySource = normalizeLeadSource(this.source);
  } else if (this.primarySource) {
    this.primarySource = normalizeLeadSource(this.primarySource);
  }

  if (this.name) this.nameLower = this.name.toLowerCase().trim();
  if (this.company) this.companyLower = this.company.toLowerCase().trim();
  if (this.phone) this.phoneDigits = String(this.phone).replace(/\D/g, '');

  // Optimize hot-path: skip 4 sequential queries if workspaceId & companyId are already established
  const needsResolution = (this.isNew || this.isModified('userId') || this.isModified('workspaceId') || this.isModified('companyId'))
    && (!this.workspaceId || !this.companyId || String(this.companyId) === String(this.userId))
    && (this.userId || this.companyId);

  if (needsResolution) {
    try {
      const Workspace = mongoose.models.Workspace || require('./Workspace');
      const User = mongoose.models.User || require('./User');
      let ws = null;
      let creator = null;

      if (this.userId) {
        creator = await User.findById(this.userId).select('companyId companyRole').lean();
        if (creator && creator.companyId && String(creator.companyId) !== String(this.userId)) {
          this.companyId = creator.companyId;
        }
      }

      if (!this.workspaceId && this.userId) {
        ws = await Workspace.findOne({ ownerId: this.userId, deletedAt: null }).select('_id ownerId').lean();
      }
      if (!ws && this.companyId) {
        ws = await Workspace.findOne({ ownerId: this.companyId, deletedAt: null }).select('_id ownerId').lean();
      }
      if (!ws && this.userId) {
        const WorkspaceMembership = mongoose.models.WorkspaceMembership || require('./WorkspaceMembership');
        const mem = await WorkspaceMembership.findOne({ userId: this.userId, status: 'active' }).select('workspaceId').lean();
        if (mem) {
          ws = await Workspace.findById(mem.workspaceId).select('_id ownerId').lean();
        }
      }
      if (ws) {
        if (!this.workspaceId) this.workspaceId = ws._id;
        if ((!this.companyId || String(this.companyId) === String(this.userId)) && ws.ownerId) {
          this.companyId = ws.ownerId;
        }
      }
    } catch (e) {
      // Non-blocking
    }
  }
});

leadSchema.post(['save', 'findOneAndUpdate', 'findByIdAndUpdate', 'updateOne', 'deleteOne', 'findOneAndDelete', 'findByIdAndDelete', 'deleteMany'], function(doc) {
  try {
    const { invalidateLeadCountCache } = require('../controllers/leadsController');
    const query = this.getQuery ? this.getQuery() : null;
    const wsId = doc?.workspaceId || query?.workspaceId || doc?.userId || query?.userId;
    invalidateLeadCountCache(wsId);
  } catch (_) {}
});

module.exports = mongoose.model('Lead', leadSchema);
module.exports.normalizeLeadSource = normalizeLeadSource;

