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
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
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
    </div>
  );
}
