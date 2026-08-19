/**
 * End-to-End Acceptance Test Suite: Complete Follow-Up & Alarm Workflow
 * Tests: Auto-Tagging, Quick Scheduling, Enforced Max 2 Delays,
 * Mandatory Outcome Notes to Stop Alarm, and Next-Day Cycle Resets.
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:5000';

const runFollowUpTests = async () => {
  console.log('\n⏰ ========================================================');
  console.log('   ACCEPTANCE SUITE: FOLLOW-UP WORKFLOW & ALARM ENGINE');
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
    // 1. SuperAdmin Login
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: 'admin@crm.com',
      password: 'Admin@123'
    });
    const token = loginRes.data.token;
    assert(!!token, 'Step 1: Admin authenticates');

    const authAxios = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${token}` }
    });

    const uniqueNum = Math.floor(10000000 + Math.random() * 90000000);

    // 2. Test Auto-Tagging on Manual Lead Creation
    const createLeadRes = await authAxios.post('/api/leads', {
      name: 'Rohan Sharma',
      phone: `98${uniqueNum}`,
      email: `rohan_${uniqueNum}@example.com`,
      budget: '₹5,00,000',
      service_required: 'smart_solo',
    });
    const lead = createLeadRes.data;
    assert(lead && lead._id, 'Step 2a: Manual lead created successfully');
    assert(Array.isArray(lead.tags) && lead.tags.includes('Manual Entry'), 'Step 2b: Manual lead automatically tagged with "Manual Entry"');

    const leadId = lead._id;

    // 3. Test Schedule Follow-Up: Validation of Mandatory Note & Date
    try {
      await authAxios.post(`/api/leads/${leadId}/follow-up`, {
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        note: '', // empty note should fail
      });
      assert(false, 'Step 3a: Empty agenda note rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Step 3a: Empty agenda note rejected with HTTP 400');
    }

    try {
      await authAxios.post(`/api/leads/${leadId}/follow-up`, {
        note: 'Valid Note', // missing date should fail
      });
      assert(false, 'Step 3b: Missing scheduled date rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Step 3b: Missing scheduled date rejected with HTTP 400');
    }

    const scheduledDate = new Date(Date.now() + 3600000).toISOString();
    const scheduleRes = await authAxios.post(`/api/leads/${leadId}/follow-up`, {
      scheduledAt: scheduledDate,
      note: 'Discuss enterprise quota and SLA documents',
    });
    assert(scheduleRes.status === 201, 'Step 3c: Follow-up scheduled successfully with 201 Created');
    assert(scheduleRes.data.lead?.followUpStatus === 'scheduled', 'Step 3d: Lead followUpStatus set to "scheduled"');
    assert(scheduleRes.data.lead?.activeFollowUp?.delayCount === 0, 'Step 3e: Initial delayCount is 0');

    // 4. Test Delay / Snooze Logic (Strict 2 Delays Limit Enforcement)
    // 4a. Out of bounds (< 5m or > 60m)
    try {
      await authAxios.post(`/api/leads/${leadId}/follow-up/delay`, { delayMinutes: 2 });
      assert(false, 'Step 4a: Delay < 5 mins rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Step 4a: Delay < 5 mins rejected with HTTP 400');
    }

    try {
      await authAxios.post(`/api/leads/${leadId}/follow-up/delay`, { delayMinutes: 120 });
      assert(false, 'Step 4b: Delay > 60 mins rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Step 4b: Delay > 60 mins rejected with HTTP 400');
    }

    // 4c. 1st Delay (+15 mins)
    const delay1Res = await authAxios.post(`/api/leads/${leadId}/follow-up/delay`, {
      delayMinutes: 15,
      reason: 'Client in a meeting',
    });
    assert(delay1Res.status === 200, 'Step 4c: 1st delay (+15m) applied successfully');
    assert(delay1Res.data.delayCount === 1 && delay1Res.data.remainingDelays === 1, 'Step 4d: delayCount is 1, remainingDelays is 1');

    // 4e. 2nd Delay (+30 mins)
    const delay2Res = await authAxios.post(`/api/leads/${leadId}/follow-up/delay`, {
      delayMinutes: 30,
      reason: 'Client requested callback after lunch',
    });
    assert(delay2Res.status === 200, 'Step 4e: 2nd delay (+30m) applied successfully');
    assert(delay2Res.data.delayCount === 2 && delay2Res.data.remainingDelays === 0, 'Step 4f: delayCount is 2, remainingDelays is 0');

    // 4g. 3rd Delay MUST BE STRICTLY REJECTED with HTTP 400 MAX_DELAYS_REACHED
    try {
      await authAxios.post(`/api/leads/${leadId}/follow-up/delay`, {
        delayMinutes: 10,
        reason: 'Another delay attempt',
      });
      assert(false, 'Step 4g: 3rd delay rejected');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.code === 'MAX_DELAYS_REACHED', 'Step 4g: 3rd delay rejected with MAX_DELAYS_REACHED');
    }

    // 5. Test Complete Follow-Up with Mandatory Outcome Note
    try {
      await authAxios.post(`/api/leads/${leadId}/follow-up/complete`, { outcomeNote: '' });
      assert(false, 'Step 5a: Empty outcome note rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Step 5a: Empty outcome note rejected with HTTP 400');
    }

    const completeRes = await authAxios.post(`/api/leads/${leadId}/follow-up/complete`, {
      outcomeNote: 'Spoke with Rohan. Discussed SLA terms. Agreed on 15% discount for annual contract.',
    });
    assert(completeRes.status === 200, 'Step 5b: Follow-up completed with mandatory note');
    assert(completeRes.data.lead?.followUpDate === null, 'Step 5c: followUpDate cleared to stop alarm permanently');
    assert(completeRes.data.lead?.followUpStatus === 'completed', 'Step 5d: followUpStatus marked completed');
    assert(completeRes.data.lead?.notes.some(n => n.text.includes('Spoke with Rohan')), 'Step 5e: Outcome note recorded in Lead notes timeline');

    // 6. Test Next-Day Follow-Up Rescheduling
    const tomorrowDate = new Date(Date.now() + 24 * 3600000).toISOString();
    // Schedule a follow-up, delay it once, then complete while scheduling tomorrow
    await authAxios.post(`/api/leads/${leadId}/follow-up`, {
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      note: 'Send proposal draft',
    });
    await authAxios.post(`/api/leads/${leadId}/follow-up/delay`, { delayMinutes: 10 });

    const nextDayCompleteRes = await authAxios.post(`/api/leads/${leadId}/follow-up/complete`, {
      outcomeNote: 'Proposal sent via WhatsApp.',
      nextFollowUp: {
        scheduledAt: tomorrowDate,
        note: 'Follow up on proposal acceptance',
      },
    });

    assert(nextDayCompleteRes.status === 200, 'Step 6a: Completed and scheduled next-day follow-up');
    assert(nextDayCompleteRes.data.lead?.followUpStatus === 'scheduled', 'Step 6b: New followUpStatus is "scheduled"');
    assert(nextDayCompleteRes.data.lead?.activeFollowUp?.delayCount === 0, 'Step 6c: Delay count reset to 0 for the fresh cycle');
    assert(nextDayCompleteRes.data.lead?.followUpNote === 'Follow up on proposal acceptance', 'Step 6d: Next agenda note correctly preserved');

    // 7. Test Due Follow-Ups Query
    const overdueDate = new Date(Date.now() - 60000).toISOString(); // 1 min in past
    await authAxios.post(`/api/leads/${leadId}/follow-up`, {
      scheduledAt: overdueDate,
      note: 'Urgent Overdue Alarm Trigger',
    });

    const dueRes = await authAxios.get('/api/leads/follow-ups/due');
    assert(dueRes.status === 200, 'Step 7a: Fetched due follow-ups');
    assert(Array.isArray(dueRes.data) && dueRes.data.some(l => String(l._id) === String(leadId)), 'Step 7b: Overdue prospect returned in due query for alarm engine');

  } catch (err) {
    console.error('Fatal test error:', err.response?.data || err.message);
    failed++;
  }

  console.log('\n--------------------------------------------------------');
  console.log(`📊 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('--------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runFollowUpTests();
