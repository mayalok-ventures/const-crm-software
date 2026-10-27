const crypto = require('crypto');
const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const WorkspaceMembership = require('../models/WorkspaceMembership');
const Role = require('../models/Role');
const Invitation = require('../models/Invitation');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');

/**
 * @desc Get details of the active workspace
 * @route GET /api/workspace/current
 * @access Private (Workspace Member)
 */
exports.getCurrentWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .populate('ownerId', 'name email phone avatarIcon')
      .lean();

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const memberCount = await WorkspaceMembership.countDocuments({
      workspaceId: req.workspaceId,
      status: 'active',
    });

    const dataObj = {
      ...workspace,
      memberCount,
      myRole: req.membership?.role || 'counsellor',
      myPermissions: await req.membership?.getEffectivePermissions(),
    };

    res.json({
      success: true,
      data: dataObj,
      workspace: dataObj,
      membership: req.membership,
    });
  } catch (error) {
    console.error('getCurrentWorkspace error:', error);
    res.status(500).json({ message: 'Server error retrieving workspace' });
  }
};

/**
 * @desc Update active workspace settings
 * @route PUT /api/workspace/current
 * @access Private (Owner / workspace.settings.edit)
 */
exports.updateWorkspace = async (req, res) => {
  try {
    const { name, settings, industryType, subProfile } = req.body;

    const workspace = await Workspace.findById(req.workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (name && name.trim()) workspace.name = name.trim();
    if (industryType) workspace.industryType = industryType;
    if (subProfile) workspace.subProfile = subProfile;

    if (settings && typeof settings === 'object') {
      const sanitizedSettings = { ...settings };
      if (sanitizedSettings.maxSnoozeCount !== undefined && sanitizedSettings.maxSnoozeCount !== null) {
        const parsed = Number(sanitizedSettings.maxSnoozeCount);
        sanitizedSettings.maxSnoozeCount = (!isNaN(parsed) && parsed >= 0) ? Math.floor(parsed) : 2;
      }
      workspace.settings = {
        ...workspace.settings.toObject(),
        ...sanitizedSettings,
      };
    }

    await workspace.save();
    try {
      const { invalidateWorkspaceCache } = require('../utils/authCache');
      invalidateWorkspaceCache(workspace._id);
    } catch (_) {}

    res.json({
      success: true,
      message: 'Workspace settings updated successfully',
      workspace,
    });
  } catch (error) {
    console.error('updateWorkspace error:', error);
    res.status(500).json({ message: 'Server error updating workspace' });
  }
};

/**
 * @desc Get members of current workspace
 * @route GET /api/workspace/members
 * @access Private (members.view)
 */
exports.getMembers = async (req, res) => {
  try {
    const members = await WorkspaceMembership.find({
      workspaceId: req.workspaceId,
    })
      .populate('userId', 'name email phone username usercode avatarIcon profilePicture userStatus lastLogin')
      .populate('customRoleId', 'name description')
      .sort({ role: 1, createdAt: 1 })
      .lean();

    const formatted = members.map((m) => ({
      _id: m._id,
      userId: m.userId?._id,
      name: m.userId?.name || 'Unknown User',
      email: m.userId?.email || '',
      phone: m.userId?.phone || '',
      avatarIcon: m.userId?.avatarIcon || 'avatar-1',
      role: m.role,
      customRole: m.customRoleId?.name || null,
      team: m.team || 'General',
      status: m.status,
      permissionOverrides: m.permissionOverrides || [],
      hasCustomPermissions: Boolean(m.permissionOverrides && m.permissionOverrides.length > 0),
      joinedAt: m.joinedAt,
      deactivatedAt: m.deactivatedAt,
    }));

    res.json({
      success: true,
      data: formatted,
      members: formatted,
    });
  } catch (error) {
    console.error('getMembers error:', error);
    res.status(500).json({ message: 'Server error retrieving members' });
  }
};

/**
 * @desc Invite a team member to the workspace
 * @route POST /api/workspace/invitations
 * @access Private (members.invite)
 */
exports.inviteMember = async (req, res) => {
  try {
    const { email, phone, team = '' } = req.body;
    const customRoleId = req.body.customRoleId;
    const role = customRoleId ? 'custom' : (req.body.role || 'counsellor');

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Invitee email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Prevent inviting as owner (ownership must be transferred deliberately)
    if (role === 'owner') {
      return res.status(400).json({ message: 'Cannot invite with role "owner". Transfer ownership instead.' });
    }

    // Prevent non-owners from inviting with role "manager"
    if (role === 'manager' && req.membership.role !== 'owner') {
      return res.status(403).json({
        code: 'PRIVILEGE_ESCALATION_PREVENTED',
        message: 'Only an active workspace owner can invite users with manager role.',
      });
    }

    // Privilege Escalation Guard: Non-owners cannot invite with a custom role possessing permissions they lack
    if (role === 'custom' && customRoleId && req.membership.role !== 'owner') {
      const targetRole = await Role.findOne({ _id: customRoleId, workspaceId: req.workspaceId });
      if (!targetRole) {
        return res.status(404).json({ message: 'Custom role not found in this workspace' });
      }
      const actorPerms = await req.membership.getEffectivePermissions();
      const actorKeySet = new Set(actorPerms.map(p => p.key));
      for (const p of targetRole.permissions || []) {
        if (!actorKeySet.has(p.key)) {
          return res.status(403).json({
            code: 'PRIVILEGE_ESCALATION_PREVENTED',
            message: `Cannot invite user with custom role containing permission '${p.key}' which you do not possess.`,
          });
        }
      }
    }

    // Check if user is already an active member of this workspace
    const existingUser = await User.findOne({ email: cleanEmail }).lean();
    if (existingUser) {
      const existingMembership = await WorkspaceMembership.findOne({
        workspaceId: req.workspaceId,
        userId: existingUser._id,
        status: 'active',
      });
      if (existingMembership) {
        return res.status(400).json({ message: 'This user is already an active member of this workspace' });
      }
    }

    // Generate unguessable crypto invitation token and store SHA-256 hash
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiration

    // Revoke any previous pending invitation for this email in this workspace
    await Invitation.updateMany(
      { workspaceId: req.workspaceId, email: cleanEmail, status: 'pending' },
      { $set: { status: 'revoked' } }
    );

    const invitation = await Invitation.create({
      workspaceId: req.workspaceId,
      email: cleanEmail,
      phone: phone ? phone.trim() : '',
      role,
      customRoleId: customRoleId || null,
      team: team ? team.trim() : '',
      tokenHash,
      token,
      invitedBy: req.user._id,
      status: 'pending',
      expiresAt,
    });

    const inviteUrl = `/invite?token=${token}`;
    const invData = {
      _id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      team: invitation.team,
      expiresAt: invitation.expiresAt,
      token: token,
    };

    res.status(201).json({
      success: true,
      message: `Invitation generated for ${cleanEmail}`,
      data: invData,
      invitation: invData,
      inviteUrl,
    });
  } catch (error) {
    console.error('inviteMember error:', error);
    res.status(500).json({ message: error.message || 'Server error creating invitation' });
  }
};

/**
 * @desc Get pending invitations for current workspace (tokenHash/token masked)
 * @route GET /api/workspace/invitations
 * @access Private (members.invite)
 */
exports.getInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({
      workspaceId: req.workspaceId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .select('-tokenHash -token')
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: invitations,
      invitations,
    });
  } catch (error) {
    console.error('getInvitations error:', error);
    res.status(500).json({ message: 'Server error retrieving invitations' });
  }
};

