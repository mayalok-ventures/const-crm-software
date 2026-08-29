'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  TrendingUp, Search, Phone, MessageSquare, Plus, RefreshCw,
  Layers, ArrowRight, CheckCircle2, ChevronRight, LayoutGrid,
  Calendar, Check, Filter, Sparkles, DollarSign, Percent, PieChart
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import { STAGE_LABELS, STATUS_COLORS, AddLeadModal } from '@/components/LeadModals';
import { formatDisplayDateTime } from '@/lib/dateUtils';

function PipelineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab') || 'kanban';

  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [reAnalytics, setReAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStageId, setActiveStageId] = useState('contacted');
  const [viewMode, setViewMode] = useState(rawTab === 'team_pipeline' ? 'stage' : rawTab === 'forecast' ? 'forecast' : 'board');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'team_pipeline') setViewMode('stage');
    else if (tabParam === 'forecast') setViewMode('forecast');
    else if (tabParam === 'kanban') setViewMode('board');
  }, [searchParams]);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const fetchPipelineData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, reRes] = await Promise.all([
        api.get('/leads?limit=250'),
        api.get('/real-estate/analytics/summary').catch(() => ({ data: { data: null } })),
      ]);
      setLeads(leadsRes.data?.leads || []);
      setReAnalytics(reRes.data?.data || null);
    } catch {
      toast.error('Failed to load pipeline leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelineData();
  }, [fetchPipelineData]);

  const handleStageChange = async (leadId, newStage) => {
    try {
      await api.put(`/leads/${leadId}`, { status: newStage });
      toast.success(`Moved to ${STAGE_LABELS[newStage] || newStage}`);
      fetchPipelineData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stage');
    }
  };

  const stages = [
    { id: 'new_lead', name: 'New Inquiries', color: '#6366f1', icon: Sparkles, probability: 10 },
    { id: 'contacted', name: 'Contacted', color: '#0ea5e9', icon: Phone, probability: 25 },
    { id: 'site_visit_scheduled', name: 'Site Visit / Demo', color: '#f59e0b', icon: Calendar, probability: 50 },
    { id: 'negotiation', name: 'Negotiation', color: '#8b5cf6', icon: Layers, probability: 75 },
    { id: 'converted', name: 'Won & Closed', color: '#10b981', icon: CheckCircle2, probability: 100 },
  ];

  const getStageLeads = (stageId) => {
    return leads.filter(l => {
      let matchesStage = false;
      if (stageId === 'new_lead') {
        matchesStage = l.status === 'new_lead' || l.status === 'new' || !l.status;
      } else if (stageId === 'converted') {
        matchesStage = l.status === 'converted' || l.status === 'closed' || l.status === 'payment_done';
      } else {
        matchesStage = l.status === stageId;
      }

      if (!matchesStage) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.project && l.project.toLowerCase().includes(q))
      );
    });
  };

  const activeStage = stages.find(s => s.id === activeStageId) || stages[0];
  const activeLeads = getStageLeads(activeStageId);

  const formatINR = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  // Forecast Calculations
  const forecastBreakdown = stages.map(st => {
    const stageLeads = getStageLeads(st.id);
    const totalVal = stageLeads.reduce((sum, l) => sum + (Number(l.budget) || 0), 0);
    const weightedVal = (totalVal * st.probability) / 100;
    return {
      ...st,
      count: stageLeads.length,
      totalVal,
      weightedVal,
    };
  });

  const grandTotalValue = forecastBreakdown.reduce((sum, f) => sum + f.totalVal, 0);
  const grandWeightedValue = forecastBreakdown.reduce((sum, f) => sum + f.weightedVal, 0);

  return (
    <div className="app-container">
      <BottomNav active="pipeline" />

      <main className="main-content">
        <div style={{ width: '100%', paddingBottom: 60 }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingUp size={26} color="var(--accent)" /> Real Estate Pipeline Workspace
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Track opportunity progression across sales lifecycle stages, Kanban boards and weighted deal forecasts.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 240 }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 11 }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Filter pipeline leads..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, height: 36, fontSize: 12 }}
                />
              </div>

              {/* View Switcher */}
              <div style={{ display: 'flex', background: 'var(--surface)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
                <button
                  onClick={() => {
                    setViewMode('board');
                    router.push('/pipeline?tab=kanban');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: viewMode === 'board' ? 'var(--card)' : 'transparent',
                    color: viewMode === 'board' ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: viewMode === 'board' ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Kanban
                </button>
                <button
                  onClick={() => {
                    setViewMode('stage');
                    router.push('/pipeline?tab=team_pipeline');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: viewMode === 'stage' ? 'var(--card)' : 'transparent',
                    color: viewMode === 'stage' ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: viewMode === 'stage' ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Stage View
                </button>
                <button
                  onClick={() => {
                    setViewMode('forecast');
                    router.push('/pipeline?tab=forecast');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: viewMode === 'forecast' ? 'var(--card)' : 'transparent',
                    color: viewMode === 'forecast' ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: viewMode === 'forecast' ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Deal Forecast
                </button>
              </div>

              <button
                onClick={fetchPipelineData}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, height: 36, fontSize: 12 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary btn-sm"
                style={{ gap: 6, height: 36, fontSize: 12 }}
              >
                <Plus size={15} /> Add Lead
              </button>
            </div>
          </div>

          {/* TOP STAGE KPI CARDS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 24
          }}>
            {stages.map(stage => {
              const stageLeads = getStageLeads(stage.id);
              const totalValue = stageLeads.reduce((acc, curr) => acc + (Number(curr.budget) || 0), 0);

              return (
                <div
                  key={stage.id}
                  onClick={() => {
                    setActiveStageId(stage.id);
                    if (viewMode === 'forecast') setViewMode('stage');
                  }}
                  style={{
                    background: 'var(--card)',
                    borderRadius: 14,
                    border: activeStageId === stage.id && viewMode === 'stage' ? `2px solid ${stage.color}` : '1px solid var(--border)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{stage.name}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: `${stage.color}15`,
                      color: stage.color
                    }}>
                      {stageLeads.length}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    {formatINR(totalValue)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* VIEW: DEAL FORECAST                                                       */}
          {/* ========================================================================= */}
          {viewMode === 'forecast' && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
                marginBottom: 20
              }}>
                <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '18px 20px' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Unweighted Pipeline</span>
                  <h2 style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                    {formatINR(grandTotalValue)}
                  </h2>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sum of all prospective deal budgets</span>
                </div>

                <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '18px 20px' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Expected Weighted Pipeline Value</span>
                  <h2 style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                    {formatINR(grandWeightedValue)}
                  </h2>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Adjusted by stage closing probabilities</span>
                </div>
              </div>

              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '20px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px' }}>Stage Probability & Weighted Forecast Breakdown</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 8px', fontWeight: 600 }}>Pipeline Stage</th>
                        <th style={{ padding: '10px 8px', fontWeight: 600 }}>Open Deals</th>
                        <th style={{ padding: '10px 8px', fontWeight: 600 }}>Total Value</th>
                        <th style={{ padding: '10px 8px', fontWeight: 600 }}>Win Probability</th>
                        <th style={{ padding: '10px 8px', fontWeight: 600 }}>Weighted Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastBreakdown.map(st => (
                        <tr key={st.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 700 }}>
                            <span style={{ color: st.color }}>● {st.name}</span>
                          </td>
                          <td style={{ padding: '12px 8px' }}>{st.count}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 700 }}>{formatINR(st.totalVal)}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{ fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${st.color}15`, color: st.color }}>
                              {st.probability}%
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', fontWeight: 800, color: '#10b981' }}>
                            {formatINR(st.weightedVal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW: KANBAN BOARD                                                        */}
          {/* ========================================================================= */}
          {viewMode === 'board' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              alignItems: 'start'
            }}>
              {stages.map(stage => {
                const stageLeads = getStageLeads(stage.id);
                return (
                  <div
                    key={stage.id}
                    style={{
                      background: 'var(--surface)',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      minHeight: 400
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: stage.color }}>{stage.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, background: 'var(--card)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        {stageLeads.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 'calc(100vh - 360px)' }}>
                      {stageLeads.map(lead => (
                        <div
                          key={lead._id}
                          style={{
                            background: 'var(--card)',
                            borderRadius: 10,
                            padding: '12px',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Link href={`/leads/${lead._id}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                              {lead.name || 'Prospect'}
                            </Link>
                            {lead.score !== undefined && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: lead.score >= 60 ? '#ef4444' : 'var(--accent)' }}>
                                {lead.score} pts
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            📞 {lead.phone}
                          </div>

                          {lead.budget && (
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#10b981' }}>
                              💰 {formatINR(lead.budget)}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                            <select
                              className="input"
                              value={lead.status || 'new_lead'}
                              onChange={e => handleStageChange(lead._id, e.target.value)}
                              style={{ height: 26, fontSize: 11, padding: '2px 6px' }}
                            >
                              <option value="new_lead">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="site_visit_scheduled">Visit</option>
                              <option value="negotiation">Negotiation</option>
                              <option value="converted">Won</option>
                            </select>

                            <a
                              href={waLink(lead.phone, `Hi ${lead.name || ''}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#22c55e', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                            >
                              WA →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW: STAGE VIEW                                                          */}
          {/* ========================================================================= */}
          {viewMode === 'stage' && (
            <div>
              <div style={{
                background: 'var(--card)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 20px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: activeStage.color }}>
                  {activeStage.name} ({activeLeads.length} Leads)
                </h3>
              </div>

              {activeLeads.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  No leads in {activeStage.name}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeLeads.map(lead => (
                    <div
                      key={lead._id}
                      style={{
                        background: 'var(--card)',
                        borderRadius: 12,
                        padding: '14px 18px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12
                      }}
                    >
                      <div>
                        <Link href={`/leads/${lead._id}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                          {lead.name || 'Prospect'}
                        </Link>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 4 }}>
                          <span>📞 {lead.phone}</span>
                          {lead.budget && <span>💰 {formatINR(lead.budget)}</span>}
                          {lead.assignedToName && <span>👤 Agent: {lead.assignedToName}</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          className="input"
                          value={lead.status || 'new_lead'}
                          onChange={e => handleStageChange(lead._id, e.target.value)}
                          style={{ height: 32, fontSize: 12 }}
                        >
                          <option value="new_lead">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="site_visit_scheduled">Site Visit</option>
                          <option value="negotiation">Negotiation</option>
                          <option value="converted">Won</option>
                        </select>
                        <Link href={`/leads/${lead._id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                          Details →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => fetchPipelineData()}
          user={user}
        />
      )}
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={null}>
      <PipelineContent />
    </Suspense>
  );
}
