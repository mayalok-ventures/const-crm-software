'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import toast from 'react-hot-toast';
import {
  BarChart2, TrendingUp, Users, Calendar, MessageSquare, Mic,
  Download, FileSpreadsheet, FileText, X, Award, DollarSign
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
                <FileSpreadsheet size={22} color="#10b981" />
                <span style={{ fontSize: 13, fontWeight: format === 'xlsx' ? 700 : 500 }}>Excel (.xlsx)</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Multi-sheet dataset</span>
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
                <FileText size={22} color="#ef4444" />
                <span style={{ fontSize: 13, fontWeight: format === 'pdf' ? 700 : 500 }}>PDF Document</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Executive report</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-full" disabled={downloading}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-full" disabled={downloading} style={{ background: '#16a34a', borderColor: '#16a34a' }}>
              {downloading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Download Analytics 📊'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) setUser(JSON.parse(u));
    } catch {}

    api.get('/analytics')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isCompanyOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';

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
              Real-time pipeline metrics & revenue tracking
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

          {/* Conversion progress */}
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <p style={{ margin:0, fontWeight:600, fontSize:14 }}>Pipeline Conversion Progress</p>
              <span style={{ fontSize:20, fontWeight:700, color:'var(--green)' }}>{conversionRate}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width:`${conversionRate}%` }} />
            </div>
            <p style={{ margin:'8px 0 0', fontSize:12, color:'var(--text-muted)' }}>
              {byStatus.closed || 0} closed deals out of {totalLeads} total opportunities
            </p>
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
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:8 }}>
              {statusChartData.map(s => (
                <div key={s.name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:s.color }} />
                  <span style={{ color:'var(--text-muted)' }}>{s.name}: <strong style={{ color:'var(--text)' }}>{s.value}</strong></span>
                </div>
              ))}
            </div>
          </div>

          {/* Last 7 days */}
          {recentChartData.length > 0 && (
            <div className="card" style={{ marginBottom:16 }}>
              <p style={{ margin:'0 0 16px', fontWeight:600, fontSize:14 }}>Leads Added (Last 7 Days)</p>
              <div style={{ height:130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recentChartData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                    <XAxis dataKey="day" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(99,102,241,0.05)' }} />
                    <Bar dataKey="leads" fill="var(--accent)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Quick stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'rgba(34,197,94,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <MessageSquare size={18} color="var(--green)" />
              </div>
              <div>
                <p style={{ margin:0, fontSize:20, fontWeight:700 }}>{totalTemplates}</p>
                <p style={{ margin:0, fontSize:11, color:'var(--text-muted)' }}>Templates</p>
              </div>
            </div>
            <div className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'rgba(239,68,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Mic size={18} color="var(--red)" />
              </div>
              <div>
                <p style={{ margin:0, fontSize:20, fontWeight:700 }}>{totalRecordings}</p>
                <p style={{ margin:0, fontSize:11, color:'var(--text-muted)' }}>Recordings</p>
              </div>
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
