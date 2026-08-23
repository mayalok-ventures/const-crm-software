'use client';

import React from 'react';
import { Phone, Mail, UserCheck, MessageSquare, DollarSign } from 'lucide-react';
import StatusBadge from './StatusBadge';

const KANBAN_STAGES = [
  { id: 'new_lead', label: 'New Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'not_interested', label: 'Not Interested' },
  { id: 'converted', label: 'Converted' },
  { id: 'payment_done', label: 'Payment Done' },
];

export default function LeadCard({
  lead,
  onStageChange,
  onClick,
}) {
  const currentStage = lead.status || 'new_lead';

  return (
    <div
      onClick={onClick}
      className="p-3.5 rounded-xl bg-[#111827] border border-slate-800 hover:border-amber-500/30 transition-all space-y-2.5 shadow-sm group cursor-pointer"
    >
      {/* Title & Source Pill */}
      <div className="flex items-start justify-between gap-1.5">
        <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
          {lead.name}
        </h4>
        <StatusBadge status={lead.primarySource || lead.source} size="xs" />
      </div>

      {/* Contact Details */}
      <div className="text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5">
          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="font-mono text-slate-300">{lead.phone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-1.5 truncate">
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>

      {/* Package & Value */}
      {(lead.service_required || lead.deal_value || lead.paid_amount) && (
        <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-slate-300">
          <span className="truncate uppercase font-medium">
            {lead.service_required ? lead.service_required.replace('_', ' ') : 'Standard'}
          </span>
          <span className="font-bold text-emerald-400">
            ₹{Number(lead.paid_amount || lead.payable_amount || lead.deal_value || 0).toLocaleString()}
          </span>
        </div>
      )}

      {/* Footer: Rep Assignee & Fast Stage Selector */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1 text-[10px]">
        <div className="flex items-center gap-1 text-slate-400 truncate">
          <UserCheck className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="truncate">{lead.assignedTo?.name || 'Unassigned'}</span>
        </div>

        <select
          value={currentStage}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStageChange && onStageChange(lead._id, e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-amber-500"
        >
          {KANBAN_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
