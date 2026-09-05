const mongoose = require('mongoose');
const Role = require('../models/Role');
const User = require('../models/User');
const { PERMISSIONS } = require('../middleware/permission');

const OWNER_PERMISSIONS = Object.values(PERMISSIONS);

const MANAGER_PERMISSIONS = [
  PERMISSIONS.LEAD_VIEW,
  PERMISSIONS.LEAD_CREATE,
  PERMISSIONS.LEAD_EDIT,
  PERMISSIONS.LEAD_CLAIM,
  PERMISSIONS.LEAD_ASSIGN,
  PERMISSIONS.LEAD_TRANSFER_REQUEST,
  PERMISSIONS.LEAD_TRANSFER_APPROVE,
  PERMISSIONS.LEAD_FORCE_TRANSFER,
  PERMISSIONS.LEAD_VIEW_TEAM,
  PERMISSIONS.STAFF_VIEW,
  PERMISSIONS.STAFF_CREATE,
  PERMISSIONS.STAFF_EDIT,
  PERMISSIONS.ROLE_VIEW,
  PERMISSIONS.REPORT_VIEW_TEAM,
  PERMISSIONS.INCENTIVE_VIEW_TEAM,
  PERMISSIONS.INCENTIVE_APPROVE,
  PERMISSIONS.ACTIVITY_VIEW,
];

const AGENT_PERMISSIONS = [
  PERMISSIONS.LEAD_VIEW,
  PERMISSIONS.LEAD_CREATE,
  PERMISSIONS.LEAD_EDIT,
  PERMISSIONS.LEAD_CLAIM,
  PERMISSIONS.LEAD_TRANSFER_REQUEST,
  PERMISSIONS.INCENTIVE_VIEW_SELF,
  PERMISSIONS.ACTIVITY_VIEW,
];

/**
 * Seeds default system roles for a given tenantId
 * @param {mongoose.Types.ObjectId} tenantId - The organization/tenant owner ID
 * @returns {Promise<Object>} Map of role type to role document
 */
const seedSystemRolesForTenant = async (tenantId) => {
  const roles = {};
  const defaults = [
    {
      name: 'owner',
      roleType: 'OWNER',
      permissions: OWNER_PERMISSIONS,
      description: 'Full administrative access and organization management',
    },
    {
      name: 'manager',
      roleType: 'MANAGER',
      permissions: MANAGER_PERMISSIONS,
      description: 'Supervise sales agents, distribute leads, approve transfers, and view team reports',
    },
    {
      name: 'agent',
      roleType: 'AGENT',
      permissions: AGENT_PERMISSIONS,
      description: 'View and edit assigned leads, claim new leads, and submit transfer requests',
    },
  ];

  for (const item of defaults) {
    let role = await Role.findOne({ tenantId, roleType: item.roleType });
    if (!role) {
      role = await Role.create({
        tenantId,
        name: item.name,
        roleType: item.roleType,
        permissions: item.permissions,
        description: item.description,
        isSystemRole: true,
        isActive: true,
      });
    }
    roles[item.roleType] = role;
  }

  return roles;
};

/**
 * Migrates existing database users by seeding roles and assigning them safely
 */
const runAgencyRolesMigration = async () => {
  const users = await User.find({ roleId: null });
  if (!users.length) return;

  console.log(`[Migration] Starting agency roles migration for ${users.length} users...`);
  const tenantRoleCache = new Map();

  let count = 0;
  for (const user of users) {
    // Determine tenant ID safely
    let tenantId = user._id;
    if (user.companyRole === 'agent' && user.companyId) {
      tenantId = user.companyId;
    } else if (user.companyId) {
      tenantId = user.companyId;
    }

    const tKey = tenantId.toString();
    let seededRoles = tenantRoleCache.get(tKey);
    if (!seededRoles) {
      seededRoles = await seedSystemRolesForTenant(tenantId);
      tenantRoleCache.set(tKey, seededRoles);
    }

    // Determine target roleType
    let targetType = 'AGENT';
    if (
      user.companyRole === 'owner' ||
      user.workStatus === 'company_owner' ||
      user.workStatus === 'independent_agent' ||
      user.role === 'superadmin' ||
      user.isAdmin
    ) {
      targetType = 'OWNER';
    } else if (user.companyRole === 'manager' || user.companyRole === 'supervisor') {
      targetType = 'MANAGER';
    }

    const targetRole = seededRoles[targetType];
    if (targetRole) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            roleId: targetRole._id,
            employeeStatus: user.employeeStatus || 'active',
            joinedAt: user.joinedAt || user.createdAt || new Date(),
          },
        }
      );
      count++;
    }
  }

  console.log(`[Migration] Completed. Updated ${count} users with default roles.`);
};

module.exports = {
  seedSystemRolesForTenant,
  runAgencyRolesMigration,
};
