const crypto = require('crypto');
const Integration = require('../../models/Integration');
const WebhookEvent = require('../../models/WebhookEvent');
const webhookQueueService = require('../../services/integrations/webhookQueueService');
const { parseLosslessJson } = require('../../utils/losslessJson');

/**
 * Synonym Dictionary for Header Auto-Matching
 */
const SYNONYM_MAP = {
  name: ['name', 'full name', 'student name', 'candidate name', 'contact name', 'first name', 'applicant name'],
  phone: ['phone', 'mobile', 'contact', 'whatsapp', 'phone number', 'mobile number', 'contact number', 'tel', 'whatsapp number'],
  email: ['email', 'e-mail', 'email address', 'mail', 'email id'],
  city: ['city', 'location', 'town', 'address', 'target city', 'current city'],
  course: ['course', 'program', 'interest', 'course / interest', 'target course', 'degree', 'stream'],
  campaign: ['campaign', 'source', 'utm_campaign', 'ad campaign', 'marketing campaign'],
  notes: ['notes', 'remarks', 'comments', 'additional details'],
};

/**
 * Match a raw header string to canonical CRM field
 */
function matchSynonym(header) {
  const clean = String(header || '').trim().toLowerCase();
  for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (synonyms.some((syn) => clean === syn || clean.includes(syn))) {
      return { canonical, isCustom: false };
    }
  }
  return { canonical: 'custom', isCustom: true };
}

/**
 * POST /api/integrations/sheets/detect-headers
 * Detects headers from Google Sheet setup call, matches synonyms, and returns preview mapping.
 */
exports.detectHeaders = async (req, res) => {
  try {
    const { headers = [], sampleRow = [] } = req.body;
    if (!Array.isArray(headers) || headers.length === 0) {
      return res.status(400).json({ error: 'headers array is required' });
    }

    const filtered = headers
      .map((h, idx) => ({ header: String(h || '').trim(), index: idx }))
      .filter((h) => h.header && h.header !== 'CRM_LEAD_ID' && h.header !== 'CRM_STATUS');

    const mappings = filtered.map(({ header, index }) => {
      const match = matchSynonym(header);
      const sampleVal = sampleRow[index] !== undefined ? sampleRow[index] : '';
      return {
        sourceField: header,
        crmField: match.canonical,
        isCustom: match.isCustom,
        displayLabel: header,
        sampleValue: sampleVal,
      };
    });

    return res.json({
      success: true,
      detectedHeaders: filtered.map((f) => f.header),
      mappings,
    });
  } catch (error) {
    console.error('[Sheets Detect Headers Error]:', error.message);
    return res.status(500).json({ error: 'Failed to detect headers' });
  }
};

/**
 * POST /api/integrations/sheets/webhook/:integrationId
 *
 * Receiver for Google Sheets Apps Script integration.
 * Secret is passed securely via 'x-crm-secret' header and verified via constant-time compare.
 * Handles missing phone/email (saved as needs_review and marked in sheet).
 */
exports.receive = async (req, res) => {
  try {
    const { integrationId } = req.params;
    if (!integrationId) {
      return res.status(400).json({ error: 'Integration ID is required' });
    }

    const receivedSecret = (
      req.headers['x-crm-secret'] ||
      req.headers['x-sheets-secret'] ||
      req.query?.secret ||
      req.body?.secret ||
      ''
    ).trim();

    if (!receivedSecret) {
      return res.status(401).json({
        error: 'Missing webhook secret key',
        message: 'A password that proves rows come from your sheet is required in x-crm-secret header.',
      });
    }

    const integration = await Integration.findById(integrationId).select('+sheetsSecretHash');
    if (!integration || integration.provider !== 'sheets' || integration.status !== 'connected') {
      return res.status(404).json({ error: 'Active Google Sheets integration not found' });
    }

    if (!integration.sheetsSecretHash) {
      return res.status(401).json({ error: 'Sheets secret not initialized' });
    }

    // Verify Secret Hash via Constant-Time Compare
    const receivedHash = crypto.createHash('sha256').update(receivedSecret).digest('hex');
    const recvBuf = Buffer.from(receivedHash, 'hex');
    const confBuf = Buffer.from(integration.sheetsSecretHash, 'hex');

    if (recvBuf.length !== confBuf.length || !crypto.timingSafeEqual(recvBuf, confBuf)) {
      console.warn(`[Sheets Webhook] Invalid secret token received for integration ${integrationId}`);
      return res.status(401).json({
        error: 'Invalid secret token',
        message: 'Webhook key is invalid or was regenerated. Please update the SECRET in your Apps Script CRM_CONFIG.',
      });
    }

    const payload = parseLosslessJson(req.rawBody || req.body);
    const leadId = String(payload.leadId || payload.lead_id || '');

    if (!leadId) {
      return res.status(400).json({ error: 'leadId (UUID) is required from Apps Script tracking column' });
    }

    // Check if row has at least phone or email
    const rowData = payload.rowData || payload.data || {};
    const keys = Object.keys(rowData);
    const hasContact = keys.some((k) => {
      const lk = k.toLowerCase();
      const val = String(rowData[k] || '').trim();
      return (
        val &&
        (lk.includes('phone') || lk.includes('mobile') || lk.includes('contact') || lk.includes('whatsapp') || lk.includes('email'))
      );
    });

    // Enqueue event into queue
    await webhookQueueService.enqueueEvent({
      provider: 'sheets',
      integrationId: integration._id,
      companyId: integration.companyId,
      userId: integration.userId,
      externalLeadId: leadId,
      headers: req.headers,
      rawBody: payload,
    });

    // Update integration health
    await Integration.findByIdAndUpdate(integration._id, {
      $set: {
        lastSyncAt: new Date(),
        lastError: '',
      },
    });

    return res.status(200).json({
      success: true,
      status: hasContact ? 'SYNCED' : 'NEEDS_REVIEW',
      leadId,
      hasContact,
    });
  } catch (error) {
    console.error('[Sheets Webhook Error]:', error.message);
    return res.status(500).json({ error: 'Queue error' });
  }
};

