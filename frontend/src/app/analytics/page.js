'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import toast from 'react-hot-toast';
import { isRealEstateTenant, isManager, isOwner, getUser } from '@/lib/auth';
import {
  BarChart2, TrendingUp, Users, Calendar, MessageSquare, Mic,
  Download, FileSpreadsheet, FileText, X, Award, DollarSign,
  Building2, MapPin, Sparkles, UserCheck, Flame, Layers,
  ChevronRight, ArrowDown, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:13 }}>
        <p style={{ margin:0, color:'var(--text-muted)' }}>{label}</p>
        <p style={{ margin:'2px 0 0', fontWeight:600 }}>{payload[0].value} leads</p>
      </div>
    );
  }
  return null;
};

function ExportAnalyticsModal({ onClose, isCompanyOwner }) {
  const [format, setFormat] = useState('xlsx');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    e.preventDefault();
    setDownloading(true);
    try {
      toast.loading(`Generating Analytics ${format.toUpperCase()} report...`, { id: 'analytics-toast' });
      const endpoint = isCompanyOwner ? '/company/analytics/export' : '/analytics/export';
      const response = await api.get(endpoint, {
        params: { format },
        responseType: 'blob',
      });

      const mimeType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_performance_report_${new Date().toISOString().slice(0, 10)}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Analytics ${format.toUpperCase()} downloaded! 📊`, { id: 'analytics-toast' });
      onClose();
    } catch {
      toast.error('Failed to export analytics report', { id: 'analytics-toast' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              📊
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Export Analytics Report</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {isCompanyOwner ? 'Organization KPIs, Agent Leaderboard & Total Revenue' : 'Pipeline Breakdown, Stage Conversion & Revenue'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleDownload}>
          <div style={{ marginBottom: 18 }}>
            <label className="label" style={{ fontWeight: 700, marginBottom: 8 }}>Choose Report Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: `1.5px solid ${format === 'xlsx' ? 'var(--accent)' : 'var(--border)'}`,
                  background: format === 'xlsx' ? 'rgba(79,70,229,0.08)' : 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <FileSpreadsheet size={24} color={format === 'xlsx' ? 'var(--accent)' : 'var(--text-muted)'} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: `1.5px solid ${format === 'pdf' ? 'var(--accent)' : 'var(--border)'}`,
                  background: format === 'pdf' ? 'rgba(79,70,229,0.08)' : 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <FileText size={24} color={format === 'pdf' ? 'var(--accent)' : 'var(--text-muted)'} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>PDF Document</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
            <button type="submit" disabled={downloading} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
              <Download size={14} /> {downloading ? 'Exporting...' : 'Download File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab') || 'performance';
  const [activeTab, setActiveTab] = useState(rawTab);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  const [data, setData] = useState(null);
  const [reAnalytics, setReAnalytics] = useState(null);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);

    Promise.all([
      api.get('/analytics').catch(() => ({ data: null })),
      api.get('/real-estate/analytics/summary').catch(() => ({ data: { data: null } })),
      api.get('/real-estate/team/performance').catch(() => ({ data: { data: [] } })),
    ]).then(([genRes, reRes, teamRes]) => {
      setData(genRes.data || null);
      setReAnalytics(reRes.data?.data || null);
      setTeamPerformance(teamRes.data?.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const isCompanyOwner = isOwner(user);
  const isRE = isRealEstateTenant(user);

  const formatINR = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  if (loading) return (
    <div className="app-shell" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh' }}>
      <div className="spinner" />
    </div>
  );

  const {
    totalLeads = 0,
    byStatus = {},
    conversionRate = 0,
    totalRevenue = 0,
    totalTemplates = 0,
    todayFollowUps = 0,
  } = data || {};

  const statusChartData = [
    { name: 'New', value: byStatus.new || 0, color: '#6366f1' },
    { name: 'Contacted', value: byStatus.contacted || 0, color: '#eab308' },
    { name: 'Follow-up', value: byStatus.follow_up || 0, color: '#f97316' },
    { name: 'Closed', value: byStatus.closed || 0, color: '#22c55e' },
  ];

  // Full 6-Stage Real Estate Funnel Numbers (Pure Real Data from API)
  const totalLeadsCount = reAnalytics?.leads?.total ?? (totalLeads || 0);
  const activeRequirementsCount = reAnalytics?.requirements?.active ?? (reAnalytics?.requirements?.total || 0);
  const totalSiteVisits = reAnalytics?.siteVisits?.total ?? (reAnalytics?.siteVisits?.completed || 0);
  const openOpportunities = reAnalytics?.pipeline?.openDeals ?? 0;
  const totalEOIs = reAnalytics?.eois?.total ?? (reAnalytics?.eois?.confirmed || 0);
  const totalBookings = reAnalytics?.bookings?.count ?? 0;

  const funnelSteps = [
    { id: 'leads', name: 'Total Leads Captured', count: totalLeadsCount, color: '#6366f1', pct: totalLeadsCount > 0 ? 100 : 0 },
    { id: 'requirements', name: 'Requirements Captured', count: activeRequirementsCount, color: '#0ea5e9', pct: totalLeadsCount > 0 ? Math.round((activeRequirementsCount / totalLeadsCount) * 100) : 0 },
    { id: 'site_visits', name: 'Site Visits Conducted', count: totalSiteVisits, color: '#f59e0b', pct: totalLeadsCount > 0 ? Math.round((totalSiteVisits / totalLeadsCount) * 100) : 0 },
    { id: 'opportunities', name: 'Active Negotiations', count: openOpportunities, color: '#8b5cf6', pct: totalLeadsCount > 0 ? Math.round((openOpportunities / totalLeadsCount) * 100) : 0 },
    { id: 'eoi', name: 'EOI Tokens Received', count: totalEOIs, color: '#ec4899', pct: totalLeadsCount > 0 ? Math.round((totalEOIs / totalLeadsCount) * 100) : 0 },
    { id: 'bookings', name: 'Confirmed Unit Bookings', count: totalBookings, color: '#10b981', pct: totalLeadsCount > 0 ? Math.round((totalBookings / totalLeadsCount) * 100) : 0 },
  ];

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={26} color="var(--accent)" /> Real Estate Sales & Conversion Analytics
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Real-time pipeline metrics, team performance leaderboard, funnel conversion and revenue realization.
            </p>
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            className="btn btn-secondary btn-sm"
            style={{ gap: 6, borderRadius: 10, fontSize: 12, color: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            <Download size={14} /> Export Report
          </button>
        </div>

        {/* Tab Navigation for Real Estate Analytics */}
        {isRE && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 14, overflowX: 'auto' }}>
            {[
              { id: 'performance', label: '🏆 Team Leaderboard' },
              { id: 'leads', label: '🎯 Conversion Funnel' },
              { id: 'site_visits', label: '📍 Site Visits Conversion' },
              { id: 'eoi', label: '📑 EOI Token Analytics' },
              { id: 'bookings', label: '💰 Booking & Revenue' },
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 12px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: active ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="page-content">
          {/* Top 4 KPI Metrics Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 20
          }}>
            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Pipeline Value</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                {formatINR(reAnalytics?.pipeline?.totalValue || totalRevenue || 0)}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                ⚖️ Weighted: {formatINR(reAnalytics?.pipeline?.weightedValue || 0)}
              </span>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Site Visit Conversion</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>
                {reAnalytics?.siteVisits?.conversionRate || '0%'}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                📍 {reAnalytics?.siteVisits?.completed ?? 0} Visits Completed
              </span>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>EOI Conversion Rate</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#a855f7' }}>
                {reAnalytics?.eois?.conversionRate || '0%'}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                📑 {reAnalytics?.eois?.confirmed ?? 0} Confirmed Tokens
              </span>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Confirmed Bookings</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                {formatINR(reAnalytics?.bookings?.totalAgreementValue || 0)}
              </h3>
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, display: 'block', marginTop: 4 }}>
                🏆 {reAnalytics?.bookings?.count ?? 0} Units Booked
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: TEAM LEADERBOARD & PERFORMANCE                                    */}
          {/* ========================================================================= */}
          {(activeTab === 'performance' || !isRE) && (
            <div className="card" style={{ marginBottom: 20, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={20} color="#f59e0b" /> Team Agent Performance & Conversion Leaderboard
              </h3>
              {teamPerformance.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No team performance data available.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 8px' }}>Agent</th>
                        <th style={{ padding: '10px 8px' }}>Leads Assigned</th>
                        <th style={{ padding: '10px 8px' }}>Visits Done</th>
                        <th style={{ padding: '10px 8px' }}>Bookings</th>
                        <th style={{ padding: '10px 8px' }}>Booking Value</th>
                        <th style={{ padding: '10px 8px' }}>Win Rate %</th>
                        <th style={{ padding: '10px 8px' }}>Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPerformance.map((agent, i) => (
                        <tr key={agent.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 700 }}>👤 {agent.name}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 600 }}>{agent.leadsAssigned}</td>
                          <td style={{ padding: '12px 8px' }}>{agent.completedVisits} / {agent.siteVisits}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: '#10b981' }}>{agent.bookings}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--accent)' }}>{formatINR(agent.bookingValue)}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 700 }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: parseFloat(agent.conversionRate) > 10 ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.08)',
                              color: parseFloat(agent.conversionRate) > 10 ? '#10b981' : 'var(--accent)'
                            }}>
                              {agent.conversionRate}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: '#10b981' }}>
                            {formatINR(agent.commissionEarned)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FULL 6-STAGE CONVERSION FUNNEL                                    */}
          {/* ========================================================================= */}
          {activeTab === 'leads' && (
            <div className="card" style={{ marginBottom: 20, padding: 22 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={20} color="var(--accent)" /> Real Estate Lead-to-Booking Conversion Funnel
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  Full lifecycle track from first inquiry capture down to registered unit booking.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {funnelSteps.map((step, idx) => (
                  <div key={step.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: step.color,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 800
                        }}>
                          {idx + 1}
                        </span>
                        <strong style={{ color: 'var(--text)' }}>{step.name}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 16, color: step.color }}>{step.count}</strong>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>({step.pct}%)</span>
                      </div>
                    </div>

                    <div style={{ width: '100%', height: 10, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{
                        width: `${step.pct}%`,
                        height: '100%',
                        background: step.color,
                        borderRadius: 10,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: SITE VISITS CONVERSION                                            */}
          {/* ========================================================================= */}
          {activeTab === 'site_visits' && (
            <div className="card" style={{ marginBottom: 20, padding: 22 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} color="#0ea5e9" /> Site Visits Efficiency & Conversion Matrix
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Scheduled</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0' }}>{reAnalytics?.siteVisits?.total ?? 0}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Completed</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>{reAnalytics?.siteVisits?.completed ?? 0}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Cancelled / No-Show</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#ef4444' }}>{reAnalytics?.siteVisits?.noShow ?? 0}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Visit-to-Booking %</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>{reAnalytics?.siteVisits?.conversionRate || '0%'}</h4>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: EOI TOKEN ANALYTICS                                               */}
          {/* ========================================================================= */}
          {activeTab === 'eoi' && (
            <div className="card" style={{ marginBottom: 20, padding: 22 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={20} color="#a855f7" /> Expressions of Interest (EOI) Performance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Tokens</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#a855f7' }}>{reAnalytics?.eois?.total ?? 0}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Confirmed Tokens</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>{reAnalytics?.eois?.confirmed ?? 0}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Pending Allotment</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#f59e0b' }}>{reAnalytics?.eois?.pending ?? 0}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Expiring Soon (20d+)</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#ef4444' }}>{reAnalytics?.eois?.expiring ?? 0}</h4>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: BOOKINGS & REVENUE                                                */}
          {/* ========================================================================= */}
          {activeTab === 'bookings' && (
            <div className="card" style={{ marginBottom: 20, padding: 22 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={20} color="#10b981" /> Unit Bookings, Revenue Realization & Collections
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Agreement Value</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                    {formatINR(reAnalytics?.bookings?.totalAgreementValue || 0)}
                  </h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Collected (Paid)</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                    {formatINR(reAnalytics?.bookings?.totalCollectedAmount || 0)}
                  </h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Outstanding Balance</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#ef4444' }}>
                    {formatINR(reAnalytics?.bookings?.totalOutstandingAmount || 0)}
                  </h4>
                </div>
              </div>
            </div>
          )}

          {/* Generic Stage Breakdown Chart */}
          <div className="card" style={{ marginBottom: 16, padding: 20 }}>
            <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: 14 }}>Leads Distribution by Stage</p>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {showExportModal && (
        <ExportAnalyticsModal
          isCompanyOwner={isCompanyOwner}
          onClose={() => setShowExportModal(false)}
        />
      )}

      <BottomNav active="analytics" />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsContent />
    </Suspense>
  );
}
