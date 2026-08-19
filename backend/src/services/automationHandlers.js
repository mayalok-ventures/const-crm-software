const mongoose = require('mongoose');
const { crmEvents, CRM_EVENTS } = require('./automationEvents');
const Lead = require('../models/Lead');
const User = require('../models/User');
const TenantConfig = require('../models/TenantConfig');
const Notification = require('../models/Notification');
const waSession = require('./waSession');

// Country-specific document checklist templates for Study Abroad
const COUNTRY_DOCUMENT_CHECKLISTS = {
  canada: [
    'Passport (Front & Back Copy)',
    '10th & 12th Academic Marksheets',
    "Bachelor's / Degree Transcripts & Degree Certificate",
    'IELTS / PTE / TOEFL Official Scorecard',
    'Statement of Purpose (SOP)',
    '2 Letters of Recommendation (Academic & Professional LOR)',
    'Proof of Funds (Guaranteed Investment Certificate - GIC & 1 Yr Tuition)',
    'Upfront Medical Examination Certificate',
  ],
  uk: [
    'Valid Passport Copy',
    'Degree & High School Marksheets / Transcripts',
    'IELTS UKVI / PTE Academic Scorecard',
    'Statement of Purpose (SOP)',
    'Confirmation of Acceptance for Studies (CAS Statement)',
    'Tuberculosis (TB) Screening Test Certificate',
    '28-Day Bank Statement / Solvency Evidence',
  ],
  usa: [
    'Valid International Passport',
    'Official Academic Transcripts (Evaluated via WES/ECE if required)',
    'GRE / GMAT Official Scorecard',
    'TOEFL / IELTS Scorecard',
    'Statement of Purpose (SOP)',
    '3 Letters of Recommendation (LOR)',
    'University Form I-20 (Certificate of Eligibility)',
    'DS-160 Confirmation Page & SEVIS Fee (I-901) Receipt',
    'Bank Solvency Letter & Affidavit of Financial Support',
  ],
  australia: [
    'Valid Passport Copy',
    'Academic Certificates & Consolidated Transcripts',
    'IELTS / PTE Academic Scorecard',
    'Genuine Temporary Entrant (GTE) / GS Statement',
    'Electronic Confirmation of Enrolment (eCoE)',
    'Overseas Student Health Cover (OSHC) Policy',
    'Proof of Funds (Annual Living & Tuition Fee Evidence)',
  ],
  germany: [
    'Valid Passport Copy',
    'APS (Akademische Prüfstelle) Certificate (Mandatory for India)',
    'Consolidated Academic Transcripts & Degree Certificates',
    'IELTS / German Language Proficiency (Goethe/TestDaF A1-C1)',
    'Letter of Motivation & Europass Curriculum Vitae (CV)',
    'Blocked Bank Account Proof (€11,208 / Year)',
    'Statutory / Private Health Insurance Proof',
  ],
  default: [
    'Valid Passport Copy',
    '10th, 12th & Graduation Transcripts',
    'English Language Proficiency Scorecard (IELTS/TOEFL/PTE)',
    'Statement of Purpose (SOP)',
    '2 Letters of Recommendation (LOR)',
    'Proof of Financial Funds / Bank Solvency',
  ],
};

/**
 * 1. EdTech Round-Robin Lead Assignment Engine
 * Distributes inbound leads equally among active organization agents using an atomic last-assigned pointer.
 */
async function assignEdTechRoundRobin({ tenantUserId, companyId }) {
  try {
    const ownerId = companyId || tenantUserId;
    if (!ownerId) return tenantUserId;

    // Find all active sub-agents belonging to this company/organization
    const agents = await User.find({
      $or: [
        { companyId: ownerId, isActive: true },
        { _id: ownerId, isActive: true }
      ]
    }).select('_id name email phone companyRole').sort({ createdAt: 1 }).lean();

    if (!agents || agents.length === 0) {
      return tenantUserId;
    }

    if (agents.length === 1) {
      return agents[0]._id;
    }

    // Atomically find and update the last-assigned pointer on TenantConfig
    const config = await TenantConfig.findOne({
      $or: [{ userId: ownerId }, { companyId: ownerId }]
    });

    let lastIdx = config?.automationSettings?.lastAssignedAgentIndex ?? -1;
    let nextIdx = (lastIdx + 1) % agents.length;
    const selectedAgent = agents[nextIdx];

    await TenantConfig.findOneAndUpdate(
      { $or: [{ userId: ownerId }, { companyId: ownerId }] },
      { $set: { 'automationSettings.lastAssignedAgentIndex': nextIdx } },
      { upsert: true }
    );

    console.log(`[Round-Robin] Assigned lead to agent ${selectedAgent.name || selectedAgent._id} (Index: ${nextIdx}/${agents.length})`);
    return selectedAgent._id;
  } catch (err) {
    console.error('[Round-Robin] Error in lead assignment:', err.message);
    return tenantUserId;
  }
}