/**
 * @desc Revoke a pending invitation
 * @route DELETE /api/workspace/invitations/:id
 * @access Private (members.invite)
 */
exports.revokeInvitation = async (req, res) => {
  try {
    const invitation = await Invitation.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    invitation.status = 'revoked';
    await invitation.save();

    res.json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  } catch (error) {
    console.error('revokeInvitation error:', error);
    res.status(500).json({ message: 'Server error revoking invitation' });
  }
};

/**
 * @desc Resend / Refresh a pending invitation
 * @route POST /api/workspace/invitations/:id/resend
 * @access Private (members.invite)
 */
exports.resendInvitation = async (req, res) => {
  try {
    const invitation = await Invitation.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    const newRawToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');

    invitation.token = newRawToken;
    invitation.tokenHash = newTokenHash;
    invitation.status = 'pending';
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invitation.save();

    const inviteData = {
      _id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      team: invitation.team,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      token: newRawToken,
    };

    res.json({
      success: true,
      message: 'Invitation refreshed and extended for 7 days',
      data: inviteData,
      inviteUrl: `/invite?token=${newRawToken}`,
    });
  } catch (error) {
    console.error('resendInvitation error:', error);
    res.status(500).json({ message: 'Server error resending invitation' });
  }
};

/**
 * @desc Verify an invitation token before display/acceptance
 * @route GET /api/workspace/invitations/:token/verify
 * @access Public
 */
