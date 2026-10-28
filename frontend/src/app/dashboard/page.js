'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api, { cachedGet, getCachedData } from '@/lib/api';
import { waLink, isOwner, isManager, isAgent, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { useAlarm } from '@/lib/AlarmContext';
import {
  Users, Calendar, MapPin, Award, ArrowRight, Sparkles,
  Phone, MessageSquare, Plus, Clock, CheckCircle2, TrendingUp,
  ChevronRight, RefreshCw, BarChart2, ShieldAlert, DollarSign,
  Percent, Building2, Layers, CheckSquare, FileText, AlertTriangle,
  UserCheck, Flame, Zap, GraduationCap, Target
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import dynamic from 'next/dynamic';
import { STAGE_LABELS, STATUS_COLORS } from '@/components/LeadModals';

const AddLeadModal = dynamic(() => import('@/components/LeadModals').then(m => m.AddLeadModal), { ssr: false });
const UpgradeModal = dynamic(() => import('@/components/LeadModals').then(m => m.UpgradeModal), { ssr: false });
const ScheduleFollowUpModal = dynamic(() => import('@/components/LeadModals').then(m => m.ScheduleFollowUpModal), { ssr: false });
const CompleteFollowUpModal = dynamic(() => import('@/components/LeadModals').then(m => m.CompleteFollowUpModal), { ssr: false });

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsListOptions, todayFollowUpsOptions, dashboardStatsOptions } from '@/lib/queries';

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  const { data: leadsData, isLoading: isLeadsLoading, refetch: refetchLeads } = useQuery(leadsListOptions({ limit: 10 }));
  const { data: todayFollowUpsData = [], refetch: refetchFollowUps } = useQuery(todayFollowUpsOptions());
  const { data: analyticsData, refetch: refetchAnalytics } = useQuery(dashboardStatsOptions());

  const leads = leadsData?.leads || [];
  const todayFollowUps = Array.isArray(todayFollowUpsData) ? todayFollowUpsData : [];
  const analytics = analyticsData || null;
  const loading = isLeadsLoading && leads.length === 0;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [schedulingLead, setSchedulingLead] = useState(null);
  const [completingLead, setCompletingLead] = useState(null);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      await Promise.all([
        refetchLeads(),
        refetchFollowUps(),
        refetchAnalytics(),
      ]);
    }
  }, [refetchLeads, refetchFollowUps, refetchAnalytics]);

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

  // Helper to format Indian Currency
  const formatINR = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  // Generic KPI Metrics
  const totalLeadsCount = analytics?.totalLeads ?? leads.length;
  const followUpsCount = todayFollowUps.length;
  const siteVisitsCount = leads.filter(l => l.siteVisitDate || l.status === 'site_visit_scheduled').length;
  const dealsWonCount = leads.filter(l => l.status === 'converted' || l.status === 'closed' || l.status === 'payment_done').length;

  return (
    <div className="app-container">
      <BottomNav active="dashboard" />

      <main className="main-content" data-crm-canvas="true">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header Greeting & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 tracking-tight" suppressHydrationWarning>
                {getGreeting()}, {mounted && user?.name ? user.name.split(' ')[0] : 'Consultant'} 👋
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Candidate pipeline, admissions overview, and daily follow-up queue
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2 pt-1 sm:pt-0">
              <button
                onClick={fetchDashboardData}
                className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center"
                style={{ gap: 6, fontSize: 13 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <Link
                href="/campaigns"
                className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center border border-slate-200 hover:bg-indigo-50/60 hover:text-indigo-600 transition"
                style={{ gap: 6, fontSize: 13, textDecoration: 'none' }}
              >
                <Target size={14} className="text-indigo-600" /> Campaigns
              </Link>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center"
                style={{ gap: 6, fontSize: 13 }}
              >
                <Plus size={16} /> Add Candidate
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4 High-Level KPI Summary Cards */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mb-6 dashboard-kpi-grid">
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
                transition: 'all 0.15s ease'
              }}
              className="hover:border-indigo-200 hover:shadow-xs"
            >
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Total Candidates
                </span>
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
                transition: 'all 0.15s ease'
              }}
              className="hover:border-amber-200 hover:shadow-xs"
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
              href="/pipeline"
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
                transition: 'all 0.15s ease'
              }}
              className="hover:border-sky-200 hover:shadow-xs"
            >
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Active Pipeline</span>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>
                  {leads.filter(l => !['converted', 'closed', 'lost', 'payment_done'].includes(l.status)).length}
                </h2>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(14,165,233,0.12)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} />
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
                transition: 'all 0.15s ease'
              }}
              className="hover:border-emerald-200 hover:shadow-xs"
            >
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Admissions Confirmed</span>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                  {dealsWonCount}
                </h2>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={20} />
              </div>
            </Link>
          </div>

          {/* Operational Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Today's Follow-ups */}
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

                {todayFollowUps.length === 0 ? (
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

                  {/* Recent Leads */}
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
                  
                  {/* Pipeline Stage Distribution */}
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
                        { stage: 'Inquiries Received', count: leads.filter(l => l.status === 'Lead Received' || l.status === 'new_lead' || l.status === 'new').length, color: '#6366f1' },
                        { stage: 'Tele-Counselling / Discovery', count: leads.filter(l => l.status === 'Tele-Counselling / Discovery' || l.status === 'contacted').length, color: '#0ea5e9' },
                        { stage: 'College Options Shortlisted', count: leads.filter(l => l.status === 'College Options Shortlisted' || l.status === 'Direct Campus Visit Arranged').length, color: '#f59e0b' },
                        { stage: 'Admissions Finalized', count: dealsWonCount, color: '#10b981' },
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

                  {/* Sales Performance */}
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

                  </div>

                </div>

              </div>


        </div>
        {/* Mobile Floating Action Button (1-Tap Quick Lead Intake) */}
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="fab-button md:hidden"
          title="Add New Prospect"
          aria-label="Add New Lead"
        >
          <Plus size={28} />
        </button>
      </main>

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
