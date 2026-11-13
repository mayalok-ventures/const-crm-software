require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Integration = require('../src/models/Integration');
const Lead = require('../src/models/Lead');
const leadIngestionService = require('../src/services/integrations/leadIngestionService');

async function restoreMetaLeads() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const integration = await Integration.findById('6ae98c704e1943d50379a2ec').select('+accessTokenEncrypted');
  if (!integration) {
    console.error('Integration not found!');
    return;
  }

  const token = integration.accessToken;
  if (!token) {
    console.error('Failed to decrypt integration token!');
    return;
  }

  const formId = '2551911435214341';
  console.log(`Fetching all leads for form ${formId} from Meta Graph API...`);
  const res = await axios.get(`https://graph.facebook.com/v21.0/${formId}/leads`, {
    params: {
      fields: 'id,created_time,field_data,ad_id,form_id,campaign_id,adset_id',
      limit: 100,
      access_token: token
    }
  });

  const rawLeads = res.data?.data || [];
  console.log(`Retrieved ${rawLeads.length} leads from Meta.`);

  let createdCount = 0;
  let updatedCount = 0;

  // Process in chronological order (oldest first so newest is latest)
  const sortedLeads = rawLeads.sort((a, b) => new Date(a.created_time) - new Date(b.created_time));

  for (const rawLead of sortedLeads) {
    const fieldsMap = {};
    const rawAnswers = [];
    for (const field of rawLead.field_data || []) {
      const rawKey = String(field.name || '').trim();
      const val = field.values?.[0] || '';
      fieldsMap[rawKey.toLowerCase()] = val;
      rawAnswers.push({ question: rawKey, answer: val });
    }

    const name = fieldsMap.full_name || fieldsMap.name || (fieldsMap.first_name ? `${fieldsMap.first_name} ${fieldsMap.last_name || ''}`.trim() : '') || fieldsMap.firstname || '';
    const phone = fieldsMap.phone_number || fieldsMap.phone || fieldsMap.mobile || fieldsMap.mobile_number || '';
    const email = fieldsMap.email || fieldsMap['e-mail'] || fieldsMap['email address'] || '';

    try {
      const ingestResult = await leadIngestionService.ingest({
        provider: 'meta',
        integrationId: integration._id,
        externalLeadId: String(rawLead.id),
        accountId: integration.accountId,
        pageId: integration.pageId,
        formId: String(rawLead.form_id || formId),
        formName: 'Meta Ads Lead Form',
        campaignId: String(rawLead.campaign_id || ''),
        campaignName: 'Meta Inbound Campaign',
        adSetId: String(rawLead.adset_id || ''),
        adId: String(rawLead.ad_id || ''),
        name,
        phone,
        email,
        customData: fieldsMap,
        rawAnswers,
        createdAt: new Date(rawLead.created_time),
      });

      if (ingestResult?.created) createdCount++;
      else updatedCount++;

      console.log(`Ingested: ${name} (${phone}) -> ID: ${ingestResult?.lead?._id}`);
    } catch (ingestErr) {
      console.error(`Failed to ingest lead ${rawLead.id} (${name}):`, ingestErr.message);
    }
  }

  // Restore stages known from user activity logs
  console.log('\nApplying verified activity log stages...');
  await Lead.updateOne({ phone: { $regex: /7420931930/ } }, { $set: { status: 'contacted' } });
  await Lead.updateOne({ phone: { $regex: /9259891232/ } }, { $set: { status: 'lost' } });
  await Lead.updateOne({ phone: { $regex: /9825147720/ } }, { $set: { status: 'new_lead' } });

  const totalLeads = await Lead.countDocuments({
    $or: [{ userId: integration.userId }, { companyId: integration.companyId }]
  });
  console.log(`\nRestore complete! Total leads now in demo account: ${totalLeads} (Created: ${createdCount}, Updated: ${updatedCount})`);

  // Show table of restored leads
  const restoredLeads = await Lead.find({
    $or: [{ userId: integration.userId }, { companyId: integration.companyId }]
  }).select('name phone email status createdAt').sort({ createdAt: -1 });

  console.table(restoredLeads.map(l => ({
    id: l._id.toString(),
    name: l.name,
    phone: l.phone,
    email: l.email,
    status: l.status,
    createdAt: l.createdAt?.toISOString()
  })));

  await mongoose.disconnect();
}

restoreMetaLeads().catch(console.error);
