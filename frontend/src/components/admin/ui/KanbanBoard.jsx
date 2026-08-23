'use client';

import React from 'react';
import LeadCard from './LeadCard';
import LoadingSkeleton from './LoadingSkeleton';

const KANBAN_STAGES = [
  { id: 'new_lead', label: 'New Lead', dot: 'bg-slate-400', border: 'border-slate-800' },
  { id: 'contacted', label: 'Contacted', dot: 'bg-blue-400', border: 'border-blue-900/30' },
  { id: 'not_interested', label: 'Not Interested', dot: 'bg-rose-400', border: 'border-rose-900/30' },
  { id: 'converted', label: 'Converted', dot: 'bg-emerald-400', border: 'border-emerald-900/30' },
  { id: 'payment_done', label: 'Payment Done', dot: 'bg-purple-400', border: 'border-purple-900/30' },
];

export default function KanbanBoard({
  leads = [],
  loading = false,
  onStageChange,
  onLeadClick,
}) {
  if (loading) {
    return <LoadingSkeleton type="kanban" />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
      {KANBAN_STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => (l.status || 'new_lead') === stage.id);
        const stageTotalValue = stageLeads.reduce(
          (acc, l) => acc + Number(l.paid_amount || l.payable_amount || l.deal_value || 0),
          0
        );

        return (
          <div
            key={stage.id}
            className={`bg-[#0b101d] rounded-xl border ${stage.border} p-3 min-h-[520px] flex flex-col shadow-sm`}
          >
            {/* Stage Column Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                <span className="text-xs font-semibold text-slate-200">{stage.label}</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold font-mono">
                {stageLeads.length}
              </span>
            </div>

            {/* Total Stage Deal Value */}
            {stageTotalValue > 0 && (
              <div className="mb-2 text-[10px] text-slate-400 font-medium flex justify-between">
                <span>Pipeline Value:</span>
                <span className="font-semibold text-slate-200">₹{stageTotalValue.toLocaleString()}</span>
              </div>
            )}

            {/* Lead Cards List */}
            <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar pr-0.5">
              {stageLeads.map((lead) => (
                <LeadCard
                  key={lead._id}
                  lead={lead}
                  onStageChange={onStageChange}
                  onClick={() => onLeadClick && onLeadClick(lead)}
                />
              ))}

              {stageLeads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 text-xs border border-dashed border-slate-800/60 rounded-lg">
                  <span>No leads in stage</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
