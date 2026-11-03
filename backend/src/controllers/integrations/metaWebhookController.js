const crypto = require('crypto');
const axios = require('axios');
const Integration = require('../../models/Integration');
const Lead = require('../../models/Lead');
const Notification = require('../../models/Notification');
const webhookQueueService = require('../../services/integrations/webhookQueueService');
const META_CONFIG = require('../../config/meta');
const { parseLosslessJson } = require('../../utils/losslessJson');
const { notifyIntegrationDisconnected } = require('../../utils/integrationNotifier');

// In-memory cache for campaign/adset/ad names to avoid excessive Graph API calls
const metaNameCache = new Map();

/**
 * GET /api/integrations/meta/webhook
 * Verification challenge from Meta Developer App settings
 */
exports.verify = async (req, res) => {
  try {
    const mode = String(req.query['hub.mode'] || '').trim().toLowerCase();
    const token = String(req.query['hub.verify_token'] || '').trim();
    const challenge = req.query['hub.challenge'];

    const expectedToken = (
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      process.env.META_VERIFY_TOKEN ||
      'crm_meta_webhook_secret_2026'
    ).trim();

    if (mode === 'subscribe' && token === expectedToken && challenge) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(String(challenge));
    }

    return res.status(403).send('Verification token mismatch');
  } catch (error) {
    console.error('[Meta Webhook Verify Error]:', error.message);
    return res.status(500).send('Internal Server Error');
  }
};

/**
 * POST /api/integrations/meta/webhook
 * Verifies HMAC-SHA256 signature, persists events into WebhookEvent queue,
 * and responds with HTTP 200 immediately.
 */
exports.receive = async (req, res) => {
  try {
    // 1. Signature Verification
    const shouldVerify = process.env.META_VERIFY_SIGNATURE !== 'false';
    if (shouldVerify) {
      if (!req.headers['x-hub-signature-256']) {
        console.warn('[Meta Webhook] Inbound request rejected: missing x-hub-signature-256 header');
        return res.status(403).send('Missing signature');
      }
      const isValid = verifySignature(req);
      if (!isValid) {
        console.warn('[Meta Webhook] Invalid HMAC-SHA256 signature rejected');
        return res.status(403).send('Invalid signature');
      }
    }

    // 2. Lossless JSON Body Parsing
    const body = parseLosslessJson(req.rawBody || req.body);

    if (body?.object !== 'page' && body?.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    // 3. Process entries and enqueue valid events
    const entries = Array.isArray(body.entry) ? body.entry : [];
    let enqueuedAny = false;

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field === 'leadgen') {
          const value = change.value || {};
          const candidatePageIds = [
            String(value.page_id || ''),
            String(entry.id || ''),
          ].filter(Boolean);
          const leadgenId = String(value.leadgen_id || '');
          const formId = String(value.form_id || '');

          if (!leadgenId) continue;

          // Lookup matching connected integration:
          // 1. By Page ID (matching candidatePageIds)
          let integration = await Integration.findOne({
            provider: 'meta',
            pageId: { $in: candidatePageIds },
            status: 'connected',
          });

          // 2. If not found by pageId, lookup by form_id in integration's mapped formIds or metadata.forms
          if (!integration && formId) {
            integration = await Integration.findOne({
              provider: 'meta',
              $or: [
                { formIds: formId },
                { 'metadata.forms.id': formId },
              ],
              status: 'connected',
            });
          }

          // 3. Fallback: Lookup by active LeadSourceSubscription with externalFormId
          if (!integration && formId) {
            const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
            const sub = await LeadSourceSubscription.findOne({
              $or: [{ provider: 'meta' }, { platform: 'meta' }],
              externalFormId: formId,
              status: 'active',
            });
            if (sub && sub.integrationId) {
              integration = await Integration.findById(sub.integrationId);
            }
          }

          // 4. Fallback: If integration connected and entry.id matches adAccountId
          if (!integration && entry.id) {
            integration = await Integration.findOne({
              provider: 'meta',
              $or: [
                { accountId: String(entry.id) },
                { 'metadata.adAccountId': String(entry.id) },
              ],
              status: 'connected',
            });
          }

          if (!integration) {
            console.warn(`[Meta Webhook] Inbound leadgen event (leadgenId: ${leadgenId}, formId: ${formId}, candidates: ${candidatePageIds.join(',')}) has no mapped integration. Discarded safely to prevent cross-tenant leak.`);
            continue;
          }

          const resolvedPageId = integration.pageId || value.page_id || entry.id || '';

          // Enqueue into durable MongoDB queue
          await webhookQueueService.enqueueEvent({
            provider: 'meta',
            integrationId: integration._id,
            companyId: integration.companyId,
            userId: integration.userId,
            externalLeadId: leadgenId,
            headers: req.headers,
            rawBody: {
              pageId: resolvedPageId,
              formId: formId || (value.form_id ? String(value.form_id) : ''),
              leadgenId,
              adId: value.ad_id ? String(value.ad_id) : '',
              adSetId: value.adset_id ? String(value.adset_id) : '',
              campaignId: value.campaign_id ? String(value.campaign_id) : '',
              createdTime: value.created_time || Math.floor(Date.now() / 1000),
            },
            isTest: String(leadgenId).startsWith('meta_test_'),
          });

          enqueuedAny = true;
        }
      }
    }

    // Return 200 OK immediately to Meta
    return res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('[Meta Webhook Ingestion Error]:', error.message);
    // Return 500 so Meta will retry if DB was down
    return res.status(500).send('Queue enqueue failed');
  }
};

