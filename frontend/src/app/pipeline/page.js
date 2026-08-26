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
  Layers, ArrowRight, CheckCircle2, ChevronRight
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import { STAGE_LABELS, STATUS_COLORS, AddLeadModal } from '@/components/LeadModals';

export default function PipelinePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
      const res = await api.get('/leads?limit=200');
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
    { id: 'new_lead', name: 'New Inquiries', color: '#6366f1' },
    { id: 'contacted', name: 'Contacted', color: '#0ea5e9' },
    { id: 'site_visit_scheduled', name: 'Site Visit / Demo', color: '#f59e0b' },
    { id: 'negotiation', name: 'Negotiation', color: '#8b5cf6' },
    { id: 'converted', name: 'Won & Closed', color: '#10b981' },
  ];

  const filteredLeads = leads.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      (l.project && l.project.toLowerCase().includes(q))
    );
  });

  return (
    <div className="app-container">
      <BottomNav active="pipeline" />

      <main className="main-content">
        <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingUp size={26} color="var(--accent)" /> Sales Pipeline Workspace
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Visual stage progression board for your assigned opportunities
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

          {/* Kanban Columns */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading sales pipeline...</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 16,
              alignItems: 'start'
            }}>
              {stages.map(stage => {
                const stageLeads = filteredLeads.filter(l => {
                  if (stage.id === 'new_lead') return l.status === 'new_lead' || l.status === 'new' || !l.status;
                  if (stage.id === 'converted') return l.status === 'converted' || l.status === 'closed' || l.status === 'payment_done';
                  return l.status === stage.id;
                });

                const totalValue = stageLeads.reduce((acc, curr) => acc + (Number(curr.budget) || 0), 0);

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
                      minHeight: 400
                    }}
                  >
                    {/* Column Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${stage.color}`, paddingBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{stage.name}</h3>
                        </div>
                        {totalValue > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                            ₹{totalValue.toLocaleString('en-IN')} pipeline
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

                    {/* Leads Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '68vh', paddingRight: 2 }}>
                      {stageLeads.length === 0 ? (
                        <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                          No leads in this stage
                        </div>
                      ) : (
                        stageLeads.map(lead => (
                          <div
                            key={lead._id}
                            style={{
                              background: 'var(--card)',
                              borderRadius: 10,
                              border: '1px solid var(--border)',
                              padding: '12px',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
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
                              {lead.budget && <span style={{ fontWeight: 600, color: 'var(--text)' }}>💰 ₹{Number(lead.budget).toLocaleString('en-IN')}</span>}
                            </div>

                            {/* Move Stage Selector & Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                              <select
                                className="input"
                                value={lead.status || 'new_lead'}
                                onChange={e => handleStageChange(lead._id, e.target.value)}
                                style={{ height: 28, fontSize: 11, padding: '2px 6px', flex: '1 1 auto', background: 'var(--surface)' }}
                              >
                                <option value="new_lead">🆕 New Lead</option>
                                <option value="contacted">📞 Contacted</option>
                                <option value="site_visit_scheduled">🏠 Site Visit</option>
                                <option value="negotiation">🤝 Negotiation</option>
                                <option value="converted">🏆 Converted</option>
                                <option value="not_interested">❌ Lost</option>
                              </select>

                              <a
                                href={`tel:${lead.phone}`}
                                style={{ color: '#10b981', padding: '4px', textDecoration: 'none' }}
                                title="Call"
                              >
                                <Phone size={13} />
                              </a>

                              <a
                                href={waLink(lead.phone, `Hi ${lead.name || ''}`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#22c55e', padding: '4px' }}
                                title="WhatsApp"
                              >
                                <MessageSquare size={13} />
                              </a>
                            </div>
                          </div>
                        ))
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
