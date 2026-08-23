'use client';

import React from 'react';
import { CreditCard, DollarSign, TrendingUp, Receipt, Ticket, ShoppingBag, ShieldCheck } from 'lucide-react';

export default function SuperAdminRevenueModule({
  revenueData = null,
  loading = false,
}) {
  const metrics = revenueData?.metrics || {};
  const subscriptions = revenueData?.subscriptions || [];
  const payments = revenueData?.payments || [];
  const plans = revenueData?.plans || [];
  const coupons = revenueData?.coupons || [];

  return (
    <div className="space-y-6">
      {/* 1. TOP REVENUE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Monthly Run-Rate (MRR)</span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">₹{(metrics.mrr || 0).toLocaleString('en-IN')}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Annualized Run-Rate: ₹{((metrics.arr || 0) / 100000).toFixed(1)} Lakhs</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Lifetime Collected Revenue</span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">₹{(metrics.lifetimeRevenue || 0).toLocaleString('en-IN')}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">From verified payment gateway transactions</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Active Paying Licenses</span>
          <span className="text-2xl font-black text-blue-400 font-mono mt-1 block">{metrics.activeSubscriptionsCount || 0}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Individual & Organization subscriptions</span>
        </div>
      </div>

      {/* 2. PLANS & COMMERCIAL TIERS */}
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Configured Platform SaaS Plans</h3>
          <span className="text-[11px] text-slate-400 font-mono">{plans.length} Standard Plans</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {plans.slice(0, 6).map((plan) => (
            <div key={plan._id} className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{plan.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase font-bold">
                  {plan.accountType}
                </span>
              </div>
              <div className="flex items-baseline gap-1 text-sm font-black text-emerald-400 font-mono">
                <span>₹{(plan.price || plan.monthlyPrice || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 font-normal">/ month</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Code: {plan.code}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. RECENT INVOICES & PAYMENTS LEDGER */}
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
          Recent Payment Transactions Ledger
        </h3>

        <div className="rounded-xl border border-slate-800 overflow-hidden">
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
                  <td colSpan={6} className="p-4 text-center text-xs text-slate-500">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-300">{p.transaction_id || p.transactionId || String(p._id).slice(-8)}</td>
                    <td className="px-4 py-2.5 text-white font-medium">{p.agent_id?.name || p.lead_id?.name || 'Verified Tenant'}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-400">₹{(p.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] uppercase">{p.method || 'UPI / Gateway'}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        SUCCESS
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">{new Date(p.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
