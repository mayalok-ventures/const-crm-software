const CommissionRule = require('../models/CommissionRule');
const CommissionPayout = require('../models/CommissionPayout');
const User = require('../models/User');

/**
 * Commission Engine Service
 * Calculates earned commissions for Agents and Managers upon lead conversion or stage milestones.
 * Maintains immutable audit ledgers in CommissionPayout.
 */
class CommissionService {
  /**
   * Process and award commission upon lead conversion or payment
   * @param {Object} params - { lead, dealAmount, stageId, performedBy }
   */
  async processCommission({ lead, dealAmount = 0, stageId = 'payment_done', performedBy = null }) {
    try {
      if (!lead || (!lead.assignedTo && !lead.userId)) {
        return null;
      }

      const agentId = lead.assignedTo || lead.userId;
      const agent = await User.findById(agentId).select('name role managerId incentive_pct incentivePct').lean();
      if (!agent) return null;

      const numericDealAmount = Number(dealAmount) || Number(lead.paid_amount) || Number(lead.closedDealAmount) || Number(lead.deal_value) || 0;
      if (numericDealAmount <= 0) return null;

      // 1. Fetch active commission rules
      const rules = await CommissionRule.find({ isActive: true }).sort({ createdAt: -1 });

      // Find matching rule for Agent
      let agentRule = rules.find(r => r.targetRole === 'AGENT' || r.targetRole === 'agent');
      let agentCommissionAmount = 0;
      let ruleSnapshot = {};

      if (agentRule) {
        agentCommissionAmount = this.calculateAmount(agentRule, numericDealAmount);
        ruleSnapshot = {
          ruleId: agentRule._id,
          ruleName: agentRule.ruleName || agentRule.name,
          commissionType: agentRule.commissionType,
          value: agentRule.value,
        };
      } else {
        // Fallback to agent's user-level incentive %
        const defaultPct = Number(agent.incentive_pct || agent.incentivePct || 5);
        agentCommissionAmount = Math.round((numericDealAmount * defaultPct) / 100);
        ruleSnapshot = {
          ruleName: `Default User Incentive Policy (${defaultPct}%)`,
          commissionType: 'PERCENTAGE',
          value: defaultPct,
        };
      }

      // 2. Create Immutable Agent Payout Record
      let agentPayout = null;
      if (agentRule) {
        agentPayout = await CommissionPayout.create({
          userId: agent._id,
          leadId: lead._id,
          saleValue: numericDealAmount,
          commissionEarned: agentCommissionAmount,
          appliedRuleId: agentRule._id,
          ruleNameSnapshot: agentRule.ruleName || 'Agent Won Policy',
          calculationSnapshot: ruleSnapshot,
          status: 'APPROVED',
          approvedBy: performedBy || null,
        });
      }

      // 3. If Agent has a Manager, calculate Manager's supervisory override commission
      let managerPayout = null;
      if (agent.managerId) {
        const manager = await User.findById(agent.managerId).select('name role incentive_pct').lean();
        if (manager) {
          const managerRule = rules.find(r => r.targetRole === 'MANAGER' || r.targetRole === 'manager');
          let managerCommission = 0;
          let mgrRuleSnapshot = {};

          if (managerRule) {
            managerCommission = this.calculateAmount(managerRule, numericDealAmount);
            mgrRuleSnapshot = {
              ruleId: managerRule._id,
              ruleName: managerRule.ruleName || managerRule.name,
              commissionType: managerRule.commissionType,
              value: managerRule.value,
            };

            if (managerCommission > 0) {
              managerPayout = await CommissionPayout.create({
                userId: manager._id,
                leadId: lead._id,
                saleValue: numericDealAmount,
                commissionEarned: managerCommission,
                appliedRuleId: managerRule._id,
                ruleNameSnapshot: managerRule.ruleName || 'Manager Override Policy',
                calculationSnapshot: mgrRuleSnapshot,
                status: 'APPROVED',
                approvedBy: performedBy || null,
              });
            }
          }
        }
      }

      return {
        agentPayout,
        managerPayout,
      };
    } catch (error) {
      console.error('[CommissionService] Error calculating commission:', error.message);
      return null;
    }
  }

  calculateAmount(rule, dealAmount) {
    const type = (rule.commissionType || rule.calculationType || '').toUpperCase();
    const rate = Number(rule.value || rule.percentageRate || rule.fixedAmount || 0);

    if (type === 'PERCENTAGE') {
      return Math.round((dealAmount * rate) / 100);
    } else if (type === 'FLAT' || type === 'FIXED') {
      return rate;
    } else {
      return Math.round((dealAmount * rate) / 100);
    }
  }
}

module.exports = new CommissionService();
