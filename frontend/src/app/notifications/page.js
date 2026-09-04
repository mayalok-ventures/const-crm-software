'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Bell, Check, Phone, ArrowRight, CheckCircle2, XCircle, RefreshCw, Sparkles, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import BottomNav from '@/components/BottomNav';
import { formatDisplayDateTime } from '@/lib/dateUtils';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'transfers' | 'reminders'
  const [processingId, setProcessingId] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to update notifications');
    }
  };

  const handleAcceptTransfer = async (transferRequestId, notificationId) => {
    if (!transferRequestId) return;
    const reqId = typeof transferRequestId === 'object' ? transferRequestId._id : transferRequestId;
    setProcessingId(reqId);
    try {
      await api.post(`/agency/transfer-requests/${reqId}/accept`);
      toast.success('Lead assignment accepted! 🎉 Added to your active pipeline.');
      await fetchNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept lead assignment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTransfer = async (transferRequestId, notificationId) => {
    if (!transferRequestId) return;
    const reqId = typeof transferRequestId === 'object' ? transferRequestId._id : transferRequestId;
    setProcessingId(reqId);
    try {
      await api.post(`/agency/transfer-requests/${reqId}/reject`);
      toast.success('Lead assignment declined and returned to pool.');
      await fetchNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject lead assignment');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'transfers') return n.type === 'transfer_request' || n.type === 'transfer_accepted' || n.type === 'transfer_rejected';
    if (filterType === 'reminders') return n.type === 'follow_up' || n.type === 'wa_reply';
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
                <Bell size={26} color="var(--accent)" /> Notifications & Assignment Center
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Review assigned prospect transfers, follow-up reminders, and system alerts
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={fetchNotifications}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 12.5 }}
              >
                <RefreshCw size={14} /> Refresh
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
              { id: 'transfers', label: 'Lead Assignments & Transfers', count: notifications.filter(n => n.type === 'transfer_request' || n.type === 'transfer_accepted' || n.type === 'transfer_rejected').length },
              { id: 'reminders', label: 'Follow-up Reminders', count: notifications.filter(n => n.type === 'follow_up' || n.type === 'wa_reply').length },
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
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 12,
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

          {/* Notifications Listing */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Bell size={28} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Notifications</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                You have no pending lead assignments or reminders at the moment.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredNotifications.map(n => {
                const isTransfer = n.type === 'transfer_request';
                const transferReq = typeof n.transferRequestId === 'object' ? n.transferRequestId : null;
                const transferStatus = transferReq ? transferReq.status : 'PENDING';
                const isPending = isTransfer && (!transferReq || transferStatus === 'PENDING');
                const isAccepted = isTransfer && transferStatus === 'ACCEPTED';
                const isRejected = isTransfer && transferStatus === 'REJECTED';
                const isProcessing = processingId && (processingId === n.transferRequestId || processingId === transferReq?._id);

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
                        background: isTransfer ? 'rgba(217,119,6,0.12)' : 'rgba(99,102,241,0.12)',
                        color: isTransfer ? '#d97706' : 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isTransfer ? <Sparkles size={20} /> : <Bell size={20} />}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                            {n.title || (isTransfer ? '🎯 Lead Assignment Request' : 'Alert')}
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
                          {isAccepted && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                              ✅ Accepted
                            </span>
                          )}
                          {isRejected && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                              ❌ Declined
                            </span>
                          )}
                        </div>

                        <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.45 }}>
                          {n.message}
                        </p>

                        {/* Additional Lead Context if present */}
                        {n.leadId && typeof n.leadId === 'object' && (
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
                            <span>👤 {n.leadId.name}</span>
                            {n.leadId.phone && <span>📞 {n.leadId.phone}</span>}
                            {n.leadId.project && <span>📦 {n.leadId.project}</span>}
                            {n.leadId.budget && <span>💰 ₹{Number(n.leadId.budget).toLocaleString('en-IN')}</span>}
                          </div>
                        )}

                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                          🕒 {formatDisplayDateTime(n.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {isPending && n.transferRequestId && (
                        <>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleAcceptTransfer(n.transferRequestId, n._id)}
                            className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center"
                            style={{
                              background: '#10b981',
                              borderColor: '#10b981',
                              color: '#fff',
                              gap: 6,
                              fontSize: 12.5,
                              fontWeight: 700,
                              padding: '8px 14px'
                            }}
                          >
                            <CheckCircle2 size={15} /> Accept Lead 🎯
                          </button>

                          <button
                            disabled={isProcessing}
                            onClick={() => handleRejectTransfer(n.transferRequestId, n._id)}
                            className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center"
                            style={{
                              color: '#ef4444',
                              borderColor: 'rgba(239,68,68,0.3)',
                              gap: 6,
                              fontSize: 12.5,
                              padding: '8px 14px'
                            }}
                          >
                            <XCircle size={15} /> Reject
                          </button>
                        </>
                      )}

                      {n.leadId && (
                        <Link
                          href={`/leads/${typeof n.leadId === 'object' ? n.leadId._id : n.leadId}`}
                          className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center"
                          style={{ gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}
                        >
                          View Lead <ArrowRight size={14} />
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
