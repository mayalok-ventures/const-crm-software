const Lead = require('../models/Lead');
const User = require('../models/User');
const LeadDistributionRule = require('../models/LeadDistributionRule');

/**
 * Lead Distribution Engine
 * Automatically routes inbound leads across active Managers & Agents based on configured rules and capacity.
 */
class LeadDistributionService {
  /**
   * Distribute a newly arrived or unassigned lead
   * @param {Object} lead - The Lead document or payload
   * @returns {Object} { assignedTo, assignedToName, assignedManager, assignedManagerName, ruleId, strategy }
   */
  async distributeLead(lead) {
    try {
      // 1. Fetch all active distribution rules sorted by priority
      const rules = await LeadDistributionRule.find({ isActive: true })
        .sort({ priority: -1 })
        .populate('assignees.userId', 'name email role managerId isAvailable leadCap')
        .populate('fallbackUserId', 'name email role');

      if (!rules || rules.length === 0) {
        return { assignedTo: null, strategy: 'none' };
      }

      // 2. Find matching rule
      let matchedRule = null;
      for (const rule of rules) {
        if (this.matchesRuleConditions(lead, rule.conditions)) {
          matchedRule = rule;
          break;
        }
      }

      if (!matchedRule) {
        // Fallback to default round-robin or first active rule
        matchedRule = rules.find(r => r.strategy === 'round_robin') || rules[0];
      }

      if (!matchedRule) {
        return { assignedTo: null, strategy: 'none' };
      }

      // 3. Filter eligible assignees based on availability and active lead cap
      const eligibleAssignees = await this.getEligibleAssignees(matchedRule);

      if (eligibleAssignees.length === 0) {
        if (matchedRule.fallbackUserId) {
          return {
            assignedTo: matchedRule.fallbackUserId._id,
            assignedToName: matchedRule.fallbackUserId.name,
            assignedManager: matchedRule.fallbackUserId.managerId || null,
            ruleId: matchedRule._id,
            strategy: 'fallback_assigned',
          };
        }
        return { assignedTo: null, strategy: 'capacity_exhausted' };
      }

      // 4. Apply Distribution Strategy
      let selectedAssignee = null;

      switch (matchedRule.strategy) {
        case 'weighted':
          selectedAssignee = this.selectWeightedAssignee(eligibleAssignees);
          break;

        case 'manager_routed':
          selectedAssignee = await this.selectManagerRoutedAssignee(eligibleAssignees);
          break;

        case 'round_robin':
        case 'rule_based':
        default:
          selectedAssignee = await this.selectRoundRobinAssignee(matchedRule, eligibleAssignees);
          break;
      }

      if (!selectedAssignee || !selectedAssignee.userId) {
        return { assignedTo: null, strategy: matchedRule.strategy };
      }

      const assignedUser = selectedAssignee.userId;
      let managerId = assignedUser.managerId || null;
      let managerName = '';

      if (managerId) {
        const mgr = await User.findById(managerId).select('name').lean();
        managerName = mgr?.name || '';
      } else if (assignedUser.role === 'manager') {
        managerId = assignedUser._id;
        managerName = assignedUser.name;
      }

      return {
        assignedTo: assignedUser._id,
        assignedToName: assignedUser.name,
        assignedManager: managerId,
        assignedManagerName: managerName,
        ruleId: matchedRule._id,
        strategy: matchedRule.strategy,
      };
    } catch (error) {
      console.error('[LeadDistributionService] Distribution error:', error.message);
      return { assignedTo: null, strategy: 'error', error: error.message };
    }
  }

