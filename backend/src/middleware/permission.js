const Role = require('../models/Role');

// Strongly-typed Permission Registry
const PERMISSIONS = {
  LEAD_VIEW: 'LEAD_VIEW',
  LEAD_CREATE: 'LEAD_CREATE',
  LEAD_EDIT: 'LEAD_EDIT',
  LEAD_DELETE: 'LEAD_DELETE',
  LEAD_CLAIM: 'LEAD_CLAIM',
  LEAD_ASSIGN: 'LEAD_ASSIGN',
  LEAD_TRANSFER_REQUEST: 'LEAD_TRANSFER_REQUEST',
  LEAD_TRANSFER_APPROVE: 'LEAD_TRANSFER_APPROVE',
  LEAD_FORCE_TRANSFER: 'LEAD_FORCE_TRANSFER',
  LEAD_VIEW_TEAM: 'LEAD_VIEW_TEAM',
  LEAD_VIEW_ALL: 'LEAD_VIEW_ALL',

  STAFF_VIEW: 'STAFF_VIEW',
  STAFF_CREATE: 'STAFF_CREATE',
  STAFF_EDIT: 'STAFF_EDIT',
  STAFF_DISABLE: 'STAFF_DISABLE',

  ROLE_VIEW: 'ROLE_VIEW',
  ROLE_CREATE: 'ROLE_CREATE',
  ROLE_EDIT: 'ROLE_EDIT',
  ROLE_DELETE: 'ROLE_DELETE',

  REPORT_VIEW_TEAM: 'REPORT_VIEW_TEAM',
  REPORT_VIEW_AGENCY: 'REPORT_VIEW_AGENCY',

  INCENTIVE_VIEW_SELF: 'INCENTIVE_VIEW_SELF',
  INCENTIVE_VIEW_TEAM: 'INCENTIVE_VIEW_TEAM',
  INCENTIVE_APPROVE: 'INCENTIVE_APPROVE',
  INCENTIVE_MODIFY: 'INCENTIVE_MODIFY',
  INCENTIVE_MANAGE: 'INCENTIVE_MANAGE',

  AUDIT_VIEW: 'AUDIT_VIEW',
  ACTIVITY_VIEW: 'ACTIVITY_VIEW',

  EXPORT_LEADS: 'EXPORT_LEADS',

  AGENCY_SETTINGS_VIEW: 'AGENCY_SETTINGS_VIEW',
  AGENCY_SETTINGS_EDIT: 'AGENCY_SETTINGS_EDIT',
};

/**
 * Resolves the tenantId dynamically for the request context
 * @param {Object} user - The authenticated user object from req.user
 * @returns {mongoose.Types.ObjectId} The resolved tenant ID
 */
const resolveTenantId = (user) => {
  if (!user) return null;
  // If they are an employee/agent under a company
  if (user.companyId) {
    return user.companyId;
  }
  // Otherwise, they are their own tenant owner
  return user._id;
};

/**
 * Middleware to require a specific permission
 * @param {string} permission - The permission key from the registry
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Enforce Tenant Isolation context
      req.tenantId = resolveTenantId(req.user);

      // SuperAdmin bypass
      if (req.user.isAdmin || req.user.role === 'superadmin') {
        return next();
      }

      let userPermissions = [];
      let isOwner = false;

      // Check if user is the direct Tenant Owner
      if (
        String(req.user._id) === String(req.tenantId) ||
        req.user.companyRole === 'owner' ||
        req.user.workStatus === 'company_owner'
      ) {
        isOwner = true;
      }

      if (isOwner) {
        // Direct owners automatically inherit all permissions (privileged role)
        userPermissions = Object.values(PERMISSIONS);
      } else if (req.user.roleId) {
        // Query Role schema from DB
        const role = await Role.findOne({
          _id: req.user.roleId,
          tenantId: req.tenantId,
          isActive: true,
        }).lean();

        if (role) {
          if (role.roleType === 'OWNER') {
            userPermissions = Object.values(PERMISSIONS);
          } else {
            userPermissions = role.permissions || [];
          }
        }
      }

      // Validate permission string against registry
      if (!PERMISSIONS[permission]) {
        return res.status(500).json({ message: 'Invalid permission requested in system registry' });
      }

      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          message: `Access denied: missing permission '${permission}'`,
          code: 'PERMISSION_DENIED',
        });
      }

      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      res.status(500).json({ message: 'Internal authorization error' });
    }
  };
};

module.exports = {
  PERMISSIONS,
  resolveTenantId,
  requirePermission,
};
