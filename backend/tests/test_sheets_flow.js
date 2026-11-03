require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Campaign = require('../src/models/Campaign');
const Integration = require('../src/models/Integration');
const Lead = require('../src/models/Lead');
const LeadSourceSubscription = require('../src/models/LeadSourceSubscription');
const googleSheetsService = require('../src/services/integrations/googleSheetsService');
const googleSheetsPollingService = require('../src/services/integrations/googleSheetsPollingService');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function run() {
  console.log('--- STARTING GOOGLE SHEETS REDESIGN TEST SUITE ---');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const cleanup = {
    userIds: [],
    campaignIds: [],
    integrationIds: [],
    leadIds: [],
  };

  try {
    // 1. Test URL Extraction
    console.log('\n[1] Testing URL extraction:');
    const sampleUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
    const extractedId = googleSheetsService.extractSpreadsheetId(sampleUrl);
    console.log('Extracted ID:', extractedId);
    if (extractedId !== '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms') {
      throw new Error('ID extraction failed');
    }
    console.log('✓ URL extraction verified');

    // 2. Test Mock Inspection & Column Detection
    console.log('\n[2] Testing Mock Inspection:');
    const mockInspect = await googleSheetsService.inspectSpreadsheet({
      spreadsheetId: 'mock_test_sheet_01',
      mockDriver: true,
    });
    console.log('Mock inspect title:', mockInspect.title);
    const mockData = await googleSheetsService.readSheetData({
      spreadsheetId: 'mock_test_sheet_01',
      mockDriver: true,
    });
    console.log('Mock headers:', mockData.headers);
    console.log('Mock rows count:', mockData.totalRowsDetected);
    if (!mockData.headers.includes('Phone') || !mockData.headers.includes('Full Name')) {
      throw new Error('Headers missing Phone or Full Name');
    }
    console.log('✓ Mock column inspection verified');

    // 3. Test Setup of User & Destination Campaign
    console.log('\n[3] Setting up Test User & Destination Campaign:');
    const user = await User.create({
      name: 'Sheets Lead Manager',
      email: `sheets_mgr_${Date.now()}@example.com`,
      password: 'HashedPassword123!',
      role: 'admin',
      companyRole: 'owner',
    });
    cleanup.userIds.push(user._id);

    const campaign = await Campaign.create({
      name: 'MBBS Inbound 2026',
      status: 'active',
      companyId: user._id,
      routingRules: {
        sheetIds: [],
      },
    });
    cleanup.campaignIds.push(campaign._id);
    console.log(`✓ Campaign created: "${campaign.name}" (${campaign._id})`);

    // 4. Test Connecting an Empty Sheet (Should have status = 'awaiting_data')
    console.log('\n[4] Testing Empty Sheet Connection (Status Rule):');
    const emptySheetId = `mock_empty_${Date.now()}`;
    const emptyMockDriver = {
      inspect: () => ({
        success: true,
        spreadsheetId: emptySheetId,
        title: 'New Empty Lead Sheet',
        sheets: [{ sheetId: 0, title: 'Sheet1', rowCount: 100, columnCount: 10 }],
        accessMethod: 'public_csv',
        hasWriteAccess: false,
        isPublic: true,
      }),
      readData: () => ({
        success: true,
        isEmpty: true,
        headers: ['Full Name', 'Phone', 'Email', 'City'],
        sampleRows: [],
        suggestedMappings: [
          { sourceField: 'Full Name', crmField: 'name', displayLabel: 'Full Name' },
          { sourceField: 'Phone', crmField: 'phone', displayLabel: 'Phone' },
          { sourceField: 'Email', crmField: 'email', displayLabel: 'Email' },
          { sourceField: 'City', crmField: 'targetCity', displayLabel: 'City' },
        ],
        totalRowsDetected: 0,
        accessMethod: 'mock',
      }),
    };

    // Simulate controller connectSheet logic
    const integration1 = await Integration.create({
      userId: user._id,
      companyId: user._id,
      provider: 'sheets',
      mode: 'client_managed',
      status: 'awaiting_data', // Initially awaiting data
      accountId: emptySheetId,
      accountName: 'New Empty Lead Sheet',
      sheetsConfig: {
        spreadsheetId: emptySheetId,
        sheetId: emptySheetId,
        tabName: 'Sheet1',
        headerRowIndex: 1,
        syncMode: 'polling',
        accessMethod: 'public_csv',
        hasWriteAccess: false,
        importExistingRows: true,
        totalRowsSynced: 0,
        storedHeaders: ['Full Name', 'Phone', 'Email', 'City'],
        targetCampaignId: campaign._id,
      },
      fieldMapping: [
        { sourceField: 'Full Name', crmField: 'name', isCustom: false, displayLabel: 'Full Name' },
        { sourceField: 'Phone', crmField: 'phone', isCustom: false, displayLabel: 'Phone' },
        { sourceField: 'Email', crmField: 'email', isCustom: false, displayLabel: 'Email' },
        { sourceField: 'City', crmField: 'targetCity', isCustom: false, displayLabel: 'City' },
      ],
      metadata: {
        targetCampaignId: campaign._id,
        targetCampaignName: campaign.name,
      },
    });
    cleanup.integrationIds.push(integration1._id);

    // Link campaign
    await Campaign.updateOne(
      { _id: campaign._id },
      { $addToSet: { 'routingRules.sheetIds': String(emptySheetId) } }
    );
    await LeadSourceSubscription.create({
      companyId: user._id,
      integrationId: integration1._id,

      userId: user._id,
      provider: 'sheets',
      externalFormId: emptySheetId,
      sourceName: `Google Sheets - ${integration1.accountName}`,
      isActive: true,
      campaignGroupId: campaign._id,
    });

    // Run sync on empty sheet
    const syncRes1 = await googleSheetsPollingService.syncIntegration(integration1._id, { mockDriver: emptyMockDriver });
    console.log('Sync result on empty sheet:', syncRes1);
    
    // Check status remains awaiting_data
    const check1 = await Integration.findById(integration1._id);
    console.log('Status after sync on empty sheet:', check1.status);
    if (check1.status !== 'awaiting_data') {
      throw new Error(`Expected status to be 'awaiting_data', got '${check1.status}'`);
    }
    console.log('✓ Status correctly preserved as "awaiting_data" when sheet has 0 data rows');

    // 5. Test Adding Data Rows & Upgrading to 'connected'
    console.log('\n[5] Testing Sync when User Adds Data Rows:');
    const populatedMockDriver = {
      readData: () => ({
        success: true,
        isEmpty: false,
        headers: ['Full Name', 'Phone', 'Email', 'City'],
        sampleRows: [
          { 'Full Name': 'Kavita Krishnan', Phone: '+919988776655', Email: 'kavita@test.com', City: 'Chennai' },
        ],
        suggestedMappings: [
          { sourceField: 'Full Name', crmField: 'name', displayLabel: 'Full Name' },
          { sourceField: 'Phone', crmField: 'phone', displayLabel: 'Phone' },
          { sourceField: 'Email', crmField: 'email', displayLabel: 'Email' },
          { sourceField: 'City', crmField: 'targetCity', displayLabel: 'City' },
        ],
        totalRowsDetected: 1,
        accessMethod: 'mock',
      }),
    };

    const syncRes2 = await googleSheetsPollingService.syncIntegration(integration1._id, { mockDriver: populatedMockDriver });
    console.log('Sync result after data added:', syncRes2);
    if (syncRes2.rowsSynced !== 1) {
      throw new Error(`Expected 1 row synced, got ${syncRes2.rowsSynced}`);
    }

    const check2 = await Integration.findById(integration1._id);
    console.log('Status after leads synced:', check2.status);
    if (check2.status !== 'connected') {
      throw new Error(`Expected status to upgrade to 'connected', got '${check2.status}'`);
    }
    console.log('✓ Status automatically upgraded to "connected" once lead was synced!');

    // Verify lead was ingested into the campaign
    const lead = await Lead.findOne({ email: 'kavita@test.com' });
    if (!lead) {
      throw new Error('Lead not found in database');
    }
    cleanup.leadIds.push(lead._id);
    console.log(`✓ Ingested lead: "${lead.name}", campaign: "${lead.campaignName || lead.campaignId}"`);

    // Verify campaign routing rules
    const updatedCampaign = await Campaign.findById(campaign._id);
    console.log('Campaign routing sheet IDs:', updatedCampaign.routingRules?.sheetIds);
    if (!updatedCampaign.routingRules?.sheetIds?.includes(emptySheetId)) {
      throw new Error('Sheet ID missing from campaign routing rules');
    }
    console.log('✓ Campaign successfully routed to this Google Sheet');

    console.log('\n================================================================');
    console.log('🎉 ALL BACKEND GOOGLE SHEETS WORKFLOW TESTS PASSED!');
    console.log('================================================================');
  } finally {
    // Cleanup
    if (cleanup.leadIds.length) await Lead.deleteMany({ _id: { $in: cleanup.leadIds } });
    if (cleanup.integrationIds.length) {
      await Integration.deleteMany({ _id: { $in: cleanup.integrationIds } });
      await LeadSourceSubscription.deleteMany({ integrationId: { $in: cleanup.integrationIds } });
    }
    if (cleanup.campaignIds.length) await Campaign.deleteMany({ _id: { $in: cleanup.campaignIds } });
    if (cleanup.userIds.length) await User.deleteMany({ _id: { $in: cleanup.userIds } });
    await mongoose.disconnect();
    console.log('Database cleaned up & disconnected');
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
