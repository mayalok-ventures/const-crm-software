const axios = require('axios');

const PAGE_ID = '115625685642707';
const GRAPH_VERSION = 'v23.0';
const PAGE_ACCESS_TOKEN = process.argv[2] || process.env.PAGE_ACCESS_TOKEN;

if (!PAGE_ACCESS_TOKEN) {
  console.error('\n❌ Error: Missing Page Access Token.');
  console.error('Usage: node meta_audit.js <PAGE_ACCESS_TOKEN>\n');
  process.exit(1);
}

async function runAudit() {
  console.log('\n======================================================');
  console.log('       META GRAPH API DIAGNOSTIC AUDIT REPORT         ');
  console.log('======================================================');
  console.log(`Target Page ID : ${PAGE_ID}`);
  console.log(`Graph Version  : ${GRAPH_VERSION}\n`);

  // 1. Endpoint 1: Verify Webhook Subscription
  console.log('🔍 [ENDPOINT 1] Checking Subscribed Apps on Page...');
  try {
    const subRes = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}/subscribed_apps`,
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
        timeout: 10000,
        validateStatus: () => true,
      }
    );
    console.log('HTTP Status:', subRes.status);
    console.log('Response Body:', JSON.stringify(subRes.data, null, 2));

    const apps = subRes.data?.data || [];
    const leadgenSubscribed = apps.some(
      (app) => app.subscribed_fields && app.subscribed_fields.includes('leadgen')
    );

    if (leadgenSubscribed) {
      console.log('✅ Status: App is ACTIVELY subscribed to "leadgen" webhooks for this page.');
    } else {
      console.log('❌ Status: App is NOT subscribed to "leadgen" webhooks on this page.');
    }
  } catch (err) {
    console.error('❌ Request Error on Endpoint 1:', err.message);
  }

  console.log('\n------------------------------------------------------\n');

  // 2. Endpoint 2: Verify Token Permissions
  console.log('🔍 [ENDPOINT 2] Checking Granted Permissions for Token...');
  try {
    const permRes = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/permissions`,
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
        timeout: 10000,
        validateStatus: () => true,
      }
    );
    console.log('HTTP Status:', permRes.status);
    console.log('Response Body:', JSON.stringify(permRes.data, null, 2));

    const perms = permRes.data?.data || [];
    const granted = perms
      .filter((p) => p.status === 'granted')
      .map((p) => p.permission);

    console.log('\nGranted Permissions List:', granted);

    const required = [
      'leads_retrieval',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
    ];

    console.log('\nScope Evaluation:');
    required.forEach((scope) => {
      const ok = granted.includes(scope);
      console.log(`  - ${scope.padEnd(25)}: ${ok ? '✅ GRANTED' : '❌ MISSING'}`);
    });
  } catch (err) {
    console.error('❌ Request Error on Endpoint 2:', err.message);
  }

  console.log('\n======================================================\n');
}

runAudit();
