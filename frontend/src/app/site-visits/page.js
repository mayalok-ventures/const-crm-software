'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  MapPin, Calendar, Clock, CheckCircle2, Phone,
  MessageSquare, RefreshCw, ChevronRight, Search, Building2
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import { ScheduleFollowUpModal, CompleteFollowUpModal, STAGE_LABELS } from '@/components/LeadModals';

export default function SiteVisitsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [subTab, setSubTab] = useState('scheduled'); // 'scheduled' | 'today' | 'completed'
  const [visits, setVisits] = useState([]);
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
      const res = await api.get('/leads?limit=200');
      const allLeads = res.data?.leads || [];
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

      // Leads that have siteVisitDate or status === 'site_visit_scheduled'
      const visitLeads = allLeads
        .filter(l => l.siteVisitDate || l.status === 'site_visit_scheduled')
        .map(l => {
          const time = l.siteVisitDate ? new Date(l.siteVisitDate).getTime() : 0;
          let bucket = 'scheduled';
          if (l.status === 'converted' || l.status === 'closed') {
            bucket = 'completed';
          } else if (time >= startOfToday && time <= endOfToday) {
            bucket = 'today';
          } else {
            bucket = 'scheduled';
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
      if (subTab === 'scheduled') return v.bucket === 'scheduled' || v.bucket === 'today';
      if (subTab === 'today') return v.bucket === 'today';
      if (subTab === 'completed') return v.bucket === 'completed';
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

  const totalScheduled = visits.filter(v => v.bucket === 'scheduled' || v.bucket === 'today').length;
  const totalCompleted = visits.filter(v => v.bucket === 'completed').length;

  return (
    <div className="app-container">
      <BottomNav active="site_visits" />

      <main className="main-content">
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={26} color="#0ea5e9" /> Site Visits & Property Tours
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Coordinate in-person client visits, property inspections, and record demo feedback
              </p>
            </div>

            <button
              onClick={fetchVisits}
              className="btn btn-ghost btn-sm"
              style={{ gap: 6, fontSize: 13 }}
            >
              <RefreshCw size={14} /> Refresh Schedule
            </button>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Active Scheduled Visits</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: '#0ea5e9' }}>
                {totalScheduled} Visits
              </h2>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Completed / Converted</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: '#10b981' }}>
                {totalCompleted} Completed
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
              onClick={() => setSubTab('scheduled')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: subTab === 'scheduled' ? '#0ea5e9' : 'var(--surface)',
                color: subTab === 'scheduled' ? '#fff' : 'var(--text)',
                fontWeight: subTab === 'scheduled' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <Calendar size={16} /> All Scheduled ({totalScheduled})
            </button>

            <button
              onClick={() => setSubTab('today')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: subTab === 'today' ? 'var(--accent)' : 'var(--surface)',
                color: subTab === 'today' ? '#fff' : 'var(--text)',
                fontWeight: subTab === 'today' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <Clock size={16} /> Today's Tours ({visits.filter(v => v.bucket === 'today').length})
            </button>

            <button
              onClick={() => setSubTab('completed')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: subTab === 'completed' ? '#10b981' : 'var(--surface)',
                color: subTab === 'completed' ? '#fff' : 'var(--text)',
                fontWeight: subTab === 'completed' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <CheckCircle2 size={16} /> Completed Tours ({totalCompleted})
            </button>
          </div>

          {/* Search */}
          <div style={{ marginBottom: 16, position: 'relative', maxWidth: 400 }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              type="text"
              className="input"
              placeholder="Search site visits by client, property, location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
            />
          </div>

          {/* Listing */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading site visits...</p>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <MapPin size={28} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Site Visits Scheduled</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                Schedule property visits with your prospects from the Leads workspace.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredVisits.map(visit => (
                <div
                  key={visit._id}
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
                        href={`/leads/${visit._id}`}
                        style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                      >
                        {visit.name || 'Unnamed Client'}
                      </Link>
                      <span className="badge badge-tag" style={{ fontSize: 11 }}>
                        {STAGE_LABELS[visit.status] || visit.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>📞 {visit.phone}</span>
                      {visit.project && <span>📦 Property: <strong>{visit.project}</strong></span>}
                      {visit.location && <span>📍 Location: {visit.location}</span>}
                      {visit.siteVisitDate && (
                        <span style={{ color: '#0ea5e9', fontWeight: 600 }}>
                          ⏰ Tour Time: {formatDisplayDateTime(visit.siteVisitDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <a
                      href={`tel:${visit.phone}`}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 10px', height: 34, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                    >
                      <Phone size={14} /> Call
                    </a>

                    <a
                      href={waLink(visit.phone, `Hi ${visit.name || ''}, confirming details for our property visit${visit.project ? ` at ${visit.project}` : ''}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 10px', height: 34, color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                    >
                      <MessageSquare size={14} /> WhatsApp
                    </a>

                    <button
                      onClick={() => setCompletingLead(visit)}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '6px 12px', height: 34, background: '#10b981', borderColor: '#10b981', gap: 5 }}
                    >
                      <CheckCircle2 size={14} /> Record Feedback
                    </button>

                    <Link
                      href={`/leads/${visit._id}`}
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

      {completingLead && (
        <CompleteFollowUpModal
          lead={completingLead}
          onClose={() => setCompletingLead(null)}
          onCompleted={() => fetchVisits()}
          onPromptScheduleNext={l => setSchedulingLead(l)}
        />
      )}

      {schedulingLead && (
        <ScheduleFollowUpModal
          lead={schedulingLead}
          onClose={() => setSchedulingLead(null)}
          onUpdated={() => fetchVisits()}
        />
      )}
    </div>
  );
}
