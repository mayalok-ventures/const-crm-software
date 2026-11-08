const AssignmentCounter = require('../../models/AssignmentCounter');
const User = require('../../models/User');

class AssignmentService {
  /**
   * Determine the assigned counselor for an incoming lead or inquiry
   * using strictly atomic, concurrency-safe pointers.
   *
   * @param {Object} params
   * @param {Object} params.integration - Integration document
   * @param {Object} params.campaignOverride - Optional campaign/form specific override
   * @param {string} params.scopeKey - 'default' or override identifier
   * @param {boolean} params.isTest - If true, test leads are never assigned to counselors
   * @returns {Promise<{ assignedTo: ObjectId|null, assignedToName: string, assignmentReason: string }>}
   */
  async resolveAssignment({ integration, campaignOverride = null, scopeKey = 'default', isTest = false }) {
    // Rule 1: Test leads are NEVER assigned to real counselors
    if (isTest) {
      return {
        assignedTo: null,
        assignedToName: '',
        assignmentReason: 'Test Lead: Not assigned to counselors (Evaluation Only)',
      };
    }

    const companyId = integration.companyId || null;
    const tenantOwnerId = integration.userId;
    const rule = campaignOverride?.assignmentRule || integration.assignmentRule || { type: 'round_robin' };

    const ruleType = rule.type || 'round_robin';
    const fallbackUserId = (rule.fallbackUserId && rule.fallbackUserId._id) ? rule.fallbackUserId._id : (rule.fallbackUserId || tenantOwnerId);
    const specificCounselorId = (rule.specificCounselorId && rule.specificCounselorId._id) ? rule.specificCounselorId._id : rule.specificCounselorId;

    // Direct / Specific Counselor
    if (ruleType === 'specific_counselor' && specificCounselorId) {
      const counselor = await this.getActiveUser(specificCounselorId);
      if (counselor) {
        return {
          assignedTo: counselor._id,
          assignedToName: counselor.name || '',
          assignmentReason: `Specific Counselor Rule: Directly assigned to ${counselor.name || counselor._id}`,
        };
      }
    }

    // Fallback Only
    if (ruleType === 'fallback_only') {
      const fallbackUser = await this.getActiveUser(fallbackUserId);
      return {
        assignedTo: fallbackUser?._id || null,
        assignedToName: fallbackUser?.name || '',
        assignmentReason: `Fallback Owner Rule: Assigned to default owner ${fallbackUser?.name || 'Workspace Admin'}`,
      };
    }

    // Resolve Eligible Counselor Pool
    let eligibleCounselors = [];
    if (Array.isArray(rule.counselorPool) && rule.counselorPool.length > 0) {
      const poolUserIds = rule.counselorPool
        .map((c) => (c.userId && c.userId._id ? c.userId._id : c.userId))
        .filter(Boolean);
      const activeUsers = await User.find({
        _id: { $in: poolUserIds },
        isActive: { $ne: false },
        userStatus: { $ne: 'inactive' },
        employeeStatus: { $ne: 'inactive' },
      }).select('_id name email phone');

      const activeMap = new Map(activeUsers.map((u) => [String(u._id), u]));

      // Stably sort according to configured pool order
      for (const poolItem of rule.counselorPool) {
        const uId = String(poolItem.userId && poolItem.userId._id ? poolItem.userId._id : poolItem.userId);
        const user = activeMap.get(uId);
        if (user) {
          eligibleCounselors.push({
            user,
            weight: Math.max(1, Number(poolItem.weight) || 1),
            maxActiveLeads: poolItem.maxActiveLeads ? Number(poolItem.maxActiveLeads) : null,
          });
        }
      }
    }

    // If no pool defined or all inactive, fallback to active agents in company or workspace owner
    if (eligibleCounselors.length === 0) {
      const fallbackUser = await this.getActiveUser(fallbackUserId);
      return {
        assignedTo: fallbackUser?._id || null,
        assignedToName: fallbackUser?.name || '',
        assignmentReason: `Fallback Assignment: No active counselors available in pool. Assigned to ${fallbackUser?.name || 'Workspace Admin'}`,
      };
    }

    // -------------------------------------------------------------
    // Capacity Check: Derive terminal stages & query active counts
    // -------------------------------------------------------------
    const Pipeline = require('../../models/Pipeline');
    const Lead = require('../../models/Lead');

    const terminalStageIds = new Set();
    const terminalCategories = ['won', 'lost'];

    try {
      const pipelineFilter = integration.workspaceId
        ? { workspaceId: integration.workspaceId, isActive: true }
        : integration.companyId
        ? { companyId: integration.companyId, isActive: true }
        : { isActive: true };

      const pipelines = await Pipeline.find(pipelineFilter).lean();
      for (const p of pipelines) {
        if (Array.isArray(p.stages)) {
          for (const s of p.stages) {
            if (terminalCategories.includes(String(s.category).toLowerCase())) {
              terminalStageIds.add(s.stageId);
              if (s.name) terminalStageIds.add(s.name);
            }
          }
        }
      }
    } catch (pErr) {
      console.warn('[AssignmentService] Pipeline lookup warning:', pErr.message);
    }

    // Include default schema terminal stages
    if (Array.isArray(Pipeline.DEFAULT_ADMISSION_STAGES)) {
      for (const s of Pipeline.DEFAULT_ADMISSION_STAGES) {
        if (terminalCategories.includes(String(s.category).toLowerCase())) {
          terminalStageIds.add(s.stageId);
          if (s.name) terminalStageIds.add(s.name);
        }
      }
    }

    const terminalList = Array.from(terminalStageIds).concat([
      'won',
      'lost',
      'closed won',
      'closed lost',
      'Admission Confirmed',
      'Not Interested',
    ]);

    const eligibleUserIds = eligibleCounselors.map((c) => c.user._id);
    const leadMatch = {
      assignedTo: { $in: eligibleUserIds },
      deletedAt: null,
      status: { $nin: terminalList },
      pipelineStage: { $nin: terminalList },
    };
    if (integration.workspaceId) leadMatch.workspaceId = integration.workspaceId;
    else if (integration.companyId) leadMatch.companyId = integration.companyId;

    const activeCountsAgg = await Lead.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$assignedTo', activeCount: { $sum: 1 } } },
    ]);

    const activeCountMap = new Map();
    for (const item of activeCountsAgg) {
      activeCountMap.set(String(item._id), item.activeCount);
    }

    for (const item of eligibleCounselors) {
      item.currentActiveLeads = activeCountMap.get(String(item.user._id)) || 0;
    }

    // Filter available counselors (under maxActiveLeads cap)
    const availableCounselors = eligibleCounselors.filter(
      (c) => c.maxActiveLeads === null || c.maxActiveLeads === undefined || c.currentActiveLeads < c.maxActiveLeads
    );

    let candidates = availableCounselors;
    let isCapacityOverflow = false;

    if (availableCounselors.length === 0) {
      // All counselors at/over capacity -> fallback to least-loaded counselor
      console.warn(
        `[AssignmentService] All ${eligibleCounselors.length} counselors in pool reached maxActiveLeads capacity. Falling back to least-loaded counselor.`
      );
      isCapacityOverflow = true;
      const sortedByLoad = [...eligibleCounselors].sort((a, b) => a.currentActiveLeads - b.currentActiveLeads);
      candidates = [sortedByLoad[0]];
    }

    // If exactly 1 counselor available (or capacity overflow fallback)
    if (candidates.length === 1) {
      const selected = candidates[0].user;
      const reasonPrefix = isCapacityOverflow
        ? `Capacity Overflow Fallback (all at cap): Assigned to least-loaded counselor ${selected.name} (${candidates[0].currentActiveLeads} active leads)`
        : `Sole Available Counselor: Assigned to ${selected.name} (${candidates[0].currentActiveLeads}/${candidates[0].maxActiveLeads || 'unlimited'} leads)`;
      return {
        assignedTo: selected._id,
        assignedToName: selected.name || '',
        assignmentReason: reasonPrefix,
      };
    }

    // -------------------------------------------------------------
    // Atomic Concurrency-Safe Counter Increment via Separate Model
    // -------------------------------------------------------------
    const counterDoc = await AssignmentCounter.findOneAndUpdate(
      { integrationId: integration._id, scopeKey },
      { $inc: { counter: 1 }, $set: { lastAssignedAt: new Date() } },
      { upsert: true, new: true }
    );

    const counter = counterDoc.counter;

    // Weighted Split Calculation
    if (ruleType === 'weighted_split') {
      const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
      const mod = ((counter % totalWeight) + totalWeight) % totalWeight; // Safe non-negative modulo

      let cumulative = 0;
      let selectedItem = candidates[0];

      for (const item of candidates) {
        cumulative += item.weight;
        if (mod < cumulative) {
          selectedItem = item;
          break;
        }
      }

      await AssignmentCounter.findByIdAndUpdate(counterDoc._id, {
        lastAssignedUserId: selectedItem.user._id,
      });

      return {
        assignedTo: selectedItem.user._id,
        assignedToName: selectedItem.user.name || '',
        assignmentReason: `Weighted Split Rule (${selectedItem.weight}/${totalWeight} weight): Assigned to ${selectedItem.user.name} (${selectedItem.currentActiveLeads}/${selectedItem.maxActiveLeads || 'unlimited'} leads)`,
      };
    }

    // Standard Round-Robin Calculation
    const slot = ((counter % candidates.length) + candidates.length) % candidates.length;
    const selected = candidates[slot].user;

    await AssignmentCounter.findByIdAndUpdate(counterDoc._id, {
      lastAssignedUserId: selected._id,
    });

    return {
      assignedTo: selected._id,
      assignedToName: selected.name || '',
      assignmentReason: `Round-Robin Rule (Slot ${slot + 1}/${candidates.length}): Assigned to ${selected.name} (${candidates[slot].currentActiveLeads}/${candidates[slot].maxActiveLeads || 'unlimited'} leads)`,
    };
  }

  async getActiveUser(userId) {
    if (!userId) return null;
    const resolvedId = userId._id || userId;
    return User.findOne({
      _id: resolvedId,
      isActive: { $ne: false },
      userStatus: { $ne: 'inactive' },
      employeeStatus: { $ne: 'inactive' },
    }).select('_id name email phone');
  }
}

module.exports = new AssignmentService();
