const mongoose = require('mongoose');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const Campaign = require('../../models/Campaign');
const User = require('../../models/User');
const assignmentService = require('./assignmentService');
const { normalizePhone } = require('../../utils/phoneNormalizer');
const { emitCRMEvent, CRM_EVENTS } = require('../automationEvents');

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '');
}

class LeadIngestionService {
  /**
   * Main Lead Ingestion Pipeline
   *
   * Executes validation, field mapping, normalization, idempotency checking,
   * campaign registry auto-creation/lookup, multi-inquiry appending, atomic assignment,
   * and safe database upsertion.
   */
  async ingest(data) {
    const {
      provider,
      platform: rawPlatform,
      integrationId,
      externalLeadId,
      connectionId: rawConnectionId,
      connectionName: rawConnectionName,
      accountId,
      pageId,
      formId,
      formName = '',
      campaignId: rawCampaignId,
      campaignName: rawCampaignName,
      adSetId,
      adSetName = '',
      adGroupId,
      adGroupName = '',
      adId,
      adName = '',
      name = '',
      phone = '',
      email = '',
      customData = {},
      rawAnswers = [],
      isTest = false,
      utmSource = '',
      utmMedium = '',
      utmCampaign = '',
      createdAt,
    } = data;

    const platform = String(rawPlatform || provider || 'custom').toLowerCase().trim();

    // 1. Validation
    if (!platform) {
      throw new Error('Platform/Provider is required (meta, google, website, sheets, custom)');
    }
    if (!integrationId) {
      throw new Error('Integration ID is required');
    }
    if (!externalLeadId) {
      throw new Error('External lead ID is required for idempotency');
    }

    // 2. Integration Verification
    const integration = await Integration.findById(integrationId);
    if (!integration) {
      throw new Error(`Integration not found with ID: ${integrationId}`);
    }

    const companyId = integration.companyId || null;
    const userId = integration.userId;

    if (!userId && !companyId) {
      throw new Error('Integration has no associated owner or company');
    }

    const tenantQuery = companyId ? { companyId } : { userId, companyId: null };

    // 3. Resolve Connection Hierarchy
    const connectionId = String(
      rawConnectionId ||
      pageId ||
      accountId ||
      integration.pageId ||
      integration.customerId ||
      integration.accountId ||
      integration.sheetsConfig?.sheetId ||
      integration.websiteFormConfig?.formKey ||
      formId ||
      integration._id
    );

    const connectionName = String(
      rawConnectionName ||
      formName ||
      integration.pageName ||
      integration.accountName ||
      integration.sheetsConfig?.sheetName ||
      integration.name ||
      'Inbound Connection'
    );

    // 4. Resolve Inbound Campaign (Prioritizing User-Configured Campaigns with Routing Rules)
    const normalizedCampaignName = String(
      rawCampaignName ||
      utmCampaign ||
      customData['Campaign'] ||
      customData['campaign'] ||
      customData['utm_campaign'] ||
      integration.metadata?.defaultCampaignLabel ||
      integration.accountName ||
      'Default Inbound Campaign'
    ).trim();

    const campaignTenantFilter = companyId
      ? { $or: [{ companyId }, { userId }] }
      : { userId };

    const matchOrConditions = [];

    // Rule A: Meta Form / Page matches (e.g. "X form" on Meta)
    if (formId) {
      matchOrConditions.push({ 'routingRules.metaFormIds': String(formId) });
    }
    if (formName) {
      matchOrConditions.push({ 'routingRules.metaFormNames': new RegExp(`^${formName.trim()}$`, 'i') });
    }
    if (pageId) {
      matchOrConditions.push({ 'routingRules.metaPageIds': String(pageId) });
    }

    // Rule B: Google Ads matches (e.g. specific Google account or Campaign)
    if (accountId) {
      matchOrConditions.push({ 'routingRules.googleAccountIds': String(accountId) });
    }
    if (rawCampaignId) {
      matchOrConditions.push({ 'routingRules.googleCampaignIds': String(rawCampaignId) });
    }

    // Rule C: Website Form key / Sheet matches
    if (connectionId) {
      matchOrConditions.push({ 'routingRules.websiteFormKeys': String(connectionId) });
      matchOrConditions.push({ 'routingRules.sheetIds': String(connectionId) });
    }

    // Rule D: UTM Campaign / Named Campaign matches
    if (utmCampaign) {
      matchOrConditions.push({ 'routingRules.utmCampaigns': utmCampaign.toLowerCase().trim() });
    }
    if (rawCampaignName) {
      matchOrConditions.push({ name: new RegExp(`^${rawCampaignName.trim()}$`, 'i') });
      matchOrConditions.push({ displayName: new RegExp(`^${rawCampaignName.trim()}$`, 'i') });
      matchOrConditions.push({ campaignName: new RegExp(`^${rawCampaignName.trim()}$`, 'i') });
    }
    if (rawCampaignId) {
      matchOrConditions.push({ externalCampaignId: String(rawCampaignId) });
      matchOrConditions.push({ campaignId: String(rawCampaignId) });
    }

    let campaignRecord = null;
    let activeSubscription = null;

    // 4a. Check for dedicated LeadSourceSubscription (Multi-Form to Campaign Group mapping)
    try {
      const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
      const subOr = [];
      if (formId) subOr.push({ externalFormId: String(formId).trim() });
      if (accountId) subOr.push({ externalAccountId: String(accountId).trim() });
      if (connectionId) subOr.push({ externalFormId: String(connectionId).trim() });

      if (subOr.length > 0) {
        activeSubscription = await LeadSourceSubscription.findOne({
          ...campaignTenantFilter,
          provider: platform,
          status: 'active',
          $or: subOr,
        }).populate({
          path: 'campaignGroupId',
          populate: {
            path: 'assignmentRule.specificCounselorId assignmentRule.counselorPool.userId assignmentRule.fallbackUserId',
          },
        });

        if (activeSubscription && activeSubscription.campaignGroupId) {
          campaignRecord = activeSubscription.campaignGroupId;
          // Asynchronously update subscription health and metrics
          LeadSourceSubscription.updateOne(
            { _id: activeSubscription._id },
            {
              $inc: { totalLeadsCount: 1 },
              $set: { lastLeadAt: new Date(), healthStatus: 'healthy', lastError: '' },
            }
          ).catch((e) => console.warn('[LeadIngestion] Subscription metrics update warning:', e.message));
        }
      }
    } catch (subErr) {
      console.warn('[LeadIngestion] LeadSourceSubscription lookup notice:', subErr.message);
    }

    // 4b. Fallback to Campaign routingRules if no explicit LeadSourceSubscription matched
    if (!campaignRecord && matchOrConditions.length > 0) {
      campaignRecord = await Campaign.findOne({
        $and: [
          campaignTenantFilter,
          { status: { $in: ['active', 'ACTIVE', 'running', 'queued'] } },
          { $or: matchOrConditions },
        ],
      }).populate('assignmentRule.specificCounselorId assignmentRule.counselorPool.userId assignmentRule.fallbackUserId');
    }

    const resolvedCampaignId = String(
      rawCampaignId ||
      campaignRecord?.externalCampaignId ||
      (normalizedCampaignName ? `cmp_${slugify(normalizedCampaignName)}` : 'default_campaign')
    );

    // If no explicit configured campaign matched, fallback to registry or auto-provision
    if (!campaignRecord) {
      campaignRecord = await Campaign.findOne({
        ...tenantQuery,
        platform,
        connectionId: String(connectionId),
        externalCampaignId: String(resolvedCampaignId),
      }).populate('assignmentRule.specificCounselorId assignmentRule.counselorPool.userId assignmentRule.fallbackUserId');

      if (!campaignRecord) {
        campaignRecord = await Campaign.create({
          companyId,
          userId,
          platform,
          connectionId: String(connectionId),
          connectionName,
          integrationId: integration._id,
          externalCampaignId: String(resolvedCampaignId),
          campaignName: normalizedCampaignName,
          name: normalizedCampaignName,
          displayName: normalizedCampaignName,
          assignmentRule: integration.assignmentRule || { type: 'round_robin' },
          fieldMapping: integration.fieldMapping || [],
          leadCount: 0,
          leadsGenerated: 0,
          status: 'active',
          lastLeadAt: createdAt ? new Date(createdAt) : new Date(),
        });
      }
    }

    const resolvedCampaignName = campaignRecord.displayName || campaignRecord.name || campaignRecord.campaignName || normalizedCampaignName;

    // 5. Authoritative Campaign-Determined Lead Assignment
    // Check if subscription defines a custom assignment rule or inherits from target campaign
    const effectiveAssignmentRule = (activeSubscription?.assignmentRule?.type && activeSubscription.assignmentRule.type !== 'inherit_campaign')
      ? activeSubscription.assignmentRule
      : (campaignRecord.assignmentRule || integration.assignmentRule || { type: 'round_robin' });

    const effectiveFieldMapping = (activeSubscription?.fieldMapping?.length)
      ? activeSubscription.fieldMapping
      : (campaignRecord.fieldMapping?.length ? campaignRecord.fieldMapping : (integration.fieldMapping || []));

    const campaignOverride = {
      campaignId: campaignRecord._id,
      assignmentRule: effectiveAssignmentRule,
      fieldMapping: effectiveFieldMapping,
    };
    const scopeKey = String(campaignRecord._id || resolvedCampaignId);

    // 6. Apply Field Mapping
    const mappedLead = this.applyFieldMapping({
      name,
      phone,
      email,
      customData,
      rawAnswers,
      integration,
      campaignOverride,
    });

    // 7. Normalization
    const cleanedName = this.cleanString(mappedLead.name);
    const normalizedPhone = this.formatPhone(mappedLead.phone);
    const normalizedEmail = this.normalizeEmail(mappedLead.email);

    // Requirement J.3: Leads with missing phone & email are saved with "needs_review", never dropped
    const hasContact = Boolean(normalizedPhone || normalizedEmail);
    const initialStatus = hasContact ? 'new_lead' : 'needs_review';

    // 8. Idempotency Check (A): Existing Lead by External Lead ID
    let existingLead = await Lead.findOne({
      ...tenantQuery,
      $or: [
        { 'leadSource.platform': platform, 'leadSource.externalLeadId': String(externalLeadId) },
        { 'leadSource.provider': platform, 'leadSource.externalLeadId': String(externalLeadId) },
      ],
    });

    if (existingLead) {
      let updated = false;
      if (formName && !existingLead.leadSource.formName) {
        existingLead.leadSource.formName = formName;
        updated = true;
      }
      if (resolvedCampaignName && !existingLead.leadSource.campaignName) {
        existingLead.leadSource.campaignName = resolvedCampaignName;
        updated = true;
      }
      if (adSetName && !existingLead.leadSource.adSetName) {
        existingLead.leadSource.adSetName = adSetName;
        updated = true;
      }
      if (adGroupName && !existingLead.leadSource.adGroupName) {
        existingLead.leadSource.adGroupName = adGroupName;
        updated = true;
      }
      if (adName && !existingLead.leadSource.adName) {
        existingLead.leadSource.adName = adName;
        updated = true;
      }

      if (updated) {
        await existingLead.save();
      }

      return {
        created: false,
        duplicate: true,
        reason: 'duplicate_external_lead_id',
        lead: existingLead,
      };
    }

    // 9. Deduplication Check (B): Existing Contact by Phone Number
    if (normalizedPhone) {
      const digitsOnly = String(mappedLead.phone || '').replace(/\D/g, '');
      const tenDigit = digitsOnly.slice(-10);
      const phoneCandidates = [
        normalizedPhone,
        digitsOnly,
        tenDigit,
        `91${tenDigit}`,
        `+91${tenDigit}`,
        `+${digitsOnly}`,
      ].filter(Boolean);

      const existingPhoneLead = await Lead.findOne({
        ...tenantQuery,
        phone: { $in: phoneCandidates },
      });

      if (existingPhoneLead) {
        const policy = integration.duplicatePolicy || 'create_inquiry';

        // Policy: SKIP
        if (policy === 'skip') {
          return {
            created: false,
            duplicate: true,
            reason: 'duplicate_phone_skipped',
            lead: existingPhoneLead,
          };
        }

        // Policy: MERGE ACTIVITY
        if (policy === 'merge_activity') {
          existingPhoneLead.leadActivities.push({
            action: 'message_received',
            performerName: `${platform.toUpperCase()} Ingestion`,
            details: `Repeat inquiry submitted from Campaign: "${resolvedCampaignName}" (Form: "${formName || 'Lead Form'}")`,
            timestamp: new Date(),
          });
          if (resolvedCampaignName) existingPhoneLead.leadSource.campaignName = resolvedCampaignName;
          if (formName) existingPhoneLead.leadSource.formName = formName;
          await existingPhoneLead.save();

          return {
            created: false,
            duplicate: true,
            reason: 'duplicate_phone_merged',
            lead: existingPhoneLead,
          };
        }

        // Policy: CREATE INQUIRY (Default)
        const assignment = await assignmentService.resolveAssignment({
          integration,
          campaignOverride,
          scopeKey,
          isTest,
        });

        const newInquiry = {
          inquiryId: new mongoose.Types.ObjectId().toString(),
          source: platform,
          platform,
          connectionId: String(connectionId),
          externalLeadId: String(externalLeadId),
          integrationId: integration._id,
          formId: formId ? String(formId) : '',
          formName: formName || '',
          campaignId: String(campaignRecord._id),
          campaignName: resolvedCampaignName,
          course: mappedLead.course || '',
          city: mappedLead.city || '',
          customQuestions: mappedLead.customData || {},
          assignmentReason: assignment.assignmentReason,
          assignedTo: assignment.assignedTo,
          status: 'new_inquiry',
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        };

        const updateOps = {
          $push: {
            inquiries: {
              $each: [newInquiry],
              $slice: -50,
            },
            leadActivities: {
              action: 'webhook_ingested',
              performerName: `${platform.toUpperCase()} Ingestion`,
              details: `New Inquiry attached from ${platform.toUpperCase()} [${connectionName}] - Campaign "${resolvedCampaignName}" [${assignment.assignmentReason}]`,
              timestamp: new Date(),
            },
          },
          $set: {
            updatedAt: new Date(),
          },
        };

        if (integration.reInquiryAssignmentPolicy === 'reassign_by_rule' && assignment.assignedTo) {
          updateOps.$set.assignedTo = assignment.assignedTo;
          updateOps.$set.assignedToName = assignment.assignedToName;
          updateOps.$set.assignmentReason = assignment.assignmentReason;
        }

        await Lead.updateOne(
          {
            _id: existingPhoneLead._id,
            'inquiries.externalLeadId': { $ne: String(externalLeadId) },
          },
          updateOps
        );

        await Campaign.updateOne(
          { _id: campaignRecord._id },
          {
            $inc: { leadCount: 1, leadsGenerated: 1 },
            $set: { lastLeadAt: createdAt ? new Date(createdAt) : new Date() },
          }
        ).catch(() => null);

        const refreshedLead = await Lead.findById(existingPhoneLead._id);

        return {
          created: false,
          duplicate: false,
          inquiryAdded: true,
          lead: refreshedLead,
        };
      }
    }

    // 10. Atomic Assignment for New Lead
    const assignment = await assignmentService.resolveAssignment({
      integration,
      campaignOverride,
      scopeKey,
      isTest,
    });

    // 11. Create Brand New Lead Document with Normalized Source Hierarchy
    const lead = new Lead({
      userId,
      companyId,
      campaignId: campaignRecord._id,
      campaignName: resolvedCampaignName,
      assignedTo: assignment.assignedTo,
      assignedToName: assignment.assignedToName,
      assignmentReason: assignment.assignmentReason,
      isTestLead: Boolean(isTest),

      name: cleanedName || (hasContact ? 'Inbound Lead' : 'Unidentified Contact (Needs Review)'),
      phone: normalizedPhone || '',
      email: normalizedEmail || '',

      status: initialStatus,
      source: platform,
      primarySource: platform === 'website' ? 'WEBHOOK' : 'ADS',

      tags: [
        `${platform.toUpperCase()} Lead`,
        connectionName ? `Source: ${connectionName}` : null,
        resolvedCampaignName ? `Campaign: ${resolvedCampaignName}` : null,
        isTest ? 'TEST LEAD' : null,
        !hasContact ? 'Needs Review' : null,
      ].filter(Boolean),

      customData: mappedLead.customData || {},

      leadSource: {
        provider: platform,
        platform,
        connectionId: String(connectionId),
        connectionName,
        externalLeadId: String(externalLeadId),
        integrationId: integration._id,
        accountId: accountId ? String(accountId) : null,
        pageId: pageId ? String(pageId) : null,
        formId: formId ? String(formId) : null,
        formName: formName || '',
        campaignId: String(resolvedCampaignId || campaignRecord.externalCampaignId || campaignRecord._id),
        internalCampaignId: String(campaignRecord._id),
        campaignName: resolvedCampaignName,
        adSetId: adSetId ? String(adSetId) : null,
        adSetName: adSetName || '',
        adGroupId: adGroupId ? String(adGroupId) : null,
        adGroupName: adGroupName || '',
        adId: adId ? String(adId) : null,
        adName: adName || '',
        assignmentReason: assignment.assignmentReason,
        importedAt: createdAt ? new Date(createdAt) : new Date(),
      },

      utmSource: utmSource || platform,
      utmMedium: utmMedium || 'cpc',
      utmCampaign: utmCampaign || resolvedCampaignName || '',

      followUpDate: this.defaultFollowUpDate(),

      inquiries: [
        {
          inquiryId: new mongoose.Types.ObjectId().toString(),
          source: platform,
          platform,
          connectionId: String(connectionId),
          externalLeadId: String(externalLeadId),
          integrationId: integration._id,
          formId: formId ? String(formId) : '',
          formName: formName || '',
          campaignId: String(campaignRecord._id),
          campaignName: resolvedCampaignName,
          course: mappedLead.course || '',
          city: mappedLead.city || '',
          customQuestions: mappedLead.customData || {},
          assignmentReason: assignment.assignmentReason,
          assignedTo: assignment.assignedTo,
          status: 'new_inquiry',
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        },
      ],

      leadActivities: [
        {
          action: 'lead_created',
          performerName: `${platform.toUpperCase()} Ingestion`,
          details: `Lead captured via ${platform.toUpperCase()} [${connectionName}] - Campaign "${resolvedCampaignName}" [${assignment.assignmentReason}]`,
          timestamp: new Date(),
        },
      ],
    });

    // 12. Concurrency-Safe Save with E11000 Catch
    try {
      await lead.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        const raceDuplicate = await Lead.findOne({
          ...tenantQuery,
          $or: [
            { 'leadSource.platform': platform, 'leadSource.externalLeadId': String(externalLeadId) },
            ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ],
        });

        if (raceDuplicate) {
          return {
            created: false,
            duplicate: true,
            reason: 'concurrency_race_resolved',
            lead: raceDuplicate,
          };
        }
      }
      throw saveError;
    }

