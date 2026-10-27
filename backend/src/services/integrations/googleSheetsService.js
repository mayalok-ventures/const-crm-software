const crypto = require('crypto');
const axios = require('axios');
const { getTemplateHeaderDefinitions, matchHeaderToCrmField } = require('./leadFieldsRegistry');

/**
 * Google Sheets Service & API Client
 *
 * Implements real Google Sheets API v4 calls:
 * - Option 1: Read tabs, headers, sample values from existing sheet via OAuth (drive.file)
 * - Option 2: Programmatically create formatted spreadsheet in user's Drive with CRM lead fields & validations
 * - Option 3: Access via Service Account email sharing, Public link (API Key/Export), or Picker fallback
 * - Mode B Polling: Read row batches, respect quotas (300 reads/min per project), backoff on 429, update row markers
 * - Full Mock Mode support for testing without real credentials.
 */

class GoogleSheetsService {
  constructor() {
    this.tokenCache = new Map(); // key -> { token, expiresAt }
  }

  /**
   * Extract spreadsheet ID from arbitrary Google Sheets URL or raw ID
   */
  extractSpreadsheetId(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    // Direct ID match (typically 44 chars alphanumeric + dash/underscore)
    if (/^[a-zA-Z0-9-_]{20,80}$/.test(trimmed) && !trimmed.includes('/')) {
      return trimmed;
    }

    // Google Sheets URL format: /spreadsheets/d/([a-zA-Z0-9-_]+)
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  /**
   * Generates a Google Service Account OAuth2 Bearer token using RFC 7523 RSA-SHA256 JWT
   */
  async getServiceAccountToken() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    // Check if JSON key is provided in GOOGLE_SERVICE_ACCOUNT_KEY
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        if (parsed.client_email && parsed.private_key) {
          return this._mintJwtToken(parsed.client_email, parsed.private_key);
        }
      } catch {
        // Not JSON, continue with email & key
      }
    }

    if (!email || !privateKey) {
      return null;
    }

    // Normalize escaped newlines in env private key
    privateKey = privateKey.replace(/\\n/g, '\n');
    return this._mintJwtToken(email, privateKey);
  }

  /**
   * Mints JWT assertion and exchanges for Google OAuth2 access token
   */
  async _mintJwtToken(email, privateKey) {
    const cached = this.tokenCache.get(email);
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.token;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Claim = Buffer.from(JSON.stringify(claim)).toString('base64url');
    const signPayload = `${b64Header}.${b64Claim}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signPayload);
    const signature = signer.sign(privateKey, 'base64url');
    const assertion = `${signPayload}.${signature}`;

    const res = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const token = res.data.access_token;
    const expiresAt = Date.now() + (res.data.expires_in || 3600) * 1000;
    this.tokenCache.set(email, { token, expiresAt });
    return token;
  }

  /**
   * Refreshes user OAuth token using offline refresh token
   */
  async refreshUserOAuthToken(refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    const res = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return {
      accessToken: res.data.access_token,
      expiresAt: new Date(Date.now() + (res.data.expires_in || 3600) * 1000),
    };
  }

  /**
   * Retries an Axios call with exponential backoff on 429 Too Many Requests
   */
  async _requestWithBackoff(reqFn, maxRetries = 3) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await reqFn();
      } catch (err) {
        if (err.response?.status === 429 && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1500; // 1.5s, 3s, 6s
          console.warn(`[Sheets API 429 Rate Limited]: backing off for ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Inspects spreadsheet tabs, permissions, and structure
   */
  async inspectSpreadsheet({
    spreadsheetId,
    accessToken,
    useServiceAccount = false,
    apiKey,
    mockDriver = null,
  }) {
    // 1. Mock Mode (for deterministic unit/e2e testing without live Google credentials)
    if (mockDriver || process.env.GOOGLE_MOCK_MODE === 'true' || spreadsheetId.startsWith('mock_')) {
      const driver = mockDriver || this._getMockSpreadsheet(spreadsheetId);
      return driver.inspect();
    }

    let authHeader = null;
    let accessMethod = 'none';
    let hasWriteAccess = false;

    // Check user OAuth token first
    if (accessToken) {
      authHeader = `Bearer ${accessToken}`;
      accessMethod = 'oauth';
      hasWriteAccess = true;
    } else if (useServiceAccount) {
      const saToken = await this.getServiceAccountToken();
      if (saToken) {
        authHeader = `Bearer ${saToken}`;
        accessMethod = 'service_account';
        hasWriteAccess = true; // Best effort assumption; verified on write
      }
    }

    // 2. Query Google Sheets Metadata API
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`;
      const config = {
        headers: authHeader ? { Authorization: authHeader } : {},
        params: !authHeader && apiKey ? { key: apiKey } : {},
      };

      const res = await this._requestWithBackoff(() => axios.get(url, config));
      const data = res.data;

      const title = data.properties?.title || 'Google Sheet';
      const sheets = (data.sheets || []).map((s) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title || 'Sheet1',
        rowCount: s.properties?.gridProperties?.rowCount || 1000,
        columnCount: s.properties?.gridProperties?.columnCount || 26,
      }));

      return {
        success: true,
        spreadsheetId,
        title,
        sheets,
        accessMethod,
        hasWriteAccess,
      };
    } catch (err) {
      // If 403/401 and we haven't tried public fallback, attempt public read
      if ((err.response?.status === 403 || err.response?.status === 401) && !accessToken) {
        const publicCheck = await this._inspectPublicFallback(spreadsheetId);
        if (publicCheck.success) {
          return publicCheck;
        }
      }

      const status = err.response?.status;
      const message = err.response?.data?.error?.message || err.message;
      return {
        success: false,
        spreadsheetId,
        status,
        error: message,
        needsShareWithServiceAccount: status === 403 || status === 404,
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
      };
    }
  }

  /**
   * Reads rows and detects columns from a specific sheet/tab
   */
  async readSheetData({
    spreadsheetId,
    tabName = 'Sheet1',
    headerRowIndex = 1,
    maxRows = 10,
    accessToken,
    useServiceAccount = false,
    apiKey,
    mockDriver = null,
  }) {
    if (mockDriver || process.env.GOOGLE_MOCK_MODE === 'true' || spreadsheetId.startsWith('mock_')) {
      const driver = mockDriver || this._getMockSpreadsheet(spreadsheetId);
      return driver.readData(tabName, headerRowIndex, maxRows);
    }

    let authHeader = null;
    let accessMethod = 'none';

    if (accessToken) {
      authHeader = `Bearer ${accessToken}`;
      accessMethod = 'oauth';
    } else if (useServiceAccount) {
      const saToken = await this.getServiceAccountToken();
      if (saToken) {
        authHeader = `Bearer ${saToken}`;
        accessMethod = 'service_account';
      }
    }

    try {
      const range = `'${tabName}'!A${headerRowIndex}:ZZ${headerRowIndex + maxRows}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      const config = {
        headers: authHeader ? { Authorization: authHeader } : {},
        params: !authHeader && apiKey ? { key: apiKey } : {},
      };

      const res = await this._requestWithBackoff(() => axios.get(url, config));
      const rawRows = res.data.values || [];

      if (rawRows.length === 0) {
        return {
          success: true,
          isEmpty: true,
          headers: [],
          sampleRows: [],
          totalRowsDetected: 0,
        };
      }

      // First row is the header row
      const rawHeaders = rawRows[0] || [];
      const cleanHeaders = [];
      const headerCounts = {};

      for (let i = 0; i < rawHeaders.length; i++) {
        let h = String(rawHeaders[i] || '').trim();
        if (!h) {
          h = `Column_${i + 1}`; // Handle blank header cell
        }
        // Handle duplicate header names (e.g. "Phone", "Phone" -> "Phone", "Phone_2")
        if (headerCounts[h]) {
          headerCounts[h]++;
          h = `${h}_${headerCounts[h]}`;
        } else {
          headerCounts[h] = 1;
        }
        cleanHeaders.push({
          header: h,
          index: i,
        });
      }

      const sampleRows = rawRows.slice(1, 4).map((row) => {
        const obj = {};
        cleanHeaders.forEach((h) => {
          obj[h.header] = row[h.index] !== undefined ? String(row[h.index]) : '';
        });
        return obj;
      });

      // Compute smart auto-suggestions using tolerant synonym matcher
      const suggestedMappings = cleanHeaders.map(({ header, index }) => {
        const match = matchHeaderToCrmField(header);
        const sampleVal = sampleRows[0] ? sampleRows[0][header] || '' : '';
        return {
          sourceField: header,
          columnIndex: index,
          crmField: match.crmField,
          displayLabel: match.displayLabel || header,
          isCustom: match.isCustom,
          isSystem: Boolean(match.isSystem),
          sampleValue: sampleVal,
        };
      });

      return {
        success: true,
        isEmpty: false,
        headers: cleanHeaders.map((c) => c.header),
        sampleRows,
        suggestedMappings,
        totalRowsDetected: rawRows.length - 1,
        accessMethod,
      };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  }

  /**
   * Option 2: Creates a brand new spreadsheet directly in user's Drive with CRM lead fields & formatting
   */
  async createSpreadsheetInDrive({ title = 'CRM Lead Capture Sheet', accessToken, mockDriver = null }) {
    if (mockDriver || process.env.GOOGLE_MOCK_MODE === 'true' || !accessToken) {
      const mockId = `mock_sheet_${Date.now()}`;
      return {
        success: true,
        spreadsheetId: mockId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${mockId}/edit`,
        title,
        tabName: 'Leads',
        tabId: 0,
        headers: getTemplateHeaderDefinitions().map((d) => d.name),
        fieldMappings: getTemplateHeaderDefinitions().map((d, idx) => ({
          sourceField: d.name,
          columnIndex: idx,
          crmField: d.field,
          displayLabel: d.name,
          isCustom: false,
          isSystem: Boolean(d.system),
        })),
        isMock: true,
      };
    }

    const headerDefs = getTemplateHeaderDefinitions();
    const headerRowValues = headerDefs.map((d) => ({
      userEnteredValue: { stringValue: d.name },
      userEnteredFormat: {
        backgroundColor: { red: 0.12, green: 0.16, blue: 0.23 }, // #1E293B
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
        horizontalAlignment: 'CENTER',
      },
    }));

    // Build Data Validation rules for dropdown fields (e.g. Lead Quality, Quota)
    const requests = [
      {
        updateSheetProperties: {
          properties: {
            sheetId: 0,
            title: 'Leads',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'title,gridProperties.frozenRowCount',
        },
      },
      {
        appendCells: {
          sheetId: 0,
          rows: [{ values: headerRowValues }],
          fields: 'userEnteredValue,userEnteredFormat',
        },
      },
    ];

    // Add dropdown validation rules
    headerDefs.forEach((d, colIdx) => {
      if (d.validation && d.validation.type === 'ONE_OF_LIST') {
        requests.push({
          setDataValidation: {
            range: {
              sheetId: 0,
              startRowIndex: 1,
              endRowIndex: 1000,
              startColumnIndex: colIdx,
              endColumnIndex: colIdx + 1,
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: d.validation.values.map((v) => ({ userEnteredValue: v })),
              },
              showCustomUi: true,
              strict: false,
            },
          },
        });
      }
    });

    const createPayload = {
      properties: { title },
      sheets: [
        {
          properties: { sheetId: 0, title: 'Leads' },
        },
      ],
    };

    // 1. Create Spreadsheet
    const res = await this._requestWithBackoff(() =>
      axios.post('https://sheets.googleapis.com/v4/spreadsheets', createPayload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    const spreadsheetId = res.data.spreadsheetId;
    const spreadsheetUrl = res.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 2. Format Header & Validations
    await this._requestWithBackoff(() =>
      axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        { requests },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    const fieldMappings = headerDefs.map((d, idx) => ({
      sourceField: d.name,
      columnIndex: idx,
      crmField: d.field,
      displayLabel: d.name,
      isCustom: false,
      isSystem: Boolean(d.system),
    }));

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      title,
      tabName: 'Leads',
      tabId: 0,
      headers: headerDefs.map((d) => d.name),
      fieldMappings,
    };
  }

  /**
   * Applies standard template headers and formatting to an existing empty sheet
   */
  async applyTemplateHeaders({ spreadsheetId, tabName = 'Sheet1', accessToken, useServiceAccount = false, mockDriver = null }) {
    if (mockDriver || process.env.GOOGLE_MOCK_MODE === 'true' || spreadsheetId.startsWith('mock_')) {
      return { success: true, headers: getTemplateHeaderDefinitions().map((d) => d.name) };
    }

    const headerDefs = getTemplateHeaderDefinitions();
    const headers = headerDefs.map((d) => d.name);

    let authHeader = null;
    if (accessToken) authHeader = `Bearer ${accessToken}`;
    else if (useServiceAccount) {
      const sa = await this.getServiceAccountToken();
      if (sa) authHeader = `Bearer ${sa}`;
    }

    const range = `'${tabName}'!A1:${String.fromCharCode(64 + headers.length)}1`;
    await this._requestWithBackoff(() =>
      axios.put(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        { values: [headers] },
        { headers: { Authorization: authHeader } }
      )
    );

    return { success: true, headers };
  }

  /**
   * Writes row marker updates (CRM_LEAD_ID and CRM_STATUS) back to Google Sheet
   */
  async batchUpdateRowMarkers({
    spreadsheetId,
    tabName = 'Sheet1',
    updates = [], // [{ rowIndex, idColIndex, statusColIndex, leadId, status }]
    accessToken,
    useServiceAccount = false,
    mockDriver = null,
  }) {
    if (updates.length === 0) return { success: true, updatedCount: 0 };
    if (mockDriver || process.env.GOOGLE_MOCK_MODE === 'true' || spreadsheetId.startsWith('mock_')) {
      return { success: true, updatedCount: updates.length };
    }

    let authHeader = null;
    if (accessToken) authHeader = `Bearer ${accessToken}`;
    else if (useServiceAccount) {
      const sa = await this.getServiceAccountToken();
      if (sa) authHeader = `Bearer ${sa}`;
    }

    if (!authHeader) {
      // Cannot write markers on read-only public access
      return { success: false, reason: 'Read-only access, cannot write markers' };
    }

    const data = [];
    for (const u of updates) {
      if (u.idColIndex !== undefined && u.leadId) {
        const colLetter = this._indexToA1Column(u.idColIndex);
        data.push({
          range: `'${tabName}'!${colLetter}${u.rowIndex}`,
          values: [[u.leadId]],
        });
      }
      if (u.statusColIndex !== undefined && u.status) {
        const colLetter = this._indexToA1Column(u.statusColIndex);
        data.push({
          range: `'${tabName}'!${colLetter}${u.rowIndex}`,
          values: [[u.status]],
        });
      }
    }

    if (data.length === 0) return { success: true, updatedCount: 0 };

    await this._requestWithBackoff(() =>
      axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
        {
          valueInputOption: 'USER_ENTERED',
          data,
        },
        { headers: { Authorization: authHeader } }
      )
    );

    return { success: true, updatedCount: updates.length };
  }

  /**
   * Fallback for public ("Anyone with the link") sheets via public gviz/csv export
   * (Marked as an undocumented / fallback approach)
   */
  async _inspectPublicFallback(spreadsheetId) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
      const res = await axios.get(url, { timeout: 7000 });
      if (res.status === 200 && typeof res.data === 'string' && res.data.length > 0) {
        return {
          success: true,
          spreadsheetId,
          title: 'Public Google Sheet',
          sheets: [{ sheetId: 0, title: 'Sheet1', rowCount: 100, columnCount: 10 }],
          accessMethod: 'public_export',
          hasWriteAccess: false,
          isPublicFallback: true,
        };
      }
    } catch {}
    return { success: false };
  }

  /**
   * Helper: converts 0-indexed column integer to A1 notation ('A', 'B', ... 'AA')
   */
  _indexToA1Column(index) {
    let col = '';
    let temp = index;
    while (temp >= 0) {
      col = String.fromCharCode((temp % 26) + 65) + col;
      temp = Math.floor(temp / 26) - 1;
    }
    return col;
  }

  /**
   * In-Memory Mock Driver for offline / automated unit & e2e testing
   */
  _getMockSpreadsheet(spreadsheetId) {
    return {
      inspect: () => ({
        success: true,
        spreadsheetId,
        title: 'MBBS 2026 Inbound Candidates (Mock)',
        sheets: [{ sheetId: 0, title: 'Admissions 2026', rowCount: 50, columnCount: 15 }],
        accessMethod: 'oauth',
        hasWriteAccess: true,
        isMock: true,
      }),
      readData: (tabName, headerRow, maxRows) => {
        const headers = [
          'Full Name',
          'Phone',
          'Email',
          'City',
          'Course / Interest',
          'Campaign',
          'Notes',
          'CRM_LEAD_ID',
          'CRM_STATUS',
        ];
        const sampleRows = [
          {
            'Full Name': 'Siddharth Malhotra',
            Phone: '+919876543210',
            Email: 'siddharth@example.com',
            City: 'Delhi',
            'Course / Interest': 'MBBS Abroad',
            Campaign: 'NEET 2026 Guidance',
            Notes: 'Interested in Georgia Medical University. Budget 30 Lakhs.',
            CRM_LEAD_ID: '',
            CRM_STATUS: '',
          },
          {
            'Full Name': 'Pooja Hegde',
            Phone: '+919123456780',
            Email: 'pooja.hegde@example.com',
            City: 'Bangalore',
            'Course / Interest': 'B.Tech AI',
            Campaign: 'Tech Inbound',
            Notes: 'Looking for merit scholarship.',
            CRM_LEAD_ID: '',
            CRM_STATUS: '',
          },
        ];
        return {
          success: true,
          isEmpty: false,
          headers,
          sampleRows,
          suggestedMappings: headers.map((h, idx) => ({
            sourceField: h,
            columnIndex: idx,
            crmField: matchHeaderToCrmField(h).crmField,
            displayLabel: h,
            isCustom: matchHeaderToCrmField(h).isCustom,
            isSystem: matchHeaderToCrmField(h).isSystem,
            sampleValue: sampleRows[0][h] || '',
          })),
          totalRowsDetected: 2,
          accessMethod: 'mock',
          isMock: true,
        };
      },
    };
  }
}

module.exports = new GoogleSheetsService();
