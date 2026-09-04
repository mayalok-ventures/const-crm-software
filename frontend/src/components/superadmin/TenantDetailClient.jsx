'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Building2, Users, Layers, Radio,
  CreditCard, History, ShieldAlert, CheckCircle2,
  Mail, Phone, ExternalLink
} from 'lucide-react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

export default function TenantDetailClient() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'superadmin') {
      toast.error('Access restricted to Platform SuperAdmins');
      router.replace('/dashboard');
      return;
    }

    if (!tenantId || tenantId === 'placeholder') {
      setLoading(false);
      return;
    }
    async function loadTenant() {
      setLoading(true);
      try {
        const res = await api.get(`/super-admin/organisations/${tenantId}`);
        if (res.data.success) {
          setData(res.data.data);
        }
      } catch (err) {
        toast.error('Failed to load organisation profile');
      } finally {
        setLoading(false);
      }
    }
    loadTenant();
  }, [tenantId]);

  const [targetPlan, setTargetPlan] = useState('free');
  const [targetBillingCycle, setTargetBillingCycle] = useState('monthly');
  const [targetDuration, setTargetDuration] = useState('30');
  const [planReason, setPlanReason] = useState('');
  const [submittingPlan, setSubmittingPlan] = useState(false);

  useEffect(() => {
    if (data?.organisation?.owner?.plan) {
      setTargetPlan(data.organisation.owner.plan);
    }
    if (data?.organisation?.owner?.billingCycle) {
      setTargetBillingCycle(data.organisation.owner.billingCycle);
    }
  }, [data]);

  const handlePlanOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId) return;

    setSubmittingPlan(true);
    try {
      const res = await api.patch(`/super-admin/organisations/${tenantId}/plan`, {
        planCode: targetPlan,
        billingCycle: targetBillingCycle,
        durationDays: targetDuration === 'lifetime' ? null : Number(targetDuration),
        reason: planReason || `SuperAdmin manual override to ${targetPlan}`,
      });

      if (res.data.success) {
        toast.success(`Plan updated to ${targetPlan.toUpperCase()} successfully! 🚀`);
        if (data.organisation?.owner) {
          setData((prev) => ({
            ...prev,
            organisation: {
              ...prev.organisation,
              owner: {
                ...prev.organisation.owner,
                plan: targetPlan,
                billingCycle: targetBillingCycle,
              },
            },
          }));
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan');
    } finally {
      setSubmittingPlan(false);
    }
  };

  if (loading && tenantId !== 'placeholder') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#070b14] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <div className="text-xs font-mono text-slate-400">Loading Tenant Deep Profile...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#070b14] text-white p-4">
        <div className="text-sm font-bold text-slate-300">Organisation record not found.</div>
        <Link href="/superadmin-dashboard?tab=organisations" className="mt-4 text-xs text-amber-400 underline">
          Return to Organisations Roster
        </Link>
      </div>
    );
  }

  const org = data.organisation || {};
  const users = data.users || {};
  const leads = data.leads || {};
  const sub = data.subscription;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-3 sm:p-4 md:p-8 space-y-6 max-w-6xl mx-auto pb-mobile-nav">
      {/* Back link */}
      <Link
        href="/superadmin-dashboard?tab=organisations"
        className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Super Admin Roster</span>
      </Link>

      {/* Hero Banner */}
      <div className="p-6 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-2xl font-bold">
            🏢
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-white">{org.name}</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {org.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Owner: {org.owner?.name} • {org.owner?.email || org.owner?.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const reason = prompt('Enter support reason:');
              if (reason) {
                api.post('/super-admin/impersonate', { targetUserId: org.owner?._id, reason })
                  .then(() => toast.success('Entered support mode!'))
                  .catch(() => toast.error('Failed to enter support mode'));
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Launch Support Session</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Assigned Plan</span>
          <span className="text-lg font-bold text-amber-400 font-mono mt-1 block">{sub?.planId?.name || org.owner?.plan || 'Free Trial'}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Team Seats</span>
          <span className="text-lg font-bold text-white font-mono mt-1 block">{users.total || 0} Members</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">CRM Leads</span>
          <span className="text-lg font-bold text-blue-400 font-mono mt-1 block">{leads.total || 0} Inbound</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Payment Done</span>
          <span className="text-lg font-bold text-emerald-400 font-mono mt-1 block">{leads.stageCounts?.payment_done || 0} Won</span>
        </div>
      </div>

      {/* Super Admin Manual Subscription Plan Override Form */}
      <div className="p-6 rounded-2xl bg-[#0d1424] border border-amber-500/30 space-y-4 text-xs shadow-xl shadow-amber-950/20">
        <div className="flex items-center gap-2 text-amber-400">
          <CreditCard className="w-5 h-5" />
          <h2 className="font-bold text-sm uppercase tracking-wider text-white">⚡ SuperAdmin Manual Plan Override</h2>
        </div>
        <p className="text-xs text-slate-400">
          Directly assign or modify the subscription tier, team seat entitlements, and validity period for {org.name}.
        </p>

        <form onSubmit={handlePlanOverrideSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Subscription Plan</label>
              <select
                value={targetPlan}
                onChange={(e) => setTargetPlan(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <optgroup label="🏢 Organization / Team Plans">
                  <option value="free">Free Trial (10 Staff Seats • 1,000 Leads)</option>
                  <option value="team_starter">Team Starter (3 Seats • ₹1,499/mo)</option>
                  <option value="business">Business Agency (10 Seats • ₹2,499/mo)</option>
                  <option value="enterprise">Enterprise Command (25 Seats • ₹4,999/mo)</option>
                  <option value="custom_enterprise">Custom Enterprise (100+ Seats • Custom)</option>
                </optgroup>
                <optgroup label="👤 Individual / Solo Plans">
                  <option value="basic_solo">Basic Solo (1 Seat • 2k Leads • ₹399/mo)</option>
                  <option value="smart_solo">Smart Solo (1 Seat • 10k Leads • ₹799/mo)</option>
                  <option value="power_solo">Power Solo (1 Seat • 25k Leads • ₹1,299/mo)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Billing Cycle</label>
              <select
                value={targetBillingCycle}
                onChange={(e) => setTargetBillingCycle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="monthly">Monthly Cycle</option>
                <option value="yearly">Yearly Cycle</option>
                <option value="lifetime">Lifetime / Permanent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Plan Validity Duration</label>
              <select
                value={targetDuration}
                onChange={(e) => setTargetDuration(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="30">30 Days (1 Month)</option>
                <option value="90">90 Days (3 Months)</option>
                <option value="180">180 Days (6 Months)</option>
                <option value="365">365 Days (1 Full Year)</option>
                <option value="lifetime">Never Expire / Lifetime</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Audit Reason / Support Note</label>
              <input
                type="text"
                value={planReason}
                onChange={(e) => setPlanReason(e.target.value)}
                placeholder="e.g. Granted by SuperAdmin via Phone Support"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={submittingPlan}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>{submittingPlan ? 'Updating Plan...' : 'Apply & Save Subscription Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
