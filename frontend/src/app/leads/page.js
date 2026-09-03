'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, isOwner, isManager, isAgent, isRealEstateTenant, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Users, Search, Plus, Upload, Download, Phone, MessageSquare,
  Calendar, CheckCircle2, ChevronRight, AlertTriangle, ShieldAlert,
  ArrowUpDown, Filter, Sparkles, RefreshCw, Layers, Check, Edit2,
  Flame, Clock, UserCheck, ArrowRightLeft, Building2, MapPin, Tag
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
  const rawTab = searchParams?.get('tab') || 'team_leads';
  const activeTab = rawTab === 'my_leads' ? 'team_leads' : rawTab;

  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [unclaimedLeads, setUnclaimedLeads] = useState([]);
  const [teamWorkload, setTeamWorkload] = useState([]);
  const [allFollowUps, setAllFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection & Bulk Actions
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tempFilter, setTempFilter] = useState(activeTab === 'hot' ? 'HOT' : '');
  const [sourceFilter, setSourceFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('');
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);

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
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignFromAgent, setReassignFromAgent] = useState('');
  const [reassignToAgent, setReassignToAgent] = useState('');

  // Transfer & Release Modals State
  const [transferringLead, setTransferringLead] = useState(null);
  const [transferToAgentId, setTransferToAgentId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const [releasingLead, setReleasingLead] = useState(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [isReleasing, setIsReleasing] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const isOwnerOrManager = isOwner(user) || isManager(user) || user?.role === 'superadmin';
  const isRE = isRealEstateTenant(user);

  // Fetch Projects list for filter
  useEffect(() => {
    api.get('/projects').then(res => setProjects(res.data || [])).catch(() => {});
  }, []);

  // Fetch Team Agents for Manager, Owner & Agents
  useEffect(() => {
    if (user) {
      api.get('/company/agents')
        .then(res => setAgents(res.data?.agents || res.data || []))
        .catch(() => {
          api.get('/agency/agents')
            .then(res => setAgents(res.data?.agents || res.data || []))
            .catch(() => {});
        });
    }
  }, [user]);

  // Format Indian Currency
  const formatINR = (val) => {
    if (!val || isNaN(val)) return null;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 25,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (tempFilter || activeTab === 'hot') params.temperature = activeTab === 'hot' ? 'HOT' : tempFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (projectFilter) params.projectId = projectFilter;
      if (agentFilter) params.assignedTo = agentFilter;
      if (locationFilter) params.location = locationFilter;

      const res = await api.get('/leads', { params });
      setLeads(res.data?.leads || []);
      setTotalLeads(res.data?.total || 0);
      setTotalPages(res.data?.pages || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tempFilter, activeTab, sourceFilter, projectFilter, agentFilter, locationFilter]);

  const fetchUnclaimedLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/leads?unclaimed=true&limit=50');
      setUnclaimedLeads(res.data?.leads || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDistributionData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/real-estate/team/workload');
      setTeamWorkload(res.data?.data || []);
    } catch {
      // fallback to agency agents
      api.get('/agency/agents').then(r => setTeamWorkload(r.data?.agents || []));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFollowUpsData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, allRes] = await Promise.all([
        api.get('/leads/follow-ups/today').catch(() => ({ data: [] })),
        api.get('/leads?hasFollowUp=true&limit=50').catch(() => ({ data: { leads: [] } })),
      ]);
      setAllFollowUps(allRes.data?.leads || (Array.isArray(todayRes.data) ? todayRes.data : []));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedLeadIds([]);
    fetchUnclaimedLeads();
    if (activeTab === 'unassigned') {
      fetchUnclaimedLeads();
    } else if (activeTab === 'distribution') {
      fetchDistributionData();
    } else if (activeTab === 'followups') {
      fetchFollowUpsData();
    } else {
      fetchLeads();
    }
  }, [activeTab, fetchLeads, fetchUnclaimedLeads, fetchDistributionData, fetchFollowUpsData]);

  const handleClaimLead = async (leadId) => {
    if (!user?._id) return;
    try {
      toast.loading('Claiming prospect lead...', { id: 'claim-lead' });
      await api.put(`/leads/${leadId}/reassign`, {
        toAgentId: user._id,
        reason: 'Claimed by Agent from common pool'
      });
      toast.success('Lead claimed and assigned to your pipeline! 🎉', { id: 'claim-lead' });
      setUnclaimedLeads(prev => prev.filter(l => l._id !== leadId));
      await Promise.all([fetchUnclaimedLeads(), fetchLeads()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to claim lead', { id: 'claim-lead' });
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignAgentId) {
      toast.error('Please select an agent to assign selected leads');
      return;
    }
    if (selectedLeadIds.length === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    setIsBulkAssigning(true);
    try {
      await api.post('/admin/agents/reassign-leads', {
        toAgentId: bulkAssignAgentId,
        leadIds: selectedLeadIds,
      });
      toast.success(`Successfully assigned ${selectedLeadIds.length} leads! 🚀`);
      setSelectedLeadIds([]);
      setBulkAssignAgentId('');
      if (activeTab === 'unassigned') fetchUnclaimedLeads();
      else fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign leads');
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleReassignAgentLeads = async () => {
    if (!reassignFromAgent || !reassignToAgent) {
      toast.error('Please select source and destination agents');
      return;
    }
    try {
      await api.post('/admin/agents/reassign-leads', {
        fromAgentId: reassignFromAgent,
        toAgentId: reassignToAgent,
      });
      toast.success('Leads successfully reassigned!');
      setReassignModalOpen(false);
      fetchDistributionData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reassign leads');
    }
  };

  const handleTransferLead = async (e) => {
    e.preventDefault();
    if (!transferringLead) return;
    if (!transferToAgentId) {
      toast.error('Please select an agent to transfer this lead to');
      return;
    }
    setIsTransferring(true);
    try {
      await api.put(`/leads/${transferringLead._id}/reassign`, {
        toAgentId: transferToAgentId,
        reason: transferReason || 'Transferred by agent'
      });
      toast.success('Lead transferred successfully! 🚀');
      setTransferringLead(null);
      setTransferToAgentId('');
      setTransferReason('');
      fetchLeads();
      fetchUnclaimedLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to transfer lead');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleReleaseLead = async (e) => {
    e.preventDefault();
    if (!releasingLead) return;
    if (!releaseReason || !releaseReason.trim()) {
      toast.error('Please provide a reason for releasing this lead');
      return;
    }
    setIsReleasing(true);
    try {
      await api.put(`/leads/${releasingLead._id}/release`, {
        reason: releaseReason.trim()
      });
      toast.success('Lead released to Unassigned Pool! 📦');
      setReleasingLead(null);
      setReleaseReason('');
      fetchLeads();
      fetchUnclaimedLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to release lead');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleStageChange = async (leadId, newStage) => {
    try {
      await api.put(`/leads/${leadId}`, { status: newStage });
      toast.success(`Stage updated to ${STAGE_LABELS[newStage] || newStage}`);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stage');
    }
  };

  const toggleSelectLead = (id) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllCurrentPage = () => {
    const list = activeTab === 'unassigned' ? unclaimedLeads : leads;
    if (selectedLeadIds.length === list.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(list.map(l => l._id));
    }
  };

  return (
    <div className="app-container">
      <BottomNav active="leads" />

      <main className="main-content">
        <div style={{ width: '100%', paddingBottom: 60 }}>
          
          {/* Header Section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={26} color="var(--accent)" /> {isRE ? 'Real Estate Leads Control' : 'Leads Workspace'}
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                {isOwnerOrManager
                  ? 'Monitor team leads, hot prospects, site visits, and manage smart lead distributions'
                  : 'Manage your assigned prospects and claim fresh inbound inquiries'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowImportModal(true)}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <Upload size={15} /> Import
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <Download size={15} /> Export
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <Plus size={16} /> Add Prospect
              </button>
            </div>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 12,
            marginBottom: 20,
            overflowX: 'auto'
          }}>
            {/* 1. Team Leads */}
            <button
              onClick={() => router.push('/leads?tab=team_leads')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'team_leads' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'team_leads' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'team_leads' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Users size={16} /> {isOwnerOrManager ? 'Team Leads' : 'My Leads'}
              {activeTab === 'team_leads' && totalLeads > 0 && (
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700 }}>
                  {totalLeads}
                </span>
              )}
            </button>

            {/* 2. Unassigned Leads */}
            <button
              onClick={() => router.push('/leads?tab=unassigned')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'unassigned' ? '#d97706' : 'var(--surface)',
                color: activeTab === 'unassigned' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'unassigned' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={16} /> Unassigned Pool
              {unclaimedLeads.length > 0 && (
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: activeTab === 'unassigned' ? 'rgba(255,255,255,0.25)' : 'rgba(217,119,6,0.15)', color: activeTab === 'unassigned' ? '#fff' : '#d97706', fontWeight: 700 }}>
                  {unclaimedLeads.length}
                </span>
              )}
            </button>

            {/* 3. Hot Leads */}
            <button
              onClick={() => router.push('/leads?tab=hot')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'hot' ? '#ef4444' : 'var(--surface)',
                color: activeTab === 'hot' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'hot' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Flame size={16} /> 🔥 Hot Leads
            </button>

            {/* 4. Follow-ups */}
            <button
              onClick={() => router.push('/leads?tab=followups')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'followups' ? '#f59e0b' : 'var(--surface)',
                color: activeTab === 'followups' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'followups' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Clock size={16} /> Follow-ups
            </button>

            {/* 5. Lead Distribution (Manager / Owner only) */}
            {isOwnerOrManager && (
              <button
                onClick={() => router.push('/leads?tab=distribution')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: activeTab === 'distribution' ? '#0ea5e9' : 'var(--surface)',
                  color: activeTab === 'distribution' ? '#fff' : 'var(--text)',
                  fontWeight: activeTab === 'distribution' ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <ArrowRightLeft size={16} /> Lead Distribution
              </button>
            )}
          </div>

          {/* ========================================================================= */}
          {/* TAB: TEAM LEADS & HOT LEADS                                              */}
          {/* ========================================================================= */}
          {(activeTab === 'team_leads' || activeTab === 'hot') && (
            <div>
              {/* Filter Strip */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                background: 'var(--card)',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                marginBottom: 16
              }}>
                <div style={{ flex: '1 1 200px', position: 'relative' }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by name, phone, budget, location..."
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                  />
                </div>

                {activeTab !== 'hot' && (
                  <select
                    className="input"
                    value={tempFilter}
                    onChange={e => {
                      setTempFilter(e.target.value);
                      setPage(1);
                    }}
                    style={{ flex: '0 0 140px', height: 38, fontSize: 13 }}
                  >
                    <option value="">All Temperatures</option>
                    <option value="HOT">🔥 HOT</option>
                    <option value="WARM">⚡ WARM</option>
                    <option value="COLD">❄️ COLD</option>
                  </select>
                )}

                <select
                  className="input"
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ flex: '0 0 150px', height: 38, fontSize: 13 }}
                >
                  <option value="">All Stages</option>
                  <option value="new_lead">🆕 New Lead</option>
                  <option value="contacted">📞 Contacted</option>
                  <option value="site_visit_scheduled">📍 Visit Scheduled</option>
                  <option value="negotiation">🤝 Negotiation</option>
                  <option value="converted">🏆 Deal Won</option>
                  <option value="lost">❌ Deal Lost</option>
                </select>

                <select
                  className="input"
                  value={sourceFilter}
                  onChange={e => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ flex: '0 0 130px', height: 38, fontSize: 13 }}
                >
                  <option value="">All Sources</option>
                  <option value="meta">Meta / Facebook</option>
                  <option value="google">Google Ads</option>
                  <option value="website">Website</option>
                  <option value="99acres">99acres</option>
                  <option value="housing">Housing.com</option>
                  <option value="referral">Referral</option>
                  <option value="manual">Direct</option>
                </select>

                {isOwnerOrManager && agents.length > 0 && (
                  <select
                    className="input"
                    value={agentFilter}
                    onChange={e => {
                      setAgentFilter(e.target.value);
                      setPage(1);
                    }}
                    style={{ flex: '0 0 160px', height: 38, fontSize: 13 }}
                  >
                    <option value="">All Team Agents</option>
                    {agents.map(a => (
                      <option key={a._id} value={a._id}>👤 {a.name}</option>
                    ))}
                  </select>
                )}

                {(search || statusFilter || tempFilter || sourceFilter || agentFilter) && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('');
                      setTempFilter('');
                      setSourceFilter('');
                      setAgentFilter('');
                      setPage(1);
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, color: 'var(--text-muted)' }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Bulk Actions Bar for Manager */}
              {isOwnerOrManager && selectedLeadIds.length > 0 && (
                <div style={{
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                      ✓ {selectedLeadIds.length} Leads Selected
                    </span>
                    <button
                      onClick={() => setSelectedLeadIds([])}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                    >
                      Deselect All
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="input"
                      value={bulkAssignAgentId}
                      onChange={e => setBulkAssignAgentId(e.target.value)}
                      style={{ height: 32, fontSize: 12, minWidth: 160 }}
                    >
                      <option value="">Select Target Agent...</option>
                      {agents.map(a => (
                        <option key={a._id} value={a._id}>👤 {a.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkAssign}
                      disabled={isBulkAssigning || !bulkAssignAgentId}
                      className="btn btn-primary btn-sm"
                      style={{ height: 32, fontSize: 12, fontWeight: 700 }}
                    >
                      {isBulkAssigning ? 'Assigning...' : 'Assign Selected'}
                    </button>
                  </div>
                </div>
              )}

              {/* Leads Listing */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading leads...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(79,70,229,0.1)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Users size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Leads Found</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
                    {search || statusFilter || tempFilter ? 'Try adjusting your filters.' : 'No active prospects found in this category.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {leads.map(lead => {
                    const isSelected = selectedLeadIds.includes(lead._id);
                    const temp = lead.temperature || (lead.score >= 60 ? 'HOT' : lead.score >= 30 ? 'WARM' : 'COLD');
                    const tempBg = temp === 'HOT' ? 'rgba(239,68,68,0.12)' : temp === 'WARM' ? 'rgba(245,158,11,0.12)' : 'rgba(14,165,233,0.1)';
                    const tempColor = temp === 'HOT' ? '#ef4444' : temp === 'WARM' ? '#f59e0b' : '#0ea5e9';

                    return (
                      <div
                        key={lead._id}
                        style={{
                          background: isSelected ? 'rgba(99,102,241,0.04)' : 'var(--card)',
                          borderRadius: 14,
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 14,
                          transition: 'border-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 300px' }}>
                          {isOwnerOrManager && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectLead(lead._id)}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                            />
                          )}

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <Link
                                href={`/leads/${lead._id}`}
                                style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                              >
                                {lead.name || 'Unnamed Prospect'}
                              </Link>
                              
                              {/* Temperature & Score Badge */}
                              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: tempBg, color: tempColor }}>
                                {temp === 'HOT' ? '🔥 HOT' : temp === 'WARM' ? '⚡ WARM' : '❄️ COLD'} ({lead.score ?? 20} pts)
                              </span>

                              <SourcePill source={lead.source} />
                              <span className={`badge ${STATUS_COLORS[lead.status] || 'badge-tag'}`} style={{ fontSize: 10.5 }}>
                                {STAGE_LABELS[lead.status] || lead.status}
                              </span>

                              {isOwnerOrManager && (
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: lead.assignedToName ? 'rgba(99,102,241,0.1)' : 'rgba(217,119,6,0.12)',
                                  color: lead.assignedToName ? 'var(--accent)' : '#d97706'
                                }}>
                                  👤 {lead.assignedToName || 'Unassigned'}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                              <a href={`tel:${lead.phone}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                                📞 {lead.phone}
                              </a>
                              {lead.location && <span>📍 {lead.location}</span>}
                              {lead.propertyType && <span>🏠 {lead.propertyType}</span>}
                              {lead.budget && <span>💰 {formatINR(lead.budget)}</span>}
                              {lead.followUpDate && (
                                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                  ⏰ {formatDisplayDateTime(lead.followUpDate)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Link
                            href={`/leads/${lead._id}`}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}
                          >
                            Details & Match →
                          </Link>

                          <button
                            onClick={() => {
                              setTransferringLead(lead);
                              setTransferToAgentId('');
                              setTransferReason('');
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text)', border: '1px solid var(--border)', gap: 4 }}
                            title="Transfer Lead to another agent"
                          >
                            <ArrowRightLeft size={13} /> Transfer
                          </button>

                          <button
                            onClick={() => {
                              setReleasingLead(lead);
                              setReleaseReason('');
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 10px', fontSize: 11, color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)', gap: 4 }}
                            title="Release to Unassigned Pool"
                          >
                            📦 Release
                          </button>

                          <a
                            href={`tel:${lead.phone}`}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 10px', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                            title="Call"
                          >
                            <Phone size={14} /> Call
                          </a>

                          <a
                            href={waLink(lead.phone, `Hi ${lead.name || ''}, regarding your real estate inquiry...`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 10px', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                            title="WhatsApp"
                          >
                            <MessageSquare size={14} /> WhatsApp
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: UNASSIGNED LEADS POOL                                                */}
          {/* ========================================================================= */}
          {activeTab === 'unassigned' && (
            <div>
              {/* Bulk Actions for Unassigned Pool */}
              {isOwnerOrManager && unclaimedLeads.length > 0 && (
                <div style={{
                  background: 'var(--card)',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={selectAllCurrentPage}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12 }}
                    >
                      {selectedLeadIds.length === unclaimedLeads.length ? 'Deselect All' : 'Select All Pool Leads'}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {selectedLeadIds.length} of {unclaimedLeads.length} selected
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="input"
                      value={bulkAssignAgentId}
                      onChange={e => setBulkAssignAgentId(e.target.value)}
                      style={{ height: 34, fontSize: 12, minWidth: 160 }}
                    >
                      <option value="">Assign To Agent...</option>
                      {agents.map(a => (
                        <option key={a._id} value={a._id}>👤 {a.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkAssign}
                      disabled={isBulkAssigning || selectedLeadIds.length === 0 || !bulkAssignAgentId}
                      className="btn btn-primary btn-sm"
                      style={{ height: 34, fontSize: 12, fontWeight: 700 }}
                    >
                      {isBulkAssigning ? 'Distributing...' : 'Assign Selected'}
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading unclaimed pool...</p>
                </div>
              ) : unclaimedLeads.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Unclaimed Pool is Empty!</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    All incoming inquiries have been assigned to team members. Great job!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {unclaimedLeads.map(lead => {
                    const isSelected = selectedLeadIds.includes(lead._id);
                    return (
                      <div
                        key={lead._id}
                        style={{
                          background: isSelected ? 'rgba(217,119,6,0.06)' : 'var(--card)',
                          borderRadius: 14,
                          border: isSelected ? '1px solid #d97706' : '1px solid var(--border)',
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 280px' }}>
                          {isOwnerOrManager && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectLead(lead._id)}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#d97706' }}
                            />
                          )}

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span style={{ fontSize: 15, fontWeight: 700 }}>{lead.name || 'Inquiry Contact'}</span>
                              <SourcePill source={lead.source} />
                              <span className="badge" style={{ background: 'rgba(217,119,6,0.15)', color: '#d97706', fontSize: 11, fontWeight: 800 }}>
                                Unassigned
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                              <span>📞 {lead.phone}</span>
                              {lead.location && <span>📍 {lead.location}</span>}
                              {lead.budget && <span>💰 {formatINR(lead.budget)}</span>}
                            </div>

                            {(lead.releaseReason || lead.customData?.releaseReason) && (
                              <div style={{
                                marginTop: 6,
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px dashed rgba(239, 68, 68, 0.35)',
                                fontSize: 11.5,
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap'
                              }}>
                                <span>⚠️ <strong>Released Reason:</strong> &ldquo;{lead.releaseReason || lead.customData?.releaseReason}&rdquo;</span>
                                {(lead.releasedByName || lead.customData?.releasedByName) && (
                                  <span style={{ color: 'var(--text-muted)' }}>— Dropped by {lead.releasedByName || lead.customData?.releasedByName}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={() => handleClaimLead(lead._id)}
                            className="btn btn-primary btn-sm"
                            style={{ background: '#d97706', borderColor: '#d97706', fontSize: 12, fontWeight: 700 }}
                          >
                            <Sparkles size={14} /> Claim Lead
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: LEAD DISTRIBUTION & AGENT WORKLOAD                                  */}
          {/* ========================================================================= */}
          {activeTab === 'distribution' && (
            <div>
              <div style={{
                background: 'var(--card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                padding: '20px',
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Agent Workload & Distribution Center</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Monitor active lead capacities, rebalance pipelines and reassign leads across team agents.
                    </p>
                  </div>

                  <button
                    onClick={() => setReassignModalOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontSize: 13 }}
                  >
                    <ArrowRightLeft size={15} /> Reassign Agent Leads
                  </button>
                </div>

                {teamWorkload.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No team agent statistics found.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>Agent Name</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>Active Leads</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>HOT Leads</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>Pending Follow-ups</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>Upcoming Visits</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>Lead Capacity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamWorkload.map(agent => {
                          const cap = agent.leadCap || 50;
                          const active = agent.activeLeads || 0;
                          const pct = Math.min(100, Math.round((active / cap) * 100));

                          return (
                            <tr key={agent.id || agent._id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '12px 8px', fontWeight: 700 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>👤 {agent.name}</span>
                                  {agent.isAvailable === false && (
                                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                      Paused
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--accent)' }}>
                                {active}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <span style={{ fontWeight: 800, color: '#ef4444' }}>
                                  🔥 {agent.hotLeads || 0}
                                </span>
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                ⏰ {agent.pendingFollowUps || 0}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                📍 {agent.upcomingVisits || 0}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 80, height: 6, borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? '#ef4444' : 'var(--accent)' }} />
                                  </div>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{active}/{cap}</span>
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
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: followUpSubTab === st ? 'var(--accent)' : 'var(--card)',
                      color: followUpSubTab === st ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {st === 'today' ? "Today's Follow-ups" : st === 'overdue' ? '⚠️ Overdue' : '📅 Upcoming'}
                  </button>
                ))}
              </div>

              {allFollowUps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No follow-ups found in this view.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allFollowUps.map(lead => (
                    <div
                      key={lead._id}
                      style={{
                        background: 'var(--card)',
                        borderRadius: 12,
                        padding: '12px 16px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10
                      }}
                    >
                      <div>
                        <Link href={`/leads/${lead._id}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                          {lead.name || 'Prospect'}
                        </Link>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 3 }}>
                          <span>📞 {lead.phone}</span>
                          {lead.assignedToName && <span>👤 Agent: {lead.assignedToName}</span>}
                          {lead.followUpDate && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>⏰ {formatDisplayDateTime(lead.followUpDate)}</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <a
                          href={`tel:${lead.phone}`}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '5px 10px' }}
                        >
                          Call
                        </a>
                        <a
                          href={waLink(lead.phone, `Hi ${lead.name || ''}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', padding: '5px 10px' }}
                        >
                          WA
                        </a>
                        <button
                          onClick={() => setCompletingFollowUpLead(lead)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '5px 10px', fontSize: 11 }}
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Modal: Reassign Leads */}
      {reassignModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>Reassign Team Leads</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Transfer all active leads from one team agent to another.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>From Agent</label>
                <select
                  className="input"
                  value={reassignFromAgent}
                  onChange={e => setReassignFromAgent(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select source agent...</option>
                  {agents.map(a => (
                    <option key={a._id} value={a._id}>👤 {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>To Agent</label>
                <select
                  className="input"
                  value={reassignToAgent}
                  onChange={e => setReassignToAgent(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select destination agent...</option>
                  {agents.filter(a => a._id !== reassignFromAgent).map(a => (
                    <option key={a._id} value={a._id}>👤 {a.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button onClick={() => setReassignModalOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button onClick={handleReassignAgentLeads} className="btn btn-primary btn-sm">Confirm Reassign</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transfer Lead */}
      {transferringLead && (
        <div className="modal-backdrop" onClick={() => setTransferringLead(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>🔄 Transfer Lead</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Transfer <strong>{transferringLead.name || 'Prospect'}</strong> ({transferringLead.phone}) to another team agent.
            </p>

            <form onSubmit={handleTransferLead} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Target Agent *</label>
                <select
                  className="input"
                  value={transferToAgentId}
                  onChange={e => setTransferToAgentId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  <option value="">-- Choose Agent --</option>
                  {agents.filter(a => String(a._id) !== String(user?._id)).map(a => (
                    <option key={a._id} value={a._id}>👤 {a.name} ({a.roleId?.name || a.role || 'Agent'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Transfer Reason / Handover Notes</label>
                <textarea
                  className="input"
                  placeholder="e.g. Client requested local representative or language specialist."
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  style={{ width: '100%', height: 75, resize: 'none', padding: 8 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setTransferringLead(null)} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" disabled={isTransferring} className="btn btn-primary btn-sm">
                  {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Release Lead to Pool */}
      {releasingLead && (
        <div className="modal-backdrop" onClick={() => setReleasingLead(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: '#ef4444' }}>📦 Release Lead to Unassigned Pool</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Release <strong>{releasingLead.name || 'Prospect'}</strong> ({releasingLead.phone}) back to the common Unassigned Pool. Please specify why you are releasing this lead.
            </p>

            <form onSubmit={handleReleaseLead} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Reason for Release *</label>
                <textarea
                  className="input"
                  placeholder="e.g. Client budget does not match / Client looking for different location / Unresponsive on call."
                  value={releaseReason}
                  onChange={e => setReleaseReason(e.target.value)}
                  style={{ width: '100%', height: 80, resize: 'none', padding: 8 }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setReleasingLead(null)} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" disabled={isReleasing} className="btn btn-primary btn-sm" style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                  {isReleasing ? 'Releasing...' : 'Confirm Release to Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
