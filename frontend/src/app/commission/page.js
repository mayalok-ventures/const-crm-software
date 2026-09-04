'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { isOwner, isManager, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Percent, Award, CheckCircle2, Search, RefreshCw, User,
  Building2, DollarSign, Calendar
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';

function CommissionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'team';

  const [user, setUser] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const fetchCommissionData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/commission-payouts');
      setPayouts(res.data?.payouts || res.data?.data || []);
    } catch {
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommissionData();
  }, [fetchCommissionData]);

  const totalCommission = payouts.reduce((sum, p) => sum + (p.commissionAmount || p.commissionEarned || 0), 0);
  const paidCommission = payouts
    .filter(p => p.status === 'PAID' || p.status === 'paid')
    .reduce((sum, p) => sum + (p.commissionAmount || p.commissionEarned || 0), 0);

  const filteredPayouts = payouts.filter(p => {
    if (activeTab === 'payouts') {
      return p.status === 'PAID' || p.status === 'paid';
    }
    return true;
  });

  return (
    <div className="app-container">
      <BottomNav active="commission" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Percent size={26} color="var(--accent)" /> Team Commission & Incentive Payouts
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Track agent commission rules, deal earnings, payout statuses, and brokerage ledgers.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={fetchCommissionData}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 13 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Team Incentives Earned</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                {formatINR(totalCommission)}
              </h2>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Disbursed / Paid</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                {formatINR(paidCommission)}
              </h2>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Pending Approval & Payout</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#f59e0b' }}>
                {formatINR(Math.max(0, totalCommission - paidCommission))}
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
              onClick={() => router.push('/commission?tab=team')}
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
              All Team Commissions ({payouts.length})
            </button>

            <button
              onClick={() => router.push('/commission?tab=payouts')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'payouts' ? '#10b981' : 'var(--surface)',
                color: activeTab === 'payouts' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'payouts' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ✅ Disbursed Payouts
            </button>
          </div>

          {/* Commission Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading commission ledger...</p>
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <Percent size={36} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Commission Records Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                When confirmed bookings are recorded, agent incentives are computed and posted here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredPayouts.map(p => {
                const amt = p.commissionAmount || p.commissionEarned || 0;
                const isPaid = p.status === 'PAID' || p.status === 'paid';

                return (
                  <div
                    key={p._id}
                    style={{
                      background: 'var(--card)',
                      borderRadius: 12,
                      padding: '14px 18px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          👤 {p.userName || p.userId?.name || 'Team Agent'}
                        </span>

                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color: isPaid ? '#10b981' : '#f59e0b'
                        }}>
                          {p.status || 'PENDING'}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {p.bookingId && <span>📑 Booking: {p.bookingId.bookingNumber || p.bookingId}</span>}
                        {p.leadName && <span>Customer: {p.leadName}</span>}
                        {p.createdAt && <span>📅 Date: {formatDisplayDateTime(p.createdAt)}</span>}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>
                        {formatINR(amt)}
                      </span>
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

export default function CommissionPage() {
  return (
    <Suspense fallback={null}>
      <CommissionContent />
    </Suspense>
  );
}
