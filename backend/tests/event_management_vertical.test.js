const mongoose = require('mongoose');
const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Project = require('../src/models/Project');
const TenantConfig = require('../src/models/TenantConfig');
const Notification = require('../src/models/Notification');
const {
  handleStallInventoryLock,
  handleEventPassGeneration,
} = require('../src/services/automationHandlers');
const { emitCRMEvent, CRM_EVENTS } = require('../src/services/automationEvents');

async function runEventManagementVerticalTests() {
  console.log('🧪 Starting Event Management & Exhibitions Vertical Test Suite...\n');
  await connectDB();

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error('     Error:', err.message);
      failed++;
    }
  };

  // 1. Tenant Workspace Seeding for Event Management
  await test('Event Management: Workspace Seeding & Dual Pipelines', async () => {
    const testUser = await User.create({
      name: 'Apex Expo International',
      email: `expo_${Date.now()}@eventscrm.com`,
      phone: `9300${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      industryType: 'Event Management',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });

    const config = await TenantConfig.seedWorkspace(testUser._id, 'Event Management', null, testUser.companyId);
    assert(config, 'TenantConfig should be created');
    assert.strictEqual(config.industryType, 'Event Management');
    assert.deepStrictEqual(config.pipelineStages, [
      'Lead Captured',
      'Floor Plan Shared',
      'Stall Blocked',
      'Quotation Sent',
      'Advance Paid',
      'Onboarded',
    ]);
    assert(config.dualPipelines?.stallBooking, 'Should have stallBooking pipeline');
    assert(config.dualPipelines?.corporateSponsorship, 'Should have corporateSponsorship pipeline');
    assert(config.customFields.some(f => f.fieldId === 'companyName'), 'Should have companyName field');
    assert(config.customFields.some(f => f.fieldId === 'exhibitorIndustry'), 'Should have exhibitorIndustry field');
    assert(config.customFields.some(f => f.fieldId === 'stallSizeSqm'), 'Should have stallSizeSqm field');
    assert(config.customFields.some(f => f.fieldId === 'stallCategoryPreference'), 'Should have stallCategoryPreference field');
    assert(config.customFields.some(f => f.fieldId === 'pastParticipation'), 'Should have pastParticipation field');
    assert(config.customFields.some(f => f.fieldId === 'visitorType'), 'Should have visitorType field');
    assert(config.customFields.some(f => f.fieldId === 'purposeOfVisit'), 'Should have purposeOfVisit field');
    assert.strictEqual(config.automationSettings.stallInventoryLockEnabled, true);
    assert.strictEqual(config.automationSettings.eventPassGenerationEnabled, true);
  });

  // 2. Default Event Product Catalog Seeding (Stalls, Sponsorships, Add-ons)
  await test('Event Management: Product Catalog Auto-Seeding (Stalls & Sponsorships)', async () => {
    const organizer = await User.create({
      name: 'Global Trade Fairs Ltd',
      email: `trade_${Date.now()}@eventscrm.com`,
      phone: `9301${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      industryType: 'Event Management',
    });

    await TenantConfig.seedWorkspace(organizer._id, 'Event Management');

    const seededProducts = await Project.find({ userId: organizer._id });
    assert(seededProducts.length >= 6, `Should seed at least 6 event products (Found: ${seededProducts.length})`);
    assert(seededProducts.some(p => p.name.includes('Shell Scheme')), 'Should include Shell Scheme stall');
    assert(seededProducts.some(p => p.name.includes('Raw Space')), 'Should include Raw Space bare plot');
    assert(seededProducts.some(p => p.name.includes('Title Sponsor')), 'Should include Title Sponsor package');
    assert(seededProducts.some(p => p.name.includes('Gold Sponsor')), 'Should include Gold Sponsor package');
    assert(seededProducts.some(p => p.name.includes('Furniture') || p.name.includes('Electrical')), 'Should include Add-on rentals');
  });

  // 3. Floor Plan Inventory Lock on "Stall Blocked"
  await test('Event Management: Floor Plan Inventory Lock on "Stall Blocked"', async () => {
    const organizer = await User.create({
      name: 'Summit Organizers',
      email: `summit_${Date.now()}@eventscrm.com`,
      phone: `9302${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
    });

    const lead = await Lead.create({
      userId: organizer._id,
      name: 'TechCorp Exhibitor Rep',
      phone: `9303${Date.now().toString().slice(-6)}`,
      status: 'Floor Plan Shared',
      customData: {
        companyName: 'TechCorp Global Solutions',
        stallSizeSqm: '18 sqm (6x3 Medium)',
        stallCategoryPreference: 'Premium Corner (2-Side Open)',
      },
    });

    const lockResult = await handleStallInventoryLock({
      leadId: lead._id,
      tenantUserId: organizer._id,
    });

    assert(lockResult, 'Lock result should exist');
    assert.strictEqual(lockResult.isLocked, true);
    assert(lockResult.lockCode.startsWith('STALL-'), 'Lock code should start with STALL-');
    assert.strictEqual(lockResult.stallSize, '18 sqm (6x3 Medium)');

    const updatedLead = await Lead.findById(lead._id);
    assert.strictEqual(updatedLead.customData.stallInventoryLock.isLocked, true);

    const notification = await Notification.findOne({ leadId: lead._id, type: 'stall_locked' });
    assert(notification, 'Notification of stall lock should be generated');
  });

  // 4. Digital Entry Pass & QR Generation on "Onboarded"
  await test('Event Management: Digital Entry Pass & WhatsApp Trigger on "Onboarded"', async () => {
    const organizer = await User.create({
      name: 'Expo Director',
      email: `director_${Date.now()}@eventscrm.com`,
      phone: `9304${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
    });

    const lead = await Lead.create({
      userId: organizer._id,
      name: 'Vikram Mehta (VP Marketing)',
      phone: `9305${Date.now().toString().slice(-6)}`,
      status: 'Advance Paid',
      customData: {
        companyName: 'Mehta Heavy Industries',
        visitorType: 'Trade Buyer / VIP',
      },
    });

    const passResult = await handleEventPassGeneration({
      leadId: lead._id,
      tenantUserId: organizer._id,
    });

    assert(passResult, 'Pass result should exist');
    assert(passResult.passCode.startsWith('PASS-'), 'Pass code should start with PASS-');
    assert.strictEqual(passResult.status, 'active');
    assert.strictEqual(passResult.accessLevel, 'Trade Buyer / VIP');

    const updatedLead = await Lead.findById(lead._id);
    assert.strictEqual(updatedLead.customData.eventPass.status, 'active');

    const notification = await Notification.findOne({ leadId: lead._id, type: 'event_pass' });
    assert(notification, 'Notification of event pass should be generated');
  });

  console.log(`\n========================================================`);
  console.log(`🏁 EVENT MANAGEMENT VERTICAL TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================================\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runEventManagementVerticalTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
