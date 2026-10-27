const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Payment = require('../models/Payment');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentRequest = require('../models/PaymentRequest');
const Subscription = require('../models/Subscription');
const Entitlement = require('../models/Entitlement');
const Transaction = require('../models/Transaction');
const Template = require('../models/Template');
const ActivityLog = require('../models/ActivityLog');
const AuditLog = require('../models/AuditLog');
const AbuseLog = require('../models/AbuseLog');
const Notification = require('../models/Notification');
const Campaign = require('../models/Campaign');
const CampaignLog = require('../models/CampaignLog');
const Group = require('../models/Group');
const ChatMessage = require('../models/ChatMessage');
const Recording = require('../models/Recording');
const Integration = require('../models/Integration');
const WhatsAppAuth = require('../models/WhatsAppAuth');
const WAFingerprint = require('../models/WAFingerprint');
const TenantCatalogue = require('../models/TenantCatalogue');

const connectDB = require('../config/db');

async function cleanSlateWipe() {
  console.log('🧹 [CLEAN SLATE] Connecting to active database...');
  await connectDB();
  console.log('Connected to database:', mongoose.connection.name);

  // 1. Delete all non-admin users
  const userDeleteResult = await User.deleteMany({
    email: { $ne: 'admin@crm.com' },
    role: { $ne: 'superadmin' },
    isAdmin: { $ne: true }
  });
  console.log(`✓ Deleted ${userDeleteResult.deletedCount} tenant/test user accounts.`);

  // 2. Wipe all leads, follow-ups, payments, activities
  const [
    leadsRes,
    followUpsRes,
    payRes,
    payAttRes,
    payReqRes,
    subRes,
    entRes,
    txRes,
    incRes,
    tplRes,
    actRes,
    audRes,
    abuRes,
    notRes,
    cmpRes,
    cmplRes,
    grpRes,
    chatRes,
    recRes,
    intRes,
    waRes,
    wafRes,
    catRes
  ] = await Promise.all([
    Lead.deleteMany({}),
    FollowUp.deleteMany({}),
    Payment.deleteMany({}),
    PaymentAttempt.deleteMany({}),
    PaymentRequest.deleteMany({}),
    Subscription.deleteMany({}),
    Entitlement.deleteMany({}),
    Transaction.deleteMany({}),
    Template.deleteMany({}),
    ActivityLog.deleteMany({}),
    AuditLog.deleteMany({}),
    AbuseLog.deleteMany({}),
    Notification.deleteMany({}),
    Campaign.deleteMany({}),
    CampaignLog.deleteMany({}),
    Group.deleteMany({}),
    ChatMessage.deleteMany({}),
    Recording.deleteMany({}),
    Integration.deleteMany({}),
    WhatsAppAuth.deleteMany({}),
    WAFingerprint.deleteMany({}),
    TenantCatalogue.deleteMany({}),
  ]);

  console.log(`✓ Deleted ${leadsRes.deletedCount} leads.`);
  console.log(`✓ Deleted ${followUpsRes.deletedCount} follow-ups & alarms.`);
  console.log(`✓ Deleted ${payRes.deletedCount} payments.`);
  console.log(`✓ Deleted ${actRes.deletedCount} activity logs.`);

  // 3. Ensure SuperAdmin exists and is 100% clean & ready
  let superAdmin = await User.findOne({
    $or: [
      { email: 'admin@crm.com' },
      { role: 'superadmin' },
      { isAdmin: true },
      { username: 'ADMIN77' },
      { username: 'SUPERADMIN' }
    ]
  });

  if (!superAdmin) {
    superAdmin = new User({
      name: 'Super Admin',
      email: 'admin@crm.com',
      phone: '9999999999',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      username: 'ADMIN77',
      usercode: 'ADM-000001',
      role: 'superadmin',
      isAdmin: true,
      workStatus: 'company_owner',
      companyRole: 'owner',
      plan: 'pro',
      industryType: 'Education',
      educationSubProfile: 'admission_consultants',
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
      twoFactorOtp: null,
      twoFactorOtpExpires: null,
      isActive: true,
      companyInfo: {
        companyName: 'Universal Educational Consultancies Command',
      },
    });
    await superAdmin.save();
    console.log('✓ Created fresh Super Admin account (email: admin@crm.com, username: ADMIN77, pass: Admin@123)');
  } else {
    superAdmin.name = 'Super Admin';
    superAdmin.email = 'admin@crm.com';
    superAdmin.phone = '9999999999';
    superAdmin.password = process.env.ADMIN_PASSWORD || 'Admin@123';
    superAdmin.username = 'ADMIN77';
    superAdmin.usercode = 'ADM-000001';
    superAdmin.role = 'superadmin';
    superAdmin.isAdmin = true;
    superAdmin.workStatus = 'company_owner';
    superAdmin.companyRole = 'owner';
    superAdmin.companyId = null;
    superAdmin.plan = 'pro';
    superAdmin.industryType = 'Education';
    superAdmin.educationSubProfile = 'admission_consultants';
    superAdmin.twoFactorEnabled = false;
    superAdmin.twoFactorSecret = null;
    superAdmin.twoFactorRecoveryCodes = [];
    superAdmin.twoFactorOtp = null;
    superAdmin.twoFactorOtpExpires = null;
    superAdmin.isActive = true;
    superAdmin.companyInfo = {
      companyName: 'Universal Educational Consultancies Command',
    };
    await superAdmin.save();
    console.log('✓ Reset Super Admin account to pristine clean state (2FA disabled, ready to login).');
  }

  // 4. Verify Final State
  const finalUserCount = await User.countDocuments();
  const finalLeadCount = await Lead.countDocuments();
  const finalFollowUpCount = await FollowUp.countDocuments();

  console.log('\n========================================================');
  console.log('🎉 DATABASE CLEAN SLATE COMPLETED SUCCESSFULLY!');
  console.log(`- Remaining Users: ${finalUserCount} (SuperAdmin Only)`);
  console.log(`- Remaining Leads: ${finalLeadCount}`);
  console.log(`- Remaining Follow-Ups: ${finalFollowUpCount}`);
  console.log(`- SuperAdmin Login Email: ${superAdmin.email}`);
  console.log(`- SuperAdmin Username: ${superAdmin.username}`);
  console.log('========================================================\n');

  process.exit(0);
}

cleanSlateWipe().catch((err) => {
  console.error('❌ Clean slate wipe error:', err);
  process.exit(1);
});
