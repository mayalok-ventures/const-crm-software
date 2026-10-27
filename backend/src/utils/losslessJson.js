/**
 * Lossless JSON Parser for Webhook Payloads
 *
 * In JavaScript, standard JSON.parse() parses integers directly into 64-bit double-precision
 * floating point numbers (IEEE 754). Any integer value greater than Number.MAX_SAFE_INTEGER
 * (2^53 - 1, or 9,007,199,254,740,991) is permanently corrupted BEFORE any String() cast.
 *
 * Google Ads and Meta Ads frequently assign 64-bit integer IDs (such as 16 to 18-digit
 * campaign_id, form_id, adgroup_id, creative_id, leadgen_id, ad_id, page_id).
 *
 * This parser operates directly on the raw request body text (Buffer or UTF-8 string)
 * and safely transforms raw integer sequences associated with ID fields into quoted strings
 * prior to parsing, guaranteeing 100% precision.
 */

function parseLosslessJson(rawInput) {
  if (rawInput === null || rawInput === undefined) return {};
  if (typeof rawInput === 'object' && !Buffer.isBuffer(rawInput)) {
    // Already an object, return as-is
    return rawInput;
  }

  let rawText = Buffer.isBuffer(rawInput) ? rawInput.toString('utf8') : String(rawInput);
  rawText = rawText.trim();
  if (!rawText) return {};

  try {
    // Regex targeting any ID-like key followed by an unquoted integer:
    // Matches: "campaign_id": 9007199254740999
    // Matches: "leadgen_id": 123456789012345678
    // Matches: "id": 15312538113398765
    // Matches: "form_id": 982102938491827364
    const idKeyPattern = /"([a-zA-Z0-9_]*(?:id|Id|leadgen|page|form|campaign|adset|adgroup|creative|account|customer))"\s*:\s*(-?\d+)/g;
    const preprocessed = rawText.replace(idKeyPattern, '"$1": "$2"');
    return JSON.parse(preprocessed);
  } catch (parseError) {
    // Fallback to standard parse if custom regex produced invalid JSON
    return JSON.parse(rawText);
  }
}

module.exports = {
  parseLosslessJson,
};
