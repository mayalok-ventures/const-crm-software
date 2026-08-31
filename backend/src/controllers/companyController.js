const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const Role = require('../models/Role');
const { generateUniqueUsername } = require('../utils/generateUsername');
const { generateUniqueUsercode } = require('../utils/generateUsercode');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

// @desc  Get company agents and performance metrics
// @route GET /api/company/agents
// @access Private (Company Owner or mapped Agent)
exports.getCompanyAgents = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = isOwner ? req.user._id : req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ message: 'User is not associated with any organization.' });
    }

    const company = await User.findById(companyId).select('name usercode companyInfo companySettings');
    const agents = await User.find({ companyId })
      .select('name email phone usercode role roleId companyRole employeeStatus managerId companyJoinMethod companyLeaveRequest allowCompanyWhatsApp defaultSender createdAt lastLogin')
      .populate('roleId', 'name roleType permissions')
      .populate('managerId', 'name email usercode')
      .lean();

    const incentiveRate = company?.companySettings?.incentivePerConversion || 0;

    // Calculate per-agent performance metrics
    const enrichedAgents = await Promise.all(
      agents.map(async (agent) => {
        const totalLeads = await Lead.countDocuments({
          $or: [
            { assignedTo: agent._id },
            { userId: agent._id, companyId }
          ]
        });

        const closedLeads = await Lead.countDocuments({
          $or: [
            { assignedTo: agent._id },
            { userId: agent._id, companyId }
          ],
          status: 'closed'
        });

        const siteVisits = await Lead.countDocuments({
          $or: [
            { assignedTo: agent._id },
            { userId: agent._id, companyId }
          ],
          status: 'site_visit_scheduled'
        });

        const earnedIncentives = closedLeads * incentiveRate;

        return {
          ...agent,
          totalLeads,
          closedLeads,
          siteVisits,
          earnedIncentives,
        };
      })
    );

    res.json({
      company,
      agents: enrichedAgents,
    });
  } catch (error) {
    console.error('getCompanyAgents error:', error);
    res.status(500).json({ message: 'Failed to fetch organization team members' });
  }
};

