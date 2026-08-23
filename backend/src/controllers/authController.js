const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const Lead = require('../models/Lead');
const TenantConfig = require('../models/TenantConfig');
const Notification = require('../models/Notification');
const AbuseLog = require('../models/AbuseLog');
const Coupon = require('../models/Coupon');
const { generateToken, generateTemp2FAToken } = require('../middleware/auth');
const { generateUniqueUsername } = require('../utils/generateUsername');
const { generateUniqueUsercode } = require('../utils/generateUsercode');
const { getIndustryDefaults } = require('../utils/industryTemplates');
const { securityTracker } = require('../monitoring/security/securityTracker');
const { auditService } = require('../monitoring/audit/auditService');

// Helper to construct dynamic default form schema based on industry vertical
const getDefaultLeadFormSchema = (industryType = 'Agency', educationSubProfile = null) => {
  return getIndustryDefaults(industryType, educationSubProfile).leadFormSchema;
};
exports.getDefaultLeadFormSchema = getDefaultLeadFormSchema;

// @desc  Register new user (WorkStatus strictly locked at signup + Industry Vertical + Sub-Profile)
// @route POST /api/auth/register
// @access Public
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, workStatus, companyName, industryType, educationSubProfile } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }
    if (!email && !phone) {
      return res.status(400).json({ message: 'At least one of email or phone is required' });
    }

    const cleanPhone = phone ? phone.replace(/\D/g, '') : undefined;

    // Duplicate checks
    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() }).lean();
      if (emailExists) {
        return res.status(400).json({ message: 'This email is already registered.' });
      }
    }
    if (cleanPhone) {
      const phoneExists = await User.findOne({ phone: cleanPhone }).lean();
      if (phoneExists) {
        return res.status(400).json({ message: 'This phone number is already registered.' });
      }
    }

    // Role determined strictly at registration
    const selectedWorkStatus = workStatus === 'company_owner' ? 'company_owner' : 'independent_agent';
    const selectedCompanyRole = selectedWorkStatus === 'company_owner' ? 'owner' : 'solo';
    const selectedIndustry = industryType || 'Agency';
    const selectedEducationSubProfile = (selectedIndustry.toUpperCase().includes('EDU') || selectedIndustry.toUpperCase().includes('ACADEMIC'))
      ? (educationSubProfile || null)
      : null;

    // Industry defaults (Form Schema + Pipeline Stages)
    const { leadFormSchema: defaultSchema, pipelineStages: defaultStages } = getIndustryDefaults(selectedIndustry, selectedEducationSubProfile);

    // Generate unique username & usercode
    const username = await generateUniqueUsername(User);
    const prefix = selectedWorkStatus === 'company_owner' ? 'CMP' : 'REA';
    const usercode = await generateUniqueUsercode(User, prefix);

    const user = await User.create({
      name: name.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      phone: cleanPhone || undefined,
      password,
      username,
      usercode,
      industryType: selectedIndustry,
      educationSubProfile: selectedEducationSubProfile,
      workStatus: selectedWorkStatus,
      companyRole: selectedCompanyRole,
      companyInfo: {
        companyName: companyName ? companyName.trim() : (selectedWorkStatus === 'company_owner' ? `${name.trim()}'s Organization` : ''),
      },
      pipelineStages: defaultStages,
      customPipelineStages: defaultStages,
      leadFormSchema: defaultSchema,
      plan: 'free',
      isCustomPlan: false,
      billingCycle: 'monthly',
      planStartDate: null,
      planEndDate: null,
      billing: {
        originalPrice: 0,
        discountedPrice: 0,
        couponCodeUsed: null,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // TENANT WORKSPACE SEEDING (Pipelines, Custom Fields & Automations)
    // ─────────────────────────────────────────────────────────────
    try {
      await TenantConfig.seedWorkspace(user._id, selectedIndustry, selectedEducationSubProfile, user.companyId);
    } catch (cfgErr) {
      console.warn('[TenantConfig Seed] Notice:', cfgErr.message);
    }

    // ─────────────────────────────────────────────────────────────
    // SUPER ADMIN LEAD CAPTURE ENGINE (Automatic Lead Tracking)
    // ─────────────────────────────────────────────────────────────
    try {
      const superAdmin = await User.findOne({
        $or: [{ role: 'superadmin' }, { isAdmin: true }, { email: 'admin@crm.com' }]
      });

      if (superAdmin && String(superAdmin._id) !== String(user._id)) {
        const leadOrg = user.companyInfo?.companyName || (user.workStatus === 'company_owner' ? `${user.name}'s Organization` : 'Individual Solo');
        
        const isTestSignup = Boolean(
          (user.email && (user.email.includes('@crmtest.com') || user.email.includes('@edcrm.com') || user.email.includes('@test.com') || user.email.startsWith('test_') || user.email.startsWith('edu_') || user.email.startsWith('counsellor_'))) ||
          (user.phone && (user.phone.startsWith('9200') || user.phone.startsWith('9300') || user.phone.startsWith('000')))
        );

        const searchCriteria = user.email
          ? { userId: superAdmin._id, email: user.email }
          : { userId: superAdmin._id, phone: user.phone || user.usercode };

        await Lead.findOneAndUpdate(
          searchCriteria,
          {
            $set: {
              userId: superAdmin._id,
              name: user.name,
              email: user.email || '',
              phone: user.phone || user.usercode || '',
              company: leadOrg,
              tags: ['platform_signup', user.workStatus, user.industryType, isTestSignup ? 'test_data' : 'real_production_user'],
              status: 'new_lead',
              propertyType: `${user.industryType} • ${user.workStatus === 'company_owner' ? 'Organization Account' : 'Individual Sales Rep'}`,
              budget: 'Not Decided',
              followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hr follow-up
              source: 'signup',
              isTestData: isTestSignup,
              'customData.interestedPlan': 'Not Decided',
              'customData.leadSource': 'signup',
              'customData.industryType': user.industryType,
              'customData.workStatus': user.workStatus,
              'customData.usercode': user.usercode,
            },
            $push: {
              leadActivities: {
                action: 'lead_created',
                performedBy: superAdmin._id,
                performerName: 'SuperAdmin Capture Engine',
                details: `New platform signup: ${user.name} (${user.usercode}) • Industry: ${user.industryType} • Mode: ${user.workStatus} • ${isTestSignup ? '[Test Account]' : '[Real Production User]'}`,
                timestamp: new Date(),
              }
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await Notification.create({
          userId: superAdmin._id,
          title: isTestSignup ? '🧪 New Test Signup' : '🎉 New Real Platform Signup',
          message: `${user.name} (${user.usercode}) signed up in ${user.industryType} industry as a ${user.workStatus === 'company_owner' ? 'Company Owner' : 'Solo Agent'}.`,
          type: 'platform_signup',
        });
      }
    } catch (captureErr) {
      console.warn('[SuperAdmin Engine] Lead capture hook notice:', captureErr.message);
    }

    const token = generateToken(user._id);

    // Record Immutable Audit Log
    auditService.record({
      actor: user,
      organizationId: user.companyId,
      action: 'CREATE',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: user.name,
      after: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        workStatus: user.workStatus,
        industryType: user.industryType,
      },
      req,
      metadata: { workStatus: user.workStatus, industryType: user.industryType },
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      usercode: user.usercode,
      role: user.role || 'user',
      industryType: user.industryType,
      educationSubProfile: user.educationSubProfile || null,
      workStatus: user.workStatus,
      companyRole: user.companyRole,
      twoFactorEnabled: user.twoFactorEnabled,
      customPipelineStages: user.customPipelineStages || [],
      leadFormSchema: user.leadFormSchema || [],
      plan: user.plan,
      isAdmin: user.isAdmin,
      token,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'account';
      return res.status(400).json({
        message: `This ${field === 'phone' ? 'phone number' : field} is already registered.`,
      });
    }
    console.error('Register error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Login (email OR phone OR username) + TOTP Authenticator check
// @route POST /api/auth/login
// @access Public
exports.login = async (req, res) => {
  try {
    const rawIdentifier = req.body.identifier || req.body.email || req.body.phone || req.body.username;
    const { password } = req.body;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ message: 'Identifier (email/phone/username) and password are required' });
    }

    const cleanInput = String(rawIdentifier).trim();
    const isEmail = cleanInput.includes('@');
    const isDigitsOnly = /^\d+$/.test(cleanInput.replace(/\D/g, '')) && cleanInput.length >= 7;

    let query;
    if (isEmail) {
      query = { email: cleanInput.toLowerCase() };
    } else if (isDigitsOnly) {
      query = { phone: cleanInput.replace(/\D/g, '') };
    } else {
      query = {
        $or: [
          { username: cleanInput.toUpperCase() },
          { usercode: cleanInput.toUpperCase() },
          { email: cleanInput.toLowerCase() }
        ]
      };
    }

    const user = await User.findOne(query);
    if (!user) {
      securityTracker.recordEvent({
        type: 'LOGIN_FAILED',
        req,
        metadata: { reason: 'User not found', identifier: cleanInput },
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      await User.findByIdAndUpdate(user._id, {
        $inc: { loginAttempts: 1 },
        $set: { lastFailedLogin: new Date() }
      });
      securityTracker.recordEvent({
        type: 'LOGIN_FAILED',
        req,
        userId: user._id,
        userEmail: user.email,
        tenantId: user.companyId,
        metadata: { reason: 'Password mismatch' },
        isAdminUser: user.isAdmin,
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Reset login attempts
    await User.findByIdAndUpdate(user._id, {
      $set: { loginAttempts: 0, lastLogin: new Date() }
    });

    // Record Security Login Success
    securityTracker.recordEvent({
      type: 'LOGIN_SUCCESS',
      req,
      userId: user._id,
      userEmail: user.email,
      tenantId: user.companyId,
      isAdminUser: user.isAdmin,
    });

    if (user.isAdmin) {
      securityTracker.recordEvent({
        type: 'ADMIN_ACTION',
        req,
        userId: user._id,
        userEmail: user.email,
        metadata: { action: 'ADMIN_LOGIN' },
        isAdminUser: true,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOTP AUTHENTICATOR APP 2FA CHECK
    // ─────────────────────────────────────────────────────────────
    if (user.twoFactorEnabled && user.twoFactorSecret && String(user.twoFactorSecret).trim().length >= 8) {
      const tempToken = generateTemp2FAToken(user._id);

      return res.json({
        requires2FA: true,
        tempToken,
        method: 'totp',
        message: 'Please enter the 6-digit code from your Google Authenticator or Authy app.',
      });
    }

    // Auto-generate usercode if missing
    if (!user.usercode) {
      const prefix = user.workStatus === 'company_owner' ? 'CMP' : 'REA';
      user.usercode = await generateUniqueUsercode(User, prefix);
      await user.save();
    }

    const token = generateToken(user._id);
    const resolvedRole = user.role || (user.isAdmin ? 'superadmin' : 'user');

    // Record Immutable Audit Log
    auditService.record({
      actor: user,
      organizationId: user.companyId,
      action: 'LOGIN',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: user.name,
      req,
      metadata: { method: 'password', role: resolvedRole },
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      usercode: user.usercode,
      role: resolvedRole,
      isAdmin: user.isAdmin || resolvedRole === 'superadmin',
      industryType: user.industryType || 'Agency',
      educationSubProfile: user.educationSubProfile || null,
      workStatus: user.workStatus,
      companyRole: user.companyRole,
      companyId: user.companyId,
      companyJoinMethod: user.companyJoinMethod,
      companyLeaveRequest: user.companyLeaveRequest,
      twoFactorEnabled: user.twoFactorEnabled || false,
      pipelineStages: user.pipelineStages || user.customPipelineStages || [],
      customPipelineStages: user.customPipelineStages || user.pipelineStages || [],
      leadFormSchema: user.leadFormSchema || [],
      plan: user.plan,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Verify 2FA TOTP code and complete login (Robust Clock Drift & Delta Engine)
// @route POST /api/auth/verify-2fa
// @access Public (with tempToken)
exports.verify2FA = async (req, res) => {
  try {
    const { tempToken, otp, code, recoveryCode } = req.body;
    const rawOtp = otp || code;

    if (!tempToken || (!rawOtp && !recoveryCode)) {
      return res.status(400).json({ message: 'Temporary session token and 6-digit code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Verification session expired. Please log in again.' });
    }

    if (!decoded.pending2FA) {
      return res.status(400).json({ message: 'Invalid 2FA token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.twoFactorSecret) {
      // Fallback: If 2FA was not fully initialized, unlock session
      const token = generateToken(user._id);
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        usercode: user.usercode,
        role: user.role || (user.isAdmin ? 'superadmin' : 'user'),
        isAdmin: user.isAdmin || user.role === 'superadmin',
        token,
      });
    }

    // Normalize Secret & OTP inputs
    const cleanSecret = String(user.twoFactorSecret).replace(/[\s-]+/g, '').toUpperCase();
    const cleanOtp = String(rawOtp || '').replace(/\D/g, '').trim();

    let isVerified = false;

    // 1. Standard Multi-Step Window Check (window: 6 = ±180 seconds clock drift tolerance)
    if (cleanOtp.length === 6) {
      isVerified = speakeasy.totp.verify({
        secret: cleanSecret,
        encoding: 'base32',
        token: cleanOtp,
        window: 6,
      });

      // 2. Delta Step Window Check fallback
      if (!isVerified) {
        const delta = speakeasy.totp.verifyDelta({
          secret: cleanSecret,
          encoding: 'base32',
          token: cleanOtp,
          window: 6,
        });
        if (delta !== null && delta !== undefined) {
          isVerified = true;
        }
      }
    }

    // 3. Emergency Backup Recovery Code check
    if (!isVerified && recoveryCode) {
      const cleanRecovery = String(recoveryCode).replace(/[\s-]+/g, '').toUpperCase();
      if (user.twoFactorRecoveryCodes && user.twoFactorRecoveryCodes.includes(cleanRecovery)) {
        isVerified = true;
        user.twoFactorRecoveryCodes = user.twoFactorRecoveryCodes.filter(c => c !== cleanRecovery);
        await user.save();
      }
    }

    if (!isVerified) {
      securityTracker.recordEvent({
        type: 'OTP_ABUSE',
        req,
        userId: user._id,
        userEmail: user.email,
        tenantId: user.companyId,
        metadata: { reason: 'Invalid 2FA Authenticator code' },
      });
      return res.status(400).json({
        message: 'Invalid 6-digit Authenticator code. Please ensure your device clock is synchronized and try the latest code.',
        code: 'TOTP_MISMATCH',
      });
    }

    const token = generateToken(user._id);
    const resolvedRole = user.role || (user.isAdmin ? 'superadmin' : 'user');

    // Record Immutable Audit Log
    auditService.record({
      actor: user,
      organizationId: user.companyId,
      action: 'LOGIN',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: user.name,
      req,
      metadata: { method: '2fa_totp', role: resolvedRole },
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      usercode: user.usercode,
      role: resolvedRole,
      isAdmin: user.isAdmin || resolvedRole === 'superadmin',
      industryType: user.industryType || 'Agency',
      educationSubProfile: user.educationSubProfile || null,
      workStatus: user.workStatus,
      companyRole: user.companyRole,
      companyId: user.companyId,
      companyJoinMethod: user.companyJoinMethod,
      companyLeaveRequest: user.companyLeaveRequest,
      twoFactorEnabled: true,
      pipelineStages: user.pipelineStages || user.customPipelineStages || [],
      customPipelineStages: user.customPipelineStages || user.pipelineStages || [],
      leadFormSchema: user.leadFormSchema || [],
      plan: user.plan,
      token,
    });
  } catch (error) {
    console.error('verify2FA error:', error);
    res.status(500).json({ message: '2FA verification failed' });
  }
};

// @desc  Setup 2FA - Generates TOTP secret, QR code & Emergency Recovery Codes
// @route POST /api/auth/2fa/setup
// @access Private
exports.setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const crypto = require('crypto');

    // Generate speakeasy secret with clean labels
    const accountLabel = user.email || user.username || user.phone || 'User';
    const secret = speakeasy.generateSecret({
      name: `SalesCRM (${accountLabel})`,
      issuer: 'SalesCRM',
      length: 20,
    });

    // Generate 8 emergency backup recovery codes
    const recoveryCodes = Array.from({ length: 8 }, () => {
      const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
      return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
    });

    user.twoFactorSecret = secret.base32;
    user.twoFactorRecoveryCodes = recoveryCodes.map(c => c.replace(/-/g, ''));
    await user.save();

    // Generate QR Code data URL
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url, {
      margin: 1,
      width: 256,
      color: { dark: '#000000', light: '#ffffff' }
    });

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      qrCodeUrl: qrCodeUrl,
      otpauthUrl: secret.otpauth_url,
      recoveryCodes,
    });
  } catch (error) {
    console.error('setup2FA error:', error);
    res.status(500).json({ message: 'Failed to generate 2FA setup details' });
  }
};

// @desc  Enable 2FA - Verify initial code and lock 2FA to account
// @route POST /api/auth/2fa/enable
// @access Private
exports.enable2FA = async (req, res) => {
  try {
    const rawToken = req.body.token || req.body.otp || req.body.code;
    if (!rawToken) return res.status(400).json({ message: '6-digit Authenticator code required' });

    const user = await User.findById(req.user._id);
    const candidateSecret = req.body.secret || user.twoFactorSecret;
    if (!candidateSecret) {
      return res.status(400).json({ message: 'Please initialize 2FA setup first.' });
    }

    const cleanSecret = String(candidateSecret).replace(/[\s-]+/g, '').toUpperCase();
    const cleanToken = String(rawToken).replace(/\D/g, '').trim();

    let verified = speakeasy.totp.verify({
      secret: cleanSecret,
      encoding: 'base32',
      token: cleanToken,
      window: 6, // Allow +/- 180s clock drift
    });

    if (!verified) {
      const delta = speakeasy.totp.verifyDelta({
        secret: cleanSecret,
        encoding: 'base32',
        token: cleanToken,
        window: 6,
      });
      if (delta !== null && delta !== undefined) verified = true;
    }

    if (!verified) {
      return res.status(400).json({
        message: 'Invalid 6-digit code. Please verify the code on your Authenticator app (ensure phone clock is accurate).',
        code: 'TOTP_MISMATCH'
      });
    }

    user.twoFactorSecret = cleanSecret;
    user.twoFactorEnabled = true;
    await user.save();

    res.json({
      message: 'Two-Factor Authentication (TOTP) successfully activated & locked 🔒',
      twoFactorEnabled: true,
    });
  } catch (error) {
    console.error('enable2FA error:', error);
    res.status(500).json({ message: 'Failed to activate 2FA' });
  }
};

// @desc  Disable 2FA (Requires Password Confirmation)
// @route POST /api/auth/2fa/disable
// @access Private
exports.disable2FA = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password confirmation required to disable 2FA' });

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    res.json({ message: 'Two-Factor Authentication disabled successfully', twoFactorEnabled: false });
  } catch (error) {
    console.error('disable2FA error:', error);
    res.status(500).json({ message: 'Failed to disable 2FA' });
  }
};

// @desc  Emergency Reset 2FA for account with password verification
// @route POST /api/auth/reset-2fa-emergency
// @access Public
exports.reset2FAEmergency = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier (email/phone/username) and password required' });
    }

    const cleanId = String(identifier).trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: cleanId },
        { phone: cleanId },
        { username: cleanId.toUpperCase() },
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorRecoveryCodes = [];
    user.twoFactorOtp = null;
    user.twoFactorOtpExpires = null;
    await user.save();

    const token = generateToken(user._id);
    const resolvedRole = user.role || (user.isAdmin ? 'superadmin' : 'user');

    res.json({
      message: '2FA has been successfully removed from your account. You can now log in directly!',
      twoFactorEnabled: false,
      token,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: resolvedRole,
      isAdmin: user.isAdmin || resolvedRole === 'superadmin',
    });
  } catch (error) {
    console.error('reset2FAEmergency error:', error);
    res.status(500).json({ message: 'Failed to reset 2FA' });
  }
};

// @desc  Update Dynamic Pipeline Stages
// @route PUT /api/auth/pipeline-stages
// @access Private
exports.updatePipelineStages = async (req, res) => {
  try {
    const rawStages = req.body.stages || req.body.pipelineStages || req.body.customPipelineStages || (Array.isArray(req.body) ? req.body : []);
    if (!Array.isArray(rawStages)) {
      return res.status(400).json({ message: 'Stages must be an array of strings' });
    }

    const cleanStages = rawStages.map(s => String(s).trim()).filter(Boolean);
    if (cleanStages.length === 0) {
      return res.status(400).json({ message: 'At least one pipeline stage is required.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { pipelineStages: cleanStages, customPipelineStages: cleanStages },
      { new: true }
    );

    res.json({
      message: 'Pipeline stages saved successfully ✅',
      pipelineStages: user.pipelineStages,
      customPipelineStages: user.customPipelineStages,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save pipeline stages' });
  }
};

// @desc  Update Fully Customizable Form Engine Schema (with Conditional Visibility dependsOn)
// @route PUT /api/auth/form-schema (also aliases PUT /api/auth/custom-fields)
// @access Private
exports.updateFormSchema = async (req, res) => {
  try {
    const rawList = Array.isArray(req.body)
      ? req.body
      : (req.body.schema || req.body.leadFormSchema || req.body.fields || req.body.customLeadFields || []);
    if (!Array.isArray(rawList)) {
      return res.status(400).json({ message: 'Form schema must be an array' });
    }

    const sanitized = rawList.map((f, idx) => {
      const fieldId = (f.fieldId || f.label || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').trim();
      const isSystem = Boolean(f.isSystem);
      const isMandatorySystem = ['name', 'phone'].includes(fieldId);

      const dependsOn = (f.dependsOn && f.dependsOn.field)
        ? { field: String(f.dependsOn.field).trim(), value: String(f.dependsOn.value || '').trim() }
        : { field: null, value: null };

      return {
        fieldId,
        label: (f.label || fieldId).trim(),
        fieldType: ['text', 'email', 'phone', 'dropdown', 'date', 'number'].includes(f.fieldType) ? f.fieldType : 'text',
        options: Array.isArray(f.options) ? f.options.map(o => String(o).trim()).filter(Boolean) : [],
        isRequired: isMandatorySystem ? true : Boolean(f.isRequired),
        isSystem,
        isHidden: isMandatorySystem ? false : Boolean(f.isHidden),
        order: typeof f.order === 'number' ? f.order : (idx + 1),
        dependsOn,
      };
    }).filter(f => f.fieldId && f.label);

    // Ensure mandatory name & phone are present
    const hasName = sanitized.some(f => f.fieldId === 'name');
    const hasPhone = sanitized.some(f => f.fieldId === 'phone');
    if (!hasName || !hasPhone) {
      return res.status(400).json({ message: 'System fields "Name" and "Phone" cannot be removed.' });
    }

    // Sort by order
    sanitized.sort((a, b) => (a.order || 0) - (b.order || 0));

    const updateFields = { leadFormSchema: sanitized };
    if (req.body.showFollowUpOnCreate !== undefined) {
      updateFields.showFollowUpOnCreate = Boolean(req.body.showFollowUpOnCreate);
      updateFields['preferences.showFollowUpOnCreate'] = Boolean(req.body.showFollowUpOnCreate);
    } else if (req.body.preferences?.showFollowUpOnCreate !== undefined) {
      updateFields.showFollowUpOnCreate = Boolean(req.body.preferences.showFollowUpOnCreate);
      updateFields['preferences.showFollowUpOnCreate'] = Boolean(req.body.preferences.showFollowUpOnCreate);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true }
    );

    res.json({
      message: 'Lead form layout saved successfully ✅',
      leadFormSchema: user.leadFormSchema,
      showFollowUpOnCreate: user.showFollowUpOnCreate !== false,
      preferences: user.preferences,
      user,
    });
  } catch (err) {
    console.error('updateFormSchema error:', err);
    res.status(500).json({ message: 'Failed to save form layout' });
  }
};
exports.updateCustomFields = exports.updateFormSchema;

// @desc  Get current logged in user details
// @route GET /api/auth/me
// @access Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -twoFactorOtp -twoFactorOtpExpires -twoFactorSecret')
      .populate('companyId', 'name usercode companyInfo companySettings')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Auto-generate usercode if missing (Skip for SuperAdmin)
    const isSuperAdmin = user.role === 'superadmin' || user.isAdmin;
    if (!user.usercode && !isSuperAdmin) {
      const code = await generateUniqueUsercode(User, user.workStatus === 'company_owner' ? 'CMP' : 'REA');
      await User.findByIdAndUpdate(user._id, { usercode: code });
      user.usercode = code;
    }

    const industryDefaults = getIndustryDefaults(user.industryType, user.educationSubProfile);

    // Auto-initialize pipelineStages if missing or empty
    if (!user.pipelineStages || user.pipelineStages.length === 0) {
      const stages = (user.customPipelineStages && user.customPipelineStages.length > 0)
        ? user.customPipelineStages
        : industryDefaults.pipelineStages;
      await User.findByIdAndUpdate(user._id, { pipelineStages: stages, customPipelineStages: stages });
      user.pipelineStages = stages;
      user.customPipelineStages = stages;
    }

    // Auto-initialize leadFormSchema if missing or empty
    if (!user.leadFormSchema || user.leadFormSchema.length === 0) {
      const defaultSchema = industryDefaults.leadFormSchema;
      if (Array.isArray(user.customLeadFields) && user.customLeadFields.length > 0) {
        let currentMaxOrder = defaultSchema.length;
        user.customLeadFields.forEach(cf => {
          currentMaxOrder++;
          defaultSchema.push({
            fieldId: cf.fieldId || cf.label.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            label: cf.label,
            fieldType: cf.fieldType || 'text',
            options: cf.options || [],
            isRequired: Boolean(cf.isRequired),
            isSystem: false,
            isHidden: false,
            order: currentMaxOrder,
            dependsOn: { field: null, value: null },
          });
        });
      }
      await User.findByIdAndUpdate(user._id, { leadFormSchema: defaultSchema });
      user.leadFormSchema = defaultSchema;
    }

    const { calculateSubscriptionLifecycle } = require('../middleware/auth');
    user.subscriptionLifecycle = await calculateSubscriptionLifecycle(user);
    user.showFollowUpOnCreate = user.showFollowUpOnCreate !== false;
    user.preferences = user.preferences || { showFollowUpOnCreate: user.showFollowUpOnCreate };

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Update Profile Info (WorkStatus, CompanyRole, and IndustryType CANNOT be changed)
// @route PUT /api/auth/profile
// @access Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, profilePicture, avatarIcon, companyInfo, localization, showFollowUpOnCreate, preferences } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name.trim();
    if (phone) user.phone = phone.replace(/\D/g, '');
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (avatarIcon !== undefined) user.avatarIcon = avatarIcon;

    if (showFollowUpOnCreate !== undefined) {
      user.showFollowUpOnCreate = Boolean(showFollowUpOnCreate);
      if (!user.preferences) user.preferences = {};
      user.preferences.showFollowUpOnCreate = Boolean(showFollowUpOnCreate);
    }

    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences,
      };
      if (preferences.showFollowUpOnCreate !== undefined) {
        user.showFollowUpOnCreate = Boolean(preferences.showFollowUpOnCreate);
      }
    }

    if (companyInfo) {
      user.companyInfo = {
        ...user.companyInfo,
        ...companyInfo,
      };
    }

    if (localization) {
      user.localization = {
        currencySymbol: localization.currencySymbol || user.localization?.currencySymbol || '₹',
        currencyCode: localization.currencyCode || user.localization?.currencyCode || 'INR',
        countryPhoneCode: localization.countryPhoneCode ? String(localization.countryPhoneCode).replace(/\D/g, '') : (user.localization?.countryPhoneCode || '91'),
      };
    }

    await user.save();

    // Record Immutable Audit Log
    auditService.record({
      actor: req.user,
      organizationId: req.user.companyId,
      action: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: user.name,
      after: { name: user.name, phone: user.phone },
      req,
      metadata: { updateType: 'profile_settings' },
    });

    res.json({ message: 'Profile updated successfully ✅', user });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to update profile' });
  }
};

// @desc  Change password
// @route PUT /api/auth/change-password
// @access Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    // Record Immutable Audit Log
    auditService.record({
      actor: req.user,
      organizationId: req.user.companyId,
      action: 'PASSWORD_CHANGE',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: user.name,
      req,
      metadata: { target: 'self' },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Apply coupon code
// @route POST /api/auth/apply-coupon
// @access Private
exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });

    if (!coupon.isActive) return res.status(400).json({ message: 'This coupon is no longer active' });
    if (coupon.validUntil && new Date() > new Date(coupon.validUntil)) {
      return res.status(400).json({ message: 'This coupon has expired' });
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ message: 'This coupon has reached its usage limit' });
    }

    const { updateUserPlan } = require('../utils/subscriptionManager');
    const { user, subscriptionLifecycle } = await updateUserPlan(
      req.user._id,
      coupon.planGranted,
      'monthly',
      false,
      {
        durationDays: coupon.durationDays,
        couponCode: coupon.code,
        paymentMethod: 'coupon',
        originalPrice: 0,
        discountedPrice: 0,
      }
    );

    coupon.usedCount = (coupon.usedCount || 0) + 1;
    await coupon.save();

    res.json({
      message: `Coupon applied! You are now on the ${coupon.planGranted.toUpperCase()} plan for ${coupon.durationDays} days.`,
      plan: user.plan,
      planEndDate: user.planEndDate,
      subscriptionLifecycle,
    });
  } catch (error) {
    console.error('applyCoupon error:', error);
    res.status(500).json({ message: error.message || 'Failed to apply coupon' });
  }
};

