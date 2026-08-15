'use client';
import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import {
  MessageCircle, CheckCircle2, AlertCircle, RefreshCw, XCircle, Copy,
  HelpCircle, Smartphone, Monitor, Send, Search, User, CheckCheck, ArrowLeft,
  Image as ImageIcon, Video as VideoIcon, File as FileIcon, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

const COUNTRIES = [
  { code: 'IN', name: '🇮🇳 India (+91)', prefix: '91', digits: 10 },
  { code: 'US', name: '🇺🇸 US/Canada (+1)', prefix: '1', digits: 10 },
  { code: 'GB', name: '🇬🇧 United Kingdom (+44)', prefix: '44', digits: 10 },
  { code: 'AE', name: '🇦🇪 UAE (+971)', prefix: '971', digits: 9 },
  { code: 'SA', name: '🇸🇦 Saudi Arabia (+966)', prefix: '966', digits: 9 },
  { code: 'OTHER', name: '🌐 Other (Custom prefix)', prefix: '', digits: null }
];

export default function WhatsAppConnectPage() {
  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [localNumber, setLocalNumber] = useState('');
  const [customPrefix, setCustomPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [status, setStatus] = useState({ status: 'disconnected', phone: null, pairingCode: null, qrCode: null });
  const [statusLoading, setStatusLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [pairingTab, setPairingTab] = useState('code'); // 'code' | 'qr'
  const [connectedViewTab, setConnectedViewTab] = useState('chats'); // 'chats' | 'settings'

  // Chat list & active chat state
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState(null); // phone string
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const chatScrollRef = useRef(null);

  // Generate QR image
  useEffect(() => {
    if (status.qrCode) {
      QRCode.toDataURL(status.qrCode, {
        width: 240,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then(url => setQrDataUrl(url)).catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
  }, [status.qrCode]);

  // Poll connection status
  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      try {
        const { data } = await api.get('/whatsapp/status');
        if (active) {
          setStatus(data);
          setStatusLoading(false);
          setPairingCode(data.pairingCode || '');
        }
      } catch (err) {
        if (active) setStatusLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(() => {
      if (active) checkStatus();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch chats list when connected
  const loadChats = async (silent = false) => {
    if (status.status !== 'connected') return;
    if (!silent) setChatsLoading(true);
    try {
      const { data } = await api.get('/whatsapp/chats');
      setChats(data);
    } catch {
      // Ignore
    } finally {
      if (!silent) setChatsLoading(false);
    }
  };

  useEffect(() => {
    if (status.status === 'connected') {
      loadChats();
      const interval = setInterval(() => loadChats(true), 4000);
      return () => clearInterval(interval);
    }
  }, [status.status]);

  // Load chat history when selectedChat changes
  const loadChatHistory = async (phone, silent = false) => {
    if (!phone) return;
    if (!silent) setChatLoading(true);
    try {
      const { data } = await api.get(`/whatsapp/chats/${phone}`);
      setChatMessages(data);
    } catch {
      // Ignore
    } finally {
      if (!silent) setChatLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChat) {
      loadChatHistory(selectedChat);
      const interval = setInterval(() => loadChatHistory(selectedChat, true), 3500);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleConnect = async (e) => {
    e.preventDefault();

    const country = COUNTRIES.find(c => c.code === selectedCountry);
    const prefix = selectedCountry === 'OTHER' ? customPrefix.replace(/\D/g, '') : country.prefix;

    if (!prefix) return toast.error('Country code prefix is required');
    if (!localNumber) return toast.error('Phone number is required');

    if (selectedCountry === 'IN' && localNumber.replace(/\D/g, '').length !== 10) {
      return toast.error('Indian phone number must be exactly 10 digits');
    }

    const fullPhone = `${prefix}${localNumber.replace(/\D/g, '')}`;

    const attemptConnect = async (isRetry = false) => {
      try {
        const { data } = await api.post('/whatsapp/connect', { phoneNumber: fullPhone });
        setPairingCode(data.pairingCode);
        toast.success('Pairing code ready! Enter it in WhatsApp 📲');
        return true;
      } catch (err) {
        const isNetworkError = !err.response;

        if (isNetworkError && !isRetry) {
          toast.loading('Connection interrupted. Retrying in 2 seconds...', { id: 'wa-retry', duration: 3000 });
          await new Promise(r => setTimeout(r, 2500));
          toast.dismiss('wa-retry');
          return await attemptConnect(true);
        }

        if (isNetworkError) {
          toast.error('Cannot reach server. Check your connection and try again.');
        } else {
          toast.error(err.response?.data?.message || 'Failed to generate pairing code');
        }
        return false;
      }
    };

    setLoading(true);
    setPairingCode('');
    setQrDataUrl('');
    try {
      await attemptConnect();
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your WhatsApp?')) return;
    setLoading(true);
    try {
      await api.post('/whatsapp/disconnect');
      setPairingCode('');
      setQrDataUrl('');
      setSelectedChat(null);
      setStatus({ status: 'disconnected', phone: null, pairingCode: null, qrCode: null });
      toast.success('Disconnected successfully');
    } catch (err) {
      toast.error('Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleEditNumber = async () => {
    setLoading(true);
    try {
      await api.post('/whatsapp/disconnect');
      setPairingCode('');
      setQrDataUrl('');
      setSelectedChat(null);
      setStatus({ status: 'disconnected', phone: null, pairingCode: null, qrCode: null });
      toast.success('Ready to edit phone number! ✏️');
    } catch (err) {
      toast.error('Failed to reset connection');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChat || sendingReply) return;

    const textToSend = replyText.trim();
    setReplyText('');

    // Optimistic UI update
    const optimisticMsg = {
      _id: 'temp-' + Date.now(),
      direction: 'outbound',
      text: textToSend,
      senderName: 'You',
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, optimisticMsg]);
    setSendingReply(true);

    try {
      await api.post(`/whatsapp/chats/${selectedChat}/send`, { text: textToSend });
      toast.success('Message sent! 🚀');
      loadChatHistory(selectedChat, true);
      loadChats(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      setReplyText(textToSend);
      setChatMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
    } finally {
      setSendingReply(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    toast.success('Code copied to clipboard! 📋');
  };

  const filteredChats = chats.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.displayName.toLowerCase().includes(q) || c.phone.includes(q) || (c.lastMessage && c.lastMessage.toLowerCase().includes(q));
  });

  const BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">WhatsApp Integration</h1>
          {status.status === 'connected' && (
            <span className="badge badge-closed" style={{ gap: 6, display: 'flex', alignItems: 'center', fontSize: 11, padding: '4px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
              Connected (+{status.phone})
            </span>
          )}
        </div>

        <div className="page-content" style={{ padding: 0 }}>
          {statusLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spinner" />
            </div>
          ) : (
            <div>
              {/* ─────────────────────────────────────────────────────────────
                  CONNECTED VIEW (Chats Inbox & Settings Tabs)
                 ───────────────────────────────────────────────────────────── */}
              {status.status === 'connected' && (
                <div>
                  {/* Top Navigation Tabs */}
                  <div style={{
                    display: 'flex',
                    gap: 0,
                    marginBottom: 16,
                    background: 'var(--surface)',
                    borderRadius: 12,
                    padding: 4,
                    border: '1px solid var(--border)',
                  }}>
                    <button
                      onClick={() => { setConnectedViewTab('chats'); setSelectedChat(null); }}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: connectedViewTab === 'chats' ? 'var(--accent)' : 'transparent',
                        color: connectedViewTab === 'chats' ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <MessageCircle size={16} /> WhatsApp Inbox ({chats.length})
                    </button>
                    <button
                      onClick={() => setConnectedViewTab('settings')}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: connectedViewTab === 'settings' ? 'var(--accent)' : 'transparent',
                        color: connectedViewTab === 'settings' ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Smartphone size={16} /> Connection Settings
                    </button>
                  </div>

                  {/* ── TAB 1: INBOX / CHATS VIEW ── */}
                  {connectedViewTab === 'chats' && (
                    <div>
                      {!selectedChat ? (
                        /* Chats List View */
                        <div className="card" style={{ padding: '16px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Client Conversations</h3>
                              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Real-time chat messages & client replies</p>
                            </div>
                            <button onClick={() => loadChats()} className="btn btn-ghost btn-sm" style={{ padding: 6, minHeight: 'auto', borderRadius: 8 }}>
                              <RefreshCw size={13} />
                            </button>
                          </div>

                          {/* Search Input */}
                          <div style={{ position: 'relative', marginBottom: 14 }}>
                            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                            <input
                              type="text"
                              placeholder="Search conversations by name, phone or text..."
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              className="input"
                              style={{ paddingLeft: 36, fontSize: 13, height: 42, borderRadius: 10 }}
                            />
                          </div>

                          {chatsLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                              <div className="spinner" />
                            </div>
                          ) : filteredChats.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)' }}>
                              <MessageCircle size={36} color="var(--border)" style={{ marginBottom: 8 }} />
                              <p style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600 }}>No conversations yet</p>
                              <p style={{ margin: 0, fontSize: 12 }}>Send a template or direct WhatsApp message to any client to start chatting.</p>
                              <Link href="/dashboard" className="btn btn-primary btn-sm" style={{ marginTop: 14, display: 'inline-flex', borderRadius: 10 }}>
                                View Clients & Leads →
                              </Link>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {filteredChats.map((c) => (
                                <div
                                  key={c.phone}
                                  onClick={() => setSelectedChat(c.phone)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '12px 14px',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 14,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                >
                                  <div style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: 15,
                                    flexShrink: 0
                                  }}>
                                    {c.displayName ? c.displayName[0].toUpperCase() : <User size={18} />}
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.displayName}
                                      </span>
                                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                        {c.lastTimestamp ? format(new Date(c.lastTimestamp), 'dd MMM, h:mm a') : ''}
                                      </span>
                                    </div>
                                    <p style={{
                                      margin: 0,
                                      fontSize: 12,
                                      color: c.unreadCount > 0 ? 'var(--text)' : 'var(--text-muted)',
                                      fontWeight: c.unreadCount > 0 ? 600 : 400,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {c.direction === 'outbound' ? 'You: ' : ''}{c.lastMessage || 'Sent attachment'}
                                    </p>
                                  </div>

                                  {c.unreadCount > 0 && (
                                    <span style={{
                                      background: 'var(--green)',
                                      color: '#fff',
                                      fontSize: 10,
                                      fontWeight: 700,
                                      borderRadius: 12,
                                      padding: '2px 8px',
                                      flexShrink: 0
                                    }}>
                                      {c.unreadCount} new
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Selected Active Chat Thread View */
                        <div className="card" style={{ padding: '16px 14px' }}>
                          {/* Chat Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <button
                                onClick={() => setSelectedChat(null)}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: 6, minHeight: 'auto', borderRadius: 8 }}
                              >
                                <ArrowLeft size={18} />
                              </button>
                              <div style={{ minWidth: 0 }}>
                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {chats.find(c => c.phone === selectedChat)?.displayName || `+${selectedChat}`}
                                </h3>
                                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>+{selectedChat}</p>
                              </div>
                            </div>

                            {chats.find(c => c.phone === selectedChat)?.lead && (
                              <Link
                                href={`/leads/${chats.find(c => c.phone === selectedChat).lead._id}`}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 11, gap: 4, padding: '6px 10px', borderRadius: 8, flexShrink: 0 }}
                              >
                                View Client <ExternalLink size={12} />
                              </Link>
                            )}
                          </div>

                          {/* Chat Thread Messages */}
                          <div
                            ref={chatScrollRef}
                            style={{
                              maxHeight: 340,
                              minHeight: 200,
                              overflowY: 'auto',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              padding: '12px 8px',
                              marginBottom: 12,
                              background: 'var(--bg)',
                              borderRadius: 12,
                              border: '1px solid var(--border)',
                            }}
                          >
                            {chatLoading ? (
                              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                                <div className="spinner" style={{ width: 22, height: 22 }} />
                              </div>
                            ) : chatMessages.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)' }}>
                                <p style={{ margin: 0, fontSize: 13 }}>No messages in this chat yet.</p>
                              </div>
                            ) : (
                              chatMessages.map((m, idx) => {
                                const isOutbound = m.direction === 'outbound';
                                return (
                                  <div
                                    key={m._id || idx}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: isOutbound ? 'flex-end' : 'flex-start',
                                      maxWidth: '88%',
                                      alignSelf: isOutbound ? 'flex-end' : 'flex-start',
                                    }}
                                  >
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, paddingLeft: 4, paddingRight: 4 }}>
                                      {isOutbound ? 'You' : (m.senderName || 'Client')}
                                    </span>
                                    <div
                                      style={{
                                        padding: '10px 14px',
                                        borderRadius: 16,
                                        borderBottomRightRadius: isOutbound ? 3 : 16,
                                        borderBottomLeftRadius: !isOutbound ? 3 : 16,
                                        background: isOutbound ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' : 'var(--surface)',
                                        color: isOutbound ? '#ffffff' : 'var(--text)',
                                        border: isOutbound ? 'none' : '1px solid var(--border)',
                                        boxShadow: isOutbound ? '0 2px 8px rgba(79, 70, 229, 0.25)' : '0 1px 4px rgba(0,0,0,0.05)',
                                        wordBreak: 'break-word',
                                        fontSize: 13,
                                        lineHeight: 1.45,
                                      }}
                                    >
                                      {m.mediaType === 'image' && m.mediaUrl && (
                                        <a href={m.mediaUrl.startsWith('http') ? m.mediaUrl : `${BASE}${m.mediaUrl}`} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 6 }}>
                                          <img
                                            src={m.mediaUrl.startsWith('http') ? m.mediaUrl : `${BASE}${m.mediaUrl}`}
                                            alt="Attached Image"
                                            style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 10, objectFit: 'cover', display: 'block' }}
                                          />
                                        </a>
                                      )}
                                      {m.mediaType === 'video' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                                          <VideoIcon size={14} /> <span>Video Attached</span>
                                        </div>
                                      )}
                                      {m.mediaType === 'document' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                                          <FileIcon size={14} /> <span>Document Attached</span>
                                        </div>
                                      )}
                                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.text}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, paddingRight: 4, paddingLeft: 4 }}>
                                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                                        {m.timestamp ? format(new Date(m.timestamp), 'h:mm a, dd MMM') : ''}
                                      </span>
                                      {isOutbound && <CheckCheck size={12} color="#818cf8" />}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Quick Reply Form */}
                          <form onSubmit={handleSendReply} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="text"
                              placeholder="Type a WhatsApp message..."
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              disabled={sendingReply}
                              className="input"
                              style={{ flex: 1, height: 42, fontSize: 13, borderRadius: 10 }}
                            />
                            <button
                              type="submit"
                              disabled={!replyText.trim() || sendingReply}
                              className="btn btn-primary"
                              style={{ width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, flexShrink: 0 }}
                            >
                              {sendingReply ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Send size={15} />}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TAB 2: CONNECTION SETTINGS ── */}
                  {connectedViewTab === 'settings' && (
                    <div>
                      <div className="card" style={{ marginBottom: 24, padding: 20, borderLeft: '4px solid var(--green)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <MessageCircle size={24} color="var(--green)" />
                            <span style={{ fontSize: 16, fontWeight: 700 }}>Connection Status</span>
                          </div>
                          <span className="badge badge-closed">Connected</span>
                        </div>
                        <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-muted)' }}>
                          Connected to WhatsApp account: <strong style={{ color: 'var(--text)' }}>+{status.phone}</strong>
                        </p>

                        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle2 size={16} />
                            Multi-Device Automatic Sync:
                          </h4>
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Your WhatsApp connection is securely maintained on the server. Whenever you open this CRM from your mobile phone or desktop, your session is already active and authenticated.
                          </p>
                        </div>

                        <button
                          onClick={handleDisconnect}
                          disabled={loading}
                          className="btn btn-danger btn-full btn-sm"
                          style={{ gap: 8, borderRadius: 10 }}
                        >
                          <XCircle size={16} /> Disconnect WhatsApp
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  CONNECTING / PAIRING VIEW
                 ───────────────────────────────────────────────────────────── */}
              {status.status === 'connecting' && (
                <div className="card" style={{ marginBottom: 24, padding: 20, borderLeft: '4px solid var(--yellow)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MessageCircle size={24} color="var(--yellow)" />
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Connecting Device</span>
                    </div>
                    <span className="badge badge-follow_up">Waiting for confirmation</span>
                  </div>

                  {!pairingCode ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <RefreshCw className="spinner" size={32} color="var(--yellow)" style={{ marginBottom: 12, display: 'inline-block' }} />
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Generating Pairing Code...</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        Requesting secure credentials for +{status.phone}
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Tab switcher: Code / QR */}
                      {qrDataUrl && (
                        <div style={{
                          display: 'flex',
                          gap: 0,
                          marginBottom: 20,
                          background: 'var(--surface)',
                          borderRadius: 10,
                          padding: 4,
                          border: '1px solid var(--border)',
                        }}>
                          <button
                            onClick={() => setPairingTab('code')}
                            style={{
                              flex: 1,
                              padding: '8px 0',
                              borderRadius: 8,
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              background: pairingTab === 'code' ? 'var(--accent)' : 'transparent',
                              color: pairingTab === 'code' ? '#fff' : 'var(--text-muted)',
                              transition: 'all 0.2s',
                            }}
                          >
                            <Smartphone size={14} /> Phone Code
                          </button>
                          <button
                            onClick={() => setPairingTab('qr')}
                            style={{
                              flex: 1,
                              padding: '8px 0',
                              borderRadius: 8,
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              background: pairingTab === 'qr' ? 'var(--accent)' : 'transparent',
                              color: pairingTab === 'qr' ? '#fff' : 'var(--text-muted)',
                              transition: 'all 0.2s',
                            }}
                          >
                            <Monitor size={14} /> QR Code
                          </button>
                        </div>
                      )}

                      {/* Phone Code */}
                      {(!qrDataUrl || pairingTab === 'code') && (
                        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                            Enter this 8-digit code in your WhatsApp app:
                          </p>

                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 12,
                            background: 'var(--surface)',
                            border: '2px solid var(--accent)',
                            padding: '14px 28px',
                            borderRadius: 14,
                            marginBottom: 16,
                            boxShadow: '0 0 0 4px rgba(99,102,241,0.1)',
                          }}>
                            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: 4, fontFamily: 'monospace', color: 'var(--accent-light)' }}>
                              {pairingCode}
                            </span>
                            <button onClick={copyCode} className="btn btn-ghost btn-sm" style={{ padding: 8, minHeight: 'auto' }} title="Copy code">
                              <Copy size={16} />
                            </button>
                          </div>

                          <div style={{
                            background: 'rgba(99,102,241,0.08)',
                            border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            marginBottom: 14,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            textAlign: 'left',
                          }}>
                            <Smartphone size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              <strong style={{ color: 'var(--text)' }}>Mobile-friendly:</strong> Enter the code in WhatsApp under <strong>Linked Devices → Link with phone number</strong>.
                            </p>
                          </div>

                          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, textAlign: 'left' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <HelpCircle size={16} color="var(--accent)" />
                              How to link:
                            </h4>
                            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <li>Open WhatsApp on your phone</li>
                              <li>Go to <strong>Settings</strong> or <strong>Menu</strong> &gt; <strong>Linked Devices</strong></li>
                              <li>Tap <strong>Link a Device</strong></li>
                              <li>Select <strong>&quot;Link with phone number instead&quot;</strong></li>
                              <li>Enter the code shown above</li>
                            </ol>
                          </div>
                        </div>
                      )}

                      {/* QR Code */}
                      {qrDataUrl && pairingTab === 'qr' && (
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                          <p style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                            Scan this QR code from another device:
                          </p>

                          <div style={{
                            display: 'inline-block',
                            padding: 16,
                            background: '#ffffff',
                            borderRadius: 16,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                            marginBottom: 16,
                            border: '3px solid var(--accent)',
                          }}>
                            <img
                              src={qrDataUrl}
                              alt="WhatsApp QR code"
                              width={220}
                              height={220}
                              style={{ display: 'block', borderRadius: 4 }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleEditNumber}
                        disabled={loading}
                        className="btn btn-secondary btn-full btn-sm"
                        style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10 }}
                      >
                        ✏️ Edit Phone Number / Start Over
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  DISCONNECTED FORM
                 ───────────────────────────────────────────────────────────── */}
              {status.status === 'disconnected' && (
                <div className="card" style={{ marginBottom: 24, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <MessageCircle size={24} color="var(--text-muted)" />
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Link WhatsApp Account</span>
                  </div>

                  <form onSubmit={handleConnect}>
                    <div style={{ marginBottom: 16 }}>
                      <label className="label">Select Country</label>
                      <select
                        value={selectedCountry}
                        onChange={(e) => {
                          setSelectedCountry(e.target.value);
                          setLocalNumber('');
                        }}
                        className="input"
                        style={{ marginBottom: 12, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px' }}
                        disabled={loading}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      {selectedCountry === 'OTHER' && (
                        <div style={{ marginBottom: 12 }}>
                          <label className="label">Custom Country Prefix Code</label>
                          <input
                            type="tel"
                            placeholder="e.g. 971"
                            value={customPrefix}
                            onChange={(e) => setCustomPrefix(e.target.value.replace(/\D/g, ''))}
                            className="input"
                            required
                            disabled={loading}
                          />
                        </div>
                      )}

                      <label className="label">WhatsApp Number</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          padding: '10px 12px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap'
                        }}>
                          +{selectedCountry === 'OTHER' ? (customPrefix || '?') : COUNTRIES.find(c => c.code === selectedCountry).prefix}
                        </span>
                        <input
                          type="tel"
                          placeholder={selectedCountry === 'IN' ? '10-digit mobile number' : 'Mobile number'}
                          value={localNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (selectedCountry === 'IN' && val.length > 10) return;
                            setLocalNumber(val);
                          }}
                          maxLength={selectedCountry === 'IN' ? 10 : 15}
                          className="input"
                          style={{ flex: 1, borderRadius: 10 }}
                          required
                          disabled={loading}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, display: 'block' }}>
                        {selectedCountry === 'IN' ? '🇮🇳 Enter exactly 10 digits without +91 or leading 0' : 'Enter mobile number without country prefix'}
                      </span>
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary btn-full" style={{ borderRadius: 10 }}>
                      {loading ? <RefreshCw className="spinner" size={18} style={{ display: 'inline-block' }} /> : 'Generate Pairing Code'}
                    </button>
                  </form>
                </div>
              )}

              {/* Info Card */}
              <div style={{ padding: 16, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 14, display: 'flex', gap: 12 }}>
                <CheckCircle2 size={20} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>Why link your WhatsApp?</h4>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>Chat directly with leads inside the CRM in real-time.</li>
                    <li>View live customer replies immediately with automatic in-app alerts.</li>
                    <li>Send personalized templates, media attachments & bulk campaigns.</li>
                  </ul>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
      <BottomNav active="whatsapp" />
    </div>
  );
}
