'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  TrendingUp, Search, Phone, MessageSquare, Plus, RefreshCw,
  Layers, ArrowRight, CheckCircle2, ChevronRight, LayoutGrid,
  Calendar, Check, Filter, Sparkles
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import { STAGE_LABELS, STATUS_COLORS, AddLeadModal } from '@/components/LeadModals';
import { formatDisplayDateTime } from '@/lib/dateUtils';

export default function PipelinePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStageId, setActiveStageId] = useState('contacted');
  const [viewMode, setViewMode] = useState('stage'); // 'stage' | 'board'
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/leads?limit=250');
      setLeads(res.data?.leads || []);
    } catch {
      toast.error('Failed to load pipeline leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleStageChange = async (leadId, newStage) => {
    try {
      await api.put(`/leads/${leadId}`, { status: newStage });
      toast.success(`Moved to ${STAGE_LABELS[newStage] || newStage}`);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stage');
    }
  };

  const stages = [
    { id: 'new_lead', name: 'New Inquiries', color: '#6366f1', icon: Sparkles, desc: 'Fresh incoming prospect inquiries' },
    { id: 'contacted', name: 'Contacted', color: '#0ea5e9', icon: Phone, desc: 'Engaged via call, WhatsApp, or email' },
    { id: 'site_visit_scheduled', name: 'Site Visit / Demo', color: '#f59e0b', icon: Calendar, desc: 'Scheduled product demo or site inspection' },
    { id: 'negotiation', name: 'Negotiation', color: '#8b5cf6', icon: Layers, desc: 'Discussing price, proposal & terms' },
    { id: 'converted', name: 'Won & Closed', color: '#10b981', icon: CheckCircle2, desc: 'Successfully converted customer deals' },
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

  const formatBudget = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      return `₹${num.toLocaleString('en-IN')}`;
    }
    return String(val);
  };

  return (
    <div className="app-container">
      <BottomNav active="pipeline" />

      <main className="main-content">
        <div style={{ width: '100%', paddingBottom: 60 }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingUp size={26} color="var(--accent)" /> Sales Pipeline Workspace
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Track opportunity progression across sales lifecycle stages
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 260 }}>
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

              <div style={{ display: 'flex', background: 'var(--surface)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setViewMode('stage')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: viewMode === 'stage' ? 'var(--card)' : 'transparent',
                    color: viewMode === 'stage' ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: viewMode === 'stage' ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: viewMode === 'stage' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Stage View
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: viewMode === 'board' ? 'var(--card)' : 'transparent',
                    color: viewMode === 'board' ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: viewMode === 'board' ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: viewMode === 'board' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Kanban Board
                </button>
              </div>

              <button
                onClick={fetchLeads}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, height: 36, fontSize: 12 }}
              >
                <RefreshCw size={14} /> Refresh
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

          {/* TOP STAGE KPI CARDS WITH COUNTING NUMBERS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 24
          }}>
            {stages.map(stage => {
              const stageLeads = getStageLeads(stage.id);
              const totalValue = stageLeads.reduce((acc, curr) => {
                const n = Number(curr.budget);
                return acc + (!isNaN(n) ? n : 0);
              }, 0);
              const isSelected = activeStageId === stage.id && viewMode === 'stage';

              return (
                <div
                  key={stage.id}
                  onClick={() => {
                    setActiveStageId(stage.id);
                    setViewMode('stage');
                  }}
                  style={{
                    background: isSelected ? 'var(--card)' : 'var(--surface)',
                    borderRadius: 14,
                    border: isSelected ? `2px solid ${stage.color}` : '1px solid var(--border)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isSelected ? `0 4px 16px ${stage.color}25` : '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: stage.color,
                    opacity: isSelected ? 1 : 0.4
                  }} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--text)' : 'var(--text-muted)' }}>
                      {stage.name}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 20,
                      background: isSelected ? stage.color : 'rgba(0,0,0,0.06)',
                      color: isSelected ? '#fff' : 'var(--text)',
                      transition: 'all 0.15s ease'
                    }}>
                      {stageLeads.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {totalValue > 0 ? `₹${totalValue.toLocaleString('en-IN')} pipeline` : 'No pipeline value'}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: stage.color }}>
                        Active View →
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading sales pipeline...</p>
            </div>
          ) : viewMode === 'stage' ? (
            /* DEDICATED STAGE VIEW (OPEN ON CARD CLICK) */
            <div>
              {/* Stage Header Banner */}
              <div style={{
                background: 'var(--card)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                borderLeft: `5px solid ${activeStage.color}`,
                padding: '16px 20px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                      {activeStage.name}
                    </h2>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: `${activeStage.color}18`,
                      color: activeStage.color
                    }}>
                      {activeLeads.length} {activeLeads.length === 1 ? 'Prospect' : 'Prospects'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {activeStage.desc}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontSize: 12.5 }}
                  >
                    <Plus size={14} /> Add Prospect to {activeStage.name}
                  </button>
                </div>
              </div>

              {/* Leads Grid in Active Stage */}
              {activeLeads.length === 0 ? (
                <div style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: 'var(--card)',
                  borderRadius: 16,
                  border: '1px solid var(--border)'
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: `${activeStage.color}15`,
                    color: activeStage.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16
                  }}>
                    <TrendingUp size={28} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>No prospects in {activeStage.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
                    {search ? 'No results matched your search query.' : 'Move leads from other stages or add a new prospect directly.'}
                  </p>
                  <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                    <Plus size={14} /> Add Prospect
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                  gap: 14
                }}>
                  {activeLeads.map(lead => {
                    const budgetFormatted = formatBudget(lead.budget);
                    return (
                      <div
                        key={lead._id}
                        style={{
                          background: 'var(--card)',
                          borderRadius: 14,
                          border: '1px solid var(--border)',
                          padding: '16px 18px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 14,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                          transition: 'border-color 0.15s ease'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Link
                              href={`/leads/${lead._id}`}
                              style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                            >
                              {lead.name || 'Unnamed Prospect'}
                            </Link>
                            <SourcePill source={lead.source} />
                          </div>

                          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <a href={`tel:${lead.phone}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                              📞 {lead.phone}
                            </a>
                            {lead.project && (
                              <span>📦 Offering: <strong style={{ color: 'var(--text)' }}>{lead.project}</strong></span>
                            )}
                            {budgetFormatted && (
                              <span>💰 Budget: <strong style={{ color: 'var(--text)' }}>{budgetFormatted}</strong></span>
                            )}
                            {lead.followUpDate && (
                              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                ⏰ Follow-up: {formatDisplayDateTime(lead.followUpDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stage Selector & Actions */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          paddingTop: 10,
                          borderTop: '1px solid var(--border)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Stage:</span>
                            <select
                              className="input"
                              value={lead.status || 'new_lead'}
                              onChange={e => handleStageChange(lead._id, e.target.value)}
                              style={{ height: 32, fontSize: 12, padding: '2px 8px', flex: 1, background: 'var(--surface)' }}
                            >
                              <option value="new_lead">🆕 New Lead</option>
                              <option value="contacted">📞 Contacted</option>
                              <option value="site_visit_scheduled">🏠 Site Visit / Demo</option>
                              <option value="negotiation">🤝 Negotiation</option>
                              <option value="converted">🏆 Won & Closed</option>
                              <option value="not_interested">❌ Lost</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <a
                              href={`tel:${lead.phone}`}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 9px', height: 32, color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}
                              title="Call"
                            >
                              <Phone size={13} />
                            </a>

                            <a
                              href={waLink(lead.phone, `Hi ${lead.name || ''}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 9px', height: 32, color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
                              title="WhatsApp"
                            >
                              <MessageSquare size={13} />
                            </a>

                            <Link
                              href={`/leads/${lead._id}`}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 8px', height: 32, color: 'var(--text-muted)' }}
                              title="View Profile"
                            >
                              <ChevronRight size={15} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* BOARD VIEW */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              alignItems: 'start'
            }}>
              {stages.map(stage => {
                const stageLeads = getStageLeads(stage.id);
                const totalValue = stageLeads.reduce((acc, curr) => {
                  const n = Number(curr.budget);
                  return acc + (!isNaN(n) ? n : 0);
                }, 0);

                return (
                  <div
                    key={stage.id}
                    style={{
                      background: 'var(--surface)',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      minHeight: 450
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${stage.color}`, paddingBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{stage.name}</h3>
                        </div>
                        {totalValue > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                            ₹{totalValue.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'var(--card)',
                        border: '1px solid var(--border)'
                      }}>
                        {stageLeads.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '68vh' }}>
                      {stageLeads.length === 0 ? (
                        <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                          No leads in this stage
                        </div>
                      ) : (
                        stageLeads.map(lead => {
                          const budgetFormatted = formatBudget(lead.budget);
                          return (
                            <div
                              key={lead._id}
                              style={{
                                background: 'var(--card)',
                                borderRadius: 10,
                                border: '1px solid var(--border)',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Link
                                  href={`/leads/${lead._id}`}
                                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                                >
                                  {lead.name || 'Prospect'}
                                </Link>
                                <SourcePill source={lead.source} />
                              </div>

                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span>📞 {lead.phone}</span>
                                {lead.project && <span>📦 {lead.project}</span>}
                                {budgetFormatted && <span style={{ fontWeight: 600, color: 'var(--text)' }}>💰 {budgetFormatted}</span>}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                                <select
                                  className="input"
                                  value={lead.status || 'new_lead'}
                                  onChange={e => handleStageChange(lead._id, e.target.value)}
                                  style={{ height: 28, fontSize: 11, padding: '2px 6px', flex: 1, background: 'var(--surface)' }}
                                >
                                  <option value="new_lead">🆕 New Lead</option>
                                  <option value="contacted">📞 Contacted</option>
                                  <option value="site_visit_scheduled">🏠 Site Visit</option>
                                  <option value="negotiation">🤝 Negotiation</option>
                                  <option value="converted">🏆 Converted</option>
                                  <option value="not_interested">❌ Lost</option>
                                </select>

                                <a href={`tel:${lead.phone}`} style={{ color: '#10b981', padding: '4px' }} title="Call">
                                  <Phone size={13} />
                                </a>
                                <a href={waLink(lead.phone, `Hi ${lead.name || ''}`)} target="_blank" rel="noopener noreferrer" style={{ color: '#22c55e', padding: '4px' }} title="WhatsApp">
                                  <MessageSquare size={13} />
                                </a>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => fetchLeads()}
          user={user}
        />
      )}
    </div>
  );
}
