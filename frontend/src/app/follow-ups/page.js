'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, getUser, hasPermission, canAccessRoute } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, Phone,
  MessageSquare, ChevronRight, Search, RefreshCw, UserCheck,
  ArrowRight, ShieldAlert, Sparkles, Filter, Ban
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import { ScheduleFollowUpModal, CompleteFollowUpModal, CancelFollowUpModal, STAGE_LABELS } from '@/components/LeadModals';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { todayFollowUpsOptions, leadsListOptions } from '@/lib/queries';

function computeStructuredFollowUps(leadsList) {
  if (!Array.isArray(leadsList) || leadsList.length === 0) return [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

  return leadsList
    .filter(l => l.followUpDate || l.activeFollowUp?.scheduledAt || l.followUpStatus === 'completed' || l.followUpStatus === 'cancelled')
    .map(l => {
      const rawDate = l.followUpDate || l.activeFollowUp?.scheduledAt || l.updatedAt;
      const time = new Date(rawDate).getTime();
      let bucket = 'upcoming';
      const isDoneOrCancelled = ['completed', 'cancelled', 'none'].includes(l.followUpStatus) ||
                                ['completed', 'cancelled'].includes(l.activeFollowUp?.status);
      if (isDoneOrCancelled) {
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
}

export default function FollowUpsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [subTab, setSubTab] = useState('today'); // 'today' | 'upcoming' | 'overdue' | 'completed'

  const queryClient = useQueryClient();
  const { data: leadsRes, isLoading: isLeadsLoading, refetch: refetchLeads } = useQuery(leadsListOptions({ limit: 100 }));
  const { refetch: refetchToday } = useQuery(todayFollowUpsOptions());

  const followUps = useMemo(() => {
    const list = leadsRes?.leads || (Array.isArray(leadsRes) ? leadsRes : []);
    return computeStructuredFollowUps(list);
  }, [leadsRes]);

  const loading = isLeadsLoading && followUps.length === 0;
  const [search, setSearch] = useState('');

  // Modals
  const [schedulingLead, setSchedulingLead] = useState(null);
  const [completingLead, setCompletingLead] = useState(null);
  const [cancellingLead, setCancellingLead] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const handleRefresh = useCallback(() => {
    refetchLeads();
    refetchToday();
  }, [refetchLeads, refetchToday]);

  useEffect(() => {
    const handleContextAction = (e) => {
      const { action, payload } = e.detail || {};
      if (!payload?.id) return;
      const targetItem = followUps.find((f) => String(f._id) === String(payload.id));
      if (!targetItem) return;

      if (action === 'OPEN_LEAD') {
        router.push(`/leads/${targetItem._id}`);
      } else if (action === 'COMPLETE_FOLLOWUP') {
        setCompletingLead(targetItem);
      } else if (action === 'SCHEDULE_FOLLOWUP') {
        setSchedulingLead(targetItem);
      } else if (action === 'VIEW_LEAD_HISTORY') {
        router.push(`/leads/${targetItem._id}`);
      }
    };

    window.addEventListener('crm-context-action', handleContextAction);
    return () => window.removeEventListener('crm-context-action', handleContextAction);
  }, [followUps, router]);

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

      <main className="main-content" data-crm-canvas="true">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5">
                <Calendar size={24} className="text-indigo-600 shrink-0" /> Follow-ups Workspace
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Track daily prospect call commitments, schedule reminders, and record interaction outcomes
              </p>
            </div>

            <button
              onClick={handleRefresh}
              className="btn btn-ghost btn-sm self-start sm:self-auto"
              style={{ gap: 6, fontSize: 13 }}
            >
              <RefreshCw size={14} /> Refresh Schedule
            </button>
          </div>

          {/* Sub-Tabs Selector */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4 overflow-x-auto no-scrollbar">
            {[
              { id: 'today', label: "Today's Calls", count: counts.today, activeClass: 'bg-indigo-600 text-white border-indigo-600' },
              { id: 'overdue', label: 'Overdue Pending', count: counts.overdue, activeClass: 'bg-red-500 text-white border-red-500' },
              { id: 'upcoming', label: 'Upcoming', count: counts.upcoming, activeClass: 'bg-blue-600 text-white border-blue-600' },
              { id: 'completed', label: 'Completed Log', count: counts.completed, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
            ].map(tab => {
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition whitespace-nowrap shrink-0 ${
                    isActive
                      ? `${tab.activeClass} shadow-sm`
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="relative max-w-sm mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              className="input input-search w-full text-xs sm:text-sm pl-10 pr-9 h-10 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 transition"
              placeholder="Search follow-ups by name, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Listing */}
          {loading && followUps.length === 0 ? (
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
                  data-context-type="followup"
                  data-context-id={item._id}
                  data-context-record={JSON.stringify({
                    id: item._id,
                    name: item.name,
                    phone: item.phone,
                    status: item.status,
                  })}
                  className="cursor-default"
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
                  <div style={{ flex: '1 1 200px', minWidth: 0, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
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

                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <a
                      href={`tel:${item.phone}`}
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shrink-0"
                      title="Call"
                    >
                      <Phone size={13} /> <span>Call</span>
                    </a>

                    <a
                      href={waLink(item.phone, `Hi ${item.name || ''}, connecting for our scheduled follow-up.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition shrink-0"
                      title="WhatsApp"
                    >
                      <MessageSquare size={13} /> <span>WA</span>
                    </a>

                    <button
                      onClick={() => setSchedulingLead(item)}
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition shrink-0"
                      title="Reschedule"
                    >
                      <Calendar size={13} /> <span>Reschedule</span>
                    </button>

                    {item.bucket !== 'completed' && (
                      <button
                        onClick={() => setCancellingLead(item)}
                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition shrink-0"
                        title="Stop follow-up"
                      >
                        <Ban size={13} /> <span>Stop</span>
                      </button>
                    )}

                    <button
                      onClick={() => setCompletingLead(item)}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition shrink-0"
                      title="Mark as completed"
                    >
                      <CheckCircle2 size={13} /> <span>Complete</span>
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
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
        />
      )}

      {completingLead && (
        <CompleteFollowUpModal
          lead={completingLead}
          onClose={() => setCompletingLead(null)}
          onCompleted={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
          onPromptScheduleNext={l => setSchedulingLead(l)}
        />
      )}

      {cancellingLead && (
        <CancelFollowUpModal
          lead={cancellingLead}
          onClose={() => setCancellingLead(null)}
          onCancelled={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
        />
      )}
    </div>
  );
}
