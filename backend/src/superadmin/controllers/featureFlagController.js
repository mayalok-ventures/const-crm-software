const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Subscription = require('../../models/Subscription');
const AuditLog = require('../../models/AuditLog');

// Default in-memory platform feature flags (extensible to DB collection)
let PLATFORM_FEATURE_FLAGS = [
  { id: 'meta_leads_ingestion', name: 'Meta Ads Webhook Ingestion', description: 'Enable automatic real-time Meta Lead Ads ingestion', enabled: true, category: 'INTEGRATION', targetPlans: ['ALL'] },
  { id: 'smart_distribution_engine', name: 'Smart Round-Robin Routing', description: 'Automated lead distribution across teams and agents', enabled: true, category: 'ROUTING', targetPlans: ['BUSINESS', 'ENTERPRISE'] },
  { id: 'dynamic_form_builder', name: 'Dynamic Inbound Form Builder', description: 'Custom landing page and embeddable forms engine', enabled: true, category: 'GROWTH', targetPlans: ['ALL'] },
  { id: 'universal_analytics', name: 'Universal Analytics & SLA Metrics', description: 'Deep funnel, agent performance, and conversion metrics', enabled: true, category: 'INTELLIGENCE', targetPlans: ['PRO', 'BUSINESS', 'ENTERPRISE'] },
  { id: 'two_factor_auth', name: '2FA Policy Enforcement', description: 'Mandatory TOTP authenticator for administrative users', enabled: true, category: 'SECURITY', targetPlans: ['ALL'] },
];

exports.getFeatureFlags = async (req, res) => {
  res.json({ success: true, flags: PLATFORM_FEATURE_FLAGS });
};

exports.toggleFeatureFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { enabled } = req.body;

    const flag = PLATFORM_FEATURE_FLAGS.find((f) => f.id === flagId);
    if (!flag) {
      return res.status(404).json({ success: false, message: 'Feature flag not found' });
    }

    const prev = flag.enabled;
    flag.enabled = Boolean(enabled);

    await AuditLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      actorRole: 'superadmin',
      action: 'FEATURE_FLAG_CHANGE',
      resourceType: 'FeatureFlag',
      resourceId: flagId,
      resourceName: flag.name,
      before: { enabled: prev },
      after: { enabled: flag.enabled },
      metadata: { updatedBy: 'superadmin' },
      timestamp: new Date(),
    });

    res.json({ success: true, message: `Feature flag ${flag.name} updated to ${flag.enabled}`, flag });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update feature flag' });
  }
};

/**
 * Super Admin Global Cross-Entity Search
 */
exports.globalSearch = async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, results: [] });
    }

    const regex = new RegExp(q.trim(), 'i');

    const [organisations, users, leads, subscriptions] = await Promise.all([
      User.find({
        role: { $ne: 'superadmin' },
        $or: [{ 'companyInfo.companyName': regex }, { name: regex }],
      })
        .select('name companyInfo email phone')
        .limit(5)
        .lean(),
      User.find({
        role: { $ne: 'superadmin' },
        $or: [{ name: regex }, { email: regex }, { phone: regex }],
      })
        .select('name email phone role companyId')
        .populate('companyId', 'name companyInfo')
        .limit(5)
        .lean(),
      Lead.find({
        $or: [{ name: regex }, { phone: regex }, { email: regex }, { company: regex }],
      })
        .select('name phone email status source companyId createdAt')
        .populate('companyId', 'name companyInfo')
        .limit(5)
        .lean(),
      Subscription.find({})
        .populate('userId', 'name email companyInfo')
        .populate('planId', 'name code')
        .limit(5)
        .lean(),
    ]);

    const results = [
      ...organisations.map((org) => ({
        type: 'ORGANISATION',
        id: org._id,
        title: org.companyInfo?.companyName || org.name,
        subtitle: `Owner: ${org.name} • ${org.email || org.phone}`,
        badge: 'Organisation',
        badgeColor: 'blue',
      })),
      ...users.map((u) => ({
        type: 'USER',
        id: u._id,
        title: u.name,
        subtitle: `${u.role.toUpperCase()} • ${u.companyId?.companyInfo?.companyName || 'Independent'} • ${u.email || u.phone}`,
        badge: u.role.toUpperCase(),
        badgeColor: 'purple',
      })),
      ...leads.map((l) => ({
        type: 'LEAD',
        id: l._id,
        title: l.name,
        subtitle: `${l.phone} • Status: ${l.status} • Org: ${l.companyId?.companyInfo?.companyName || 'Main'}`,
        badge: 'Lead',
        badgeColor: 'amber',
      })),
    ];

    res.json({ success: true, results });
  } catch (error) {
    console.error('SuperAdmin Global Search Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Global search failed' });
  }
};