exports.verifyInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const computedHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await Invitation.findOne({
      $or: [{ tokenHash: computedHash }, { token }],
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).populate('workspaceId', 'name industryType');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'This invitation link is invalid, expired, or has already been accepted.',
      });
    }

    res.json({
      success: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        team: invitation.team,
        workspaceName: invitation.workspaceId?.name || 'Workspace',
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error('verifyInvitation error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying invitation' });
  }
};

/**
 * @desc Accept an invitation and join the workspace
 * @route POST /api/workspace/invitations/:token/accept
 * @access Public / Authenticated
 */
exports.acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const { name, password } = req.body;
    const computedHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await Invitation.findOne({
      $or: [{ tokenHash: computedHash }, { token }],
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return res.status(400).json({ message: 'Invitation link is invalid, expired, or already used' });
    }

    let targetUser = req.user;

    // If not authenticated, authenticate or register the user
    if (!targetUser) {
      targetUser = await User.findOne({ email: invitation.email });
      if (!targetUser) {
        if (!name || !password) {
          return res.status(400).json({ message: 'Name and password are required to create your account' });
        }

        const { generateUniqueUsername } = require('../utils/generateUsername');
        const { generateUniqueUsercode } = require('../utils/generateUsercode');
        const wsDoc = await Workspace.findById(invitation.workspaceId).select('ownerId').lean();

        const invRole = ['owner', 'manager', 'auditor', 'superadmin', 'counsellor'].includes(invitation.role)
          ? invitation.role
          : 'counsellor';
        const invWorkStatus = invitation.role === 'manager' ? 'manager' : (invitation.role === 'auditor' ? 'auditor' : 'counsellor');

        targetUser = await User.create({
          name: name.trim(),
          email: invitation.email,
          phone: invitation.phone || undefined,
          password,
          username: await generateUniqueUsername(User),
          usercode: await generateUniqueUsercode(User, 'CNS'),
          role: invRole,
          companyRole: invRole,
          workStatus: invWorkStatus,
          companyId: wsDoc?.ownerId || null,
          industryType: 'Education',
          educationSubProfile: 'admission_consultants',
        });
      }
    }

    // Create or reactivate WorkspaceMembership
    await WorkspaceMembership.findOneAndUpdate(
      { workspaceId: invitation.workspaceId, userId: targetUser._id },
      {
        $set: {
          role: invitation.role,
          customRoleId: invitation.customRoleId,
          team: invitation.team,
          status: 'active',
          deactivatedAt: null,
        },
        $setOnInsert: { joinedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    // Evict cached workspace context and bootstrap cache for this user
    try {
      const { workspaceContextCache, invalidateUserAuthCache } = require('../utils/authCache');
      const { invalidateBootstrapCache } = require('./bootstrapController');
      invalidateUserAuthCache(targetUser._id);
      invalidateBootstrapCache(targetUser._id, invitation.workspaceId);
      if (workspaceContextCache && typeof workspaceContextCache.deleteMatching === 'function') {
        workspaceContextCache.deleteMatching((key) => key.startsWith(String(targetUser._id)));
      }
    } catch (_) {}

    // Mark invitation as accepted and clear raw token
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.token = undefined;
    await invitation.save();

    const authToken = generateToken(targetUser._id);

    res.json({
      success: true,
      message: 'Invitation accepted! You have joined the workspace.',
      token: authToken,
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });
  } catch (error) {
    console.error('acceptInvitation error:', error);
    res.status(500).json({ message: error.message || 'Server error accepting invitation' });
  }
};

/**
 * @desc Change a member's role or team in the workspace
 * @route PUT /api/workspace/members/:id/role
 * @access Private (members.edit_role)
 */
exports.updateMemberRole = async (req, res) => {
  try {
    const { role, customRoleId, team } = req.body;

    // ─────────────────────────────────────────────────────────────
    // PRIVILEGE ESCALATION GUARDS (Spec Section 6)
    // ─────────────────────────────────────────────────────────────
    // Prevent non-owners from granting owner or manager role
    if (['owner', 'manager'].includes(role) && req.membership?.role !== 'owner') {
      return res.status(403).json({
        code: 'PRIVILEGE_ESCALATION_PREVENTED',
        message: 'Only an active workspace owner can grant or assign manager or owner roles.',
      });
    }

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid member ID format' });
    }

    const membership = await WorkspaceMembership.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
    });

    if (!membership) {
      return res.status(404).json({ message: 'Member not found in this workspace' });
    }

    // Prevent non-owners from modifying an existing owner or manager's role
    if (['owner', 'manager'].includes(membership.role) && req.membership.role !== 'owner') {
      return res.status(403).json({
        code: 'UNAUTHORIZED_TARGET',
        message: 'Only an active owner can modify an existing manager or owner\'s role.',
      });
    }

    // Prevent non-owners from changing their own role (self-promotion)
    if (membership.userId?.toString() === req.user._id?.toString() && req.membership.role !== 'owner') {
      return res.status(403).json({
        code: 'SELF_ROLE_MODIFICATION_PREVENTED',
        message: 'You cannot change your own role. An administrator or owner must perform this change.',
      });
    }

    // ─────────────────────────────────────────────────────────────
    // LAST OWNER PROTECTION INVARIANT (Spec Section 6)
    // ─────────────────────────────────────────────────────────────
    if (membership.role === 'owner' && role && role !== 'owner') {
      const activeOwnersCount = await WorkspaceMembership.countDocuments({
        workspaceId: req.workspaceId,
        role: 'owner',
        status: 'active',
      });

      if (activeOwnersCount <= 1) {
        return res.status(400).json({
          code: 'LAST_OWNER_PROTECTION',
          message: 'Cannot demote the only active owner. Transfer ownership to another member first.',
        });
      }
    }

    // Privilege Escalation Guard: Non-owners cannot assign a custom role with permissions or scopes they lack
    if (customRoleId && req.membership.role !== 'owner') {
      const targetRole = await Role.findOne({ _id: customRoleId, workspaceId: req.workspaceId });
      if (!targetRole) {
        return res.status(404).json({ message: 'Custom role not found in this workspace' });
      }
      const actorPerms = await req.membership.getEffectivePermissions();
      const actorPermMap = new Map(actorPerms.map(p => [p.key, p.scope || 'workspace']));
      const SCOPE_LEVELS = { workspace: 3, team: 2, own: 1, restricted: 0 };

      for (const p of targetRole.permissions || []) {
        if (!actorPermMap.has(p.key)) {
          return res.status(403).json({
            code: 'PRIVILEGE_ESCALATION_PREVENTED',
            message: `Cannot assign role with permission '${p.key}' which you do not possess.`,
          });
        }
        const grantedScopeLevel = SCOPE_LEVELS[p.scope || 'workspace'] || 0;
        const actorScopeLevel = SCOPE_LEVELS[actorPermMap.get(p.key)] || 0;
        if (grantedScopeLevel > actorScopeLevel) {
          return res.status(403).json({
            code: 'PRIVILEGE_ESCALATION_PREVENTED',
            message: `Scope privilege escalation: Cannot assign custom role with scope '${p.scope || 'workspace'}' for '${p.key}' exceeding your own scope '${actorPermMap.get(p.key)}'.`,
          });
        }
      }
    }

    if (role) membership.role = role;
    if (customRoleId !== undefined) membership.customRoleId = customRoleId || null;
    if (team !== undefined) membership.team = team ? team.trim() : '';

    await membership.save();

    // Evict cached workspace context and bootstrap cache for the modified member
    try {
      const { workspaceContextCache, invalidateUserAuthCache } = require('../utils/authCache');
      const { invalidateBootstrapCache } = require('./bootstrapController');
      if (membership.userId) {
        invalidateUserAuthCache(membership.userId);
        invalidateBootstrapCache(membership.userId, req.workspaceId);
      }
      if (workspaceContextCache && typeof workspaceContextCache.deleteMatching === 'function') {
        workspaceContextCache.deleteMatching((key) => key.startsWith(String(membership.userId)));
      }
    } catch (_) {}

    res.json({
      success: true,
      message: 'Member role updated successfully',
      membership,
    });
  } catch (error) {
    console.error('updateMemberRole error:', error);
    res.status(500).json({ message: 'Server error updating member role' });
  }
};

