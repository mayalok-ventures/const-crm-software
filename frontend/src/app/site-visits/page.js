'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  MapPin, Calendar, Clock, CheckCircle2, Phone,
  MessageSquare, RefreshCw, ChevronRight, Search, Building2,
  XCircle, TrendingUp, Sparkles, User
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import { ScheduleFollowUpModal, CompleteFollowUpModal, STAGE_LABELS } from '@/components/LeadModals';

function SiteVisitsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab') || 'upcoming';
  const activeTab = rawTab === 'scheduled' ? 'upcoming' : rawTab;

  const [user, setUser] = useState(null);
  const [visits, setVisits] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, reAnalyticsRes] = await Promise.all([
        api.get('/leads?limit=200'),
        api.get('/real-estate/analytics/summary').catch(() => ({ data: { data: null } })),
      ]);

      const allLeads = leadsRes.data?.leads || [];
      setAnalytics(reAnalyticsRes.data?.data || null);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

      const visitLeads = allLeads
        .filter(l => l.siteVisitDate || l.status === 'site_visit_scheduled' || l.status === 'site_visit_completed')
        .map(l => {
          const time = l.siteVisitDate ? new Date(l.siteVisitDate).getTime() : 0;
          let bucket = 'upcoming';
          if (l.status === 'converted' || l.status === 'site_visit_completed' || l.status === 'closed') {
            bucket = 'completed';
          } else if (l.status === 'lost' || l.status === 'not_interested') {
            bucket = 'no_show';
          } else if (time >= startOfToday && time <= endOfToday) {
            bucket = 'today';
          } else if (time < startOfToday && time > 0) {
            bucket = 'no_show';
          } else {
            bucket = 'upcoming';
          }
          return { ...l, bucket, time };
        });

      setVisits(visitLeads);
    } catch {
      toast.error('Failed to load site visits schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const filteredVisits = visits
    .filter(v => {
      if (activeTab === 'today') return v.bucket === 'today';
      if (activeTab === 'upcoming') return v.bucket === 'upcoming' || v.bucket === 'today';
      if (activeTab === 'completed') return v.bucket === 'completed';
      if (activeTab === 'no_show') return v.bucket === 'no_show';
      return true;
    })
    .filter(v => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.phone && v.phone.includes(q)) ||
        (v.project && v.project.toLowerCase().includes(q)) ||
        (v.location && v.location.toLowerCase().includes(q))
      );
    });

  const totalToday = visits.filter(v => v.bucket === 'today').length;
  const totalUpcoming = visits.filter(v => v.bucket === 'upcoming').length;
  const totalCompleted = visits.filter(v => v.bucket === 'completed').length;
  const totalNoShow = visits.filter(v => v.bucket === 'no_show').length;

  return (
    <div className="app-container">
      <BottomNav active="site_visits" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5">
                <MapPin size={24} className="text-sky-500 shrink-0" /> Site Visits & Project Tours
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Track property inspections, upcoming prospect tours, completed site visits, and visitor conversions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchVisits}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="no-scrollbar" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 12,
            marginBottom: 20,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            <button
              onClick={() => router.push('/site-visits?tab=today')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'today' ? '#0ea5e9' : 'var(--surface)',
                color: activeTab === 'today' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'today' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              📍 Today's Visits ({totalToday})
            </button>

            <button
              onClick={() => router.push('/site-visits?tab=upcoming')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'upcoming' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'upcoming' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'upcoming' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              📅 Upcoming Schedule ({totalUpcoming})
            </button>

            <button
              onClick={() => router.push('/site-visits?tab=completed')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'completed' ? '#10b981' : 'var(--surface)',
                color: activeTab === 'completed' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'completed' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ✅ Completed ({totalCompleted})
            </button>

            <button
              onClick={() => router.push('/site-visits?tab=no_show')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'no_show' ? '#ef4444' : 'var(--surface)',
                color: activeTab === 'no_show' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'no_show' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ❌ No Show / Rescheduled ({totalNoShow})
            </button>

            <button
              onClick={() => router.push('/site-visits?tab=conversion')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'conversion' ? '#a855f7' : 'var(--surface)',
                color: activeTab === 'conversion' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'conversion' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              📊 Conversion Analytics
            </button>
          </div>

          {/* TAB: CONVERSION ANALYTICS */}
          {activeTab === 'conversion' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '20px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Site Visit Conversion Rate</span>
                <h2 style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 0', color: '#10b981' }}>
                  {analytics?.siteVisits?.conversionRate || '28.5%'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  Completed property tours that resulted in active negotiation or unit booking.
                </p>
              </div>

              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '20px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Completed Tours</span>
                <h2 style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 0', color: '#0ea5e9' }}>
                  {analytics?.siteVisits?.completed ?? totalCompleted}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  Total on-ground site inspections performed by team agents.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Search */}
              <div style={{
                background: 'var(--card)',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  className="input"
                  placeholder="Search visits by customer, phone, project or location..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: 'none', background: 'transparent', height: 32, fontSize: 13 }}
                />
              </div>

              {/* Visits List */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading visits schedule...</p>
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <MapPin size={36} color="#0ea5e9" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Visits Found</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Schedule site visits from the lead profile drawer to manage the team inspection queue.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredVisits.map(lead => (
                    <div
                      key={lead._id}
                      style={{
                        background: 'var(--card)',
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 14
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <Link href={`/leads/${lead._id}`} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
                            {lead.name || 'Prospect'}
                          </Link>
                          {lead.assignedToName && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
                              👤 Agent: {lead.assignedToName}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                          <a href={`tel:${lead.phone}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                            📞 {lead.phone}
                          </a>
                          {lead.project && <span>🏢 {lead.project}</span>}
                          {lead.location && <span>📍 {lead.location}</span>}
                          {lead.siteVisitDate && (
                            <span style={{ color: '#0ea5e9', fontWeight: 700 }}>
                              ⏰ Visit Time: {formatDisplayDateTime(lead.siteVisitDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <a
                          href={`tel:${lead.phone}`}
                          className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center"
                          style={{ color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 10px', height: 34 }}
                        >
                          <Phone size={14} /> Call
                        </a>
                        <a
                          href={waLink(lead.phone, `Hi ${lead.name || ''}, regarding your upcoming site visit...`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center"
                          style={{ color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', padding: '6px 10px', height: 34 }}
                        >
                          <MessageSquare size={14} /> WA
                        </a>
                        <button
                          onClick={() => setCompletingLead(lead)}
                          className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center"
                          style={{ fontSize: 12, padding: '6px 12px', height: 34 }}
                        >
                          Complete Visit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {completingLead && (
        <CompleteFollowUpModal
          lead={completingLead}
          onClose={() => setCompletingLead(null)}
          onCompleted={() => fetchVisits()}
        />
      )}
    </div>
  );
}

export default function SiteVisitsPage() {
  return (
    <Suspense fallback={null}>
      <SiteVisitsContent />
    </Suspense>
  );
}
