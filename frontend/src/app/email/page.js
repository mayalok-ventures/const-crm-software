'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import EmailAccountsModal from '@/components/email/EmailAccountsModal';
import EmailComposerModal from '@/components/email/EmailComposerModal';
import EmailThreadView from '@/components/email/EmailThreadView';
import { getUser, hasPermission } from '@/lib/auth';
import {
  Mail, Inbox, Send, FileText, Clock, Archive, Trash2,
  Search, Star, Paperclip, Plus, RefreshCw, Settings,
  Filter, CheckCircle2, ChevronRight, User, AlertCircle
} from 'lucide-react';

const FOLDERS = [
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'drafts', label: 'Drafts', icon: FileText },
  { key: 'scheduled', label: 'Scheduled', icon: Clock },
  { key: 'archive', label: 'Archive', icon: Archive },
  { key: 'trash', label: 'Trash', icon: Trash2 },
];

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

export default function EmailPage() {
  const [user, setUser] = useState(null);
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'starred'

  // Modals
  const [showComposer, setShowComposer] = useState(false);
  const [composerInitialData, setComposerInitialData] = useState({});
  const [showAccountsModal, setShowAccountsModal] = useState(false);

  // Mobile navigation drilldown
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'thread'

  const handleGoogleConnect = async () => {
    try {
      setConnectingGoogle(true);
      const res = await api.get('/email/oauth/google/url');
      if (res.data?.url) {
        toast.loading('Redirecting to Google Sign-in...');
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google OAuth not configured yet. Please check .env keys.');
    } finally {
      setConnectingGoogle(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/email/accounts');
      const accList = res.data.accounts || [];
      setAccounts(accList);
      if (accList.length > 0 && selectedAccountId === 'all') {
        // Can stay 'all' or select first
      }
    } catch {
      // Handled silently
    }
  };

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = {
        folder: currentFolder,
        accountId: selectedAccountId !== 'all' ? selectedAccountId : undefined,
        search: searchTerm || undefined,
        unreadOnly: activeFilter === 'unread' ? 'true' : undefined,
        starredOnly: activeFilter === 'starred' ? 'true' : undefined,
      };

      const res = await api.get('/email/messages', { params });
      setMessages(res.data.messages || []);
      setUnreadInboxCount(res.data.unreadInboxCount || 0);

      // If selected message is in current list, update it
      if (selectedMessage) {
        const found = (res.data.messages || []).find(m => m._id === selectedMessage._id);
        if (found) setSelectedMessage(found);
      }
    } catch (err) {
      toast.error('Failed to load email messages');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const updateAuth = () => {
      setUser(getUser());
    };
    updateAuth();
    window.addEventListener('user-updated', updateAuth);

    fetchAccounts();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get('connected');
      const emailParam = params.get('email');
      const errorParam = params.get('error');
      const msgParam = params.get('message');

      if (connected === 'google') {
        toast.success(`🎉 Google Workspace mailbox connected successfully! (${emailParam || 'Gmail'})`, { duration: 6000 });
        window.history.replaceState({}, '', '/email');
        fetchAccounts();
      } else if (errorParam) {
        toast.error(`Google authorization notice: ${msgParam || errorParam}`, { duration: 5000 });
        window.history.replaceState({}, '', '/email');
      }
    }

    return () => window.removeEventListener('user-updated', updateAuth);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [currentFolder, selectedAccountId, activeFilter]);

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchMessages(true);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleSelectMessage = (msg) => {
    setSelectedMessage(msg);
    setMobileView('thread');
  };

  const handleToggleStar = async (e, msg) => {
    e.stopPropagation();
    try {
      const nextStar = !msg.isStarred;
      await api.patch(`/email/messages/${msg._id}/star`, { isStarred: nextStar });
      setMessages(prev =>
        prev.map(m => (m._id === msg._id ? { ...m, isStarred: nextStar } : m))
      );
      if (selectedMessage?._id === msg._id) {
        setSelectedMessage(prev => ({ ...prev, isStarred: nextStar }));
      }
    } catch {
      toast.error('Failed to update star');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100dvh-0px)] pb-16 md:pb-0 overflow-hidden bg-slate-50 text-slate-900 select-none">
      {/* Workspace Layout: 3 Columns on Desktop */}
      <div className="flex-1 flex h-full overflow-hidden">
        {/* COLUMN 1: Folders & Accounts Sidebar (Desktop strictly >= 1024px) */}
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 hidden lg:flex">
            {/* Top Workspace Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                  <Mail size={16} />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-900 m-0 leading-tight">Email Workspace</h1>
                  <p className="text-[11px] text-slate-500 m-0">Candidate Communications</p>
                </div>
              </div>

              {hasPermission(user, 'email.manage_accounts') && (
                <button
                  onClick={() => setShowAccountsModal(true)}
                  title="Manage Mailbox Connections"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                >
                  <Settings size={15} />
                </button>
              )}
            </div>

            {/* Compose CTA Button */}
            {hasPermission(user, 'email.send') && (
              <div className="p-4 pb-2">
                <button
                  onClick={() => {
                    setComposerInitialData({});
                    setShowComposer(true);
                  }}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  <span>New Email</span>
                </button>
              </div>
            )}

            {/* Account Selector */}
            <div className="px-4 py-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Mailbox Account
              </label>
              {accounts.length === 0 ? (
                hasPermission(user, 'email.manage_accounts') ? (
                  <button
                    type="button"
                    onClick={() => setShowAccountsModal(true)}
                    className="w-full py-2 px-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus size={13} className="text-indigo-600" />
                    <span>Configure Mailbox</span>
                  </button>
                ) : (
                  <div className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 text-center">
                    No mailbox assigned
                  </div>
                )
              ) : (
                <select
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                  className="w-full text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Connected Accounts</option>
                  {accounts.map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.displayName || acc.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Folder Navigation */}
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              {FOLDERS.map(f => {
                const Icon = f.icon;
                const isActive = currentFolder === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setCurrentFolder(f.key);
                      setSelectedMessage(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>{f.label}</span>
                    </div>

                    {f.key === 'inbox' && unreadInboxCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold">
                        {unreadInboxCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Connection Status Footprint */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Mailboxes:</span>
                <span className="font-bold text-slate-800">
                  {accounts.length > 0 ? `${accounts.length} Active` : 'None'}
                </span>
              </div>
              {hasPermission(user, 'email.manage_accounts') && (
                <button
                  type="button"
                  onClick={() => setShowAccountsModal(true)}
                  className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Settings size={13} className="text-indigo-600" />
                  <span>Manage Mailboxes</span>
                </button>
              )}
            </div>
          </aside>

          {/* COLUMN 2: Message / Conversation List */}
          <section
            className={`w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0 ${
              mobileView === 'thread' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Search & Top Action Bar */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate, subject, email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>

                <button
                  onClick={() => fetchMessages()}
                  title="Refresh mail"
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/80 transition"
                >
                  <RefreshCw size={14} />
                </button>

                {/* Mobile Quick Mailbox Settings if no accounts */}
                {accounts.length === 0 && hasPermission(user, 'email.manage_accounts') && (
                  <button
                    onClick={() => setShowAccountsModal(true)}
                    className="lg:hidden p-2 rounded-xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition shadow-2xs"
                    title="Configure Mailbox"
                  >
                    <Settings size={14} />
                  </button>
                )}
                {hasPermission(user, 'email.send') && (
                  <button
                    onClick={() => {
                      setComposerInitialData({});
                      setShowComposer(true);
                    }}
                    className="lg:hidden p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    title="Compose Email"
                  >
                    <Plus size={15} />
                  </button>
                )}
              </div>

              {/* Quick Filter Pills & Mobile Folder Selector */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {/* Mobile Folder Dropdown */}
                <div className="lg:hidden flex-1">
                  <select
                    value={currentFolder}
                    onChange={e => setCurrentFolder(e.target.value)}
                    className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
                  >
                    {FOLDERS.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  {['all', 'unread', 'starred'].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                        activeFilter === filter
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

              {/* Conversation Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {loading ? (
                  <div className="p-8 text-center text-slate-400">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading conversations...</p>
                  </div>
                ) : messages.length === 0 ? (
                  accounts.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-2xs flex items-center justify-center mb-3 text-indigo-600">
                        <Mail size={22} />
                      </div>
                      <p className="text-xs font-bold text-slate-800 mb-1">
                        {hasPermission(user, 'email.manage_accounts') ? 'No Mailbox Connected' : 'No Mailbox Assigned'}
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mb-4">
                        {hasPermission(user, 'email.manage_accounts')
                          ? 'Connect an organizational Google Workspace or SMTP account to begin managing student emails.'
                          : 'Please contact your workspace administrator to grant your profile access to a company mailbox.'}
                      </p>
                      {hasPermission(user, 'email.manage_accounts') && (
                        <button
                          type="button"
                          onClick={() => setShowAccountsModal(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs transition flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Plus size={14} />
                          <span>Configure Mailbox</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-xs">No emails in {currentFolder}</p>
                    </div>
                  )
              ) : (
                messages.map(msg => {
                  const isSelected = selectedMessage?._id === msg._id;
                  const senderName = msg.from?.name || msg.from?.email || 'Unknown';
                  const leadName = msg.leadId?.name;

                  return (
                    <div
                      key={msg._id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`p-3.5 cursor-pointer transition flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-indigo-50/60 border-l-4 border-indigo-600'
                          : !msg.isRead
                          ? 'bg-white font-semibold hover:bg-slate-50'
                          : 'bg-slate-50/40 text-slate-600 hover:bg-slate-100/60'
                      }`}
                    >
                      {/* Sender & Timestamp */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!msg.isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                          )}
                          <span className={`truncate ${!msg.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {leadName ? `${leadName}` : senderName}
                          </span>
                          {leadName && (
                            <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 text-[9px] font-bold shrink-0">
                              Lead
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-slate-400">
                          {msg.hasAttachments && <Paperclip size={12} />}
                          <span>{format(new Date(msg.date || msg.createdAt), 'h:mm a')}</span>
                          <button
                            type="button"
                            onClick={e => handleToggleStar(e, msg)}
                            className="p-1 hover:text-amber-500 text-slate-300 transition"
                          >
                            <Star size={13} fill={msg.isStarred ? '#f59e0b' : 'none'} color={msg.isStarred ? '#f59e0b' : 'currentColor'} />
                          </button>
                        </div>
                      </div>

                      {/* Subject */}
                      <p className={`text-xs truncate m-0 ${!msg.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
                        {msg.subject || '(No Subject)'}
                      </p>

                      {/* Snippet Preview */}
                      <p className="text-[11px] text-slate-500 line-clamp-1 m-0 font-normal">
                        {msg.snippet || 'No preview text'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* COLUMN 3: Reading Pane & Thread View */}
          <section
            className={`flex-1 flex flex-col h-full bg-white overflow-hidden ${
              mobileView === 'list' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selectedMessage ? (
              <EmailThreadView
                selectedMessage={selectedMessage}
                onBack={() => setMobileView('list')}
                onMessageUpdated={() => fetchMessages(true)}
                onOpenReply={(replyData) => {
                  setComposerInitialData(replyData);
                  setShowComposer(true);
                }}
                accounts={accounts}
              />
            ) : accounts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50/60 overflow-y-auto">
                <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-lg p-8 flex flex-col items-center text-center animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm flex items-center justify-center mb-4 text-indigo-600">
                    <Mail size={30} />
                  </div>
                  {hasPermission(user, 'email.manage_accounts') ? (
                    <>
                      <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-[11px] mb-2">
                        Organization Mailbox Setup
                      </span>
                      <h2 className="text-xl font-extrabold text-slate-900 mb-2 tracking-tight">
                        Configure Company Mailbox
                      </h2>
                      <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-sm">
                        Connect Google Workspace or Custom SMTP mailboxes centrally. Once connected, administrators can selectively assign lines to counsellors.
                      </p>

                      <button
                        type="button"
                        onClick={() => setShowAccountsModal(true)}
                        className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl text-sm font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus size={16} />
                        <span>Manage & Connect Mailboxes</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-bold text-slate-900 mb-2">
                        No Mailbox Assigned
                      </h2>
                      <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                        Your account currently does not have an assigned company mailbox. Your workspace administrator can connect and allocate mailboxes under Settings.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <EmailThreadView
                selectedMessage={null}
                onBack={() => setMobileView('list')}
                onMessageUpdated={() => fetchMessages(true)}
                onOpenReply={(replyData) => {
                  setComposerInitialData(replyData);
                  setShowComposer(true);
                }}
                accounts={accounts}
              />
            )}
          </section>
        </div>

      {/* Email Composer Modal */}
      {showComposer && hasPermission(user, 'email.send') && (
        <EmailComposerModal
          isOpen={showComposer}
          onClose={() => setShowComposer(false)}
          initialData={composerInitialData}
          onSent={() => fetchMessages(true)}
          accounts={accounts}
        />
      )}

      {/* Connected Accounts Management Modal */}
      {showAccountsModal && hasPermission(user, 'email.manage_accounts') && (
        <EmailAccountsModal
          isOpen={showAccountsModal}
          onClose={() => setShowAccountsModal(false)}
          onAccountUpdated={() => {
            fetchAccounts();
            fetchMessages(true);
          }}
        />
      )}
    </div>
  );
}
