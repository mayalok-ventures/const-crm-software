'use client';

import { useState } from 'react';
import Image from 'next/image';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Smartphone, Shield, Users, UserCheck, CheckCircle2, RefreshCw, AlertTriangle,
  X, Copy, Check, ExternalLink, HelpCircle, Layers, Lock, Sliders
} from 'lucide-react';

const COUNTRIES = [
  { code: 'IN', name: '🇮🇳 India (+91)', prefix: '91', digits: 10 },
  { code: 'US', name: '🇺🇸 US/Canada (+1)', prefix: '1', digits: 10 },
  { code: 'GB', name: '🇬🇧 United Kingdom (+44)', prefix: '44', digits: 10 },
  { code: 'AE', name: '🇦🇪 UAE (+971)', prefix: '971', digits: 9 },
  { code: 'SA', name: '🇸🇦 Saudi Arabia (+966)', prefix: '966', digits: 9 },
  { code: 'OTHER', name: '🌐 Other (Custom prefix)', prefix: '', digits: null }
];

export default function WhatsAppConnectionModal({
  isOpen,
  onClose,
  baileysStatus,
  baileysLoading,
  pairingCode,
  qrDataUrl,
  pairingTab,
  setPairingTab,
  selectedCountry,
  setSelectedCountry,
  localNumber,
  setLocalNumber,
  customPrefix,
  setCustomPrefix,
  handleBaileysConnect,
  handleBaileysDisconnect,
  metaAccount,
  metaConfigStatus,
  metaLoading,
  canManageIntegrations,
  onOpenMetaModal,
  handleMetaDisconnect,
  fetchTemplates,
  copyText
}) {
  const [modalTab, setModalTab] = useState('baileys');
  const [waAccounts, setWaAccounts] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [savingAccountId, setSavingAccountId] = useState(null);

  const fetchAccountsAndMembers = async () => {
    setLoadingAssignments(true);
    try {
      const [accRes, memRes] = await Promise.all([
        api.get('/whatsapp/accounts').catch(() => ({ data: { accounts: [] } })),
        api.get('/workspace/members').catch(() => ({ data: { data: [] } })),
      ]);
      setWaAccounts(accRes.data?.accounts || []);
      setMembersList(memRes.data?.data || []);
    } catch (err) {
      console.error('fetchAccountsAndMembers error:', err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleToggleGlobal = (accId, currentGlobal) => {
    setWaAccounts(prev => prev.map(a => a._id === accId ? { ...a, isGlobal: !currentGlobal } : a));
  };

  const handleToggleUserAssignment = (accId, userId) => {
    setWaAccounts(prev => prev.map(a => {
      if (a._id !== accId) return a;
      const assigned = Array.isArray(a.assignedUserIds) ? a.assignedUserIds.map(u => u._id || u) : [];
      const hasUser = assigned.some(id => String(id) === String(userId));
      const newIds = hasUser ? assigned.filter(id => String(id) !== String(userId)) : [...assigned, userId];
      return { ...a, assignedUserIds: newIds };
    }));
  };

  const handleSaveAssignments = async (acc) => {
    setSavingAccountId(acc._id);
    try {
      const userIds = Array.isArray(acc.assignedUserIds) ? acc.assignedUserIds.map(u => u._id || u) : [];
      await api.put(`/whatsapp/accounts/${acc._id}/assign`, {
        isGlobal: Boolean(acc.isGlobal),
        assignedUserIds: userIds,
      });
      toast.success(`Access settings saved for ${acc.name || acc.phoneNumber}`);
      fetchAccountsAndMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save assignments');
    } finally {
      setSavingAccountId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold shadow-2xs">
              <Smartphone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                WhatsApp Connection &amp; Device Settings
              </h2>
              <p className="text-xs text-slate-500">
                Link your WhatsApp phone directly or connect official Meta Cloud API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Close Settings (Return to Chats)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Tabs */}
        <div className="px-5 pt-2 border-b border-slate-200 flex items-center gap-2 bg-slate-50/70 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setModalTab('baileys')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              modalTab === 'baileys'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Method A: Phone Session (QR / Code)</span>
            {baileysStatus?.status === 'connected' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
            )}
          </button>

          <button
            onClick={() => setModalTab('meta')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              modalTab === 'meta'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Method B: Official Meta Cloud API</span>
            {metaAccount?.status === 'CONNECTED' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
            )}
          </button>

          <button
            onClick={() => {
              setModalTab('assignments');
              fetchAccountsAndMembers();
            }}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              modalTab === 'assignments'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Teammate Lines &amp; Access</span>
          </button>

          <button
            onClick={() => setModalTab('capabilities')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              modalTab === 'capabilities'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Capability Matrix &amp; Permissions</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* ────────────────────────────────────────────────────────────── */}
          {/* TAB 1: METHOD A (BAILEYS PHONE CONNECTION)                     */}
          {/* ────────────────────────────────────────────────────────────── */}
          {modalTab === 'baileys' && (
            <div className="space-y-6">
              {/* Header Status Row */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Direct Physical WhatsApp Phone</h3>
                    <p className="text-[11px] text-slate-500">Multi-Device WebSockets Engine (Baileys)</p>
                  </div>
                </div>

                <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto ${
                  baileysStatus?.status === 'connected'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : baileysStatus?.status === 'reconnecting' || baileysStatus?.status === 'degraded'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : baileysStatus?.status === 'connecting'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : baileysStatus?.status === 'auth_required'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    baileysStatus?.status === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : baileysStatus?.status === 'reconnecting' || baileysStatus?.status === 'connecting'
                      ? 'bg-amber-500 animate-spin'
                      : baileysStatus?.status === 'auth_required'
                      ? 'bg-rose-500'
                      : 'bg-slate-400'
                  }`} />
                  {baileysStatus?.status === 'connected'
                    ? `Connected (+${baileysStatus.phone || 'Active'})`
                    : baileysStatus?.status === 'reconnecting'
                    ? 'Reconnecting...'
                    : baileysStatus?.status === 'connecting'
                    ? 'Connecting...'
                    : baileysStatus?.status === 'degraded'
                    ? 'Degraded'
                    : baileysStatus?.status === 'auth_required'
                    ? 'Phone Unlinked (Pairing Required)'
                    : 'Disconnected'}
                </span>
              </div>

              {/* Status Alert Banners */}
              {(baileysStatus?.status === 'reconnecting' || baileysStatus?.status === 'degraded') && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Automatic Background Recovery Active</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Connection dropped ({baileysStatus.lastDisconnectReason || 'network interruption'}). Bounded exponential backoff is actively retrying in background.
                  </p>
                </div>
              )}

              {baileysStatus?.status === 'auth_required' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Action Required: Phone Unlinked</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    WhatsApp Web session was logged out or unlinked. Generate a new pairing code or scan QR below to re-link.
                  </p>
                </div>
              )}

              {/* Connected Active Card */}
              {baileysStatus?.status === 'connected' ? (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px]">Connected Phone:</span>
                      <p className="font-mono font-bold text-slate-900 mt-0.5">+{baileysStatus.phone}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px]">Session Security:</span>
                      <p className="font-semibold text-slate-800 mt-0.5">Multi-Device WebSockets</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px]">Socket Health:</span>
                      <p className="font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Synchronized &amp; Active
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-500">
                      Your phone is ready. All incoming and outgoing chats will update in real-time.
                    </p>
                    <button
                      onClick={handleBaileysDisconnect}
                      disabled={baileysLoading}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                    >
                      {baileysLoading ? 'Disconnecting...' : 'Disconnect Phone'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Disconnected Setup Card */
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                    <button
                      onClick={() => setPairingTab('code')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                        pairingTab === 'code' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      📲 8-Digit Pairing Code (Recommended)
                    </button>
                    <button
                      onClick={() => setPairingTab('qr')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                        pairingTab === 'qr' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      📷 Scan QR Code
                    </button>
                  </div>

                  {pairingTab === 'code' ? (
                    <div className="space-y-4">
                      <form onSubmit={handleBaileysConnect} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">Country Code</label>
                            <select
                              value={selectedCountry}
                              onChange={(e) => setSelectedCountry(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              {COUNTRIES.map(c => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {selectedCountry === 'OTHER' && (
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600">Custom Prefix</label>
                              <input
                                type="text"
                                placeholder="e.g. 61"
                                value={customPrefix}
                                onChange={(e) => setCustomPrefix(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900"
                              />
                            </div>
                          )}

                          <div className={`space-y-1 ${selectedCountry === 'OTHER' ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
                            <label className="text-[11px] font-semibold text-slate-600">WhatsApp Mobile Number</label>
                            <input
                              type="tel"
                              placeholder="10-digit mobile number"
                              value={localNumber}
                              onChange={(e) => setLocalNumber(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={baileysLoading || !localNumber.trim()}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          {baileysLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Generating 8-Digit Pairing Code...
                            </>
                          ) : (
                            'Get 8-Digit Pairing Code 📲'
                          )}
                        </button>
                      </form>

                      {pairingCode && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3 animate-fade-in">
                          <p className="text-xs font-semibold text-emerald-900">
                            Enter this code on your phone in WhatsApp:
                          </p>
                          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-emerald-300 shadow-sm">
                            <span className="font-mono text-2xl font-black tracking-widest text-emerald-700">
                              {pairingCode}
                            </span>
                            <button
                              onClick={() => copyText(pairingCode)}
                              className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition"
                              title="Copy Pairing Code"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-left text-xs text-slate-600 space-y-1 bg-white/70 p-3 rounded-xl border border-emerald-100">
                            <p className="font-bold text-slate-800">How to enter code:</p>
                            <p>1. Open WhatsApp on your phone</p>
                            <p>2. Tap <strong>Linked Devices &gt; Link a Device</strong></p>
                            <p>3. Tap <strong>Link with phone number instead</strong> at the bottom</p>
                            <p>4. Enter the 8-digit code displayed above</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* QR Code Tab */
                    <div className="text-center py-4 space-y-3">
                      {qrDataUrl ? (
                        <div className="inline-block p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                          <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-56 h-56 mx-auto" />
                          <p className="text-xs text-slate-500 mt-2">
                            Scan with WhatsApp &gt; Linked Devices
                          </p>
                        </div>
                      ) : (
                        <div className="py-10 text-xs text-slate-400 space-y-2">
                          <Smartphone className="w-8 h-8 mx-auto text-slate-300" />
                          <p>Submit phone number or wait for automatic QR generation.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* TAB 2: METHOD B (OFFICIAL META CLOUD API)                      */}
          {/* ────────────────────────────────────────────────────────────── */}
          {modalTab === 'meta' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Official WhatsApp Business Platform</h3>
                    <p className="text-[11px] text-slate-500">Official Meta Cloud API (WABA)</p>
                  </div>
                </div>

                <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto ${
                  metaAccount?.status === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    metaAccount?.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`} />
                  {metaAccount?.status === 'CONNECTED' ? 'Enterprise Active' : 'Not Configured'}
                </span>
              </div>

              {metaAccount ? (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px]">Display Phone:</span>
                      <p className="font-mono font-bold text-slate-900 mt-0.5">{metaAccount.displayPhoneNumber}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px]">Verified Name:</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{metaAccount.verifiedName || 'Business Account'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px]">Quality Rating:</span>
                      <p className="font-semibold text-emerald-600 mt-0.5">{metaAccount.qualityRating || 'GREEN'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {canManageIntegrations && (
                      <button
                        onClick={onOpenMetaModal}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs"
                      >
                        Update Meta Credentials
                      </button>
                    )}
                    <button
                      onClick={fetchTemplates}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                    >
                      Sync Templates
                    </button>
                    {canManageIntegrations && (
                      <button
                        onClick={handleMetaDisconnect}
                        disabled={metaLoading}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition ml-auto"
                      >
                        Disconnect Meta WABA
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-3">
                  <Shield className="w-10 h-10 text-indigo-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Connect Official WhatsApp Business Platform
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Directly integrated with Meta Graph API v21.0. Allows high-volume broadcast campaigns and verified green-tick messaging with zero device dependency.
                  </p>
                  {canManageIntegrations ? (
                    <button
                      onClick={onOpenMetaModal}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs transition"
                    >
                      Configure Meta API Credentials
                    </button>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl inline-block">
                      Only organization administrators can configure Meta Cloud API.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* TAB 4: TEAMMATE LINES & ASSIGNMENTS                           */}
          {/* ────────────────────────────────────────────────────────────── */}
          {modalTab === 'assignments' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-purple-950 m-0 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Centralized Multi-Account Assignment</span>
                  </h4>
                  <p className="text-[11px] text-purple-800 m-0 mt-0.5">
                    Configure which counsellors can send messages from specific WhatsApp accounts. Global lines allow all teammates in the workspace to message candidates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchAccountsAndMembers}
                  className="p-1.5 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-100 transition shrink-0"
                  title="Refresh lines"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAssignments ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingAssignments && waAccounts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                  Loading connected phone lines...
                </div>
              ) : waAccounts.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  <p className="font-bold text-slate-700 m-0 mb-1">No Connected Lines Found</p>
                  <p className="m-0">Connect a phone via QR code (Method A) or configure Meta Cloud API (Method B) first to assign lines to counsellors.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {waAccounts.map((acc) => {
                    const assignedList = Array.isArray(acc.assignedUserIds) ? acc.assignedUserIds.map(u => u._id || u) : [];
                    const isSaving = savingAccountId === acc._id;

                    return (
                      <div key={acc._id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3.5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 font-bold text-xs">
                              WA
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                <span>{acc.name || `Line: +${acc.phoneNumber || 'Connected'}`}</span>
                                <span className="px-2 py-0.2 rounded-full text-[9.5px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                  {acc.type === 'cloud_api' ? 'Official Meta API' : 'Direct Device'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                +{acc.phoneNumber || 'Active Session'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleSaveAssignments(acc)}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                            >
                              {isSaving && <RefreshCw className="w-3 h-3 animate-spin" />}
                              <span>{isSaving ? 'Saving...' : 'Save Assignments'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Global Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Global Workspace Access</span>
                            <span className="text-[11px] text-slate-500 block">When active, any counsellor in the workspace can send from this phone number.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleGlobal(acc._id, acc.isGlobal)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                              acc.isGlobal ? 'bg-purple-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                acc.isGlobal ? 'translate-x-4' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Teammate Assignment Checkboxes (If not global) */}
                        {!acc.isGlobal && (
                          <div className="space-y-2 pt-1">
                            <span className="text-xs font-bold text-slate-700 block">
                              Assigned Counsellors &amp; Team Members:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                              {membersList.map((m) => {
                                const mId = m.userId?._id || m.userId || m._id;
                                const isAssigned = assignedList.some(id => String(id) === String(mId));

                                return (
                                  <label
                                    key={mId}
                                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                                      isAssigned
                                        ? 'border-purple-300 bg-purple-50/50 text-purple-950 font-bold'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={() => handleToggleUserAssignment(acc._id, mId)}
                                      className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                                    />
                                    <div className="truncate">
                                      <div className="truncate">{m.name || m.userId?.name || 'Unnamed'}</div>
                                      <div className="text-[10px] text-slate-400 truncate">{m.email || m.userId?.email}</div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* TAB 3: CAPABILITY MATRIX & RBAC                                */}
          {/* ────────────────────────────────────────────────────────────── */}
          {modalTab === 'capabilities' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-1">
                <p className="font-bold text-indigo-950">Transport Architecture Overview</p>
                <p className="text-slate-600">
                  Sahyak CRM automatically isolates Baileys session data from Meta Cloud API tokens, preventing cross-tenant data leakage.
                </p>
              </div>

              {/* RBAC Governance Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 font-semibold text-slate-900">Role Permission</th>
                      <th className="p-3 font-semibold text-emerald-600">Company Owner</th>
                      <th className="p-3 font-semibold text-indigo-600">Manager</th>
                      <th className="p-3 font-semibold text-slate-600">Counsellor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 font-medium">Link Phone Session (Baileys)</td>
                      <td className="p-3 text-emerald-600 font-bold">✓ Full Access</td>
                      <td className="p-3 text-slate-500">Requires Permission</td>
                      <td className="p-3 text-rose-500 font-medium">✕ Restricted</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Connect Meta Cloud API</td>
                      <td className="p-3 text-emerald-600 font-bold">✓ Full Access</td>
                      <td className="p-3 text-slate-500">Requires Permission</td>
                      <td className="p-3 text-rose-500 font-medium">✕ Restricted</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Chat 1-on-1 with Candidates</td>
                      <td className="p-3 text-emerald-600 font-bold">✓ Allowed</td>
                      <td className="p-3 text-indigo-600 font-bold">✓ Allowed</td>
                      <td className="p-3 text-slate-700 font-bold">✓ Assigned Leads</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Send Bulk Broadcasts</td>
                      <td className="p-3 text-emerald-600 font-bold">✓ Allowed</td>
                      <td className="p-3 text-indigo-600 font-bold">✓ Allowed</td>
                      <td className="p-3 text-rose-500 font-medium">✕ Restricted</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Current Active Engine: <strong>{baileysStatus?.status === 'connected' ? 'Method A (Phone Session)' : metaAccount ? 'Method B (Meta API)' : 'None'}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Back to Chats &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
