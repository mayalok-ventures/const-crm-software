'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import toast from 'react-hot-toast';
import { isManager, isOwner, getUser, hasPermission } from '@/lib/auth';
import {
  BarChart2, TrendingUp, Users, Calendar, MessageSquare, Mic,
  Download, FileSpreadsheet, FileText, X, Award, DollarSign,
  Building2, MapPin, Sparkles, UserCheck, Flame, Layers,
  ChevronRight, ArrowDown, CheckCircle2, AlertTriangle, ShieldCheck, GraduationCap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{payload[0].value} candidates</p>
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
      link.setAttribute('download', `admission_analytics_report_${new Date().toISOString().slice(0, 10)}.${format}`);
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
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Export Admission Analytics</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {isCompanyOwner ? 'Agency KPIs, Counsellor Leaderboard & Enrolment Revenue' : 'Pipeline Breakdown, Stage Conversion & Admission Fees'}
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
                  textAlign: 'center',
                }}
              >
                <FileSpreadsheet size={24} color="#16a34a" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Excel (.xlsx)</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Full metrics spreadsheet</span>
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
                  textAlign: 'center',
                }}
              >
                <FileText size={24} color="#dc2626" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>PDF Document</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Formatted summary memo</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={downloading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 14 }}
          >
            {downloading ? 'Exporting Report...' : `Download ${format.toUpperCase()} Report`}
          </button>
        </form>
      </div>
    </div>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab') || 'leads';

  const [activeTab, setActiveTab] = useState(rawTab);
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  const [data, setData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const updateAuth = () => {
      const u = getUser();
      if (u) setUser(u);
    };
    updateAuth();
    window.addEventListener('user-updated', updateAuth);

    Promise.all([
      api.get('/analytics').catch(() => ({ data: null })),
      api.get('/leads?limit=300').catch(() => ({ data: { leads: [] } })),
    ]).then(([genRes, leadsRes]) => {
      setData(genRes.data || null);
      setLeads(leadsRes.data?.leads || []);
    }).finally(() => setLoading(false));

    return () => window.removeEventListener('user-updated', updateAuth);
  }, []);

  const isCompanyOwner = isOwner(user);

  const formatINR = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  if (loading) return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="spinner" />
    </div>
  );

  if (user && !hasPermission(user, 'reports.view')) {
    return (
      <div className="app-shell pb-mobile-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ textAlign: 'center', padding: '32px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, maxWidth: 400 }}>
          <ShieldCheck size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>Access Restricted</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>You do not have permission to view organization analytics reports.</p>
          <button onClick={() => router.push('/leads')} className="btn btn-primary btn-sm" style={{ margin: '0 auto' }}>
            Go to Leads
          </button>
        </div>
      </div>
    );
  }

  const {
    totalLeads = leads.length,
    byStatus = {},
    conversionRate = 0,
    totalRevenue = 0,
  } = data || {};

  // Calculations for Admission Funnel
  const totalPipelineBudget = leads.reduce((sum, l) => sum + (Number(l.budget) || Number(l.admissionFinalFee) || 0), 0);
  const teleCounselledLeads = leads.filter(l => l.status && l.status !== 'new' && l.status !== 'new_lead');
  const shortlistedLeads = leads.filter(l => (l.shortlistedColleges && l.shortlistedColleges.length > 0) || l.status === 'shortlisted');
  const campusVisitLeads = leads.filter(l => l.campusVisitDate || l.status === 'site_visit_scheduled' || l.status === 'campus_visit');
  const tokenPaidLeads = leads.filter(l => (Number(l.tokenAdvancePaid) > 0) || l.status === 'negotiation' || l.status === 'payment_done');
  const confirmedAdmissions = leads.filter(l => l.status === 'converted' || l.status === 'closed' || (Number(l.admissionFinalFee) > 0));

  const totalTokenSum = tokenPaidLeads.reduce((sum, l) => sum + (Number(l.tokenAdvancePaid) || 0), 0);
  const totalAdmissionFees = confirmedAdmissions.reduce((sum, l) => sum + (Number(l.admissionFinalFee) || Number(l.closedDealAmount) || Number(l.budget) || 0), 0);

  const totalLeadsCount = totalLeads || leads.length;

  const funnelSteps = [
    { id: 'inquiries', name: 'Inquiries Captured', count: totalLeadsCount, color: '#6366f1', pct: totalLeadsCount > 0 ? 100 : 0 },
    { id: 'counselled', name: 'Tele-Counselled', count: teleCounselledLeads.length, color: '#0ea5e9', pct: totalLeadsCount > 0 ? Math.round((teleCounselledLeads.length / totalLeadsCount) * 100) : 0 },
    { id: 'shortlisted', name: 'Colleges Shortlisted', count: shortlistedLeads.length, color: '#8b5cf6', pct: totalLeadsCount > 0 ? Math.round((shortlistedLeads.length / totalLeadsCount) * 100) : 0 },
    { id: 'visits', name: 'Campus Visits Arranged', count: campusVisitLeads.length, color: '#f59e0b', pct: totalLeadsCount > 0 ? Math.round((campusVisitLeads.length / totalLeadsCount) * 100) : 0 },
    { id: 'tokens', name: 'Seat Token Advances Paid', count: tokenPaidLeads.length, color: '#ec4899', pct: totalLeadsCount > 0 ? Math.round((tokenPaidLeads.length / totalLeadsCount) * 100) : 0 },
    { id: 'confirmed', name: 'Admissions Confirmed', count: confirmedAdmissions.length, color: '#10b981', pct: totalLeadsCount > 0 ? Math.round((confirmedAdmissions.length / totalLeadsCount) * 100) : 0 },
  ];

  const statusChartData = [
    { name: 'Inquiry', value: leads.filter(l => l.status === 'new_lead' || l.status === 'new').length || byStatus.new || 0, color: '#6366f1' },
    { name: 'Counselled', value: leads.filter(l => l.status === 'contacted').length || byStatus.contacted || 0, color: '#0ea5e9' },
    { name: 'Shortlisted', value: shortlistedLeads.length, color: '#8b5cf6' },
    { name: 'Campus Visit', value: campusVisitLeads.length, color: '#f59e0b' },
    { name: 'Token Paid', value: tokenPaidLeads.length, color: '#ec4899' },
    { name: 'Enrolled', value: confirmedAdmissions.length || byStatus.closed || 0, color: '#10b981' },
  ];

  return (
    <div className="app-shell pb-mobile-nav">
      <div className="page-container max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={26} color="var(--accent)" /> Admission Counselling & Enrolment Analytics
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Real-time student inquiry pipeline metrics, admission conversion funnel, campus visits tracking, and fee realization.
            </p>
          </div>
          {hasPermission(user, 'reports.export') && (
            <button
              onClick={() => setShowExportModal(true)}
              className="btn btn-secondary btn-sm w-full sm:w-auto justify-center"
              style={{ gap: 6, borderRadius: 10, fontSize: 12, color: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              <Download size={14} /> Export Report
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="no-scrollbar" style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {[
            { id: 'leads', label: '🎯 Admission Funnel' },
            { id: 'site_visits', label: '🏛️ Campus Visits Tracking' },
            { id: 'eoi', label: '💳 Quota & Seat Tokens' },
            { id: 'bookings', label: '🎓 Confirmed Admissions & Fees' },
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

        <div className="page-content">
          {/* Top 4 KPI Metrics Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 dashboard-kpi-grid">
            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Admission Pipeline Potential</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                {formatINR(totalPipelineBudget)}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                👥 {totalLeadsCount} Total Candidates
              </span>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Campus Visits Arranged</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#f59e0b' }}>
                {campusVisitLeads.length}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                🏛️ Direct college site inspections
              </span>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Seat Advance Tokens</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#ec4899' }}>
                {formatINR(totalTokenSum)}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                💳 {tokenPaidLeads.length} Candidates Deposited
              </span>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Confirmed Enrolments</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                {confirmedAdmissions.length}
              </h3>
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, display: 'block', marginTop: 4 }}>
                🎓 {formatINR(totalAdmissionFees)} Realized
              </span>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* TAB 2: ADMISSION CONVERSION FUNNEL                                       */}
          {/* ========================================================================= */}
          {activeTab === 'leads' && (
            <div className="card" style={{ marginBottom: 20, padding: 22 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={20} color="var(--accent)" /> Candidate-to-Enrolment Admission Funnel
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  Full lifecycle track from candidate discovery, tele-counselling, shortlisting, campus visit to final college admission.
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
          {/* TAB 3: CAMPUS VISITS TRACKING                                            */}
          {/* ========================================================================= */}
          {activeTab === 'site_visits' && (
            <div className="card" style={{ marginBottom: 20, padding: 22 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} color="#0ea5e9" /> Campus Visits Inspection & Conversion Matrix
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 14, marginBottom: 20 }}>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Campus Visits</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0' }}>{campusVisitLeads.length}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Admissions Converted from Visits</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                    {campusVisitLeads.filter(l => l.status === 'converted' || l.status === 'closed').length}
                  </h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Visit-to-Admission Rate</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>
                    {campusVisitLeads.length > 0 ? `${Math.round((campusVisitLeads.filter(l => l.status === 'converted' || l.status === 'closed').length / campusVisitLeads.length) * 100)}%` : '0%'}
                  </h4>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: QUOTA & SEAT TOKENS                                                */}
          {/* ========================================================================= */}
          {activeTab === 'eoi' && (
            <div className="card" style={{ marginBottom: 20, padding: 22 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={20} color="#a855f7" /> Quota Reservations & Seat Token Advances
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 14 }}>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Token Candidates</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#a855f7' }}>{tokenPaidLeads.length}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Advance Capital</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>{formatINR(totalTokenSum)}</h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Average Seat Token Amount</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#f59e0b' }}>
                    {formatINR(tokenPaidLeads.length > 0 ? Math.round(totalTokenSum / tokenPaidLeads.length) : 0)}
                  </h4>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: CONFIRMED ADMISSIONS & TUITION FEES                                */}
          {/* ========================================================================= */}
          {activeTab === 'bookings' && (
            <div className="card" style={{ marginBottom: 20, padding: 22 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <GraduationCap size={20} color="#10b981" /> Enrolments & College Fee Realization
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 14 }}>
                <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Confirmed Admissions</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                    {confirmedAdmissions.length} Students Enrolled
                  </h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Final Admission Fees</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                    {formatINR(totalAdmissionFees)}
                  </h4>
                </div>
                <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Token Advances Deposited</span>
                  <h4 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>
                    {formatINR(totalTokenSum)}
                  </h4>
                </div>
              </div>
            </div>
          )}

          {/* Candidate Stage Distribution Chart */}
          <div className="card" style={{ marginBottom: 16, padding: 20 }}>
            <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: 14 }}>Student Distribution Across Admission Counselling Lifecycle</p>
            <div style={{ height: 180 }}>
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

      {showExportModal && hasPermission(user, 'reports.export') && (
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
