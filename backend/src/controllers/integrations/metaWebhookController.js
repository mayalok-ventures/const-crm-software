const crypto = require('crypto');

const Integration =
  require('../../models/Integration');

const leadIngestionService =
  require('../../services/integrations/leadIngestionService');

const META_VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN;

const META_APP_SECRET =
  process.env.META_APP_SECRET;


/**
 * GET /api/integrations/meta/webhook
 *
 * Meta webhook verification
 */
exports.verify = async (req, res) => {
  try {
    const mode =
      req.query['hub.mode'];

    const token =
      req.query['hub.verify_token'];

    const challenge =
      req.query['hub.challenge'];

    if (
      mode === 'subscribe' &&
      token === META_VERIFY_TOKEN
    ) {
      return res
        .status(200)
        .send(challenge);
    }

    return res.sendStatus(403);

  } catch (error) {
    console.error(
      'Meta webhook verify error:',
      error
    );

    return res.sendStatus(500);
  }
};


/**
 * POST /api/integrations/meta/webhook
 */
exports.receive = async (req, res) => {
  try {

    if (
      !verifySignature(
        req
      )
    ) {
      console.warn(
        'Invalid Meta webhook signature'
      );

      return res.sendStatus(401);
    }

    const body =
      req.body;

    // Always acknowledge quickly
    res.sendStatus(200);

    setImmediate(async () => {

      try {

        if (
          body?.object !== 'page'
        ) {
          return;
        }

        for (
          const entry
          of body.entry || []
        ) {

          for (
            const change
            of entry.changes || []
          ) {

            if (
              change.field !==
              'leadgen'
            ) {
              continue;
            }

            const value =
              change.value || {};

            await handleLead({
              pageId:
                value.page_id ||
                entry.id,

              formId:
                value.form_id,

              leadgenId:
                value.leadgen_id,

              adId:
                value.ad_id,
            });
          }
        }

      } catch (error) {

        console.error(
          'Meta async webhook processing:',
          error
        );
      }
    });

  } catch (error) {

    console.error(
      'Meta webhook error:',
      error
    );

    return res.sendStatus(500);
  }
};


function verifySignature(req) {

  const signature =
    req.headers[
      'x-hub-signature-256'
    ];

  if (!signature) {
    return false;
  }

  const [algorithm, hash] =
    signature.split('=');

  if (
    algorithm !== 'sha256' ||
    !hash
  ) {
    return false;
  }

  const expected =
    crypto
      .createHmac(
        'sha256',
        META_APP_SECRET
      )
      .update(
        JSON.stringify(req.body)
      )
      .digest('hex');

  try {

    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expected, 'hex')
    );

  } catch {
    return false;
  }
}


async function handleLead({
  pageId,
  formId,
  leadgenId,
  adId,
}) {

  if (!leadgenId) {
    return;
  }

  const integration =
    await Integration.findOne({
      provider: 'meta',
      pageId,
      isActive: true,
    });

  if (!integration) {

    console.warn(
      `No integration for Meta page ${pageId}`
    );

    return;
  }

  /*
   * Actual lead fields Meta Graph API
   * se fetch karne hain.
   */

  const lead =
    await fetchMetaLead(
      leadgenId,
      integration.accessToken
    );

  await leadIngestionService.ingest({

    provider: 'meta',

    integrationId:
      integration._id,

    externalLeadId:
      leadgenId,

    accountId:
      integration.accountId,

    pageId,

    formId,

    adId,

    name:
      lead.name,

    phone:
      lead.phone,

    email:
      lead.email,

    campaignId:
      lead.campaignId,

    campaignName:
      lead.campaignName,

    adSetId:
      lead.adSetId,

    adSetName:
      lead.adSetName,

    adName:
      lead.adName,

    customData:
      lead.customData,
  });
}


async function fetchMetaLead(
  leadgenId,
  accessToken
) {

  const version =
    process.env.META_GRAPH_VERSION ||
    'v23.0';

  const fields = [
    'id',
    'created_time',
    'field_data',
    'ad_id',
    'form_id',
    'campaign_id',
    'adset_id',
  ].join(',');

  const url =
    `https://graph.facebook.com/${version}/${leadgenId}`;

  const response =
    await fetch(
      `${url}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`
    );

  if (!response.ok) {

    const text =
      await response.text();

    throw new Error(
      `Meta API ${response.status}: ${text}`
    );
  }

  const data =
    await response.json();

  const fieldsMap = {};

  for (
    const field
    of data.field_data || []
  ) {

    fieldsMap[field.name] =
      field.values?.[0] || '';
  }

  return {

    name:
      fieldsMap.full_name ||
      fieldsMap.name ||
      '',

    phone:
      fieldsMap.phone_number ||
      fieldsMap.phone ||
      '',

    email:
      fieldsMap.email ||
      '',

    campaignId:
      data.campaign_id ||
      null,

    adSetId:
      data.adset_id ||
      null,

    adId:
      data.ad_id ||
      null,

    customData:
      fieldsMap,
  };
}