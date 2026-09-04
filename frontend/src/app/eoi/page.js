'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, isOwner, isManager, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  FileText, CheckCircle2, XCircle, AlertCircle, Clock, Search,
  RefreshCw, Building2, User, DollarSign, ArrowRight, ShieldAlert
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';

function EOIContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'all';

  const [user, setUser] = useState(null);
  const [eois, setEois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const fetchEOIs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/real-estate/eois');
      setEois(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load EOIs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEOIs();
  }, [fetchEOIs]);

  const handleConfirmEOI = async (eoiId) => {
    try {
      await api.post(`/real-estate/eois/${eoiId}/confirm`);
      toast.success('EOI Token Confirmed & Lead Score Updated! 🎯');
      fetchEOIs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm EOI');
    }
  };

  const handleCancelEOI = async (eoiId) => {
    if (!confirm('Are you sure you want to cancel this EOI and release the inventory hold?')) return;
    try {
      await api.post(`/real-estate/eois/${eoiId}/cancel`);
      toast.success('EOI cancelled and unit hold released to Available!');
      fetchEOIs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel EOI');
    }
  };

  const filteredEOIs = eois.filter(item => {
    if (activeTab === 'pending') {
      if (item.status !== 'SUBMITTED' && item.status !== 'DRAFT') return false;
    } else if (activeTab === 'confirmed') {
      if (item.status !== 'CONFIRMED') return false;
    } else if (activeTab === 'expiring') {
      const isPending = item.status === 'SUBMITTED' || item.status === 'CONFIRMED';
      const isOld = new Date(item.createdAt) < new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      if (!isPending || !isOld) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      const numMatch = (item.eoiNumber || '').toLowerCase().includes(q);
      const leadMatch = (item.leadId?.name || '').toLowerCase().includes(q);
      const projMatch = (item.projectId?.name || '').toLowerCase().includes(q);
      const unitMatch = (item.inventoryId?.unitNumber || '').toLowerCase().includes(q);
      if (!numMatch && !leadMatch && !projMatch && !unitMatch) return false;
    }

    return true;
  });

  return (
    <div className="app-container">
      <BottomNav active="eoi" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5">
                <FileText size={24} className="text-indigo-600 shrink-0" /> Expression of Interest (EOI) Management
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Track token payments, verify advance bookings, and monitor inventory hold expirations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchEOIs}
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
              onClick={() => router.push('/eoi?tab=all')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'all' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'all' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'all' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              All EOIs ({eois.length})
            </button>

            <button
              onClick={() => router.push('/eoi?tab=pending')}
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
              ⏳ Pending Verification ({eois.filter(e => e.status === 'SUBMITTED' || e.status === 'DRAFT').length})
            </button>

            <button
              onClick={() => router.push('/eoi?tab=confirmed')}
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
              ✅ Confirmed Tokens ({eois.filter(e => e.status === 'CONFIRMED').length})
            </button>

            <button
              onClick={() => router.push('/eoi?tab=expiring')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'expiring' ? '#ef4444' : 'var(--surface)',
                color: activeTab === 'expiring' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'expiring' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ⚠️ Expiring Soon
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
              placeholder="Search by EOI number, prospect name, project, unit..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', height: 32, fontSize: 13 }}
            />
          </div>

          {/* EOI List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading EOI tokens...</p>
            </div>
          ) : filteredEOIs.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <FileText size={36} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No EOIs Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                When agents generate Expression of Interest tokens from the lead drawer, they will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredEOIs.map(eoi => {
                const isConfirmed = eoi.status === 'CONFIRMED';
                const isCancelled = eoi.status === 'CANCELLED';
                const isPending = eoi.status === 'SUBMITTED' || eoi.status === 'DRAFT';

                return (
                  <div
                    key={eoi._id}
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
                    <div style={{ flex: '1 1 300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>
                          {eoi.eoiNumber}
                        </span>

                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: isConfirmed ? 'rgba(16,185,129,0.12)' : isCancelled ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                          color: isConfirmed ? '#10b981' : isCancelled ? '#ef4444' : '#f59e0b'
                        }}>
                          {eoi.status}
                        </span>

                        <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                          Token: {formatINR(eoi.tokenAmount)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                        {eoi.leadId ? (
                          <Link href={`/leads/${eoi.leadId._id || eoi.leadId}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                            👤 {eoi.leadId.name || 'Prospect'} ({eoi.leadId.phone})
                          </Link>
                        ) : (
                          <span>👤 Direct Customer</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                        {eoi.projectId && <span>🏢 {eoi.projectId.name}</span>}
                        {eoi.inventoryId && <span>🚪 Unit: {eoi.inventoryId.unitNumber} ({eoi.inventoryId.configuration || ''})</span>}
                        {eoi.createdAt && <span>📅 Date: {formatDisplayDateTime(eoi.createdAt)}</span>}
                        {eoi.createdBy && <span>👤 Agent: {eoi.createdBy.name}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isPending && (
                        <button
                          onClick={() => handleConfirmEOI(eoi._id)}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 12, fontWeight: 700, background: '#10b981', borderColor: '#10b981' }}
                        >
                          <CheckCircle2 size={14} /> Confirm Token
                        </button>
                      )}

                      {!isCancelled && (
                        <button
                          onClick={() => handleCancelEOI(eoi._id)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12, color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                        >
                          <XCircle size={14} /> Cancel EOI
                        </button>
                      )}

                      {eoi.leadId && (
                        <Link
                          href={`/leads/${eoi.leadId._id || eoi.leadId}`}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12 }}
                        >
                          View Lead →
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

export default function EOIPage() {
  return (
    <Suspense fallback={null}>
      <EOIContent />
    </Suspense>
  );
}
