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
import { waLink, getUser, hasPermission, canPerformAction, canViewField } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Users, Search, Plus, Upload, Download, Phone, MessageSquare,
  Calendar, CheckCircle2, ChevronRight, AlertTriangle,
  ArrowUpDown, Filter, Sparkles, RefreshCw, Layers, Check, Edit2,
  Flame, Clock, Building2, MapPin, Tag, GraduationCap, ArrowRightLeft,
  MoreHorizontal, SlidersHorizontal, X
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import dynamic from 'next/dynamic';
import { STAGE_LABELS, STATUS_COLORS } from '@/components/LeadModals';

const UpgradeModal = dynamic(() => import('@/components/LeadModals').then(m => m.UpgradeModal), { ssr: false });
const ImportLeadsModal = dynamic(() => import('@/components/LeadModals').then(m => m.ImportLeadsModal), { ssr: false });
const ExportLeadsModal = dynamic(() => import('@/components/LeadModals').then(m => m.ExportLeadsModal), { ssr: false });
const AddLeadModal = dynamic(() => import('@/components/LeadModals').then(m => m.AddLeadModal), { ssr: false });
const EditLeadModal = dynamic(() => import('@/components/LeadModals').then(m => m.EditLeadModal), { ssr: false });
const ScheduleFollowUpModal = dynamic(() => import('@/components/LeadModals').then(m => m.ScheduleFollowUpModal), { ssr: false });
const CompleteFollowUpModal = dynamic(() => import('@/components/LeadModals').then(m => m.CompleteFollowUpModal), { ssr: false });
const TransferLeadsModal = dynamic(() => import('@/components/leads/TransferLeadsModal'), { ssr: false });

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

  useEffect(() => {
    const handleUserUpdate = () => {
      setUser(getUser());
    };
    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);

  const [allFollowUps, setAllFollowUps] = useState([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
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

  // Bulk Selection & Transfer
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (tempFilter && activeTab !== 'hot') count++;
    if (platformFilter) count++;
    if (campaignFilter) count++;
    if (connectionFilter) count++;
    if (assignedToFilter) count++;
    if (startDateFilter) count++;
    if (endDateFilter) count++;
    if (testFilter !== 'all') count++;
    return count;
  }, [statusFilter, tempFilter, activeTab, platformFilter, campaignFilter, connectionFilter, assignedToFilter, startDateFilter, endDateFilter, testFilter]);

  const resetAllFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('');
    setTempFilter(activeTab === 'hot' ? 'HOT' : '');
    setSourceFilter('');
    setPlatformFilter('');
    setCampaignFilter('');
    setConnectionFilter('');
    setAssignedToFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setTestFilter('all');
    setPage(1);
  }, [activeTab]);

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
    if (allFollowUps.length === 0) setFollowUpsLoading(true);
    try {
      const [todayRes, allRes] = await Promise.all([
        cachedGet('/leads/follow-ups/today').catch(() => ({ data: [] })),
        cachedGet('/leads?hasFollowUp=true&limit=50').catch(() => ({ data: { leads: [] } })),
      ]);
      setAllFollowUps(allRes.data?.leads || (Array.isArray(todayRes.data) ? todayRes.data : []));
    } catch {
      // ignore
    } finally {
      setFollowUpsLoading(false);
    }
  }, [allFollowUps.length]);

  useEffect(() => {
    if (activeTab === 'followups') {
      fetchFollowUpsData();
    }
  }, [activeTab, fetchFollowUpsData]);

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

  // Bulk Transfer Permissions & Selection Logic
  const canTransfer = useMemo(() => {
    return (
      hasPermission(user, 'leads.transfer') ||
      hasPermission(user, 'leads.assign') ||
      user?.role === 'owner' ||
      user?.role === 'manager'
    );
  }, [user]);

  const toggleSelectLead = (leadId, e) => {
    if (e) e.stopPropagation();
    if (selectAllFiltered) {
      setSelectAllFiltered(false);
      setSelectedLeadIds(leads.map(l => l._id).filter(id => id !== leadId));
      return;
    }
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const toggleSelectAllPage = () => {
    const allPageSelected = leads.length > 0 && leads.every(l => selectedLeadIds.includes(l._id));
    if (allPageSelected || selectAllFiltered) {
      setSelectedLeadIds([]);
      setSelectAllFiltered(false);
    } else {
      setSelectedLeadIds(leads.map(l => l._id));
      setSelectAllFiltered(false);
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectAllFiltered(true);
    setSelectedLeadIds(leads.map(l => l._id));
  };

  const clearSelection = () => {
    setSelectedLeadIds([]);
    setSelectAllFiltered(false);
  };

  // Reset selection on filter or page change to prevent inadvertent operations
  useEffect(() => {
    setSelectedLeadIds([]);
    setSelectAllFiltered(false);
  }, [
    statusFilter, tempFilter, sourceFilter, streamFilter, locationFilter,
    platformFilter, connectionFilter, campaignFilter, assignedToFilter,
    debouncedSearch, startDateFilter, endDateFilter, testFilter, page
  ]);

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
              {/* Secondary Utilities Dropdown (Import, Export) */}
              {(hasPermission(user, 'leads.create') || hasPermission(user, 'leads.export')) && (
                <div className="relative">
                  <button
                    onClick={() => setShowActionsMenu(!showActionsMenu)}
                    className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 cursor-pointer"
                    title="Import, Export & Utilities"
                  >
                    <MoreHorizontal size={15} />
                    <span className="hidden xs:inline">More Tools</span>
                  </button>
                  {showActionsMenu && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fade-in"
                      onMouseLeave={() => setShowActionsMenu(false)}
                    >
                      {hasPermission(user, 'leads.create') && (
                        <button
                          onClick={() => {
                            setShowActionsMenu(false);
                            setShowImportModal(true);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Upload size={14} className="text-indigo-600" />
                          <span>Import Records (.xlsx, .csv)</span>
                        </button>
                      )}
                      {hasPermission(user, 'leads.export') && (
                        <button
                          onClick={() => {
                            setShowActionsMenu(false);
                            setShowExportModal(true);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Download size={14} className="text-indigo-600" />
                          <span>Export Data (.xlsx, .pdf)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Primary Action Button */}
              {hasPermission(user, 'leads.create') && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs sm:text-sm font-bold shadow-sm"
                >
                  <Plus size={16} /> <span>Add Candidate</span>
                </button>
              )}
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
              {/* Modern Search & Filter Toolbar (Progressive Disclosure & Cognitive Ergonomics) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 mb-3 shadow-xs">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Controls Row */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2.5 mt-2.5 border-t border-slate-100">
                  {/* Status / Stage Filter */}
                  <select
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none cursor-pointer shrink-0 transition"
                    value={statusFilter}
                    onChange={e => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All Pipeline Stages</option>
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
                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none cursor-pointer shrink-0 transition"
                      value={tempFilter}
                      onChange={e => {
                        setTempFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All Temperatures</option>
                      <option value="HOT">🔥 Hot (High Intent)</option>
                      <option value="WARM">⚡ Warm</option>
                      <option value="COLD">❄️ Cold</option>
                    </select>
                  )}

                  {/* Platform Filter */}
                  <select
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none cursor-pointer shrink-0 transition"
                    value={platformFilter}
                    onChange={e => {
                      setPlatformFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All Sources</option>
                    <option value="meta">🔵 Meta Ads</option>
                    <option value="google">🔴 Google Ads</option>
                    <option value="sheets">📊 Google Sheets</option>
                    <option value="website">🌐 Website Forms</option>
                    <option value="custom">⚡ Webhooks</option>
                    <option value="manual">📝 Direct / Manual</option>
                  </select>

                  {/* Attribution & Advanced Filters Drawer Trigger */}
                  <button
                    type="button"
                    onClick={() => setShowAttrFilters(!showAttrFilters)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 cursor-pointer ${
                      showAttrFilters || activeFilterCount > 0
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <SlidersHorizontal size={13} />
                    <span>Filters & Attribution</span>
                    {activeFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {/* Reset Filters */}
                  {(searchInput || debouncedSearch || activeFilterCount > 0) && (
                    <button
                      onClick={resetAllFilters}
                      className="px-2.5 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 font-bold transition shrink-0 ml-auto cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Active Filter Chips (Instant Situational Awareness) */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-3.5 px-1 animate-fade-in">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">
                    Active Filters:
                  </span>
                  {statusFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Stage: {STAGE_LABELS[statusFilter] || statusFilter}
                      <button onClick={() => { setStatusFilter(''); setPage(1); }} className="hover:text-indigo-900 ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {tempFilter && activeTab !== 'hot' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Temp: {tempFilter}
                      <button onClick={() => { setTempFilter(''); setPage(1); }} className="hover:text-amber-900 ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {platformFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                      Platform: {platformFilter}
                      <button onClick={() => { setPlatformFilter(''); setPage(1); }} className="hover:text-sky-900 ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {campaignFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                      Campaign: {campaignFilter}
                      <button onClick={() => { setCampaignFilter(''); setPage(1); }} className="hover:text-violet-900 ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {connectionFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Connection: {integrationsList.find(i => i._id === connectionFilter)?.accountName || integrationsList.find(i => i._id === connectionFilter)?.name || 'Custom'}
                      <button onClick={() => { setConnectionFilter(''); setPage(1); }} className="hover:text-emerald-900 ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {assignedToFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      Assigned: {assignedToFilter === 'unassigned' ? 'Unassigned' : (members.find(m => (m.userId || m._id) === assignedToFilter)?.name || 'Counselor')}
                      <button onClick={() => { setAssignedToFilter(''); setPage(1); }} className="hover:text-purple-900 ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {(startDateFilter || endDateFilter) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      Dates: {startDateFilter || '...'} to {endDateFilter || '...'}
                      <button onClick={() => { setStartDateFilter(''); setEndDateFilter(''); setPage(1); }} className="hover:text-slate-900 ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {testFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Payload: {testFilter}
                      <button onClick={() => { setTestFilter('all'); setPage(1); }} className="hover:text-amber-900 ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                </div>
              )}

              {/* Attribution & Campaign Filters Expanded Panel */}
              {showAttrFilters && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 mb-4 shadow-xs animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-4">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={16} className="text-indigo-600" />
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 m-0">Campaign Attribution & Deep Filters</h4>
                      {activeFilterCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          {activeFilterCount} Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                      >
                        Reset All
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAttrFilters(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded-md bg-white border border-slate-200 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {/* Column 1: Marketing & Campaign Attribution */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        📣 Marketing & Ad Source
                      </span>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Inbound Campaign
                          </label>
                          <select
                            className="input w-full text-xs h-9 bg-slate-50 border-slate-200"
                            value={campaignFilter}
                            onChange={e => {
                              setCampaignFilter(e.target.value);
                              setPage(1);
                            }}
                          >
                            <option value="">All Inbound Campaigns</option>
                            {inboundCampaigns.map(camp => (
                              <option key={camp._id} value={camp.campaignName || camp.name}>
                                {camp.displayName || camp.campaignName || camp.name} ({camp.platform})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Connection / Ad Asset
                          </label>
                          <select
                            className="input w-full text-xs h-9 bg-slate-50 border-slate-200"
                            value={connectionFilter}
                            onChange={e => {
                              setConnectionFilter(e.target.value);
                              setPage(1);
                            }}
                          >
                            <option value="">All Connections</option>
                            {integrationsList.map(intg => (
                              <option key={intg._id} value={intg._id}>
                                {intg.accountName || intg.pageName || `${intg.provider} Integration`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Team Member & Lead Mode */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        👥 Counselor & Quality
                      </span>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Assigned Counselor / Manager
                          </label>
                          <select
                            className="input w-full text-xs h-9 bg-slate-50 border-slate-200"
                            value={assignedToFilter}
                            onChange={e => {
                              setAssignedToFilter(e.target.value);
                              setPage(1);
                            }}
                          >
                            <option value="">All Team Members</option>
                            <option value="unassigned">Unassigned (In Pool)</option>
                            {members.map((m, idx) => {
                              const val = m.userId?._id || m.userId || m._id || m.id;
                              const uniqueKey = m._id ? `membership-${m._id}` : (val ? `user-${val}` : `member-${idx}`);
                              return (
                                <option key={uniqueKey} value={val}>
                                  {m.name || m.email} ({m.role || 'Member'})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Lead Nature
                          </label>
                          <select
                            className="input w-full text-xs h-9 bg-slate-50 border-slate-200"
                            value={testFilter}
                            onChange={e => {
                              setTestFilter(e.target.value);
                              setPage(1);
                            }}
                          >
                            <option value="all">All (Real & Test)</option>
                            <option value="real">Real Leads Only</option>
                            <option value="test">Test / Simulated Only</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Lead Ingestion Date Range */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        📅 Ingestion Timeline
                      </span>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            From Date
                          </label>
                          <input
                            type="date"
                            className="input w-full text-xs h-9 bg-slate-50 border-slate-200"
                            value={startDateFilter}
                            onChange={e => {
                              setStartDateFilter(e.target.value);
                              setPage(1);
                            }}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            To Date
                          </label>
                          <input
                            type="date"
                            className="input w-full text-xs h-9 bg-slate-50 border-slate-200"
                            value={endDateFilter}
                            onChange={e => {
                              setEndDateFilter(e.target.value);
                              setPage(1);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Selection and Lead Transfer Toolbar (Desktop Sticky Banner) */}
              {canTransfer && leads.length > 0 && (selectedLeadIds.length > 0 || selectAllFiltered) && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl shadow-xs animate-fade-in">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-indigo-900">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-indigo-300 cursor-pointer"
                        checked={
                          selectAllFiltered || (leads.length > 0 && leads.every(l => selectedLeadIds.includes(l._id)))
                        }
                        onChange={toggleSelectAllPage}
                      />
                      <span>Select Page ({leads.filter(l => selectedLeadIds.includes(l._id)).length}/{leads.length})</span>
                    </label>

                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200 shadow-2xs">
                      {selectAllFiltered ? `All ${totalLeads} Filtered Leads Selected` : `${selectedLeadIds.length} Selected`}
                    </span>

                    {/* Cross-page selection link if total leads exceed page size */}
                    {selectedLeadIds.length === leads.length && totalLeads > leads.length && !selectAllFiltered && (
                      <button
                        onClick={handleSelectAllFiltered}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline transition cursor-pointer"
                      >
                        Select all {totalLeads} leads across all pages matching current filters
                      </button>
                    )}

                    {selectAllFiltered && (
                      <span className="text-xs text-indigo-600 font-medium">
                        (Bulk action will apply to all {totalLeads} leads across all pages)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearSelection}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-white transition cursor-pointer"
                    >
                      Clear Selection
                    </button>
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition active:scale-95 cursor-pointer"
                    >
                      <ArrowRightLeft size={13} />
                      <span>Transfer Leads ({selectAllFiltered ? totalLeads : selectedLeadIds.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mobile Floating Action Dock (Ergonomic Thumb Zone - Fitts' Law) */}
              {canTransfer && (selectedLeadIds.length > 0 || selectAllFiltered) && (
                <div className="fixed bottom-16 inset-x-3.5 z-40 md:hidden bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between border border-slate-700/60 animate-slide-up">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                      {selectAllFiltered ? totalLeads : selectedLeadIds.length}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white leading-tight">
                        {selectAllFiltered ? 'All Filtered' : 'Candidates Selected'}
                      </span>
                      <button
                        onClick={clearSelection}
                        className="text-[11px] text-slate-400 hover:text-white text-left font-medium underline cursor-pointer"
                      >
                        Deselect
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md active:scale-95 transition cursor-pointer"
                  >
                    <ArrowRightLeft size={14} />
                    <span>Transfer Leads</span>
                  </button>
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
                    {(debouncedSearch || searchInput) || statusFilter || tempFilter
                      ? 'No candidates match your current search criteria. Try clearing filters.'
                      : 'You do not have any candidate leads here yet. Add a new prospect or import records.'}
                  </p>
                  {hasPermission(user, 'leads.create') && (
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                      <Plus size={15} /> Add First Candidate
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leads.map(lead => {
                    const temp = lead.temperature || (lead.score >= 70 ? 'HOT' : lead.score >= 40 ? 'WARM' : 'COLD');
                    const tempBg = temp === 'HOT' ? 'rgba(239, 68, 68, 0.12)' : temp === 'WARM' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.12)';
                    const tempColor = temp === 'HOT' ? '#ef4444' : temp === 'WARM' ? '#f59e0b' : '#64748b';
                    const isSelected = selectAllFiltered || selectedLeadIds.includes(lead._id);

                    return (
                      <div
                        key={lead._id}
                        onClick={() => router.push(`/leads/${lead._id}`)}
                        className={`card hover-glow cursor-pointer virtual-card-item transition-all hover:border-indigo-300 hover:shadow-xs p-3 sm:p-4 flex items-center justify-between flex-wrap gap-3 ${
                          isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''
                        }`}
                        data-context-type="lead"
                        data-context-id={lead._id}
                        data-context-record={JSON.stringify({
                          id: lead._id,
                          name: lead.name,
                          phone: lead.phone,
                          email: lead.email,
                          status: lead.status,
                        })}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 w-full" style={{ flexBasis: '240px' }}>
                          {canTransfer && (
                            <div
                              className="flex items-center justify-center shrink-0 pr-0.5"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                checked={isSelected}
                                onChange={e => toggleSelectLead(lead._id, e)}
                                title="Select candidate for bulk transfer"
                              />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <Link
                                href={`/leads/${lead._id}`}
                                onClick={e => e.stopPropagation()}
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
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
                        <div
                          className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 min-w-0"
                          onClick={e => e.stopPropagation()}
                        >
                          {canPerformAction(user, 'leads.edit', lead) && (
                            <select
                              className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer flex-1 sm:flex-none min-w-[110px] transition"
                              value={lead.status}
                              onClick={e => e.stopPropagation()}
                              onChange={e => handleStageChange(lead._id, e.target.value)}
                            >
                              <option value="new_lead">🆕 1. New Lead</option>
                              <option value="contacted">📞 2. Tele-Counsel</option>
                              <option value="shortlisted">📋 3. Shortlisted</option>
                              <option value="site_visit_scheduled">🏛️ 4. Campus Visit</option>
                              <option value="negotiation">💳 5. Quota Booking</option>
                              <option value="converted">🎓 6. Confirmed Won</option>
                              <option value="lost">❌ Dropped / Lost</option>
                            </select>
                          )}

                          {canPerformAction(user, 'followups.create', lead) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSchedulingFollowUpLead(lead);
                              }}
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition shrink-0 cursor-pointer min-w-0"
                              title="Schedule Follow-up"
                            >
                              <Clock size={13} /> <span>Follow-up</span>
                            </button>
                          )}

                          {canPerformAction(user, 'activities.create', lead) && (
                            <a
                              href={`tel:${lead.phone}`}
                              onClick={e => e.stopPropagation()}
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shrink-0 min-w-0"
                              title="Call"
                            >
                              <Phone size={13} /> <span>Call</span>
                            </a>
                          )}

                          {canPerformAction(user, 'whatsapp.send_one_to_one', lead) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const clean = String(lead.phone || '').replace(/\D/g, '');
                                const phoneParam = clean.length === 10 ? `91${clean}` : clean;
                                router.push(`/whatsapp?phone=${encodeURIComponent(phoneParam)}&leadId=${lead._id}&name=${encodeURIComponent(lead.name || '')}`);
                              }}
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition shrink-0 cursor-pointer min-w-0"
                              title="Open Official CRM WhatsApp"
                            >
                              <MessageSquare size={13} /> <span>WA</span>
                            </button>
                          )}
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

              {followUpsLoading ? (
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
      {showAddModal && hasPermission(user, 'leads.create') && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => fetchLeads()}
          onLimitReached={() => setShowUpgradeModal(true)}
          user={user}
        />
      )}

      {showImportModal && hasPermission(user, 'leads.create') && (
        <ImportLeadsModal
          onClose={() => setShowImportModal(false)}
          onImported={() => fetchLeads()}
          user={user}
        />
      )}

      {showExportModal && hasPermission(user, 'leads.export') && (
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

      {showTransferModal && canTransfer && (
        <TransferLeadsModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          selectedCount={selectAllFiltered ? totalLeads : selectedLeadIds.length}
          selectedLeadIds={selectedLeadIds}
          selectAllFiltered={selectAllFiltered}
          filterQuery={queryFilters}
          members={members}
          campaigns={inboundCampaigns}
          onTransferred={() => {
            clearSelection();
            fetchLeads();
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
