const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');

/**
 * Generates a scoped, short-lived Impersonation Support Session Token
 */
async function startImpersonationSession({ targetUserId, reason = 'Customer Support / System Verification' }, adminUser) {
  if (!reason || reason.trim().length < 5) {
    throw new Error('A detailed reason (min 5 characters) is required for support impersonation audit.');
  }

  const targetUser = await User.findById(targetUserId).select('-password');
  if (!targetUser) {
    throw new Error('Target user not found');
  }

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

  const payload = {
    id: targetUser._id,
    role: targetUser.role,
    isAdmin: targetUser.isAdmin,
    supportMode: true,
    superAdminId: adminUser._id,
    superAdminEmail: adminUser.email,
    superAdminName: adminUser.name,
    targetOrganisationId: targetUser.companyId || targetUser._id,
    targetUserId: targetUser._id,
    sessionId,
  };

  const supportToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Record Immutable Impersonation Audit Log
  await AuditLog.create({
    actorId: adminUser._id,
    actorName: adminUser.name,
    actorEmail: adminUser.email,
    actorRole: 'superadmin',
    organizationId: targetUser.companyId || targetUser._id,
    action: 'IMPERSONATION_START',
    resourceType: 'User',
    resourceId: targetUser._id.toString(),
    resourceName: `${targetUser.name} (${targetUser.email || targetUser.phone})`,
    metadata: {
      reason,
      sessionId,
      targetRole: targetUser.role,
      targetOrganisation: targetUser.companyInfo?.companyName || targetUser.name,
      expiresAt,
    },
    timestamp: new Date(),
  });

  return {
    supportToken,
    sessionId,
    expiresAt,
    targetUser,
  };
}

module.exports = {
  startImpersonationSession,
};
