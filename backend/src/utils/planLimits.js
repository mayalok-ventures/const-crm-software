/**
 * PLAN LIMITS & PRICING — Single Source of Truth
 *
 * Enterprise Dual-Pricing Engine:
 * - INDIVIDUAL_PLANS: basic_solo, smart_solo, power_solo
 * - ORG_PLANS: team_starter, business, enterprise
 * - FREE_TIER: free (10 leads max limit)
 */

const INDIVIDUAL_PLANS = {
  basic_solo: {
    id: 'basic_solo',
    name: 'Basic Solo',
    tierType: 'individual',
    monthlyPrice: 399,
    yearlyPrice: 3999,
    maxUsers: 1,
    maxLeads: 2000,
    maxGroups: 5,
    maxRecipientsPerCampaign: 500,
    maxConcurrentCampaigns: 2,
    canStartCampaign: true,
    canCreateGroup: true,
    features: [
      'Up to 2,000 active leads',
      '5 custom contact groups',
      '500 recipients per campaign',
      '2 concurrent campaign jobs',
      'WhatsApp outreach & voice notes',
      'Dynamic form builder & pipeline',
    ],
    popular: false,
    description: 'Perfect for solo sales agents managing up to 2,000 opportunities.',
  },
  smart_solo: {
    id: 'smart_solo',
    name: 'Smart Solo',
    tierType: 'individual',
    monthlyPrice: 799,
    yearlyPrice: 7999,
    maxUsers: 1,
    maxLeads: 10000,
    maxGroups: 20,
    maxRecipientsPerCampaign: 2000,
    maxConcurrentCampaigns: 5,
    canStartCampaign: true,
    canCreateGroup: true,
    features: [
      'Up to 10,000 active leads',
      '20 custom contact groups',
      '2,000 recipients per campaign',
      '5 concurrent campaign jobs',
      'Priority notifications & follow-up scheduler',
      'Full conversion performance analytics',
    ],
    popular: true,
    description: 'Top choice for high-volume sales representatives with up to 10k leads.',
  },
  power_solo: {
    id: 'power_solo',
    name: 'Power Solo',
    tierType: 'individual',
    monthlyPrice: 1299,
    yearlyPrice: 12999,
    maxUsers: 1,
    maxLeads: 25000,
    maxGroups: 50,
    maxRecipientsPerCampaign: 5000,
    maxConcurrentCampaigns: 10,
    canStartCampaign: true,
    canCreateGroup: true,
    features: [
      'Up to 25,000 active leads',
      '50 custom contact groups',
      '5,000 recipients per campaign',
      '10 concurrent campaign jobs',
      'Advanced multi-channel tags & export permissions',
      'Priority VIP WhatsApp support',
    ],
    popular: false,
    description: 'Heavyweight sales automation for high-producing solo professionals.',
  },
};

const ORG_PLANS = {
  team_starter: {
    id: 'team_starter',
    name: 'Team Starter',
    tierType: 'organization',
    monthlyPrice: 1499,
    yearlyPrice: 14999,
    maxUsers: 3, // 3 seats included
    maxLeads: 15000,
    maxGroups: 25,
    maxRecipientsPerCampaign: 2500,
    maxConcurrentCampaigns: 5,
    canStartCampaign: true,
    canCreateGroup: true,
    features: [
      'Includes 3 Team Agent Seats',
      'Up to 15,000 shared leads',
      'Agency common pool & lead assignment',
      'Agent performance & commission tracking',
      '25 contact groups & 2,500 broadcast recipients',
      'Centralized agency WhatsApp routing',
    ],
    popular: false,
    description: 'Ideal for boutique sales agencies with up to 3 team members.',
  },
  business: {
    id: 'business',
    name: 'Business Agency',
    tierType: 'organization',
    monthlyPrice: 2499,
    yearlyPrice: 24999,
    maxUsers: 10, // 10 seats included
    maxLeads: 50000,
    maxGroups: 100,
    maxRecipientsPerCampaign: 10000,
    maxConcurrentCampaigns: 10,
    canStartCampaign: true,
    canCreateGroup: true,
    features: [
      'Includes 10 Team Agent Seats',
      'Up to 50,000 organization leads',
      'Advanced team hierarchy & smart exit rules',
      'Selective export permissions & audit logs',
      '100 contact groups & 10k broadcast recipients',
      'Master agency revenue KPIs & conversion analytics',
    ],
    popular: true,
    description: 'Designed for scaling organizations with up to 10 sales agents.',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Command',
    tierType: 'organization',
    monthlyPrice: 4999,
    yearlyPrice: 49999,
    maxUsers: 25, // 25 seats included
    maxLeads: Infinity,
    maxGroups: Infinity,
    maxRecipientsPerCampaign: 25000,
    maxConcurrentCampaigns: 20,
    canStartCampaign: true,
    canCreateGroup: true,
    features: [
      'Includes 25 Team Agent Seats',
      'Unlimited Organization Leads',
      'Unlimited contact groups',
      '25,000 recipients per broadcast job',
      'Dedicated account manager & SLA support',
      'Full API integrations & custom webhooks',
    ],
    popular: false,
    description: 'Enterprise grade CRM infrastructure for multi-branch organizations.',
  },
  custom_enterprise: {
    id: 'custom_enterprise',
    name: 'Custom Enterprise',
    tierType: 'organization',
    monthlyPrice: 9999,
    yearlyPrice: 99999,
    maxUsers: 100,
    maxLeads: Infinity,
    maxGroups: Infinity,
    maxRecipientsPerCampaign: 50000,
    maxConcurrentCampaigns: 50,
    canStartCampaign: true,
    canCreateGroup: true,
    features: [
      'Custom Negotiated Team Seats',
      'Unlimited Organization Leads',
      'Unlimited contact groups & high-throughput broadcasts',
      'Custom SLAs, dedicated DevOps & VIP support',
    ],
    popular: false,
    description: 'Bespoke enterprise contract for massive scale.',
  },
};