/**
 * @desc Deactivate a member from the workspace
 * @route DELETE /api/workspace/members/:id
 * @access Private (members.deactivate)
 */
exports.deactivateMember = async (req, res) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid member ID format' });
    }

    const membership = await WorkspaceMembership.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
    });

    if (!membership) {
      return res.status(404).json({ message: 'Member not found in this workspace' });
    }

    // Prevent non-owners from deactivating an owner or manager
    if (['owner', 'manager'].includes(membership.role) && req.membership.role !== 'owner') {
      return res.status(403).json({
        code: 'UNAUTHORIZED_TARGET',
        message: 'Only an active owner can deactivate another manager or owner.',
      });
    }

    // Prevent non-owners from deactivating themselves
    if (membership.userId?.toString() === req.user._id?.toString() && req.membership.role !== 'owner') {
      return res.status(403).json({
        code: 'SELF_DEACTIVATION_PREVENTED',
        message: 'You cannot deactivate your own membership.',
      });
    }

    // ─────────────────────────────────────────────────────────────
    // LAST OWNER PROTECTION INVARIANT (Spec Section 6)
    // ─────────────────────────────────────────────────────────────
    if (membership.role === 'owner') {
      const activeOwnersCount = await WorkspaceMembership.countDocuments({
        workspaceId: req.workspaceId,
        role: 'owner',
        status: 'active',
      });

      if (activeOwnersCount <= 1) {
        return res.status(400).json({
          code: 'LAST_OWNER_PROTECTION',
          message: 'Cannot deactivate the only active owner of this workspace.',
        });
      }
    }

    membership.status = 'deactivated';
    membership.deactivatedAt = new Date();
    await membership.save();

    // Evict cached context and bootstrap cache for deactivated member
    try {
      const { workspaceContextCache, invalidateUserAuthCache } = require('../utils/authCache');
      const { invalidateBootstrapCache } = require('./bootstrapController');
      if (membership.userId) {
        invalidateUserAuthCache(membership.userId);
        invalidateBootstrapCache(membership.userId, req.workspaceId);
      }
      if (workspaceContextCache && typeof workspaceContextCache.deleteMatching === 'function') {
        workspaceContextCache.deleteMatching((key) => key.startsWith(String(membership.userId)));
      }
    } catch (_) {}

    res.json({
      success: true,
      message: 'Member has been deactivated from the workspace',
    });
  } catch (error) {
    console.error('deactivateMember error:', error);
    res.status(500).json({ message: 'Server error deactivating member' });
  }
};