/**
 * Fetch lead details from Meta Graph API with error subcode detection
 * and resilient name enrichment.
 */
async function fetchMetaLeadDetails(leadgenId, accessToken, integration) {
  const version = META_CONFIG.GRAPH_API_VERSION;
  const fields = [
    'id',
    'created_time',
    'field_data',
    'ad_id',
    'form_id',
    'campaign_id',
    'adset_id',
    'campaign_name',
    'adset_name',
    'ad_name',
    'form_name',
    'platform',
    'is_organic',
  ].join(',');

  const url = `${META_CONFIG.GRAPH_BASE_URL}/${version}/${leadgenId}`;

  try {
    const response = await axios.get(url, {
      params: { fields, access_token: accessToken },
      timeout: 10000,
    });

    const data = response.data;
    const fieldsMap = {};
    const rawAnswers = [];

    for (const field of data.field_data || []) {
      const rawKey = String(field.name || '').trim();
      const val = field.values?.[0] || '';
      fieldsMap[rawKey.toLowerCase()] = val;
      rawAnswers.push({ question: rawKey, answer: val });
    }

    // Extract Name
    let name =
      fieldsMap.full_name ||
      fieldsMap.name ||
      (fieldsMap.first_name ? `${fieldsMap.first_name} ${fieldsMap.last_name || ''}`.trim() : '') ||
      fieldsMap.firstname ||
      '';

    // Extract Phone
    const phone =
      fieldsMap.phone_number ||
      fieldsMap.phone ||
      fieldsMap.mobile ||
      fieldsMap.mobile_number ||
      '';

    // Extract Email
    const email =
      fieldsMap.email ||
      fieldsMap['e-mail'] ||
      fieldsMap['email address'] ||
      '';

    return {
      name,
      phone,
      email,
      formId: data.form_id ? String(data.form_id) : '',
      formName: data.form_name || '',
      campaignId: data.campaign_id ? String(data.campaign_id) : '',
      campaignName: data.campaign_name || '',
      adSetId: data.adset_id ? String(data.adset_id) : '',
      adSetName: data.adset_name || '',
      adId: data.ad_id ? String(data.ad_id) : '',
      adName: data.ad_name || '',
      customData: fieldsMap,
      rawAnswers,
    };
  } catch (error) {
    const fbError = error.response?.data?.error;
    const code = fbError?.code;
    const subcode = fbError?.error_subcode;

    // Requirement D.4: Only verified auth/permission errors move integration to needs_reconnect
    const isAuthError =
      code === META_CONFIG.AUTH_ERROR_CODE &&
      META_CONFIG.AUTH_ERROR_SUBCODES.includes(Number(subcode));

    if (isAuthError && integration) {
      console.warn(`[Meta Auth Error] Transitioning integration ${integration._id} to needs_reconnect. Subcode: ${subcode}`);
      await Integration.findByIdAndUpdate(integration._id, {
        $set: {
          status: 'needs_reconnect',
          lastError: `Meta OAuth Session Expired or Revoked (Error ${code}, Subcode ${subcode}): ${fbError.message}`,
          needsReconnectAt: new Date(),
        },
      });

      if (integration.userId || integration.companyId) {
        await Notification.create({
          userId: integration.userId || integration.companyId,
          title: '⚠️ Meta Ads Reconnect Required',
          message: `Your Facebook Page "${integration.pageName || integration.pageId}" connection has expired or been revoked. Please reconnect to resume automatic lead capture.`,
          type: 'system_alert',
          isRead: false,
        }).catch(() => {});
      }
    }

    throw error;
  }
}

