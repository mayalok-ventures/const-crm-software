const axios = require('axios');
const mongoose = require('mongoose');
const Integration = require('../../models/Integration');
const Lead = require('../../models/Lead');
const leadIngestionService = require('../../services/integrations/leadIngestionService');
const { encrypt, decrypt } = require('../../utils/encryption');
const META_CONFIG = require('../../config/meta');
const { notifyIntegrationDisconnected } = require('../../utils/integrationNotifier');

function getTenantQuery(user) {
  if (!user) return { _id: null };
  const uid = user._id;
  const isOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';
  const companyId = user?.companyId || (isOwner ? uid : null);
  if (companyId) {
    return {
      $or: [
        { companyId },
        { userId: uid },
      ],
    };
  }
  return { userId: uid };
}

/**
 * GET /api/integrations/meta
 */
exports.getIntegrations = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integrations = await Integration.find({
      ...tenantQuery,
      provider: 'meta',
      status: { $ne: 'disconnected' },
    })
      .select('-accessTokenEncrypted -refreshTokenEncrypted')
      .lean();

    return res.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error('Get Meta integrations error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get Meta integrations',
    });
  }
};

/**
 * GET /api/integrations/meta/assets
 * Retrieves all accessible Facebook Pages and Lead Generation Forms with cursor pagination
 */
exports.getAssets = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: req.query.integrationId,
      ...tenantQuery,
      provider: 'meta',
      status: 'connected',
    }).select('+accessTokenEncrypted');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found or disconnected',
      });
    }

    const accessToken = integration.accessTokenEncrypted
      ? decrypt(integration.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return res.json({
        success: true,
        data: [],
        message: 'No active access token stored',
      });
    }

    const userAccessToken = integration.metadata?.userAccessTokenEncrypted
      ? decrypt(integration.metadata.userAccessTokenEncrypted)
      : accessToken;

    const apiVersion = META_CONFIG.GRAPH_API_VERSION;

    // 1. Fetch Pages with cursor pagination (capped at 10 pages / 500 accounts)
    const pages = [];
    let nextPagesUrl = `${META_CONFIG.GRAPH_BASE_URL}/${apiVersion}/me/accounts`;
    let pageParams = {
      fields: 'id,name,access_token,tasks',
      access_token: userAccessToken || accessToken,
      limit: 50,
    };
    let pageIterations = 0;

    while (nextPagesUrl && pageIterations < 10) {
      pageIterations++;
      try {
        const pagesResponse = await axios.get(nextPagesUrl, {
          params: pageParams,
          timeout: 15000,
        });
        const batch = pagesResponse.data?.data || [];
        pages.push(...batch);
        nextPagesUrl = pagesResponse.data?.paging?.next || null;
        pageParams = {}; // Cursor URL embeds query params
      } catch (pageErr) {
        console.warn('[Meta getAssets] /me/accounts batch fetch notice:', pageErr.message);
        break;
      }
    }

    // Always ensure the already-connected page from the integration record is present
    if (integration.pageId) {
      const exists = pages.some((p) => String(p.id) === String(integration.pageId));
      if (!exists) {
        pages.unshift({
          id: String(integration.pageId),
          name: integration.pageName || 'Connected Facebook Page',
          access_token: accessToken,
        });
      }
    }

    // 2. Fetch Lead Forms for each page with cursor pagination and questions
    const assets = [];

    for (const page of pages) {
      const forms = [];
      const pageToken = page.access_token || accessToken;
      let formFetchError = null;

      try {
        let nextFormsUrl = `${META_CONFIG.GRAPH_BASE_URL}/${apiVersion}/${page.id}/leadgen_forms`;
        let formParams = {
          fields: 'id,name,status,leads_count,questions,created_time',
          access_token: pageToken,
          limit: 50,
        };
        let formIterations = 0;

        while (nextFormsUrl && formIterations < 10) {
          formIterations++;
          const formsResponse = await axios.get(nextFormsUrl, {
            params: formParams,
            timeout: 15000,
          });
          const fBatch = formsResponse.data?.data || [];
          forms.push(...fBatch);
          nextFormsUrl = formsResponse.data?.paging?.next || null;
          formParams = {};
        }
      } catch (e) {
        formFetchError = e.response?.data?.error?.message || e.message;
        console.warn(`Forms fetch error for page ${page.id}:`, formFetchError);

        // Fallback attempt with userAccessToken if pageToken failed
        if (userAccessToken && userAccessToken !== pageToken) {
          try {
            const fallbackRes = await axios.get(`${META_CONFIG.GRAPH_BASE_URL}/${apiVersion}/${page.id}/leadgen_forms`, {
              params: {
                fields: 'id,name,status,leads_count,questions,created_time',
                access_token: userAccessToken,
                limit: 50,
              },
              timeout: 15000,
            });
            const fBatch = fallbackRes.data?.data || [];
            forms.push(...fBatch);
            formFetchError = null;
          } catch (e2) {
            console.warn(`Forms fallback fetch error for page ${page.id}:`, e2.message);
          }
        }
      }

      assets.push({
        pageId: String(page.id),
        pageName: page.name || 'Facebook Page',
        formFetchError,
        forms: forms.map((f) => ({
          formId: String(f.id),
          formName: f.name || `Form ${f.id}`,
          status: f.status || 'ACTIVE',
          leadsCount: f.leads_count || 0,
          questions: Array.isArray(f.questions) ? f.questions : [],
          createdTime: f.created_time || null,
        })),
      });
    }

    return res.json({
      success: true,
      data: assets,
    });
  } catch (error) {
    console.error('Meta getAssets error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve Meta assets',
    });
  }
};

