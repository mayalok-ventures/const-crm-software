'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Bell, Check, Phone, ArrowRight, RefreshCw, Clock, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import BottomNav from '@/components/BottomNav';
import { formatDisplayDateTime } from '@/lib/dateUtils';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsOptions } from '@/lib/queries';

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery(notificationsOptions());

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const loading = isLoading && notifications.length === 0;
  const [filterType, setFilterType] = useState('all'); // 'all' | 'reminders' | 'system'

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      queryClient.setQueryData(['notifications', 'list'], prev => ({
        notifications: (prev?.notifications || []).map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
      queryClient.setQueryData(['notifications', 'unread-count'], 0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to update notifications');
    }
  };

  const markOneRead = async (id) => {
    queryClient.setQueryData(['notifications', 'list'], prev => ({
      notifications: (prev?.notifications || []).map(n => (n._id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, (prev?.unreadCount || 1) - 1),
    }));
    queryClient.setQueryData(['notifications', 'unread-count'], prev => Math.max(0, (prev || 1) - 1));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.error('Failed to mark notification as read');
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'reminders') return n.type === 'follow_up' || n.type === 'wa_reply';
    if (filterType === 'system') return n.type !== 'follow_up' && n.type !== 'wa_reply';
    return true;
  });

  return (
    <div className="app-container">
      <BottomNav active="notifications" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bell size={26} color="var(--accent)" /> Notifications & Alerts Center
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Follow-up reminders, new lead alerts, and system notices for your consultancy
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => refetch()}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 12.5 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="btn btn-ghost btn-sm"
                  style={{ gap: 6, fontSize: 12.5, color: 'var(--accent)' }}
                >
                  <Check size={14} /> Mark all read ({unreadCount})
                </button>
              )}
            </div>
          </div>

          {/* Filter Chips */}
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
            {[
              { id: 'all', label: 'All Notifications', count: notifications.length },
              { id: 'reminders', label: 'Follow-up Reminders', count: notifications.filter(n => n.type === 'follow_up' || n.type === 'wa_reply').length },
              { id: 'system', label: 'Lead & System Alerts', count: notifications.filter(n => n.type !== 'follow_up' && n.type !== 'wa_reply').length },
            ].map(tab => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? 'var(--accent)' : 'var(--surface)',
                    color: isActive ? '#fff' : 'var(--text)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                      color: isActive ? '#fff' : 'var(--text-muted)'
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notifications List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Checking notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Bell size={28} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Notifications</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                You have no pending reminders or notifications in this category.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredNotifications.map(n => {
                const leadResolved = typeof n.leadId === 'object' ? n.leadId : null;
                const leadId = leadResolved?._id || (typeof n.leadId === 'string' ? n.leadId : null);

                return (
                  <div
                    key={n._id}
                    style={{
                      background: n.isRead ? 'var(--card)' : 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0.02) 100%)',
                      borderRadius: 14,
                      border: `1px solid ${!n.isRead ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 14,
                      boxShadow: !n.isRead ? '0 2px 10px rgba(99,102,241,0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 340px' }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'rgba(99,102,241,0.12)',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Bell size={20} />
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                            {n.title || 'Alert'}
                          </h4>
                          {!n.isRead && (
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 10,
                              background: 'var(--accent)',
                              color: '#fff'
                            }}>
                              NEW
                            </span>
                          )}
                        </div>

                        <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.45 }}>
                          {n.message}
                        </p>

                        {/* Additional Candidate Context if present */}
                        {leadResolved && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            flexWrap: 'wrap',
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            background: 'var(--surface)',
                            padding: '6px 12px',
                            borderRadius: 8,
                            width: 'fit-content',
                            marginTop: 6
                          }}>
                            <span>👤 {leadResolved.name}</span>
                            {leadResolved.phone && <span>📞 {leadResolved.phone}</span>}
                            {leadResolved.customData?.courseInterested && <span>🎓 {leadResolved.customData.courseInterested}</span>}
                          </div>
                        )}

                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                          🕒 {formatDisplayDateTime(n.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => markOneRead(n._id)}
                          className="btn btn-ghost btn-sm"
                          style={{ gap: 5, fontSize: 12, color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}
                          title="Mark as read"
                        >
                          <Check size={13} /> Mark read
                        </button>
                      )}
                      {leadId && (
                        <Link
                          href={`/leads/${leadId}`}
                          className="btn btn-secondary btn-sm"
                          style={{ gap: 6, fontSize: 12 }}
                        >
                          <ExternalLink size={13} /> View Candidate
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
