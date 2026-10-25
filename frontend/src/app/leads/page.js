'use client';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { cachedGet, getCachedData } from '@/lib/api';
import {
  leadsListOptions,
  membersOptions,
  inboundCampaignsOptions,
  integrationsOptions,
} from '@/lib/queries';
import { waLink, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Users, Search, Plus, Upload, Download, Phone, MessageSquare,
  Calendar, CheckCircle2, ChevronRight, AlertTriangle,
  ArrowUpDown, Filter, Sparkles, RefreshCw, Layers, Check, Edit2,
  Flame, Clock, Building2, MapPin, Tag, GraduationCap
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import {
  STAGE_LABELS, STATUS_COLORS, UpgradeModal, ImportLeadsModal,
  ExportLeadsModal, AddLeadModal, EditLeadModal, ScheduleFollowUpModal,
  CompleteFollowUpModal
} from '@/components/LeadModals';

function LeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab') || 'all';
  const activeTab = (rawTab === 'team_leads' || rawTab === 'my_leads') ? 'all' : rawTab;

  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
      } catch (e) {}
    }
    return null;
  });
  const [allFollowUps, setAllFollowUps] = useState([]);
  const [page, setPage] = useState(1);

  // Debounced Search UX (300ms delay, minimum 2 characters)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (!trimmed || trimmed.length >= 2) {
        setDebouncedSearch(trimmed);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [tempFilter, setTempFilter] = useState(activeTab === 'hot' ? 'HOT' : '');
  const [sourceFilter, setSourceFilter] = useState('');
  const [streamFilter, setStreamFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Source Hierarchy & Attribution Filters (Part 1.4)
  const initialPlatform = searchParams?.get('platform') || '';
  const initialCampaign = searchParams?.get('campaignName') || searchParams?.get('campaignId') || '';
  const initialConnection = searchParams?.get('connectionId') || '';
  const initialAssignedTo = searchParams?.get('assignedTo') || '';

  const [platformFilter, setPlatformFilter] = useState(initialPlatform);
  const [campaignFilter, setCampaignFilter] = useState(initialCampaign);
  const [connectionFilter, setConnectionFilter] = useState(initialConnection);
  const [assignedToFilter, setAssignedToFilter] = useState(initialAssignedTo);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [testFilter, setTestFilter] = useState('all'); // 'all' | 'real' | 'test'
  const [showAttrFilters, setShowAttrFilters] = useState(
    Boolean(initialPlatform || initialCampaign || initialConnection || initialAssignedTo)
  );

  const queryClient = useQueryClient();

  const queryFilters = useMemo(() => {
    const params = { page, limit: 25 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;
    if (tempFilter || activeTab === 'hot') params.temperature = activeTab === 'hot' ? 'HOT' : tempFilter;
    if (sourceFilter) params.source = sourceFilter;
    if (streamFilter) params.stream = streamFilter;
    if (locationFilter) params.location = locationFilter;
    if (platformFilter) params.platform = platformFilter;
    if (connectionFilter) params.connectionId = connectionFilter;
    if (campaignFilter) params.campaignId = campaignFilter;
    if (assignedToFilter) params.assignedTo = assignedToFilter;
    if (startDateFilter) params.startDate = startDateFilter;
    if (endDateFilter) params.endDate = endDateFilter;
    if (testFilter === 'test') params.isTest = 'true';
    if (testFilter === 'real') params.isTest = 'false';
    return params;
  }, [
    page, debouncedSearch, statusFilter, tempFilter, activeTab, sourceFilter, streamFilter,
    locationFilter, platformFilter, connectionFilter, campaignFilter, assignedToFilter,
    startDateFilter, endDateFilter, testFilter
  ]);

  const {
    data: leadsData,
    isLoading: isLeadsLoading,
    isFetching: isLeadsFetching,
  } = useQuery(leadsListOptions(queryFilters));

  const { data: members = [] } = useQuery(membersOptions());
  const { data: inboundCampaigns = [] } = useQuery(inboundCampaignsOptions());
  const { data: integrationsList = [] } = useQuery(integrationsOptions());

  const leads = leadsData?.leads || [];
  const totalLeads = leadsData?.total || leadsData?.pagination?.total || 0;
  const totalPages = leadsData?.pagination?.pages || Math.max(1, Math.ceil(totalLeads / 25));
  const loading = isLeadsLoading && leads.length === 0;

  // Follow-up Sub-Filter (for followups tab)
  const [followUpSubTab, setFollowUpSubTab] = useState('today');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [schedulingFollowUpLead, setSchedulingFollowUpLead] = useState(null);
  const [completingFollowUpLead, setCompletingFollowUpLead] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  // Format Indian Currency
  const formatINR = (val) => {
    if (!val || isNaN(val)) return null;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  const fetchLeads = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  }, [queryClient]);

  const fetchFollowUpsData = useCallback(async () => {
    if (allFollowUps.length === 0) setLoading(true);
    try {
      const [todayRes, allRes] = await Promise.all([
        cachedGet('/leads/follow-ups/today').catch(() => ({ data: [] })),
        cachedGet('/leads?hasFollowUp=true&limit=50').catch(() => ({ data: { leads: [] } })),
      ]);
      setAllFollowUps(allRes.data?.leads || (Array.isArray(todayRes.data) ? todayRes.data : []));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [allFollowUps.length]);

  useEffect(() => {
    if (activeTab === 'followups') {
      fetchFollowUpsData();
    } else {
      fetchLeads();
    }
  }, [activeTab, fetchLeads, fetchFollowUpsData]);

  useEffect(() => {
    if (searchParams?.get('action') === 'create') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleContextAction = (e) => {
      const { action, payload } = e.detail || {};
      if (action === 'NAV_CREATE_LEAD' || action === 'CREATE_LEAD') {
        setShowAddModal(true);
        return;
      }
      if (!payload?.id) return;
      const targetLead = leads.find((l) => String(l._id) === String(payload.id));
      if (!targetLead) return;

      if (action === 'OPEN_LEAD') {
        router.push(`/leads/${targetLead._id}`);
      } else if (action === 'SCHEDULE_FOLLOWUP') {
        setSchedulingFollowUpLead(targetLead);
      } else if (action === 'LOG_CALL') {
        if (targetLead.phone) {
          window.location.href = `tel:${targetLead.phone}`;
        } else {
          toast.error('No phone number recorded for this candidate');
        }
      } else if (action === 'EDIT_LEAD') {
        setEditingLead(targetLead);
      }
    };

    window.addEventListener('crm-context-action', handleContextAction);
    return () => window.removeEventListener('crm-context-action', handleContextAction);
  }, [leads, router]);

  const handleStageChange = async (leadId, newStage) => {
    try {
      await api.put(`/leads/${leadId}`, { status: newStage });
      toast.success(`Stage updated to ${STAGE_LABELS[newStage] || newStage}`);
      fetchLeads(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stage');
    }
  };

  return (
    <div className="app-container">
      <BottomNav active="leads" />

      <main className="main-content" data-crm-canvas="true">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5">
                <Users size={24} className="text-indigo-600 shrink-0" /> Candidate Leads Workspace
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Manage prospective students, college preferences, tele-counselling, and admission pipeline.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setShowImportModal(true)}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-semibold"
                title="Import Candidates"
              >
                <Upload size={14} /> <span className="hidden xs:inline">Import</span>
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-semibold"
                title="Export Records"
              >
                <Download size={14} /> <span className="hidden xs:inline">Export</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs sm:text-sm font-bold shadow-sm"
              >
                <Plus size={16} /> <span>Add Candidate</span>
              </button>
            </div>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4 overflow-x-auto no-scrollbar">
            {/* 1. All Candidates */}
            <button
              onClick={() => router.push('/leads?tab=all')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition whitespace-nowrap shrink-0 ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Users size={15} />
              <span>All Candidates</span>
              {totalLeads > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === 'all' ? 'bg-indigo-700/80 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {totalLeads}
                </span>
              )}
            </button>

            {/* 2. Hot Leads */}
            <button
              onClick={() => router.push('/leads?tab=hot')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition whitespace-nowrap shrink-0 ${
                activeTab === 'hot'
                  ? 'bg-red-500 text-white border-red-500 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Flame size={15} />
              <span>Hot Prospects</span>
            </button>

            {/* 3. Follow-ups */}
            <button
              onClick={() => router.push('/leads?tab=followups')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition whitespace-nowrap shrink-0 ${
                activeTab === 'followups'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Clock size={15} />
              <span>Scheduled Follow-ups</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB: ALL CANDIDATES & HOT LEADS                                           */}
          {/* ========================================================================= */}
          {(activeTab === 'all' || activeTab === 'hot') && (
            <div>
              {/* Modern Search & Filter Toolbar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-3.5 mb-4 shadow-sm">
                {/* Search Row */}
                <div className="relative w-full">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    className="input input-search w-full text-xs sm:text-sm pl-10 pr-9 h-10 bg-slate-50 hover:bg-white focus:bg-white border-slate-200 rounded-xl transition"
                    placeholder="Search candidate name, phone, course, state..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                  />
                  {searchInput && (
                    <button
                      onClick={() => {
                        setSearchInput('');
                        setDebouncedSearch('');
                        setPage(1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills Row */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2.5 mt-2.5 border-t border-slate-100">
                  {/* Status / Stage Filter */}
                  <select
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none cursor-pointer shrink-0 transition"
                    value={statusFilter}
                    onChange={e => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All Stages</option>
                    <option value="new_lead">🆕 Lead Received</option>
                    <option value="contacted">📞 Tele-Counselling</option>
                    <option value="shortlisted">📋 Options Shortlisted</option>
                    <option value="site_visit_scheduled">🏛️ Campus Visit</option>
                    <option value="negotiation">💳 Quota / Token Booking</option>
                    <option value="converted">🎓 Admission Confirmed</option>
                    <option value="lost">❌ Lost</option>
                  </select>

                  {/* Temperature Filter */}
                  {activeTab !== 'hot' && (
                    <select
                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none cursor-pointer shrink-0 transition"
                      value={tempFilter}
                      onChange={e => {
                        setTempFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All Temperatures</option>
                      <option value="HOT">🔥 Hot</option>
                      <option value="WARM">⚡ Warm</option>
                      <option value="COLD">❄️ Cold</option>
                    </select>
                  )}

                  {/* Platform Filter */}
                  <select
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none cursor-pointer shrink-0 transition"
                    value={platformFilter}
                    onChange={e => {
                      setPlatformFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All Platforms</option>
                    <option value="meta">🔵 Meta Ads</option>
                    <option value="google">🔴 Google Ads</option>
                    <option value="sheets">📊 Google Sheets</option>
                    <option value="website">🌐 Website Forms</option>
                    <option value="custom">⚡ Custom Webhook</option>
                    <option value="manual">📝 Direct / Manual</option>
                  </select>

                  {/* Attribution Filters Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowAttrFilters(!showAttrFilters)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition shrink-0 ${
                      showAttrFilters || campaignFilter || connectionFilter || assignedToFilter || startDateFilter || endDateFilter || testFilter !== 'all'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Filter size={13} />
                    <span>Attribution</span>
                    {(campaignFilter || connectionFilter || assignedToFilter || startDateFilter || endDateFilter || testFilter !== 'all') && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    )}
                  </button>

                  {/* Reset Filters */}
                  {(searchInput || debouncedSearch || statusFilter || tempFilter || platformFilter || campaignFilter || connectionFilter || assignedToFilter || startDateFilter || endDateFilter || testFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchInput('');
                        setDebouncedSearch('');
                        setStatusFilter('');
                        setTempFilter('');
                        setSourceFilter('');
                        setPlatformFilter('');
                        setCampaignFilter('');
                        setConnectionFilter('');
                        setAssignedToFilter('');
                        setStartDateFilter('');
                        setEndDateFilter('');
                        setTestFilter('all');
                        setPage(1);
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 font-medium transition shrink-0 ml-auto"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {/* Attribution & Campaign Filters Expanded Panel (Part 1.4) */}
              {showAttrFilters && (
                <div style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 16,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12
                }}>
                  {/* Connection / Asset Filter */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      CONNECTION / ASSET:
                    </label>
                    <select
                      className="input"
                      value={connectionFilter}
                      onChange={e => {
                        setConnectionFilter(e.target.value);
                        setPage(1);
                      }}
                      style={{ height: 36, fontSize: 12, width: '100%' }}
                    >
                      <option value="">All Connections</option>
                      {integrationsList.map(intg => (
                        <option key={intg._id} value={intg._id}>
                          {intg.accountName || intg.pageName || `${intg.provider} Integration`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Campaign Filter */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      CAMPAIGN:
                    </label>
                    <select
                      className="input"
                      value={campaignFilter}
                      onChange={e => {
                        setCampaignFilter(e.target.value);
                        setPage(1);
                      }}
                      style={{ height: 36, fontSize: 12, width: '100%' }}
                    >
                      <option value="">All Inbound Campaigns</option>
                      {inboundCampaigns.map(camp => (
                        <option key={camp._id} value={camp.campaignName || camp.name}>
                          {camp.displayName || camp.campaignName || camp.name} ({camp.platform})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assigned Counselor Filter */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      ASSIGNED TO (COUNSELOR):
                    </label>
                    <select
                      className="input"
                      value={assignedToFilter}
                      onChange={e => {
                        setAssignedToFilter(e.target.value);
                        setPage(1);
                      }}
                      style={{ height: 36, fontSize: 12, width: '100%' }}
                    >
                      <option value="">All Counselors</option>
                      <option value="unassigned">Unassigned (In Pool)</option>
                      {members.map(m => (
                        <option key={m.userId || m._id} value={m.userId || m._id}>
                          {m.name || m.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Test vs Real Filter */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      TEST / REAL PAYLOAD:
                    </label>
                    <select
                      className="input"
                      value={testFilter}
                      onChange={e => {
                        setTestFilter(e.target.value);
                        setPage(1);
                      }}
                      style={{ height: 36, fontSize: 12, width: '100%' }}
                    >
                      <option value="all">All (Real & Test)</option>
                      <option value="real">Real Leads Only</option>
                      <option value="test">Test / Simulated Only</option>
                    </select>
                  </div>

                  {/* Date Range Start */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      FROM DATE:
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={startDateFilter}
                      onChange={e => {
                        setStartDateFilter(e.target.value);
                        setPage(1);
                      }}
                      style={{ height: 36, fontSize: 12, width: '100%' }}
                    />
                  </div>

                  {/* Date Range End */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      TO DATE:
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={endDateFilter}
                      onChange={e => {
                        setEndDateFilter(e.target.value);
                        setPage(1);
                      }}
                      style={{ height: 36, fontSize: 12, width: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* Leads List */}
              {loading && leads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading candidate leads...</p>
                </div>
              ) : leads.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  background: 'var(--card)',
                  borderRadius: 16,
                  border: '1px solid var(--border)'
                }}>
                  <Users size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>No Candidates Found</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 18px' }}>
                    {search || statusFilter || tempFilter
                      ? 'No candidates match your current search criteria. Try clearing filters.'
                      : 'You do not have any candidate leads here yet. Add a new prospect or import records.'}
                  </p>
                  <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                    <Plus size={15} /> Add First Candidate
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leads.map(lead => {
                    const temp = lead.temperature || (lead.score >= 70 ? 'HOT' : lead.score >= 40 ? 'WARM' : 'COLD');
                    const tempBg = temp === 'HOT' ? 'rgba(239, 68, 68, 0.12)' : temp === 'WARM' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.12)';
                    const tempColor = temp === 'HOT' ? '#ef4444' : temp === 'WARM' ? '#f59e0b' : '#64748b';

                    return (
                      <div
                        key={lead._id}
                        className="card hover-glow cursor-default virtual-card-item"
                        data-context-type="lead"
                        data-context-id={lead._id}
                        data-context-record={JSON.stringify({
                          id: lead._id,
                          name: lead.name,
                          phone: lead.phone,
                          email: lead.email,
                          status: lead.status,
                        })}
                        style={{
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 14,
                          transition: 'border-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 240px', minWidth: 0, width: '100%' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <Link
                                href={`/leads/${lead._id}`}
                                style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                              >
                                {lead.name || 'Unnamed Candidate'}
                              </Link>
                              
                              {/* Temperature & Score Badge */}
                              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: tempBg, color: tempColor }}>
                                {temp === 'HOT' ? '🔥 HOT' : temp === 'WARM' ? '⚡ WARM' : '❄️ COLD'} ({lead.score ?? 20} pts)
                              </span>

                              <SourcePill lead={lead} showDetail={true} />
                              {lead.assignedTo?.name && (
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1"
                                  title={`Assigned Counselor: ${lead.assignedTo.name}`}
                                >
                                  👤 {lead.assignedTo.name}
                                </span>
                              )}
                              <span className={`badge ${STATUS_COLORS[lead.status] || 'badge-tag'}`} style={{ fontSize: 10.5 }}>
                                {STAGE_LABELS[lead.status] || lead.status}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                              <span>📞 {lead.phone}</span>
                              {lead.location && <span>📍 {lead.location}</span>}
                              {lead.customData?.courseInterested && (
                                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                  🎓 {lead.customData.courseInterested}
                                </span>
                              )}
                              {lead.budget && (
                                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                                  💰 Fee: {formatINR(lead.budget)}
                                </span>
                              )}
                              {lead.nextFollowUp && (
                                <span style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Clock size={12} /> {formatDisplayDateTime(lead.nextFollowUp)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-start sm:justify-end pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <select
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer flex-1 sm:flex-none transition"
                            value={lead.status}
                            onChange={e => handleStageChange(lead._id, e.target.value)}
                          >
                            <option value="new_lead">🆕 Lead Received</option>
                            <option value="contacted">📞 Tele-Counselling</option>
                            <option value="shortlisted">📋 Options Shortlisted</option>
                            <option value="site_visit_scheduled">🏛️ Campus Visit</option>
                            <option value="negotiation">💳 Quota Booking</option>
                            <option value="converted">🎓 Confirmed</option>
                            <option value="lost">❌ Lost</option>
                          </select>

                          <button
                            onClick={() => setSchedulingFollowUpLead(lead)}
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition shrink-0"
                            title="Schedule Follow-up"
                          >
                            <Clock size={13} /> <span>Follow-up</span>
                          </button>

                          <a
                            href={`tel:${lead.phone}`}
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shrink-0"
                            title="Call"
                          >
                            <Phone size={13} /> <span>Call</span>
                          </a>

                          <a
                            href={waLink(lead.phone, `Hi ${lead.name || ''}, regarding your admission inquiry...`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition shrink-0"
                            title="WhatsApp"
                          >
                            <MessageSquare size={13} /> <span>WA</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 24 }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="btn btn-ghost btn-sm"
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="btn btn-ghost btn-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: FOLLOW-UPS VIEW                                                      */}
          {/* ========================================================================= */}
          {activeTab === 'followups' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['today', 'overdue', 'upcoming'].map(st => (
                  <button
                    key={st}
                    onClick={() => setFollowUpSubTab(st)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: followUpSubTab === st ? 700 : 500,
                      background: followUpSubTab === st ? 'var(--accent)' : 'var(--card)',
                      color: followUpSubTab === st ? '#fff' : 'var(--text)',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {st} Follow-ups
                  </button>
                ))}
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading scheduled follow-ups...</p>
                </div>
              ) : allFollowUps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <Clock size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
                  <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>No Pending Follow-ups</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>You have no follow-up reminders scheduled for this filter.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allFollowUps.map(lead => (
                    <div
                      key={lead._id}
                      className="card hover-glow"
                      style={{
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Link href={`/leads/${lead._id}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                            {lead.name}
                          </Link>
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 700 }}>
                            ⏰ {formatDisplayDateTime(lead.nextFollowUp)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>📞 {lead.phone}</span>
                          {lead.followUpNote && <span style={{ marginLeft: 10 }}>• Note: &ldquo;{lead.followUpNote}&rdquo;</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setCompletingFollowUpLead(lead)}
                          className="btn btn-primary btn-sm"
                          style={{ gap: 4, fontSize: 12, background: '#10b981', borderColor: '#10b981' }}
                        >
                          <CheckCircle2 size={14} /> Done
                        </button>
                        <a href={`tel:${lead.phone}`} className="btn btn-ghost btn-sm" style={{ color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                          <Phone size={14} />
                        </a>
                        <a
                          href={waLink(lead.phone, `Hi ${lead.name}, this is regarding your admission consultation follow-up.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                        >
                          <MessageSquare size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => fetchLeads()}
          onLimitReached={() => setShowUpgradeModal(true)}
          user={user}
        />
      )}

      {showImportModal && (
        <ImportLeadsModal
          onClose={() => setShowImportModal(false)}
          onImported={() => fetchLeads()}
          user={user}
        />
      )}

      {showExportModal && (
        <ExportLeadsModal
          onClose={() => setShowExportModal(false)}
          leads={leads}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}

      {schedulingFollowUpLead && (
        <ScheduleFollowUpModal
          lead={schedulingFollowUpLead}
          onClose={() => setSchedulingFollowUpLead(null)}
          onScheduled={() => fetchLeads()}
        />
      )}

      {completingFollowUpLead && (
        <CompleteFollowUpModal
          lead={completingFollowUpLead}
          onClose={() => setCompletingFollowUpLead(null)}
          onCompleted={() => {
            fetchLeads();
            fetchFollowUpsData();
          }}
        />
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsContent />
    </Suspense>
  );
}