/**
 * Generate comprehensive Google Apps Script for the rewritten wizard
 */
exports.getAppsScriptCode = (integration, plainSecret = null) => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const webhookUrl = `${backendUrl}/api/integrations/sheets/webhook/${integration._id}`;
  const detectUrl = `${backendUrl}/api/integrations/sheets/detect-headers`;

  // Secret is pre-embedded inside the script so user never has to type or paste it separately
  const embeddedSecret = plainSecret || integration.inboundSecret || integration.sheetsSecretPrefix || 'gsht_sec_PRE_EMBEDDED_KEY';

  return `/**
 * ============================================================================
 * CRM GOOGLE SHEETS 2-WAY SYNC SCRIPT
 * ============================================================================
 *
 * HOW IT WORKS:
 * 1. Extensions > Apps Script > Paste this entire code > Click Save (disk icon).
 * 2. Select function "setup" from the toolbar dropdown and click "Run".
 * 3. AUTHORIZATION NOTICE:
 *    When running "setup", Google will show:
 *    "Google hasn't verified this app" -> Click "Advanced" -> Click "Go to CRM Sync (unsafe)" -> Click "Allow".
 *
 * QUOTA & CONCURRENCY LIMITS:
 * - Google UrlFetchApp quota: 20,000 calls/day (Free @gmail) / 100,000 calls/day (Google Workspace).
 * - LockService ensures concurrency safety across multiple sheet editors or simultaneous form fills.
 * - Permanent CRM_LEAD_ID prevents duplicate leads when rows are edited, inserted, or sorted.
 */

const CRM_CONFIG = {
  WEBHOOK_URL: '${webhookUrl}',
  DETECT_URL: '${detectUrl}',
  // A password that proves rows come from your sheet (pre-embedded below):
  SECRET: '${embeddedSecret}',
  STATUS_COLUMN: 'CRM_STATUS',
  ID_COLUMN: 'CRM_LEAD_ID',
  // Set to true to import pre-existing rows on first setup, or false for only new rows:
  IMPORT_EXISTING_ROWS: false,
};

/**
 * One-click Setup: Configures columns, detects headers, and sets up triggers.
 */
function setup() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length === 0) {
    SpreadsheetApp.getUi().alert('Your sheet is empty! Please add a header row first (e.g. Full Name, Phone, Email, Campaign).');
    return;
  }

  const headers = data[0];
  let idColIdx = headers.indexOf(CRM_CONFIG.ID_COLUMN);
  let statusColIdx = headers.indexOf(CRM_CONFIG.STATUS_COLUMN);

  // Auto-add CRM tracking columns if missing
  if (idColIdx === -1) {
    idColIdx = headers.length;
    sheet.getRange(1, idColIdx + 1).setValue(CRM_CONFIG.ID_COLUMN);
    headers.push(CRM_CONFIG.ID_COLUMN);
  }
  if (statusColIdx === -1) {
    statusColIdx = headers.length;
    sheet.getRange(1, statusColIdx + 1).setValue(CRM_CONFIG.STATUS_COLUMN);
    headers.push(CRM_CONFIG.STATUS_COLUMN);
  }

  // Handle existing rows if any:
  if (data.length > 1) {
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const hasId = Boolean(row[idColIdx]);
      const hasContent = row.some((val, c) => c !== idColIdx && c !== statusColIdx && String(val || '').trim() !== '');

      if (hasContent && !hasId) {
        if (CRM_CONFIG.IMPORT_EXISTING_ROWS) {
          sheet.getRange(r + 1, idColIdx + 1).setValue(Utilities.getUuid());
          sheet.getRange(r + 1, statusColIdx + 1).setValue('PENDING');
        } else {
          // Mark as SKIPPED so they are never accidentally imported later
          sheet.getRange(r + 1, idColIdx + 1).setValue(Utilities.getUuid());
          sheet.getRange(r + 1, statusColIdx + 1).setValue('SKIPPED');
        }
      }
    }
  }

  // Send header detection ping to CRM
  try {
    const sampleRow = data.length > 1 ? data[1] : [];
    UrlFetchApp.fetch(CRM_CONFIG.DETECT_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-crm-secret': CRM_CONFIG.SECRET },
      payload: JSON.stringify({
        headers: headers,
        sampleRow: sampleRow,
      }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log('Header detection call: ' + e.message);
  }

  // Install automated triggers (onChange and 5-minute retry sweeper)
  installTriggers();

  // If importing existing rows, sweep now
  if (CRM_CONFIG.IMPORT_EXISTING_ROWS) {
    sweepAndSyncRows();
  }

  SpreadsheetApp.getUi().alert('CRM Sync Setup Successful! Tracking columns added and automated triggers installed.');
}

/**
 * Installs onChange and 5-minute sweep triggers safely without duplicating
 */
function installTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let hasChangeTrigger = false;
  let hasClockTrigger = false;

  for (let i = 0; i < triggers.length; i++) {
    const fn = triggers[i].getHandlerFunction();
    if (fn === 'onSheetChange') hasChangeTrigger = true;
    if (fn === 'sweepAndSyncRows') hasClockTrigger = true;
  }

  if (!hasChangeTrigger) {
    ScriptApp.newTrigger('onSheetChange')
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onChange()
      .create();
  }

  if (!hasClockTrigger) {
    ScriptApp.newTrigger('sweepAndSyncRows')
      .timeBased()
      .everyMinutes(5)
      .create();
  }
}

function onSheetChange(e) {
  sweepAndSyncRows();
}

function onFormSubmit(e) {
  sweepAndSyncRows();
}

/**
 * Sweeps all pending/new rows and pushes them to CRM
 */
function sweepAndSyncRows() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    const headers = data[0];
    const idColIdx = headers.indexOf(CRM_CONFIG.ID_COLUMN);
    const statusColIdx = headers.indexOf(CRM_CONFIG.STATUS_COLUMN);

    if (idColIdx === -1 || statusColIdx === -1) return;

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      let leadId = row[idColIdx];
      let status = row[statusColIdx];

      // Skip already synced or skipped rows
      if (status === 'SYNCED' || status === 'SKIPPED') continue;

      // Skip completely empty rows
      const hasContent = row.some((val, c) => c !== idColIdx && c !== statusColIdx && String(val || '').trim() !== '');
      if (!hasContent) continue;

      // Assign UUID and mark PENDING first
      if (!leadId) {
        leadId = Utilities.getUuid();
        sheet.getRange(r + 1, idColIdx + 1).setValue(leadId);
      }
      sheet.getRange(r + 1, statusColIdx + 1).setValue('PENDING');

      // Build row data dictionary
      const rowData = {};
      for (let c = 0; c < headers.length; c++) {
        const key = String(headers[c] || '').trim();
        if (key && key !== CRM_CONFIG.ID_COLUMN && key !== CRM_CONFIG.STATUS_COLUMN) {
          rowData[key] = row[c];
        }
      }

      // Outbound POST to CRM
      try {
        const response = UrlFetchApp.fetch(CRM_CONFIG.WEBHOOK_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'x-crm-secret': CRM_CONFIG.SECRET,
          },
          payload: JSON.stringify({
            leadId: leadId,
            sheetName: sheet.getName(),
            sheetId: sheet.getSheetId(),
            rowIndex: r + 1,
            rowData: rowData,
            timestamp: new Date().toISOString(),
          }),
          muteHttpExceptions: true,
        });

        const code = response.getResponseCode();
        if (code === 200) {
          try {
            const resJson = JSON.parse(response.getContentText());
            if (resJson.status === 'NEEDS_REVIEW') {
              sheet.getRange(r + 1, statusColIdx + 1).setValue('NEEDS_REVIEW');
            } else {
              sheet.getRange(r + 1, statusColIdx + 1).setValue('SYNCED');
            }
          } catch (e) {
            sheet.getRange(r + 1, statusColIdx + 1).setValue('SYNCED');
          }
        } else if (code === 401) {
          sheet.getRange(r + 1, statusColIdx + 1).setValue('KEY_ERROR');
          Logger.log('CRM Secret key rejected (401). Please update script CRM_CONFIG.SECRET.');
          break; // Stop further attempts if secret is wrong
        } else {
          Logger.log('Row ' + (r + 1) + ' returned HTTP ' + code);
        }
      } catch (postErr) {
        Logger.log('Row ' + (r + 1) + ' sync error: ' + postErr.message);
        // Stays PENDING and will be retried automatically in 5 minutes
      }
    }
  } finally {
    lock.releaseLock();
  }
}`;
};
