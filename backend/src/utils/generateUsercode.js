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
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateUsercode(prefix);
    const exists = await UserModel.findOne({ usercode: code }).lean();
    if (!exists) return code;
  }
  // Fallback timestamp based
  return `${prefix}-${Date.now().toString().slice(-6)}`;
};

module.exports = {
  generateUsercode,
  generateUniqueUsercode,
};
