'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Award, TrendingUp, Search, Phone, MessageSquare, RefreshCw,
  DollarSign, CheckCircle2, XCircle, Clock, ChevronRight
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import { STAGE_LABELS } from '@/components/LeadModals';

export default function DealsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [subTab, setSubTab] = useState('won'); // 'won' | 'negotiation' | 'lost'
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/leads?limit=200');
      const allLeads = res.data?.leads || [];
      setDeals(allLeads);
    } catch {
      toast.error('Failed to load deals data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const wonDeals = deals.filter(l => l.status === 'converted' || l.status === 'closed' || l.status === 'payment_done');
  const negotiationDeals = deals.filter(l => l.status === 'negotiation' || l.status === 'site_visit_scheduled');
  const lostDeals = deals.filter(l => l.status === 'not_interested' || l.status === 'lost');

  const totalWonRevenue = wonDeals.reduce((sum, d) => sum + (Number(d.budget) || 0), 0);
  const totalNegotiationPipeline = negotiationDeals.reduce((sum, d) => sum + (Number(d.budget) || 0), 0);

  const activeList = (subTab === 'won' ? wonDeals : subTab === 'negotiation' ? negotiationDeals : lostDeals)
    .filter(d => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.phone && d.phone.includes(q)) ||
        (d.project && d.project.toLowerCase().includes(q))
      );
    });

  return (
    <div className="app-container">
      <BottomNav active="deals" />

      <main className="main-content">
        <div style={{ width: '100%', paddingBottom: 60 }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Award size={26} color="#10b981" /> Deals & Opportunities Workspace
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Track closed contracts, active revenue opportunities, and deal values
              </p>
            </div>

            <button
              onClick={fetchDeals}
              className="btn btn-ghost btn-sm"
              style={{ gap: 6, fontSize: 13 }}
            >
              <RefreshCw size={14} /> Refresh Deals
            </button>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Closed Revenue</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: '#10b981' }}>
                ₹{totalWonRevenue.toLocaleString('en-IN')}
              </h2>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Deals Won Count</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: 'var(--text)' }}>
                {wonDeals.length} Won Deals
              </h2>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>In Negotiation Pipeline</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: 'var(--accent)' }}>
                ₹{totalNegotiationPipeline.toLocaleString('en-IN')}
              </h2>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 12,
            marginBottom: 20
          }}>
            <button
              onClick={() => setSubTab('won')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: subTab === 'won' ? '#10b981' : 'var(--surface)',
                color: subTab === 'won' ? '#fff' : 'var(--text)',
                fontWeight: subTab === 'won' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <CheckCircle2 size={16} /> Won Deals ({wonDeals.length})
            </button>

            <button
              onClick={() => setSubTab('negotiation')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: subTab === 'negotiation' ? 'var(--accent)' : 'var(--surface)',
                color: subTab === 'negotiation' ? '#fff' : 'var(--text)',
                fontWeight: subTab === 'negotiation' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <Clock size={16} /> In Negotiation ({negotiationDeals.length})
            </button>

            <button
              onClick={() => setSubTab('lost')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: subTab === 'lost' ? '#ef4444' : 'var(--surface)',
                color: subTab === 'lost' ? '#fff' : 'var(--text)',
                fontWeight: subTab === 'lost' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <XCircle size={16} /> Lost Opportunities ({lostDeals.length})
            </button>
          </div>

          {/* Search */}
          <div style={{ marginBottom: 16, position: 'relative', maxWidth: 400 }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              type="text"
              className="input"
              placeholder="Search deals by client, phone, package..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
            />
          </div>

          {/* Listing */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading deals...</p>
            </div>
          ) : activeList.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Award size={28} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Deals Found in this Category</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                Advance prospects through your sales pipeline to populate this view.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeList.map(deal => (
                <div
                  key={deal._id}
                  style={{
                    background: 'var(--card)',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 14
                  }}
                >
                  <div style={{ flex: '1 1 280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Link
                        href={`/leads/${deal._id}`}
                        style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                      >
                        {deal.name || 'Unnamed Prospect'}
                      </Link>
                      <span className="badge badge-tag" style={{ fontSize: 11 }}>
                        {STAGE_LABELS[deal.status] || deal.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>📞 {deal.phone}</span>
                      {deal.project && <span>📦 {deal.project}</span>}
                      {deal.budget && (
                        <span style={{ fontWeight: 700, color: subTab === 'won' ? '#10b981' : 'var(--accent)' }}>
                          💰 Deal Value: ₹{Number(deal.budget).toLocaleString('en-IN')}
                        </span>
                      )}
                      {deal.updatedAt && (
                        <span>🕒 Last Activity: {new Date(deal.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <a
                      href={`tel:${deal.phone}`}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 10px', height: 34, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                    >
                      <Phone size={14} /> Call
                    </a>

                    <a
                      href={waLink(deal.phone, `Hi ${deal.name || ''}, connecting regarding our proposal.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 10px', height: 34, color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                    >
                      <MessageSquare size={14} /> WhatsApp
                    </a>

                    <Link
                      href={`/leads/${deal._id}`}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 8px', height: 34, color: 'var(--text-muted)' }}
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
