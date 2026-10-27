const crypto = require('crypto');
const Integration = require('../../models/Integration');
const webhookQueueService = require('../../services/integrations/webhookQueueService');
const { parseLosslessJson } = require('../../utils/losslessJson');

/**
 * POST /api/integrations/custom/webhook/:integrationId
 *
 * Receiver for Custom Webhook integrations (Zapier, Make, JustDial, LinkedIn, HubSpot, etc.).
 * Secret key is passed securely via:
 * 1. Header: 'x-crm-secret' or 'x-custom-secret' or 'x-webhook-key' or Authorization: Bearer <key>
 * 2. Query param: ?key= or ?secret=
 * Constant-time hash verification against integration's stored hash.
 */
exports.receive = async (req, res) => {
  try {
    const { integrationId } = req.params;
    if (!integrationId) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    const receivedSecret = (
      req.headers['x-crm-secret'] ||
      req.headers['x-custom-secret'] ||
      req.headers['x-webhook-key'] ||
      bearerToken ||
      req.query?.key ||
      req.query?.secret ||
      req.body?.secret ||
      ''
    ).trim();

    if (!receivedSecret) {
      return res.status(401).json({ error: 'Missing webhook secret key' });
    }

    const integration = await Integration.findById(integrationId).select('+sheetsSecretHash +googleKeyHash');
    if (!integration || integration.provider !== 'custom' || integration.status !== 'connected') {
      return res.status(404).json({ error: 'Active Custom Webhook integration not found' });
    }

    const expectedHash = integration.sheetsSecretHash || integration.googleKeyHash;
    if (!expectedHash) {
      return res.status(401).json({ error: 'Webhook secret not initialized' });
    }

    const receivedHash = crypto.createHash('sha256').update(receivedSecret).digest('hex');
    const recvBuf = Buffer.from(receivedHash, 'hex');
    const confBuf = Buffer.from(expectedHash, 'hex');

    if (recvBuf.length !== confBuf.length || !crypto.timingSafeEqual(recvBuf, confBuf)) {
      console.warn(`[Custom Webhook] Invalid secret token received for integration ${integrationId}`);
      return res.status(401).json({ error: 'Invalid secret token' });
    }

    const payload = parseLosslessJson(req.rawBody || req.body);
    const externalLeadId = String(
      payload.id ||
      payload.lead_id ||
      payload.leadId ||
      payload.externalLeadId ||
      `cwh_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    );

    // Enqueue event into durable queue
    await webhookQueueService.enqueueEvent({
      provider: 'custom',
      integrationId: integration._id,
      companyId: integration.companyId,
      userId: integration.userId,
      externalLeadId,
      headers: req.headers,
      rawBody: payload,
    });

    return res.status(200).json({
      success: true,
      status: 'RECEIVED',
      leadId: externalLeadId,
    });
  } catch (error) {
    console.error('[Custom Webhook Error]:', error.message);
    return res.status(500).json({ error: 'Failed to process custom webhook' });
  }
};
