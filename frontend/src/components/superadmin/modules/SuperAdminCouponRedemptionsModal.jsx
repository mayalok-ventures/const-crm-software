'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  CreditCard,
  DollarSign,
  TrendingUp,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

export default function SuperAdminCouponRedemptionsModal({
  isOpen = false,
  onClose = () => {},
  coupon = null,
}) {
  const [redemptions, setRedemptions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchRedemptions = async (targetPage = 1) => {
    if (!coupon?._id) return;
    try {
      setLoading(true);
      const res = await api.get(`/super-admin/coupons/${coupon._id}/redemptions?page=${targetPage}&limit=15`);
      if (res.data?.success) {
        setRedemptions(res.data.redemptions || []);
        setAnalytics(res.data.analytics || null);
        setPage(res.data.page || 1);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch coupon redemptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && coupon?._id) {
      setPage(1);
      fetchRedemptions(1);
    }
  }, [isOpen, coupon]);

  if (!isOpen || !coupon) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0b101b] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1424]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Customer Redemptions: <span className="font-mono text-amber-400">{coupon.code}</span>
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold uppercase">
                  {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} FLAT`}
                </span>
              </div>
              <p className="text-xs text-slate-400">Complete audit log of all customers who applied this coupon during checkout.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Analytics Cards Banner */}
        <div className="p-6 border-b border-slate-800 bg-[#080d18] grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Redemptions</span>
            <div className="text-lg font-black text-white font-mono">{totalCount}</div>
            <span className="text-[10px] text-slate-500">Successful checkouts</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Gross Contract Value</span>
            <div className="text-lg font-black text-slate-300 font-mono">
              ₹{(analytics?.grossRevenue || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-500">Before discounts</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Discount Given</span>
            <div className="text-lg font-black text-amber-400 font-mono">
              ₹{(analytics?.totalDiscount || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-amber-400/80">Customer savings</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Net Realized Revenue</span>
            <div className="text-lg font-black text-emerald-400 font-mono">
              ₹{(analytics?.netRevenue || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-emerald-400/80">Collected in gateway</span>
          </div>
        </div>

        {/* Customer Redemptions Table */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Customer Purchase Records</span>
            <button
              onClick={() => fetchRedemptions(page)}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
              <span className="text-xs text-slate-400">Loading redemptions...</span>
            </div>
          ) : redemptions.length === 0 ? (
            <div className="py-16 text-center rounded-xl bg-slate-900/40 border border-slate-800">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">No redemptions recorded yet</p>
              <p className="text-xs text-slate-500 mt-1">Customers who purchase subscriptions using this coupon will appear here.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Customer / Tenant</th>
                    <th className="px-4 py-3">Plan Subscribed</th>
                    <th className="px-4 py-3">Original</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Final Paid</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {redemptions.map(r => (
                    <tr key={r._id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-4 py-3 font-sans">
                        <div className="font-bold text-white text-xs">{r.customerName}</div>
                        <div className="text-[11px] text-slate-400">{r.customerEmail}</div>
                        {r.customerPhone !== 'N/A' && (
                          <div className="text-[10px] text-slate-500">{r.customerPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span className="text-xs font-bold text-slate-200 block">{r.planName}</span>
                        <span className="text-[10px] text-slate-400 uppercase">{r.billingInterval} billing</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        ₹{(r.originalAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-amber-400 font-bold">
                        -₹{(r.discountAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-bold">
                        ₹{(r.finalAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                        {r.redeemedAt ? new Date(r.redeemedAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          r.status === 'REDEEMED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : r.status === 'REVERSED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-slate-800 text-slate-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400 font-mono">
                Page {page} of {totalPages} ({totalCount} total entries)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fetchRedemptions(page - 1)}
                  disabled={page <= 1 || loading}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fetchRedemptions(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