const FREE_TIER = {
  id: 'free',
  name: 'Free Trial',
  tierType: 'free',
  monthlyPrice: 0,
  yearlyPrice: 0,
  maxUsers: 99999, // Development mode: unlimited team member seats
  maxLeads: 100000,
  maxGroups: 100,
  maxRecipientsPerCampaign: 10000,
  maxConcurrentCampaigns: 10,
  canStartCampaign: true,
  canCreateGroup: true,
  features: [
    'Unlimited team members / staff seats (Development Mode)',
    'Full access to all modules',
    'Custom pipeline workflow',
    'Follow-up reminders',
  ],
  popular: false,
  description: 'Development mode with unlimited team seats.',
};

// Legacy plan mappings for backward compatibility
const LEGACY_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter (Legacy)',
    tierType: 'individual',
    monthlyPrice: 199,
    yearlyPrice: 1999,
    maxUsers: 1,
    maxLeads: 200,
    maxGroups: 5,
    maxRecipientsPerCampaign: 100,
    maxConcurrentCampaigns: 1,
    canStartCampaign: true,
    canCreateGroup: true,
  },
  growth: {
    id: 'growth',
    name: 'Growth (Legacy)',
    tierType: 'individual',
    monthlyPrice: 499,
    yearlyPrice: 4999,
    maxUsers: 5,
    maxLeads: 1000,
    maxGroups: 15,
    maxRecipientsPerCampaign: 500,
    maxConcurrentCampaigns: 3,
    canStartCampaign: true,
    canCreateGroup: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro (Legacy)',
    tierType: 'organization',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    maxUsers: 15,
    maxLeads: Infinity,
    maxGroups: Infinity,
    maxRecipientsPerCampaign: 10000,
    maxConcurrentCampaigns: 10,
    canStartCampaign: true,
    canCreateGroup: true,
  },
};

// Unified PLAN_LIMITS dictionary for backend middleware & controllers
const PLAN_LIMITS = {
  free: FREE_TIER,
  ...INDIVIDUAL_PLANS,
  ...ORG_PLANS,
  ...LEGACY_PLANS,
};

// Pricing map for instant calculation
const PLAN_PRICES = {
  free: { monthly: 0, yearly: 0 },
  basic_solo: { monthly: 399, yearly: 3999 },
  smart_solo: { monthly: 799, yearly: 7999 },
  power_solo: { monthly: 1299, yearly: 12999 },
  team_starter: { monthly: 1499, yearly: 14999 },
  business: { monthly: 2499, yearly: 24999 },
  enterprise: { monthly: 4999, yearly: 49999 },
  custom_enterprise: { monthly: 9999, yearly: 99999 },
  // Legacy
  starter: { monthly: 199, yearly: 1999 },
  growth: { monthly: 499, yearly: 4999 },
  pro: { monthly: 999, yearly: 9999 },
};

/**
 * Helper to get exact pricing for a plan and billing cycle
 */
const getPlanPrice = (planId, cycle = 'monthly') => {
  const plan = PLAN_PRICES[planId];
  if (!plan) return 0;
  return cycle === 'yearly' ? plan.yearly : plan.monthly;
};

/**
 * Helper to fetch complete plan metadata
 */
const getPlanDetails = (planId) => {
  return PLAN_LIMITS[planId] || FREE_TIER;
};

module.exports = {
  INDIVIDUAL_PLANS,
  ORG_PLANS,
  FREE_TIER,
  PLAN_LIMITS,
  PLAN_PRICES,
  getPlanPrice,
  getPlanDetails,
};
