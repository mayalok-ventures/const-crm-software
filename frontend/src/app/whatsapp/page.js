'use client';
import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser, isOwner, isManager, isCounselor, hasPermission } from '@/lib/auth';
import MetaConnectModal from '@/components/whatsapp/MetaConnectModal';
import MetaTemplateModal from '@/components/whatsapp/MetaTemplateModal';
import CapabilityMatrixModal from '@/components/whatsapp/CapabilityMatrixModal';
import WhatsAppConnectionModal from '@/components/whatsapp/WhatsAppConnectionModal';
import LocalTemplateModal from '@/components/whatsapp/LocalTemplateModal';
import BroadcastLaunchModal from '@/components/whatsapp/BroadcastLaunchModal';
import BroadcastLogsModal from '@/components/whatsapp/BroadcastLogsModal';
import AutomationRuleModal from '@/components/automations/AutomationRuleModal';
import {
  MessageCircle, CheckCircle2, AlertCircle, RefreshCw, XCircle, Copy,
  HelpCircle, Smartphone, Monitor, Send, Search, User, CheckCheck, ArrowLeft,
  Image as ImageIcon, Video as VideoIcon, File as FileIcon, FileText, ExternalLink,
  Shield, Key, Layers, Building2, Sparkles, Check, AlertTriangle, Clock,
  Sliders, Lock, Plus, Info, Radio, Zap, X, Settings, Phone, MessageSquare,
  Play, Pause, Trash2, Edit2, Ban, BarChart3, ChevronRight, CheckCircle, Bot
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

const QUICK_REPLIES = [
  { label: '👋 Greeting', text: 'Namaste! Main Sahyak CRM se baat kar raha hoon. Kya main aapki admission enquiry me madad kar sakta hoon?' },
  { label: '📄 Brochure', text: 'Namaste! Yeh raha hamare course ka complete brochure aur details: ' },
  { label: '💰 Fee Details', text: 'Course fees aur scholarship discount options ki jankari main share kar raha hoon. Kya hum call par discuss karein?' },
  { label: '📞 Call Schedule', text: 'Kya aaj dopahar 4 baje hum ek quick 5-minute counseling call schedule kar sakte hain?' },
  { label: '📍 Campus Visit', text: 'Aap weekend par campus visit ke liye सादर aamantrit hain. Kya main aapka counselor slot confirm kar doon?' },
];

export default function WhatsAppWorkspacePage() {
  // Navigation tab within WhatsApp Workspace (Default to live CHATS for optimal psychological UX)
  const [workspaceTab, setWorkspaceTab] = useState('chats'); // 'chats' | 'templates' | 'campaigns' | 'delivery'
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionModalTab, setConnectionModalTab] = useState('baileys'); // 'baileys' | 'meta' | 'matrix'

  // User Profile & Roles
  const [currentUser, setCurrentUser] = useState(null);
  const [canManageIntegrations, setCanManageIntegrations] = useState(false);

  // Method A (Baileys) Connection State
  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [localNumber, setLocalNumber] = useState('');
  const [customPrefix, setCustomPrefix] = useState('');
  const [baileysLoading, setBaileysLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [baileysStatus, setBaileysStatus] = useState({ status: 'disconnected', phone: null, pairingCode: null, qrCode: null });
  const [baileysStatusLoading, setBaileysStatusLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [pairingTab, setPairingTab] = useState('code'); // 'code' | 'qr'

  // Method B (Official Meta Cloud API) State
  const [metaAccount, setMetaAccount] = useState(null);
  const [metaConfigStatus, setMetaConfigStatus] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Chat list & active chat state
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatFilter, setChatFilter] = useState('all'); // 'all' | 'unread' | 'leads'
  const [newChatPhone, setNewChatPhone] = useState('');
  const [showNewChatInput, setShowNewChatInput] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null); // phone string
  const [selectedChatData, setSelectedChatData] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [outboundChannel, setOutboundChannel] = useState('baileys'); // 'baileys' | 'meta_cloud'
  const [metaWindowOpen, setMetaWindowOpen] = useState(true);
  const [checkingWindow, setCheckingWindow] = useState(false);

  // Templates
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [localTemplates, setLocalTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesSubTab, setTemplatesSubTab] = useState('meta'); // 'meta' | 'local'

  // Broadcasts / Campaigns state
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignActionId, setCampaignActionId] = useState(null);
  const [showBroadcastLaunchModal, setShowBroadcastLaunchModal] = useState(false);
  const [selectedCampaignForLogs, setSelectedCampaignForLogs] = useState(null);

  // Local Template Modals state
  const [showLocalTemplateModal, setShowLocalTemplateModal] = useState(false);
  const [editingLocalTemplate, setEditingLocalTemplate] = useState(null);

  // WhatsApp Inbound Chatbots & Automations state
  const [waAutomationRules, setWaAutomationRules] = useState([]);
  const [waAutomationsLoading, setWaAutomationsLoading] = useState(false);
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [editingAutomationRule, setEditingAutomationRule] = useState(null);

  const fetchWaAutomations = async () => {
    setWaAutomationsLoading(true);
    try {
      const { data } = await api.get('/automations', { params: { channel: 'whatsapp' } });
      setWaAutomationRules(data.rules || []);
    } catch (err) {
      console.error('Failed to load WhatsApp automations:', err);
    } finally {
      setWaAutomationsLoading(false);
    }
  };

  const handleToggleWaAutomation = async (rule) => {
    const original = rule.isActive;
    setWaAutomationRules((prev) =>
      prev.map((r) => (r._id === rule._id ? { ...r, isActive: !original } : r))
    );
    try {
      await api.patch(`/automations/${rule._id}/toggle`);
      toast.success(original ? 'Automation paused' : 'Automation activated');
    } catch (err) {
      setWaAutomationRules((prev) =>
        prev.map((r) => (r._id === rule._id ? { ...r, isActive: original } : r))
      );
      toast.error('Failed to update status');
    }
  };

  // Refs for polling safeguards
  const chatScrollRef = useRef(null);
  const loadingStatusRef = useRef(false);
  const loadingChatsRef = useRef(false);
  const loadingHistoryRef = useRef(false);

  // 1. Initial User Profile Resolution & Deep-link Chat Activation
  useEffect(() => {
    const updateAuth = () => {
      const u = getUser();
      setCurrentUser(u);
      const hasAdminRights = isOwner(u) || hasPermission(u, 'whatsapp.manage_account') || hasPermission(u, 'whatsapp.manage_integrations');
      setCanManageIntegrations(hasAdminRights);
    };
    updateAuth();
    window.addEventListener('user-updated', updateAuth);

    // Deep-link direct chat from context menu or phone links
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const directPhone = params.get('phone') || params.get('chat');
      const candidateName = params.get('name');
      const directLeadId = params.get('leadId');
      if (directPhone) {
        const clean = directPhone.replace(/\D/g, '');
        const full = clean.length === 10 ? `91${clean}` : clean;
        setSelectedChat(full);
        setSelectedChatData({
          phone: full,
          displayName: candidateName ? candidateName : `+${full}`,
          leadId: directLeadId || null,
        });
        setWorkspaceTab('chats');
      }
    }

    return () => window.removeEventListener('user-updated', updateAuth);
  }, []);

  // 2. Generate QR image for Baileys
  useEffect(() => {
    if (baileysStatus.qrCode) {
      QRCode.toDataURL(baileysStatus.qrCode, {
        width: 240,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then(url => setQrDataUrl(url)).catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
  }, [baileysStatus.qrCode]);

  // 3. Poll Baileys connection status (Preserved exact behavior)
  useEffect(() => {
    let active = true;

    const checkBaileys = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (loadingStatusRef.current) return;
      loadingStatusRef.current = true;
      try {
        const { data } = await api.get('/whatsapp/status');
        if (active) {
          setBaileysStatus(data);
          setBaileysStatusLoading(false);
          setPairingCode(data.pairingCode || '');
        }
      } catch {
        if (active) setBaileysStatusLoading(false);
      } finally {
        loadingStatusRef.current = false;
      }
    };

    checkBaileys();
    const interval = setInterval(() => {
      if (active) checkBaileys();
    }, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        checkBaileys();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 4. Fetch Meta Cloud API Account & Config Status
  const fetchMetaStatus = async () => {
    setMetaLoading(true);
    try {
      const [accRes, cfgRes] = await Promise.all([
        api.get('/whatsapp/meta/account').catch(() => ({ data: { account: null } })),
        api.get('/whatsapp/meta/config-status').catch(() => ({ data: { configured: false } })),
      ]);
      setMetaAccount(accRes.data?.account || null);
      setMetaConfigStatus(cfgRes.data || null);

      if (accRes.data?.account?.status === 'CONNECTED' && baileysStatus.status !== 'connected') {
        setOutboundChannel('meta_cloud');
      }
    } catch (err) {
      console.warn('[MetaWA] Status fetch note:', err.message);
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    fetchMetaStatus();
  }, []);

  // 5. Fetch Templates
  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const [metaRes, localRes] = await Promise.all([
        api.get('/whatsapp/meta/templates').catch(() => ({ data: { templates: [] } })),
        api.get('/templates?channel=whatsapp').catch(() => ({ data: [] })),
      ]);
      setMetaTemplates(metaRes.data?.templates || []);
      setLocalTemplates(Array.isArray(localRes.data) ? localRes.data : localRes.data?.templates || []);
    } catch (err) {
      console.warn('[Templates] Fetch error:', err.message);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceTab === 'templates' || workspaceTab === 'chats') {
      fetchTemplates();
    }
  }, [workspaceTab]);

  // Fetch campaigns for Broadcast Command Center
  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const res = await api.get('/campaigns');
      setCampaigns(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Failed to load campaigns:', err.message);
    } finally {
      setCampaignsLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceTab === 'campaigns') {
      fetchCampaigns();
    }
  }, [workspaceTab]);

  // Polling for active campaigns
  useEffect(() => {
    let interval = null;
    const hasActive = campaigns.some(c => c.status === 'queued' || c.status === 'running');
    if (workspaceTab === 'campaigns' && hasActive) {
      interval = setInterval(() => {
        api.get('/campaigns').then(res => {
          if (Array.isArray(res.data)) setCampaigns(res.data);
        }).catch(() => {});
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workspaceTab, campaigns]);

  const handlePauseCampaign = async (campaignId) => {
    setCampaignActionId(campaignId);
    try {
      await api.post(`/campaigns/${campaignId}/pause`);
      toast.success('Campaign paused');
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pause campaign');
    } finally {
      setCampaignActionId(null);
    }
  };

  const handleResumeCampaign = async (campaignId) => {
    setCampaignActionId(campaignId);
    try {
      await api.post(`/campaigns/${campaignId}/resume`);
      toast.success('Campaign resumed');
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume campaign');
    } finally {
      setCampaignActionId(null);
    }
  };

  const handleCancelCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to cancel this broadcast?')) return;
    setCampaignActionId(campaignId);
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success('Campaign cancelled');
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel campaign');
    } finally {
      setCampaignActionId(null);
    }
  };

  const handleDeleteLocalTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this canned template?')) return;
    try {
      await api.delete(`/templates/${templateId}`);
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete template');
    }
  };

  // 6. Fetch chats list (Preserved exact behavior with channel enrichment)
  const loadChats = async (silent = false) => {
    if (baileysStatus.status !== 'connected' && (!metaAccount || metaAccount.status !== 'CONNECTED')) {
      return;
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (loadingChatsRef.current) return;
    loadingChatsRef.current = true;
    if (!silent) setChatsLoading(true);
    try {
      const { data } = await api.get('/whatsapp/chats');
      setChats(data || []);
    } catch {
      // Ignore
    } finally {
      loadingChatsRef.current = false;
      if (!silent) setChatsLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
    const interval = setInterval(() => loadChats(true), 4000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadChats(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [baileysStatus.status, metaAccount?.status]);

  // 7. Load chat history when selectedChat changes
  const loadChatHistory = async (phone, silent = false) => {
    if (!phone) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (loadingHistoryRef.current) return;
    loadingHistoryRef.current = true;
    if (!silent) setChatLoading(true);
    try {
      const { data } = await api.get(`/whatsapp/chats/${phone}`);
      setChatMessages(data || []);
    } catch {
      // Ignore
    } finally {
      loadingHistoryRef.current = false;
      if (!silent) setChatLoading(false);
    }
  };

  // Check 24h Window whenever selectedChat or outboundChannel is Meta
  useEffect(() => {
    if (selectedChat && outboundChannel === 'meta_cloud') {
      setCheckingWindow(true);
      api.get(`/whatsapp/meta/check-window/${selectedChat}`)
        .then(res => setMetaWindowOpen(Boolean(res.data?.isOpen)))
        .catch(() => setMetaWindowOpen(false))
        .finally(() => setCheckingWindow(false));
    }
  }, [selectedChat, outboundChannel]);

  useEffect(() => {
    if (selectedChat) {
      loadChatHistory(selectedChat);
      const interval = setInterval(() => loadChatHistory(selectedChat, true), 3500);
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') loadChatHistory(selectedChat, true);
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [selectedChat]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Method A: Baileys Connect Handler (Preserved exact behavior)
  const handleBaileysConnect = async (e) => {
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

    setBaileysLoading(true);
    setPairingCode('');
    setQrDataUrl('');
    try {
      await attemptConnect();
    } finally {
      setBaileysLoading(false);
    }
  };

  // Method A: Baileys Disconnect Handler (Preserved exact behavior)
  const handleBaileysDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Baileys session?')) return;
    setBaileysLoading(true);
    try {
      await api.post('/whatsapp/disconnect');
      setPairingCode('');
      setQrDataUrl('');
      setSelectedChat(null);
      setBaileysStatus({ status: 'disconnected', phone: null, pairingCode: null, qrCode: null });
      toast.success('Disconnected Baileys session');
    } catch {
      toast.error('Failed to disconnect Baileys');
    } finally {
      setBaileysLoading(false);
    }
  };

  // Method B: Meta Disconnect Handler
  const handleMetaDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect the official WhatsApp Business Account?')) return;
    setMetaLoading(true);
    try {
      await api.post('/whatsapp/meta/disconnect');
      setMetaAccount(null);
      toast.success('Official WhatsApp Business Account disconnected');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect Meta account');
    } finally {
      setMetaLoading(false);
    }
  };

  // Outbound Message Sender (Dual-Channel Routing)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChat || sendingReply) return;

    const textToSend = replyText.trim();
    setReplyText('');

    const optimisticMsg = {
      _id: 'temp-' + Date.now(),
      direction: 'outbound',
      text: textToSend,
      senderName: outboundChannel === 'meta_cloud' ? 'Official Meta WA' : 'Personal WA',
      status: 'sent',
      channel: outboundChannel,
      timestamp: new Date().toISOString(),
    };

    setChatMessages(prev => [...prev, optimisticMsg]);
    setSendingReply(true);

    try {
      if (outboundChannel === 'meta_cloud') {
        await api.post('/whatsapp/meta/send-text', {
          to: selectedChat,
          text: textToSend,
          leadId: selectedChatData?.lead?._id || null,
        });
        toast.success('Sent via Official Meta Cloud API! 🏢');
      } else {
        await api.post(`/whatsapp/chats/${selectedChat}/send`, {
          text: textToSend,
        });
        toast.success('Sent via Baileys direct session! 📱');
      }
      loadChatHistory(selectedChat, true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      setReplyText(textToSend);
      setChatMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
    } finally {
      setSendingReply(false);
    }
  };

  // Send Template via Official Meta WABA
  const handleSendMetaTemplate = async (templateName) => {
    if (!templateName || !selectedChat) return;
    setSendingReply(true);
    try {
      await api.post('/whatsapp/meta/send-template', {
        to: selectedChat,
        templateName,
        languageCode: 'en_US',
        leadId: selectedChatData?.lead?._id || null,
      });
      toast.success(`Template "${templateName}" sent via Meta Cloud API! 🚀`);
      loadChatHistory(selectedChat, true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send template');
    } finally {
      setSendingReply(false);
    }
  };

  const copyText = (txt) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    toast.success('Copied! 📋');
  };

  // Filtered Chats with Category & Search Support
  const filteredChats = chats.filter(c => {
    const matchesSearch =
      c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery);
    if (!matchesSearch) return false;
    if (chatFilter === 'unread') return (c.unreadCount || 0) > 0;
    if (chatFilter === 'leads') return Boolean(c.lead);
    return true;
  });

  const unreadTotal = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const leadsCount = chats.filter(c => Boolean(c.lead)).length;
  const isConnected = baileysStatus.status === 'connected' || metaAccount?.status === 'CONNECTED';
  const connectionPhone = baileysStatus.phone || metaAccount?.displayPhoneNumber || null;

  const handleStartDirectChat = (e) => {
    e?.preventDefault();
    const clean = newChatPhone.replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      return toast.error('Please enter a valid phone number (at least 10 digits)');
    }
    const full = clean.length === 10 ? `91${clean}` : clean;
    setSelectedChat(full);
    setSelectedChatData({ phone: full, displayName: `+${full}` });
    setNewChatPhone('');
    setShowNewChatInput(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 pb-16 md:pb-6">
      {/* ── Top Psychological Workspace Header ──────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 md:px-6 py-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">
          {/* Left: Branding & Connection Status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-sm shadow-2xs shrink-0">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">WhatsApp Inbox</h1>
                {/* Status Pill (1-Tap to view/manage connection) */}
                {isConnected ? (
                  canManageIntegrations ? (
                    <button
                      onClick={() => setShowConnectionModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition"
                      title="Click to view device / connection settings"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>+{connectionPhone || 'Online'}</span>
                      <Settings className="w-3 h-3 text-emerald-600 ml-0.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>+{connectionPhone || 'Online'}</span>
                    </div>
                  )
                ) : (
                  canManageIntegrations ? (
                    <button
                      onClick={() => setShowConnectionModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span>⚡ Link WhatsApp (Scan QR)</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-xs">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Offline</span>
                    </div>
                  )
                )}
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Direct lead counseling, instant brochures &amp; quick follow-ups
              </p>
            </div>
          </div>

          {/* Right: Focused Switcher & Settings */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setWorkspaceTab('chats')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  workspaceTab === 'chats'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Chats</span>
                {unreadTotal > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-600 text-white font-bold">
                    {unreadTotal}
                  </span>
                )}
              </button>

              <button
                onClick={() => setWorkspaceTab('templates')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  workspaceTab === 'templates'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Templates</span>
              </button>

              <button
                onClick={() => setWorkspaceTab('campaigns')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  workspaceTab === 'campaigns'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Broadcast</span>
              </button>

              <button
                onClick={() => {
                  setWorkspaceTab('automations');
                  fetchWaAutomations();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  workspaceTab === 'automations'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Automations &amp; Bots</span>
              </button>

              <button
                onClick={() => setWorkspaceTab('delivery')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  workspaceTab === 'delivery'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reports</span>
              </button>
            </div>

            {/* Quick Settings Icon */}
            <button
              onClick={() => setShowConnectionModal(true)}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs flex items-center gap-1 px-2 text-xs font-semibold"
              title="Connection, QR Pairing &amp; Settings"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span className="hidden md:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Workspace Main Content ──────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-2 sm:p-4 md:p-6">
        {workspaceTab === 'chats' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] flex flex-col md:flex-row animate-fade-in">
            {/* Left Column: Chat List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-3 border-b border-slate-200 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Filter Pills & New Chat Button */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setChatFilter('all')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                        chatFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All ({chats.length})
                    </button>
                    <button
                      onClick={() => setChatFilter('unread')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                        chatFilter === 'unread'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Unread {unreadTotal > 0 && `(${unreadTotal})`}
                    </button>
                    <button
                      onClick={() => setChatFilter('leads')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                        chatFilter === 'leads'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Leads ({leadsCount})
                    </button>
                  </div>

                  <button
                    onClick={() => setShowNewChatInput(!showNewChatInput)}
                    className="p-1 px-2 text-[11px] font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1 shrink-0"
                    title="Start direct WhatsApp chat"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Chat</span>
                  </button>
                </div>

                {/* Inline Direct Chat Input */}
                {showNewChatInput && (
                  <form onSubmit={handleStartDirectChat} className="flex items-center gap-1.5 pt-1 animate-fade-in">
                    <input
                      type="tel"
                      placeholder="10-digit phone number..."
                      value={newChatPhone}
                      onChange={(e) => setNewChatPhone(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-xl border border-emerald-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!newChatPhone.trim()}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50"
                    >
                      Open
                    </button>
                  </form>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {chatsLoading && chats.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading conversation threads...
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="py-12 px-4 text-center text-xs text-slate-400">
                    No active conversations found.
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const isSelected = selectedChat === chat.phone;
                    return (
                      <button
                        key={chat.phone}
                        onClick={() => {
                          setSelectedChat(chat.phone);
                          setSelectedChatData(chat);
                        }}
                        className={`w-full p-3 text-left transition flex items-start gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0 font-bold text-xs">
                          {chat.displayName?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {chat.displayName}
                            </span>
                            {chat.lastTimestamp && (
                              <span className="text-[10px] text-slate-400">
                                {format(new Date(chat.lastTimestamp), 'HH:mm')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {chat.lastMessage || 'No message content'}
                          </p>
                        </div>
                        {chat.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-600 text-white font-bold">
                            {chat.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Chat Window */}
            <div className={`flex-1 flex flex-col bg-white ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
              {selectedChat ? (
                <>
                  {/* Chat Top Bar */}
                  <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedChat(null)}
                        className="md:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          {selectedChatData?.displayName || selectedChat}
                          {selectedChatData?.lead && (
                            <Link
                              href={`/leads/${selectedChatData.lead._id}`}
                              className="text-[10px] text-indigo-600 hover:underline font-normal"
                            >
                              (View Lead Record)
                            </Link>
                          )}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-mono">
                          +{selectedChat}
                        </p>
                      </div>
                    </div>

                    {/* Active Channel Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 hidden sm:inline">Sending Via:</span>
                      <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                        <button
                          onClick={() => setOutboundChannel('baileys')}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                            outboundChannel === 'baileys'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          Method A (Baileys)
                        </button>
                        <button
                          onClick={() => setOutboundChannel('meta_cloud')}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                            outboundChannel === 'meta_cloud'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          Method B (Meta API)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Offline Warning Banner */}
                  {!isConnected && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {canManageIntegrations
                            ? 'WhatsApp phone is not linked. Messages will queue until linked.'
                            : 'WhatsApp line is not active. Your workspace administrator can configure and link a phone in WhatsApp Settings.'}
                        </span>
                      </div>
                      {canManageIntegrations && (
                        <button
                          onClick={() => setShowConnectionModal(true)}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-2xs flex items-center gap-1 shrink-0"
                        >
                          ⚡ Link Phone
                        </button>
                      )}
                    </div>
                  )}

                  {/* 24-Hour Policy Warning (If Meta Cloud selected & window closed) */}
                  {outboundChannel === 'meta_cloud' && !metaWindowOpen && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 flex-shrink-0 text-amber-600" />
                        <span>
                          <strong>24h Customer Service Window Closed.</strong> Meta policy requires an approved Template message.
                        </span>
                      </div>
                      {metaTemplates.length > 0 && (
                        <div className="flex items-center gap-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) handleSendMetaTemplate(e.target.value);
                            }}
                            className="px-2 py-1 text-xs rounded-lg border border-amber-300 bg-white text-slate-900"
                          >
                            <option value="">Select &amp; Send Template...</option>
                            {metaTemplates.filter(t => t.status === 'APPROVED').map(t => (
                              <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message History Thread */}
                  <div
                    ref={chatScrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40"
                  >
                    {chatLoading && chatMessages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                        Fetching encrypted chat history...
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No messages exchanged yet with this phone number.
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => {
                        const isOutbound = msg.direction === 'outbound';
                        const isMeta = msg.channel === 'meta_cloud';
                        return (
                          <div
                            key={msg._id || idx}
                            className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[78%] rounded-2xl p-3 shadow-2xs text-xs relative ${
                                isOutbound
                                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-none'
                                  : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1 text-[10px] opacity-75">
                                <span className="font-semibold">{msg.senderName || (isOutbound ? 'Advisor' : 'Candidate')}</span>
                                &bull;
                                <span>{isMeta ? 'Official WABA' : 'Baileys Session'}</span>
                              </div>

                              <p className="whitespace-pre-wrap leading-relaxed text-xs">
                                {msg.text}
                              </p>

                              <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-75">
                                <span>{msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}</span>
                                {isOutbound && (
                                  <span className="font-semibold capitalize">
                                    {msg.status === 'read' ? '✓✓ Read' : msg.status === 'delivered' ? '✓✓ Delivered' : '✓ Sent'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 1-Tap Quick Reply Chips & Reply Input Bar */}
                  {hasPermission(currentUser, 'whatsapp.send_one_to_one') && (
                    <>
                      <div className="px-3.5 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          1-Tap:
                        </span>
                        {QUICK_REPLIES.map((qr, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setReplyText(qr.text)}
                            className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 text-slate-700 whitespace-nowrap transition shadow-2xs"
                          >
                            {qr.label}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={
                            outboundChannel === 'meta_cloud' && !metaWindowOpen
                              ? 'Window closed. Use templates dropdown above to reply.'
                              : 'Type your message to candidate...'
                          }
                          disabled={outboundChannel === 'meta_cloud' && !metaWindowOpen}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        />

                        <button
                          type="submit"
                          disabled={sendingReply || !replyText.trim() || (outboundChannel === 'meta_cloud' && !metaWindowOpen)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-2xs flex items-center gap-1.5 transition disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700"
                        >
                          {sendingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Send
                        </button>
                      </form>
                    </>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 shadow-2xs">
                    <MessageCircle className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Candidate Conversations
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                    Select a student lead from the left pane to chat, or start a message directly:
                  </p>
                  {hasPermission(currentUser, 'whatsapp.send_one_to_one') && (
                    <form onSubmit={handleStartDirectChat} className="flex items-center gap-2 max-w-xs w-full">
                      <input
                        type="tel"
                        placeholder="10-digit mobile number..."
                        value={newChatPhone}
                        onChange={(e) => setNewChatPhone(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={!newChatPhone.trim()}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50"
                      >
                        Chat Now
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: TEMPLATES & HSM MANAGEMENT                             */}
        {/* ============================================================== */}
        {workspaceTab === 'templates' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  WhatsApp Template Library
                </h2>
                <p className="text-xs text-slate-500">
                  Manage Meta-approved HSM templates for Cloud API and local canned replies for Baileys.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    onClick={() => setTemplatesSubTab('meta')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      templatesSubTab === 'meta'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Meta Approved HSM ({metaTemplates.length})
                  </button>
                  <button
                    onClick={() => setTemplatesSubTab('local')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      templatesSubTab === 'local'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Local Canned Templates ({localTemplates.length})
                  </button>
                </div>

                {templatesSubTab === 'meta' && canManageIntegrations && (
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Submit Template to Meta
                  </button>
                )}

                {templatesSubTab === 'local' && (
                  <button
                    onClick={() => {
                      setEditingLocalTemplate(null);
                      setShowLocalTemplateModal(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Local Template
                  </button>
                )}
              </div>
            </div>

            {/* Templates Grid */}
            {templatesLoading ? (
              <div className="py-16 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                Syncing templates...
              </div>
            ) : templatesSubTab === 'meta' ? (
              metaTemplates.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-2">
                  <p className="font-semibold text-slate-700">No Meta Templates Synced</p>
                  <p>Submit your first message template to Meta for review or connect your official WABA account.</p>
                  {canManageIntegrations && (
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    >
                      Submit New Template
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metaTemplates.map((tmpl, i) => (
                    <div
                      key={tmpl.id || i}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-slate-900 truncate">
                          {tmpl.name}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tmpl.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : tmpl.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {tmpl.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>Category: <strong>{tmpl.category}</strong></span>
                        &bull;
                        <span>Lang: <strong>{tmpl.language}</strong></span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 text-xs text-slate-700 font-sans border border-slate-100">
                        {tmpl.components?.find(c => c.type === 'BODY')?.text || 'Template Body'}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Local CRM Templates with Create / Edit / Delete */
              localTemplates.length === 0 ? (
                <div className="p-10 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">No Local Templates Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Create canned templates with dynamic tags like {"{{name}}"} and {"{{course}}"} to speed up student conversations.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingLocalTemplate(null);
                      setShowLocalTemplateModal(true);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Local Template
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {localTemplates.map((tmpl, i) => (
                    <div
                      key={tmpl._id || i}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between hover:shadow-xs transition"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {tmpl.name || tmpl.title}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                            {tmpl.category || 'general'}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-700 font-sans border border-slate-100 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                          {tmpl.content || tmpl.text}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(tmpl.content || tmpl.text);
                            toast.success('Copied template content! 📋');
                          }}
                          className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingLocalTemplate(tmpl);
                              setShowLocalTemplateModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLocalTemplate(tmpl._id)}
                            className="text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CAMPAIGNS & BROADCASTS COMMAND CENTER                   */}
        {/* ============================================================== */}
        {workspaceTab === 'campaigns' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header with Title and Launch Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  WhatsApp Broadcast Command Center
                </h2>
                <p className="text-xs text-slate-500">
                  Launch, manage, pause, and review delivery across Meta Cloud API and Baileys lines without leaving the CRM.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchCampaigns}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition"
                  title="Refresh Campaigns"
                >
                  <RefreshCw className={`w-4 h-4 ${campaignsLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowBroadcastLaunchModal(true)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  Launch New Broadcast
                </button>
              </div>
            </div>

            {/* KPI Metrics Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Total Campaigns</span>
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">{campaigns.length}</div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">In Progress</span>
                  <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
                </div>
                <div className="text-xl font-bold text-amber-600">
                  {campaigns.filter(c => c.status === 'running' || c.status === 'queued').length}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Messages Sent</span>
                  <CheckCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xl font-bold text-emerald-600">
                  {campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0)}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Delivery Rate</span>
                  <Shield className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {(() => {
                    const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
                    const totalFailed = campaigns.reduce((acc, c) => acc + (c.failedCount || 0), 0);
                    const total = totalSent + totalFailed;
                    return total > 0 ? `${Math.round((totalSent / total) * 100)}%` : '100%';
                  })()}
                </div>
              </div>
            </div>

            {/* Broadcast Campaigns Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Broadcast Execution History
                </h3>
                <span className="text-xs text-slate-400">
                  Real-time synchronization active
                </span>
              </div>

              {campaignsLoading && campaigns.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                  <p>Loading broadcast campaigns...</p>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">No Broadcast Campaigns Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Launch high-converting outreach broadcasts to targeted student groups via Meta Cloud API or Baileys direct line.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowBroadcastLaunchModal(true)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Launch Your First Broadcast
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="px-6 py-3">Campaign &amp; Channel</th>
                        <th className="px-4 py-3">Audience &amp; Progress</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {campaigns.map((camp) => {
                        const total = camp.totalLeads || 0;
                        const sent = camp.sentCount || 0;
                        const failed = camp.failedCount || 0;
                        const pct = total > 0 ? Math.min(100, Math.round(((sent + failed) / total) * 100)) : 0;
                        const isActionActive = campaignActionId === camp._id;

                        return (
                          <tr key={camp._id} className="hover:bg-slate-50/70 transition">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 text-xs">
                                {camp.name || camp.campaignName || 'Unnamed Campaign'}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                {camp.channel === 'meta_cloud' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                                    <Shield className="w-3 h-3 text-indigo-600" />
                                    Meta Cloud HSM
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                    <Smartphone className="w-3 h-3 text-emerald-600" />
                                    Baileys Direct Line
                                  </span>
                                )}
                                {camp.templateName && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    [{camp.templateName}]
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-4 min-w-[180px]">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-semibold text-slate-700">
                                  {sent} / {total} Sent
                                </span>
                                <span className="font-bold text-slate-500">{pct}%</span>
                              </div>
                              {/* Progress bar */}
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    camp.status === 'completed'
                                      ? 'bg-emerald-500'
                                      : camp.status === 'failed'
                                      ? 'bg-rose-500'
                                      : 'bg-indigo-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              {failed > 0 && (
                                <p className="text-[10px] text-rose-500 mt-1">
                                  {failed} failed recipient(s)
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                camp.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : camp.status === 'running'
                                  ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                                  : camp.status === 'queued'
                                  ? 'bg-amber-100 text-amber-800'
                                  : camp.status === 'paused'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {camp.status.toUpperCase()}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-slate-500 text-[11px] whitespace-nowrap">
                              {camp.createdAt ? format(new Date(camp.createdAt), 'PP') : '—'}
                            </td>

                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Pause Button */}
                                {(camp.status === 'running' || camp.status === 'queued') && (
                                  <button
                                    onClick={() => handlePauseCampaign(camp._id)}
                                    disabled={isActionActive}
                                    className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 border border-amber-200 transition"
                                    title="Pause Campaign"
                                  >
                                    <Pause className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Resume Button */}
                                {camp.status === 'paused' && (
                                  <button
                                    onClick={() => handleResumeCampaign(camp._id)}
                                    disabled={isActionActive}
                                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition"
                                    title="Resume Campaign"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Cancel Button */}
                                {['running', 'queued', 'paused'].includes(camp.status) && (
                                  <button
                                    onClick={() => handleCancelCampaign(camp._id)}
                                    disabled={isActionActive}
                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                                    title="Cancel Broadcast"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Logs Button */}
                                <button
                                  onClick={() => setSelectedCampaignForLogs(camp)}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                >
                                  Logs
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Educational Channel Guide Banner */}
            <div className="p-5 rounded-2xl bg-linear-to-r from-slate-50 via-white to-indigo-50/50 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600" />
                Strategic Dispatch Guide: Baileys vs Meta Cloud HSM
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    Direct Baileys Line (Standard)
                  </div>
                  <p className="text-slate-600 leading-normal">
                    Best for 1-on-1 counseling follow-ups and warm batches under 500 contacts. Applies intelligent 3–7s random delays to safeguard your physical SIM card.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    Meta Cloud API (Enterprise Bulk)
                  </div>
                  <p className="text-slate-600 leading-normal">
                    Required for high-volume outreach, announcements, and leads outside the 24h window. Dispatched at enterprise scale with 100% deliverability and zero blocking risk.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: DELIVERY REPORTS & WEBHOOK STATUS                       */}
        {/* ============================================================== */}
        {workspaceTab === 'delivery' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCheck className="w-4 h-4 text-indigo-500" />
                    Meta Cloud API Webhook Status &amp; Receipts
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cryptographically verified message lifecycle events
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  HMAC-SHA256 Verified
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-lg font-bold text-slate-900">Active</span>
                  <p className="text-[11px] text-slate-500">Subscription Status</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-lg font-bold text-indigo-600">v21.0</span>
                  <p className="text-[11px] text-slate-500">Graph API Version</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-lg font-bold text-slate-900">100%</span>
                  <p className="text-[11px] text-slate-500">Tenant Isolation</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-lg font-bold text-indigo-600">Real-Time</span>
                  <p className="text-[11px] text-slate-500">Event Latency</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs space-y-1.5">
                <p className="text-indigo-600 font-bold uppercase tracking-wider text-[11px]">
                  Configured Callback Endpoint:
                </p>
                <p className="break-all text-slate-700 select-all font-semibold">
                  {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? 'http://localhost:5000/api/whatsapp/meta/webhook'
                    : 'https://api-app.sahyak.com/api/whatsapp/meta/webhook'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: RBAC GOVERNANCE                                         */}
        {/* ============================================================== */}
        {workspaceTab === 'permissions' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" />
                Role-Based Access Control (RBAC) Governance
              </h3>
              <p className="text-xs text-slate-500">
                Defines organization-wide permissions for WhatsApp communications
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 font-semibold text-slate-900">Permission Scope</th>
                    <th className="p-3 font-semibold text-indigo-600">Company Owner</th>
                    <th className="p-3 font-semibold text-slate-800">Manager</th>
                    <th className="p-3 font-semibold text-slate-600">Counsellor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-medium">Connect &amp; Manage Official Meta WABA</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Full Authority</td>
                    <td className="p-3 text-slate-400">Requires Permission</td>
                    <td className="p-3 text-rose-500 font-medium">✕ Restricted</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Scan QR / Connect Baileys Session</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Full Authority</td>
                    <td className="p-3 text-slate-400">Requires Permission</td>
                    <td className="p-3 text-rose-500 font-medium">✕ Restricted</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">View WhatsApp Conversations</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ All Workspace</td>
                    <td className="p-3 text-indigo-600 font-bold">✓ All Workspace</td>
                    <td className="p-3 text-slate-600 font-bold">✓ Assigned Leads Only</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Send One-to-One Messages</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Allowed</td>
                    <td className="p-3 text-indigo-600 font-bold">✓ Allowed</td>
                    <td className="p-3 text-slate-600 font-bold">✓ Allowed</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Submit Templates to Meta</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Allowed</td>
                    <td className="p-3 text-indigo-600 font-bold">✓ Allowed</td>
                    <td className="p-3 text-rose-500 font-medium">✕ Restricted</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Launch Bulk Broadcast Campaigns</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Allowed</td>
                    <td className="p-3 text-indigo-600 font-bold">✓ Allowed</td>
                    <td className="p-3 text-rose-500 font-medium">✕ Restricted</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {workspaceTab === 'automations' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Strategic Pitch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white shadow-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-base sm:text-lg font-bold">
                    Interactive Inbound WhatsApp Bots &amp; Workflows
                  </h2>
                </div>
                <p className="text-xs text-emerald-100/80 max-w-xl">
                  Automatically engage students 24/7. When a prospect messages your WhatsApp number, reply instantly with interactive menus, course eligibility, fees, or direct counselor routing.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/automations"
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 border border-white/20"
                >
                  <Layers size={14} />
                  <span>All Channels Hub</span>
                </Link>

                <button
                  onClick={() => {
                    setEditingAutomationRule(null);
                    setShowAutomationModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                >
                  <Plus size={16} />
                  <span>New WhatsApp Bot</span>
                </button>
              </div>
            </div>

            {/* Inbound Keyword Flow Architecture Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Bot size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">1. Keyword Inbound Trigger</span>
                </div>
                <p className="text-xs text-slate-500">
                  Student sends keywords like <strong>"1"</strong>, <strong>"fees"</strong>, <strong>"hi"</strong>, or <strong>"courses"</strong> on WhatsApp.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Zap size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">2. Decision Engine</span>
                </div>
                <p className="text-xs text-slate-500">
                  CRM matches exact keyword or option index with zero human latency (&lt; 2 seconds).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-purple-700">
                  <CheckCircle2 size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">3. Interactive Auto-Reply</span>
                </div>
                <p className="text-xs text-slate-500">
                  Fires formatted prospectus, interactive button choices, or notifies counselor on call duty.
                </p>
              </div>
            </div>

            {/* Rules List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Active WhatsApp Workflows</h3>
                  <p className="text-xs text-slate-500">Inbound auto-replies, keyword menus &amp; lead greeting rules</p>
                </div>
                <button
                  onClick={fetchWaAutomations}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                  title="Refresh workflows"
                >
                  <RefreshCw size={14} className={waAutomationsLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {waAutomationsLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading WhatsApp workflows...</div>
              ) : waAutomationRules.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Bot size={28} className="mx-auto text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-800">No WhatsApp Automations Configured</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Create your first WhatsApp auto-reply or interactive bot to respond to prospective student messages automatically.
                  </p>
                  <button
                    onClick={() => {
                      setEditingAutomationRule(null);
                      setShowAutomationModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Create WhatsApp Workflow
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {waAutomationRules.map((rule) => (
                    <div key={rule._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{rule.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {rule.triggerType.replace('_', ' ')}
                          </span>
                        </div>
                        {rule.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">{rule.description}</p>
                        )}
                        {rule.triggerConfig?.keywords?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            <span className="text-[10px] text-slate-400 font-bold">Keywords:</span>
                            {rule.triggerConfig.keywords.map((kw) => (
                              <span key={kw} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px] border border-slate-200">
                                "{kw}"
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleWaAutomation(rule)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              rule.isActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        <button
                          onClick={() => {
                            setEditingAutomationRule(rule);
                            setShowAutomationModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          title="Edit rule"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <MetaConnectModal
        isOpen={showMetaModal}
        onClose={() => setShowMetaModal(false)}
        onSuccess={(acc) => {
          setMetaAccount(acc);
          fetchMetaStatus();
        }}
        initialData={metaAccount}
      />

      <MetaTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSuccess={() => fetchTemplates()}
      />

      <LocalTemplateModal
        isOpen={showLocalTemplateModal}
        onClose={() => {
          setShowLocalTemplateModal(false);
          setEditingLocalTemplate(null);
        }}
        onSuccess={() => fetchTemplates()}
        initialData={editingLocalTemplate}
      />

      <BroadcastLaunchModal
        isOpen={showBroadcastLaunchModal}
        onClose={() => setShowBroadcastLaunchModal(false)}
        onSuccess={() => fetchCampaigns()}
        metaTemplates={metaTemplates}
        localTemplates={localTemplates}
        baileysConnected={baileysStatus.status === 'connected'}
        metaConnected={metaAccount?.status === 'CONNECTED'}
      />

      {selectedCampaignForLogs && (
        <BroadcastLogsModal
          isOpen={Boolean(selectedCampaignForLogs)}
          onClose={() => setSelectedCampaignForLogs(null)}
          campaign={selectedCampaignForLogs}
        />
      )}

      <CapabilityMatrixModal
        isOpen={showMatrixModal}
        onClose={() => setShowMatrixModal(false)}
      />

      <WhatsAppConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        baileysStatus={baileysStatus}
        baileysLoading={baileysLoading}
        pairingCode={pairingCode}
        qrDataUrl={qrDataUrl}
        pairingTab={pairingTab}
        setPairingTab={setPairingTab}
        selectedCountry={selectedCountry}
        setSelectedCountry={setSelectedCountry}
        localNumber={localNumber}
        setLocalNumber={setLocalNumber}
        customPrefix={customPrefix}
        setCustomPrefix={setCustomPrefix}
        handleBaileysConnect={handleBaileysConnect}
        handleBaileysDisconnect={handleBaileysDisconnect}
        metaAccount={metaAccount}
        metaConfigStatus={metaConfigStatus}
        metaLoading={metaLoading}
        canManageIntegrations={canManageIntegrations}
        onOpenMetaModal={() => {
          setShowConnectionModal(false);
          setShowMetaModal(true);
        }}
        handleMetaDisconnect={handleMetaDisconnect}
        fetchTemplates={fetchTemplates}
        copyText={copyText}
      />

      <AutomationRuleModal
        isOpen={showAutomationModal}
        initialRule={editingAutomationRule}
        onClose={() => {
          setShowAutomationModal(false);
          setEditingAutomationRule(null);
        }}
        onSaved={fetchWaAutomations}
      />
    </div>
  );
}