/**
 * @desc List system and custom roles for current workspace
 * @route GET /api/workspace/roles
 * @access Private
 */
exports.getRoles = async (req, res) => {
  try {
    const customRoles = await Role.find({ workspaceId: req.workspaceId }).lean();
    const ws = await Workspace.findById(req.workspaceId).select('rolePermissions').lean();
    const dynamicPerms = ws?.rolePermissions || {};

    const systemRoles = [
      { name: 'owner', label: 'Owner', description: 'Complete workspace authority and billing control', isSystem: true, permissions: DEFAULT_ROLE_PERMISSIONS.owner },
      { name: 'manager', label: 'Manager', description: 'Team lead operational control and assignment authority', isSystem: true, permissions: dynamicPerms['manager'] || DEFAULT_ROLE_PERMISSIONS.manager },
      { name: 'counsellor', label: 'Counsellor', description: 'Assigned student leads, tele-counseling, and follow-ups', isSystem: true, permissions: dynamicPerms['counsellor'] || DEFAULT_ROLE_PERMISSIONS.counsellor },
      { name: 'auditor', label: 'Auditor / Read-Only', description: 'Read-only access to leads, admissions, and audit logs', isSystem: true, permissions: dynamicPerms['auditor'] || DEFAULT_ROLE_PERMISSIONS.auditor },
    ];

    res.json({
      success: true,
      systemRoles,
      customRoles,
      permissionCatalogue: PERMISSIONS,
    });
  } catch (error) {
    console.error('getRoles error:', error);
    res.status(500).json({ message: 'Server error retrieving roles' });
  }
};

/**
 * @desc Update permissions for a standard system role in current workspace
 * @route PUT /api/workspace/roles/system/:roleName
 * @access Private (Owner / roles.manage)
 */