    // Increment Campaign Lead Volume & Last Activity
    await Campaign.updateOne(
      { _id: campaignRecord._id },
      {
        $inc: { leadCount: 1, leadsGenerated: 1 },
        $set: { lastLeadAt: createdAt ? new Date(createdAt) : new Date() },
      }
    ).catch(() => null);

    // Emit CRM Event for automated WhatsApp/Email welcomes & triggers
    emitCRMEvent(CRM_EVENTS.LEAD_CREATED, {
      lead,
      user: null,
      source: platform,
    });

    return {
      created: true,
      duplicate: false,
      lead,
    };
  }

  /**
   * Field Mapping Engine
   * Maps incoming raw answers or key-value fields to canonical CRM fields
   */
  applyFieldMapping({ name, phone, email, customData = {}, rawAnswers = [], integration, campaignOverride }) {
    const mappingRules = campaignOverride?.fieldMapping?.length
      ? campaignOverride.fieldMapping
      : integration.fieldMapping || [];

    const result = {
      name: name || '',
      phone: phone || '',
      email: email || '',
      course: '',
      city: '',
      customData: { ...customData },
    };

    if (mappingRules.length > 0) {
      for (const rule of mappingRules) {
        const sourceVal = customData[rule.sourceField] || customData[rule.sourceField.toLowerCase()];
        if (sourceVal !== undefined && sourceVal !== null && sourceVal !== '') {
          if (rule.crmField === 'name' && !result.name) result.name = String(sourceVal);
          else if (rule.crmField === 'phone' && !result.phone) result.phone = String(sourceVal);
          else if (rule.crmField === 'email' && !result.email) result.email = String(sourceVal);
          else if (rule.crmField === 'course') result.course = String(sourceVal);
          else if (rule.crmField === 'city') result.city = String(sourceVal);
          else {
            result.customData[rule.displayLabel || rule.sourceField] = sourceVal;
          }
        }
      }
    }

    for (const ans of rawAnswers) {
      const q = ans.question || ans.name || ans.key || '';
      const v = ans.answer || ans.value || ans.values?.[0] || '';
      if (q && v) {
        const lowerQ = q.toLowerCase();
        if (!result.name && (lowerQ.includes('full name') || lowerQ === 'name')) {
          result.name = v;
        } else if (!result.phone && (lowerQ.includes('phone') || lowerQ.includes('mobile'))) {
          result.phone = v;
        } else if (!result.email && lowerQ.includes('email')) {
          result.email = v;
        } else if (!result.course && (lowerQ.includes('course') || lowerQ.includes('degree') || lowerQ.includes('program'))) {
          result.course = v;
        } else if (!result.city && (lowerQ.includes('city') || lowerQ.includes('location'))) {
          result.city = v;
        } else {
          result.customData[q] = v;
        }
      }
    }

    return result;
  }

  resolveCampaignOverride(integration, campaignRecord, campaignId, formId) {
    if (campaignRecord && campaignRecord.assignmentRule?.type) {
      return {
        campaignId: campaignRecord.externalCampaignId,
        assignmentRule: campaignRecord.assignmentRule,
        fieldMapping: campaignRecord.fieldMapping || [],
      };
    }

    if (!Array.isArray(integration.campaignOverrides) || integration.campaignOverrides.length === 0) {
      return null;
    }
    if (campaignId) {
      const match = integration.campaignOverrides.find((o) => String(o.campaignId) === String(campaignId));
      if (match) return match;
    }
    if (formId) {
      const match = integration.campaignOverrides.find((o) => String(o.formId) === String(formId));
      if (match) return match;
    }
    return null;
  }

  formatPhone(phone) {
    if (!phone) return '';
    const digitsOnly = String(phone).replace(/\D/g, '');
    return digitsOnly;
  }

  normalizeEmail(email) {
    if (!email) return '';
    const cleaned = String(email).trim().toLowerCase();
    return cleaned.includes('@') ? cleaned : '';
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