/**
 * Scheduled Meta Leads Reconciliation Job (Requirement D.1)
 * Bulk-reads /{form-id}/leads with time_created filter and enqueues unseen leads.
 */
async function reconcileMetaIntegration(integrationId) {
  const integration = await Integration.findById(integrationId).select('+accessTokenEncrypted');
  if (!integration || integration.status !== 'connected') {
    return { synced: 0, message: 'Integration inactive or not found' };
  }

  const accessToken = integration.accessToken;
  if (!accessToken) return { synced: 0, message: 'No decrypted token' };

  // Calculate cutoff: lastSyncAt minus 15 minutes safety window
  const lastSync = integration.lastSyncAt ? new Date(integration.lastSyncAt).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const sinceUnix = Math.floor((lastSync - 15 * 60 * 1000) / 1000);

  let totalEnqueued = 0;
  const formIds = integration.formIds || [];

  // Gather active formIds from both integration and LeadSourceSubscription
  const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
  const subs = await LeadSourceSubscription.find({
    integrationId: integration._id,
    $or: [{ provider: 'meta' }, { platform: 'meta' }],
    status: 'active',
  }).select('externalFormId');
  const allFormIds = new Set((formIds || []).map((id) => String(id).trim()).filter(Boolean));
  for (const s of subs) {
    if (s.externalFormId) allFormIds.add(String(s.externalFormId).trim());
  }

  for (const formId of allFormIds) {
    try {
      let nextUrl = `${META_CONFIG.GRAPH_BASE_URL}/${META_CONFIG.GRAPH_API_VERSION}/${formId}/leads`;
      let params = {
        access_token: accessToken,
        filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: sinceUnix }]),
        limit: 50,
      };

      while (nextUrl) {
        const response = await axios.get(nextUrl, { params, timeout: 15000 });
        const leads = response.data?.data || [];

        for (const lead of leads) {
          const leadgenId = String(lead.id);

          // Check if already in DB
          const existing = await Lead.findOne({
            'leadSource.provider': 'meta',
            'leadSource.externalLeadId': leadgenId,
          });

          if (!existing) {
            await webhookQueueService.enqueueEvent({
              provider: 'meta',
              integrationId: integration._id,
              companyId: integration.companyId,
              userId: integration.userId,
              externalLeadId: leadgenId,
              headers: { 'user-agent': 'Meta-Reconciliation-Worker' },
              rawBody: {
                pageId: integration.pageId,
                formId,
                leadgenId,
                createdTime: lead.created_time ? Math.floor(new Date(lead.created_time).getTime() / 1000) : Math.floor(Date.now() / 1000),
              },
            });
            totalEnqueued++;
          }
        }

        // Pagination
        nextUrl = response.data?.paging?.next || null;
        params = {}; // subsequent cursor requests embed token in nextUrl
      }
    } catch (formErr) {
      console.error(`[Meta Reconciliation Error] Form ${formId}:`, formErr.message);
    }
  }

  await Integration.findByIdAndUpdate(integration._id, {
    $set: { lastSyncAt: new Date() },
  });

  return { synced: totalEnqueued, message: `Reconciliation complete. Enqueued ${totalEnqueued} new leads.` };
}

function getTenantFilter(user) {
  if (!user) return { _id: null };
  if (user.role === 'superadmin' || user.isAdmin) {
    return {};
  }
  const companyId = user.companyId || (user.companyRole === 'owner' || user.workStatus === 'company_owner' ? user._id : null);
  if (companyId) {
    return { companyId };
  }
  return { userId: user._id, companyId: null };
}

/**
 * Manual "Sync Now" API endpoint
 */
