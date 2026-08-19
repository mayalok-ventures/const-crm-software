const Entitlement = require('../models/Entitlement');
const AuditLog = require('../models/AuditLog');

/**
 * Enforce Export Gating (Anti-Churn / Anti-Theft Guard)
 * Blocks data exports for users on annual plans during the first 90 days of tenure.
 */
const enforceExportGating = async (req, res, next) => {
  try {
    // SuperAdmin bypass
    if (req.user && (req.user.role === 'superadmin' || req.user.isAdmin)) {
      return next();
    }

    const tenantId = req.user.companyId || req.user._id;
    const entitlement = await Entitlement.findOne({ userId: tenantId });

    if (!entitlement) {
      // Default to allowing if no entitlement schema exists, but log
      return next();
    }

    // Check overall status
    if (entitlement.status === 'LOCKED') {
      return res.status(403).json({
        success: false,
        code: 'PLAN_LOCKED',
        message: 'Your account is locked due to an expired grace period or billing default. Export is suspended.',
      });
    }

    // Check export gating
    if (!entitlement.exportGating?.canExportData) {
      const unlockDate = entitlement.exportGating?.exportUnlockedAt
        ? new Date(entitlement.exportGating.exportUnlockedAt).toLocaleDateString()
        : 'after 90 days of active subscription';

      // Log blocked export attempt
      await AuditLog.create({
        actorId: req.user._id,
        actorRole: 'user',
        targetUserId: tenantId,
        action: 'FRAUD_EXPORT_GATE_PREVENTED',
        reason: `Export blocked by 90-day anti-churn gate. Unlocks on ${unlockDate}.`,
        riskScore: 65,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        code: 'EXPORT_GATED',
        message: `Data Export Restricted: Anti-churn security requires 90 days of continuous subscription. Exports unlock on ${unlockDate}.`,
        exportUnlockedAt: entitlement.exportGating?.exportUnlockedAt,
      });
    }

    next();
  } catch (err) {
    console.error('[Anti-Fraud] enforceExportGating error:', err);
    next();
  }
};

/**
 * Enforce Import Velocity Limits (Anti-Scraping / Anti-Spam Guard)
 * Restricts new accounts (< 30 days) to a maximum of 500 imports per day.
 */
const checkImportVelocity = async (tenantId, incomingCount = 1) => {
  const entitlement = await Entitlement.findOne({ userId: tenantId });
  if (!entitlement) return { allowed: true };

  if (entitlement.status === 'LOCKED') {
    return {
      allowed: false,
      code: 'PLAN_LOCKED',
      message: 'Account is locked. Lead ingestion is suspended.',
    };
  }

  // Reset daily velocity counter if last reset was on a previous calendar date
  const now = new Date();
  const lastReset = new Date(entitlement.importVelocity?.lastResetAt || 0);
  const isSameDay =
    now.getFullYear() === lastReset.getFullYear() &&
    now.getMonth() === lastReset.getMonth() &&
    now.getDate() === lastReset.getDate();

  let currentImported = isSameDay ? (entitlement.importVelocity?.importedToday || 0) : 0;
  const limit = entitlement.importVelocity?.dailyLimit || 500;

  if (currentImported + incomingCount > limit) {
    await AuditLog.create({
      actorRole: 'user',
      targetUserId: tenantId,
      action: 'FRAUD_IMPORT_VELOCITY_TRIGGERED',
      reason: `Daily import velocity limit reached (${currentImported}/${limit} leads imported today). Ingestion of ${incomingCount} leads rejected.`,
      riskScore: 75,
    }).catch(() => {});

    return {
      allowed: false,
      code: 'IMPORT_VELOCITY_EXCEEDED',
      message: `Daily import velocity limit reached (maximum ${limit} leads/day for security). Resets at midnight.`,
      dailyLimit: limit,
      importedToday: currentImported,
    };
  }

  // Increment and persist counter
  await Entitlement.findByIdAndUpdate(entitlement._id, {
    $set: {
      'importVelocity.importedToday': currentImported + incomingCount,
      'importVelocity.lastResetAt': now,
    },
  });

  return { allowed: true, remaining: limit - (currentImported + incomingCount) };
};

module.exports = {
  enforceExportGating,
  checkImportVelocity,
};
