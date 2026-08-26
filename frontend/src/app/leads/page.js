'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, isOwner, isManager, isAgent, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Users, Search, Plus, Upload, Download, Phone, MessageSquare,
  Calendar, CheckCircle2, ChevronRight, AlertTriangle, ShieldAlert,
  ArrowUpDown, Filter, Sparkles, RefreshCw, Layers, Check, Edit2
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import {
  STAGE_LABELS, STATUS_COLORS, UpgradeModal, ImportLeadsModal,
  ExportLeadsModal, AddLeadModal, EditLeadModal, ScheduleFollowUpModal,
  CompleteFollowUpModal
} from '@/components/LeadModals';

export default function LeadsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('my_leads'); // 'my_leads' | 'unclaimed'
  const [leads, setLeads] = useState([]);
  const [unclaimedLeads, setUnclaimedLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingUnclaimed, setLoadingUnclaimed] = useState(false);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [projects, setProjects] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [schedulingFollowUpLead, setSchedulingFollowUpLead] = useState(null);
  const [completingFollowUpLead, setCompletingFollowUpLead] = useState(null);

  // Initial tab & user sync
  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'unclaimed') {
        setActiveTab('unclaimed');
      } else {
        setActiveTab('my_leads');
      }
    }
  }, [router]);

  // Fetch Projects list for filter
  useEffect(() => {
    api.get('/projects').then(res => setProjects(res.data || [])).catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (projectFilter) params.projectId = projectFilter;

      const res = await api.get('/leads', { params });
      setLeads(res.data?.leads || []);
      setTotalLeads(res.data?.total || 0);
      setTotalPages(res.data?.pages || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter, projectFilter]);

  const fetchUnclaimedLeads = useCallback(async () => {
    setLoadingUnclaimed(true);
    try {
      const res = await api.get('/leads?unclaimed=true&limit=50');
      setUnclaimedLeads(res.data?.leads || []);
    } catch {
      // ignore
    } finally {
      setLoadingUnclaimed(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'my_leads') {
      fetchLeads();
    } else {
      fetchUnclaimedLeads();
    }
  }, [activeTab, fetchLeads, fetchUnclaimedLeads]);

  const handleClaimLead = async (leadId) => {
    if (!user?._id) return;
    try {
      toast.loading('Claiming prospect lead...', { id: 'claim-lead' });
      await api.put(`/leads/${leadId}/reassign`, {
        toAgentId: user._id,
        reason: 'Claimed by Agent from common pool'
      });
      toast.success('Lead claimed and assigned to your pipeline! 🎉', { id: 'claim-lead' });
      fetchUnclaimedLeads();
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to claim lead', { id: 'claim-lead' });
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

  const isTenantOwner = isOwner(user);

  return (
    <div className="app-container">
      <BottomNav active="leads" />

      <main className="main-content">
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
          
          {/* Header Section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={26} color="var(--accent)" /> Leads Workspace
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Manage your assigned prospects and claim fresh inbound inquiries
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
            marginBottom: 20
          }}>
            <button
              onClick={() => {
                setActiveTab('my_leads');
                window.history.replaceState(null, '', '/leads?tab=my_leads');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'my_leads' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'my_leads' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'my_leads' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Users size={16} /> My Leads
              <span style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 20,
                background: activeTab === 'my_leads' ? 'rgba(255,255,255,0.25)' : 'rgba(79,70,229,0.1)',
                color: activeTab === 'my_leads' ? '#fff' : 'var(--accent)',
                fontWeight: 700
              }}>
                {totalLeads}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('unclaimed');
                window.history.replaceState(null, '', '/leads?tab=unclaimed');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'unclaimed' ? '#d97706' : 'var(--surface)',
                color: activeTab === 'unclaimed' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'unclaimed' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={16} /> New / Unclaimed Pool
              {unclaimedLeads.length > 0 && (
                <span style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 20,
                  background: activeTab === 'unclaimed' ? 'rgba(255,255,255,0.25)' : 'rgba(217,119,6,0.15)',
                  color: activeTab === 'unclaimed' ? '#fff' : '#d97706',
                  fontWeight: 700
                }}>
                  {unclaimedLeads.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: MY LEADS */}
          {activeTab === 'my_leads' && (
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
                    placeholder="Search leads by name, phone, or package..."
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                  />
                </div>

                <select
                  className="input"
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ flex: '0 0 160px', height: 38, fontSize: 13 }}
                >
                  <option value="">All Stages</option>
                  <option value="new_lead">🆕 New Lead</option>
                  <option value="contacted">📞 Contacted</option>
                  <option value="converted">🏆 Converted</option>
                  <option value="not_interested">❌ Not Interested</option>
                </select>

                <select
                  className="input"
                  value={sourceFilter}
                  onChange={e => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ flex: '0 0 140px', height: 38, fontSize: 13 }}
                >
                  <option value="">All Sources</option>
                  <option value="meta">Meta / Facebook</option>
                  <option value="google">Google Ads</option>
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="import">Imported</option>
                  <option value="manual">Direct / Manual</option>
                </select>

                {projects.length > 0 && (
                  <select
                    className="input"
                    value={projectFilter}
                    onChange={e => {
                      setProjectFilter(e.target.value);
                      setPage(1);
                    }}
                    style={{ flex: '0 0 160px', height: 38, fontSize: 13 }}
                  >
                    <option value="">All Offerings / Projects</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                )}

                {(search || statusFilter || sourceFilter || projectFilter) && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('');
                      setSourceFilter('');
                      setProjectFilter('');
                      setPage(1);
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, color: 'var(--text-muted)' }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Leads Listing */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading assigned leads...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(79,70,229,0.1)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Users size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Leads Found</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
                    {search || statusFilter ? 'Try clearing your filters to see more results.' : 'You have no leads assigned yet. Claim some from the unclaimed pool!'}
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                      <Plus size={15} /> Add First Lead
                    </button>
                    <button onClick={() => setActiveTab('unclaimed')} className="btn btn-ghost btn-sm" style={{ color: '#d97706' }}>
                      <Sparkles size={15} /> View Unclaimed Pool
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {leads.map(lead => (
                    <div
                      key={lead._id}
                      style={{
                        background: 'var(--card)',
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                        padding: '16px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 14,
                        transition: 'border-color 0.15s ease'
                      }}
                    >
                      <div style={{ flex: '1 1 280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Link
                            href={`/leads/${lead._id}`}
                            style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                          >
                            {lead.name || 'Unnamed Contact'}
                          </Link>
                          <SourcePill source={lead.source} />
                          <span className={`badge ${STATUS_COLORS[lead.status] || 'badge-tag'}`} style={{ fontSize: 11 }}>
                            {STAGE_LABELS[lead.status] || lead.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                          <a href={`tel:${lead.phone}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📞 {lead.phone}
                          </a>
                          {lead.project && <span>📦 {lead.project}</span>}
                          {lead.budget && <span>💰 ₹{Number(lead.budget).toLocaleString('en-IN')}</span>}
                          {lead.followUpDate && (
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                              ⏰ Next Follow-up: {formatDisplayDateTime(lead.followUpDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <select
                          className="input"
                          value={lead.status || 'new_lead'}
                          onChange={e => handleStageChange(lead._id, e.target.value)}
                          style={{ height: 34, fontSize: 12, padding: '4px 8px', flex: '0 0 auto', background: 'var(--surface)' }}
                        >
                          <option value="new_lead">🆕 New Lead</option>
                          <option value="contacted">📞 Contacted</option>
                          <option value="converted">🏆 Converted</option>
                          <option value="not_interested">❌ Not Interested</option>
                        </select>

                        <a
                          href={`tel:${lead.phone}`}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px 10px', height: 34, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                          title="Call Lead"
                        >
                          <Phone size={14} /> Call
                        </a>

                        <a
                          href={waLink(lead.phone, `Hi ${lead.name || ''}, connecting from our sales team regarding your inquiry.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px 10px', height: 34, color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                          title="WhatsApp Chat"
                        >
                          <MessageSquare size={14} /> WhatsApp
                        </a>

                        <button
                          onClick={() => setSchedulingFollowUpLead(lead)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px 10px', height: 34, color: 'var(--accent)' }}
                          title="Schedule Follow-up"
                        >
                          <Calendar size={14} />
                        </button>

                        <button
                          onClick={() => setEditingLead(lead)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px 10px', height: 34, color: 'var(--text-muted)' }}
                          title="Edit Lead"
                        >
                          <Edit2 size={14} />
                        </button>

                        <Link
                          href={`/leads/${lead._id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px 8px', height: 34, color: 'var(--text-muted)' }}
                        >
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Page {page} of {totalPages}
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEW / UNCLAIMED LEADS POOL */}
          {activeTab === 'unclaimed' && (
            <div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(217,119,6,0.08) 0%, rgba(245,158,11,0.03) 100%)',
                border: '1px solid rgba(217,119,6,0.25)',
                borderRadius: 14,
                padding: '16px 18px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#d97706', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} /> Open Inbound Leads Pool
                  </h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Fresh marketing leads waiting to be picked up. First come, first served!
                  </p>
                </div>
                <button
                  onClick={fetchUnclaimedLeads}
                  className="btn btn-ghost btn-sm"
                  style={{ gap: 6, fontSize: 12, color: '#d97706' }}
                >
                  <RefreshCw size={14} /> Refresh Pool
                </button>
              </div>

              {loadingUnclaimed ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Scanning unclaimed leads...</p>
                </div>
              ) : unclaimedLeads.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(217,119,6,0.1)', color: '#d97706', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Sparkles size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Unclaimed Leads Available</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                    All incoming prospects are currently assigned to team agents. Check back soon!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                  {unclaimedLeads.map(lead => (
                    <div
                      key={lead._id}
                      style={{
                        background: 'var(--card)',
                        borderRadius: 14,
                        border: '1.5px solid rgba(217,119,6,0.25)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{lead.name || 'Anonymous Prospect'}</span>
                          <SourcePill source={lead.source} />
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span>📞 {lead.phone}</span>
                          {lead.project && <span>📦 Offering: <strong>{lead.project}</strong></span>}
                          {lead.budget && <span>💰 Budget: <strong>₹{Number(lead.budget).toLocaleString('en-IN')}</strong></span>}
                          {lead.createdAt && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              🕒 Received: {new Date(lead.createdAt).toLocaleDateString()} at {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => handleClaimLead(lead._id)}
                          className="btn btn-primary btn-full"
                          style={{
                            background: '#d97706',
                            borderColor: '#d97706',
                            gap: 6,
                            fontSize: 13,
                            fontWeight: 700
                          }}
                        >
                          <Sparkles size={15} /> Claim Lead 🎯
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

      {/* Shared Modals */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            fetchLeads();
            fetchUnclaimedLeads();
          }}
          onLimitReached={() => setShowUpgradeModal(true)}
          user={user}
        />
      )}

      {showImportModal && (
        <ImportLeadsModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            fetchLeads();
            fetchUnclaimedLeads();
          }}
        />
      )}

      {showExportModal && (
        <ExportLeadsModal
          onClose={() => setShowExportModal(false)}
          user={user}
          statusFilter={statusFilter}
          projectFilter={projectFilter}
          search={search}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}

      {editingLead && (
        <EditLeadModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onUpdated={() => fetchLeads()}
          user={user}
        />
      )}

      {schedulingFollowUpLead && (
        <ScheduleFollowUpModal
          lead={schedulingFollowUpLead}
          onClose={() => setSchedulingFollowUpLead(null)}
          onUpdated={() => fetchLeads()}
        />
      )}

      {completingFollowUpLead && (
        <CompleteFollowUpModal
          lead={completingFollowUpLead}
          onClose={() => setCompletingFollowUpLead(null)}
          onCompleted={() => fetchLeads()}
          onPromptScheduleNext={l => setSchedulingFollowUpLead(l)}
        />
      )}
    </div>
  );
}
