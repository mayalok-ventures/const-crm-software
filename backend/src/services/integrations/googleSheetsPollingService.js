const crypto = require('crypto');
const Integration = require('../../models/Integration');
const Lead = require('../../models/Lead');
const googleSheetsService = require('./googleSheetsService');
const leadIngestionService = require('./leadIngestionService');
const { normalizePhone } = require('../../utils/phoneNormalizer');

/**
 * Google Sheets API Polling Service (Mode B)
 *
 * Runs scheduled or on-demand background sweeps of connected Google Sheets.
 * Features:
 * - Zero script installation needed for users
 * - Full dedupe / idempotency (never creates duplicate leads on edits, re-sorts or retries)
 * - Two-way row markers when write access exists (CRM_LEAD_ID, CRM_STATUS)
 * - Stable row fingerprinting for read-only / public sheets
 * - Header drift detection (halts and alerts with 'needs_remapping' if columns are altered)
 * - Rate limit backoff and quota respect
 */
class GoogleSheetsPollingService {
  /**
   * Sweeps a single connected Google Sheet integration
   */
  async syncIntegration(integrationId, options = {}) {
    const integration = await Integration.findById(integrationId)
      .select('+accessTokenEncrypted +refreshTokenEncrypted +sheetsSecretHash');

    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    if (integration.status !== 'connected' && integration.status !== 'needs_remapping') {
      return { skipped: true, reason: `Integration is not active (status: ${integration.status})` };
    }

    const sheetsConfig = integration.sheetsConfig || {};
    const spreadsheetId = sheetsConfig.spreadsheetId || sheetsConfig.sheetId || integration.accountId;
    const tabName = sheetsConfig.tabName || sheetsConfig.sheetName || 'Sheet1';
    const headerRowIndex = sheetsConfig.headerRowIndex || 1;
    const hasWriteAccess = sheetsConfig.hasWriteAccess !== false;

    if (!spreadsheetId) {
      return { skipped: true, reason: 'No spreadsheet ID configured' };
    }

    // 1. Resolve Access Token
    let accessToken = null;
    if (integration.accessTokenEncrypted) {
      accessToken = integration.accessToken; // Decrypted via virtual
      // If token is expired, refresh it
      if (integration.tokenExpiresAt && new Date(integration.tokenExpiresAt).getTime() < Date.now() + 60000) {
        if (integration.refreshTokenEncrypted) {
          const refreshToken = integration.refreshToken;
          const refreshed = await googleSheetsService.refreshUserOAuthToken(refreshToken);
          if (refreshed) {
            integration.accessToken = refreshed.accessToken;
            integration.tokenExpiresAt = refreshed.expiresAt;
            await integration.save();
            accessToken = refreshed.accessToken;
          } else {
            integration.status = 'needs_reconnect';
            integration.lastError = 'OAuth refresh token expired or revoked. Please reconnect your Google account.';
            await integration.save();
            return { failed: true, reason: integration.lastError };
          }
        }
      }
    }

    const useServiceAccount = sheetsConfig.accessMethod === 'service_account';

    // 2. Read Current Headers and Rows
    const readResult = await googleSheetsService.readSheetData({
      spreadsheetId,
      tabName,
      headerRowIndex,
      maxRows: 500, // Batch limit per poll cycle
      accessToken,
      useServiceAccount,
      mockDriver: options.mockDriver || null,
    });

    if (!readResult.success) {
      integration.lastError = readResult.error || 'Failed to read spreadsheet data';
      if (readResult.status === 403 || readResult.status === 401) {
        integration.status = 'needs_reconnect';
      }
      await integration.save();
      return { failed: true, error: integration.lastError };
    }

    if (readResult.isEmpty) {
      return { success: true, rowsSynced: 0, message: 'Sheet is empty or has no data rows' };
    }

    const currentHeaders = readResult.headers || [];

    // 3. Header Drift Protection: Check if stored headers have changed
    const storedHeaders = sheetsConfig.storedHeaders || [];
    if (storedHeaders.length > 0) {
      const headerMismatch = storedHeaders.some((sh, idx) => currentHeaders[idx] !== sh);
      if (headerMismatch) {
        console.warn(`[Sheets Polling Drift]: Headers changed in sheet ${spreadsheetId}`);
        integration.status = 'needs_remapping';
        integration.lastError = 'Columns in Google Sheet have been renamed, reordered, or deleted. Please re-map your columns to resume syncing.';
        await integration.save();
        return {
          status: 'needs_remapping',
          error: integration.lastError,
          currentHeaders,
          storedHeaders,
        };
      }
    }

    // 4. Resolve Column Indexes for Tracking Markers & CRM Fields
    const fieldMapping = integration.fieldMapping || [];
    const idColIndex = currentHeaders.findIndex((h) => h.toUpperCase() === 'CRM_LEAD_ID');
    const statusColIndex = currentHeaders.findIndex((h) => h.toUpperCase() === 'CRM_STATUS');

    let rowsSyncedCount = 0;
    let needsReviewCount = 0;
    let failedCount = 0;
    const markerUpdates = [];
    const seenFingerprints = new Set(sheetsConfig.syncedFingerprints || []);

    const sampleRows = readResult.sampleRows || [];
    const startRow = sheetsConfig.importExistingRows ? 0 : (sheetsConfig.cutoffRowIndex || 0);

    // Process rows
    for (let r = startRow; r < sampleRows.length; r++) {
      const row = sampleRows[r];
      const actualRowIndex = headerRowIndex + 1 + r;

      // Extract tracking marker values if columns exist
      const existingLeadId = idColIndex !== -1 ? row['CRM_LEAD_ID'] : null;
      const existingStatus = statusColIndex !== -1 ? row['CRM_STATUS'] : null;

      // Skip rows already marked as SYNCED
      if (existingStatus === 'SYNCED') {
        continue;
      }

      // Check if row is completely empty
      const hasAnyValue = Object.entries(row).some(
        ([k, v]) => k !== 'CRM_LEAD_ID' && k !== 'CRM_STATUS' && String(v || '').trim() !== ''
      );
      if (!hasAnyValue) continue;

      // Build row data mapping
      const mappedData = {};
      const customData = {};

      for (const mapItem of fieldMapping) {
        const val = row[mapItem.sourceField];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          if (mapItem.isCustom || mapItem.crmField === 'custom') {
            customData[mapItem.displayLabel || mapItem.sourceField] = String(val).trim();
          } else {
            mappedData[mapItem.crmField] = String(val).trim();
          }
        }
      }

      // Handle unmapped columns: never drop, store in customData
      for (const [key, val] of Object.entries(row)) {
        if (key === 'CRM_LEAD_ID' || key === 'CRM_STATUS') continue;
        const isMapped = fieldMapping.some((m) => m.sourceField === key && !m.isCustom && m.crmField !== 'custom');
        if (!isMapped && val !== undefined && String(val).trim() !== '') {
          customData[key] = String(val).trim();
        }
      }

      const phone = mappedData.phone || '';
      const email = mappedData.email || '';
      const name = mappedData.name || customData['Full Name'] || customData['Student Name'] || '';

      // Generate stable deterministic fingerprint
      const fingerprint = crypto
        .createHash('sha256')
        .update(`${actualRowIndex}|${phone}|${email}|${name}`)
        .digest('hex');

      // Idempotency check for read-only sheets without write markers
      if (!hasWriteAccess && seenFingerprints.has(fingerprint)) {
        continue;
      }

      // Generate or retrieve persistent externalLeadId
      const externalLeadId = existingLeadId || `sheet_${spreadsheetId}_row_${actualRowIndex}`;

      // Deduplication check in Database (by externalLeadId, or phone/email within tenant)
      const tenantQuery = integration.companyId
        ? { companyId: integration.companyId }
        : { userId: integration.userId };

      const existingLeadDoc = await Lead.findOne({
        ...tenantQuery,
        $or: [
          { 'leadSource.externalLeadId': externalLeadId },
          ...(phone ? [{ phone: normalizePhone(phone) }] : []),
          ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ],
      });

      if (existingLeadDoc) {
        // Lead already ingested: update sheet marker to SYNCED and avoid duplicate
        if (hasWriteAccess && (idColIndex !== -1 || statusColIndex !== -1)) {
          markerUpdates.push({
            rowIndex: actualRowIndex,
            idColIndex,
            statusColIndex,
            leadId: existingLeadDoc.leadSource?.externalLeadId || externalLeadId,
            status: 'SYNCED',
          });
        }
        seenFingerprints.add(fingerprint);
        continue;
      }

      // Validation: Phone OR Email required
      const hasContact = Boolean(phone || email);
      const rowStatus = hasContact ? 'SYNCED' : 'NEEDS_REVIEW';

      try {
        const campaignName =
          mappedData.campaign ||
          customData['Campaign'] ||
          integration.metadata?.defaultCampaignLabel ||
          integration.accountName ||
          'Google Sheets Inbound';

        await leadIngestionService.ingest({
          provider: 'sheets',
          platform: 'sheets',
          integrationId: integration._id,
          externalLeadId,
          connectionId: spreadsheetId,
          connectionName: tabName ? `${integration.accountName || 'Sheet'} (${tabName})` : integration.accountName,
          campaignName,
          name,
          phone,
          email,
          customData: {
            ...customData,
            ...(mappedData.targetCity ? { City: mappedData.targetCity } : {}),
            ...(mappedData.targetCourse ? { 'Course / Interest': mappedData.targetCourse } : {}),
            ...(mappedData.budget ? { Budget: mappedData.budget } : {}),
            ...(mappedData.notes ? { Notes: mappedData.notes } : {}),
          },
          isTest: Boolean(options.isTest),
        });

        if (hasContact) {
          rowsSyncedCount++;
        } else {
          needsReviewCount++;
        }

        seenFingerprints.add(fingerprint);

        if (hasWriteAccess && (idColIndex !== -1 || statusColIndex !== -1)) {
          markerUpdates.push({
            rowIndex: actualRowIndex,
            idColIndex,
            statusColIndex,
            leadId: externalLeadId,
            status: rowStatus,
          });
        }
      } catch (ingestErr) {
        console.error(`[Sheets Ingest Row ${actualRowIndex} Error]:`, ingestErr.message);
        failedCount++;
        if (hasWriteAccess && (idColIndex !== -1 || statusColIndex !== -1)) {
          markerUpdates.push({
            rowIndex: actualRowIndex,
            idColIndex,
            statusColIndex,
            leadId: externalLeadId,
            status: 'PENDING', // Remains pending for retry
          });
        }
      }
    }