// @desc  Create a new sub-agent directly by Company Owner
// @route POST /api/company/agents
// @access Private (Company Owner)
exports.createCompanyAgent = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    if (!isOwner) {
      return res.status(403).json({ message: 'Only organization owners can create team members directly.' });
    }

    // ─────────────────────────────────────────────────────────────
    // CENTRALIZED TEAM SEAT CAP ENFORCEMENT
    // ─────────────────────────────────────────────────────────────
    try {
      const { assertLimit } = require('../services/entitlementService');
      await assertLimit(req.user._id, 'seats', 1);
    } catch (seatErr) {
      return res.status(seatErr.statusCode || 403).json({
        success: false,
        code: seatErr.code || 'PLAN_LIMIT_EXCEEDED',
        message: seatErr.message || 'You have reached the maximum team seats allowed on your plan. Please upgrade to add more agents.',
        resource: 'seats',
        limit: seatErr.limit,
        currentUsage: seatErr.currentUsage,
        upgradeRequired: true,
      });
    }

    const { name, email, phone, password, role, companyRole, roleId, managerId } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }
    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone required' });
    }

    const cleanPhone = phone ? phone.replace(/\D/g, '') : undefined;

    if (email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(400).json({ message: 'Email already registered' });
    }

    const username = await generateUniqueUsername(User);

    // Determine role & companyRole
    let finalRole = 'agent';
    let finalCompanyRole = 'agent';
    let cleanRoleId = null;

    if (roleId && mongoose.Types.ObjectId.isValid(roleId) && !String(roleId).startsWith('default_')) {
      const roleDoc = await Role.findById(roleId);
      if (roleDoc) {
        cleanRoleId = roleDoc._id;
        if (roleDoc.roleType === 'MANAGER' || roleDoc.name?.toLowerCase().includes('manager')) {
          finalRole = 'manager';
          finalCompanyRole = 'manager';
        }
      }
    } else if (roleId === 'default_manager' || (typeof roleId === 'string' && roleId.toLowerCase().includes('manager'))) {
      finalRole = 'manager';
      finalCompanyRole = 'manager';
    }

    if (role === 'manager' || companyRole === 'manager') {
      finalRole = 'manager';
      finalCompanyRole = 'manager';
    } else if (companyRole) {
      finalCompanyRole = companyRole;
      if (['manager', 'admin', 'agent'].includes(companyRole)) {
        finalRole = companyRole;
      } else {
        finalRole = 'agent';
      }
    } else if (role) {
      finalRole = role === 'manager' ? 'manager' : 'agent';
      finalCompanyRole = role;
    }

    const usercode = await generateUniqueUsercode(User, finalRole === 'manager' ? 'MGR' : 'REA');

    let managerName = '';
    let cleanManagerId = null;
    if (managerId && finalRole !== 'manager' && mongoose.Types.ObjectId.isValid(managerId) && !String(managerId).startsWith('default_')) {
      const mgr = await User.findById(managerId);
      if (mgr) {
        cleanManagerId = mgr._id;
        managerName = mgr.name;
      }
    }

    const agentData = {
      name: name.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      phone: cleanPhone,
      password,
      username,
      usercode,
      role: finalRole,
      companyRole: finalCompanyRole,
      workStatus: finalRole === 'manager' ? 'employee' : 'independent_agent',
      industryType: req.user.industryType || 'Real Estate',
      educationSubProfile: req.user.educationSubProfile || null,
      managerName: finalRole === 'manager' ? '' : managerName,
      managerId: finalRole === 'manager' ? null : cleanManagerId,
      companyId: req.user._id,
      connectedCompanyId: req.user._id,
      companyJoinMethod: 'created_by_company', // SMART PERMISSION: Created by company
      companyLeaveRequest: 'none',
      allowCompanyWhatsApp: req.user.companySettings?.allowAgentCompanyWhatsApp ?? true,
    };

    if (cleanRoleId) agentData.roleId = cleanRoleId;

    const agent = await User.create(agentData);

    const populatedAgent = await User.findById(agent._id)
      .populate('roleId', 'name roleType permissions')
      .populate('managerId', 'name email usercode')
      .lean();

    res.status(201).json({
      message: `Team member ${agent.name} created successfully ✅`,
      agent: populatedAgent,
    });
  } catch (error) {
    console.error('createCompanyAgent error:', error);
    res.status(500).json({ message: error.message || 'Failed to create team member' });
  }
};

