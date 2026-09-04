'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, isOwner, isManager, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Award, CheckCircle2, XCircle, Search, RefreshCw, Building2,
  DollarSign, FileText, User, ArrowRight, Eye, Layers
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'team';

  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected Booking Detail Modal
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const formatINR = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/real-estate/bookings');
      setBookings(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const openBookingDetail = async (bk) => {
    setSelectedBooking(bk);
    setLoadingSchedule(true);
    try {
      const res = await api.get(`/real-estate/bookings/${bk._id}/payment-schedule`);
      setScheduleData(res.data?.data || []);
    } catch {
      setScheduleData([]);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleCancelBooking = async (bkId) => {
    if (!confirm('Are you sure you want to cancel this booking and release the inventory unit?')) return;
    try {
      await api.post(`/real-estate/bookings/${bkId}/cancel`);
      toast.success('Booking cancelled and inventory released to Available');
      setSelectedBooking(null);
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const filteredBookings = bookings.filter(item => {
    if (activeTab === 'pending') {
      if (item.status !== 'INITIATED' && item.status !== 'DRAFT') return false;
    } else if (activeTab === 'confirmed') {
      if (item.status !== 'CONFIRMED' && item.status !== 'AGREEMENT_SIGNED') return false;
    } else if (activeTab === 'cancelled') {
      if (item.status !== 'CANCELLED') return false;
    }

    if (search) {
      const q = search.toLowerCase();
      const numMatch = (item.bookingNumber || '').toLowerCase().includes(q);
      const leadMatch = (item.leadId?.name || '').toLowerCase().includes(q);
      const projMatch = (item.projectId?.name || '').toLowerCase().includes(q);
      const unitMatch = (item.inventoryId?.unitNumber || '').toLowerCase().includes(q);
      if (!numMatch && !leadMatch && !projMatch && !unitMatch) return false;
    }

    return true;
  });

  return (
    <div className="app-container">
      <BottomNav active="bookings" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5">
                <Award size={24} className="text-indigo-600 shrink-0" /> Real Estate Team Bookings
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Track unit bookings, agreement values, payment schedules, milestones and collection statuses.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchBookings}
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
              onClick={() => router.push('/bookings?tab=team')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'team' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'team' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'team' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              All Team Bookings ({bookings.length})
            </button>

            <button
              onClick={() => router.push('/bookings?tab=confirmed')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'confirmed' ? '#10b981' : 'var(--surface)',
                color: activeTab === 'confirmed' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'confirmed' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              🏆 Confirmed ({bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'AGREEMENT_SIGNED').length})
            </button>

            <button
              onClick={() => router.push('/bookings?tab=pending')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'pending' ? '#f59e0b' : 'var(--surface)',
                color: activeTab === 'pending' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'pending' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ⏳ Pending ({bookings.filter(b => b.status === 'INITIATED' || b.status === 'DRAFT').length})
            </button>

            <button
              onClick={() => router.push('/bookings?tab=cancelled')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'cancelled' ? '#ef4444' : 'var(--surface)',
                color: activeTab === 'cancelled' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'cancelled' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ❌ Cancelled ({bookings.filter(b => b.status === 'CANCELLED').length})
            </button>
          </div>

          {/* Search bar */}
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
              placeholder="Search by booking number, buyer name, project, unit..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', height: 32, fontSize: 13 }}
            />
          </div>

          {/* Bookings List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading bookings data...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <Award size={36} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Bookings Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                When EOI tokens or direct unit bookings are converted, they appear in this ledger.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredBookings.map(bk => {
                const isConfirmed = bk.status === 'CONFIRMED' || bk.status === 'AGREEMENT_SIGNED';
                const isCancelled = bk.status === 'CANCELLED';
                const outstanding = Math.max(0, (bk.agreementValue || 0) - (bk.totalPaid || 0));

                return (
                  <div
                    key={bk._id}
                    style={{
                      background: 'var(--card)',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 16
                    }}
                  >
                    <div style={{ flex: '1 1 320px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>
                          {bk.bookingNumber}
                        </span>

                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: isConfirmed ? 'rgba(16,185,129,0.12)' : isCancelled ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                          color: isConfirmed ? '#10b981' : isCancelled ? '#ef4444' : '#f59e0b'
                        }}>
                          {bk.status}
                        </span>

                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
                          Agreement: {formatINR(bk.agreementValue)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                        {bk.leadId ? (
                          <Link href={`/leads/${bk.leadId._id || bk.leadId}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                            👤 {bk.leadId.name || 'Customer'} ({bk.leadId.phone})
                          </Link>
                        ) : (
                          <span>👤 Direct Customer</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                        {bk.projectId && <span>🏢 {bk.projectId.name}</span>}
                        {bk.inventoryId && <span>🚪 Unit: {bk.inventoryId.unitNumber} ({bk.inventoryId.configuration || ''})</span>}
                        <span style={{ color: '#10b981', fontWeight: 700 }}>Paid: {formatINR(bk.totalPaid)}</span>
                        {outstanding > 0 && <span style={{ color: '#f59e0b', fontWeight: 700 }}>Outstanding: {formatINR(outstanding)}</span>}
                        {bk.createdBy && <span>👤 Agent: {bk.createdBy.name}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => openBookingDetail(bk)}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 12, fontWeight: 700, gap: 6 }}
                      >
                        <Eye size={14} /> View Milestones
                      </button>

                      {bk.leadId && (
                        <Link
                          href={`/leads/${bk.leadId._id || bk.leadId}`}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12 }}
                        >
                          Lead Profile →
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

      {/* Modal: Booking Milestones & Ledger */}
      {selectedBooking && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                  Booking Ledger: {selectedBooking.bookingNumber}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedBooking.projectId?.name} • Unit {selectedBooking.inventoryId?.unitNumber}
                </span>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="btn btn-ghost btn-sm">✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Agreement Value</span>
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: '2px 0 0' }}>{formatINR(selectedBooking.agreementValue)}</h4>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.08)', padding: '10px 12px', borderRadius: 10 }}>
                <span style={{ fontSize: 11, color: '#10b981' }}>Total Paid</span>
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: '2px 0 0', color: '#10b981' }}>{formatINR(selectedBooking.totalPaid)}</h4>
              </div>
              <div style={{ background: 'rgba(245,158,11,0.08)', padding: '10px 12px', borderRadius: 10 }}>
                <span style={{ fontSize: 11, color: '#f59e0b' }}>Balance Due</span>
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: '2px 0 0', color: '#f59e0b' }}>
                  {formatINR(Math.max(0, (selectedBooking.agreementValue || 0) - (selectedBooking.totalPaid || 0)))}
                </h4>
              </div>
            </div>

            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Payment Milestones Schedule</h4>

            {loadingSchedule ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto' }} />
              </div>
            ) : scheduleData.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No custom payment schedule attached. Standard construction linked plan applies.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {scheduleData.map(s => {
                  const isPaid = s.status === 'PAID';
                  return (
                    <div
                      key={s._id}
                      style={{
                        background: 'var(--surface)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700 }}>{s.milestoneName}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Due: {formatDisplayDateTime(s.dueDate)} • {s.percentage}% of Agreement
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, color: isPaid ? '#10b981' : 'var(--text)' }}>
                          {formatINR(s.amount)}
                        </span>
                        <div>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                            color: isPaid ? '#10b981' : '#f59e0b'
                          }}>
                            {s.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {selectedBooking.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleCancelBooking(selectedBooking._id)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#ef4444', fontSize: 12 }}
                >
                  Cancel Booking
                </button>
              )}
              <button onClick={() => setSelectedBooking(null)} className="btn btn-primary btn-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsContent />
    </Suspense>
  );
}