    // 5. Batch Update Row Markers in Google Sheet (CRM_LEAD_ID and CRM_STATUS)
    if (markerUpdates.length > 0 && hasWriteAccess) {
      await googleSheetsService.batchUpdateRowMarkers({
        spreadsheetId,
        tabName,
        updates: markerUpdates,
        accessToken,
        useServiceAccount,
        mockDriver: options.mockDriver || null,
      });
    }

    // 6. Update Integration Metrics
    integration.lastSyncAt = new Date();
    integration.lastError = '';
    integration.sheetsConfig.lastSyncedAt = new Date();
    integration.sheetsConfig.totalRowsSynced = (sheetsConfig.totalRowsSynced || 0) + rowsSyncedCount;
    integration.sheetsConfig.totalNeedsReview = (sheetsConfig.totalNeedsReview || 0) + needsReviewCount;
    integration.sheetsConfig.totalFailed = (sheetsConfig.totalFailed || 0) + failedCount;
    integration.sheetsConfig.syncedFingerprints = Array.from(seenFingerprints).slice(-1000); // Cap last 1000

    await integration.save();

    return {
      success: true,
      rowsSynced: rowsSyncedCount,
      needsReviewCount,
      failedCount,
      totalProcessed: rowsSyncedCount + needsReviewCount + failedCount,
    };
  }

  /**
   * Periodic scheduler: runs every 5 minutes across all active sheets integrations
   */
  async sweepAll() {
    try {
      const activeSheetsIntegrations = await Integration.find({
        provider: 'sheets',
        status: 'connected',
        'sheetsConfig.syncMode': { $ne: 'push' }, // Mode B default
      }).limit(50);

      const results = [];
      for (const integration of activeSheetsIntegrations) {
        try {
          const res = await this.syncIntegration(integration._id);
          results.push({ id: integration._id, res });
        } catch (err) {
          console.error(`[Polling Error on ${integration._id}]:`, err.message);
        }
      }
      return results;
    } catch (err) {
      console.error('[Sheets Polling SweepAll Error]:', err.message);
    }
  }
}

module.exports = new GoogleSheetsPollingService();