// @desc  Join a Company using company usercode (Voluntary Join)
// @route POST /api/company/join
// @access Private (Solo Agent)
exports.joinCompany = async (req, res) => {
  try {
    if (req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner') {
      return res.status(400).json({ message: 'Organization owners cannot join other organizations' });
    }

    const { usercode } = req.body;
    if (!usercode) return res.status(400).json({ message: 'Organization usercode is required' });

    const cleanCode = String(usercode).trim().toUpperCase();

    const company = await User.findOne({
      usercode: cleanCode,
      workStatus: 'company_owner',
    });

    if (!company) {
      return res.status(404).json({ message: 'Organization not found with this usercode' });
    }

    if (String(company._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot join your own organization account' });
    }

    // Check organization roster limit
    const { PLAN_LIMITS } = require('../utils/planLimits');
    const companyPlan = company.plan || 'free';
    const limits = PLAN_LIMITS[companyPlan] || PLAN_LIMITS.free;
    const maxUsers = limits?.maxUsers || 10;

    const currentAgentCount = await User.countDocuments({ companyId: company._id });
    if (currentAgentCount >= maxUsers) {
      return res.status(403).json({
        code: 'ROSTER_LIMIT_REACHED',
        message: `This organization has reached its maximum team member limit (${maxUsers} seat(s) on ${limits?.name || companyPlan}). Please ask the organization owner to upgrade their plan.`,
        currentCount: currentAgentCount,
        maxUsers,
      });
    }

    const agent = await User.findById(req.user._id);
    agent.companyId = company._id;
    agent.companyRole = 'agent';
    agent.companyJoinMethod = 'joined_voluntarily'; // SMART PERMISSION: Joined voluntarily
    agent.companyLeaveRequest = 'none';
    agent.allowCompanyWhatsApp = company.companySettings?.allowAgentCompanyWhatsApp ?? true;
    await agent.save();

    // Notify company owner
    await Notification.create({
      userId: company._id,
      title: '👋 New Team Member Joined',
      message: `${agent.name} (${agent.usercode}) has voluntarily joined your organization team.`,
      type: 'agent_joined',
    });

    res.json({
      message: `Successfully joined ${company.companyInfo?.companyName || company.name}! 🏢`,
      company: {
        _id: company._id,
        name: company.name,
        usercode: company.usercode,
        companyInfo: company.companyInfo,
        companySettings: company.companySettings,
      },
    });
  } catch (error) {
    console.error('joinCompany error:', error);
    res.status(500).json({ message: 'Failed to join organization' });
  }
};

// @desc  Smart Leave / Detach from Company
// @route POST /api/company/leave
// @access Private (Agent)
exports.leaveCompany = async (req, res) => {
  try {
    const agent = await User.findById(req.user._id);
    if (!agent.companyId) {
      return res.status(400).json({ message: 'You are not linked to any organization' });
    }

    const companyOwnerId = agent.companyId;

    // Case 1: Joined voluntarily -> Instant detachment with mutual notification
    if (agent.companyJoinMethod === 'joined_voluntarily' || !agent.companyJoinMethod || agent.companyJoinMethod === 'none') {
      agent.companyId = null;
      agent.companyRole = 'solo';
      agent.companyJoinMethod = 'none';
      agent.companyLeaveRequest = 'none';
      agent.allowCompanyWhatsApp = false;
      agent.exportPermissionStatus = 'allowed';
      await agent.save();

      // Return any company-owned assigned leads to company common pool
      await Lead.updateMany(
        { companyId: companyOwnerId, assignedTo: agent._id },
        {
          $set: { assignedTo: null, assignedToName: '' },
          $push: {
            leadActivities: {
              action: 'lead_reassigned',
              performedBy: agent._id,
              performerName: agent.name,
              details: `Agent ${agent.name} voluntarily detached. Lead returned to Company Common Pool.`,
              timestamp: new Date(),
            }
          }
        }
      );

      // Notify company owner
      await Notification.create({
        userId: companyOwnerId,
        title: 'Team Member Left (Voluntary)',
        message: `${agent.name} (${agent.usercode}) has voluntarily detached from your organization. Assigned company leads returned to common pool.`,
        type: 'agent_left',
      });

      return res.json({
        detached: true,
        message: 'You have successfully left the organization and returned to solo status.',
      });
    }

    // Case 2: Created by company -> Request approval required
    if (agent.companyJoinMethod === 'created_by_company') {
      agent.companyLeaveRequest = 'pending';
      await agent.save();

      // Notify company owner
      await Notification.create({
        userId: companyOwnerId,
        title: '⏳ Agent Leave Request',
        message: `${agent.name} (${agent.usercode}) has requested to leave your organization. Please review in Team Settings.`,
        type: 'leave_request',
      });

      return res.json({
        detached: false,
        pending: true,
        message: 'Leave request submitted to your Organization Admin for approval.',
      });
    }
  } catch (error) {
    console.error('leaveCompany error:', error);
    res.status(500).json({ message: 'Failed to process leave request' });
  }
};

// @desc  Approve Agent Leave Request (Company Owner only)
// @route POST /api/company/agents/:agentId/approve-leave
// @access Private (Company Owner)
exports.approveAgentLeave = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    if (!isOwner) {
      return res.status(403).json({ message: 'Only organization owners can approve leave requests' });
    }

    const { agentId } = req.params;
    const agent = await User.findOne({ _id: agentId, companyId: req.user._id });
    if (!agent) return res.status(404).json({ message: 'Team member not found in your organization' });

    // Rule A: Company permanently owns data. Automatically reassign all agent's leads to company common pool
    await Lead.updateMany(
      {
        $or: [
          { assignedTo: agent._id },
          { userId: agent._id, companyId: req.user._id }
        ]
      },
      {
        $set: {
          userId: req.user._id,
          assignedTo: null,
          assignedToName: '',
        },
        $push: {
          leadActivities: {
            action: 'lead_reassigned',
            performedBy: req.user._id,
            performerName: req.user.name,
            details: `Agent ${agent.name} detached. Lead reclaimed and returned to Company Common Pool.`,
            timestamp: new Date(),
          }
        }
      }
    );

    agent.companyId = null;
    agent.companyRole = 'solo';
    agent.companyJoinMethod = 'none';
    agent.companyLeaveRequest = 'none';
    agent.allowCompanyWhatsApp = false;
    agent.exportPermissionStatus = 'allowed';
    await agent.save();

    await Notification.create({
      userId: agent._id,
      title: '✅ Leave Request Approved',
      message: `Your organization admin has approved your detachment. You are now in solo mode.`,
      type: 'leave_approved',
    });

    res.json({ message: `Approved leave request for ${agent.name}. Member detached and all leads returned to common pool.` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve leave request' });
  }
};

// @desc  Reject Agent Leave Request (Company Owner only)
// @route POST /api/company/agents/:agentId/reject-leave
// @access Private (Company Owner)
exports.rejectAgentLeave = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    if (!isOwner) {
      return res.status(403).json({ message: 'Only organization owners can reject leave requests' });
    }

    const { agentId } = req.params;
    const agent = await User.findOne({ _id: agentId, companyId: req.user._id });
    if (!agent) return res.status(404).json({ message: 'Team member not found in your organization' });

    agent.companyLeaveRequest = 'none';
    await agent.save();

    await Notification.create({
      userId: agent._id,
      title: '❌ Leave Request Rejected',
      message: `Your organization admin declined your request to detach.`,
      type: 'leave_rejected',
    });

    res.json({ message: `Declined leave request for ${agent.name}.` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject leave request' });
  }
};

// @desc  Update Agent Permissions (toggle Company WhatsApp access & Export permissions)
// @route PUT /api/company/agents/:agentId/permissions
// @access Private (Company Owner)
exports.updateAgentPermissions = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    if (!isOwner) {
      return res.status(403).json({ message: 'Only organization owners can update permissions' });
    }

    const { agentId } = req.params;
    const { allowCompanyWhatsApp, exportPermissionStatus } = req.body;

    const agent = await User.findOne({ _id: agentId, companyId: req.user._id });
    if (!agent) return res.status(404).json({ message: 'Team member not found in your organization' });

    if (allowCompanyWhatsApp !== undefined) {
      agent.allowCompanyWhatsApp = Boolean(allowCompanyWhatsApp);
    }
    if (exportPermissionStatus !== undefined && ['allowed', 'restricted', 'pending_approval'].includes(exportPermissionStatus)) {
      agent.exportPermissionStatus = exportPermissionStatus;
    }
    await agent.save();

    res.json({
      message: `Updated permissions for ${agent.name}`,
      agent: {
        _id: agent._id,
        name: agent.name,
        allowCompanyWhatsApp: agent.allowCompanyWhatsApp,
        exportPermissionStatus: agent.exportPermissionStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update agent permissions' });
  }
};

// @desc  Remove an agent from the company (Force Detach by Owner with Lead Reclamation)
// @route DELETE /api/company/agents/:agentId
// @access Private (Company Owner)
exports.removeAgent = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    if (!isOwner) {
      return res.status(403).json({ message: 'Only organization owners can remove team members' });
    }

    const { agentId } = req.params;
    const agent = await User.findOne({ _id: agentId, companyId: req.user._id });
    if (!agent) return res.status(404).json({ message: 'Team member not found in your organization' });

    // Rule A: Reclaim all leads created by or assigned to this agent back to common pool
    await Lead.updateMany(
      {
        $or: [
          { assignedTo: agent._id },
          { userId: agent._id, companyId: req.user._id }
        ]
      },
      {
        $set: {
          userId: req.user._id,
          assignedTo: null,
          assignedToName: '',
        },
        $push: {
          leadActivities: {
            action: 'lead_reassigned',
            performedBy: req.user._id,
            performerName: req.user.name,
            details: `Agent ${agent.name} removed by Admin. Lead returned to Company Common Pool.`,
            timestamp: new Date(),
          }
        }
      }
    );

    agent.companyId = null;
    agent.companyRole = 'solo';
    agent.companyJoinMethod = 'none';
    agent.companyLeaveRequest = 'none';
    agent.allowCompanyWhatsApp = false;
    agent.exportPermissionStatus = 'allowed';
    await agent.save();

    await Notification.create({
      userId: agent._id,
      title: 'Detached from Organization',
      message: `You have been removed from the organization team by the admin.`,
      type: 'agent_removed',
    });

    res.json({ message: `Team member ${agent.name} has been detached and leads returned to common pool.` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove team member' });
  }
};

// @desc  Update Company Agency Settings (Lead sharing mode, incentives, company info)
// @route PUT /api/company/settings
// @access Private (Company Owner)
exports.updateCompanySettings = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    if (!isOwner) {
      return res.status(403).json({ message: 'Only organization owners can update settings' });
    }

    const { companySettings, companyInfo } = req.body;
    const user = await User.findById(req.user._id);

    if (companySettings) {
      user.companySettings = {
        ...user.companySettings,
        ...companySettings,
      };
    }
    if (companyInfo) {
      user.companyInfo = {
        ...user.companyInfo,
        ...companyInfo,
      };
    }

    await user.save();
    res.json({
      message: 'Organization settings updated successfully ✅',
      companySettings: user.companySettings,
      companyInfo: user.companyInfo,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update organization settings' });
  }
};

// @desc  Get master company performance dashboard
// @route GET /api/company/dashboard
// @access Private (Company Owner or mapped Agent)
exports.getCompanyDashboard = async (req, res) => {
  try {
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = isOwner ? req.user._id : req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ message: 'No organization linked' });
    }

    const company = await User.findById(companyId).select('name usercode companyInfo companySettings').lean();
    const agents = await User.find({ companyId }).select('name email usercode').lean();

    const companyLeadFilter = {
      $or: [
        { userId: companyId },
        { companyId },
        { userId: { $in: agents.map(a => a._id) } }
      ]
    };

    const totalLeads = await Lead.countDocuments(companyLeadFilter);
    const closedLeads = await Lead.countDocuments({ ...companyLeadFilter, status: 'closed' });
    const siteVisits = await Lead.countDocuments({ ...companyLeadFilter, status: 'site_visit_scheduled' });
    const negotiations = await Lead.countDocuments({ ...companyLeadFilter, status: 'negotiation' });
    const paymentsDone = await Lead.countDocuments({ ...companyLeadFilter, status: 'payment_done' });

    // Pipeline status distribution
    const statusCounts = await Lead.aggregate([
      { $match: companyLeadFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });

    // Total Closed Revenue Aggregation
    const revenueAgg = await Lead.aggregate([
      {
        $match: {
          ...companyLeadFilter,
          status: { $in: ['closed', 'Closed', 'Closed / Won', 'payment_done'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$closedDealAmount' },
        },
      },
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const incentiveRate = company?.companySettings?.incentivePerConversion || 0;
    const totalIncentiveLiability = closedLeads * incentiveRate;

    res.json({
      company,
      metrics: {
        totalLeads,
        closedLeads,
        totalRevenue,
        siteVisits,
        negotiations,
        paymentsDone,
        conversionRate: totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) + '%' : '0%',
        totalAgents: agents.length,
        totalIncentiveLiability,
        statusBreakdown: statusMap,
      }
    });
  } catch (error) {
    console.error('getCompanyDashboard error:', error);
    res.status(500).json({ message: 'Failed to load organization dashboard' });
  }
};

// @desc  Export Organization Performance Analytics Report (Excel / PDF)
// @route GET /api/company/analytics/export
// @access Private (Company Owner)
exports.exportCompanyAnalytics = async (req, res) => {
  try {
    const { format = 'xlsx' } = req.query;
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = isOwner ? req.user._id : req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ message: 'No organization linked' });
    }

    const company = await User.findById(companyId).select('name usercode companyInfo companySettings').lean();
    const agents = await User.find({ companyId }).select('name email usercode').lean();

    const companyLeadFilter = {
      $or: [
        { userId: companyId },
        { companyId },
        { userId: { $in: agents.map(a => a._id) } }
      ]
    };

    const [totalLeads, closedLeads, statusCounts, revenueAgg] = await Promise.all([
      Lead.countDocuments(companyLeadFilter),
      Lead.countDocuments({ ...companyLeadFilter, status: 'closed' }),
      Lead.aggregate([
        { $match: companyLeadFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Lead.aggregate([
        {
          $match: {
            ...companyLeadFilter,
            status: { $in: ['closed', 'Closed', 'Closed / Won', 'payment_done'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$closedDealAmount' },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;
    const incentiveRate = company?.companySettings?.incentivePerConversion || 0;
    const totalIncentiveLiability = closedLeads * incentiveRate;
    const conversionRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) + '%' : '0%';

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });

    // Agent breakdown calculation
    const agentMetrics = await Promise.all(
      agents.map(async (agent) => {
        const assignedLeads = await Lead.countDocuments({
          companyId,
          $or: [{ assignedTo: agent._id }, { userId: agent._id }]
        });
        const agentClosed = await Lead.countDocuments({
          companyId,
          $or: [{ assignedTo: agent._id }, { userId: agent._id }],
          status: 'closed'
        });
        const agentRevAgg = await Lead.aggregate([
          {
            $match: {
              companyId,
              $or: [{ assignedTo: agent._id }, { userId: agent._id }],
              status: { $in: ['closed', 'Closed', 'Closed / Won', 'payment_done'] },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$closedDealAmount' },
            },
          },
        ]);
        const agentRevenue = agentRevAgg[0]?.total || 0;

        return {
          name: agent.name,
          usercode: agent.usercode,
          email: agent.email,
          assignedLeads,
          closedLeads: agentClosed,
          revenueGenerated: agentRevenue,
          incentiveEarned: agentClosed * incentiveRate,
          closingRate: assignedLeads > 0 ? ((agentClosed / assignedLeads) * 100).toFixed(1) + '%' : '0%',
        };
      })
    );

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format.toLowerCase() === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="agency_analytics_${timestamp}.pdf"`);
      doc.pipe(res);

      doc.fontSize(20).font('Helvetica-Bold').text('Organization Performance & Revenue Report', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica').fillColor('#666666').text(`Organization: ${company?.name || req.user.name} | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1);

      // KPI Summary Box
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Executive Summary:');
      doc.moveDown(0.5);

      const kpis = [
        ['Total Opportunities in Pipeline', String(totalLeads)],
        ['Total Closed Deals Won', String(closedLeads)],
        ['Overall Conversion Rate', conversionRate],
        ['Total Closed Revenue (INR)', `INR ${totalRevenue.toLocaleString('en-IN')}`],
        ['Active Team Size', `${agents.length} Representatives`],
        ['Total Commission / Incentive Liability', `INR ${totalIncentiveLiability.toLocaleString('en-IN')}`],
      ];

      kpis.forEach(([label, val]) => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#4f46e5').text(`• ${label}: `, { continued: true });
        doc.font('Helvetica').fillColor('#1f2937').text(val);
      });

      doc.moveDown(1);

      // Agent Leaderboard Table
      if (agentMetrics.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Representative Leaderboard:');
        doc.moveDown(0.5);

        const tableTop = doc.y;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
        doc.text('Representative', 40, tableTop);
        doc.text('Assigned', 180, tableTop);
        doc.text('Won', 250, tableTop);
        doc.text('Win Rate', 310, tableTop);
        doc.text('Revenue (INR)', 380, tableTop);
        doc.text('Incentive (INR)', 470, tableTop);
        doc.moveTo(40, tableTop + 14).lineTo(550, tableTop + 14).strokeColor('#e5e7eb').stroke();

        let currentY = tableTop + 18;
        agentMetrics.forEach((ag) => {
          doc.fontSize(8.5).font('Helvetica').fillColor('#1f2937');
          doc.text(`${ag.name} (${ag.usercode})`, 40, currentY, { width: 135, truncate: true });
          doc.text(String(ag.assignedLeads), 180, currentY);
          doc.text(String(ag.closedLeads), 250, currentY);
          doc.text(ag.closingRate, 310, currentY);
          doc.text(ag.revenueGenerated ? ag.revenueGenerated.toLocaleString('en-IN') : '0', 380, currentY);
          doc.text(ag.incentiveEarned ? ag.incentiveEarned.toLocaleString('en-IN') : '0', 470, currentY);
          currentY += 16;
        });

        doc.moveDown(1);
      }

      doc.end();
      return;
    }

    // Excel Export
    const summarySheet = xlsx.utils.json_to_sheet([
      { 'KPI Metric': 'Organization Name', 'Value': company?.name || req.user.name },
      { 'KPI Metric': 'Total Opportunities in Pipeline', 'Value': totalLeads },
      { 'KPI Metric': 'Total Closed Deals Won', 'Value': closedLeads },
      { 'KPI Metric': 'Conversion Rate', 'Value': conversionRate },
      { 'KPI Metric': 'Total Closed Revenue (₹)', 'Value': totalRevenue },
      { 'KPI Metric': 'Active Team Size', 'Value': agents.length },
      { 'KPI Metric': 'Total Incentive Liability (₹)', 'Value': totalIncentiveLiability },
      { 'KPI Metric': 'Report Generated At', 'Value': new Date().toLocaleString() },
    ]);

    const pipelineRows = Object.entries(statusMap).map(([status, count]) => ({
      'Pipeline Stage': status.toUpperCase(),
      'Prospects Count': count,
      'Share of Pipeline': totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) + '%' : '0%',
    }));
    const pipelineSheet = xlsx.utils.json_to_sheet(pipelineRows);

    const agentRows = agentMetrics.map((ag, idx) => ({
      '#': idx + 1,
      'Representative': ag.name,
      'User Code': ag.usercode,
      'Email': ag.email,
      'Assigned Opportunities': ag.assignedLeads,
      'Closed / Won Deals': ag.closedLeads,
      'Win Rate': ag.closingRate,
      'Revenue Generated (₹)': ag.revenueGenerated,
      'Incentive Earned (₹)': ag.incentiveEarned,
    }));
    const agentSheet = xlsx.utils.json_to_sheet(agentRows);

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');
    xlsx.utils.book_append_sheet(workbook, pipelineSheet, 'Pipeline Breakdown');
    xlsx.utils.book_append_sheet(workbook, agentSheet, 'Agent Performance');

    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="agency_analytics_${timestamp}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('exportCompanyAnalytics error:', error);
    res.status(500).json({ message: 'Failed to export organization analytics report' });
  }
};
