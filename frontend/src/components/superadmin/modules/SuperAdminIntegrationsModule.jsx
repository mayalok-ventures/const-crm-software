'use client';

import React from 'react';
import { Radio, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SuperAdminIntegrationsModule({
  telemetry = null,
  loading = false,
}) {
  const summary = telemetry?.summary || {};
  const meta = telemetry?.meta || [];
  const google = telemetry?.google || [];
  const webhooks = telemetry?.webhooks || [];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Meta Lead Ads Integrations</span>
          <span className="text-2xl font-black text-blue-400 font-mono mt-1 block">{summary.totalMeta || 0} Connected</span>
          <span className="text-[11px] text-emerald-400 mt-1 block">{summary.activeMeta || 0} active webhooks</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Google Ads Integrations</span>
          <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">{summary.totalGoogle || 0} Connected</span>
          <span className="text-[11px] text-emerald-400 mt-1 block">{summary.activeGoogle || 0} active endpoints</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Custom Webhook Handlers</span>
          <span className="text-2xl font-black text-purple-400 font-mono mt-1 block">{summary.totalWebhooks || 0} Endpoints</span>
          <span className="text-[11px] text-emerald-400 mt-1 block">{summary.activeWebhooks || 0} healthy workers</span>
        </div>
      </div>

      {/* Connected Integrations List */}
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
          Active Multi-Tenant Webhook Nodes & Integrations
        </h3>

        {meta.length === 0 && google.length === 0 && webhooks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No active external webhooks or integrations connected across tenants.
          </div>
        ) : (
          <div className="space-y-2">
            {[...meta, ...google, ...webhooks].map((int) => (
              <div key={int._id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="capitalize">{int.type} Integration</span>
                    <span className="text-[10px] text-slate-400 font-normal">({int.companyId?.companyInfo?.companyName || int.companyId?.name || 'Tenant'})</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Status: {int.status} • Events processed: {int.metrics?.eventsReceived || 0}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  HEALTHY
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