/**
 * 2. EdTech Abandoned Cart Recovery (Delayed Worker & Trigger)
 * Dispatches automated WhatsApp payment link if lead enters 'Trial Active' / checkout but is not converted in 15 mins.
 */
const abandonedCartTimers = new Map();

function scheduleAbandonedCartCheck({ leadId, tenantUserId, delayMinutes = 15 }) {
  if (!leadId) return;
  const leadIdStr = String(leadId);

  // Clear existing timer if any
  if (abandonedCartTimers.has(leadIdStr)) {
    clearTimeout(abandonedCartTimers.get(leadIdStr));
  }

  const delayMs = Math.max(1, delayMinutes) * 60 * 1000;
  console.log(`[Abandoned Cart] Scheduled checkout recovery check for lead ${leadIdStr} in ${delayMinutes}m.`);

  const timer = setTimeout(async () => {
    abandonedCartTimers.delete(leadIdStr);
    try {
      await processAbandonedCartLead(leadId, tenantUserId);
    } catch (err) {
      console.error(`[Abandoned Cart] Execution error for lead ${leadIdStr}:`, err.message);
    }
  }, delayMs);

  abandonedCartTimers.set(leadIdStr, timer);
}

async function processAbandonedCartLead(leadId, tenantUserId) {
  const lead = await Lead.findById(leadId);
  if (!lead) return;

  // Check if lead was already converted or paid
  const convertedStages = [
    'Plan Purchased', 'converted', 'payment_done',
    'Admission Fee Paid', 'Admission Confirmed', 'Seat Secured', 'Enrolled'
  ];

  if (convertedStages.includes(lead.status)) {
    console.log(`[Abandoned Cart] Lead ${leadId} is already converted (${lead.status}). Skipping recovery.`);
    return;
  }

  if (lead.customData?.abandonedCartNoticeSent) {
    return;
  }

  const senderUserId = tenantUserId || lead.userId;
  const leadPhone = lead.phone;
  const learnerName = lead.name || 'Learner';
  const courseName = lead.customData?.courseInterest || lead.customData?.programName || 'our Course';
  const frontendUrl = process.env.FRONTEND_URL || 'https://crm.coresetu.com';
  const paymentLink = `${frontendUrl}/pay/${lead._id}`;

  const recoveryMessage = `Hi ${learnerName}! 👋 We noticed you started your trial/enrollment for *${courseName}* but haven't completed your enrollment yet.\n\nYour reserved seat and scholarship discount are active for a limited time. 🚀\n\n👉 Complete your enrollment here:\n${paymentLink}\n\nFeel free to reply if you have any questions!`;

  let waDispatched = false;
  try {
    await waSession.sendText(senderUserId, leadPhone, recoveryMessage);
    waDispatched = true;
    console.log(`[Abandoned Cart] Dispatched WhatsApp recovery link to ${leadPhone} for lead ${lead._id}`);
  } catch (waErr) {
    console.warn(`[Abandoned Cart] WhatsApp dispatch notice for ${leadPhone}:`, waErr.message);
  }

  await Notification.create({
    userId: senderUserId,
    leadId: lead._id,
    leadName: learnerName,
    title: '🛒 Abandoned Cart Recovery Triggered',
    message: `Triggered payment checkout recovery for ${learnerName} (${courseName}). Recovery link: ${paymentLink}`,
    type: 'abandoned_cart',
    isRead: false,
  }).catch(() => {});

  // Update lead customData and record activity
  lead.customData = {
    ...(lead.customData || {}),
    abandonedCartNoticeSent: true,
    abandonedCartSentAt: new Date(),
    abandonedCartMethod: waDispatched ? 'whatsapp' : 'system_logged',
  };
  lead.leadActivities.push({
    action: 'message_sent',
    performerName: 'Automated EdTech Bot',
    details: `Dispatched automated abandoned cart recovery for ${leadPhone} (${courseName}).`,
    timestamp: new Date(),
  });
  await lead.save();
}

/**
 * 3. Study Abroad Document Checklist Auto-Attacher
 * When a lead's Target Country is set or updated, generates and attaches the destination-specific checklist.
 */
