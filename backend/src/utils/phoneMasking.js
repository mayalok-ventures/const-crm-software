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
 * Redacts telephone numbers inside descriptive text strings.
 * Replaces sequences of 10-14 digits (with optional + prefix) with masked equivalent.
 *
 * @param {string} text
 * @returns {string}
 */
function redactPhoneInText(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/(?:\+?\d{1,4}[ -]?)?\(?\d{3,5}\)?[ -]?\d{3,5}[ -]?\d{3,5}/g, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return maskPhoneNumber(match);
    }
    return match;
  });
}

/**
 * Determines whether phone numbers should be masked for the requesting user/membership context.
 * Strictly adheres to spec: Workspace setting maskLeadPhones default FALSE.
 * Masking occurs ONLY when flag is ON and requesting user lacks 'leads.view_phone_unmasked'.
 *
 * @param {Object} user - Authenticated user document or object
 * @param {Object} membership - Workspace membership document or object
 * @param {Object} workspace - Workspace document or object
 * @returns {Promise<boolean>} True if phone numbers MUST be masked; false if unmasked access allowed
 */
async function shouldMaskPhoneForUser(user, membership = null, workspace = null) {
  if (!user) return false;

  // 1. Resolve workspace context
  let ws = workspace || user.workspace;
  if (!ws && (user.workspaceId || membership?.workspaceId)) {
    const wsId = user.workspaceId || membership?.workspaceId;
    try {
      const mongoose = require('mongoose');
      const Workspace = mongoose.models.Workspace || require('../models/Workspace');
      ws = await Workspace.findById(wsId).select('settings maskLeadPhones').lean();
    } catch (_) {}
  }

  // 2. Check workspace-level feature flag: default FALSE
  const isMaskingEnabled = Boolean(ws?.settings?.maskLeadPhones || ws?.maskLeadPhones);
  if (!isMaskingEnabled) {
    // Flag OFF: guaranteed 100% byte-identical unmasked responses as before
    return false;
  }

  // 3. Superadmins and platform admins bypass masking
  if (user.role === 'superadmin' || user.isAdmin) return false;

  // 4. Workspace / Company owners bypass masking
  if (
    user.workStatus === 'company_owner' ||
    user.companyRole === 'owner' ||
    user.workspaceRole === 'owner' ||
    user.role === 'admin'
  ) {
    return false;
  }

  const effectiveMembership = membership || user.membership;

  // 5. Owner membership role has unconditional unmasked authority
  if (effectiveMembership && effectiveMembership.role === 'owner') {
    return false;
  }

  // 6. If membership or user has granular permission evaluation method
  if (effectiveMembership && typeof effectiveMembership.hasPermission === 'function') {
    const hasUnmaskPerm = await effectiveMembership.hasPermission('leads.view_phone_unmasked');
    if (hasUnmaskPerm) return false;
  }
  if (typeof user.hasPermission === 'function') {
    const hasUnmaskPerm = await user.hasPermission('leads.view_phone_unmasked');
    if (hasUnmaskPerm) return false;
  }
  if (Array.isArray(user.permissions) && user.permissions.includes('leads.view_phone_unmasked')) {
    return false;
  }
  if (Array.isArray(effectiveMembership?.permissions) && effectiveMembership.permissions.includes('leads.view_phone_unmasked')) {
    return false;
  }

  // 7. Built-in manager role default: allowed unmasked
  if (
    user.role === 'manager' ||
    user.companyRole === 'manager' ||
    effectiveMembership?.role === 'manager'
  ) {
    return false;
  }

  // When flag is ON and user lacks unmask permission -> enforce masking
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
  redactPhoneInText,
  shouldMaskPhoneForUser,
  sanitizeLeadPhone,
};
