'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, isOwner, isManager, isAgent, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { useAlarm } from '@/lib/AlarmContext';
import {
  Users, Calendar, MapPin, Award, ArrowRight, Sparkles,
  Phone, MessageSquare, Plus, Clock, CheckCircle2, TrendingUp,
  ChevronRight, RefreshCw, BarChart2, ShieldAlert
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import {
  STAGE_LABELS, STATUS_COLORS, AddLeadModal, UpgradeModal,
  ScheduleFollowUpModal, CompleteFollowUpModal
} from '@/components/LeadModals';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Overview Data
  const [leads, setLeads] = useState([]);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [unclaimedLeads, setUnclaimedLeads] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [schedulingLead, setSchedulingLead] = useState(null);
  const [completingLead, setCompletingLead] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, fuRes, unclaimedRes, analyticsRes] = await Promise.all([
        api.get('/leads?limit=10').catch(() => ({ data: { leads: [] } })),
        api.get('/leads/follow-ups/today').catch(() => ({ data: [] })),
        api.get('/leads?unclaimed=true&limit=5').catch(() => ({ data: { leads: [] } })),
        api.get('/analytics').catch(() => ({ data: null })),
      ]);

      setLeads(leadsRes.data?.leads || []);
      setTodayFollowUps(Array.isArray(fuRes.data) ? fuRes.data : []);
      setUnclaimedLeads(unclaimedRes.data?.leads || []);
      setAnalytics(analyticsRes.data || null);
    } catch {
      toast.error('Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Greeting Calculation
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const isTenantOwner = isOwner(user);

  // KPI Metrics
  const totalLeadsCount = analytics?.totalLeads ?? leads.length;
  const followUpsCount = todayFollowUps.length;
  const siteVisitsCount = leads.filter(l => l.siteVisitDate || l.status === 'site_visit_scheduled').length;
  const dealsWonCount = leads.filter(l => l.status === 'converted' || l.status === 'closed' || l.status === 'payment_done').length;

  return (
    <div className="app-container">
      <BottomNav active="dashboard" />

      <main className="main-content">
        <div style={{ width: '100%', paddingBottom: 60 }}>
          
          {/* 1. Header Greeting & Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 20
          }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
                {getGreeting()}, {user?.name ? user.name.split(' ')[0] : 'Agent'} 👋
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Here is your sales performance overview and daily priorities
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={fetchDashboardData}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <Plus size={16} /> Add Lead
              </button>
            </div>
          </div>

          {/* 2. Top 4 High-Level KPI Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 24
          }}>
            <Link
              href="/leads"
              style={{
                background: 'var(--card)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, border-color 0.15s ease'
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>My Assigned Leads</span>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                  {totalLeadsCount}
                </h2>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(79,70,229,0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} />
              </div>
            </Link>

            <Link
              href="/follow-ups"
              style={{
                background: 'var(--card)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, border-color 0.15s ease'
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Follow-ups Today</span>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: followUpsCount > 0 ? '#f59e0b' : 'var(--text)' }}>
                  {followUpsCount}
                </h2>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} />
              </div>
            </Link>

            <Link
              href="/site-visits"
              style={{
                background: 'var(--card)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, border-color 0.15s ease'
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Site Visits</span>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>
                  {siteVisitsCount}
                </h2>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(14,165,233,0.12)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={20} />
              </div>
            </Link>

            <Link
              href="/deals"
              style={{
                background: 'var(--card)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, border-color 0.15s ease'
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Deals Won</span>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                  {dealsWonCount}
                </h2>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={20} />
              </div>
            </Link>
          </div>

          {/* 3. Operational Grid (Left: Priorities, Right: Summaries) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 20
          }}>
            
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Widget 1: Today's Follow-ups Preview */}
              <div style={{
                background: 'var(--card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                padding: '18px 20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Today's Follow-ups</h3>
                    <span className="badge badge-tag" style={{ fontSize: 11 }}>{todayFollowUps.length}</span>
                  </div>
                  <Link
                    href="/follow-ups"
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    View All →
                  </Link>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading schedule...</span>
                  </div>
                ) : todayFollowUps.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <CheckCircle2 size={24} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
                    No pending follow-ups scheduled for today 🎉
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {todayFollowUps.slice(0, 4).map(fu => (
                      <div
                        key={fu._id}
                        style={{
                          background: 'var(--surface)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10
                        }}
                      >
                        <div>
                          <Link href={`/leads/${fu._id}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                            {fu.name || 'Prospect'}
                          </Link>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                            <span>📞 {fu.phone}</span>
                            {fu.followUpDate && <span>⏰ {formatDisplayDateTime(fu.followUpDate)}</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <a
                            href={`tel:${fu.phone}`}
                            style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#10b981', textDecoration: 'none', fontSize: 11, fontWeight: 600 }}
                          >
                            Call
                          </a>
                          <a
                            href={waLink(fu.phone, `Hi ${fu.name || ''}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#22c55e', textDecoration: 'none', fontSize: 11, fontWeight: 600 }}
                          >
                            WA
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Widget 2: Recent / Priority Leads Preview */}
              <div style={{
                background: 'var(--card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                padding: '18px 20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Recent Inquiries</h3>
                  </div>
                  <Link
                    href="/leads"
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Open Leads Workspace →
                  </Link>
                </div>

                {leads.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No leads assigned yet. Claim some from the pool!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {leads.slice(0, 4).map(lead => (
                      <div
                        key={lead._id}
                        style={{
                          background: 'var(--surface)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Link href={`/leads/${lead._id}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                              {lead.name || 'Prospect'}
                            </Link>
                            <SourcePill source={lead.source} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                            <span>📞 {lead.phone}</span>
                            {lead.budget && <span>💰 ₹{Number(lead.budget).toLocaleString('en-IN')}</span>}
                          </div>
                        </div>

                        <span className={`badge ${STATUS_COLORS[lead.status] || 'badge-tag'}`} style={{ fontSize: 10 }}>
                          {STAGE_LABELS[lead.status] || lead.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Widget 3: Pipeline Stage Distribution Preview */}
              <div style={{
                background: 'var(--card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                padding: '18px 20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Pipeline Summary</h3>
                  </div>
                  <Link
                    href="/pipeline"
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    View Pipeline Board →
                  </Link>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { stage: 'New Inquiries', count: leads.filter(l => l.status === 'new_lead' || l.status === 'new').length, color: '#6366f1' },
                    { stage: 'Contacted', count: leads.filter(l => l.status === 'contacted').length, color: '#0ea5e9' },
                    { stage: 'Site Visits / Tours', count: siteVisitsCount, color: '#f59e0b' },
                    { stage: 'Won / Converted', count: dealsWonCount, color: '#10b981' },
                  ].map(p => {
                    const pct = totalLeadsCount > 0 ? Math.round((p.count / totalLeadsCount) * 100) : 0;
                    return (
                      <div key={p.stage}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{p.stage}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{p.count} ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: 6, borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, p.count > 0 ? 5 : 0)}%`, height: '100%', background: p.color, borderRadius: 10 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Widget 4: Sales Performance Summary */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(16,185,129,0.04) 100%)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                padding: '18px 20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart2 size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Sales Performance</h3>
                  </div>
                  <Link
                    href="/analytics"
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Full Analytics →
                  </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--card)', padding: '12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Win Rate</span>
                    <h4 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                      {totalLeadsCount > 0 ? `${((dealsWonCount / totalLeadsCount) * 100).toFixed(1)}%` : '0.0%'}
                    </h4>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target Progress</span>
                    <h4 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                      {dealsWonCount} / 10 Deals
                    </h4>
                  </div>
                </div>

                {/* Quick Unclaimed Leads Notification CTA */}
                {unclaimedLeads.length > 0 && (
                  <div style={{
                    marginTop: 14,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(217,119,6,0.1)',
                    border: '1px solid rgba(217,119,6,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={14} /> {unclaimedLeads.length} Unclaimed Leads Available
                    </span>
                    <Link
                      href="/leads?tab=unclaimed"
                      className="btn btn-primary btn-sm"
                      style={{ background: '#d97706', borderColor: '#d97706', padding: '4px 10px', fontSize: 11, fontWeight: 700 }}
                    >
                      Claim 🎯
                    </Link>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* Floating Quick Action */}
      <button
        onClick={() => setShowAddModal(true)}
        className="btn-floating"
        title="Add New Lead"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 90
        }}
      >
        <Plus size={24} />
      </button>

      {/* Modals */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => fetchDashboardData()}
          onLimitReached={() => setShowUpgradeModal(true)}
          user={user}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