exports.updateSystemRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    const { permissions } = req.body;

    if (!['manager', 'counsellor', 'auditor'].includes(roleName)) {
      return res.status(400).json({
        code: 'INVALID_SYSTEM_ROLE',
        message: 'Only manager, counsellor, and auditor system roles can be dynamically modified. Owner role is immutable.',
      });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Permissions array is required' });
    }

    // Validate that all permissions exist in the system catalogue with valid scope
    const validScopes = new Set(['own', 'team', 'workspace']);
    for (const p of permissions) {
      if (!p || typeof p !== 'object' || !p.key || !PERMISSIONS[p.key]) {
        return res.status(400).json({
          code: 'INVALID_PERMISSION_KEY',
          message: `Permission key '${p?.key}' is not recognized in the system catalogue.`,
        });
      }
      const scope = p.scope || 'workspace';
      if (!validScopes.has(scope)) {
        return res.status(400).json({
          code: 'INVALID_PERMISSION_SCOPE',
          message: `Invalid scope '${scope}' for permission '${p.key}'. Allowed: own, team, workspace.`,
        });
      }
    }

    // Privilege Escalation Guard: Non-owners cannot grant permissions or scopes they lack
    if (req.membership && req.membership.role !== 'owner') {
      const actorPerms = await req.membership.getEffectivePermissions();
      const actorPermMap = new Map(actorPerms.map(p => [p.key, p.scope || 'workspace']));
      const SCOPE_LEVELS = { workspace: 3, team: 2, own: 1, restricted: 0 };

      for (const p of permissions) {
        if (!actorPermMap.has(p.key)) {
          return res.status(403).json({
            code: 'PRIVILEGE_ESCALATION_PREVENTED',
            message: `Cannot grant permission '${p.key}' which you do not possess.`,
          });
        }
        const grantedScopeLevel = SCOPE_LEVELS[p.scope || 'workspace'] || 0;
        const actorScopeLevel = SCOPE_LEVELS[actorPermMap.get(p.key)] || 0;
        if (grantedScopeLevel > actorScopeLevel) {
          return res.status(403).json({
            code: 'PRIVILEGE_ESCALATION_PREVENTED',
            message: `Scope privilege escalation: Cannot grant permission '${p.key}' with scope '${p.scope || 'workspace'}' exceeding your own scope '${actorPermMap.get(p.key)}'.`,
          });
        }
      }
    }

    const workspace = await Workspace.findById(req.workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.rolePermissions) {
      workspace.rolePermissions = new Map();
    }
    workspace.rolePermissions.set(roleName, permissions);
    await workspace.save();

    // Cache eviction across all members with this role
    try {
      const { workspaceContextCache, invalidateUserAuthCache } = require('../utils/authCache');
      const { invalidateBootstrapCache } = require('./bootstrapController');
      const affectedMembers = await WorkspaceMembership.find({
        workspaceId: workspace._id,
        role: roleName,
      }).select('userId').lean();

      for (const m of affectedMembers) {
        if (m.userId) {
          invalidateUserAuthCache(m.userId);
          invalidateBootstrapCache(m.userId, workspace._id);
        }
      }

      if (workspaceContextCache && typeof workspaceContextCache.clear === 'function') {
        workspaceContextCache.clear();
      }
    } catch (_) {}

    res.json({
      success: true,
      message: `System role "${roleName}" permissions updated successfully`,
      roleName,
      permissions,
    });
  } catch (error) {
    console.error('updateSystemRole error:', error);
    res.status(500).json({ message: 'Server error updating system role permissions' });
  }
};

/**
 * @desc Update granular permission overrides for an individual member
 * @route PUT /api/workspace/members/:id/permissions
 * @access Private (Owner / roles.manage)
 */
