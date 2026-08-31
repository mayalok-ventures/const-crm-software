'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard, DollarSign, TrendingUp, Receipt, Ticket,
  ShoppingBag, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, ArrowUpRight, Plus, Edit2, Sliders, Users, Power, Archive
} from 'lucide-react';
import api from '@/lib/api';
import SuperAdminPlanCatalogModal from './SuperAdminPlanCatalogModal';
import SuperAdminCouponModal from './SuperAdminCouponModal';
import SuperAdminCouponRedemptionsModal from './SuperAdminCouponRedemptionsModal';

export default function SuperAdminRevenueModule({
  revenueData = null,
  loading = false,
  onRefresh = null,
}) {
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlanToEdit, setSelectedPlanToEdit] = useState(null);

  // Coupon State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [selectedCouponToEdit, setSelectedCouponToEdit] = useState(null);
  const [isRedemptionsModalOpen, setIsRedemptionsModalOpen] = useState(false);
  const [selectedCouponForRedemptions, setSelectedCouponForRedemptions] = useState(null);
  const [coupons, setCoupons] = useState(revenueData?.coupons || []);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  const fetchCoupons = async () => {
    try {
      setLoadingCoupons(true);
      const res = await api.get('/api/super-admin/coupons');
      if (res.data?.success) {
        setCoupons(res.data.coupons || []);
      }
    } catch (err) {
      console.warn('Failed to load superadmin coupons:', err);
    } finally {
      setLoadingCoupons(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleToggleCouponStatus = async (coupon) => {
    try {
      const endpoint = coupon.status === 'ACTIVE'
        ? `/api/super-admin/coupons/${coupon._id}/deactivate`
        : `/api/super-admin/coupons/${coupon._id}/activate`;
      await api.post(endpoint);
      fetchCoupons();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to toggle coupon status:', err);
    }
  };

  const metrics = revenueData?.metrics || {};
  const subscriptions = revenueData?.subscriptions || [];
  const payments = revenueData?.payments || [];
  const plans = revenueData?.plans || [];

  const handleTriggerReconciliation = async () => {
    try {
      setIsReconciling(true);
      setReconcileMessage(null);
      const res = await api.post('/api/superadmin/revenue/reconcile', { batchSize: 50 });
      if (res?.data?.success) {
        setReconcileMessage({
          type: 'success',
          text: res.data.message || 'Reconciliation completed successfully across active subscriptions.',
        });
        if (onRefresh) onRefresh();
      } else {
        setReconcileMessage({
          type: 'error',
          text: res?.data?.message || 'Reconciliation trigger failed.',
        });
      }
    } catch (err) {
      setReconcileMessage({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Network error executing reconciliation.',
      });
    } finally {
      setIsReconciling(false);
      setTimeout(() => setReconcileMessage(null), 6000);
    }
  };

  const filteredPlans = plans.filter((p) => {
    if (filterType === 'INDIVIDUAL') return (p.category || p.accountType) === 'INDIVIDUAL';
    if (filterType === 'ORGANIZATION') return (p.category || p.accountType) === 'ORGANIZATION';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER ACTION BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span>Subscriptions, MRR & Revenue Engine</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
              v2 Live
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated Razorpay gateway reconciliation, deterministic MRR normalization, and dynamic plan builder.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedPlanToEdit(null);
              setIsPlanModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm shadow-indigo-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Plan</span>
          </button>

          <button
            onClick={handleTriggerReconciliation}
            disabled={isReconciling}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            <span>{isReconciling ? 'Reconciling...' : 'Trigger Gateway Reconcile'}</span>
          </button>
        </div>
      </div>

      {reconcileMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
            reconcileMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}
        >
          {reconcileMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{reconcileMessage.text}</span>
        </div>
      )}

      {/* 1. HIGH-LEVEL KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Net Active MRR</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            ₹{(metrics.totalMRR || (metrics.totalMRRInPaise ? metrics.totalMRRInPaise / 100 : 0)).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
            <span>ARR: ₹{((metrics.totalMRR || 0) * 12).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Active Subscriptions</span>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {metrics.activeSubscriptionsCount || subscriptions.filter(s => s.status === 'ACTIVE').length}
          </div>
          <div className="text-[11px] text-slate-400">Paid Tenant Accounts</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Trial Accounts</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {metrics.trialCount || subscriptions.filter(s => s.status === 'TRIAL').length}
          </div>
          <div className="text-[11px] text-cyan-400">14-Day Evaluation</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Failed / Past Due</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            {metrics.pastDueCount || subscriptions.filter(s => s.status === 'PAST_DUE').length}
          </div>
          <div className="text-[11px] text-amber-400/80">Pending Invoices</div>
        </div>
      </div>

      {/* 2. PLANS & COMMERCIAL TIERS */}
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Plan Catalog & Feature Entitlements</h3>
            <span className="text-[11px] text-slate-400 font-mono">{plans.length} Database-Configured Plans</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedPlanToEdit(null);
                setIsPlanModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold hover:bg-indigo-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Plan</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-[11px]">
              {['ALL', 'INDIVIDUAL', 'ORGANIZATION'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    filterType === t
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {filteredPlans.slice(0, 9).map((plan) => {
            const rawPrice = plan.price || plan.monthlyPrice || (plan.priceInPaise ? Math.round(plan.priceInPaise / 100) : 0);
            const isYearly = plan.interval === 'yearly';
            const normalizedPerMonth = isYearly ? Math.round(rawPrice / 12) : rawPrice;

            return (
              <div
                key={plan._id || plan.code}
                className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 hover:border-indigo-500/50 transition-all group relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white line-clamp-1">{plan.name}</span>
                  <div className="flex items-center gap-1.5">
                    {plan.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                        {plan.badge}
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase font-bold shrink-0">
                      {plan.category || plan.accountType}
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 text-sm font-black text-emerald-400 font-mono">
                  <span>₹{rawPrice.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {isYearly ? `/ year (₹${normalizedPerMonth.toLocaleString('en-IN')}/mo)` : '/ month'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span>Code: {plan.code}</span>
                  <button
                    onClick={() => {
                      setSelectedPlanToEdit(plan);
                      setIsPlanModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Plan</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PLAN BUILDER MODAL */}
      <SuperAdminPlanCatalogModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        planToEdit={selectedPlanToEdit}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* 3. PROMOTIONAL COUPONS & DISCOUNT ENGINE */}
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Ticket className="w-4 h-4 text-amber-400" />
              <span>Promotional Coupons & Discount Engine</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {coupons.length} Active & Scheduled Campaign Codes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedCouponToEdit(null);
                setIsCouponModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-sm shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Coupon</span>
            </button>
          </div>
        </div>

        {coupons.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800/80">
            <Ticket className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-400">No promotional coupons created yet</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Click &quot;Create Coupon&quot; to launch targeted discount codes for customers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {coupons.map((coupon) => {
              const isExpired = coupon.validUntil && new Date(coupon.validUntil) < new Date();
              const isScheduled = coupon.validFrom && new Date(coupon.validFrom) > new Date();
              const effectiveStatus = isExpired ? 'EXPIRED' : isScheduled ? 'SCHEDULED' : coupon.status;

              return (
                <div
                  key={coupon._id || coupon.code}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white font-mono tracking-wide">
                          {coupon.code}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold uppercase">
                          {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} FLAT`}
                        </span>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        effectiveStatus === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : effectiveStatus === 'EXPIRED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-slate-800 text-slate-400'
                      }`}>
                        {effectiveStatus}
                      </span>
                    </div>

                    {coupon.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-1">{coupon.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block">Target:</span>
                        <span className="text-slate-300 font-bold truncate block">
                          {coupon.appliesToAllPlans ? 'All Plans' : coupon.applicableCategories?.join(', ') || 'Custom Plans'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Usage:</span>
                        <span className="text-amber-400 font-bold block">
                          {coupon.usageCount || 0} / {coupon.maxOverallUses && coupon.maxOverallUses !== -1 ? coupon.maxOverallUses : '∞'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <button
                      onClick={() => {
                        setSelectedCouponForRedemptions(coupon);
                        setIsRedemptionsModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>View Customers ({coupon.usageCount || 0})</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleCouponStatus(coupon)}
                        className={`p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ${
                          coupon.status === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                        title={coupon.status === 'ACTIVE' ? 'Deactivate Coupon' : 'Activate Coupon'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCouponToEdit(coupon);
                          setIsCouponModalOpen(true);
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COUPON BUILDER & CUSTOMER REDEMPTIONS MODALS */}
      <SuperAdminCouponModal
        isOpen={isCouponModalOpen}
        onClose={() => setIsCouponModalOpen(false)}
        couponToEdit={selectedCouponToEdit}
        onSuccess={() => {
          fetchCoupons();
          if (onRefresh) onRefresh();
        }}
      />

      <SuperAdminCouponRedemptionsModal
        isOpen={isRedemptionsModalOpen}
        onClose={() => setIsRedemptionsModalOpen(false)}
        coupon={selectedCouponForRedemptions}
      />

      {/* 4. RECENT INVOICES & PAYMENTS LEDGER */}
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Recent Payment Transactions Ledger
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">{payments.length} Verified Entries</span>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Transaction ID</th>
                <th className="px-4 py-2.5">Payer / Rep</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-xs text-slate-500">
                    No payment transactions recorded in current ledger.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const statusKey = String(p.status || 'captured').toLowerCase();
                  let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  if (statusKey === 'refunded') badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  else if (statusKey === 'failed') badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';

                  return (
                    <tr key={p._id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-300">
                        {p.transaction_id || p.transactionId || String(p._id).slice(-8)}
                      </td>
                      <td className="px-4 py-2.5 text-white font-medium">
                        {p.agent_id?.name || p.lead_id?.name || 'Verified Tenant'}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-emerald-400">
                        ₹{(p.amount || (p.amountInPaise ? p.amountInPaise / 100 : 0)).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] uppercase">
                        {p.method || 'Razorpay'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${badgeColor}`}>
                          {(p.status || 'SUCCESS').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">
                        {new Date(p.createdAt || Date.now()).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