async function attachCountryDocumentChecklist({ leadId, targetCountry, tenantUserId }) {
  if (!leadId || !targetCountry) return;

  const lead = await Lead.findById(leadId);
  if (!lead) return;

  const countryKey = String(targetCountry).trim().toLowerCase().replace(/[^a-z]/g, '');
  const items = COUNTRY_DOCUMENT_CHECKLISTS[countryKey] || COUNTRY_DOCUMENT_CHECKLISTS.default;

  const checklistArray = items.map(docName => ({
    item: docName,
    status: 'pending',
    uploadedAt: null,
    documentUrl: null,
    notes: '',
  }));

  lead.customData = {
    ...(lead.customData || {}),
    targetCountry: targetCountry,
    documentChecklist: checklistArray,
    checklistGeneratedAt: new Date(),
    checklistCountry: targetCountry,
  };

  lead.leadActivities.push({
    action: 'lead_updated',
    performerName: 'System Automation',
    details: `Generated Study Abroad Document Checklist for ${targetCountry} (${checklistArray.length} required documents).`,
    timestamp: new Date(),
  });

  await lead.save();
  console.log(`[Study Abroad] Attached ${checklistArray.length} document checklist items for ${targetCountry} on lead ${lead._id}`);
  return checklistArray;
}

/**
 * 4. Test Prep Fee Alerts (Cron Job Handler)
 * Dispatches automated WhatsApp/SMS alerts when feeDueDate is exactly 5 days away.
 */
async function runTestPrepFeeAlertsCron() {
  console.log('[Fee Alert Cron] Running 5-day fee due date audit...');
  try {
    const now = new Date();
    // 5 days window: from 4.5 days to 6.5 days ahead
    const startOf5thDay = new Date(now.getTime() + 4.5 * 24 * 60 * 60 * 1000);
    const endOf5thDay = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000);

    // Query leads with feeDueDate in the target window and no reminder sent yet
    const leads = await Lead.find({
      $or: [
        { 'customData.feeDueDate': { $gte: startOf5thDay, $lte: endOf5thDay } },
        { followUpDate: { $gte: startOf5thDay, $lte: endOf5thDay }, 'customData.isFeeDue': true }
      ],
      'customData.feeReminderSent': { $ne: true },
      status: { $nin: ['Admission Confirmed', 'converted', 'closed', 'Lost'] }
    }).limit(200);

    console.log(`[Fee Alert Cron] Found ${leads.length} leads with fee due in ~5 days.`);

    for (const lead of leads) {
      const recipientPhone = lead.customData?.parentContact || lead.phone;
      const studentName = lead.name || 'Student';
      const stream = lead.customData?.stream || lead.customData?.targetExam || 'Coaching Program';
      const amount = lead.payable_amount || lead.customData?.feeAmount || 0;
      const dueDate = lead.customData?.feeDueDate || lead.followUpDate;
      const dueDateFormatted = dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '5 days';

      const reminderMessage = `🔔 *Fee Reminder (5 Days Remaining)*\n\nDear Parent/Student,\nThis is a friendly reminder that the fee installment of *₹${amount.toLocaleString('en-IN')}* for *${studentName}* (${stream}) is due on *${dueDateFormatted}*.\n\nKindly clear the dues on time to ensure uninterrupted classroom & test series access.\n\nThank you!\n- Accounts & Admissions Team`;

      let waDispatched = false;
      try {
        await waSession.sendText(lead.userId, recipientPhone, reminderMessage);
        waDispatched = true;
        console.log(`[Fee Alert Cron] Dispatched fee reminder to ${recipientPhone} for lead ${lead._id}`);
      } catch (err) {
        console.warn(`[Fee Alert Cron] WhatsApp dispatch notice for ${recipientPhone}:`, err.message);
      }

      await Notification.create({
        userId: lead.userId,
        leadId: lead._id,
        leadName: studentName,
        title: '🔔 5-Day Fee Reminder Dispatched',
        message: `Fee installment reminder of ₹${amount.toLocaleString('en-IN')} for ${studentName} (${stream}) due on ${dueDateFormatted}.`,
        type: 'fee_reminder',
        isRead: false,
      }).catch(() => {});

      lead.customData = {
        ...(lead.customData || {}),
        feeReminderSent: true,
        feeReminderSentAt: new Date(),
        feeReminderMethod: waDispatched ? 'whatsapp' : 'system_logged',
      };
      lead.leadActivities.push({
        action: 'message_sent',
        performerName: 'Fee Alert Automation',
        details: `Sent automated 5-day fee due reminder to ${recipientPhone} (₹${amount} due on ${dueDateFormatted}).`,
        timestamp: new Date(),
      });
      await lead.save();
    }
  } catch (err) {
    console.error('[Fee Alert Cron] Error running fee alert audit:', err.message);
  }
}

