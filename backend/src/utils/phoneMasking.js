/**
 * Role-Based Lead Phone Number Masking Utility
 * Prevents unauthorized contact list exfiltration by field agents/counsellors.
 */

/**
 * Masks a telephone number string while retaining the country/area prefix.
 * e.g. "+919876543210" -> "+9198765*****"
 *      "9876543210"    -> "98765*****"
 *      "1234"          -> "****"
 *
 * @param {string} phone 
 * @returns {string}
 */
function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const trimmed = phone.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length <= 4) return '****';
  
  // Retain leading digits (at least 3 characters) and mask trailing 5 digits with asterisks
  const visibleLength = Math.max(3, trimmed.length - 5);
  return trimmed.slice(0, visibleLength) + '*'.repeat(trimmed.length - visibleLength);
}

/**
 * Determines whether phone numbers should be masked for the requesting user/membership context.
 *
 * @param {Object} user - Authenticated user document or object
 * @param {Object} membership - Workspace membership document or object
 * @returns {Promise<boolean>} True if phone numbers MUST be masked; false if unmasked access allowed
 */
async function shouldMaskPhoneForUser(user, membership = null) {
  if (!user) return true;

  // Superadmins and platform admins bypass masking
  if (user.role === 'superadmin' || user.isAdmin) return false;

  // Workspace / Company owners bypass masking
  if (
    user.workStatus === 'company_owner' ||
    user.companyRole === 'owner' ||
    user.role === 'admin'
  ) {
    return false;
  }

  const effectiveMembership = membership || user.membership;

  // Owner membership role has unconditional unmasked authority
  if (effectiveMembership && effectiveMembership.role === 'owner') {
    return false;
  }

  // If membership has granular permission evaluation method
  if (effectiveMembership && typeof effectiveMembership.hasPermission === 'function') {
    const hasUnmaskPerm = await effectiveMembership.hasPermission('leads.view_phone_unmasked');
    return !hasUnmaskPerm;
  }

  // Built-in manager role default: allowed unmasked
  if (
    user.role === 'manager' ||
    user.companyRole === 'manager' ||
    effectiveMembership?.role === 'manager'
  ) {
    return false;
  }

  // Field agents, counsellors, telecallers, and auditors are masked by default
  return true;
}

/**
 * Applies phone masking in-place to a lead document or plain object.
 *
 * @param {Object} lead - Lead object
 * @param {boolean} shouldMask - Whether to mask the phone fields
 * @returns {Object} The sanitized lead object
 */
function sanitizeLeadPhone(lead, shouldMask) {
  if (!lead || typeof lead !== 'object') return lead;

  if (!shouldMask) {
    lead.isPhoneMasked = false;
    return lead;
  }

  if (lead.phone) lead.phone = maskPhoneNumber(lead.phone);
  if (lead.phoneDigits) lead.phoneDigits = maskPhoneNumber(lead.phoneDigits);
  if (lead.alternatePhone) lead.alternatePhone = maskPhoneNumber(lead.alternatePhone);
  if (lead.fatherPhone) lead.fatherPhone = maskPhoneNumber(lead.fatherPhone);
  lead.isPhoneMasked = true;

  return lead;
}

module.exports = {
  maskPhoneNumber,
  shouldMaskPhoneForUser,
  sanitizeLeadPhone,
};