/**
 * POST /api/integrations/meta/configure
 * Saves selected Page and Lead Form routing to existing CRM campaigns with strict tenant verification
 * and confirms real-time webhook subscription via Meta Graph API
 */
exports.configure = async (req, res) => {
  try {
    const { integrationId, pageId, pageName, formIds = [], formRouting = {}, fieldMapping = [] } = req.body;
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: integrationId,
      ...tenantQuery,
      provider: 'meta',
      status: 'connected',
    }).select('+accessTokenEncrypted');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found or unauthorized',
      });
    }

    const apiVersion = META_CONFIG.GRAPH_API_VERSION;
    let pageAccessToken = null;

    // Resolve Page Access Token safely
    try {
      if (String(integration.pageId) === String(pageId) && integration.accessTokenEncrypted) {
        pageAccessToken = decrypt(integration.accessTokenEncrypted);
      } else {
        // If switching pages, retrieve Page Access Token using user token from /me/accounts
        const userToken = integration.metadata?.userAccessTokenEncrypted
          ? decrypt(integration.metadata.userAccessTokenEncrypted)
          : (integration.accessTokenEncrypted ? decrypt(integration.accessTokenEncrypted) : null);

        if (userToken) {
          try {
            const accountsRes = await axios.get(
              `${META_CONFIG.GRAPH_BASE_URL}/${apiVersion}/me/accounts`,
              {
                params: {
                  fields: 'id,name,access_token',
                  access_token: userToken,
                },
                timeout: 10000,
              }
            );
            const foundPage = (accountsRes.data?.data || []).find((p) => String(p.id) === String(pageId));
            if (foundPage?.access_token) {
              pageAccessToken = foundPage.access_token;
              // Update integration with page-specific access token
              integration.accessTokenEncrypted = encrypt(pageAccessToken);
            }
          } catch (accErr) {
            console.warn('[Meta configure] Could not fetch page access token from /me/accounts:', accErr.message);
          }
        }
      }
    } catch (tokenErr) {
      console.warn('[Meta configure] Token decryption warning:', tokenErr.message);
    }

    // Subscribe Meta app to page leadgen webhooks via Graph API
    let webhookSubscribed = false;
    let subscriptionWarning = '';

    if (pageAccessToken && pageId) {
      try {
        const subRes = await axios.post(
          `${META_CONFIG.GRAPH_BASE_URL}/${apiVersion}/${pageId}/subscribed_apps`,
          null,
          {
            params: {
              subscribed_fields: 'leadgen',
              access_token: pageAccessToken,
            },
            timeout: 10000,
          }
        );
        if (subRes.data?.success) {
          webhookSubscribed = true;
          console.log(`[Meta configure] Subscribed App to Page "${pageName || pageId}":`, subRes.data);
        } else {
          subscriptionWarning = 'Meta accepted request but did not confirm webhook subscription';
        }
      } catch (subErr) {
        subscriptionWarning = subErr.response?.data?.error?.message || subErr.message;
        console.warn(`[Meta configure] Graph API subscribed_apps warning for Page ${pageId}:`, subscriptionWarning);
      }
    }

    integration.pageId = String(pageId || integration.pageId || '').trim();
    if (pageName) {
      integration.pageName = String(pageName).trim();
    }
    // Merge new formIds with existing formIds so configuring one form never drops others
    const formIdSet = new Set((integration.formIds || []).map((id) => String(id).trim()).filter(Boolean));
    for (const id of formIds) {
      if (id) formIdSet.add(String(id).trim());
    }
    if (formRouting && typeof formRouting === 'object') {
      for (const fId of Object.keys(formRouting)) {
        if (fId) formIdSet.add(String(fId).trim());
      }
    }
    integration.formIds = Array.from(formIdSet);

    // Track multiple connected pages in metadata
    if (!integration.metadata) integration.metadata = {};
    const existingPageIds = new Set((integration.metadata.pageIds || []).map(String));
    if (integration.pageId) existingPageIds.add(String(integration.pageId));
    if (pageId) existingPageIds.add(String(pageId).trim());
    integration.metadata.pageIds = Array.from(existingPageIds);

    if (pageAccessToken && pageId) {
      if (!integration.metadata.pageTokens) integration.metadata.pageTokens = {};
      integration.metadata.pageTokens[String(pageId).trim()] = encrypt(pageAccessToken);
    }

    integration.webhookSubscribed = webhookSubscribed;
    integration.lastSyncAt = new Date();
    if (Array.isArray(fieldMapping) && fieldMapping.length > 0) {
      integration.fieldMapping = fieldMapping;
    }
    if (subscriptionWarning) {
      integration.lastError = `Webhook subscription notice: ${subscriptionWarning}`;
    } else {
      integration.lastError = '';
    }

    await integration.save();

    // If formRouting is provided, configure dedicated LeadSourceSubscription per form
    const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
    const Campaign = require('../../models/Campaign');
    const wsId = req.workspaceId || req.user.workspaceId || null;
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);

    const savedMappings = [];

    if (formRouting && typeof formRouting === 'object') {
      try {
        const activeFormIdStrings = Object.keys(formRouting).map((id) => String(id).trim());

        // 1. Process active mappings for each form
        for (const [fId, config] of Object.entries(formRouting)) {
          if (!config || !config.campaignGroupId) continue;
          const cleanFormId = String(fId).trim();

          // Existing subscription lookup
          const existingSub = await LeadSourceSubscription.findOne({
            ...(companyId ? { companyId } : { userId: req.user._id }),
            provider: 'meta',
            externalFormId: cleanFormId,
          });

          const subFieldMapping = (config.fieldMapping && Array.isArray(config.fieldMapping) && config.fieldMapping.length > 0)
            ? config.fieldMapping
            : (Array.isArray(fieldMapping) && fieldMapping.length > 0 ? fieldMapping : (existingSub?.fieldMapping || []));

          // STRICT MULTI-TENANT VERIFICATION: Target campaign must belong to authenticated tenant
          let targetCampaign = null;
          if (config.campaignGroupId && config.campaignGroupId !== '__auto_create__') {
            targetCampaign = await Campaign.findOne({
              _id: config.campaignGroupId,
              ...tenantQuery,
              status: { $nin: ['archived', 'cancelled'] },
            });
          }

          // Auto-provision inbound campaign if none exists or __auto_create__ requested
          if (!targetCampaign) {
            const campName = (config.newCampaignName || (config.formName ? `${config.formName} (Meta Leads)` : `Meta Inbound Leads (${pageName || 'Facebook'})`)).trim();
            targetCampaign = await Campaign.create({
              companyId,
              userId: req.user._id,
              platform: 'meta',
              type: 'inbound',
              name: campName,
              displayName: campName,
              campaignName: campName,
              status: 'active',
              connectionId: String(pageId || integration.pageId || '').trim(),
              connectionName: String(pageName || integration.pageName || 'Facebook Page').trim(),
              integrationId: integration._id,
              routingRules: {
                metaFormIds: [cleanFormId],
                metaPageIds: [String(pageId || integration.pageId || '').trim()].filter(Boolean),
              },
              fieldMapping: subFieldMapping,
              assignmentRule: integration.assignmentRule || { type: 'round_robin' },
              leadCount: 0,
              leadsGenerated: 0,
            });
            console.log(`[Meta configure] Auto-created inbound campaign "${campName}" (${targetCampaign._id}) for tenant ${req.user._id}`);
          }

          // Clean up old campaign routing if destination changed
          if (existingSub?.campaignGroupId && String(existingSub.campaignGroupId) !== String(targetCampaign._id)) {
            await Campaign.findByIdAndUpdate(existingSub.campaignGroupId, {
              $pull: { 'routingRules.metaFormIds': cleanFormId },
            }).catch(() => null);
          }

          const updatedSub = await LeadSourceSubscription.findOneAndUpdate(
            {
              ...(companyId ? { companyId } : { userId: req.user._id }),
              provider: 'meta',
              externalFormId: cleanFormId,
            },
            {
              $set: {
                workspaceId: wsId,
                companyId,
                userId: req.user._id,
                integrationId: integration._id,
                provider: 'meta',
                sourceName: (config.formName || `Meta Form ${cleanFormId}`).trim(),
                externalAccountId: String(pageId || integration.pageId || '').trim(),
                externalAccountName: String(pageName || integration.pageName || '').trim(),
                externalFormId: cleanFormId,
                externalFormName: (config.formName || '').trim(),
                campaignGroupId: targetCampaign._id,
                fieldMapping: subFieldMapping,
                status: 'active',
                healthStatus: 'healthy',
                lastError: '',
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          // Dual-compatibility: also add form ID to campaign routingRules
          await Campaign.findByIdAndUpdate(targetCampaign._id, {
            $addToSet: { 'routingRules.metaFormIds': cleanFormId },
            ...(subFieldMapping.length > 0 ? { $set: { fieldMapping: subFieldMapping } } : {}),
          }).catch(() => null);

          savedMappings.push({
            formId: cleanFormId,
            formName: config.formName || '',
            campaignId: targetCampaign._id,
            campaignName: targetCampaign.displayName || targetCampaign.name || targetCampaign.campaignName,
            fieldCount: subFieldMapping.length,
          });
        }

        // ONLY pause other forms if replaceOtherForms is explicitly requested
        if (req.body.replaceOtherForms === true) {
          await LeadSourceSubscription.updateMany(
            {
              ...(companyId ? { companyId } : { userId: req.user._id }),
              provider: 'meta',
              integrationId: integration._id,
              externalFormId: { $nin: activeFormIdStrings },
            },
            {
              $set: { status: 'paused' },
            }
          );
        }
      } catch (subErr) {
        console.warn('[Meta configure] Form subscription configuration warning:', subErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Meta page and lead forms configured successfully',
      data: {
        id: integration._id,
        pageId: integration.pageId,
        pageName: integration.pageName,
        formIds: integration.formIds,
        webhookSubscribed: integration.webhookSubscribed,
        savedMappings,
        subscriptionWarning: subscriptionWarning || null,
      },
    });
  } catch (error) {
    console.error('Meta configure error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to configure Meta integration',
    });
  }
};

/**
 * POST /api/integrations/meta/test
 */
exports.testConnection = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    // If simulating a test lead injection
    if (req.body.name || req.body.phone || req.body.formName || req.body.simulate) {
      let targetIntegration = null;
      if (req.body.integrationId && mongoose.Types.ObjectId.isValid(req.body.integrationId)) {
        targetIntegration = await Integration.findOne({
          _id: req.body.integrationId,
          ...tenantQuery,
        });
      }

      if (!targetIntegration) {
        targetIntegration = await Integration.findOne({
          ...tenantQuery,
          provider: 'meta',
        });
      }

      if (!targetIntegration) {
        return res.status(404).json({
          success: false,
          connected: false,
          message: 'No active Meta Ads integration found. Please connect your Meta account first.',
        });
      }

      const result = await leadIngestionService.ingest({
        provider: 'meta',
        integrationId: targetIntegration._id,
        externalLeadId: `meta_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: req.body.name || 'Sarah Connor (Meta Test Lead)',
        phone: req.body.phone || '919876543210',
        email: req.body.email || 'sarah.connor@meta-ads-test.com',
        formId: req.body.formId || undefined,
        formName: req.body.formName || 'Instagram Instant Lead Form',
        campaignName: req.body.campaignName || 'Summer Enterprise Promo 2026',
        adSetName: req.body.adSetName || 'High Net Worth Retargeting',
        adName: req.body.adName || 'Video Ad 01',
      });

      return res.json({
        success: true,
        connected: true,
        message: 'Test Meta Lead injected into pipeline successfully!',
        lead: result.lead,
        created: result.created,
      });
    }

    // Live OAuth connection test
    const integration = await Integration.findOne({
      _id: req.body.integrationId,
      ...tenantQuery,
      provider: 'meta',
      status: 'connected',
    }).select('+accessTokenEncrypted');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found or disconnected',
      });
    }

    const accessToken = integration.accessTokenEncrypted
      ? decrypt(integration.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        connected: false,
        message: 'Meta access token is missing or corrupted',
      });
    }

    const response = await axios.get(
      `https://graph.facebook.com/${META_API_VERSION}/me`,
      {
        params: {
          fields: 'id,name',
          access_token: accessToken,
        },
      }
    );

    return res.json({
      success: true,
      connected: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Meta test error:', error.response?.data || error.message);
    return res.status(401).json({
      success: false,
      connected: false,
      message: 'Meta connection is invalid or expired',
    });
  }
};

/**
 * DELETE /api/integrations/meta/:integrationId
 */
exports.disconnect = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: req.params.integrationId,
      ...tenantQuery,
      provider: 'meta',
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found',
      });
    }

    integration.status = 'disconnected';
    integration.accessTokenEncrypted = null;
    integration.refreshTokenEncrypted = null;
    integration.webhookSubscribed = false;
    integration.lastError = 'Disconnected by user';

    await integration.save();

    // Immediate disconnect notification specifying exact reason
    await notifyIntegrationDisconnected({
      userId: integration.userId,
      companyId: integration.companyId,
      provider: 'meta',
      integrationName: integration.pageName || integration.pageId || 'Meta Page',
      reason: req.body?.reason || `Explicitly disconnected by ${req.user.name || req.user.email || 'user'}`,
    });

    return res.json({
      success: true,
      message: 'Meta integration disconnected successfully',
    });
  } catch (error) {
    console.error('Meta disconnect error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect Meta integration',
    });
  }
};

