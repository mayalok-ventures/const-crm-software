const crypto = require('crypto');
const Integration = require('../../models/Integration');
const Campaign = require('../../models/Campaign');
const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
const googleSheetsService = require('../../services/integrations/googleSheetsService');
const googleSheetsPollingService = require('../../services/integrations/googleSheetsPollingService');
const { getStandardLeadFields, getTemplateHeaderDefinitions, matchHeaderToCrmField } = require('../../services/integrations/leadFieldsRegistry');

/**
 * Google Sheets Integration Controller
 * Supports the 3 setup flows:
 * 1. Connect existing sheet (Google Sign-In + Google Picker with drive.file scope)
 * 2. Create new sheet inside CRM (Real Lead schema fields + dropdown validations + styling)
 * 3. Paste link (Service account sharing / Public link / Picker fallback)
 * Plus Mode A (Apps Script push) and Mode B (API polling).
 */

/**
 * GET /api/integrations/sheets/config
 * Returns client-safe Google Cloud credentials and standard lead field definitions
 */
exports.getConfig = async (req, res) => {
  try {
    let serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null;
    let hasServiceAccount = Boolean(serviceAccountEmail && (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY));

    // Try parsing from GOOGLE_SERVICE_ACCOUNT_KEY JSON if present
    if (!serviceAccountEmail && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        if (parsed.client_email) {
          serviceAccountEmail = parsed.client_email;
          hasServiceAccount = true;
        }
      } catch {}
    }

    // Default fallback service account email for display in dev/testing
    if (!serviceAccountEmail) {
      serviceAccountEmail = 'crm-sheets-sync@crm-project-2026.iam.gserviceaccount.com';
    }

    return res.json({
      success: true,
      googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null,
      googleApiKey: process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || null,
      googleAppId: process.env.GOOGLE_APP_ID || process.env.NEXT_PUBLIC_GOOGLE_APP_ID || null,
      serviceAccountEmail,
      hasServiceAccount,
      recommendedScope: 'https://www.googleapis.com/auth/drive.file',
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      standardLeadFields: getStandardLeadFields(),
      templateHeaders: getTemplateHeaderDefinitions(),
    });
  } catch (error) {
    console.error('[Sheets Config Error]:', error.message);
    return res.status(500).json({ error: 'Failed to load Google Sheets configuration' });
  }
};

/**
 * POST /api/integrations/sheets/inspect
 * Extracts spreadsheetId from URL/ID and inspects tabs, headers, and permissions
 */
exports.inspectSheet = async (req, res) => {
  try {
    const {
      urlOrId,
      accessToken,
      useServiceAccount = true,
      tabName,
      headerRowIndex = 1,
      mockDriver,
    } = req.body;

    if (!urlOrId || typeof urlOrId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid Google Sheet URL or Spreadsheet ID',
      });
    }

    const spreadsheetId = googleSheetsService.extractSpreadsheetId(urlOrId);
    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract Spreadsheet ID. Please verify the URL format.',
      });
    }

    // 1. Inspect Spreadsheet Metadata & Tabs
    const metaResult = await googleSheetsService.inspectSpreadsheet({
      spreadsheetId,
      accessToken,
      useServiceAccount,
      apiKey: process.env.GOOGLE_API_KEY,
      mockDriver,
    });

    if (!metaResult.success) {
      return res.status(metaResult.status === 403 || metaResult.status === 404 ? 403 : 400).json({
        success: false,
        spreadsheetId,
        error: metaResult.error || 'Access denied or spreadsheet not found',
        needsShareWithServiceAccount: metaResult.needsShareWithServiceAccount,
        serviceAccountEmail: metaResult.serviceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      });
    }

    // Default to the first sheet tab if none specified
    const selectedTab = tabName || (metaResult.sheets?.[0]?.title) || 'Sheet1';

    // 2. Read Headers and Sample Rows
    const dataResult = await googleSheetsService.readSheetData({
      spreadsheetId,
      tabName: selectedTab,
      headerRowIndex: Number(headerRowIndex) || 1,
      maxRows: 5,
      accessToken,
      useServiceAccount,
      apiKey: process.env.GOOGLE_API_KEY,
      mockDriver,
    });

    return res.json({
      success: true,
      spreadsheetId,
      title: metaResult.title || 'Google Sheet',
      sheets: metaResult.sheets || [],
      selectedTab,
      headerRowIndex: Number(headerRowIndex) || 1,
      accessMethod: metaResult.accessMethod,
      hasWriteAccess: metaResult.hasWriteAccess,
      isPublic: Boolean(metaResult.isPublic || metaResult.isPublicFallback || metaResult.accessMethod === 'public_csv'),
      isPublicFallback: Boolean(metaResult.isPublicFallback),
      hasDataRows: (dataResult.totalRowsDetected || 0) > 0,
      isEmpty: Boolean(dataResult.isEmpty),
      headers: dataResult.headers || [],
      sampleRows: dataResult.sampleRows || [],
      suggestedMappings: dataResult.suggestedMappings || [],
      totalRowsDetected: dataResult.totalRowsDetected || 0,
    });
  } catch (error) {
    console.error('[Sheets Inspect Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to inspect Google Sheet',
    });
  }
};

