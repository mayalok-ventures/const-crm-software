const Integration = require('../../models/Integration');
const ExternalIntegration = require('../../models/ExternalIntegration');

exports.getIntegrationsTelemetry = async (req, res) => {
  try {
    const [metaIntegrations, googleIntegrations, webhookIntegrations] = await Promise.all([
      Integration.find({ type: 'meta' }).select('-accessToken -appSecret').populate('companyId', 'name companyInfo').lean(),
      Integration.find({ type: 'google' }).select('-accessToken -appSecret').populate('companyId', 'name companyInfo').lean(),
      Integration.find({ type: 'webhook' }).select('-webhookSecret').populate('companyId', 'name companyInfo').lean(),
    ]);

    const activeMeta = metaIntegrations.filter((m) => m.status === 'connected').length;
    const activeGoogle = googleIntegrations.filter((g) => g.status === 'connected').length;
    const activeWebhooks = webhookIntegrations.filter((w) => w.status === 'active' || w.status === 'connected').length;

    res.json({
      success: true,
      summary: {
        totalMeta: metaIntegrations.length,
        activeMeta,
        totalGoogle: googleIntegrations.length,
        activeGoogle,
        totalWebhooks: webhookIntegrations.length,
        activeWebhooks,
      },
      meta: metaIntegrations,
      google: googleIntegrations,
      webhooks: webhookIntegrations,
    });
  } catch (error) {
    console.error('SuperAdmin Get Integrations Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch integrations telemetry' });
  }
};
