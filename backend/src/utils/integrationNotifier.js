const Notification = require('../models/Notification');

/**
 * Creates an immediate in-app notification when an integration is disconnected.
 */
async function notifyIntegrationDisconnected({ userId, companyId, provider, integrationName, reason }) {
  try {
    const targetUserId = companyId || userId;
    if (!targetUserId) return;

    const providerLabel = provider === 'google'
      ? 'Google Ads'
      : provider === 'meta'
      ? 'Meta Ads'
      : provider === 'sheets'
      ? 'Google Sheets'
      : (provider || 'Integration').toUpperCase();

    const nameStr = integrationName ? ` "${integrationName}"` : '';
    const reasonStr = reason || 'User explicitly disconnected integration';

    await Notification.create({
      userId: targetUserId,
      companyId: companyId || null,
      title: `⚠️ ${providerLabel} Disconnected`,
      message: `${providerLabel} integration${nameStr} has been disconnected. Reason: ${reasonStr}. Inbound leads from this channel will no longer be captured.`,
      type: 'system_alert',
      priority: 'high',
      category: 'system',
      entityType: 'System',
      channels: ['in_app', 'push', 'sse'],
      metadata: {
        provider,
        reason: reasonStr,
        integrationName: integrationName || '',
        disconnectedAt: new Date(),
      },
    });

    console.log(`[IntegrationNotifier] Disconnect notification delivered for ${providerLabel}${nameStr}`);
  } catch (error) {
    console.warn('[IntegrationNotifier] Disconnect notification warning:', error.message);
  }
}

/**
 * Creates an immediate in-app notification when an integration connection is lost or degraded.
 */
async function notifyConnectionLoss({ userId, companyId, provider, integrationName, reason }) {
  try {
    const targetUserId = companyId || userId;
    if (!targetUserId) return;

    const providerLabel = provider === 'google'
      ? 'Google Ads'
      : provider === 'meta'
      ? 'Meta Ads'
      : provider === 'sheets'
      ? 'Google Sheets'
      : (provider || 'Integration').toUpperCase();

    const nameStr = integrationName ? ` "${integrationName}"` : '';
    const reasonStr = reason || 'Authentication session expired or network unreachable';

    await Notification.create({
      userId: targetUserId,
      companyId: companyId || null,
      title: `⚠️ ${providerLabel} Connection Lost`,
      message: `The connection to ${providerLabel}${nameStr} was interrupted: ${reasonStr}. Please verify settings or reconnect to resume lead capture.`,
      type: 'system_alert',
      priority: 'high',
      category: 'system',
      entityType: 'System',
      channels: ['in_app', 'push', 'sse'],
      metadata: {
        provider,
        reason: reasonStr,
        integrationName: integrationName || '',
        lostAt: new Date(),
      },
    });

    console.log(`[IntegrationNotifier] Connection loss notification delivered for ${providerLabel}${nameStr}`);
  } catch (error) {
    console.warn('[IntegrationNotifier] Connection loss notification warning:', error.message);
  }
}

module.exports = {
  notifyIntegrationDisconnected,
  notifyConnectionLoss,
};