/**
 * GET /api/integrations/meta/forms/:formId/questions
 * Returns real question fields from a Meta lead generation form
 */
exports.getFormQuestions = async (req, res) => {
  try {
    const { formId } = req.params;
    const { integrationId } = req.query;
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: integrationId,
      ...tenantQuery,
      provider: 'meta',
    }).select('+accessTokenEncrypted');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found',
      });
    }

    const accessToken = integration.accessTokenEncrypted
      ? decrypt(integration.accessTokenEncrypted)
      : null;

    const userAccessToken = integration.metadata?.userAccessTokenEncrypted
      ? decrypt(integration.metadata.userAccessTokenEncrypted)
      : accessToken;

    const apiVersion = META_CONFIG.GRAPH_API_VERSION;

    let formRes = null;
    try {
      formRes = await axios.get(
        `${META_CONFIG.GRAPH_BASE_URL}/${apiVersion}/${formId}`,
        {
          params: {
            fields: 'id,name,status,leads_count,questions,context_card',
            access_token: accessToken || userAccessToken,
          },
          timeout: 10000,
        }
      );
    } catch (err1) {
      if (userAccessToken && userAccessToken !== accessToken) {
        formRes = await axios.get(
          `${META_CONFIG.GRAPH_BASE_URL}/${apiVersion}/${formId}`,
          {
            params: {
              fields: 'id,name,status,leads_count,questions,context_card',
              access_token: userAccessToken,
            },
            timeout: 10000,
          }
        );
      } else {
        throw err1;
      }
    }

    const formData = formRes.data || {};
    return res.json({
      success: true,
      data: {
        formId: String(formData.id || formId),
        formName: formData.name || `Form ${formId}`,
        status: formData.status || 'ACTIVE',
        questions: Array.isArray(formData.questions) ? formData.questions : [],
      },
    });
  } catch (error) {
    console.error('Meta getFormQuestions error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Failed to retrieve form questions',
    });
  }
};

