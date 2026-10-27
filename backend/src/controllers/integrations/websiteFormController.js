const crypto = require('crypto');
const Integration = require('../../models/Integration');
const webhookQueueService = require('../../services/integrations/webhookQueueService');
const { parseLosslessJson } = require('../../utils/losslessJson');

/**
 * POST /api/integrations/forms/:formKey/submit
 *
 * Public inbound endpoint for website lead generation forms.
 * Protected by CORS allow-listing, honeypot spam traps, and IP rate limiting.
 */
exports.submitForm = async (req, res) => {
  try {
    const { formKey } = req.params;
    if (!formKey) {
      return res.status(400).json({ error: 'Form key is required' });
    }

    const integration = await Integration.findOne({
      provider: 'website',
      'websiteFormConfig.formKey': formKey,
      status: 'connected',
    });

    if (!integration) {
      return res.status(404).json({ error: 'Website form integration not found or inactive' });
    }

    const formConfig = integration.websiteFormConfig || {};

    // 1. CORS Domain Allow-List Check (Default: Deny-all until admin adds allowed domains)
    const origin = req.headers.origin || req.headers.referer || '';
    const allowedOrigins = Array.isArray(formConfig.allowedOrigins) ? formConfig.allowedOrigins.filter(Boolean) : [];

    if (allowedOrigins.length === 0) {
      console.warn(`[Website Form] Rejected submission: No allowed domains configured for formKey "${formKey}". Default is deny-all.`);
      return res.status(403).json({ error: 'Website form is locked: No allowed domains configured. Please add your website domain in CRM Integrations settings.' });
    }

    if (!allowedOrigins.includes('*')) {
      if (!origin) {
        console.warn(`[Website Form] Rejected submission: Missing Origin header for formKey "${formKey}"`);
        return res.status(403).json({ error: 'Origin header required for form submission' });
      }

      const originMatch = allowedOrigins.some((allowed) => {
        try {
          const originHost = new URL(origin).host;
          const allowedHost = allowed.replace(/^https?:\/\//, '').split('/')[0];
          return originHost === allowedHost || originHost.endsWith(`.${allowedHost}`);
        } catch {
          return false;
        }
      });

      if (!originMatch) {
        console.warn(`[Website Form] Rejected submission from unauthorized origin: "${origin}" for formKey "${formKey}"`);
        return res.status(403).json({ error: 'Origin not allowed' });
      }
    }

    const payload = parseLosslessJson(req.rawBody || req.body);

    // 2. Honeypot Spam Trap Check
    const honeypotFieldName = formConfig.honeypotField || '_crm_hp_trap';
    if (payload[honeypotFieldName]) {
      console.warn(`[Website Form] Bot detected via honeypot trap (${honeypotFieldName}) on form "${formKey}". Discarded safely.`);
      // Return 200 OK so bots are not alerted that they were filtered
      return res.status(200).json({ success: true, status: 'RECEIVED' });
    }

    // Generate unique external ID for this submission
    const externalLeadId = `web_${formKey}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    // 3. Enqueue to durable MongoDB Queue
    await webhookQueueService.enqueueEvent({
      provider: 'website',
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
    console.error('[Website Form Error]:', error.message);
    return res.status(500).json({ error: 'Queue error' });
  }
};

/**
 * Generate embeddable HTML / JS snippet for the wizard
 */
exports.getEmbedSnippet = (formKey) => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const submitUrl = `${backendUrl}/api/integrations/forms/${formKey}/submit`;

  return `<!-- CRM Lead Capture Snippet -->
<form id="crm-inbound-lead-form">
  <!-- Honeypot Bot Trap (Keep hidden from real users) -->
  <input type="text" name="_crm_hp_trap" style="display:none !important;" tabindex="-1" autocomplete="off" />

  <!-- Standard Form Fields -->
  <input type="text" name="name" placeholder="Full Name" required />
  <input type="tel" name="phone" placeholder="Mobile Number (+91)" required />
  <input type="email" name="email" placeholder="Email Address" />

  <button type="submit">Submit Inquiry</button>
</form>

<script>
document.getElementById('crm-inbound-lead-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  // Capture UTM parameters and click IDs from URL
  const urlParams = new URLSearchParams(window.location.search);
  data.utm_source = urlParams.get('utm_source') || '';
  data.utm_medium = urlParams.get('utm_medium') || '';
  data.utm_campaign = urlParams.get('utm_campaign') || '';
  data.gclid = urlParams.get('gclid') || '';
  data.fbclid = urlParams.get('fbclid') || '';
  data.landing_page = window.location.href;
  data.referrer = document.referrer || '';

  try {
    const res = await fetch('${submitUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      alert('Thank you! Your inquiry has been received.');
      this.reset();
    }
  } catch(err) {
    console.error('Submission failed', err);
  }
});
</script>`;
};