/**
 * POST /api/integrations/sheets/create-sheet
 * Option 2: Programmatically creates formatted spreadsheet in user's Drive with CRM lead fields & validations
 */
exports.createSheet = async (req, res) => {
  try {
    const { title = 'CRM Lead Capture Sheet', accessToken, defaultCampaignLabel } = req.body;

    const result = await googleSheetsService.createSpreadsheetInDrive({
      title,
      accessToken,
    });

    return res.json({
      success: true,
      ...result,
      defaultCampaignLabel: defaultCampaignLabel || title,
    });
  } catch (error) {
    console.error('[Sheets Create Sheet Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to create spreadsheet in Google Drive',
    });
  }
};

/**
 * POST /api/integrations/sheets/apply-template
 * Writes standard CRM template headers and formatting to an empty sheet
 */
exports.applyTemplate = async (req, res) => {
  try {
    const { spreadsheetId, tabName = 'Sheet1', accessToken, useServiceAccount } = req.body;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'spreadsheetId is required' });
    }

    const result = await googleSheetsService.applyTemplateHeaders({
      spreadsheetId,
      tabName,
      accessToken,
      useServiceAccount,
    });

    return res.json({
      success: true,
      headers: result.headers,
      suggestedMappings: result.headers.map((h, idx) => ({
        sourceField: h,
        columnIndex: idx,
        crmField: matchHeaderToCrmField(h).crmField,
        displayLabel: h,
        isCustom: matchHeaderToCrmField(h).isCustom,
        isSystem: matchHeaderToCrmField(h).isSystem,
      })),
    });
  } catch (error) {
    console.error('[Sheets Apply Template Error]:', error.message);
    return res.status(500).json({ error: 'Failed to apply template headers to Google Sheet' });
  }
};

/**
 * POST /api/integrations/sheets/connect
 * Saves or updates Google Sheet integration in CRM and initializes sync
 */
