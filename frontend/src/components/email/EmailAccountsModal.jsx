'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X, Mail, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw,
  Plus, Server, Key, ExternalLink, Trash2, Globe, HelpCircle, Check,
  Users, UserCheck
} from 'lucide-react';
import { getUser, isOwner, hasPermission } from '@/lib/auth';

function GoogleIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export default function EmailAccountsModal({ isOpen, onClose, onAccountUpdated }) {
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' | 'smtp' | 'google' | 'microsoft'
  const [accounts, setAccounts] = useState([]);
  const [members, setMembers] = useState([]);
  const [configStatus, setConfigStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Assignment Modal State
  const [assigningAccount, setAssigningAccount] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isGlobalAccess, setIsGlobalAccess] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const currentUser = getUser();
  const canManageAccounts = isOwner(currentUser) || hasPermission(currentUser, 'email.manage_accounts');

  // SMTP Form State
  const [smtpForm, setSmtpForm] = useState({
    email: '',
    displayName: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    isShared: false,
  });

  const handleGoogleConnect = async () => {
    try {
      setSubmitting(true);
      const res = await api.get('/email/oauth/google/url');
      if (res.data?.url) {
        toast.loading('Redirecting to Google Account Authorization...');
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google OAuth not configured yet. Please check .env keys.');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accRes, cfgRes, memRes] = await Promise.all([
        api.get('/email/accounts').catch(() => ({ data: { accounts: [] } })),
        api.get('/email/config-status').catch(() => ({ data: {} })),
        api.get('/workspace/members').catch(() => ({ data: { members: [] } })),
      ]);
      setAccounts(accRes.data.accounts || []);
      setConfigStatus(cfgRes.data);
      setMembers(memRes.data.members || memRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load email configurations');
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (acc) => {
    setAssigningAccount(acc);
    setIsGlobalAccess(Boolean(acc.isGlobal));
    const assigned = Array.isArray(acc.assignedUserIds)
      ? acc.assignedUserIds.map(u => (typeof u === 'object' && u ? u._id : u))
      : [];
    setSelectedUserIds(assigned);
  };

  const handleToggleUser = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveAssignments = async () => {
    if (!assigningAccount) return;
    try {
      setSavingAssignments(true);
      await api.put(`/email/accounts/${assigningAccount._id}/assign`, {
        isGlobal: isGlobalAccess,
        assignedUserIds: selectedUserIds,
      });
      toast.success('Teammate mailbox assignments updated! 👥');
      setAssigningAccount(null);
      fetchData();
      if (onAccountUpdated) onAccountUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update assignments');
    } finally {
      setSavingAssignments(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleDisconnect = async (accountId) => {
    if (!confirm('Are you sure you want to disconnect this email account?')) return;
    try {
      await api.post('/email/accounts/disconnect', { accountId });
      toast.success('Account disconnected');
      fetchData();
      if (onAccountUpdated) onAccountUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect');
    }
  };

  const handleSmtpSubmit = async (e) => {
    e.preventDefault();
    if (!smtpForm.email || !smtpForm.smtpHost || !smtpForm.smtpPassword) {
      return toast.error('Please fill in Email, Host, and Password');
    }

    try {
      setSubmitting(true);
      const payload = {
        provider: 'smtp',
        email: smtpForm.email,
        displayName: smtpForm.displayName || smtpForm.email.split('@')[0],
        isShared: smtpForm.isShared,
        credentials: {
          smtpHost: smtpForm.smtpHost,
          smtpPort: Number(smtpForm.smtpPort),
          smtpSecure: Boolean(smtpForm.smtpSecure),
          smtpUser: smtpForm.smtpUser || smtpForm.email,
          smtpPassword: smtpForm.smtpPassword,
          imapHost: smtpForm.imapHost,
          imapPort: Number(smtpForm.imapPort),
          imapSecure: Boolean(smtpForm.imapSecure),
        },
      };

      await api.post('/email/accounts/connect', payload);
      toast.success('Email account connected successfully! 🚀');
      setActiveTab('accounts');
      fetchData();
      if (onAccountUpdated) onAccountUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect email account');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 m-0">Email Connections & Mailboxes</h3>
              <p className="text-xs text-slate-500 m-0">Connect Gmail, Microsoft 365, or standard SMTP/IMAP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 gap-2 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'accounts'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Connected Mailboxes ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('smtp')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'smtp'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server size={14} /> Connect Custom SMTP / Domain
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'google'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Google Workspace
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('microsoft')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'microsoft'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Microsoft 365
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw size={24} className="animate-spin mb-2" />
              <p className="text-xs">Loading mailboxes...</p>
            </div>
          ) : activeTab === 'accounts' ? (
            <div>
              {accounts.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                    <Mail size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">No Connected Email Accounts</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                    Connect your counselor or agency email to send course brochures, reply to student queries, and track conversation history.
                  </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    {canManageAccounts && (
                      <button
                        type="button"
                        onClick={handleGoogleConnect}
                        disabled={submitting}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                      >
                        {submitting ? <RefreshCw size={14} className="animate-spin text-blue-600" /> : <GoogleIcon className="w-4 h-4" />}
                        <span>Authorize Google Workspace</span>
                      </button>
                    )}
                    {canManageAccounts && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('smtp')}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                      >
                        <Server size={14} /> Custom SMTP / IMAP
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map(acc => (
                    <div
                      key={acc._id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm uppercase shrink-0">
                            {acc.provider === 'gmail' ? 'G' : acc.provider === 'outlook' ? 'MS' : 'SMTP'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-bold text-slate-900 truncate m-0">
                                {acc.displayName || acc.email}
                              </h4>
                              {acc.isShared && (
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                  Shared Mailbox
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  acc.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {acc.status === 'active' ? '● Active' : '⚠ Action Needed'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate m-0">{acc.email}</p>

                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {acc.isGlobal ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                                  <Globe size={11} /> Global Access (All Counsellors)
                                </span>
                              ) : acc.assignedUserIds?.length > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                  <Users size={11} /> {acc.assignedUserIds.length} Teammate(s) Assigned
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                                  Admin Only
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canManageAccounts && (
                            <button
                              type="button"
                              onClick={() => openAssignModal(acc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold transition cursor-pointer"
                              title="Assign teammates who can send from this mailbox"
                            >
                              <Users size={13} />
                              <span className="hidden sm:inline">Assign Teammates</span>
                            </button>
                          )}
                          {canManageAccounts && (
                            <button
                              onClick={() => handleDisconnect(acc._id)}
                              title="Disconnect account"
                              className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Teammate Assignment Panel */}
                      {assigningAccount?._id === acc._id && (
                        <div className="mt-3 pt-3 border-t border-slate-200 bg-slate-50/80 -mx-4 -mb-4 p-4 rounded-b-xl space-y-3 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users size={15} className="text-indigo-600" />
                              <h5 className="text-xs font-bold text-slate-800 m-0">
                                Teammate Permissions: {acc.email}
                              </h5>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAssigningAccount(null)}
                              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 cursor-pointer transition">
                            <input
                              type="checkbox"
                              checked={isGlobalAccess}
                              onChange={e => setIsGlobalAccess(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-800 m-0">Global Workspace Access</p>
                              <p className="text-[11px] text-slate-500 m-0">
                                When enabled, all counsellors and managers in the workspace can view and send from this company mailbox.
                              </p>
                            </div>
                          </label>

                          {!isGlobalAccess && (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-600 block">
                                Or select specific counsellors who can use this mailbox:
                              </label>
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                                {members.length === 0 ? (
                                  <p className="p-3 text-xs text-slate-400 text-center">No other workspace members found</p>
                                ) : (
                                  members.map(m => {
                                    const uId = m.userId || m._id;
                                    const isChecked = selectedUserIds.includes(uId);
                                    return (
                                      <label key={uId} className="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer transition">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleUser(uId)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                          />
                                          <div className="min-w-0">
                                            <p className="text-xs font-medium text-slate-800 truncate m-0">{m.name || m.email}</p>
                                            <p className="text-[10px] text-slate-400 truncate m-0">{m.email} • {m.role}</p>
                                          </div>
                                        </div>
                                        {isChecked && <UserCheck size={13} className="text-indigo-600 shrink-0" />}
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setAssigningAccount(null)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingAssignments}
                              onClick={handleSaveAssignments}
                              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              {savingAssignments ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                              <span>Save Teammate Access</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="pt-3">
                    <button
                      onClick={() => setActiveTab('smtp')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                    >
                      <Plus size={14} /> Add Another Email Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'smtp' ? (
            <form onSubmit={handleSmtpSubmit} className="space-y-4">
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
                <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">AES-256 Encrypted Connection:</span> All SMTP and IMAP credentials are encrypted with AES-256-GCM before database storage. Zero plain-text passwords.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="admissions@yourconsultancy.com"
                    value={smtpForm.email}
                    onChange={e => setSmtpForm({ ...smtpForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Admission Desk"
                    value={smtpForm.displayName}
                    onChange={e => setSmtpForm({ ...smtpForm, displayName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Host *</label>
                  <input
                    type="text"
                    required
                    placeholder="smtp.zoho.com or smtp.gmail.com"
                    value={smtpForm.smtpHost}
                    onChange={e => setSmtpForm({ ...smtpForm, smtpHost: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Port *</label>
                  <input
                    type="number"
                    required
                    value={smtpForm.smtpPort}
                    onChange={e => setSmtpForm({ ...smtpForm, smtpPort: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Username</label>
                  <input
                    type="text"
                    placeholder="Leave empty to use Email Address"
                    value={smtpForm.smtpUser}
                    onChange={e => setSmtpForm({ ...smtpForm, smtpUser: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password or App Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={smtpForm.smtpPassword}
                    onChange={e => setSmtpForm({ ...smtpForm, smtpPassword: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpForm.smtpSecure}
                    onChange={e => setSmtpForm({ ...smtpForm, smtpSecure: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>SSL / TLS (Port 465)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpForm.isShared}
                    onChange={e => setSmtpForm({ ...smtpForm, isShared: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Shared Team Mailbox (Visible to counselors)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <RefreshCw size={14} className="animate-spin" />}
                  Verify & Connect Mailbox
                </button>
              </div>
            </form>
          ) : activeTab === 'google' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center font-bold">
                    <GoogleIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 m-0">Google Workspace / Gmail API</h4>
                    <p className="text-[11px] text-slate-500 m-0">Official 1-Click OAuth 2.0 Integration</p>
                  </div>
                </div>

                <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ✓ Ready to Link
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/70 border border-blue-100 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center mb-3">
                  <GoogleIcon className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Authorize Organization Mailbox</h4>
                <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                  Authenticate official Google Workspace or Gmail mailbox via OAuth 2.0. Once linked, you can assign access to counsellors across your workspace.
                </p>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleConnect}
                  className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 border-2 border-slate-200 hover:border-slate-300 rounded-2xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-3 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw size={16} className="animate-spin text-blue-600" />
                  ) : (
                    <GoogleIcon className="w-4 h-4" />
                  )}
                  <span>Authorize Google Workspace Mailbox</span>
                </button>

                <p className="text-[11px] text-slate-400 mt-4 m-0">
                  🔒 Secure Google OAuth 2.0 • Read, send, and link emails to CRM leads
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-sky-600">
                    MS
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 m-0">Microsoft 365 / Outlook Graph API</h4>
                    <p className="text-[11px] text-slate-500 m-0">Microsoft Graph Mail integration</p>
                  </div>
                </div>

                <span
                  className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    configStatus?.microsoft?.configured
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {configStatus?.microsoft?.configured ? '✓ OAuth Keys Detected' : 'Configuration Required'}
                </span>
              </div>

              {!configStatus?.microsoft?.configured ? (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <span>Microsoft Entra ID (Azure AD) Credentials Setup Guide</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed m-0">
                    To authorize Microsoft 365 accounts, configure an application in Microsoft Entra Admin Center:
                  </p>
                  <ol className="text-xs text-amber-900 list-decimal list-inside space-y-1.5 pl-1">
                    <li>Register an application in <a href="https://portal.azure.com" target="_blank" rel="noreferrer" className="underline font-semibold">Azure Portal</a>.</li>
                    <li>Add API permissions: <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px]">Mail.ReadWrite</code>, <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px]">Mail.Send</code>, <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px]">offline_access</code>.</li>
                    <li>Add the following keys to your server <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">.env</code>:
                      <pre className="mt-1.5 p-2 bg-amber-100/80 rounded font-mono text-[11px] select-all">
MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-client-secret
MICROSOFT_TENANT_ID=common
                      </pre>
                    </li>
                  </ol>
                  <div className="pt-2">
                    <span className="text-xs text-slate-600">
                      💡 <em>Quick alternative:</em> Microsoft 365 / Outlook accounts can also be connected via standard SMTP (Host: <code className="font-mono">smtp.office365.com</code>, Port: 587) in the <strong>Custom SMTP</strong> tab!
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Microsoft Entra Credentials Configured</span>
                  </div>
                  <p className="m-0 mb-3 text-emerald-800">
                    Client ID: <code className="bg-emerald-100 px-1 rounded">{configStatus?.microsoft?.clientId}</code>
                  </p>
                  <button
                    onClick={() => toast.success('Redirecting to Microsoft Login...')}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                  >
                    Authorize Microsoft Mailbox
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