/**
 * GET /api/integrations/meta/forms
 * Returns all currently integrated Meta forms with their mapped campaign,
 * field mappings, status, and lead capture counts.
 */
exports.getIntegratedForms = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);
    const integrationId = req.query.integrationId;

    let integration = null;
    if (integrationId && mongoose.Types.ObjectId.isValid(integrationId)) {
      integration = await Integration.findOne({
        _id: integrationId,
        ...tenantQuery,
        provider: 'meta',
      });
    }
    if (!integration) {
      integration = await Integration.findOne({
        ...tenantQuery,
        provider: 'meta',
        status: { $ne: 'disconnected' },
      });
    }

    if (!integration) {
      return res.json({
        success: true,
        forms: [],
      });
    }

    const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);

    const subscriptions = await LeadSourceSubscription.find({
      ...(companyId ? { companyId } : { userId: req.user._id }),
      provider: 'meta',
      integrationId: integration._id,
      status: 'active',
    })
      .populate('campaignGroupId', 'name displayName campaignName platform status leadCount')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const forms = subscriptions.map((sub) => ({
      subscriptionId: sub._id,
      formId: String(sub.externalFormId),
      formName: sub.externalFormName || sub.sourceName || `Meta Form ${sub.externalFormId}`,
      pageId: sub.externalAccountId || integration.pageId || '',
      pageName: sub.externalAccountName || integration.pageName || '',
      campaign: sub.campaignGroupId ? {
        _id: sub.campaignGroupId._id,
        name: sub.campaignGroupId.displayName || sub.campaignGroupId.name || sub.campaignGroupId.campaignName,
        platform: sub.campaignGroupId.platform,
      } : null,
      fieldMapping: Array.isArray(sub.fieldMapping) ? sub.fieldMapping : [],
      totalLeadsCount: sub.totalLeadsCount || 0,
      lastLeadAt: sub.lastLeadAt || null,
      status: sub.status || 'active',
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    }));

    return res.json({
      success: true,
      integration: {
        _id: integration._id,
        pageId: integration.pageId,
        pageName: integration.pageName,
        totalForms: forms.length,
      },
      forms,
    });
  } catch (error) {
    console.error('getIntegratedForms error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve integrated Meta forms',
    });
  }
};

