const mongoose = require('mongoose');

const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');

class LeadIngestionService {

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
    // Validation
    // ---------------------------------------------------------

    if (!provider) {
      throw new Error(
        'Lead provider is required'
      );
    }

    if (!integrationId) {
      throw new Error(
        'Integration ID is required'
      );
    }

    if (!externalLeadId) {
      throw new Error(
        'External lead ID is required'
      );
    }

    if (!name && !phone && !email) {
      throw new Error(
        'Lead must contain at least name, phone or email'
      );
    }

    // ---------------------------------------------------------
    // Integration
    // ---------------------------------------------------------

    const integration = await Integration.findById(
      integrationId
    );

    if (!integration) {
      throw new Error(
        'Integration not found'
      );
    }

    if (!integration.isActive) {
      throw new Error(
        'Integration is inactive'
      );
    }

    // ---------------------------------------------------------
    // Idempotency
    // ---------------------------------------------------------

    const existingLead = await Lead.findOne({
      companyId: integration.companyId || null,

      'leadSource.provider': provider,

      'leadSource.externalLeadId':
        externalLeadId,
    });

    if (existingLead) {

      // Optional metadata update

      existingLead.leadSource.accountId =
        accountId || existingLead.leadSource.accountId;

      existingLead.leadSource.pageId =
        pageId || existingLead.leadSource.pageId;

      existingLead.leadSource.formId =
        formId || existingLead.leadSource.formId;

      existingLead.leadSource.formName =
        formName || existingLead.leadSource.formName;

      existingLead.leadSource.campaignId =
        campaignId ||
        existingLead.leadSource.campaignId;

      existingLead.leadSource.campaignName =
        campaignName ||
        existingLead.leadSource.campaignName;

      existingLead.leadSource.adSetId =
        adSetId ||
        existingLead.leadSource.adSetId;

      existingLead.leadSource.adSetName =
        adSetName ||
        existingLead.leadSource.adSetName;

      existingLead.leadSource.adId =
        adId ||
        existingLead.leadSource.adId;

      existingLead.leadSource.adName =
        adName ||
        existingLead.leadSource.adName;

      await existingLead.save();

      return {
        created: false,
        duplicate: true,
        lead: existingLead,
      };
    }

    // ---------------------------------------------------------
    // Determine owner
    // ---------------------------------------------------------

    const companyId =
      integration.companyId || null;

    const userId =
      integration.userId;

    if (!userId && !companyId) {
      throw new Error(
        'Integration has no owner'
      );
    }

    // ---------------------------------------------------------
    // Normalize phone
    // ---------------------------------------------------------

    const normalizedPhone =
      this.normalizePhone(phone);

    // ---------------------------------------------------------
    // Create Lead
    // ---------------------------------------------------------

    const lead = new Lead({

      userId,

      companyId,

      assignedTo: null,

      assignedToName: '',

      name:
        this.cleanString(name) ||
        'Unknown Lead',

      phone:
        normalizedPhone ||
        'unknown',

      email:
        this.normalizeEmail(email),

      status: 'new',

      customData,

      source: provider,

      leadSource: {
        provider,

        externalLeadId,

        integrationId,

        accountId: accountId || null,

        pageId: pageId || null,

        formId: formId || null,

        formName:
          formName || '',

        campaignId:
          campaignId || null,

        campaignName:
          campaignName || '',

        adSetId:
          adSetId || null,

        adSetName:
          adSetName || '',

        adId:
          adId || null,

        adName:
          adName || '',

        importedAt:
          new Date(),
      },

      followUpDate:
        this.defaultFollowUpDate(),

      leadActivities: [
        {
          action: 'lead_created',

          performerName:
            `${provider} Integration`,

          details:
            `Lead imported from ${provider}`,

          timestamp:
            new Date(),
        },
      ],
    });

    // ---------------------------------------------------------
    // Save
    // ---------------------------------------------------------

    try {

      await lead.save();

    } catch (error) {

      // Race-condition duplicate handling

      if (error.code === 11000) {

        const duplicate =
          await Lead.findOne({
            companyId,
            'leadSource.provider':
              provider,
            'leadSource.externalLeadId':
              externalLeadId,
          });

        return {
          created: false,
          duplicate: true,
          lead: duplicate,
        };
      }

      throw error;
    }

    return {
      created: true,
      duplicate: false,
      lead,
    };
  }

  normalizePhone(phone) {

    if (!phone) {
      return '';
    }

    return String(phone)
      .replace(/[^\d+]/g, '')
      .trim();
  }

  normalizeEmail(email) {

    if (!email) {
      return undefined;
    }

    return String(email)
      .trim()
      .toLowerCase();
  }

  cleanString(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    return String(value).trim();
  }

  defaultFollowUpDate() {

    const date = new Date();

    date.setDate(
      date.getDate() + 1
    );

    return date;
  }
}

module.exports =
  new LeadIngestionService();