'use client';

import React from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-amber-400',
  trend,
  trendPositive = true,
  onClick,
  loading = false,
  error = false,
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 shadow-sm relative overflow-hidden transition-all group ${
        onClick ? 'cursor-pointer hover:border-amber-500/40 hover:bg-[#0f172a]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 w-24 bg-slate-800 rounded"></div>
          <div className="h-3 w-32 bg-slate-800/60 rounded"></div>
        </div>
      ) : error ? (
        <div className="text-xs text-rose-400 py-1">Unavailable</div>
      ) : (
        <>
          <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              {subtitle && <span>{subtitle}</span>}
            </div>
            {trend && (
              <span className={`inline-flex items-center gap-0.5 font-semibold ${trendPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                <TrendingUp className="w-3 h-3" />
                {trend}
              </span>
            )}
          </div>
        </>
      )}

      {onClick && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight className="w-3.5 h-3.5 text-amber-400/80" />
        </div>
      )}
    </div>
  );
}
