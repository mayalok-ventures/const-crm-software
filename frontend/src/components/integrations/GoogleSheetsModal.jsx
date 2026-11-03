'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  FileSpreadsheet,
  Check,
  Copy,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Plus,
  HelpCircle,
  Eye,
  Sliders,
  Sparkles,
  Info,
  Clock,
  CheckSquare,
  X
} from 'lucide-react';

const CRM_FIELD_OPTIONS = [
  { value: 'name', label: '👤 Full Name (Lead Name)' },
  { value: 'phone', label: '📱 Phone Number (Required: Phone or Email)' },
  { value: 'email', label: '✉️ Email Address (Required: Phone or Email)' },
  { value: 'targetCourse', label: '🎓 Target Course / Program' },
  { value: 'targetCity', label: '📍 City / Location' },
  { value: 'notes', label: '📝 Notes / Remarks' },
  { value: 'budget', label: '💰 Budget / Financials' },
  { value: 'custom', label: '⚙️ Custom Field (Saved to Lead Profile)' },
  { value: 'ignore', label: '🚫 Skip (Do Not Import)' },
];

export default function GoogleSheetsModal({
  isOpen = false,
  editingIntegration = null,
  onClose,
  onSuccess,
}) {
  // Wizard steps: 1 = Connect Sheet, 2 = Map Columns & Select Campaign, 3 = Verification & Sync
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);

  // Step 1: Connect Method ('link' | 'create')
  const [connectionMethod, setConnectionMethod] = useState('link');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [tabs, setTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('Sheet1');
  const [headerRowIndex, setHeaderRowIndex] = useState(1);

  // Inspection Results
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);
  const [inspectError, setInspectError] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Step 2: Campaign Selection & Column Mapping
  const [campaigns, setCampaigns] = useState([]);
  const [campaignMode, setCampaignMode] = useState('existing'); // 'existing' | 'new'
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignCourse, setNewCampaignCourse] = useState('General Inbound');
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Mapping state: array of { sourceField, crmField, displayLabel, sampleValue, isCustom }
  const [mappings, setMappings] = useState([]);

  // Step 3: Connection & Sync State
  const [saving, setSaving] = useState(false);
  const [savedIntegration, setSavedIntegration] = useState(null);
  const [syncOutcome, setSyncOutcome] = useState(null); // { status, rowsSynced, message }

  // Initial Fetch: Config & Campaigns
  useEffect(() => {
    if (!isOpen) return;

    const init = async () => {
      try {
        const [cfgRes, campRes] = await Promise.all([
          api.get('/integrations/sheets/config').catch(() => ({ data: {} })),
          api.get('/campaigns').catch(() => ({ data: [] })),
        ]);

        if (cfgRes?.data) setConfig(cfgRes.data);

        const campList = campRes?.data?.campaigns || campRes?.data?.data || campRes?.data || [];
        if (Array.isArray(campList)) {
          const active = campList.filter((c) => c.status !== 'cancelled' && c.status !== 'archived');
          setCampaigns(active);
          if (active.length > 0 && !selectedCampaignId) {
            setSelectedCampaignId(active[0]._id);
          }
        }
      } catch (err) {
        console.warn('Initialization error in GoogleSheetsModal:', err.message);
      }
    };

    init();
  }, [isOpen]);

  // Pre-populate if editing existing integration
  useEffect(() => {
    if (editingIntegration && isOpen) {
      const cfg = editingIntegration.sheetsConfig || {};
      setSheetName(editingIntegration.accountName || '');
      setSpreadsheetId(cfg.spreadsheetId || editingIntegration.accountId || '');
      setSpreadsheetUrl(cfg.spreadsheetUrl || '');
      setSheetUrl(cfg.spreadsheetUrl || cfg.spreadsheetId || '');
      setSelectedTab(cfg.tabName || 'Sheet1');
      setHeaderRowIndex(cfg.headerRowIndex || 1);
      if (editingIntegration.metadata?.targetCampaignId) {
        setSelectedCampaignId(editingIntegration.metadata.targetCampaignId);
      }
      if (editingIntegration.fieldMapping && editingIntegration.fieldMapping.length > 0) {
        setMappings(
          editingIntegration.fieldMapping.map((m) => ({
            sourceField: m.sourceField,
            crmField: m.crmField || 'custom',
            displayLabel: m.displayLabel || m.sourceField,
            sampleValue: '',
            isCustom: Boolean(m.isCustom),
          }))
        );
      }
    }
  }, [editingIntegration, isOpen]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // STEP 1: INSPECT & VERIFY SHEET
  // -------------------------------------------------------------
  const handleInspectSheet = async (overrideUrl) => {
    const target = overrideUrl || sheetUrl;
    if (!target || !target.trim()) {
      toast.error('Please enter a Google Sheet URL or Spreadsheet ID');
      return;
    }

    setInspecting(true);
    setInspectError(null);
    setInspectResult(null);

    try {
      const res = await api.post('/integrations/sheets/inspect', {
        urlOrId: target.trim(),
        tabName: selectedTab,
        headerRowIndex: Number(headerRowIndex) || 1,
      });

      const data = res.data;
      if (!data.success) {
        setInspectError(data.error || 'Unable to access sheet');
        return;
      }

      setInspectResult(data);
      setSpreadsheetId(data.spreadsheetId);
      setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`);
      setSheetName(data.title || 'Google Sheet Leads');
      setTabs(data.sheets || []);
      setSelectedTab(data.selectedTab || 'Sheet1');

      // Populate column mappings from detected headers
      if (data.headers && data.headers.length > 0) {
        const initialMap = data.headers.map((h, idx) => {
          const suggested = data.suggestedMappings?.find((m) => m.sourceField === h);
          const sample = data.sampleRows?.[0]?.[h] || '';
          return {
            sourceField: h,
            columnIndex: idx,
            crmField: suggested?.crmField || 'custom',
            displayLabel: suggested?.displayLabel || h,
            sampleValue: sample,
            isCustom: Boolean(suggested?.isCustom || suggested?.crmField === 'custom'),
          };
        });
        setMappings(initialMap);
      } else {
        setMappings([]);
      }

      toast.success(
        data.hasDataRows
          ? `Sheet verified! Detected ${data.headers.length} columns and ${data.totalRowsDetected} rows.`
          : `Sheet verified! Detected ${data.headers.length} columns (0 data rows).`
      );
    } catch (err) {
      console.error('Inspect error:', err);
      const resp = err.response?.data;
      setInspectError(
        resp?.error ||
        err.message ||
        'Could not access the sheet. Please make sure General Access is set to "Anyone with the link".'
      );
    } finally {
      setInspecting(false);
    }
  };

  const copyServiceAccountEmail = () => {
    const email = config?.serviceAccountEmail || 'crm-sheets-sync@crm-project-2026.iam.gserviceaccount.com';
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    toast.success('Sync email copied to clipboard!');
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  // -------------------------------------------------------------
  // STEP 2: CREATE CAMPAIGN INLINE (IF NEEDED)
  // -------------------------------------------------------------
  const handleCreateCampaignInline = async () => {
    if (!newCampaignName.trim()) {
      toast.error('Please enter a name for the new campaign');
      return null;
    }

    setCreatingCampaign(true);
    try {
      const res = await api.post('/campaigns', {
        name: newCampaignName.trim(),
        targetCourse: newCampaignCourse || 'General Inbound',
        category: 'sheets',
        status: 'active',
      });

      const newCamp = res.data?.campaign || res.data?.data || res.data;
      if (newCamp?._id) {
        setCampaigns((prev) => [newCamp, ...prev]);
        setSelectedCampaignId(newCamp._id);
        setCampaignMode('existing');
        toast.success(`Campaign "${newCamp.name}" created!`);
        return newCamp._id;
      }
      return null;
    } catch (err) {
      console.error('Failed to create campaign:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to create campaign');
      return null;
    } finally {
      setCreatingCampaign(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 2 -> STEP 3: SAVE & INITIAL SYNC
  // -------------------------------------------------------------
  const handleSaveAndSync = async () => {
    // 1. Resolve target campaign ID
    let finalCampaignId = selectedCampaignId;
    if (campaignMode === 'new') {
      finalCampaignId = await handleCreateCampaignInline();
      if (!finalCampaignId) return;
    }

    if (!finalCampaignId) {
      toast.error('A destination campaign is required. Please select or create one.');
      return;
    }

    // 2. Validate Phone OR Email mapping
    const hasPhoneOrEmail = mappings.some(
      (m) => (m.crmField === 'phone' || m.crmField === 'email') && m.crmField !== 'ignore'
    );
    if (!hasPhoneOrEmail) {
      toast.error('You must map at least Phone Number OR Email Address to capture leads.');
      return;
    }

    // 3. Prepare payload
    const activeMappings = mappings
      .filter((m) => m.crmField !== 'ignore')
      .map((m) => ({
        sourceField: m.sourceField,
        crmField: m.crmField,
        displayLabel: m.displayLabel || m.sourceField,
        isCustom: m.crmField === 'custom',
      }));

    setSaving(true);
    try {
      const res = await api.post('/integrations/sheets/connect', {
        sheetName: sheetName.trim() || 'Google Sheet Leads',
        spreadsheetId,
        spreadsheetUrl,
        tabName: selectedTab,
        headerRowIndex: Number(headerRowIndex) || 1,
        accessMethod: inspectResult?.accessMethod || 'public_csv',
        hasWriteAccess: Boolean(inspectResult?.hasWriteAccess),
        importExistingRows: true,
        campaignId: finalCampaignId,
        fieldMapping: activeMappings,
        storedHeaders: mappings.map((m) => m.sourceField),
      });

      const data = res.data;
      setSavedIntegration(data.integration);
      setSyncOutcome({
        status: data.status,
        rowsSynced: data.rowsSynced || 0,
        message: data.message,
      });

      setStep(3);
      if (data.status === 'connected') {
        toast.success(`Google Sheet Connected! Synced ${data.rowsSynced} leads.`);
      } else {
        toast.success('Google Sheet linked! Status is Awaiting Data.');
      }
    } catch (err) {
      console.error('Connect error:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to connect Google Sheet');
    } finally {
      setSaving(false);
    }
  };

  // Close modal and refresh parent
  const handleDone = () => {
    onSuccess?.();
    onClose?.();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--card, #ffffff)',
          color: 'var(--text, #1e293b)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid var(--border, #e2e8f0)',
          overflow: 'hidden',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#10b981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Google Sheets Integration
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', margin: 0 }}>
                Capture candidate leads directly from Google Sheets into your Campaign
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #64748b)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* STEP PROGRESS INDICATOR */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            background: 'var(--card, #ffffff)',
          }}
        >
          {[
            { num: 1, label: '1. Link Sheet' },
            { num: 2, label: '2. Map Columns & Campaign' },
            { num: 3, label: '3. Verify & Sync' },
          ].map((s) => (
            <div
              key={s.num}
              style={{
                flex: 1,
                padding: '10px 14px',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
                borderBottom: step === s.num ? '2px solid #10b981' : '2px solid transparent',
                color: step === s.num ? '#10b981' : step > s.num ? '#059669' : 'var(--text-muted, #64748b)',
                background: step === s.num ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {step > s.num ? <Check size={14} /> : null}
              {s.label}
            </div>
          ))}
        </div>

        {/* BODY */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* ─────────────────────────────────────────────────────────────
              STEP 1: LINK GOOGLE SHEET
             ───────────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Method Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  background: 'var(--bg, #f1f5f9)',
                  padding: 4,
                  borderRadius: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setConnectionMethod('link')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: connectionMethod === 'link' ? 'var(--card, #ffffff)' : 'transparent',
                    color: connectionMethod === 'link' ? '#10b981' : 'var(--text-muted, #64748b)',
                    boxShadow: connectionMethod === 'link' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  🔗 Paste Google Sheet Link (Public Link)
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMethod('create')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: connectionMethod === 'create' ? 'var(--card, #ffffff)' : 'transparent',
                    color: connectionMethod === 'create' ? '#10b981' : 'var(--text-muted, #64748b)',
                    boxShadow: connectionMethod === 'create' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  📄 Create Sheet in Your Account
                </button>
              </div>

              {/* OPTION 1: PASTE LINK */}
              {connectionMethod === 'link' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 6,
                      }}
                    >
                      Google Sheet URL or Spreadsheet ID
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid var(--border, #cbd5e1)',
                          background: 'var(--card, #ffffff)',
                          color: 'var(--text, #1e293b)',
                          fontSize: 13,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleInspectSheet()}
                        disabled={inspecting || !sheetUrl.trim()}
                        style={{
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '0 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: inspecting || !sheetUrl.trim() ? 'not-allowed' : 'pointer',
                          opacity: inspecting || !sheetUrl.trim() ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {inspecting ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                        {inspecting ? 'Checking...' : 'Inspect Sheet'}
                      </button>
                    </div>
                  </div>

                  {/* HOW TO SHARE INSTRUCTIONS BOX */}
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: 10,
                      padding: 14,
                      fontSize: 12,
                      color: 'var(--text, #1e293b)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <HelpCircle size={15} /> How to make your Google Sheet accessible:
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      <li>Open your Google Sheet in your Google account.</li>
                      <li>Click the blue <strong>Share</strong> button in the top right.</li>
                      <li>Under <strong>General access</strong>, change from <em>Restricted</em> to <strong>Anyone with the link</strong> (Viewer).</li>
                      <li>Click <strong>Copy link</strong> and paste it into the field above.</li>
                    </ol>
                  </div>

                  {/* ACCESS ERROR / RESTRICTED NOTICE */}
                  {inspectError && (
                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 10,
                        padding: 14,
                        fontSize: 12,
                        color: '#b91c1c',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 6,
                        }}
                      >
                        <AlertCircle size={15} /> {inspectError}
                      </div>
                      <p style={{ margin: '0 0 10px', lineHeight: 1.4 }}>
                        If you prefer not to make it public, you can alternatively share the sheet with view access to our CRM sync email:
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          background: 'var(--card, #ffffff)',
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                        }}
                      >
                        <code style={{ fontSize: 11, color: '#334155', flex: 1, wordBreak: 'break-all' }}>
                          {config?.serviceAccountEmail || 'crm-sheets-sync@crm-project-2026.iam.gserviceaccount.com'}
                        </code>
                        <button
                          type="button"
                          onClick={copyServiceAccountEmail}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {copiedEmail ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          {copiedEmail ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUCCESS INSPECTION BANNER */}
                  {inspectResult && inspectResult.success && (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 10,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 700,
                          color: '#059669',
                          marginBottom: 6,
                        }}
                      >
                        <CheckCircle2 size={16} /> Sheet Successfully Verified!
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        {inspectResult.title || 'Google Sheet'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 10 }}>
                        Detected <strong>{inspectResult.headers?.length || 0}</strong> columns •{' '}
                        <strong>{inspectResult.totalRowsDetected || 0}</strong> data rows found
                      </div>

                      {/* Chips of detected headers */}
                      {inspectResult.headers && inspectResult.headers.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {inspectResult.headers.map((h, i) => (
                            <span
                              key={i}
                              style={{
                                background: 'var(--card, #ffffff)',
                                border: '1px solid #a7f3d0',
                                color: '#065f46',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 6,
                              }}
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* OPTION 2: CREATE IN USER'S GOOGLE ACCOUNT */}
              {connectionMethod === 'create' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      background: 'var(--bg, #f8fafc)',
                      border: '1px solid var(--border, #cbd5e1)',
                      borderRadius: 10,
                      padding: 16,
                      textAlign: 'center',
                    }}
                  >
                    <FileSpreadsheet size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>
                      Open Pre-Formatted CRM Lead Sheet
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', margin: '0 0 16px', lineHeight: 1.5 }}>
                      We have prepared a ready-to-use Google Sheet template with standard CRM columns:
                      <br />
                      <strong>Full Name</strong>, <strong>Phone</strong>, <strong>Email</strong>, <strong>Course</strong>, <strong>City</strong>, and <strong>Notes</strong>.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                      <a
                        href="https://docs.google.com/spreadsheets/create"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: '#10b981',
                          color: 'white',
                          borderRadius: 8,
                          padding: '10px 18px',
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <ExternalLink size={14} /> Open New Sheet in Google Drive
                      </a>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: 10,
                      padding: 14,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>
                      Steps to finish setup:
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      <li>Click the button above to create a sheet in your Google Drive.</li>
                      <li>In Row 1, put header columns (e.g. <code>Full Name</code>, <code>Phone</code>, <code>Email</code>, <code>Course</code>, <code>City</code>).</li>
                      <li>Click <strong>Share</strong> $\rightarrow$ set General Access to <strong>Anyone with the link</strong>.</li>
                      <li>Switch back to the <strong>Paste Google Sheet Link</strong> tab and paste your sheet URL.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 2: MAP COLUMNS & MANDATORY CAMPAIGN
             ───────────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* MANDATORY CAMPAIGN SELECTION */}
              <div
                style={{
                  background: 'var(--bg, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                    🎯 Destination Campaign <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setCampaignMode('existing')}
                      style={{
                        background: campaignMode === 'existing' ? '#10b981' : 'var(--card, #ffffff)',
                        color: campaignMode === 'existing' ? 'white' : 'var(--text-muted, #64748b)',
                        border: '1px solid var(--border, #cbd5e1)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Choose Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setCampaignMode('new')}
                      style={{
                        background: campaignMode === 'new' ? '#10b981' : 'var(--card, #ffffff)',
                        color: campaignMode === 'new' ? 'white' : 'var(--text-muted, #64748b)',
                        border: '1px solid var(--border, #cbd5e1)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + Create New
                    </button>
                  </div>
                </div>

                {campaignMode === 'existing' ? (
                  <div>
                    {campaigns.length > 0 ? (
                      <select
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border, #cbd5e1)',
                          background: 'var(--card, #ffffff)',
                          fontSize: 13,
                        }}
                      >
                        {campaigns.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} {c.targetCourse ? `(${c.targetCourse})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                        No active campaigns found. Switch to "+ Create New" to create one.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      placeholder="e.g. Google Sheets Inbound 2026"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border, #cbd5e1)',
                        background: 'var(--card, #ffffff)',
                        fontSize: 13,
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Target Course (Optional)"
                      value={newCampaignCourse}
                      onChange={(e) => setNewCampaignCourse(e.target.value)}
                      style={{
                        width: 180,
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border, #cbd5e1)',
                        background: 'var(--card, #ffffff)',
                        fontSize: 13,
                      }}
                    />
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Info size={12} /> Counselor assignment rules and agent routing are handled inside Campaigns.
                </div>
              </div>

              {/* COLUMN MAPPING TABLE */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                    Map Google Sheet Columns to CRM Fields
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                    Phone or Email is required
                  </span>
                </div>

                {mappings.length > 0 ? (
                  <div
                    style={{
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: 10,
                      overflow: 'hidden',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Sheet Column</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Sample Value</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>CRM Target Field</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((item, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: idx < mappings.length - 1 ? '1px solid var(--border, #e2e8f0)' : 'none',
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                              {item.sourceField}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted, #64748b)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.sampleValue || '—'}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <select
                                value={item.crmField}
                                onChange={(e) => {
                                  const updated = [...mappings];
                                  updated[idx].crmField = e.target.value;
                                  updated[idx].isCustom = e.target.value === 'custom';
                                  setMappings(updated);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border, #cbd5e1)',
                                  background: 'var(--card, #ffffff)',
                                  fontSize: 12,
                                }}
                              >
                                {CRM_FIELD_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'var(--bg, #f8fafc)',
                      border: '1px dashed var(--border, #cbd5e1)',
                      borderRadius: 10,
                      padding: 20,
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    No columns detected yet. Go back to Step 1 and inspect your sheet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 3: VERIFICATION & INITIAL SYNC RESULT
             ───────────────────────────────────────────────────────────── */}
          {step === 3 && syncOutcome && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center', padding: '10px 0' }}>
              {syncOutcome.status === 'connected' ? (
                <div>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
                    Google Sheet Connected!
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', margin: '0 0 20px', lineHeight: 1.5 }}>
                    Successfully synced <strong>{syncOutcome.rowsSynced}</strong> lead(s) into your Campaign.
                    <br />
                    New rows added to this sheet will automatically sync to your CRM every 5 minutes.
                  </p>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#059669',
                      padding: '6px 14px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Status: Connected & Active
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Clock size={32} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
                    Sheet Linked — Awaiting First Lead
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Your Google Sheet mapping and campaign link are fully configured!
                    <br />
                    Because no candidate rows exist in the sheet yet, the integration status is set to{' '}
                    <strong>Awaiting Data</strong>.
                  </p>

                  <div
                    style={{
                      background: 'var(--bg, #f8fafc)',
                      border: '1px solid var(--border, #cbd5e1)',
                      borderRadius: 10,
                      padding: 14,
                      textAlign: 'left',
                      fontSize: 12,
                      lineHeight: 1.5,
                      margin: '0 auto 20px',
                      maxWidth: 520,
                    }}
                  >
                    <strong>To activate connection:</strong>
                    <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      <li>Add at least one candidate row with a Name and Phone/Email to your Google Sheet.</li>
                      <li>Click the <strong>"Sync Now"</strong> button on the Google Sheets card anytime.</li>
                      <li>Once the lead is imported, your status will immediately change to <strong>Connected</strong>!</li>
                    </ol>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: '#b45309',
                      padding: '6px 14px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Status: Awaiting Data Sync
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER CONTROLS */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg, #f8fafc)',
          }}
        >
          {step > 1 && step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              style={{
                background: 'var(--card, #ffffff)',
                border: '1px solid var(--border, #cbd5e1)',
                color: 'var(--text, #1e293b)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {step === 1 && (
              <button
                type="button"
                onClick={() => {
                  if (!inspectResult) {
                    handleInspectSheet();
                  } else {
                    setStep(2);
                  }
                }}
                disabled={inspecting || !sheetUrl.trim()}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: inspecting || !sheetUrl.trim() ? 'not-allowed' : 'pointer',
                  opacity: inspecting || !sheetUrl.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {!inspectResult ? 'Inspect & Continue' : 'Next: Map Columns & Campaign'}
                <ArrowRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleSaveAndSync}
                disabled={saving || creatingCampaign}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                }}
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Connecting & Syncing...
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} /> Complete & Connect Sheet
                  </>
                )}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleDone}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 22px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Go to Integrations Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

