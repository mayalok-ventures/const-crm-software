const http = require('http');

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTest() {
  console.log('=== STARTING END-TO-END GOOGLE SHEETS INGESTION TEST ===\n');

  // 1. Login as Admin
  console.log('1. Logging in as admin...');
  const loginRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'admin@yourapp.com', password: 'Admin@123' }
  );

  if (loginRes.status !== 200 || !loginRes.body.token) {
    console.error('Login failed:', loginRes);
    process.exit(1);
  }
  const token = loginRes.body.token;
  console.log('Logged in successfully! User:', loginRes.body.user?.email);

  // 2. Create Google Sheets Integration
  console.log('\n2. Creating new Google Sheets integration...');
  const createRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/integrations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      provider: 'sheets',
      accountName: 'MBBS 2026 Admissions Sheet',
      defaultCampaignLabel: 'NEET Counseling 2026',
      sheetsConfig: {
        sheetName: 'Inbound Candidates',
      },
      assignmentRule: {
        type: 'round_robin',
        counselorPool: loginRes.body.user?._id
          ? [{ userId: loginRes.body.user._id, weight: 1 }]
          : [],
      },
    }
  );

  console.log('Create Integration Status:', createRes.status);
  const integration = createRes.body.integration;
  const plaintextSecret = createRes.body.plaintextSecretOnce;

  console.log('Integration ID:', integration._id);
  console.log('Integration Provider:', integration.provider);
  console.log('Integration Name:', integration.accountName);
  console.log('Plaintext Secret Received:', plaintextSecret ? `${plaintextSecret.substring(0, 10)}...` : 'NONE');

  if (!plaintextSecret) {
    console.error('Failed to get plaintext secret key');
    process.exit(1);
  }

  // 3. Post a simulated row from Apps Script
  console.log('\n3. Simulating Google Apps Script row submission...');
  const testPayload = {
    leadId: require('crypto').randomUUID(),
    row: 105,
    data: {
      'Full Name': 'Siddharth Malhotra',
      'Phone': '+919876500001',
      'Email': 'siddharth.m@example.com',
      'City': 'Mumbai',
      'Course / Interest': 'MBBS International',
      'Campaign': 'NEET Abroad 2026',
      'Notes': 'Interested in Georgia Medical University. Budget 30 Lakhs.'
    }
  };

  const webhookRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/integrations/sheets/webhook/${integration._id}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-crm-secret': plaintextSecret,
      },
    },
    testPayload
  );

  console.log('Webhook Response Status:', webhookRes.status);
  console.log('Webhook Response Body:', webhookRes.body);

  // 3b. Simulating row with missing phone and email (Edge case 6: NEEDS_REVIEW)
  console.log('\n3b. Simulating row with missing phone and email (Edge case 6)...');
  const needsReviewRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/integrations/sheets/webhook/${integration._id}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-crm-secret': plaintextSecret,
      },
    },
    {
      leadId: require('crypto').randomUUID(),
      row: 106,
      data: {
        'Full Name': 'Nameless Candidate',
        'Phone': '',
        'Email': '',
        'City': 'Kolkata',
        'Course / Interest': 'Aviation Management'
      }
    }
  );

  console.log('Needs Review Response Status:', needsReviewRes.status);
  console.log('Needs Review Response Body:', needsReviewRes.body);

  // 4. Wait 2.5 seconds for worker queue processing
  console.log('\n4. Waiting 2.5 seconds for durable queue worker to process lead...');
  await new Promise((r) => setTimeout(r, 2500));

  // 5. Query the lead from CRM
  console.log('5. Querying lead from /api/leads...');
  const leadRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/leads?search=Siddharth',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const matchingLead = (leadRes.body?.leads || []).find((l) => l.phone.includes('9876500001'));
  if (matchingLead) {
    console.log('\n✅ SUCCESS: Lead was created in CRM!');
    console.log('Lead ID:', matchingLead._id);
    console.log('Lead Name:', matchingLead.name);
    console.log('Lead Phone:', matchingLead.phone);
    console.log('Lead Status:', matchingLead.status);
    console.log('Normalized Lead Source:', JSON.stringify(matchingLead.leadSource, null, 2));
    console.log('Assignment Reason:', matchingLead.assignmentReason);
    console.log('Assigned To Counselor:', matchingLead.assignedTo);
    console.log('Custom Data (Unmapped columns preserved):', JSON.stringify(matchingLead.customData, null, 2));
  } else {
    console.error('Lead not found in /api/leads. Recent leads:', leadRes.body);
  }

  // 6. Check Per-Sheet Status Screen endpoint
  console.log('\n6. Checking Per-Sheet Status metrics (/api/integrations/:id/sheets-status)...');
  const statusRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/integrations/${integration._id}/sheets-status`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('Sheet Status Metrics:', JSON.stringify(statusRes.body?.status, null, 2));

  // 7. Check Inbound Campaign Registry
  console.log('\n7. Checking Inbound Campaign Registry (/api/campaigns/inbound)...');
  const campRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/campaigns/inbound?platform=sheets',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const registeredCamp = (campRes.body?.campaigns || []).find((c) => c.campaignName === 'NEET Abroad 2026');
  if (registeredCamp) {
    console.log('✅ Inbound Campaign Auto-Created in Registry!');
    console.log('Campaign Record:', JSON.stringify(registeredCamp, null, 2));
  } else {
    console.log('Campaign list:', campRes.body?.campaigns?.slice(0, 3));
  }

  console.log('\n=== TEST RUN COMPLETED SUCCESSFULLY ===');
}

runTest().catch(console.error);
