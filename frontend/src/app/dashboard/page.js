'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, isOwner, isManager, isAgent, isRealEstateTenant, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { useAlarm } from '@/lib/AlarmContext';
import {
  Users, Calendar, MapPin, Award, ArrowRight, Sparkles,
  Phone, MessageSquare, Plus, Clock, CheckCircle2, TrendingUp,
  ChevronRight, RefreshCw, BarChart2, ShieldAlert, DollarSign,
  Percent, Building2, Layers, CheckSquare, FileText, AlertTriangle,
  UserCheck, Flame, Zap
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

  // Generic Overview Data
  const [leads, setLeads] = useState([]);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [unclaimedLeads, setUnclaimedLeads] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Real Estate Manager Specific Data
  const [reAnalytics, setReAnalytics] = useState(null);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [teamWorkload, setTeamWorkload] = useState([]);
  const [paymentsSummary, setPaymentsSummary] = useState(null);
  const [hotLeads, setHotLeads] = useState([]);

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

  const isRealEstateManager = isManager(user) && isRealEstateTenant(user);
  const isTenantOwner = isOwner(user);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const u = getUser();
    const isRE = isManager(u) && isRealEstateTenant(u);

    try {
      if (isRE) {
        // Real Estate Manager Aggregations
        const [
          leadsRes,
          fuRes,
          unclaimedRes,
          reAnalyticsRes,
          teamPerfRes,
          teamWorkloadRes,
          paymentsRes,
          hotLeadsRes,
        ] = await Promise.all([
          api.get('/leads?limit=10').catch(() => ({ data: { leads: [] } })),
          api.get('/leads/follow-ups/today').catch(() => ({ data: [] })),
          api.get('/leads?unclaimed=true&limit=5').catch(() => ({ data: { leads: [] } })),
          api.get('/real-estate/analytics/summary').catch(() => ({ data: { data: null } })),
          api.get('/real-estate/team/performance').catch(() => ({ data: { data: [] } })),
          api.get('/real-estate/team/workload').catch(() => ({ data: { data: [] } })),
          api.get('/real-estate/payments/summary').catch(() => ({ data: { data: null } })),
          api.get('/leads?temperature=HOT&limit=6').catch(() => ({ data: { leads: [] } })),
        ]);

        setLeads(leadsRes.data?.leads || []);
        setTodayFollowUps(Array.isArray(fuRes.data) ? fuRes.data : []);
        setUnclaimedLeads(unclaimedRes.data?.leads || []);
        setReAnalytics(reAnalyticsRes.data?.data || null);
        setTeamPerformance(teamPerfRes.data?.data || []);
        setTeamWorkload(teamWorkloadRes.data?.data || []);
        setPaymentsSummary(paymentsRes.data?.data || null);
        setHotLeads(hotLeadsRes.data?.leads || []);
      } else {
        // Generic CRM Overview
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
      }
    } catch (err) {
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

      <main className="main-content">
        <div style={{ width: '100%', paddingBottom: 60 }}>
          
          {/* Header Greeting & Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 20
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
                  {getGreeting()}, {user?.name ? user.name.split(' ')[0] : 'Manager'} 👋
                </h1>
                {isRealEstateManager && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'rgba(99,102,241,0.12)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <Building2 size={12} /> Real Estate Manager
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                {isRealEstateManager
                  ? 'Real-time team analytics, lead temperatures, site visits, opportunities and bookings'
                  : isTenantOwner || isManager(user)
                  ? 'Here is your organization overview, sales pipeline and daily priorities'
                  : 'Here is your sales performance overview and daily priorities'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={fetchDashboardData}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              {isRealEstateManager && (
                <Link
                  href="/leads?tab=distribution"
                  className="btn btn-ghost btn-sm"
                  style={{ gap: 6, fontSize: 13, border: '1px solid var(--border)' }}
                >
                  <Users size={14} /> Distribute Leads
                </Link>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <Plus size={16} /> Add Lead
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* A. REAL ESTATE MANAGER COMPLETE KPI PANEL                                */}
          {/* ========================================================================= */}
          {isRealEstateManager ? (
            <>
              {/* 8 Specialized Real Estate KPI Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14,
                marginBottom: 24
              }}>
                {/* 1. Total Team Leads */}
                <Link
                  href="/leads?tab=team_leads"
                  style={{
                    background: 'var(--card)',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    padding: '16px 18px',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Team Leads</span>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(79,70,229,0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={18} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                      {reAnalytics?.leads?.total ?? 0}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                        🔥 {reAnalytics?.leads?.hot ?? 0} HOT
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                        ⚡ {reAnalytics?.leads?.warm ?? 0} WARM
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>
                        ❄️ {reAnalytics?.leads?.cold ?? 0} COLD
                      </span>
                    </div>
                  </div>
                </Link>

                {/* 2. Follow-ups Due */}
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
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Follow-ups Due</span>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={18} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: (reAnalytics?.followUps?.today || 0) > 0 ? '#f59e0b' : 'var(--text)' }}>
                      {reAnalytics?.followUps?.today ?? todayFollowUps.length}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {(reAnalytics?.followUps?.overdue || 0) > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                          ⚠️ {reAnalytics?.followUps?.overdue} Overdue
                        </span>
                      )}
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(100,116,139,0.1)', color: 'var(--text-muted)' }}>
                        📅 {reAnalytics?.followUps?.upcoming ?? 0} Upcoming
                      </span>
                    </div>
                  </div>
                </Link>

                {/* 3. Site Visits */}
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
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Site Visits</span>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(14,165,233,0.12)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin size={18} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#0ea5e9' }}>
                      {reAnalytics?.siteVisits?.total ?? 0}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                        ✅ {reAnalytics?.siteVisits?.completed ?? 0} Done ({reAnalytics?.siteVisits?.conversionRate || '0%'})
                      </span>
                      {(reAnalytics?.siteVisits?.today || 0) > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}>
                          📍 {reAnalytics?.siteVisits?.today} Today
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* 4. Real Estate Pipeline */}
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
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Pipeline Value</span>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={18} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--accent)' }}>
                      {formatINR(reAnalytics?.pipeline?.totalValue || 0)}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
                        ⚖️ Weighted: {formatINR(reAnalytics?.pipeline?.weightedValue || 0)}
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(100,116,139,0.1)', color: 'var(--text-muted)' }}>
                        🎯 {reAnalytics?.pipeline?.openDeals ?? 0} Deals
                      </span>
                    </div>
                  </div>
                </Link>

                {/* 5. Expressions of Interest (EOI) */}
                <Link
                  href="/eoi"
                  style={{
                    background: 'var(--card)',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    padding: '16px 18px',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Active EOI Tokens</span>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(168,85,247,0.12)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={18} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#a855f7' }}>
                      {reAnalytics?.eois?.total ?? 0}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                        ✅ {reAnalytics?.eois?.confirmed ?? 0} Confirmed
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                        ⏳ {reAnalytics?.eois?.pending ?? 0} Pending
                      </span>
                    </div>
                  </div>
                </Link>

                {/* 6. Bookings & Revenue */}
                <Link
                  href="/bookings"
                  style={{
                    background: 'var(--card)',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    padding: '16px 18px',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Team Bookings</span>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Award size={18} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#10b981' }}>
                      {formatINR(reAnalytics?.bookings?.totalAgreementValue || 0)}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                        🏆 {reAnalytics?.bookings?.count ?? 0} Units Booked
                      </span>
                    </div>
                  </div>
                </Link>

                {/* 7. Payments & Collections */}
                <Link
                  href="/payments"
                  style={{
                    background: 'var(--card)',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    padding: '16px 18px',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Collections</span>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(234,179,8,0.12)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={18} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#eab308' }}>
                      {formatINR(paymentsSummary?.totalCollected || reAnalytics?.bookings?.totalCollectedAmount || 0)}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {(paymentsSummary?.overdueAmount || 0) > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                          ⚠️ {formatINR(paymentsSummary.overdueAmount)} Overdue
                        </span>
                      )}
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(100,116,139,0.1)', color: 'var(--text-muted)' }}>
                        ⏳ {formatINR(paymentsSummary?.dueAmount || 0)} Due (15d)
                      </span>
                    </div>
                  </div>
                </Link>

                {/* 8. Live Inventory Status */}
                <Link
                  href="/projects?tab=inventory"
                  style={{
                    background: 'var(--card)',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    padding: '16px 18px',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Live Project Inventory</span>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={18} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#10b981' }}>
                        {reAnalytics?.inventory?.available ?? 0}
                      </h2>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Units Available</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        🔒 {reAnalytics?.inventory?.hold ?? 0} Hold
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                        📑 {reAnalytics?.inventory?.booked ?? 0} Booked
                      </span>
                    </div>
                  </div>
                </Link>
              </div>

              {/* 2-Column Operational Real Estate Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: 20
              }}>
                {/* LEFT COLUMN: High Priority Queues */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* HOT Leads Queue */}
                  <div style={{
                    background: 'var(--card)',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    padding: '18px 20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Flame size={18} color="#ef4444" />
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>HOT Leads & High Intent Prospects</h3>
                        <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, fontWeight: 800 }}>
                          {hotLeads.length}
                        </span>
                      </div>
                      <Link
                        href="/leads?tab=hot"
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        All Hot Leads →
                      </Link>
                    </div>

                    {loading ? (
                      <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading hot leads...</span>
                      </div>
                    ) : hotLeads.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        No hot leads at the moment. As team schedules site visits and captures budgets, hot prospects will appear here automatically.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {hotLeads.slice(0, 4).map(lead => (
                          <div
                            key={lead._id}
                            style={{
                              background: 'var(--surface)',
                              borderRadius: 12,
                              padding: '12px 14px',
                              border: '1px solid rgba(239,68,68,0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Link href={`/leads/${lead._id}`} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                                  {lead.name || 'Prospect'}
                                </Link>
                                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: '#ef4444', color: '#fff' }}>
                                  HOT ({lead.score ?? 60} pts)
                                </span>
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                                <span>📞 {lead.phone}</span>
                                {lead.budget && <span>💰 {formatINR(lead.budget)}</span>}
                                {lead.assignedToName && <span>👤 {lead.assignedToName}</span>}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6 }}>
                              <a
                                href={`tel:${lead.phone}`}
                                style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#10b981', textDecoration: 'none', fontSize: 11.5, fontWeight: 700 }}
                              >
                                Call
                              </a>
                              <a
                                href={waLink(lead.phone, `Hi ${lead.name || ''}, regarding your real estate inquiry...`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#22c55e', textDecoration: 'none', fontSize: 11.5, fontWeight: 700 }}
                              >
                                WhatsApp
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Today's Follow-ups & Site Visits Queue */}
                  <div style={{
                    background: 'var(--card)',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    padding: '18px 20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={18} color="var(--accent)" />
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Today's Follow-ups & Visits</h3>
                        <span className="badge badge-tag" style={{ fontSize: 11 }}>{todayFollowUps.length}</span>
                      </div>
                      <Link
                        href="/follow-ups"
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        Schedule →
                      </Link>
                    </div>

                    {todayFollowUps.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        <CheckCircle2 size={24} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
                        No pending team follow-ups scheduled for today 🎉
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

                </div>

                {/* RIGHT COLUMN: Team Leaderboard & Performance */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Team Performance Leaderboard */}
                  <div style={{
                    background: 'var(--card)',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    padding: '18px 20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserCheck size={18} color="var(--accent)" />
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Team Agent Performance</h3>
                      </div>
                      <Link
                        href="/agency?tab=performance"
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        Team Details →
                      </Link>
                    </div>

                    {teamPerformance.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        No agent activity recorded yet.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Agent</th>
                              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Leads</th>
                              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Visits</th>
                              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Bookings</th>
                              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Revenue</th>
                              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Conv %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamPerformance.slice(0, 5).map(agent => (
                              <tr key={agent.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 6px', fontWeight: 700, color: 'var(--text)' }}>
                                  {agent.name}
                                </td>
                                <td style={{ padding: '10px 6px' }}>{agent.leadsAssigned}</td>
                                <td style={{ padding: '10px 6px' }}>{agent.completedVisits} / {agent.siteVisits}</td>
                                <td style={{ padding: '10px 6px', fontWeight: 700, color: '#10b981' }}>{agent.bookings}</td>
                                <td style={{ padding: '10px 6px', fontWeight: 700, color: 'var(--accent)' }}>{formatINR(agent.bookingValue)}</td>
                                <td style={{ padding: '10px 6px' }}>
                                  <span style={{ fontWeight: 700, color: Number(agent.conversionRate) > 10 ? '#10b981' : 'inherit' }}>
                                    {agent.conversionRate}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Real Estate Conversion Funnel */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(16,185,129,0.04) 100%)',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    padding: '18px 20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart2 size={18} color="var(--accent)" />
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Real Estate Conversion Funnel</h3>
                      </div>
                      <Link
                        href="/analytics"
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        Analytics →
                      </Link>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Total Inquiries', count: reAnalytics?.leads?.total || 0, color: '#6366f1' },
                        { label: 'Active Requirements', count: reAnalytics?.requirements?.active || 0, color: '#0ea5e9' },
                        { label: 'Site Visits Completed', count: reAnalytics?.siteVisits?.completed || 0, color: '#f59e0b' },
                        { label: 'Open Opportunities', count: reAnalytics?.pipeline?.openDeals || 0, color: '#a855f7' },
                        { label: 'EOI Tokens Confirmed', count: reAnalytics?.eois?.confirmed || 0, color: '#ec4899' },
                        { label: 'Final Bookings', count: reAnalytics?.bookings?.count || 0, color: '#10b981' },
                      ].map((step, idx) => {
                        const total = reAnalytics?.leads?.total || 1;
                        const pct = Math.round((step.count / Math.max(total, 1)) * 100);
                        return (
                          <div key={step.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                              <span style={{ fontWeight: 600 }}>{idx + 1}. {step.label}</span>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{step.count} ({pct}%)</span>
                            </div>
                            <div style={{ width: '100%', height: 6, borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(pct, step.count > 0 ? 6 : 0)}%`, height: '100%', background: step.color, borderRadius: 10 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>
            </>
          ) : (
            /* ========================================================================= */
            /* B. GENERIC CRM DASHBOARD (FOR OTHER VERTICALS & ROLES)                    */
            /* ========================================================================= */
            <>
              {/* 4 High-Level KPI Summary Cards */}
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
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {isTenantOwner || isManager(user) ? 'Total Organization Leads' : 'My Assigned Leads'}
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

              {/* Operational Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: 20
              }}>
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
            </>
          )}

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
