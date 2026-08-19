const mongoose = require('mongoose');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const User = require('../../models/User');
const TenantConfig = require('../../models/TenantConfig');
const { normalizePhone } = require('../../utils/phoneNormalizer');

class LeadIngestionService {
  /**
   * Main lead ingestion pipeline.
   * Handles validation, tenant resolution, normalization, deduplication,
   * attribution assignment, and concurrency-safe MongoDB creation.
   */
  async ingest(data) {
    const {
      provider,
      integrationId,
      externalLeadId,

      accountId,
      pageId,
      formId,
      formName,

      campaignId,
      campaignName,

      adSetId,
      adSetName,

      adGroupId,
      adGroupName,

      adId,
      adName,

      name,
      phone,
      email,

      customData = {},
      createdAt,
    } = data;

    // ---------------------------------------------------------
    // 1. Validation
    // ---------------------------------------------------------
    if (!provider) {
      throw new Error('Lead provider is required (meta or google)');
    }

    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    if (!externalLeadId) {
      throw new Error('External lead ID is required');
    }

    if (!name && !phone && !email) {
      throw new Error('Lead must contain at least name, phone, or email');
    }

    // ---------------------------------------------------------
    // 2. Integration Verification
    // ---------------------------------------------------------
    const integration = await Integration.findById(integrationId);

    if (!integration) {
      throw new Error(`Integration not found with ID: ${integrationId}`);
    }

    const isConnected =
      integration.status === 'connected' ||
      integration.isActive === true;

    if (!isConnected) {
      throw new Error(`Integration ${integrationId} is inactive or disconnected`);
    }

    const companyId = integration.companyId || null;
    const userId = integration.userId;

    if (!userId && !companyId) {
      throw new Error('Integration has no associated owner or company');
    }

    // ---------------------------------------------------------
    // 3. Normalization
    // ---------------------------------------------------------
    const cleanedName = this.cleanString(name) || 'Inbound Webhook Lead';
    const normalizedPhone = normalizePhone(phone) || (phone ? String(phone).replace(/\D/g, '') : '');
    const normalizedEmail = this.normalizeEmail(email);

    // ---------------------------------------------------------
    // 4. Idempotency Check: Existing External Lead ID
    // ---------------------------------------------------------
    const tenantQuery = companyId
      ? { companyId }
      : { userId, companyId: null };

    let existingLead = await Lead.findOne({
      ...tenantQuery,
      'leadSource.provider': provider,
      'leadSource.externalLeadId': String(externalLeadId),
    });

    if (existingLead) {
      // Update attribution metadata if new details arrived
      if (formName && !existingLead.leadSource.formName) existingLead.leadSource.formName = formName;
      if (campaignName && !existingLead.leadSource.campaignName) existingLead.leadSource.campaignName = campaignName;
      if (adSetName && !existingLead.leadSource.adSetName) existingLead.leadSource.adSetName = adSetName;
      if (adGroupName && !existingLead.leadSource.adGroupName) existingLead.leadSource.adGroupName = adGroupName;
      if (adName && !existingLead.leadSource.adName) existingLead.leadSource.adName = adName;

      await existingLead.save();

      return {
        created: false,
        duplicate: true,
        reason: 'duplicate_external_lead_id',
        lead: existingLead,
      };
    }

    // ---------------------------------------------------------
    // 5. Deduplication Check: Existing Phone for Same Tenant
    // ---------------------------------------------------------
    if (normalizedPhone) {
      const existingPhoneLead = await Lead.findOne({
        ...tenantQuery,
        phone: normalizedPhone,
      });

      if (existingPhoneLead) {
        // Log activity on the existing lead about the new ad submission
        existingPhoneLead.leadActivities.push({
          action: 'message_received',
          performerName: `${provider.toUpperCase()} Lead Ingestion`,
          details: `Repeat ad submission from campaign: ${campaignName || 'Unknown Campaign'} (Form: ${formName || 'Lead Form'})`,
          timestamp: new Date(),
        });

        // Update campaign attribution if newer
        if (campaignName) existingPhoneLead.leadSource.campaignName = campaignName;
        if (formName) existingPhoneLead.leadSource.formName = formName;

        await existingPhoneLead.save();

        return {
          created: false,
          duplicate: true,
          reason: 'duplicate_phone_number',
          lead: existingPhoneLead,
        };
      }
    }

    // ---------------------------------------------------------
    // 6. Round-Robin & Attribution Assignment
    // ---------------------------------------------------------
    let assignedTo = null;
    let assignedToName = '';

    try {
      const config = await TenantConfig.findOne({
        $or: [{ userId }, { companyId: companyId || userId }]
      });
      if (config?.automationSettings?.roundRobinEnabled) {
        const { assignEdTechRoundRobin } = require('../automationHandlers');
        const agentId = await assignEdTechRoundRobin({ tenantUserId: userId, companyId });
        if (agentId) {
          assignedTo = agentId;
          const assignedUser = await User.findById(agentId).select('name');
          assignedToName = assignedUser?.name || '';
        }
      }
    } catch (rrErr) {
      console.warn('[Lead Ingestion] Round robin assignment notice:', rrErr.message);
    }

    // If tenant user has custom pipeline stage, initialize into 1st stage
    let initialStatus = 'new_lead';
    try {
      const ownerUser = await User.findById(userId).select('customPipelineStages');
      if (ownerUser?.customPipelineStages?.length > 0) {
        initialStatus = ownerUser.customPipelineStages[0];
      }
    } catch {
      initialStatus = 'new_lead';
    }

    // ---------------------------------------------------------
    // 7. Create Lead Document
    // ---------------------------------------------------------
    const lead = new Lead({
      userId,
      companyId,
      assignedTo,
      assignedToName,

      name: cleanedName,
      phone: normalizedPhone || '0000000000',
      email: normalizedEmail,

      status: initialStatus,
      source: provider.toLowerCase(),
      tags: [
        provider.toLowerCase(),
        `${provider.toLowerCase()}_ads`,
        'lead_form',
      ],

      propertyType: formName || `${provider.toUpperCase()} Ad Ingestion`,
      budget: 'Standard',

      customData,

      leadSource: {
        provider: provider.toLowerCase(),
        externalLeadId: String(externalLeadId),
        integrationId: integration._id,
        accountId: accountId || integration.accountId || null,
        pageId: pageId || integration.pageId || null,
        formId: formId || null,
        formName: formName || '',
        campaignId: campaignId || null,
        campaignName: campaignName || '',
        adSetId: adSetId || null,
        adSetName: adSetName || '',
        adGroupId: adGroupId || null,
        adGroupName: adGroupName || '',
        adId: adId || null,
        adName: adName || '',
        importedAt: createdAt ? new Date(createdAt) : new Date(),
      },

      followUpDate: this.defaultFollowUpDate(),

      leadActivities: [
        {
          action: 'lead_created',
          performerName: `${provider.toUpperCase()} Ads Ingestion`,
          details: `Lead imported from ${provider.toUpperCase()} Campaign: ${campaignName || 'Default'} (Form: ${formName || 'Instant Form'})`,
          timestamp: new Date(),
        },
      ],
    });

    // ---------------------------------------------------------
    // 8. Atomic Concurrency-Safe Save
    // ---------------------------------------------------------
    try {
      await lead.save();
    } catch (error) {
      // Catch MongoDB duplicate key race condition (E11000)
      if (error.code === 11000) {
        const duplicate = await Lead.findOne({
          ...tenantQuery,
          $or: [
            {
              'leadSource.provider': provider,
              'leadSource.externalLeadId': String(externalLeadId),
            },
            ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ],
        });

        if (duplicate) {
          return {
            created: false,
            duplicate: true,
            reason: 'concurrency_race_resolved',
            lead: duplicate,
          };
        }
      }

      throw error;
    }

    return {
      created: true,
      duplicate: false,
      lead,
    };
  }

  normalizeEmail(email) {
    if (!email) return undefined;
    const cleaned = String(email).trim().toLowerCase();
    return cleaned.includes('@') ? cleaned : undefined;
  }

  cleanString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  defaultFollowUpDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  }
}

module.exports = new LeadIngestionService();