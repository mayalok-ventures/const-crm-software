'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Bell, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications').then(r => setNotifications(r.data.notifications || [])).finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleAcceptTransfer = async (id, notificationId) => {
    try {
      await api.post(`/agency/transfer-requests/${id}/accept`);
      toast.success('Lead transfer accepted successfully! 🎉');
      // Mark notification as read
      await api.put(`/notifications/read-all`); 
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept transfer');
    }
  };

  const handleRejectTransfer = async (id, notificationId) => {
    try {
      await api.post(`/agency/transfer-requests/${id}/reject`);
      toast.success('Lead transfer request rejected.');
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject transfer');
    }
  };

  return (
    <div className="app-shell">
      <div className="page-container max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => router.back()} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text)', padding:4 }}>←</button>
            <h1 className="page-title">Notifications</h1>
          </div>
          {notifications.some(n => !n.isRead) && (
            <button onClick={markAllRead} className="btn btn-ghost btn-sm">
              <Check size={14} /> Mark all read
            </button>
          )}
        </div>

        <div className="page-content">
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner" /></div>
          ) : notifications.length === 0 ? (
            <div className="empty-state">
              <Bell size={48} />
              <h3>No notifications</h3>
              <p>Follow-up reminders will appear here</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {notifications.map(n => (
                <Link key={n._id} href={`/leads/${n.leadId}`} style={{ textDecoration:'none' }}>
                  <div style={{ padding:'12px 14px', background: n.isRead ? 'var(--card)' : 'rgba(99,102,241,0.08)', border:`1px solid ${n.isRead ? 'var(--border)' : 'rgba(99,102,241,0.3)'}`, borderRadius:12 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      {!n.isRead && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', marginTop:5, flexShrink:0 }} />}
                      <div style={{ flex:1 }}>
                        <p style={{ margin:0, fontSize:14, fontWeight: n.isRead ? 400 : 600 }}>{n.message}</p>
                        {n.type === 'transfer_request' && n.transferRequestId && !n.isRead && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAcceptTransfer(n.transferRequestId, n._id);
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 10px', fontSize: 11, background: '#16a34a', borderColor: '#16a34a', color: 'white', borderRadius: 8, fontWeight: 700 }}
                            >
                              ✅ Accept
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRejectTransfer(n.transferRequestId, n._id);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 10px', fontSize: 11, color: '#ef4444', borderRadius: 8, fontWeight: 700 }}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        )}
                        <p style={{ margin:'4px 0 0', fontSize:11, color:'var(--text-muted)' }}>{format(new Date(n.createdAt), 'dd MMM, h:mm a')}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
