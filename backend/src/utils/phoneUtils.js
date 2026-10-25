/**
 * Robust phone number normalization utility for Indian & international formats.
 * Safely strips country code (+91, 91), leading zeros, dashes, spaces, and punctuation.
 */

function normalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let digits = rawPhone.replace(/\D/g, '');
  
  // Standard Indian 12-digit format with 91 country code (e.g., 919876543210 -> 9876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  // 11-digit format with leading 0 (e.g., 09876543210 -> 9876543210)
  else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Returns candidate phone strings to query in MongoDB so both legacy and normalized records match.
 */
function getPhoneQueryCandidates(rawPhone) {
  if (!rawPhone) return [];
  const rawDigits = String(rawPhone).replace(/\D/g, '');
  const normalized = normalizePhone(String(rawPhone));
  
  const candidates = new Set();
  if (rawDigits) candidates.add(rawDigits);
  if (normalized) candidates.add(normalized);
  if (rawDigits.length >= 10) {
    candidates.add(rawDigits.slice(-10));
  }
  return Array.from(candidates).filter(Boolean);
}

module.exports = {
  normalizePhone,
  getPhoneQueryCandidates,
};
