'use client';

import React from 'react';

const STAGE_STYLES = {
  new_lead: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  contacted: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  not_interested: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  converted: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  payment_done: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  // Aliases & fallback
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  disabled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  disconnected: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  paid: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
};

const STAGE_LABELS = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  not_interested: 'Not Interested',
  converted: 'Converted',
  payment_done: 'Payment Done',
  SOURCE_A_MANUAL: '✍️ Manual',
  SOURCE_B_SIGNUP: '🚀 Signup',
  SOURCE_C_ADS: '🎯 Ads / Webhook',
  manual: '✍️ Manual',
  signup: '🚀 Signup',
  ads: '🎯 Ads',
  webhook: '⚡ Webhook',
};

export default function StatusBadge({ status, label, size = 'sm', className = '' }) {
  const normalizedKey = String(status || '').toLowerCase().trim();
  const badgeStyle = STAGE_STYLES[normalizedKey] || 'bg-slate-800 text-slate-300 border-slate-700';
  const displayLabel = label || STAGE_LABELS[status] || STAGE_LABELS[normalizedKey] || status || 'Unknown';

  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center font-medium rounded-md border ${badgeStyle} ${sizeClasses} ${className}`}>
      {displayLabel}
    </span>
  );
}
