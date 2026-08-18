const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    unique: true,
  },
  // Normalized phone (digits only)
  phone: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
  },
  password: { type: String, required: true },

  // Unique Admin/System handle
  username: {
    type: String,
    uppercase: true,
    trim: true,
    sparse: true,
    unique: true,
    immutable: true,
  },

  // Organization / Agent Usercode (e.g. CMP-849201 for Company, REA-102934 for Agent)
  usercode: {
    type: String,
    uppercase: true,
    trim: true,
    sparse: true,
    unique: true,
  },

  // Profile Picture URL or local path
  profilePicture: { type: String, default: null },

  // Chosen Profile Avatar Icon (1 of 10 presets)
  avatarIcon: { type: String, default: 'avatar-1' },

  // Role hierarchy
  role: {
    type: String,
    enum: ['user', 'superadmin'],
    default: 'user',
  },
  isAdmin: { type: Boolean, default: false },

  // Work Status & RBAC (STRICTLY IMMUTABLE AFTER SIGNUP)
  workStatus: {
    type: String,
    enum: ['company_owner', 'independent_agent', 'agent', 'employee'],
    default: 'independent_agent',
  },
  companyRole: {
    type: String,
    enum: ['owner', 'agent', 'solo', 'sales_rep', 'manager', 'telecaller'],
    default: 'agent',
  },
  // Associated Company (points to company owner user)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  incentive_pct: {
    type: Number,
    default: 10,
  },
  incentivePct: {
    type: Number,
    default: 10,
  },
  whatsapp_connection: {
    type: String,
    enum: ['agent_owned', 'use_admin_number', 'admin_proxy'],
    default: 'agent_owned',
  },

  // Industry Vertical (LOCKED & IMMUTABLE AFTER SIGNUP)
  industryType: {
    type: String,
    default: 'Agency',
    immutable: true,
  },

  // Dynamic Pipeline Stages (Industry default + User customized)
  pipelineStages: [{
    type: String,
    trim: true,
  }],
  customPipelineStages: [{
    type: String,
    trim: true,
  }],

  // Unified Dynamic Form Schema Builder
  leadFormSchema: [{
    fieldId: { type: String, required: true },
    label: { type: String, required: true },
    fieldType: {
      type: String,
      enum: ['text', 'email', 'phone', 'dropdown', 'date', 'number'],
      default: 'text',
    },
    options: [{ type: String, trim: true }],
    isRequired: { type: Boolean, default: false },
    isSystem: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    dependsOn: {
      field: { type: String, default: null },
      value: { type: String, default: null },
    },
  }],

  // Legacy dynamic lead form fields (kept for fallback)
  customLeadFields: [{
    fieldId: { type: String },
    label: { type: String },
    fieldType: {
      type: String,
      enum: ['text', 'number', 'date', 'dropdown'],
      default: 'text',
    },
    options: [{ type: String, trim: true }],
    isRequired: { type: Boolean, default: false },
  }],

  // Smart Exit Permissions tracking
  companyJoinMethod: {
    type: String,
    enum: ['created_by_company', 'joined_voluntarily', 'none'],
    default: 'none',
  },
  companyLeaveRequest: {
    type: String,
    enum: ['none', 'pending'],
    default: 'none',
  },

  // Detailed Company Information
  companyInfo: {
    companyName: { type: String, default: '' },
    companyPhone: { type: String, default: '' },
    companyEmail: { type: String, default: '' },
    companyAddress: { type: String, default: '' },
    reraNumber: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    website: { type: String, default: '' },
    logo: { type: String, default: null },
  },

  // Company Agency Settings & Lead Sharing Rules
  companySettings: {
    leadSharingMode: {
      type: String,
      enum: ['common_pool', 'assigned'],
      default: 'common_pool',
    },
    incentivePerConversion: {
      type: Number,
      default: 0, // Incentive per closed/won deal
    },
    allowAgentCompanyWhatsApp: {
      type: Boolean,
      default: true,
    },
    exportPermissionStatus: {
      type: String,
      enum: ['allowed', 'restricted', 'pending_approval'],
      default: 'allowed',
    },
  },

  // Per-Agent WhatsApp Authorization & Export Permissions
  allowCompanyWhatsApp: {
    type: Boolean,
    default: false,
  },
  exportPermissionStatus: {
    type: String,
    enum: ['allowed', 'restricted', 'pending_approval'],
    default: 'allowed',
  },
  // Universal SaaS Localization & Multi-Currency Settings
  localization: {
    currencySymbol: { type: String, default: '₹' },
    currencyCode: { type: String, default: 'INR' },
    countryPhoneCode: { type: String, default: '91' },
  },

  // Two-Factor Authentication (TOTP Authenticator App)
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorMethod: {
    type: String,
    enum: ['totp', 'none'],
    default: 'totp',
  },
  twoFactorSecret: { type: String, default: null },
  twoFactorRecoveryCodes: [{ type: String, uppercase: true, trim: true }],
  twoFactorOtp: { type: String, default: null },
  twoFactorOtpExpires: { type: Date, default: null },

  plan: {
    type: String,
    enum: [
      'free',
      // Legacy plans
      'starter',
      'growth',
      'pro',
      // Individual Solo Plans
      'basic_solo',
      'smart_solo',
      'power_solo',
      // Organization Plans
      'team_starter',
      'business',
      'enterprise',
      'custom_enterprise'
    ],
    default: 'free',
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  },
  isCustomPlan: {
    type: Boolean,
    default: false,
  },
  planStartDate: { type: Date, default: null },
  planEndDate: { type: Date, default: null },

  billing: {
    originalPrice: { type: Number, default: 0 },
    discountedPrice: { type: Number, default: 0 },
    couponCodeUsed: { type: String, default: null },
    lastPaymentId: { type: String, default: null },
    lastOrderId: { type: String, default: null },
  },

  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },

  suspension: {
    isSuspended: { type: Boolean, default: false },
    level: { type: Number, default: 0, min: 0, max: 4 },
    reason: { type: String, default: null },
    suspendedAt: { type: Date, default: null },
    suspendedUntil: { type: Date, default: null },
  },

  loginAttempts: { type: Number, default: 0 },
  lastFailedLogin: { type: Date, default: null },
  abuseScore: { type: Number, default: 0 },

  shareToken: { type: String, default: null },
  shareTokenEnabled: { type: Boolean, default: false },
}, { timestamps: true });

// Validate at least one of email or phone
userSchema.pre('validate', function (next) {
  if (!this.email && !this.phone) {
    return next(new Error('At least one of email or phone is required'));
  }
  next();
});

// Password hashing
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Custom JSON serializer removing sensitive data
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  delete obj.twoFactorOtp;
  delete obj.twoFactorOtpExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
