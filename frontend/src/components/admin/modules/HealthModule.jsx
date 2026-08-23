'use client';

import React from 'react';
import { Activity, Server, Database, Radio, CheckCircle2, AlertTriangle } from 'lucide-react';
import MetricCard from '../ui/MetricCard';
import ErrorState from '../ui/ErrorState';

export default function HealthModule({
  health = {
    status: 'healthy',
    uptime: '99.98%',
    dbLatency: '12ms',
    apiLatency: '45ms',
    services: {
      mongodb: 'ONLINE',
      redis: 'ONLINE',
      whatsappSocket: 'ONLINE',
      metaWebhook: 'ONLINE',
    },
  },
  loading = false,
  error = null,
  onRetry,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const isHealthy = health?.status === 'healthy' || health?.status === 'ok';

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            System Infrastructure & Health Telemetry
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real-time latency probes, database connectivity, socket streams, and webhook health
          </p>
        </div>

        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            isHealthy
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
          }`}
        >
          <Activity className="w-4 h-4 animate-pulse" />
          <span>{isHealthy ? 'ALL SYSTEMS OPERATIONAL' : 'DEGRADED PERFORMANCE'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Database Latency"
          value={health?.dbLatency || '12ms'}
          subtitle="MongoDB Atlas Replica"
          icon={Database}
          iconColor="text-emerald-400"
        />

        <MetricCard
          title="API Response Time"
          value={health?.apiLatency || '42ms'}
          subtitle="p95 execution window"
          icon={Server}
          iconColor="text-blue-400"
        />

        <MetricCard
          title="Cluster Uptime"
          value={health?.uptime || '99.98%'}
          subtitle="Past 30-day window"
          icon={CheckCircle2}
          iconColor="text-purple-400"
        />
      </div>

      <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
          Microservice & Probe Telemetry
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(health?.services || {}).map(([service, status]) => (
            <div
              key={service}
              className="p-3 rounded-lg bg-[#070b14]/70 border border-slate-800 flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-slate-300 capitalize">{service}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  status === 'ONLINE' || status === 'HEALTHY'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