exports.connectSheet = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      sheetName,
      spreadsheetId,
      spreadsheetUrl,
      tabName = 'Sheet1',
      headerRowIndex = 1,
      syncMode = 'polling',
      accessMethod = 'public_csv',
      hasWriteAccess = false,
      importExistingRows = true,
      campaignId,
      campaignName,
      fieldMapping = [],
      accessToken,
      refreshToken,
      storedHeaders = [],
    } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID is required' });
    }

    if (!campaignId) {
      return res.status(400).json({
        error: 'A destination campaign is required. Please select or create a Campaign to capture leads from this sheet.',
      });
    }

    // Verify Campaign exists
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(400).json({ error: 'Selected Campaign not found. Please choose an active campaign.' });
    }

    const finalSheetName = (sheetName || campaign.name || 'Google Sheet Leads').trim();

    // Validation: Phone OR Email must be mapped
    const hasPhoneOrEmail = fieldMapping.some(
      (m) => (m.crmField === 'phone' || m.crmField === 'email') && !m.isCustom
    );
    if (!hasPhoneOrEmail) {
      return res.status(400).json({
        error: 'Phone Number OR Email Address must be mapped to a CRM field',
      });
    }

    const companyId =
      req.user.companyId ||
      (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);

    // Initial status: awaiting_data (only upgraded to connected once data rows actually sync)
    const updateData = {
      userId: req.user._id,
      companyId: companyId || null,
      provider: 'sheets',
      mode: 'client_managed',
      status: 'awaiting_data',
      accountId: spreadsheetId,
      accountName: finalSheetName,
      sheetsConfig: {
        spreadsheetId,
        sheetId: spreadsheetId,
        spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        tabName,
        sheetName: tabName,
        headerRowIndex: Number(headerRowIndex) || 1,
        syncMode: 'polling',
        pollIntervalMinutes: 5,
        accessMethod,
        hasWriteAccess: Boolean(hasWriteAccess),
        importExistingRows: Boolean(importExistingRows !== false),
        cutoffRowIndex: 0,
        lastSyncedRowIndex: 0,
        totalRowsSynced: 0,
        totalNeedsReview: 0,
        totalFailed: 0,
        needsRemapping: false,
        storedHeaders: storedHeaders.length > 0 ? storedHeaders : fieldMapping.map((m) => m.sourceField),
        targetCampaignId: campaignId,
      },
      fieldMapping: fieldMapping.map((m) => ({
        sourceField: m.sourceField,
        crmField: m.crmField,
        isCustom: Boolean(m.isCustom || m.crmField === 'custom'),
        displayLabel: m.displayLabel || m.sourceField,
        showOnProfile: true,
      })),
      metadata: {
        targetCampaignId: campaignId,
        targetCampaignName: campaign.name,
        defaultCampaignLabel: campaign.name,
        importExistingRows: Boolean(importExistingRows !== false),
        connectionFlow: accessMethod,
      },
      lastError: '',
      connectedAt: new Date(),
    };

    if (accessToken) {
      updateData.accessToken = accessToken;
    }
    if (refreshToken) {
      updateData.refreshToken = refreshToken;
      updateData.tokenExpiresAt = new Date(Date.now() + 3600 * 1000);
    }

    const integration = await Integration.findOneAndUpdate(
      companyId
        ? { companyId, provider: 'sheets', accountId: spreadsheetId }
        : { userId: req.user._id, provider: 'sheets', accountId: spreadsheetId },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Link destination campaign routing rules
    await Campaign.updateOne(
      { _id: campaignId },
      { $addToSet: { 'routingRules.sheetIds': String(spreadsheetId) } }
    );

    // Link subscription routing
    await LeadSourceSubscription.findOneAndUpdate(
      {
        companyId: companyId || null,
        integrationId: integration._id,
        externalFormId: String(spreadsheetId),

      },
      {
        $set: {
          userId: req.user._id,
          companyId: companyId || null,
          integrationId: integration._id,
          provider: 'sheets',
          sourceName: `Google Sheets - ${finalSheetName}`,
          externalAccountId: String(spreadsheetId),
          externalAccountName: finalSheetName,
          externalFormId: String(spreadsheetId),
          externalFormName: tabName || 'Sheet1',
          isActive: true,
          campaignGroupId: campaignId,
          metadata: {
            spreadsheetId,
            tabName,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Trigger initial polling sweep
    let initialSyncResult = null;
    try {
      initialSyncResult = await googleSheetsPollingService.syncIntegration(integration._id);
    } catch (pollErr) {
      console.warn('[Initial Sheets Sync Warning]:', pollErr.message);
    }

    // Crucial Status Rule: Only show as 'connected' once data has actually synced
    if (initialSyncResult && initialSyncResult.rowsSynced > 0) {
      integration.status = 'connected';
      await integration.save();
    }

    return res.json({
      success: true,
      status: integration.status,
      rowsSynced: initialSyncResult?.rowsSynced || 0,
      integration,
      message: integration.status === 'connected'
        ? `Google Sheet connected! Synced ${initialSyncResult.rowsSynced} leads into campaign "${campaign.name}".`
        : 'Google Sheet linked! Status is "Awaiting Data" - add rows to your Google Sheet and click "Sync Now" to complete connection.',
    });
  } catch (error) {
    console.error('[Sheets Connect Error]:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to connect Google Sheet' });
  }
};

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
 * POST /api/integrations/sheets/sync/:id
 * On-demand manual trigger for Google Sheets sync
 */
exports.syncNow = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getTenantFilter(req.user);
    const integration = await Integration.findOne({ _id: id, ...filter });
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found or unauthorized' });
    }

    const result = await googleSheetsPollingService.syncIntegration(id);
    const updated = await Integration.findById(id);

    return res.json({
      success: true,
      result,
      status: updated?.status || integration.status,
      rowsSynced: result?.rowsSynced || 0,
      totalRowsSynced: updated?.sheetsConfig?.totalRowsSynced || 0,
      message: result?.rowsSynced > 0
        ? `Successfully synced ${result.rowsSynced} new lead(s)!`
        : (updated?.status === 'connected'
            ? 'Sync complete. No new leads found.'
            : 'No leads found in sheet yet. Please add a candidate row to your Google Sheet and click Sync Now.'),
    });
  } catch (error) {
    console.error('[Sheets SyncNow Error]:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to sync Google Sheet' });
  }
};