exports.updateMemberPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionOverrides } = req.body;

    if (!Array.isArray(permissionOverrides)) {
      return res.status(400).json({ message: 'permissionOverrides array is required' });
    }

    const membership = await WorkspaceMembership.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    });

    if (!membership) {
      return res.status(404).json({ message: 'Member not found in this workspace' });
    }

    // Owner cannot have their root privileges curtailed or overridden
    if (membership.role === 'owner') {
      return res.status(400).json({
        code: 'OWNER_PERMISSIONS_IMMUTABLE',
        message: 'Owner permissions are root-level and cannot have overrides applied.',
      });
    }

    // Validate that all permissions exist in the system catalogue
    const validScopes = new Set(['own', 'team', 'workspace']);
    for (const p of permissionOverrides) {
      if (!p || typeof p !== 'object' || !p.key || !PERMISSIONS[p.key]) {
        return res.status(400).json({
          code: 'INVALID_PERMISSION_KEY',
          message: `Permission key '${p?.key}' is not recognized in the system catalogue.`,
        });
      }
      const scope = p.scope || 'workspace';
      if (!validScopes.has(scope)) {
        return res.status(400).json({
          code: 'INVALID_PERMISSION_SCOPE',
          message: `Invalid scope '${scope}' for permission '${p.key}'. Allowed: own, team, workspace.`,
        });
      }
    }

    // Privilege Escalation Guard: Non-owners cannot grant permissions or scopes they lack
    if (req.membership && req.membership.role !== 'owner') {
      const actorPerms = await req.membership.getEffectivePermissions();
      const actorPermMap = new Map(actorPerms.map(p => [p.key, p.scope || 'workspace']));
      const SCOPE_LEVELS = { workspace: 3, team: 2, own: 1, restricted: 0 };

      for (const p of permissionOverrides) {
        if (p.granted !== false) {
          if (!actorPermMap.has(p.key)) {
            return res.status(403).json({
              code: 'PRIVILEGE_ESCALATION_PREVENTED',
              message: `Cannot grant permission '${p.key}' which you do not possess.`,
            });
          }
          const grantedScopeLevel = SCOPE_LEVELS[p.scope || 'workspace'] || 0;
          const actorScopeLevel = SCOPE_LEVELS[actorPermMap.get(p.key)] || 0;
          if (grantedScopeLevel > actorScopeLevel) {
            return res.status(403).json({
              code: 'PRIVILEGE_ESCALATION_PREVENTED',
              message: `Scope privilege escalation: Cannot grant permission '${p.key}' with scope '${p.scope || 'workspace'}' exceeding your own scope '${actorPermMap.get(p.key)}'.`,
            });
          }
        }
      }
    }

    membership.permissionOverrides = permissionOverrides;
    await membership.save();

    // Cache eviction
    try {
      const { workspaceContextCache, invalidateUserAuthCache } = require('../utils/authCache');
      const { invalidateBootstrapCache } = require('./bootstrapController');
      if (membership.userId) {
        invalidateUserAuthCache(membership.userId);
        invalidateBootstrapCache(membership.userId, req.workspaceId);
      }
      if (workspaceContextCache && typeof workspaceContextCache.deleteMatching === 'function') {
        workspaceContextCache.deleteMatching((key) => key.startsWith(String(membership.userId)));
      }
    } catch (_) {}

    const effectivePermissions = await membership.getEffectivePermissions();

    res.json({
      success: true,
      message: 'Member permissions updated successfully',
      permissionOverrides: membership.permissionOverrides,
      hasCustomPermissions: Boolean(membership.permissionOverrides && membership.permissionOverrides.length > 0),
      effectivePermissions,
    });
  } catch (error) {
    console.error('updateMemberPermissions error:', error);
    res.status(500).json({ message: 'Server error updating member permissions' });
  }
};

/**
 * @desc Create a custom role in current workspace
 * @route POST /api/workspace/roles
 * @access Private (roles.manage)
 */
exports.createCustomRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Permissions array is required' });
    }

    // Validate that all permissions exist in the system catalogue with valid scope
    const validScopes = new Set(['own', 'team', 'workspace']);
    for (const p of permissions) {
      if (!p || typeof p !== 'object' || !p.key || !PERMISSIONS[p.key]) {
        return res.status(400).json({
          code: 'INVALID_PERMISSION_KEY',
          message: `Permission key '${p?.key}' is not recognized in the system catalogue.`,
        });
      }
      const scope = p.scope || 'workspace';
      if (!validScopes.has(scope)) {
        return res.status(400).json({
          code: 'INVALID_PERMISSION_SCOPE',
          message: `Invalid scope '${scope}' for permission '${p.key}'. Allowed: own, team, workspace.`,
        });
      }
    }

    // Privilege Escalation Guard: Non-owners cannot grant permissions or scopes they lack
    if (req.membership && req.membership.role !== 'owner') {
      const actorPerms = await req.membership.getEffectivePermissions();
      const actorPermMap = new Map(actorPerms.map(p => [p.key, p.scope || 'workspace']));
      const SCOPE_LEVELS = { workspace: 3, team: 2, own: 1, restricted: 0 };

      for (const p of permissions) {
        if (!actorPermMap.has(p.key)) {
          return res.status(403).json({
            code: 'PRIVILEGE_ESCALATION_PREVENTED',
            message: `Cannot grant permission '${p.key}' which you do not possess.`,
          });
        }
        const grantedScopeLevel = SCOPE_LEVELS[p.scope || 'workspace'] || 0;
        const actorScopeLevel = SCOPE_LEVELS[actorPermMap.get(p.key)] || 0;
        if (grantedScopeLevel > actorScopeLevel) {
          return res.status(403).json({
            code: 'PRIVILEGE_ESCALATION_PREVENTED',
            message: `Scope privilege escalation: Cannot grant permission '${p.key}' with scope '${p.scope || 'workspace'}' exceeding your own scope '${actorPermMap.get(p.key)}'.`,
          });
        }
      }
    }

    const role = await Role.create({
      workspaceId: req.workspaceId,
      name: name.trim(),
      description: description ? description.trim() : '',
      isSystem: false,
      permissions,
    });

    res.status(201).json({
      success: true,
      message: `Custom role "${role.name}" created successfully`,
      role,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A role with this name already exists in this workspace' });
    }
    console.error('createCustomRole error:', error);
    res.status(500).json({ message: 'Server error creating custom role' });
  }
};

