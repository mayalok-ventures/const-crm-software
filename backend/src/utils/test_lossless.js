const raw = '{"campaign_id": 9007199254740999, "form_id": 98765432101234567, "leadgen_id": 123456789012345678, "entry": [{"id": 15312538113398765, "changes": [{"field": "leadgen", "value": {"leadgen_id": 9007199254740999, "ad_id": 888877776666555544}}]}], "other_num": 42, "name": "Test"}';

function parseLosslessJson(rawText) {
  if (typeof rawText !== 'string') {
    rawText = Buffer.isBuffer(rawText) ? rawText.toString('utf8') : JSON.stringify(rawText);
  }
  // Convert any unquoted numeric sequence following an ID key into a quoted string
  const idKeyPattern = /"([a-zA-Z0-9_]*(?:id|Id|leadgen|page|form|campaign|adset|adgroup|creative|account))"\s*:\s*(-?\d+)/g;
  const preprocessed = rawText.replace(idKeyPattern, '"$1": "$2"');
  return JSON.parse(preprocessed);
}

const parsed = parseLosslessJson(raw);
console.log('campaign_id:', parsed.campaign_id, typeof parsed.campaign_id);
console.log('form_id:', parsed.form_id, typeof parsed.form_id);
console.log('nested leadgen_id:', parsed.entry[0].changes[0].value.leadgen_id, typeof parsed.entry[0].changes[0].value.leadgen_id);
console.log('nested ad_id:', parsed.entry[0].changes[0].value.ad_id, typeof parsed.entry[0].changes[0].value.ad_id);
console.log('entry id:', parsed.entry[0].id, typeof parsed.entry[0].id);
console.log('other_num:', parsed.other_num, typeof parsed.other_num);

if (parsed.campaign_id === '9007199254740999' && parsed.entry[0].changes[0].value.leadgen_id === '9007199254740999') {
  console.log('✅ TEST PASSED: EXACT LOSSLESS MATCH!');
} else {
  console.log('❌ TEST FAILED!');
  process.exit(1);
}
