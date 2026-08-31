const { assertFeature, assertLimit } = require('../services/entitlementService');

/**
 * Entitlement Guard Middleware
 * Route-level guard for premium feature access and numerical limits
 */

/**
 * Require a specific feature flag (e.g. 'leadExport', 'whatsappBroadcast')
 */
function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      // SuperAdmin is exempt from tenant plan restrictions
      if (req.user?.role === 'superadmin') {
        return next();
      }

      const subjectId = req.user?.companyId || req.user?._id;
      await assertFeature(subjectId, featureKey);
      next();
    } catch (err) {
      return res.status(err.statusCode || 403).json({
        success: false,
        code: err.code || 'FEATURE_NOT_AVAILABLE',
        feature: err.feature || featureKey,
        message: err.message,
        upgradeRequired: true,
      });
    }
  };
}

/**
 * Require within a resource limit
 */
function requireLimit(resourceKey, countResolver = 1) {
  return async (req, res, next) => {
    try {
      if (req.user?.role === 'superadmin') {
        return next();
      }

      const subjectId = req.user?.companyId || req.user?._id;
      const count = typeof countResolver === 'function' ? countResolver(req) : Number(countResolver) || 1;
      await assertLimit(subjectId, resourceKey, count);
      next();
    } catch (err) {
      return res.status(err.statusCode || 403).json({
        success: false,
        code: err.code || 'PLAN_LIMIT_EXCEEDED',
        resource: err.resource || resourceKey,
        limit: err.limit,
        currentUsage: err.currentUsage,
        requested: err.requested,
        message: err.message,
        upgradeRequired: true,
      });
    }
  };
}

module.exports = {
  requireFeature,
  requireLimit,
};
