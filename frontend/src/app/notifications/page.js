'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Bell, Check, RefreshCw, Clock, ExternalLink, Smartphone,
  CheckCircle2, XCircle, Send, MessageCircle, AlertTriangle, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsOptions } from '@/lib/queries';
import {
  isPushSupported,
  getPushPermissionState,
  checkIsPushSubscribed,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from '@/lib/pushClient';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery(notificationsOptions());

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const loading = isLoading && notifications.length === 0;

  // Filter state
  const [filterType, setFilterType] = useState('all'); // 'all' | 'reminders' | 'communications' | 'system'

  // Push Subscription State
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState('default');
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (supported) {
      setPermissionState(getPushPermissionState());
      checkIsPushSubscribed().then(setPushSubscribed);
    }
  }, []);

  const handleTogglePush = async () => {
    try {
      setPushLoading(true);
      if (pushSubscribed) {
        await unsubscribeFromWebPush();
        setPushSubscribed(false);
        toast.success('Device push notifications disabled');
      } else {
        await subscribeToWebPush();
        setPushSubscribed(true);
        setPermissionState('granted');
        toast.success('✅ Device push notifications enabled for candidate follow-up alarms!');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update push notification subscription');
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    try {
      setPushLoading(true);
      const res = await api.post('/notifications/push/test');
      toast.success(res.data.message || 'Test push sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Test push failed');
    } finally {
      setPushLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      queryClient.setQueryData(['notifications', 'list'], (prev) => ({
        notifications: (prev?.notifications || []).map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
      queryClient.setQueryData(['notifications', 'unread-count'], 0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to update notifications');
    }
  };

  const markOneRead = async (id) => {
    queryClient.setQueryData(['notifications', 'list'], (prev) => ({
      notifications: (prev?.notifications || []).map((n) =>
        n._id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, (prev?.unreadCount || 1) - 1),
    }));
    queryClient.setQueryData(['notifications', 'unread-count'], (prev) => Math.max(0, (prev || 1) - 1));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.error('Failed to mark notification as read');
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'reminders') return n.type === 'follow_up' || n.type === 'follow_up_overdue';
    if (filterType === 'communications') return n.type === 'wa_reply' || n.type === 'whatsapp_disconnect' || n.type === 'whatsapp_reconnect';
    if (filterType === 'system') return n.type !== 'follow_up' && n.type !== 'follow_up_overdue' && n.type !== 'wa_reply';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-8">
      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 md:px-8 py-4 shadow-2xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-2xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Notification Center</h1>
              <p className="text-xs text-slate-500">
                Candidate follow-up alarms, WhatsApp updates, and system alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs flex items-center gap-1.5 transition"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read ({unreadCount})
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-6">
        {/* ── Web Push Device Alarm Banner ────────────────────────── */}
        {pushSupported && (
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                pushSubscribed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
              }`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Device Push Alarms &amp; Follow-Up Reminders
                  {pushSubscribed ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Enabled
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Not Configured
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receive high-priority device notifications even when this browser tab is closed.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pushSubscribed && (
                <button
                  onClick={handleTestPush}
                  disabled={pushLoading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 transition"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                  Test Push
                </button>
              )}

              <button
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white shadow-2xs transition ${
                  pushSubscribed
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {pushLoading ? 'Processing...' : pushSubscribed ? 'Disable Push' : 'Enable Device Push Alarms'}
              </button>
            </div>
          </div>
        )}

        {/* ── Category Filter Tabs ─────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-200 pb-2">
          {[
            { id: 'all', label: 'All Notifications', count: notifications.length },
            { id: 'reminders', label: 'Follow-Up Alarms', count: notifications.filter((n) => n.type === 'follow_up' || n.type === 'follow_up_overdue').length },
            { id: 'communications', label: 'WhatsApp & Email', count: notifications.filter((n) => n.type === 'wa_reply' || n.type?.startsWith('whatsapp_')).length },
            { id: 'system', label: 'System Alerts', count: notifications.filter((n) => !n.type?.startsWith('follow_up') && !n.type?.startsWith('wa_') && !n.type?.startsWith('whatsapp_')).length },
          ].map((tab) => {
            const active = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Notification List ─────────────────────────────────── */}
        {loading ? (
          <div className="text-center py-16">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Checking notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Notifications</h3>
            <p className="text-xs text-slate-500 mt-1">
              You are completely caught up in this category!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((n) => {
              const leadResolved = typeof n.leadId === 'object' ? n.leadId : null;
              const leadId = leadResolved?._id || (typeof n.leadId === 'string' ? n.leadId : null);

              const isFollowUp = n.type === 'follow_up' || n.type === 'follow_up_overdue';
              const isOverdue = n.type === 'follow_up_overdue';
              const isWAReply = n.type === 'wa_reply';
              const isWADisconnect = n.type === 'whatsapp_disconnect';

              return (
                <div
                  key={n._id}
                  className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !n.isRead
                      ? 'bg-indigo-50/40 border-indigo-200 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isOverdue
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : isFollowUp
                        ? 'bg-amber-50 text-amber-600 border border-amber-200'
                        : isWAReply
                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                        : isWADisconnect
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isOverdue || isWADisconnect ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isWAReply ? (
                        <MessageCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900">{n.title || 'Notification'}</h4>
                        {!n.isRead && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white">
                            NEW
                          </span>
                        )}
                        {n.priority === 'urgent' && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                            URGENT
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                        <span>🕒 {formatDisplayDateTime(n.createdAt)}</span>
                        {leadResolved && (
                          <span className="font-semibold text-slate-600">
                            👤 {leadResolved.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 sm:pt-0 justify-end">
                    {!n.isRead && (
                      <button
                        onClick={() => markOneRead(n._id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg text-indigo-600 hover:bg-indigo-50 border border-indigo-100 flex items-center gap-1 transition"
                      >
                        <Check className="w-3 h-3" /> Mark read
                      </button>
                    )}

                    {leadId && (
                      <Link
                        href={`/leads/${leadId}`}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Lead
                      </Link>
                    )}

                    {(isWAReply || isWADisconnect) && (
                      <Link
                        href="/whatsapp"
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs flex items-center gap-1.5 transition"
                      >
                        <MessageCircle className="w-3 h-3" />
                        Open WhatsApp
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
