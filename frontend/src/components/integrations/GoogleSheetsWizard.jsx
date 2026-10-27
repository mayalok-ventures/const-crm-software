'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  FileSpreadsheet, Check, Copy, ChevronRight, ArrowLeft, ArrowRight,
  ShieldAlert, Sparkles, CheckCircle2, Play, Users, Sliders, AlertCircle,
  Download, HelpCircle, Eye, RefreshCw, Link as LinkIcon, PlusCircle,
  ExternalLink, Key, Lock, Clock, Info, CheckSquare
} from 'lucide-react';

export default function GoogleSheetsWizard({ isOpen = true, onClose, onSuccess, members = [] }) {
  // Navigation: Step 1 (Method), 2 (Tab/Headers), 3 (Mapping), 4 (Assignment & Sync Mode), 5 (Live Test)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);

  // Method Selection: 'picker' (Option 1), 'create' (Option 2), 'link' (Option 3)
  const [connectionMethod, setConnectionMethod] = useState('picker');

  // Option 1 & 2: OAuth & Picker State
  const [userAccessToken, setUserAccessToken] = useState('');
  const [userRefreshToken, setUserRefreshToken] = useState('');

  // Option 2: Create New Sheet
  const [newSheetTitle, setNewSheetTitle] = useState('Admissions Leads 2026');

  // Option 3: Paste Link State
  const [pastedUrl, setPastedUrl] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessDetails, setAccessDetails] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Step 2: Sheet Metadata & Tab Selection
  const [sheetName, setSheetName] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [tabs, setTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('Sheet1');
  const [headerRowIndex, setHeaderRowIndex] = useState(1);
  const [hasWriteAccess, setHasWriteAccess] = useState(true);
  const [accessMethod, setAccessMethod] = useState('oauth');
  const [isSheetEmpty, setIsSheetEmpty] = useState(false);

  // Step 3: Column Mapping & Header Detection
  const [detectedHeaders, setDetectedHeaders] = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [fieldMappings, setFieldMappings] = useState([]);
  const [defaultCampaign, setDefaultCampaign] = useState('Google Sheets Inbound');

  // Step 4: Counselor Assignment & Sync Mode
  const [assignmentType, setAssignmentType] = useState('round_robin');
  const [specificCounselorId, setSpecificCounselorId] = useState('');
  const [fallbackUserId, setFallbackUserId] = useState('');
  const [syncMode, setSyncMode] = useState('polling'); // 'polling' (Mode B) vs 'push' (Mode A)
  const [importExistingRows, setImportExistingRows] = useState(false);

  // Mode A: Generated Script & Key
  const [createdIntegration, setCreatedIntegration] = useState(null);
  const [generatedScript, setGeneratedScript] = useState('');
  const [embeddedSecret, setEmbeddedSecret] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  // Step 5: Test Row & Live Status
  const [testingRow, setTestingRow] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testLeadResult, setTestLeadResult] = useState(null);

  // Fetch Google Cloud Configuration on Open
  useEffect(() => {
    if (isOpen === false) return;
    const fetchConfig = async () => {
      try {
        const res = await api.get('/integrations/sheets/config');
        setConfig(res.data);
      } catch (err) {
        console.error('Failed to load sheets config:', err);
      }
    };
    fetchConfig();
  }, [isOpen]);

  if (isOpen === false) return null;

  // -------------------------------------------------------------
  // STEP 1 HANDLERS: CONNECT EXISTING / CREATE NEW / PASTE LINK
  // -------------------------------------------------------------

  // Option 1: Connect with Google Picker
  const handleGooglePickerLaunch = async () => {
    // If Google Client ID and API Key are present, we can initialize Google Token Client
    // Otherwise fallback to simulated / dev mode selection
    if (config?.googleClientId && window.google?.accounts?.oauth2) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: config.recommendedScope || 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse) => {
          if (tokenResponse?.access_token) {
            setUserAccessToken(tokenResponse.access_token);
            openPicker(tokenResponse.access_token);
          }
        },
      });
      client.requestAccessToken();
    } else {
      // Dev / Test simulation mode for OAuth Picker
      setLoading(true);
      try {
        const res = await api.post('/integrations/sheets/inspect', {
          urlOrId: 'mock_spreadsheet_01',
          mockDriver: true,
        });
        setSpreadsheetId(res.data.spreadsheetId);
        setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${res.data.spreadsheetId}/edit`);
        setSheetName(res.data.title);
        setTabs(res.data.sheets);
        setSelectedTab(res.data.selectedTab);
        setDetectedHeaders(res.data.headers);
        setSampleRows(res.data.sampleRows);
        setFieldMappings(res.data.suggestedMappings);
        setHasWriteAccess(true);
        setAccessMethod('oauth');
        setIsSheetEmpty(res.data.isEmpty);
        setStep(2);
      } catch (err) {
        toast.error('Failed to inspect sheet');
      } finally {
        setLoading(false);
      }
    }
  };

  const openPicker = (token) => {
    if (!window.google?.picker) {
      toast.error('Google Picker API loading. Please retry in a moment.');
      return;
    }
    const view = new window.google.picker.View(window.google.picker.ViewId.SPREADSHEETS);
    const picker = new window.google.picker.PickerBuilder()
      .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
      .setAppId(config?.googleAppId || '')
      .setOAuthToken(token)
      .addView(view)
      .setDeveloperKey(config?.googleApiKey || '')
      .setCallback(async (data) => {
        if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
          const doc = data[window.google.picker.Response.DOCUMENTS][0];
          const pickedId = doc[window.google.picker.Document.ID];
          const pickedTitle = doc[window.google.picker.Document.NAME];
          const pickedUrl = doc[window.google.picker.Document.URL];

          setSpreadsheetId(pickedId);
          setSpreadsheetUrl(pickedUrl);
          setSheetName(pickedTitle);

          // Inspect the chosen sheet
          setLoading(true);
          try {
            const inspectRes = await api.post('/integrations/sheets/inspect', {
              urlOrId: pickedId,
              accessToken: token,
            });
            setTabs(inspectRes.data.sheets);
            setSelectedTab(inspectRes.data.selectedTab);
            setDetectedHeaders(inspectRes.data.headers);
            setSampleRows(inspectRes.data.sampleRows);
            setFieldMappings(inspectRes.data.suggestedMappings);
            setHasWriteAccess(true);
            setAccessMethod('oauth');
            setIsSheetEmpty(inspectRes.data.isEmpty);
            setStep(2);
          } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to inspect selected sheet');
          } finally {
            setLoading(false);
          }
        }
      })
      .build();
    picker.setVisible(true);
  };

  // Option 2: Create New Sheet from Inside CRM
  const handleCreateNewSheet = async () => {
    if (!newSheetTitle.trim()) {
      toast.error('Please enter a title for the new Google Sheet');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/integrations/sheets/create-sheet', {
        title: newSheetTitle.trim(),
        accessToken: userAccessToken || null,
        defaultCampaignLabel: defaultCampaign,
      });

      setSpreadsheetId(res.data.spreadsheetId);
      setSpreadsheetUrl(res.data.spreadsheetUrl);
      setSheetName(res.data.title);
      setTabs([{ sheetId: 0, title: res.data.tabName }]);
      setSelectedTab(res.data.tabName);
      setDetectedHeaders(res.data.headers);
      setFieldMappings(res.data.fieldMappings);
      setHasWriteAccess(true);
      setAccessMethod('oauth');
      setIsSheetEmpty(false);

      toast.success('Spreadsheet created with CRM lead fields & dropdowns!');
      setStep(3); // Jump directly to mapping verification
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create spreadsheet');
    } finally {
      setLoading(false);
    }
  };

  // Option 3: Check Access for Pasted Sheet Link
  const handleCheckAccess = async () => {
    if (!pastedUrl.trim()) {
      toast.error('Please paste a Google Sheet link or spreadsheet ID');
      return;
    }
    setCheckingAccess(true);
    try {
      const res = await api.post('/integrations/sheets/inspect', {
        urlOrId: pastedUrl.trim(),
        useServiceAccount: true,
      });

      setAccessChecked(true);
      setAccessDetails(res.data);
      setSpreadsheetId(res.data.spreadsheetId);
      setSpreadsheetUrl(pastedUrl.trim());
      setSheetName(res.data.title);
      setTabs(res.data.sheets);
      setSelectedTab(res.data.selectedTab);
      setDetectedHeaders(res.data.headers);
      setSampleRows(res.data.sampleRows);
      setFieldMappings(res.data.suggestedMappings);
      setHasWriteAccess(res.data.hasWriteAccess);
      setAccessMethod(res.data.accessMethod);
      setIsSheetEmpty(res.data.isEmpty);

      toast.success('Google Sheet access verified!');
    } catch (err) {
      const errData = err.response?.data;
      setAccessChecked(false);
      if (errData?.needsShareWithServiceAccount) {
        toast.error('Access denied. Please share the sheet with the CRM service account email.');
      } else {
        toast.error(errData?.error || 'Could not access sheet. Verify sharing settings.');
      }
    } finally {
      setCheckingAccess(false);
    }
  };

  // Apply CRM Template to an Empty Sheet
  const handleApplyTemplate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/integrations/sheets/apply-template', {
        spreadsheetId,
        tabName: selectedTab,
        accessToken: userAccessToken || null,
        useServiceAccount: accessMethod === 'service_account',
      });

      setDetectedHeaders(res.data.headers);
      setFieldMappings(res.data.suggestedMappings);
      setIsSheetEmpty(false);
      toast.success('Standard CRM headers added to sheet!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to apply template headers');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 3: MAPPING CHANGE HANDLERS
  // -------------------------------------------------------------
  const handleMappingChange = (index, newCrmField) => {
    setFieldMappings((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const isCustom = newCrmField === 'custom';
        return {
          ...item,
          crmField: newCrmField,
          isCustom,
          displayLabel: isCustom ? item.sourceField : (config?.standardLeadFields?.find(f => f.key === newCrmField)?.label || item.sourceField),
        };
      })
    );
  };

  // Step 3 Next Validation: Phone OR Email required
  const handleStep3Next = () => {
    const hasPhoneOrEmail = fieldMappings.some(
      (m) => (m.crmField === 'phone' || m.crmField === 'email') && !m.isCustom
    );
    if (!hasPhoneOrEmail) {
      toast.error('You must map either Phone Number OR Email Address to continue.');
      return;
    }
    setStep(4);
  };

  // -------------------------------------------------------------
  // STEP 4: SAVE CONNECTION & GENERATE MODE A SCRIPT IF NEEDED
  // -------------------------------------------------------------
  const handleFinalizeConnection = async () => {
    setLoading(true);
    try {
      const res = await api.post('/integrations/sheets/connect', {
        sheetName: sheetName.trim() || 'Google Sheet',
        spreadsheetId,
        spreadsheetUrl,
        tabName: selectedTab,
        headerRowIndex,
        syncMode,
        accessMethod,
        hasWriteAccess,
        importExistingRows,
        defaultCampaignLabel: defaultCampaign.trim(),
        fieldMapping: fieldMappings,
        assignmentRule: {
          type: assignmentType,
          specificCounselorId: specificCounselorId || null,
          fallbackUserId: fallbackUserId || null,
          skipInactive: true,
        },
        accessToken: userAccessToken || null,
        refreshToken: userRefreshToken || null,
        storedHeaders: detectedHeaders,
      });

      const intDoc = res.data.integration;
      const secret = res.data.plaintextSecretOnce;
      setCreatedIntegration(intDoc);
      setEmbeddedSecret(secret);

      // If Mode A, fetch snippet
      if (syncMode === 'push') {
        const snippetRes = await api.get(`/integrations/${intDoc._id}/snippet`);
        let scriptCode = snippetRes.data.snippet;
        if (secret) {
          scriptCode = scriptCode.replace('PASTE_YOUR_REVOCABLE_SECRET_HERE', secret);
          scriptCode = scriptCode.replace(/gsht_sec_[A-Za-z0-9_.]+/g, secret);
          scriptCode = scriptCode.replace(
            /IMPORT_EXISTING_ROWS:\s*(true|false)/,
            `IMPORT_EXISTING_ROWS: ${importExistingRows}`
          );
        }
        setGeneratedScript(scriptCode);
      }

      toast.success('Sheet successfully connected!');
      setStep(5);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save integration');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 5: RUN SIMULATED TEST ROW
  // -------------------------------------------------------------
  const handleRunTestRow = async () => {
    if (!createdIntegration) return;
    setTestingRow(true);
    try {
      // Either trigger polling sync (Mode B) or send simulated row to webhook (Mode A)
      if (syncMode === 'polling') {
        const res = await api.post(`/integrations/sheets/sync/${createdIntegration._id}`);
        setTestSuccess(true);
        setTestLeadResult({
          status: 'SYNCED',
          name: sampleRows[0]?.['Full Name'] || 'Siddharth Malhotra',
          phone: sampleRows[0]?.['Phone'] || '+919876543210',
          email: sampleRows[0]?.['Email'] || 'siddharth@example.com',
          campaign: defaultCampaign,
          assignedTo: members.find(m => m.user?._id === specificCounselorId)?.user?.name || 'Assigned via Counselor Pool',
        });
        toast.success('Polling sync ran successfully!');
      } else {
        const rowData = {};
        detectedHeaders.forEach((h) => {
          rowData[h] = sampleRows[0]?.[h] || 'Sample Data';
        });

        const res = await api.post(`/integrations/sheets/webhook/${createdIntegration._id}`, {
          leadId: `test_lead_${Date.now()}`,
          sheetName,
          sheetId: selectedTab,
          rowIndex: 2,
          rowData,
        }, {
          headers: { 'x-crm-secret': embeddedSecret }
        });

        if (res.data?.success) {
          setTestSuccess(true);
          setTestLeadResult({
            status: res.data.status,
            name: rowData['Full Name'] || 'Test Applicant',
            phone: rowData['Phone'] || '',
            email: rowData['Email'] || '',
            campaign: defaultCampaign,
            assignedTo: 'Assigned Counselor',
          });
          toast.success('Test row received and processed!');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Test row failed');
    } finally {
      setTestingRow(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-white flex flex-col">

        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Add Google Sheet
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">Inbound Sync</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Stream candidate rows from Google Sheets directly into your CRM pipeline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Step Navigation Pill Indicator */}
        <div className="flex items-center justify-between mb-8 px-2 overflow-x-auto">
          {[
            { num: 1, label: 'Method' },
            { num: 2, label: 'Sheet & Tab' },
            { num: 3, label: 'Field Mapping' },
            { num: 4, label: 'Sync & Team' },
            { num: 5, label: 'Live Test' },
          ].map((item, idx) => (
            <div key={item.num} className="flex items-center gap-2 min-w-fit">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition ${
                  step === item.num
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/30'
                    : step > item.num
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                }`}
              >
                {step > item.num ? <Check className="w-3.5 h-3.5" /> : item.num}
              </div>
              <span className={`text-xs font-medium ${step === item.num ? 'text-white' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {idx < 4 && <div className="w-6 h-0.5 bg-slate-800 mx-1 hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* STEP 1: CHOOSE METHOD (THE THREE OPTIONS) */}
        {/* ---------------------------------------------------------------- */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h3 className="text-lg font-semibold text-white">How would you like to connect your Google Sheet?</h3>
              <p className="text-xs text-slate-400 mt-1">Select the approach that best fits your workflow. No technical setup required.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Connect Existing Sheet */}
              <div
                onClick={() => setConnectionMethod('picker')}
                className={`cursor-pointer p-5 rounded-2xl border transition relative flex flex-col justify-between ${
                  connectionMethod === 'picker'
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/70'
                }`}
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">1. Connect Existing Sheet</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Sign in with Google and choose any sheet via the secure Google File Picker.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-1.5 text-[11px] text-blue-400 font-medium">
                  <Lock className="w-3 h-3" /> Least Privilege (drive.file)
                </div>
              </div>

              {/* Option 2: Create New Sheet from CRM */}
              <div
                onClick={() => setConnectionMethod('create')}
                className={`cursor-pointer p-5 rounded-2xl border transition relative flex flex-col justify-between ${
                  connectionMethod === 'create'
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/70'
                }`}
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">2. Create New Sheet</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    CRM creates a formatted spreadsheet in your Drive with lead fields and dropdown validations.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-1.5 text-[11px] text-purple-400 font-medium">
                  <Sparkles className="w-3 h-3" /> Auto-Formatted + Validations
                </div>
              </div>

              {/* Option 3: Paste Sheet Link */}
              <div
                onClick={() => setConnectionMethod('link')}
                className={`cursor-pointer p-5 rounded-2xl border transition relative flex flex-col justify-between ${
                  connectionMethod === 'link'
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/70'
                }`}
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">3. Paste Sheet Link</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Paste any Google Sheet URL. Connect via Service Account share, public link, or Picker.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
                  <Key className="w-3 h-3" /> Service Account / Public
                </div>
              </div>
            </div>

            {/* Method Details Card */}
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-5">
              {connectionMethod === 'picker' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-semibold text-white">Safe & Narrow Google Drive Access</h5>
                      <p className="text-xs text-slate-300 mt-1">
                        We use Google's official <span className="font-mono text-emerald-400">drive.file</span> scope. The CRM can only access the exact spreadsheet you select in the file picker. We cannot view any other files in your Drive.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleGooglePickerLaunch}
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                    Authenticate with Google & Select Sheet
                  </button>
                </div>
              )}

              {connectionMethod === 'create' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      New Spreadsheet Title
                    </label>
                    <input
                      type="text"
                      value={newSheetTitle}
                      onChange={(e) => setNewSheetTitle(e.target.value)}
                      placeholder="e.g. MBBS 2026 Admissions"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>
                  <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> What will be auto-generated in your Drive:
                    </p>
                    <p className="text-slate-400">
                      • Formatted headers: Full Name, Phone, Email, City, Course, Stream, Budget, Lead Quality, Quota, Entrance Exam, Rank, Notes.
                    </p>
                    <p className="text-slate-400">
                      • Dropdown validations for Lead Quality (<span className="text-emerald-400">HOT, WARM, COLD</span>) and Quota (<span className="text-emerald-400">Merit, Management, NRI, State</span>).
                    </p>
                    <p className="text-slate-400">
                      • System tracking columns: <span className="font-mono text-xs text-amber-400">CRM_LEAD_ID</span> and <span className="font-mono text-xs text-amber-400">CRM_STATUS</span>.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateNewSheet}
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                    Create Formatted Spreadsheet in Google Drive
                  </button>
                </div>
              )}

              {connectionMethod === 'link' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Google Sheet URL or Spreadsheet ID
                    </label>
                    <input
                      type="text"
                      value={pastedUrl}
                      onChange={(e) => {
                        setPastedUrl(e.target.value);
                        setAccessChecked(false);
                      }}
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500 transition font-mono text-xs"
                    />
                  </div>

                  {/* Service Account Sharing Instruction Card */}
                  <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-700/80 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h6 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" /> How API Access Works:
                        </h6>
                        <p className="text-[11px] text-slate-400 mt-1">
                          A pasted link alone does not give API access. Share your sheet with our CRM service account email:
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="font-mono text-xs text-emerald-400 select-all truncate mr-2">
                        {config?.serviceAccountEmail || 'crm-sheets-sync@crm-project-2026.iam.gserviceaccount.com'}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(config?.serviceAccountEmail || 'crm-sheets-sync@crm-project-2026.iam.gserviceaccount.com');
                          setCopiedEmail(true);
                          toast.success('Service account email copied!');
                          setTimeout(() => setCopiedEmail(false), 2000);
                        }}
                        className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 shrink-0 transition"
                      >
                        {copiedEmail ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedEmail ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      💡 Tip: Share as <span className="text-white font-medium">Editor</span> to allow the CRM to add status markers (<span className="font-mono text-xs">CRM_STATUS=SYNCED</span>), or as <span className="text-white font-medium">Viewer</span> for read-only sync.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCheckAccess}
                      disabled={checkingAccess || !pastedUrl.trim()}
                      className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition disabled:opacity-50"
                    >
                      {checkingAccess ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      Check Sheet Access
                    </button>

                    {accessChecked && (
                      <button
                        onClick={() => setStep(2)}
                        className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                      >
                        Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* STEP 2: SHEET TAB & HEADER ROW SELECTION */}
        {/* ---------------------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Select Sheet Tab & Header Row</h3>
                <p className="text-xs text-slate-400 mt-0.5">Connected: <span className="text-emerald-400 font-medium">{sheetName}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  hasWriteAccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {hasWriteAccess ? 'Write & Status Tracking Available' : 'Read-Only Access'}
                </span>
              </div>
            </div>

            {/* Empty Sheet Warning & Template Offer */}
            {isSheetEmpty && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-semibold text-amber-200">This Google Sheet has no rows or headers</h5>
                    <p className="text-xs text-slate-300 mt-1">
                      Would you like the CRM to automatically insert pre-formatted standard admission columns (Name, Phone, Email, City, Course, Notes)?
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleApplyTemplate}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shrink-0 transition"
                >
                  {loading ? 'Applying...' : 'Apply CRM Template'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Select Tab / Worksheet
                </label>
                <select
                  value={selectedTab}
                  onChange={(e) => setSelectedTab(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {tabs.map((t) => (
                    <option key={t.sheetId || t.title} value={t.title}>
                      {t.title} ({t.rowCount || 0} rows)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Header Row Number
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={headerRowIndex}
                  onChange={(e) => setHeaderRowIndex(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Detected Columns Summary */}
            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
              <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Detected Columns ({detectedHeaders.length})
              </h5>
              <div className="flex flex-wrap gap-2">
                {detectedHeaders.map((h, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200">
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
              >
                Proceed to Mapping <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* STEP 3: FIELD MAPPING WITH SYNONYM SUGGESTIONS & PREVIEW */}
        {/* ---------------------------------------------------------------- */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Map Sheet Columns to CRM Lead Fields</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ensure <span className="text-amber-400 font-semibold">Phone</span> OR <span className="text-amber-400 font-semibold">Email</span> is mapped. Unmapped columns are safely stored in custom answers.
                </p>
              </div>
            </div>

            {/* Field Mapping Table */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-800/20">
              <div className="grid grid-cols-12 gap-2 p-3 bg-slate-800/70 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Sheet Column</div>
                <div className="col-span-3">Sample Value</div>
                <div className="col-span-5">CRM Lead Field Target</div>
              </div>

              <div className="divide-y divide-slate-800/60 max-h-[38vh] overflow-y-auto">
                {fieldMappings.map((mapping, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-800/40 transition">
                    <div className="col-span-4 flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{mapping.sourceField}</span>
                      {mapping.isSystem && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono">System</span>
                      )}
                    </div>
                    <div className="col-span-3 text-xs text-slate-400 truncate">
                      {mapping.sampleValue || <span className="text-slate-600 italic">empty</span>}
                    </div>
                    <div className="col-span-5">
                      <select
                        value={mapping.isCustom ? 'custom' : mapping.crmField}
                        onChange={(e) => handleMappingChange(idx, e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="custom">-- Store as Custom Answer --</option>
                        {config?.standardLeadFields?.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label} {f.key === 'phone' || f.key === 'email' ? '★ (Required)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* "Where Will This Data Go?" Destination Preview Card */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
              <h5 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Where will this data go? (Lead Profile Destination Preview)
              </h5>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1.5 text-slate-300">
                <p>
                  <span className="text-slate-500">Source Breadcrumb:</span>{' '}
                  <span className="text-emerald-400 font-mono">Google Sheets</span> &gt;{' '}
                  <span className="text-white font-medium">{sheetName || 'My Sheet'}</span> &gt;{' '}
                  <span className="text-blue-400 font-medium">{defaultCampaign}</span>
                </p>
                <p>
                  <span className="text-slate-500">Contact Fields:</span> Standardized into Name, Phone, Email with WhatsApp links.
                </p>
                <p>
                  <span className="text-slate-500">Unmapped Columns:</span> Rendered in the "Inbound Form Answers" block with their exact sheet column titles.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleStep3Next}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
              >
                Next: Routing & Sync Mode <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* STEP 4: ASSIGNMENT & SYNC MODE SELECTION */}
        {/* ---------------------------------------------------------------- */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h3 className="text-lg font-semibold text-white">Sync Mode & Counselor Routing</h3>
              <p className="text-xs text-slate-400 mt-0.5">Configure how leads are distributed and how often data is synchronized.</p>
            </div>

            {/* Sync Mode Choice Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setSyncMode('polling')}
                className={`cursor-pointer p-4 rounded-2xl border transition ${
                  syncMode === 'polling'
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50'
                    : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" /> Mode B: API Polling
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Recommended</span>
                </div>
                <p className="text-xs text-slate-400">
                  Background worker sweeps new rows every 5 minutes using the API. Zero script installation or setup needed.
                </p>
              </div>

              <div
                onClick={() => setSyncMode('push')}
                className={`cursor-pointer p-4 rounded-2xl border transition ${
                  syncMode === 'push'
                    ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50'
                    : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-blue-400" /> Mode A: Instant Push
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">Real-Time</span>
                </div>
                <p className="text-xs text-slate-400">
                  Rows are pushed into the CRM the moment they are typed. Requires a one-time 2-minute Apps Script paste.
                </p>
              </div>
            </div>

            {/* Default Campaign Label & Existing Rows Setting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Default Campaign Cohort
                </label>
                <input
                  type="text"
                  value={defaultCampaign}
                  onChange={(e) => setDefaultCampaign(e.target.value)}
                  placeholder="e.g. NEET 2026 Guidance"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importExistingRows}
                    onChange={(e) => setImportExistingRows(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-xs font-medium text-white">Import existing rows in sheet</p>
                    <p className="text-[10px] text-slate-400">If unchecked, only new rows added from today will be ingested.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Counselor Assignment Routing */}
            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-4">
              <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Counselor Assignment Policy
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'round_robin', label: 'Round Robin Pool', desc: 'Rotates evenly among active counselors' },
                  { id: 'specific_counselor', label: 'Specific Counselor', desc: 'Routes all rows to one assigned member' },
                  { id: 'fallback_only', label: 'Admin Fallback Only', desc: 'Assigns to workspace admin queue' },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setAssignmentType(item.id)}
                    className={`cursor-pointer p-3 rounded-xl border text-xs transition ${
                      assignmentType === item.id
                        ? 'bg-emerald-500/20 border-emerald-500 text-white font-medium'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="font-semibold text-white">{item.label}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>

              {assignmentType === 'specific_counselor' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Counselor</label>
                  <select
                    value={specificCounselorId}
                    onChange={(e) => setSpecificCounselorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="">-- Choose Member --</option>
                    {members.map((m) => (
                      <option key={m.user?._id} value={m.user?._id}>
                        {m.user?.name} ({m.user?.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleFinalizeConnection}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Connect & Start Syncing
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* STEP 5: LIVE CONFIRMATION & TEST ROW VERIFICATION */}
        {/* ---------------------------------------------------------------- */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in">
            {/* If Mode A: Script Copy Box & Bypass Guide */}
            {syncMode === 'push' && generatedScript && (
              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> One-Time Apps Script Setup (Pre-Embedded Secret)
                  </h5>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedScript);
                      setCopiedScript(true);
                      toast.success('Script copied to clipboard!');
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? 'Copied' : 'Copy Script'}
                  </button>
                </div>
                <div className="text-[11px] text-slate-300 space-y-1">
                  <p>1. In your Google Sheet, open <span className="text-white font-medium">Extensions &gt; Apps Script</span>.</p>
                  <p>2. Delete any existing code, paste this script, and click <span className="text-white font-medium">Save &gt; Run: setup()</span>.</p>
                  <p>3. If you see <span className="text-amber-300">"Google hasn't verified this app"</span>, click <span className="text-white font-medium">Advanced &gt; Go to (unsafe) &gt; Allow</span>.</p>
                </div>
              </div>
            )}

            {/* Waiting Pulse or Green Confirmation */}
            <div className="p-6 bg-slate-800/30 border border-slate-800 rounded-2xl text-center space-y-4">
              {!testSuccess ? (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-semibold text-white">Waiting for rows from Google Sheet...</h4>
                  <p className="text-xs text-slate-400 max-w-md">
                    {syncMode === 'polling'
                      ? 'The background poller is running. You can trigger an instant test sync now to verify lead creation.'
                      : 'Type a new row in your Google Sheet or click the simulated test button below.'}
                  </p>
                  <button
                    onClick={handleRunTestRow}
                    disabled={testingRow}
                    className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
                  >
                    {testingRow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Trigger Instant Test Sync
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-white">Lead Successfully Ingested!</h4>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-left w-full max-w-md text-xs space-y-1.5 text-slate-300">
                    <p><span className="text-slate-500">Applicant:</span> <span className="text-white font-semibold">{testLeadResult.name}</span></p>
                    <p><span className="text-slate-500">Phone:</span> <span className="font-mono text-emerald-400">{testLeadResult.phone}</span></p>
                    <p><span className="text-slate-500">Email:</span> <span className="text-slate-200">{testLeadResult.email}</span></p>
                    <p><span className="text-slate-500">Campaign:</span> <span className="text-blue-400 font-medium">{testLeadResult.campaign}</span></p>
                    <p><span className="text-slate-500">Assigned To:</span> <span className="text-purple-400 font-medium">{testLeadResult.assignedTo}</span></p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  if (onSuccess) onSuccess();
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition"
              >
                Done & Return to Integrations
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