  matchesRuleConditions(lead, conditions) {
    if (!conditions) return true;

    // Check Source
    if (conditions.sources && conditions.sources.length > 0) {
      const leadSrc = (lead.source || '').toLowerCase();
      const primarySrc = (lead.primarySource || '').toLowerCase();
      const matchesSource = conditions.sources.some(
        s => s.toLowerCase() === leadSrc || primarySrc.includes(s.toLowerCase())
      );
      if (!matchesSource) return false;
    }

    // Check Campaign Name
    if (conditions.campaignNames && conditions.campaignNames.length > 0) {
      const camp = (lead.leadSource?.campaignName || lead.utmCampaign || '').toLowerCase();
      const matchesCamp = conditions.campaignNames.some(c => camp.includes(c.toLowerCase()));
      if (!matchesCamp) return false;
    }

    // Check UTM Source
    if (conditions.utmSources && conditions.utmSources.length > 0) {
      const utm = (lead.utmSource || '').toLowerCase();
      const matchesUtm = conditions.utmSources.some(u => utm.includes(u.toLowerCase()));
      if (!matchesUtm) return false;
    }

    // Check Location
    if (conditions.locations && conditions.locations.length > 0) {
      const loc = (lead.location || '').toLowerCase();
      const matchesLoc = conditions.locations.some(l => loc.includes(l.toLowerCase()));
      if (!matchesLoc) return false;
    }

    // Check Service or Product
    if (conditions.servicesOrProducts && conditions.servicesOrProducts.length > 0) {
      const prod = (lead.service_required || lead.project || '').toLowerCase();
      const matchesProd = conditions.servicesOrProducts.some(p => prod.includes(p.toLowerCase()));
      if (!matchesProd) return false;
    }

    // Check Budget
    if (conditions.minBudget && Number(lead.monthly_spend || 0) < conditions.minBudget) {
      return false;
    }
    if (conditions.maxBudget && Number(lead.monthly_spend || 0) > conditions.maxBudget) {
      return false;
    }

    return true;
  }

  async getEligibleAssignees(rule) {
    const eligible = [];

    for (const assignee of rule.assignees || []) {
      if (!assignee.isActive || !assignee.userId) continue;

      const user = assignee.userId;
      if (user.isAvailable === false || user.userStatus === 'disabled' || user.userStatus === 'inactive') {
        continue;
      }

      // Check current active leads capacity
      const maxCap = assignee.maxActiveLeadsCap || user.leadCap || 50;
      const activeLeadsCount = await Lead.countDocuments({
        assignedTo: user._id,
        status: { $nin: ['payment_done', 'converted', 'not_interested', 'lost', 'closed'] },
      });

      if (activeLeadsCount < maxCap) {
        eligible.push({
          ...assignee.toObject?.() || assignee,
          userId: user,
          currentActiveLeads: activeLeadsCount,
          availableCapacity: maxCap - activeLeadsCount,
        });
      }
    }

    return eligible;
  }

  async selectRoundRobinAssignee(rule, eligibleAssignees) {
    if (eligibleAssignees.length === 0) return null;

    let nextIndex = (Number(rule.lastAssignedIndex || 0) + 1) % eligibleAssignees.length;
    const selected = eligibleAssignees[nextIndex];

    // Atomically update lastAssignedIndex on rule
    await LeadDistributionRule.findByIdAndUpdate(rule._id, {
      $set: { lastAssignedIndex: nextIndex },
    });

    return selected;
  }

  selectWeightedAssignee(eligibleAssignees) {
    if (eligibleAssignees.length === 0) return null;

    const totalWeight = eligibleAssignees.reduce((sum, a) => sum + (Number(a.weight) || 1), 0);
    let randomNum = Math.random() * totalWeight;

    for (const assignee of eligibleAssignees) {
      const weight = Number(assignee.weight) || 1;
      if (randomNum < weight) {
        return assignee;
      }
      randomNum -= weight;
    }

    return eligibleAssignees[0];
  }

  async selectManagerRoutedAssignee(eligibleAssignees) {
    // 1. Group assignees under managers
    const managers = eligibleAssignees.filter(a => a.userId.role === 'manager');
    if (managers.length > 0) {
      // Route to manager with highest capacity
      managers.sort((a, b) => b.availableCapacity - a.availableCapacity);
      return managers[0];
    }
    // Fallback to agent with highest available capacity
    eligibleAssignees.sort((a, b) => b.availableCapacity - a.availableCapacity);
    return eligibleAssignees[0];
  }
}

module.exports = new LeadDistributionService();
