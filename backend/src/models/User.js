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

  // Organization / Agent Usercode (e.g. CMP-849201 for Admin/Company, AGT-102934 for Agent)
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

  // ─────────────────────────────────────────────────────────────
  // ROLE & HIERARCHY MODEL (Single Admin Architecture)
  // ─────────────────────────────────────────────────────────────
  role: {
    type: String,
    enum: ['admin', 'manager', 'agent', 'superadmin', 'user'],
    default: 'agent',
    required: true,
  },
  isAdmin: { type: Boolean, default: false },

  // Organizational Hierarchy (Admin -> Manager -> Agent)
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  managerName: {
    type: String,
    default: '',
    trim: true,
  },

  // Operational & Lead Routing Controls
  leadCap: {
    type: Number,
    default: 50,
    min: [0, 'Lead cap cannot be negative'],
  },
  isAvailableForRouting: {
    type: Boolean,
    default: true,
  },
  isAvailable: { // Alias for backward compatibility
    type: Boolean,
    default: true,
  },
  userStatus: {
    type: String,
    enum: ['active', 'inactive', 'disabled'],
    default: 'active',
  },
  isActive: {
    type: Boolean,
    default: true,
  },

  // Work Status & RBAC Legacy
  workStatus: {
    type: String,
    enum: ['company_owner', 'independent_agent', 'agent', 'employee'],
    default: 'agent',
  },
  companyRole: {
    type: String,
    enum: ['owner', 'agent', 'solo', 'sales_rep', 'manager', 'telecaller'],
    default: 'agent',
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  connectedCompanyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  companyJoinMethod: {
    type: String,
    enum: ['usercode', 'qr_invite', 'admin_created', 'created_by_company', 'none'],
    default: 'none',
  },
  companyLeaveRequest: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },

  // Profile / Company Information
  companyInfo: {
    companyName: { type: String, default: '' },
    companyLogo: { type: String, default: null },
    companyPhone: { type: String, default: '' },
    companyEmail: { type: String, default: '' },
    companyAddress: { type: String, default: '' },
    companyGst: { type: String, default: '' },
    companyRera: { type: String, default: '' },
    companyWebsite: { type: String, default: '' },
    paymentQrCode: { type: String, default: null },
    paymentUpiId: { type: String, default: '' },
    paymentBankDetails: {
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      bankName: { type: String, default: '' },
    },
    termsAndConditions: { type: String, default: '' },
  },

  // Vertical & Customization
  industryType: {
    type: String,
    default: 'Agency',
    trim: true,
  },
  educationSubProfile: {
    type: String,
    default: null,
    trim: true,
  },

  pipelineStages: {
    type: [String],
    default: [],
  },
  customPipelineStages: {
    type: [String],
    default: [],
  },
  leadFormSchema: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },

  // Authentication & Security
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  twoFactorRecoveryCodes: { type: [String], default: [] },
  twoFactorOtp: { type: String, default: null },
  twoFactorOtpExpires: { type: Date, default: null },

  // Subscription Tiering
  plan: {
    type: String,
    enum: [
      'free',
      'starter',
      'growth',
      'pro',
      'basic_solo',
      'smart_solo',
      'power_solo',
      'team_starter',
      'business',
      'enterprise',
      'custom_enterprise',
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

  lastLogin: { type: Date },
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
  // Sync isAvailable and isAvailableForRouting
  if (this.isAvailableForRouting !== undefined && this.isAvailable === undefined) {
    this.isAvailable = this.isAvailableForRouting;
  }
  if (this.isAvailable !== undefined && this.isAvailableForRouting === undefined) {
    this.isAvailableForRouting = this.isAvailable;
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
  delete obj.twoFactorRecoveryCodes;
  return obj;
};

// Query Indexes
userSchema.index({ role: 1, managerId: 1 });
userSchema.index({ isAvailableForRouting: 1, isActive: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
