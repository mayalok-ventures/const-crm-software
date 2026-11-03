/**
 * Custom Form Questions & Responses Note Formatter
 * 
 * Part of SAHYAK CRM - Product Improvement Directive (PART 2)
 * Formats custom lead form questions and answers into a clean, human-readable Note:
 * 
 * **Custom Form Responses**
 * - What is your budget? — ₹50 Lakhs
 * - Preferred location? — Noida
 * - When do you want to purchase? — Within 3 months
 */

const STANDARD_FIELDS_TO_SKIP = new Set([
  'name',
  'fullname',
  'full_name',
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'phone',
  'phone_number',
  'phonenumber',
  'mobile',
  'mobile_number',
  'mobilenumber',
  'whatsapp',
  'whatsapp_number',
  'email',
  'e-mail',
  'email_address',
  'emailaddress',
  'mail',
  'city',
  'location',
  'course',
  'targetcourse',
  'targetstream',
  'id',
  'created_time',
  'ad_id',
  'adset_id',
  'campaign_id',
  'form_id',
  'is_organic',
  'platform',
  '_crm_hp_trap',
]);

/**
 * Clean question text into a proper readable string
 */
function cleanQuestionLabel(rawKey, fieldMapping = []) {
  if (!rawKey) return '';
  const keyStr = String(rawKey).trim();

  // 1. Check if an explicit displayLabel exists in fieldMapping
  if (Array.isArray(fieldMapping) && fieldMapping.length > 0) {
    const match = fieldMapping.find(
      (m) =>
        m &&
        ((m.sourceField && m.sourceField.toLowerCase() === keyStr.toLowerCase()) ||
          (m.displayLabel && m.displayLabel.toLowerCase() === keyStr.toLowerCase()))
    );
    if (match && match.displayLabel) {
      return String(match.displayLabel).trim();
    }
  }

  // 2. Clean common trailing Meta artifacts (e.g. "what_is_your_budget?_" -> "What is your budget?")
  let cleaned = keyStr
    .replace(/[_\-\s]+$/, '') // trailing underscore or hyphen
    .replace(/^([_\-\s]+)/, ''); // leading underscore or hyphen

  // If it's snake_case or slugified (contains underscores and no spaces), convert to readable words
  if (cleaned.includes('_') && !cleaned.includes(' ')) {
    cleaned = cleaned
      .split('_')
      .map((word) => {
        if (!word) return '';
        // If word has punctuation like ?, keep it
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .filter(Boolean)
      .join(' ');
  } else {
    // Capitalize first letter
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned.trim();
}

/**
 * Clean answer value into a readable string
 */
function cleanAnswerValue(rawVal) {
  if (rawVal === undefined || rawVal === null) return '';
  if (typeof rawVal === 'boolean') return rawVal ? 'Yes' : 'No';
  if (Array.isArray(rawVal)) {
    return rawVal.map(cleanAnswerValue).filter(Boolean).join(', ');
  }
  if (typeof rawVal === 'object') {
    try {
      return JSON.stringify(rawVal);
    } catch {
      return String(rawVal);
    }
  }

  const str = String(rawVal).trim();

  // If answer looks like a snake_case enum value, e.g. "property_developer" or "11_25_agents", format nicely
  if (str.includes('_') && !str.includes(' ') && !str.includes('@') && !str.includes('http')) {
    return str
      .split('_')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ');
  }

  return str;
}

/**
 * Format questions and answers into a markdown note
 *
 * @param {Object} options
 * @param {Array} options.rawAnswers - e.g. [{ question, answer }, { name, value }]
 * @param {Object} options.customData - key-value pairs
 * @param {Array} options.fieldMapping - configured field mappings
 * @param {string} options.formName - optional form name
 * @returns {string|null} Markdown note text or null if no custom questions
 */
function formatCustomQuestionsNote({
  rawAnswers = [],
  customData = {},
  fieldMapping = [],
  formName = '',
}) {
  const qaMap = new Map();

  // 1. Process rawAnswers first (usually contains original question text from form)
  if (Array.isArray(rawAnswers)) {
    for (const item of rawAnswers) {
      if (!item) continue;
      const rawQ = item.question || item.label || item.name || item.key || '';
      const rawA =
        item.answer !== undefined
          ? item.answer
          : item.value !== undefined
          ? item.value
          : Array.isArray(item.values)
          ? item.values[0]
          : '';

      const normalizedQKey = String(rawQ).trim().toLowerCase().replace(/[\s_\-]+/g, '');
      if (!normalizedQKey || STANDARD_FIELDS_TO_SKIP.has(normalizedQKey)) {
        continue;
      }

      const qLabel = cleanQuestionLabel(rawQ, fieldMapping);
      const aVal = cleanAnswerValue(rawA);

      if (qLabel && aVal) {
        qaMap.set(normalizedQKey, { question: qLabel, answer: aVal });
      }
    }
  }

  // 2. Process customData object
  if (customData && typeof customData === 'object' && !Array.isArray(customData)) {
    for (const [key, val] of Object.entries(customData)) {
      if (!key) continue;
      const normalizedQKey = String(key).trim().toLowerCase().replace(/[\s_\-]+/g, '');
      if (!normalizedQKey || STANDARD_FIELDS_TO_SKIP.has(normalizedQKey)) {
        continue;
      }

      // If we don't already have an answer from rawAnswers
      if (!qaMap.has(normalizedQKey)) {
        const qLabel = cleanQuestionLabel(key, fieldMapping);
        const aVal = cleanAnswerValue(val);
        if (qLabel && aVal) {
          qaMap.set(normalizedQKey, { question: qLabel, answer: aVal });
        }
      }
    }
  }

  if (qaMap.size === 0) {
    return null;
  }

  // 3. Build markdown
  const header = formName
    ? `**Custom Form Responses (${formName})**`
    : '**Custom Form Responses**';

  const lines = [header];
  for (const { question, answer } of qaMap.values()) {
    lines.push(`- ${question} — ${answer}`);
  }

  return lines.join('\n');
}

/**
 * Safely append custom questions note to a lead document.
 * Idempotent: does NOT add duplicate notes if an identical response note already exists.
 * Preserves all user-created notes.
 *
 * @param {Object} lead - Mongoose Lead document or plain lead object with .notes array
 * @param {Object} noteOptions - { rawAnswers, customData, fieldMapping, formName, authorName }
 * @returns {boolean} true if a note was added, false otherwise
 */
function appendCustomQuestionsNote(lead, noteOptions) {
  if (!lead) return false;
  if (!Array.isArray(lead.notes)) {
    lead.notes = [];
  }

  const noteText = formatCustomQuestionsNote(noteOptions);
  if (!noteText) return false;

  // Check for idempotency: does a note with the exact same responses already exist?
  const existingNote = lead.notes.find((n) => {
    if (!n || !n.text) return false;
    return n.text.trim() === noteText.trim();
  });

  if (existingNote) {
    return false; // Already present, avoid duplicate note
  }

  const author = noteOptions.authorName || (noteOptions.formName ? `${noteOptions.formName} Form` : 'Custom Form');

  lead.notes.push({
    text: noteText,
    authorName: author,
    createdAt: new Date(),
  });

  return true;
}

module.exports = {
  formatCustomQuestionsNote,
  appendCustomQuestionsNote,
  cleanQuestionLabel,
  cleanAnswerValue,
};
