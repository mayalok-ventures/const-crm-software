'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import toast from 'react-hot-toast';
import { isRealEstateTenant, isManager, isOwner, getUser } from '@/lib/auth';
import {
  BarChart2, TrendingUp, Users, Calendar, MessageSquare, Mic,
  Download, FileSpreadsheet, FileText, X, Award, DollarSign,
  Building2, MapPin, Sparkles, UserCheck, Flame
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
    totalRecordings = 0,
    todayFollowUps = 0,
    recentLeads = []
  } = data || {};

  const statusChartData = [
    { name: 'New', value: byStatus.new || 0, color: '#6366f1' },
    { name: 'Contacted', value: byStatus.contacted || 0, color: '#eab308' },
    { name: 'Follow-up', value: byStatus.follow_up || 0, color: '#f97316' },
    { name: 'Closed', value: byStatus.closed || 0, color: '#22c55e' },
  ];

  const recentChartData = recentLeads.map(d => ({ day: d._id?.slice(5) || d._id, leads: d.count }));

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Performance Analytics</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Real-time pipeline metrics, team performance & revenue tracking
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

        <div className="page-content">
          {/* Real Estate / Manager Funnel Stats if RE */}
          {isRE && reAnalytics && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 20
            }}>
              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Pipeline Value</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                  {formatINR(reAnalytics?.pipeline?.totalValue || 0)}
                </h3>
              </div>

              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Site Visit Conversion</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>
                  {reAnalytics?.siteVisits?.conversionRate || '0%'}
                </h3>
              </div>

              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>EOI Conversion Rate</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#a855f7' }}>
                  {reAnalytics?.eois?.conversionRate || '0%'}
                </h3>
              </div>

              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Bookings Revenue</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                  {formatINR(reAnalytics?.bookings?.totalAgreementValue || 0)}
                </h3>
              </div>
            </div>
          )}

          {/* Top KPI Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(79,70,229,0.1) 100%)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 16,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16,185,129,0.35)'
              }}>
                <Award size={26} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#10b981', letterSpacing: 0.5 }}>
                  Total Closed Revenue
                </p>
                <h2 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
                  {user?.localization?.currencySymbol || '₹'}{Number(totalRevenue || 0).toLocaleString()}
                </h2>
              </div>
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              className="btn btn-primary btn-sm"
              style={{ gap: 6, borderRadius: 8, background: '#10b981', borderColor: '#10b981' }}
            >
              <Download size={14} /> Export Analytics (.xlsx / .pdf)
            </button>
          </div>

          {/* Team Performance Table for Managers */}
          {teamPerformance.length > 0 && (
            <div className="card" style={{ marginBottom: 20, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px' }}>Team Agent Performance Leaderboard</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 8px', fontWeight: 600 }}>Agent</th>
                      <th style={{ padding: '10px 8px', fontWeight: 600 }}>Assigned Leads</th>
                      <th style={{ padding: '10px 8px', fontWeight: 600 }}>Visits Completed</th>
                      <th style={{ padding: '10px 8px', fontWeight: 600 }}>Bookings</th>
                      <th style={{ padding: '10px 8px', fontWeight: 600 }}>Booking Value</th>
                      <th style={{ padding: '10px 8px', fontWeight: 600 }}>Conversion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPerformance.map(agent => (
                      <tr key={agent.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 700 }}>👤 {agent.name}</td>
                        <td style={{ padding: '12px 8px' }}>{agent.leadsAssigned}</td>
                        <td style={{ padding: '12px 8px' }}>{agent.completedVisits} / {agent.siteVisits}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700, color: '#10b981' }}>{agent.bookings}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--accent)' }}>{formatINR(agent.bookingValue)}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700 }}>{agent.conversionRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top 4 Stat Grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10, marginBottom:20 }}>
            <div className="stat-card">
              <div className="stat-value">{totalLeads}</div>
              <div className="stat-label">Total Opportunities</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color:'var(--green)' }}>{conversionRate}%</div>
              <div className="stat-label">Win Conversion Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color:'#f97316' }}>{todayFollowUps}</div>
              <div className="stat-label">Today's Actions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color:'#eab308' }}>{totalTemplates}</div>
              <div className="stat-label">Templates</div>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="card" style={{ marginBottom:16 }}>
            <p style={{ margin:'0 0 16px', fontWeight:600, fontSize:14 }}>Leads by Pipeline Stage</p>
            <div style={{ height:160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                  <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(99,102,241,0.05)' }} />
                  <Bar dataKey="value" radius={[6,6,0,0]}>
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
