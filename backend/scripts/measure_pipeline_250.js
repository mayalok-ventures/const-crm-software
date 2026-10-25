const mongoose = require('mongoose');

async function measure() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mobile-crm');
  require('../src/models/User');
  require('../src/models/Workspace');
  const Lead = require('../src/models/Lead');

  const zlib = require('zlib');
  const leads = await Lead.find()
    .select('-leadActivities -editHistory -customWebhookPayloads -notes -details -rawPayload')
    .populate('assignedTo', 'name usercode email')
    .sort({ updatedAt: -1 })
    .limit(250)
    .lean();

  const total = await Lead.countDocuments();
  const payload = { leads, total, pagination: { total, page: 1, limit: 250 } };
  const jsonStr = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');
  const sizeKb = (sizeBytes / 1024).toFixed(2);
  const gzipBytes = zlib.gzipSync(jsonStr).length;
  const gzipKb = (gzipBytes / 1024).toFixed(2);

  // Measure JSON.parse on client
  const parseTimes = [];
  for (let i = 0; i < 100; i++) {
    const t0 = process.hrtime.bigint();
    JSON.parse(jsonStr);
    parseTimes.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const avgParseMs = (parseTimes.reduce((a, b) => a + b) / parseTimes.length).toFixed(3);
  const p95ParseMs = parseTimes.sort((a, b) => a - b)[Math.floor(parseTimes.length * 0.95)].toFixed(3);

  console.log(`[MEASUREMENT A9.d] 250 Leads Payload:`);
  console.log(`- Count: ${leads.length} leads`);
  console.log(`- Raw JSON Size: ${sizeKb} KB (${sizeBytes} bytes)`);
  console.log(`- Gzip Compressed Wire Size: ${gzipKb} KB (${gzipBytes} bytes)`);
  console.log(`- Avg JSON.parse time: ${avgParseMs} ms`);
  console.log(`- p95 JSON.parse time: ${p95ParseMs} ms`);

  if (leads.length > 0) {
    const perLeadBytes = (sizeBytes / leads.length).toFixed(0);
    console.log(`- Average per-lead size: ${perLeadBytes} bytes`);
  }

  await mongoose.disconnect();
}

measure().catch(console.error);
