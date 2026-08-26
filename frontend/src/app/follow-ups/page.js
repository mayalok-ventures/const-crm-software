'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, Phone,
  MessageSquare, ChevronRight, Search, RefreshCw, UserCheck,
  ArrowRight, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import { ScheduleFollowUpModal, CompleteFollowUpModal, STAGE_LABELS } from '@/components/LeadModals';

export default function FollowUpsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [subTab, setSubTab] = useState('today'); // 'today' | 'upcoming' | 'overdue' | 'completed'
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
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

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both today's follow-ups and leads with scheduled dates
      const [todayRes, allLeadsRes] = await Promise.all([
        api.get('/leads/follow-ups/today').catch(() => ({ data: [] })),
        api.get('/leads?limit=100').catch(() => ({ data: { leads: [] } }))
      ]);

      const leadsList = allLeadsRes.data?.leads || [];
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

      const structured = leadsList
        .filter(l => l.followUpDate)
        .map(l => {
          const time = new Date(l.followUpDate).getTime();
          let bucket = 'upcoming';
          if (l.followUpNotified) {
            bucket = 'completed';
          } else if (time < startOfToday) {
            bucket = 'overdue';
          } else if (time >= startOfToday && time <= endOfToday) {
            bucket = 'today';
          } else {
            bucket = 'upcoming';
          }
          return { ...l, bucket, time };
        });

      setFollowUps(structured);
    } catch {
      toast.error('Failed to load follow-ups schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const filteredItems = followUps
    .filter(item => {
      if (subTab === 'today') return item.bucket === 'today';
      if (subTab === 'upcoming') return item.bucket === 'upcoming';
      if (subTab === 'overdue') return item.bucket === 'overdue';
      if (subTab === 'completed') return item.bucket === 'completed';
      return true;
    })
    .filter(item => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.phone && item.phone.includes(q)) ||
        (item.project && item.project.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => (subTab === 'completed' ? b.time - a.time : a.time - b.time));

  const counts = {
    today: followUps.filter(f => f.bucket === 'today').length,
    upcoming: followUps.filter(f => f.bucket === 'upcoming').length,
    overdue: followUps.filter(f => f.bucket === 'overdue').length,
    completed: followUps.filter(f => f.bucket === 'completed').length,
  };

  return (
    <div className="app-container">
      <BottomNav active="follow_ups" />

      <main className="main-content">
        <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 60 }}>
          
          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Calendar size={26} color="var(--accent)" /> Follow-ups Workspace
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Track daily prospect call commitments, schedule reminders, and record interaction outcomes
              </p>
            </div>

            <button
              onClick={fetchFollowUps}
              className="btn btn-ghost btn-sm"
              style={{ gap: 6, fontSize: 13 }}
            >
              <RefreshCw size={14} /> Refresh Schedule
            </button>
          </div>

          {/* Sub-Tabs Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 12,
            marginBottom: 20,
            overflowX: 'auto'
          }}>
            {[
              { id: 'today', label: "Today's Calls", count: counts.today, color: 'var(--accent)' },
              { id: 'overdue', label: 'Overdue Pending', count: counts.overdue, color: '#ef4444' },
              { id: 'upcoming', label: 'Upcoming', count: counts.upcoming, color: '#3b82f6' },
              { id: 'completed', label: 'Completed Log', count: counts.completed, color: '#10b981' },
            ].map(tab => {
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? tab.color : 'var(--surface)',
                    color: isActive ? '#fff' : 'var(--text)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                  <span style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 20,
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                    color: isActive ? '#fff' : 'var(--text)',
                    fontWeight: 700
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div style={{ marginBottom: 16, position: 'relative', maxWidth: 400 }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              type="text"
              className="input"
              placeholder="Search follow-ups by name, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
            />
          </div>

          {/* Listing */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading follow-up queue...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <CheckCircle2 size={28} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>
                {subTab === 'today' ? "No Pending Follow-ups Today 🎉" : `No ${subTab} follow-ups in queue`}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                {subTab === 'today' ? "You have resolved all your scheduled client interactions for today!" : "All scheduled follow-ups appear here as dates approach."}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredItems.map(item => (
                <div
                  key={item._id}
                  style={{
                    background: 'var(--card)',
                    borderRadius: 14,
                    border: `1px solid ${item.bucket === 'overdue' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
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
                        href={`/leads/${item._id}`}
                        style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
                      >
                        {item.name || 'Unnamed Prospect'}
                      </Link>
                      <span className="badge badge-tag" style={{ fontSize: 11 }}>
                        {STAGE_LABELS[item.status] || item.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                      <a href={`tel:${item.phone}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                        📞 {item.phone}
                      </a>
                      {item.project && <span>📦 {item.project}</span>}
                      <span style={{
                        color: item.bucket === 'overdue' ? 'var(--red)' : 'var(--accent)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Clock size={13} /> {formatDisplayDateTime(item.followUpDate)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <a
                      href={`tel:${item.phone}`}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 10px', height: 34, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                    >
                      <Phone size={14} /> Call
                    </a>

                    <a
                      href={waLink(item.phone, `Hi ${item.name || ''}, connecting for our scheduled follow-up.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 10px', height: 34, color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                    >
                      <MessageSquare size={14} /> WhatsApp
                    </a>

                    <button
                      onClick={() => setSchedulingLead(item)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 10px', height: 34, color: 'var(--accent)' }}
                    >
                      <Calendar size={14} /> Reschedule
                    </button>

                    <button
                      onClick={() => setCompletingLead(item)}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '6px 12px', height: 34, background: '#10b981', borderColor: '#10b981', gap: 5 }}
                    >
                      <CheckCircle2 size={14} /> Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>

      {/* Modals */}
      {schedulingLead && (
        <ScheduleFollowUpModal
          lead={schedulingLead}
          onClose={() => setSchedulingLead(null)}
          onUpdated={() => fetchFollowUps()}
        />
      )}

      {completingLead && (
        <CompleteFollowUpModal
          lead={completingLead}
          onClose={() => setCompletingLead(null)}
          onCompleted={() => fetchFollowUps()}
          onPromptScheduleNext={l => setSchedulingLead(l)}
        />
      )}
    </div>
  );
}