exports.syncNow = async (req, res) => {
  try {
    const { integrationId } = req.params;
    const filter = getTenantFilter(req.user);
    const integration = await Integration.findOne({ _id: integrationId, ...filter });
    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found or unauthorized' });
    }

    const result = await reconcileMetaIntegration(integrationId);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Parse and verify Meta signed_request using HMAC-SHA256 with META_APP_SECRET
 */
function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string') return null;
  const parts = signedRequest.split('.');
  if (parts.length !== 2) return null;

  const [encodedSig, payload] = parts;
  if (!encodedSig || !payload) return null;

  const secret = (appSecret || process.env.META_APP_SECRET || '').trim();
  if (!secret) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  if (encodedSig !== expectedSig) {
    const altExpected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    if (encodedSig !== altExpected) {
      return null;
    }
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || String(data.algorithm).toUpperCase() !== 'HMAC-SHA256') {
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Meta App Review Compliance: Deauthorize Callback
 * Disconnects the specific user's Integration when removed from Facebook Settings
 */
exports.deauthorizeCallback = async (req, res) => {
  try {
    const signedRequest = req.body?.signed_request || req.query?.signed_request;
    const appSecret = (process.env.META_APP_SECRET || '').trim();

    if (!signedRequest || !appSecret) {
      console.warn('[Meta Deauthorize] Missing signed_request or META_APP_SECRET');
      return res.status(200).json({ success: true, warning: 'Missing signed_request or secret' });
    }

    const data = parseSignedRequest(signedRequest, appSecret);
    if (!data || !data.user_id) {
      console.warn('[Meta Deauthorize] Unverifiable or missing user_id in payload');
      return res.status(200).json({ success: true, warning: 'Invalid signed_request' });
    }

    const metaUserId = String(data.user_id);
    console.log(`[Meta Deauthorize] Processing deauthorization for Meta User ID: ${metaUserId}`);

    // Disconnect all integrations corresponding to this Meta User ID
    const matchingIntegrations = await Integration.find({
      provider: 'meta',
      $or: [
        { 'metadata.metaUserId': metaUserId },
        { accountId: metaUserId },
      ],
      status: { $ne: 'disconnected' },
    });

    const LeadSourceSubscription = require('../../models/LeadSourceSubscription');

    for (const integration of matchingIntegrations) {
      integration.status = 'disconnected';
      integration.accessTokenEncrypted = null;
      integration.refreshTokenEncrypted = null;
      integration.webhookSubscribed = false;
      integration.lastError = 'Deauthorized by user in Facebook Settings';
      await integration.save();

      await LeadSourceSubscription.updateMany(
        { integrationId: integration._id },
        { $set: { status: 'paused', healthStatus: 'warning', lastError: 'Integration deauthorized by user' } }
      );

      // Immediate notification to tenant
      await notifyIntegrationDisconnected({
        userId: integration.userId,
        companyId: integration.companyId,
        provider: 'meta',
        integrationName: integration.pageName || integration.pageId || 'Meta Page',
        reason: 'The app was deauthorized from your Facebook Account / Page settings',
      });
    }

    return res.status(200).json({
      success: true,
      disconnectedCount: matchingIntegrations.length,
    });
  } catch (err) {
    console.error('[Meta Deauthorize Callback Error]:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Meta App Review Compliance: Data Deletion Request Callback
 */
exports.dataDeletionCallback = async (req, res) => {
  try {
    const signedRequest = req.body?.signed_request || req.query?.signed_request;
    const appSecret = (process.env.META_APP_SECRET || '').trim();

    if (signedRequest && appSecret) {
      const data = parseSignedRequest(signedRequest, appSecret);
      if (data?.user_id) {
        const metaUserId = String(data.user_id);
        const affected = await Integration.find({
          provider: 'meta',
          $or: [
            { 'metadata.metaUserId': metaUserId },
            { accountId: metaUserId },
          ],
        });

        await Integration.updateMany(
          {
            provider: 'meta',
            $or: [
              { 'metadata.metaUserId': metaUserId },
              { accountId: metaUserId },
            ],
          },
          {
            $set: {
              status: 'disconnected',
              accessTokenEncrypted: null,
              refreshTokenEncrypted: null,
              webhookSubscribed: false,
              lastError: 'Data deletion requested by user via Facebook',
            },
          }
        );

        for (const item of affected) {
          await notifyIntegrationDisconnected({
            userId: item.userId,
            companyId: item.companyId,
            provider: 'meta',
            integrationName: item.pageName || item.pageId || 'Meta Page',
            reason: 'Data deletion request received from Facebook',
          });
        }
      }
    }

    const confirmationCode = `del_${crypto.randomBytes(12).toString('hex')}`;
    const frontendUrl = process.env.FRONTEND_URL || 'https://crm.sahyak.com';

    return res.status(200).json({
      url: `${frontendUrl}/data-deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = (process.env.META_APP_SECRET || '').trim();

  if (!signature || !appSecret) return false;

  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256' || !hash) return false;

  const rawPayload = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {}));

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawPayload)
    .digest('hex');

  try {
    const hashBuf = Buffer.from(hash, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (hashBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, expectedBuf);
  } catch {
    return false;
  }
}

exports.fetchMetaLeadDetails = fetchMetaLeadDetails;
exports.reconcileMetaIntegration = reconcileMetaIntegration;
exports.parseSignedRequest = parseSignedRequest;