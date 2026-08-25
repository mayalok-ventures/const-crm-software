/**
 * USERCODE GENERATOR (Real Estate Agency SaaS)
 *
 * Generates unique usercode identifiers:
 * - Company accounts: CMP-XXXXXX (e.g., CMP-748921)
 * - Agent/Solo accounts: REA-XXXXXX (e.g., REA-381940)
 */

const generateUsercode = (prefix = 'REA') => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomPart}`;
};

const generateUniqueUsercode = async (UserModel, prefix = 'REA') => {
  let Model = UserModel;
  let targetPrefix = prefix;

  if (typeof UserModel === 'string') {
    targetPrefix = UserModel;
    Model = require('../models/User');
  } else if (!Model || typeof Model.findOne !== 'function') {
    Model = require('../models/User');
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateUsercode(targetPrefix);
    const exists = await Model.findOne({ usercode: code }).lean();
    if (!exists) return code;
  }
  // Fallback timestamp based
  return `${targetPrefix}-${Date.now().toString().slice(-6)}`;
};

module.exports = {
  generateUsercode,
  generateUniqueUsercode,
};