/**
 * @desc Update a custom role
 * @route PUT /api/workspace/roles/:id
 * @access Private (roles.manage)
 */
exports.updateCustomRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await Role.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.isSystem) {
      return res.status(400).json({ success: false, message: 'System roles cannot be modified' });
    }

    // Validate permissions array if provided
    if (Array.isArray(permissions)) {
      const validScopes = new Set(['own', 'team', 'workspace']);
      for (const p of permissions) {
        if (!p || typeof p !== 'object' || !p.key || !PERMISSIONS[p.key]) {
          return res.status(400).json({
            code: 'INVALID_PERMISSION_KEY',
            message: `Permission key '${p?.key}' is not recognized in the system catalogue.`,
          });
        }
        const scope = p.scope || 'workspace';
        if (!validScopes.has(scope)) {
          return res.status(400).json({
            code: 'INVALID_PERMISSION_SCOPE',
            message: `Invalid scope '${scope}' for permission '${p.key}'. Allowed: own, team, workspace.`,
          });
        }
      }

      // Privilege Escalation Guard: Non-owners cannot grant permissions or scopes they lack
      if (req.membership && req.membership.role !== 'owner') {
        const actorPerms = await req.membership.getEffectivePermissions();
        const actorPermMap = new Map(actorPerms.map(p => [p.key, p.scope || 'workspace']));
        const SCOPE_LEVELS = { workspace: 3, team: 2, own: 1, restricted: 0 };

        for (const p of permissions) {
          if (!actorPermMap.has(p.key)) {
            return res.status(403).json({
              code: 'PRIVILEGE_ESCALATION_PREVENTED',
              message: `Cannot grant permission '${p.key}' which you do not possess.`,
            });
          }
          const grantedScopeLevel = SCOPE_LEVELS[p.scope || 'workspace'] || 0;
          const actorScopeLevel = SCOPE_LEVELS[actorPermMap.get(p.key)] || 0;
          if (grantedScopeLevel > actorScopeLevel) {
            return res.status(403).json({
              code: 'PRIVILEGE_ESCALATION_PREVENTED',
              message: `Scope privilege escalation: Cannot grant permission '${p.key}' with scope '${p.scope || 'workspace'}' exceeding your own scope '${actorPermMap.get(p.key)}'.`,
            });
          }
        }
      }
    }

    if (name && name.trim()) role.name = name.trim();
    if (description !== undefined) role.description = description.trim();
    if (Array.isArray(permissions)) role.permissions = permissions;

    await role.save();

    // Invalidate caches for all members assigned to this custom role
    try {
      const { workspaceContextCache, invalidateUserAuthCache } = require('../utils/authCache');
      const { invalidateBootstrapCache } = require('./bootstrapController');
      const affectedMembers = await WorkspaceMembership.find({ customRoleId: role._id }).select('userId workspaceId').lean();
      for (const m of affectedMembers) {
        if (m.userId) {
          invalidateUserAuthCache(m.userId);
          invalidateBootstrapCache(m.userId, m.workspaceId);
        }
      }
      if (workspaceContextCache && typeof workspaceContextCache.clear === 'function') {
        workspaceContextCache.clear();
      }
    } catch (_) {}

    res.json({
      success: true,
      message: `Role "${role.name}" updated successfully`,
      role,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A role with this name already exists in this workspace' });
    }
    console.error('updateCustomRole error:', error);
    res.status(500).json({ success: false, message: 'Server error updating custom role' });
  }
};

/**
 * @desc Delete a custom role
 * @route DELETE /api/workspace/roles/:id
 * @access Private (roles.manage)
 */
exports.deleteCustomRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.isSystem) {
      return res.status(400).json({ success: false, message: 'System roles cannot be deleted' });
    }

    // Check if any member has this custom role
    const membersWithRole = await WorkspaceMembership.countDocuments({
      workspaceId: req.workspaceId,
      customRoleId: role._id,
      status: 'active',
    });

    if (membersWithRole > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role: ${membersWithRole} member(s) currently have this role assigned. Reassign them first.`,
      });
    }

    await Role.deleteOne({ _id: role._id });

    try {
      const { workspaceContextCache } = require('../utils/authCache');
      if (workspaceContextCache && typeof workspaceContextCache.clear === 'function') {
        workspaceContextCache.clear();
      }
    } catch (_) {}

    res.json({
      success: true,
      message: 'Custom role deleted successfully',
    });
  } catch (error) {
    console.error('deleteCustomRole error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting custom role' });
  }
};

