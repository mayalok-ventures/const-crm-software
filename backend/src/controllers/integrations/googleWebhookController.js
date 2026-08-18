const crypto = require('crypto');

const Integration =
  require('../../models/Integration');

const leadIngestionService =
  require('../../services/integrations/leadIngestionService');


/**
 * POST /api/integrations/google/webhook
 */
exports.receive = async (
  req,
  res
) => {

  try {

    /*
     * Google webhook ko immediately acknowledge.
     */

    const payload =
      req.body;

    /*
     * Secret verification
     *
     * Exact header/payload verification should match
     * the webhook schema configured for your Google Ads
     * LeadFormAsset.
     */

    if (
      !verifyGoogleWebhook(req)
    ) {

      console.warn(
        'Invalid Google webhook'
      );

      return res.sendStatus(401);
    }

    res.sendStatus(200);

    setImmediate(
      async () => {

        try {

          await processGoogleLead(
            payload
          );

        } catch (error) {

          console.error(
            'Google lead processing failed:',
            error
          );
        }
      }
    );

  } catch (error) {

    console.error(
      'Google webhook error:',
      error
    );

    return res.sendStatus(500);
  }
};


/**
 * Verify webhook secret.
 *
 * IMPORTANT:
 * Adjust header name/verification algorithm to the
 * exact Google Lead Form webhook schema you configure.
 */
function verifyGoogleWebhook(req) {

  const configuredSecret =
    process.env.GOOGLE_WEBHOOK_SECRET;

  if (!configuredSecret) {

    console.error(
      'GOOGLE_WEBHOOK_SECRET is not configured'
    );

    return false;
  }

  /*
   * Depending on Google's webhook delivery configuration,
   * use the corresponding secret/header verification.
   */

  const receivedSecret =
    req.headers[
      'x-google-webhook-secret'
    ];

  if (!receivedSecret) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(
      String(receivedSecret)
    ),

    Buffer.from(
      String(configuredSecret)
    )
  );
}


async function processGoogleLead(
  payload
) {

  /*
   * Google webhook payload should be normalized here.
   *
   * Keep provider-specific parsing out of
   * leadIngestionService.
   */

  const externalLeadId =
    payload.leadId ||
    payload.lead_id ||
    payload.id;

  if (!externalLeadId) {

    console.warn(
      'Google lead ID missing'
    );

    return;
  }

  const customerId =
    normalizeCustomerId(
      payload.customerId ||
      payload.customer_id ||
      payload.googleAdsCustomerId
    );

  if (!customerId) {

    console.warn(
      'Google customer ID missing'
    );

    return;
  }

  const Integration =
    require('../../models/Integration');

  const integration =
    await Integration.findOne({

      provider:
        'google',

      accountId:
        customerId,

      isActive:
        true,
    });

  if (!integration) {

    console.warn(
      `No Google integration for ${customerId}`
    );

    return;
  }

  /*
   * If Google payload already contains contact
   * fields, use them.
   *
   * Otherwise fetch the submission through the
   * appropriate Google Ads API flow.
   */

  const lead =
    normalizeGoogleLead(
      payload
    );

  await leadIngestionService.ingest({

    provider:
      'google',

    integrationId:
      integration._id,

    externalLeadId,

    accountId:
      customerId,

    campaignId:
      lead.campaignId,

    campaignName:
      lead.campaignName,

    adGroupId:
      lead.adGroupId,

    adGroupName:
      lead.adGroupName,

    adId:
      lead.adId,

    adName:
      lead.adName,

    formId:
      lead.formId,

    formName:
      lead.formName,

    name:
      lead.name,

    phone:
      lead.phone,

    email:
      lead.email,

    customData:
      lead.customData,
  });
}


function normalizeGoogleLead(
  payload
) {

  const fields =
    payload.fields ||
    payload.leadFields ||
    payload.formData ||
    {};

  return {

    name:
      fields.full_name ||
      fields.name ||
      payload.name ||
      '',

    phone:
      fields.phone_number ||
      fields.phone ||
      payload.phone ||
      '',

    email:
      fields.email ||
      payload.email ||
      '',

    campaignId:
      payload.campaignId ||
      payload.campaign_id ||
      null,

    campaignName:
      payload.campaignName ||
      '',

    adGroupId:
      payload.adGroupId ||
      payload.ad_group_id ||
      null,

    adGroupName:
      payload.adGroupName ||
      '',

    adId:
      payload.adId ||
      payload.ad_id ||
      null,

    adName:
      payload.adName ||
      '',

    formId:
      payload.formId ||
      payload.assetId ||
      null,

    formName:
      payload.formName ||
      '',

    customData:
      fields,
  };
}


function normalizeCustomerId(
  value
) {

  if (!value) {
    return null;
  }

  return String(value)
    .replace(
      /customers\//,
      ''
    )
    .replace(
      /-/g,
      ''
    );
}