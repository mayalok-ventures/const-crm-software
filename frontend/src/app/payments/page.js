'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { isOwner, isManager, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  DollarSign, CheckCircle2, AlertTriangle, Clock, Search,
  RefreshCw, Building2, Calendar, FileText, Plus, Receipt
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'due';

  const [user, setUser] = useState(null);
  const [paymentsSummary, setPaymentsSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Record Payment Receipt Modal
  const [selectedBookingForPay, setSelectedBookingForPay] = useState(null);
  const [bookingSchedules, setBookingSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);

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

  const fetchPaymentsData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, bkRes] = await Promise.all([
        api.get('/real-estate/payments/summary'),
        api.get('/real-estate/bookings'),
      ]);
      setPaymentsSummary(sumRes.data?.data || null);
      setBookings(bkRes.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load payments data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentsData();
  }, [fetchPaymentsData]);

  const openRecordModal = async (bk) => {
    setSelectedBookingForPay(bk);
    try {
      const res = await api.get(`/real-estate/bookings/${bk._id}/payment-schedule`);
      const list = res.data?.data || [];
      setBookingSchedules(list);
      const pending = list.find(s => s.status !== 'PAID');
      if (pending) {
        setSelectedScheduleId(pending._id);
        const rem = Math.max(0, pending.amount - (pending.paidAmount || 0));
        setPayAmount(rem > 0 ? rem : '');
      }
    } catch {
      setBookingSchedules([]);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedScheduleId || !payAmount) {
      toast.error('Please select milestone and payment amount');
      return;
    }

    setIsRecording(true);
    try {
      await api.post(`/real-estate/bookings/schedules/${selectedScheduleId}/payments`, {
        paidAmount: Number(payAmount),
        notes: payNotes,
      });
      toast.success('Payment receipt recorded and ledger updated! 🎉');
      setSelectedBookingForPay(null);
      setPayAmount('');
      setPayNotes('');
      fetchPaymentsData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment receipt');
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="app-container">
      <BottomNav active="payments" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <DollarSign size={26} color="#10b981" /> Payment Collections & Milestones
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Track demand letters, due payment milestones, overdue collections, and record buyer receipts.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={fetchPaymentsData}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* 4 Summary Stat Boxes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Collected</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                {formatINR(paymentsSummary?.totalCollected || 0)}
              </h2>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Due in 15 Days</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                {formatINR(paymentsSummary?.dueAmount || 0)}
              </h2>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Overdue Collections</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#ef4444' }}>
                {formatINR(paymentsSummary?.overdueAmount || 0)}
              </h2>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Upcoming Milestones</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>
                {formatINR(paymentsSummary?.upcomingAmount || 0)}
              </h2>
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
              onClick={() => router.push('/payments?tab=due')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'due' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'due' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'due' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ⏳ Due & Upcoming Milestones
            </button>

            <button
              onClick={() => router.push('/payments?tab=overdue')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'overdue' ? '#ef4444' : 'var(--surface)',
                color: activeTab === 'overdue' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'overdue' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ⚠️ Overdue Demands
            </button>

            <button
              onClick={() => router.push('/payments?tab=collections')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'collections' ? '#10b981' : 'var(--surface)',
                color: activeTab === 'collections' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'collections' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ✅ Verified Collections
            </button>
          </div>

          {/* Bookings Collection Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading payment schedules...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <DollarSign size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Active Payment Demands</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                When confirmed bookings are recorded, milestone schedules will populate here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookings.map(bk => {
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
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>
                          {bk.bookingNumber}
                        </span>

                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 4 }}>
                          Agreement: {formatINR(bk.agreementValue)}
                        </span>

                        <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                          Collected: {formatINR(bk.totalPaid)}
                        </span>

                        {outstanding > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                            Pending: {formatINR(outstanding)}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                        <span>👤 {bk.leadId?.name || 'Customer'} ({bk.leadId?.phone})</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                        {bk.projectId && <span>🏢 {bk.projectId.name}</span>}
                        {bk.inventoryId && <span>🚪 Unit: {bk.inventoryId.unitNumber}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {outstanding > 0 && (
                        <button
                          onClick={() => openRecordModal(bk)}
                          className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center"
                          style={{ fontSize: 12, fontWeight: 700, gap: 6, background: '#10b981', borderColor: '#10b981' }}
                        >
                          <Receipt size={14} /> Record Receipt
                        </button>
                      )}

                      <Link
                        href={`/bookings`}
                        className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center"
                        style={{ fontSize: 12 }}
                      >
                        View Schedule →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {/* Modal: Record Payment Receipt */}
      {selectedBookingForPay && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>Record Payment Receipt</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Booking: {selectedBookingForPay.bookingNumber} • Customer: {selectedBookingForPay.leadId?.name}
            </p>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Select Payment Milestone *</label>
                <select
                  className="input"
                  required
                  value={selectedScheduleId}
                  onChange={e => {
                    setSelectedScheduleId(e.target.value);
                    const s = bookingSchedules.find(x => x._id === e.target.value);
                    if (s) {
                      const rem = Math.max(0, s.amount - (s.paidAmount || 0));
                      setPayAmount(rem > 0 ? rem : '');
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="">Select milestone...</option>
                  {bookingSchedules.map(s => (
                    <option key={s._id} value={s._id}>
                      {s.milestoneName} — {formatINR(s.amount)} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Amount Received (₹) *</label>
                <input
                  type="number"
                  required
                  className="input"
                  placeholder="e.g. 500000"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Transaction Notes / Bank UTR</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. HDFC Bank IMPS / Cheque #883921"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setSelectedBookingForPay(null)} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" disabled={isRecording} className="btn btn-primary btn-sm">
                  {isRecording ? 'Recording...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsContent />
    </Suspense>
  );
}