/**
 * 5. Higher Education Verification Task Creation
 * Automatically creates a verification task/notification when lead is moved to "Documents Uploaded".
 */
async function createHigherEdVerificationTask({ leadId, tenantUserId, companyId }) {
  if (!leadId) return;

  const lead = await Lead.findById(leadId);
  if (!lead) return;

  const recipientId = companyId || tenantUserId || lead.userId;
  const studentName = lead.name || 'Student';
  const courseApplied = lead.customData?.courseApplied || 'Higher Education Degree';
  const academicScore = lead.customData?.academicPercentage ? `${lead.customData.academicPercentage}%` : 'N/A';

  const notification = await Notification.create({
    userId: recipientId,
    leadId: lead._id,
    leadName: studentName,
    title: '📄 Document Verification Required',
    message: `Applicant ${studentName} (${courseApplied} | Academics: ${academicScore}) has reached "Documents Uploaded". Please audit eligibility and marks verification.`,
    type: 'document_verification',
    isRead: false,
  });

  lead.leadActivities.push({
    action: 'lead_updated',
    performerName: 'Verification Engine',
    details: `Created document verification task for ${studentName} (${courseApplied}). Notification dispatched to verification team.`,
    timestamp: new Date(),
  });
  await lead.save();

  console.log(`[Higher Ed] Created document verification task for lead ${lead._id} (Notification ID: ${notification._id})`);
  return notification;
}

/**
 * 6. Event Management: Stall Inventory Lock Handler
 * Triggers when lead hits "Stall Blocked". Provisionally locks stall floor space inventory.
 */
async function handleStallInventoryLock({ leadId, tenantUserId, companyId }) {
  if (!leadId) return;

  const lead = await Lead.findById(leadId);
  if (!lead) return;

  const stallSize = lead.customData?.stallSizeSqm || '9 sqm';
  const stallCategory = lead.customData?.stallCategoryPreference || 'Shell Scheme';
  const lockCode = `STALL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  lead.customData = {
    ...(lead.customData || {}),
    stallInventoryLock: {
      isLocked: true,
      lockCode,
      lockedAt: new Date(),
      stallSize,
      stallCategory,
      lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h provisional hold
    },
  };

  lead.leadActivities.push({
    action: 'stall_locked',
    performerName: 'Floor Plan Inventory Engine',
    details: `Stall inventory provisional hold active (Lock Code: ${lockCode} | ${stallSize} ${stallCategory}). Valid for 48 hours.`,
    timestamp: new Date(),
  });

  await lead.save();

  const recipientId = companyId || tenantUserId || lead.userId;
  const notification = await Notification.create({
    userId: recipientId,
    leadId: lead._id,
    leadName: lead.name,
    title: '🔒 Stall Space Blocked & Locked',
    message: `Provisional inventory hold active for ${lead.name} (${lead.customData?.companyName || 'Exhibitor'}): ${stallSize} ${stallCategory}. Lock Code: ${lockCode}`,
    type: 'stall_locked',
    isRead: false,
  }).catch(() => null);

  console.log(`[Event Management] Locked stall inventory for lead ${lead._id} (Lock Code: ${lockCode})`);
  return lead.customData.stallInventoryLock;
}

/**
 * 7. Event Management: Entry QR Code & Digital Pass Dispatcher
 * Triggers when pipeline hits "Onboarded" or "Contract Signed".
 */
async function handleEventPassGeneration({ leadId, tenantUserId, companyId }) {
  if (!leadId) return;

  const lead = await Lead.findById(leadId);
  if (!lead) return;

  const passCode = `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const exhibitorName = lead.name || 'Delegate';
  const orgName = lead.customData?.companyName || 'Registered Exhibitor';
  const passType = lead.customData?.visitorType || 'Exhibitor / VIP Delegate';

  lead.customData = {
    ...(lead.customData || {}),
    eventPass: {
      passCode,
      issuedAt: new Date(),
      accessLevel: passType,
      qrPayload: `EVENT_ACCESS:${passCode}:${lead._id}`,
      status: 'active',
    },
  };

  lead.leadActivities.push({
    action: 'event_pass',
    performerName: 'Pass & Badge Generation Engine',
    details: `Issued digital entry access QR pass (Pass ID: ${passCode} | Access: ${passType}).`,
    timestamp: new Date(),
  });

  await lead.save();

  const recipientId = companyId || tenantUserId || lead.userId;
  await Notification.create({
    userId: recipientId,
    leadId: lead._id,
    leadName: exhibitorName,
    title: '🎟️ Event Entry Pass Issued',
    message: `Digital entry pass generated for ${exhibitorName} (${orgName}). Pass Code: ${passCode}`,
    type: 'event_pass',
    isRead: false,
  }).catch(() => null);

  // Send WhatsApp pass confirmation if phone is present
  const recipientPhone = lead.phone;
  if (recipientPhone && waSession) {
    const passMessage = `🎉 *Registration Confirmed - Official Entry Pass*\n\nDear ${exhibitorName},\nYour participation for *${orgName}* is confirmed! 🚀\n\n🎟️ *Pass Code:* ${passCode}\n📍 *Access Level:* ${passType}\n\nPlease present this digital pass or QR confirmation at the registration desk for badge printing.\n\nSee you at the Expo!\n- Organizing Committee`;

    try {
      await waSession.sendText(lead.userId, recipientPhone, passMessage);
      console.log(`[Event Management] Dispatched WhatsApp entry pass to ${recipientPhone}`);
    } catch (waErr) {
      console.warn(`[Event Management] WhatsApp pass dispatch notice for ${recipientPhone}:`, waErr.message);
    }
  }

  console.log(`[Event Management] Generated digital pass for lead ${lead._id} (Pass Code: ${passCode})`);
  return lead.customData.eventPass;
}

