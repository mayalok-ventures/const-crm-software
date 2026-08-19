/**
 * Phone Normalization & Deduplication Utility
 * Ensures consistent E.164 / normalized digits across all creation & ingestion channels.
 */

const normalizePhone = (rawPhone, defaultCountryCode = '91') => {
  if (!rawPhone) return '';
  
  // Strip all non-digit characters except leading plus
  let cleaned = String(rawPhone).trim();
  const hasPlus = cleaned.startsWith('+');
  const digitsOnly = cleaned.replace(/\D/g, '');

  if (!digitsOnly) return '';

  // If 10 digits (e.g. standard Indian mobile without CC), prepend country code
  if (digitsOnly.length === 10) {
    return `${defaultCountryCode}${digitsOnly}`;
  }

  // If 11 digits starting with 0 (e.g. 09876543210), strip 0 and prepend CC
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return `${defaultCountryCode}${digitsOnly.slice(1)}`;
  }

  // If already prefixed with 91 (12 digits) or other CC
  return digitsOnly;
};

const formatDisplayPhone = (normalizedPhone) => {
  if (!normalizedPhone) return '';
  const digits = String(normalizedPhone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
};

module.exports = {
  normalizePhone,
  formatDisplayPhone,
};