/**
 * DELETE /api/integrations/meta/forms/:formId
 * Unlinks a specific integrated Meta form without affecting other forms
 */
exports.deleteIntegratedForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const { integrationId } = req.query;
    const tenantQuery = getTenantQuery(req.user);
    const cleanFormId = String(formId).trim();

    let integration = null;
    if (integrationId && mongoose.Types.ObjectId.isValid(integrationId)) {
      integration = await Integration.findOne({
        _id: integrationId,
        ...tenantQuery,
        provider: 'meta',
      });
    }
    if (!integration) {
      integration = await Integration.findOne({
        ...tenantQuery,
        provider: 'meta',
        status: { $ne: 'disconnected' },
      });
    }

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found or unauthorized',
      });
    }

    const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
    const Campaign = require('../../models/Campaign');
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);

    // 1. Remove subscription
    const sub = await LeadSourceSubscription.findOne({
      ...(companyId ? { companyId } : { userId: req.user._id }),
      provider: 'meta',
      externalFormId: cleanFormId,
    });

    if (sub) {
      await LeadSourceSubscription.deleteOne({ _id: sub._id });
      if (sub.campaignGroupId) {
        await Campaign.findByIdAndUpdate(sub.campaignGroupId, {
          $pull: { 'routingRules.metaFormIds': cleanFormId },
        }).catch(() => null);
      }
    }

    // 2. Remove formId from integration.formIds
    integration.formIds = (integration.formIds || []).filter((id) => String(id).trim() !== cleanFormId);
    await integration.save();

    // 3. Remove formId from any Campaign routingRules
    await Campaign.updateMany(
      {
        ...tenantQuery,
        'routingRules.metaFormIds': cleanFormId,
      },
      {
        $pull: { 'routingRules.metaFormIds': cleanFormId },
      }
    ).catch(() => null);

    return res.json({
      success: true,
      message: `Meta form ${cleanFormId} unlinked successfully`,
      remainingFormIds: integration.formIds,
    });
  } catch (error) {
    console.error('deleteIntegratedForm error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unlink Meta form',
    });
  }
};