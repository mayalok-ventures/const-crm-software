'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser, hasPermission } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import CampaignModal from '@/components/campaigns/CampaignModal';
import CampaignLeadsModal from '@/components/campaigns/CampaignLeadsModal';
import {
  Target,
  Sparkles,
  MessageCircle,
  Play,
  Pause,
  XCircle,
  AlertTriangle,
  Eye,
  Plus,
  Search,
  Filter,
  Users,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Settings,
  MoreVertical,
  Edit2,
  Trash2,
  UserCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export default function CampaignsPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('inbound'); // 'inbound' | 'broadcast'

  // Inbound Marketing Campaigns State
  const [inboundCampaigns, setInboundCampaigns] = useState([]);
  const [loadingInbound, setLoadingInbound] = useState(true);
  const [inboundSearch, setInboundSearch] = useState('');
  const [inboundPlatformFilter, setInboundPlatformFilter] = useState('');
  const [inboundStatusFilter, setInboundStatusFilter] = useState('');

  // Modals State
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [selectedCampaignForEdit, setSelectedCampaignForEdit] = useState(null);
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState(false);
  const [selectedCampaignForLeads, setSelectedCampaignForLeads] = useState(null);

  // Outbound Broadcast Campaigns State (Existing)
  const [broadcastCampaigns, setBroadcastCampaigns] = useState([]);
  const [loadingBroadcast, setLoadingBroadcast] = useState(true);
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastStatusFilter, setBroadcastStatusFilter] = useState('');

  const isFetchingRef = useRef(false);

  useEffect(() => {
    const handleUser = () => setUser(getUser());
    handleUser();
    window.addEventListener('user-updated', handleUser);
    return () => window.removeEventListener('user-updated', handleUser);
  }, []);

  // Fetch Inbound Advertising Campaigns
  const fetchInboundCampaigns = useCallback(async () => {
    try {
      setLoadingInbound(true);
      const res = await api.get('/campaigns', { params: { type: 'inbound_ad' } });
      if (res.data?.success) {
        setInboundCampaigns(res.data.campaigns || []);
      } else if (Array.isArray(res.data)) {
        setInboundCampaigns(res.data);
      }
    } catch (err) {
      console.error('Failed to load inbound campaigns:', err);
      toast.error('Failed to load inbound marketing campaigns');
    } finally {
      setLoadingInbound(false);
    }
  }, []);

  // Fetch Broadcast Campaigns (Existing)
  const fetchBroadcastCampaigns = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await api.get('/campaigns', { params: { type: 'broadcast' } });
      setBroadcastCampaigns(Array.isArray(res.data) ? res.data : res.data?.campaigns || []);
    } catch {
      toast.error('Failed to load broadcast campaigns');
    } finally {
      isFetchingRef.current = false;
      setLoadingBroadcast(false);
    }
  }, []);

  useEffect(() => {
    fetchInboundCampaigns();
    fetchBroadcastCampaigns();
  }, [fetchInboundCampaigns, fetchBroadcastCampaigns]);

  // Toggle Inbound Campaign Status (Active / Paused)
  const handleToggleInboundStatus = async (campaign) => {
    try {
      const res = await api.put(`/campaigns/${campaign._id}/toggle`);
      if (res.data?.success) {
        toast.success(`Campaign ${res.data.status === 'active' ? 'activated' : 'paused'}`);
        fetchInboundCampaigns();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update campaign status');
    }
  };

  // Delete Inbound Campaign
  const handleDeleteInboundCampaign = async (campaignId, campaignName) => {
    if (!confirm(`Are you sure you want to delete campaign "${campaignName}"?`)) return;
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success('Campaign removed');
      fetchInboundCampaigns();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete campaign');
    }
  };

  // Broadcast campaign action handlers
  const handlePause = async (id) => {
    try {
      await api.post(`/campaigns/${id}/pause`);
      toast.success('Campaign paused');
      fetchBroadcastCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pause campaign');
    }
  };

  const handleResume = async (id) => {
    try {
      await api.post(`/campaigns/${id}/resume`);
      toast.success('Campaign resumed');
      fetchBroadcastCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume campaign');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success('Campaign cancelled');
      fetchBroadcastCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel campaign');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'queued': return { bg: 'rgba(234,179,8,0.1)', fg: '#eab308' };
      case 'running': return { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6' };
      case 'paused': return { bg: 'rgba(249,115,22,0.1)', fg: '#f97316' };
      case 'completed': return { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e' };
      case 'cancelled': return { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' };
      default: return { bg: 'rgba(148,163,184,0.1)', fg: '#94a3b8' };
    }
  };

  // Filtered Inbound Campaigns
  const filteredInbound = inboundCampaigns.filter((c) => {
    const nameMatch = (c.name || c.displayName || '').toLowerCase().includes(inboundSearch.toLowerCase());
    const platformMatch = !inboundPlatformFilter || c.platform === inboundPlatformFilter;
    const statusMatch = !inboundStatusFilter || c.status === inboundStatusFilter;
    return nameMatch && platformMatch && statusMatch;
  });

  // Filtered Broadcast Campaigns
  const filteredBroadcast = broadcastCampaigns.filter((c) => {
    const matchesSearch = (c.name || '').toLowerCase().includes(broadcastSearch.toLowerCase()) ||
                          (c.template || '').toLowerCase().includes(broadcastSearch.toLowerCase());
    const matchesStatus = !broadcastStatusFilter || c.status === broadcastStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate Inbound Stats
  const inboundStats = {
    totalCampaigns: inboundCampaigns.length,
    totalLeads: inboundCampaigns.reduce((acc, c) => acc + (c.leadCount || c.leadsGenerated || 0), 0),
    totalAssigned: inboundCampaigns.reduce((acc, c) => acc + (c.assignedCount || 0), 0),
    totalConverted: inboundCampaigns.reduce((acc, c) => acc + (c.convertedCount || 0), 0),
  };

  // Broadcast Stats
  const broadcastStats = {
    total: broadcastCampaigns.length,
    active: broadcastCampaigns.filter((c) => c.status === 'running').length,
    completed: broadcastCampaigns.filter((c) => c.status === 'completed').length,
    paused: broadcastCampaigns.filter((c) => c.status === 'paused').length,
  };

  const getPlatformBadge = (platform) => {
    switch (String(platform || '').toLowerCase()) {
      case 'meta':
        return { label: 'Meta Ads', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'google':
        return { label: 'Google Ads', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'website':
        return { label: 'Website Webhook', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'sheets':
        return { label: 'Google Sheets', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      default:
        return { label: 'Multi-Channel', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
  };

  return (
    <div className="app-shell pb-mobile-nav">
      <div className="page-container max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8">
        {/* Page Top Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title text-xl sm:text-2xl font-extrabold m-0 text-slate-900">
                Marketing & Campaigns
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Authoritative Routing
              </span>
            </div>
            <p className="page-subtitle m-0 mt-1 text-xs sm:text-sm text-slate-500">
              Track lead origin attribution across Meta, Google, and Webhooks with authoritative counselor assignment
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'inbound' && (
              <button
                onClick={() => {
                  setSelectedCampaignForEdit(null);
                  setIsCampaignModalOpen(true);
                }}
                className="btn btn-primary px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Plus size={16} />
                New Campaign
              </button>
            )}
            <button
              onClick={() => {
                if (activeTab === 'inbound') fetchInboundCampaigns();
                else fetchBroadcastCampaigns();
              }}
              title="Refresh Campaigns"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Primary Dual Tab Switcher */}
        <div className="flex border-b border-slate-200 mb-5 gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('inbound')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'inbound'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Target size={17} />
            Inbound Ad Campaigns
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 text-indigo-700 font-bold">
              {inboundCampaigns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'broadcast'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageCircle size={17} />
            WhatsApp Broadcasts
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-600 font-bold">
              {broadcastCampaigns.length}
            </span>
          </button>
        </div>

        {/* TAB 1: INBOUND ADVERTISING CAMPAIGNS (THE CORE CEO REQUIREMENT) */}
        {activeTab === 'inbound' && (
          <div className="space-y-5">
            {/* Executive KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Campaigns
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {inboundStats.totalCampaigns}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <span className="text-emerald-600 font-semibold">
                    {inboundCampaigns.filter((c) => c.status === 'active').length} Active
                  </span>
                  • {inboundCampaigns.filter((c) => c.status === 'paused').length} Paused
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Leads Routed
                </div>
                <div className="text-2xl font-black text-indigo-600 mt-1">
                  {inboundStats.totalLeads}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Captured via Integration Forms
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Assigned to Counselors
                </div>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {inboundStats.totalAssigned}
                </div>
                <div className="text-xs text-emerald-600 font-medium mt-1">
                  {inboundStats.totalLeads > 0
                    ? `${Math.round((inboundStats.totalAssigned / inboundStats.totalLeads) * 100)}% Assignment Rate`
                    : '100% Routed by Rule'}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Converted Admissions
                </div>
                <div className="text-2xl font-black text-purple-600 mt-1">
                  {inboundStats.totalConverted}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {inboundStats.totalLeads > 0
                    ? `${Math.round((inboundStats.totalConverted / inboundStats.totalLeads) * 100)}% Conversion Rate`
                    : 'Awaiting Conversions'}
                </div>
              </div>
            </div>

            {/* Inbound Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="relative w-full sm:w-80">
                <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search inbound campaigns..."
                  value={inboundSearch}
                  onChange={(e) => setInboundSearch(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={inboundPlatformFilter}
                  onChange={(e) => setInboundPlatformFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex-1 sm:flex-none"
                >
                  <option value="">All Channels</option>
                  <option value="meta">Meta Ads</option>
                  <option value="google">Google Ads</option>
                  <option value="website">Website Webhooks</option>
                  <option value="sheets">Google Sheets</option>
                </select>

                <select
                  value={inboundStatusFilter}
                  onChange={(e) => setInboundStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex-1 sm:flex-none"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active (Routing)</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            {/* Inbound Campaigns List */}
            {loadingInbound && inboundCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <div className="spinner w-7 h-7 border-2 border-indigo-600/20 border-t-indigo-600" />
                <div className="text-xs">Loading marketing campaigns...</div>
              </div>
            ) : filteredInbound.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <Target size={28} />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {inboundSearch || inboundPlatformFilter || inboundStatusFilter
                    ? 'No matching campaigns found'
                    : 'No Inbound Campaigns Created Yet'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto mb-5">
                  Create a campaign to automatically capture leads arriving from specific Meta forms (e.g. &quot;X form&quot;), Google accounts, or landing pages, and authoritatively route them to dedicated counselors.
                </p>
                <button
                  onClick={() => {
                    setSelectedCampaignForEdit(null);
                    setIsCampaignModalOpen(true);
                  }}
                  className="btn btn-primary px-4 py-2 text-xs font-bold rounded-xl inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  Create First Inbound Campaign
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredInbound.map((c) => {
                  const badge = getPlatformBadge(c.platform);
                  const leadCount = c.leadCount || c.leadsGenerated || 0;
                  const assignedCount = c.assignedCount || leadCount;
                  const convertedCount = c.convertedCount || 0;

                  return (
                    <div
                      key={c._id}
                      className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all p-5 flex flex-col justify-between"
                    >
                      {/* Top Header */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${badge.bg}`}>
                              {badge.label}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                c.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>

                          {/* Quick Toggle Active/Pause */}
                          <button
                            onClick={() => handleToggleInboundStatus(c)}
                            title={c.status === 'active' ? 'Pause Campaign Routing' : 'Activate Campaign Routing'}
                            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                              c.status === 'active'
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {c.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                          </button>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 m-0">
                          {c.name || c.displayName}
                        </h3>
                        {c.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {c.description}
                          </p>
                        )}

                        {/* Routing & Origin Tag */}
                        <div className="mt-3.5 space-y-2">
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Captured Inbound Origins:
                            </div>
                            <div className="font-medium text-slate-700">
                              {c.routingSummary || 'Auto-Provisioned Integration Mapping'}
                            </div>
                          </div>

                          {/* Authoritative Assignment Badge */}
                          <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
                            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <UserCheck size={12} />
                              Authoritative Assignment Rule:
                            </div>
                            <div className="font-semibold text-indigo-950">
                              {c.assignmentRule?.type === 'specific_counselor'
                                ? `Dedicated: ${c.counselorNames?.[0] || 'Specific Counselor'}`
                                : c.counselorNames?.length > 0
                                ? `Round-Robin: ${c.counselorNames.join(', ')}`
                                : 'Round-Robin Pool'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Metrics & Actions */}
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-3 gap-2 text-center mb-4">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Leads</div>
                            <div className="text-base font-extrabold text-slate-900 mt-0.5">{leadCount}</div>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Assigned</div>
                            <div className="text-base font-extrabold text-indigo-600 mt-0.5">{assignedCount}</div>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Converted</div>
                            <div className="text-base font-extrabold text-emerald-600 mt-0.5">{convertedCount}</div>
                          </div>
                        </div>

                        {/* Actions Strip */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setSelectedCampaignForLeads(c);
                              setIsLeadsModalOpen(true);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Target size={14} />
                            Track Leads & Attribution
                          </button>

                          <button
                            onClick={() => {
                              setSelectedCampaignForEdit(c);
                              setIsCampaignModalOpen(true);
                            }}
                            title="Edit Campaign"
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => handleDeleteInboundCampaign(c._id, c.name)}
                            title="Delete Campaign"
                            className="p-2 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WHATSAPP BROADCAST CAMPAIGNS (100% PRESERVED FUNCTIONALITY) */}
        {activeTab === 'broadcast' && (
          <div className="page-content" style={{ padding: 0 }}>
            {/* Statistics Panel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mb-5">
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-value">{broadcastStats.total}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-value" style={{ color: '#3b82f6' }}>{broadcastStats.active}</div>
                <div className="stat-label">Sending</div>
              </div>
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-value" style={{ color: '#22c55e' }}>{broadcastStats.completed}</div>
                <div className="stat-label">Done</div>
              </div>
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-value" style={{ color: '#f97316' }}>{broadcastStats.paused}</div>
                <div className="stat-label">Paused</div>
              </div>
            </div>

            {/* Search & Filter bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div className="search-bar">
                <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search broadcast campaigns..."
                  value={broadcastSearch}
                  onChange={(e) => setBroadcastSearch(e.target.value)}
                  className="input"
                  style={{ border: 'none', padding: 0 }}
                />
              </div>

              <div className="filter-chips">
                {[
                  { id: '', label: 'All Broadcasts' },
                  { id: 'running', label: '⚡ Sending' },
                  { id: 'paused', label: '⏸️ Paused' },
                  { id: 'completed', label: '✅ Completed' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setBroadcastStatusFilter(t.id)}
                    className={`chip ${broadcastStatusFilter === t.id ? 'active' : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingBroadcast && broadcastCampaigns.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <div className="spinner" />
              </div>
            ) : filteredBroadcast.length === 0 ? (
              <div className="empty-state">
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    background: 'rgba(99,102,241,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    color: 'var(--accent)',
                  }}
                >
                  <MessageCircle size={32} />
                </div>
                <h3>No broadcast campaigns found</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                  {broadcastSearch || broadcastStatusFilter
                    ? 'Try clearing your filters or search query.'
                    : 'Launch a campaign from the Groups tab to get started.'}
                </p>
                {!broadcastSearch && !broadcastStatusFilter && hasPermission(user, 'campaigns.launch') && (
                  <Link href="/groups" className="btn btn-primary">
                    Go to Groups
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredBroadcast.map((c) => {
                  const colors = getStatusColor(c.status);
                  const progress = c.totalLeads > 0 ? Math.round(((c.lastSentIndex + 1) / c.totalLeads) * 100) : 0;

                  return (
                    <div key={c._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{c.name}</h3>
                          <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                            📅{' '}
                            {new Date(c.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: colors.bg,
                            color: colors.fg,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          {c.status}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          background: 'var(--surface)',
                          padding: 10,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {c.template?.length > 90 ? c.template.slice(0, 90) + '...' : c.template}
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Sent Progress</span>
                          <strong>
                            {c.lastSentIndex + 1} / {c.totalLeads} ({progress}%)
                          </strong>
                        </div>
                        <div className="progress-bar" style={{ height: 6, background: 'var(--border)' }}>
                          <div className="progress-fill" style={{ width: `${progress}%`, background: colors.fg }} />
                        </div>
                      </div>

                      {c.status === 'failed' && c.error && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            color: 'var(--red)',
                            fontSize: 11,
                            background: 'rgba(239,68,68,0.05)',
                            padding: 8,
                            borderRadius: 6,
                            border: '1px solid rgba(239,68,68,0.1)',
                          }}
                        >
                          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>Error: {c.error}</span>
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          borderTop: '1px solid var(--border)',
                          paddingTop: 10,
                          marginTop: 4,
                        }}
                      >
                        <Link
                          href={`/campaigns/${c._id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={13} /> View Log details
                        </Link>

                        {hasPermission(user, 'campaigns.cancel') && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {c.status === 'running' || c.status === 'queued' ? (
                              <button
                                onClick={() => handlePause(c._id)}
                                className="btn btn-ghost btn-sm"
                                style={{
                                  color: 'var(--orange)',
                                  borderColor: 'rgba(249,115,22,0.2)',
                                  padding: '6px 10px',
                                }}
                              >
                                <Pause size={13} /> Pause
                              </button>
                            ) : c.status === 'paused' ? (
                              <button
                                onClick={() => handleResume(c._id)}
                                className="btn btn-ghost btn-sm"
                                style={{
                                  color: 'var(--green)',
                                  borderColor: 'rgba(34,197,94,0.2)',
                                  padding: '6px 10px',
                                }}
                              >
                                <Play size={13} /> Resume
                              </button>
                            ) : null}

                            {(c.status === 'running' || c.status === 'queued' || c.status === 'paused') && (
                              <button
                                onClick={() => handleCancel(c._id)}
                                className="btn btn-ghost btn-sm"
                                style={{
                                  color: 'var(--red)',
                                  borderColor: 'rgba(239,68,68,0.2)',
                                  padding: '6px 10px',
                                }}
                              >
                                <XCircle size={13} /> Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campaign Creation / Edit Wizard Modal */}
      <CampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => {
          setIsCampaignModalOpen(false);
          setSelectedCampaignForEdit(null);
        }}
        campaign={selectedCampaignForEdit}
        onSaved={fetchInboundCampaigns}
      />

      {/* Campaign Lead Tracking & Attribution Modal */}
      <CampaignLeadsModal
        isOpen={isLeadsModalOpen}
        onClose={() => {
          setIsLeadsModalOpen(false);
          setSelectedCampaignForLeads(null);
        }}
        campaign={selectedCampaignForLeads}
      />

      <BottomNav active="campaigns" />
    </div>
  );
}
