/**
 * Automated Verification Test Suite: Tenant User Lead Workflow (Phases 1, 2, 3)
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:5000';

const runTenantWorkflowTests = async () => {
  console.log('\n🧪 ========================================================');
  console.log('   TENANT USER LEAD WORKFLOW: PHASES 1, 2 & 3 TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, extra = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${extra}`);
      failed++;
    }
  };

  try {
    const uniqueId = Math.floor(10000000 + Math.random() * 90000000);
    const tenantEmail = `tenant_${uniqueId}@crm.com`;
    const tenantPassword = 'Password@123';

    // 1. Sign up a new Tenant User (Agency)
    const registerRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Apex Growth Agency',
      email: tenantEmail,
      phone: `9198${uniqueId.toString().slice(0, 8)}`,
      password: tenantPassword,
      industryType: 'Agency',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });

    const tenantToken = registerRes.data.token;
    const tenantApi = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    assert(!!tenantToken, 'Phase 1 Setup: Tenant Registered and Authenticated');

    // ── PHASE 1: FORM EDITING & FOLLOW-UP TOGGLE ──

    // 2. Edit & Save Custom Form Schema via Profile
    const customSchema = [
      { fieldId: 'name', label: 'Client Full Name', fieldType: 'text', isRequired: true, isSystem: true, isHidden: false, order: 1 },
      { fieldId: 'phone', label: 'Direct WhatsApp Phone', fieldType: 'phone', isRequired: true, isSystem: true, isHidden: false, order: 2 },
      { fieldId: 'budget', label: 'Expected Monthly Spend', fieldType: 'number', isRequired: false, isSystem: true, isHidden: false, order: 3 },
      {
        fieldId: 'marketing_service',
        label: 'Selected Marketing Solution',
        fieldType: 'dropdown',
        options: ['Performance Ads', 'Social Media Branding', 'Full Funnel Automation'],
        isRequired: false,
        isSystem: false,
        isHidden: false,
        order: 4,
      },
    ];

    const formSchemaRes = await tenantApi.put('/api/auth/form-schema', { schema: customSchema });
    assert(
      formSchemaRes.status === 200 && Array.isArray(formSchemaRes.data.leadFormSchema) && formSchemaRes.data.leadFormSchema.length === 4,
      'Phase 1.1: Custom Lead Form Layout saved via /api/auth/form-schema'
    );

    // 3. Verify /api/auth/me returns the updated custom form schema
    const meRes = await tenantApi.get('/api/auth/me');
    assert(
      meRes.data.leadFormSchema?.length === 4 && meRes.data.leadFormSchema[3].fieldId === 'marketing_service',
      'Phase 1.2: Profile (/api/auth/me) correctly returns saved custom form schema'
    );

    // 4. Toggle Follow-Up on Lead Creation to OFF
    const toggleRes = await tenantApi.put('/api/auth/profile', {
      showFollowUpOnCreate: false,
      preferences: { showFollowUpOnCreate: false }
    });
    assert(
      toggleRes.status === 200 && toggleRes.data.user?.showFollowUpOnCreate === false,
      'Phase 1.3: User Preference "showFollowUpOnCreate: false" successfully toggled and persisted'
    );

    // 5. Create Lead WITHOUT followUpDate (since follow-up is toggled OFF)
    const lead1Res = await tenantApi.post('/api/leads', {
      name: 'Rohan Sharma',
      phone: `9197${uniqueId.toString().slice(0, 8)}`,
      budget: '45000',
      customData: { marketing_service: 'Performance Ads' },
    });
    const lead1 = lead1Res.data;
    assert(
      lead1?._id && !lead1.followUpDate,
      'Phase 1.4: Lead created seamlessly without follow-up date when toggle is OFF'
    );

    // ── PHASE 2 & 3: CUSTOM PIPELINE & STRICT FOLLOW-UP ENGINE ──

    // 6. Define Custom Pipeline Stages for Tenant
    const customStages = ['Fresh Lead', 'Call Done', 'Demo Scheduled', 'Won Deal'];
    const stagesRes = await tenantApi.put('/api/auth/pipeline-stages', { stages: customStages });
    assert(
      stagesRes.status === 200 && stagesRes.data.pipelineStages?.length === 4,
      'Phase 3.1: Custom Pipeline Stages ["Fresh Lead", "Call Done", "Demo Scheduled", "Won Deal"] saved'
    );

    // 7. Create Lead 2 -> Initial Stage auto-set to 1st stage ("Fresh Lead")
    const lead2Res = await tenantApi.post('/api/leads', {
      name: 'Kavita Mehta',
      phone: `9196${uniqueId.toString().slice(0, 8)}`,
      company: 'Mehta Textiles',
    });
    const lead2 = lead2Res.data;
    assert(
      lead2?.status === 'Fresh Lead',
      'Phase 3.2: New Lead automatically initialized in the 1st custom stage ("Fresh Lead")'
    );

    // 8. Enforce Mandatory Note to Complete / Log Follow-Up (Empty Note Strictly Rejected)
    try {
      await tenantApi.post(`/api/leads/${lead2._id}/notes`, { text: '   ' });
      assert(false, 'Phase 2.1: Empty note should be strictly rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Phase 2.1: Empty note strictly rejected with HTTP 400');
    }

    // 9. Add Contact Action Note -> Auto-Transitions Lead to 2nd stage ("Call Done")
    const noteRes = await tenantApi.post(`/api/leads/${lead2._id}/notes`, {
      text: 'Discovery call completed. Client requested portfolio presentation on Wednesday.',
    });
    const updatedLead2 = noteRes.data;
    assert(
      updatedLead2?.status === 'Call Done',
      'Phase 3.3: Adding Note auto-transitions lead from 1st stage ("Fresh Lead") to 2nd stage ("Call Done")'
    );

    // 10. Verify Activity Timeline logging with timestamp
    const latestActivity = updatedLead2.leadActivities?.[updatedLead2.leadActivities.length - 1];
    assert(
      latestActivity && latestActivity.action === 'note_added' && latestActivity.timestamp,
      'Phase 2.2: Note saved with exact timestamp and audit details in lead.leadActivities'
    );

    // 11. Test Manual Stage Update to 3rd Custom Stage ("Demo Scheduled")
    const updateStageRes = await tenantApi.put(`/api/leads/${lead2._id}`, {
      status: 'Demo Scheduled',
    });
    assert(
      updateStageRes.status === 200 && updateStageRes.data?.status === 'Demo Scheduled',
      'Phase 3.4: Manual pipeline stage transition to "Demo Scheduled" persists accurately'
    );

  } catch (error) {
    console.error('Tenant Workflow Test Error:', error.response?.data || error.message);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`🏁 TENANT WORKFLOW RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
};

runTenantWorkflowTests();
