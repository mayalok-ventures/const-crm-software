'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Send, Users, ShieldAlert, History, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function SuperAdminBroadcastModule() {
  const [targetAudience, setTargetAudience] = useState('ALL_ORGS');
  const [priority, setPriority] = useState('NORMAL');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [audienceCount, setAudienceCount] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch Audience Count dynamically
  useEffect(() => {
    let isSubscribed = true;
    (async () => {
      try {
        const res = await api.get(`/super-admin/broadcasts/audience-count?targetAudience=${targetAudience}`);
        if (isSubscribed && res.data?.success) {
          setAudienceCount(res.data.count);
        }
      } catch {
        if (isSubscribed) setAudienceCount(null);
      }
    })();
    return () => { isSubscribed = false; };
  }, [targetAudience]);

  // Fetch Broadcast History
  useEffect(() => {
    let isSubscribed = true;
    (async () => {
      try {
        const res = await api.get('/super-admin/broadcasts');
        if (isSubscribed && res.data?.success) {
          setBroadcasts(res.data.broadcasts || []);
        }
      } catch (err) {
        console.warn('Failed to load broadcasts:', err);
      } finally {
        if (isSubscribed) setLoadingHistory(false);
      }
    })();
    return () => { isSubscribed = false; };
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Broadcast title is required');
    if (!message.trim()) return toast.error('Broadcast message content is required');

    setSending(true);
    try {
      const res = await api.post('/super-admin/broadcast', {
        title: title.trim(),
        message: message.trim(),
        targetAudience,
        priority,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Super Admin platform broadcast dispatched successfully! 🚀');
        setTitle('');
        setMessage('');
        fetchHistory();
      } else {
        toast.error(res.data?.message || 'Failed to dispatch broadcast');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. DISPATCH BROADCAST FORM */}
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Super Admin Platform Broadcast</h3>
              <p className="text-xs text-slate-400 mt-0.5">Send authoritative system announcements across tenant organizations</p>
            </div>
          </div>
          {audienceCount !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-amber-400">
              <Users className="w-3.5 h-3.5" />
              <span>{audienceCount} Target Recipient{audienceCount === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Target Audience Scope</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="ALL_ORGS">All Tenant Organisations</option>
                <option value="PAYING_TENANTS">Paying License Holders Only</option>
                <option value="TRIAL_TENANTS">Trial Accounts Only</option>
                <option value="ALL_USERS">All Platform Users (Admins, Managers & Counselors)</option>
                <option value="INTERNAL_MANAGERS">Managers Only</option>
                <option value="INTERNAL_AGENTS">Counselors & Agents Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Broadcast Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="NORMAL">Normal (Informational Update)</option>
                <option value="HIGH">High (Important Notice)</option>
                <option value="URGENT">Urgent (Critical System Maintenance)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Notification Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled System Maintenance / New Feature Release"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Broadcast Message Content</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Enter detailed notice message for tenant administrators and users..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm shadow-amber-500/20 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Dispatching Broadcast...' : 'Dispatch Platform Broadcast'}</span>
          </button>
        </form>
      </div>

      {/* 2. BROADCAST DISPATCH HISTORY */}
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Broadcast Dispatch History</h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{broadcasts.length} Sent Announcement{broadcasts.length === 1 ? '' : 's'}</span>
        </div>

        {loadingHistory ? (
          <div className="p-8 text-center text-xs text-slate-400 font-mono">Loading dispatch log...</div>
        ) : broadcasts.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800/80">
            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-400">No previous platform broadcasts dispatched</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Dispatched broadcasts and recipient metrics will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b) => (
              <div
                key={b._id}
                className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{b.title}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase font-mono ${
                      b.priority === 'URGENT'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : b.priority === 'HIGH'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                    }`}>
                      {b.priority || 'NORMAL'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>{b.recipientCount || 0} Recipients</span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(b.createdAt || b.sentAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{b.message}</p>
                <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/60 flex items-center justify-between">
                  <span>Audience: {b.targetAudience}</span>
                  <span>Sent by: {b.sentBy?.name || 'Super Admin'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