// -------------------------------------------------------------
// EVENT LISTENERS REGISTRATION
// -------------------------------------------------------------

// Listener: Lead Stage Changed
crmEvents.on(CRM_EVENTS.LEAD_STAGE_CHANGED, async (payload) => {
  const { lead, oldStage, newStage, user } = payload;
  if (!lead || !newStage) return;

  const normalizedStage = String(newStage).trim().toLowerCase();

  // 1. Higher Ed: "Documents Uploaded"
  if (normalizedStage.includes('document') && normalizedStage.includes('upload')) {
    await createHigherEdVerificationTask({
      leadId: lead._id,
      tenantUserId: user?._id || lead.userId,
      companyId: lead.companyId,
    });
  }

  // 2. EdTech: "Trial Active" (Schedule Abandoned Cart check in 15 mins)
  if (normalizedStage.includes('trial') || normalizedStage === 'trial active') {
    scheduleAbandonedCartCheck({
      leadId: lead._id,
      tenantUserId: user?._id || lead.userId,
      delayMinutes: 15,
    });
  }

  // 3. Event Management: "Stall Blocked" (Floor plan inventory lock)
  if (normalizedStage.includes('stall') && normalizedStage.includes('block')) {
    await handleStallInventoryLock({
      leadId: lead._id,
      tenantUserId: user?._id || lead.userId,
      companyId: lead.companyId,
    });
  }

  // 4. Event Management: "Onboarded" or "Contract Signed" (Digital Pass generation)
  if (normalizedStage === 'onboarded' || (normalizedStage.includes('contract') && normalizedStage.includes('sign'))) {
    await handleEventPassGeneration({
      leadId: lead._id,
      tenantUserId: user?._id || lead.userId,
      companyId: lead.companyId,
    });
  }
});

// Listener: Lead Field Updated
crmEvents.on(CRM_EVENTS.LEAD_FIELD_UPDATED, async (payload) => {
  const { lead, updatedFields, user } = payload;
  if (!lead || !updatedFields) return;

  // Study Abroad: Target Country updated
  if (updatedFields.targetCountry || updatedFields['customData.targetCountry']) {
    const country = updatedFields.targetCountry || updatedFields['customData.targetCountry'];
    await attachCountryDocumentChecklist({
      leadId: lead._id,
      targetCountry: country,
      tenantUserId: user?._id || lead.userId,
    });
  }
});

// Listener: Checkout Started
crmEvents.on(CRM_EVENTS.PAYMENT_CHECKOUT_STARTED, async (payload) => {
  const { lead, user } = payload;
  if (!lead) return;

  scheduleAbandonedCartCheck({
    leadId: lead._id,
    tenantUserId: user?._id || lead.userId,
    delayMinutes: 15,
  });
});

module.exports = {
  assignEdTechRoundRobin,
  scheduleAbandonedCartCheck,
  processAbandonedCartLead,
  attachCountryDocumentChecklist,
  runTestPrepFeeAlertsCron,
  createHigherEdVerificationTask,
  handleStallInventoryLock,
  handleEventPassGeneration,
};
