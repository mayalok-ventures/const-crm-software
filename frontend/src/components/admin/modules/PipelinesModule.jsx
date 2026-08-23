'use client';

import React, { useState, useMemo } from 'react';
import { Workflow, Plus, Trash2, Save, Clock, Percent, Sliders, Eye, Phone, Sparkles } from 'lucide-react';
import DataTable from '../ui/DataTable';
import StatusBadge from '../ui/StatusBadge';
import ErrorState from '../ui/ErrorState';
import toast from 'react-hot-toast';

const DEFAULT_STAGES = [
  { id: 'new_lead', name: 'New Lead', probability: 10, colorCode: '#64748b', slaHours: 24 },
  { id: 'contacted', name: 'Contacted', probability: 30, colorCode: '#3b82f6', slaHours: 48 },
  { id: 'not_interested', name: 'Not Interested', probability: 0, colorCode: '#ef4444', slaHours: 24 },
  { id: 'converted', name: 'Converted', probability: 80, colorCode: '#10b981', slaHours: 72 },
  { id: 'payment_done', name: 'Payment Done', probability: 100, colorCode: '#8b5cf6', slaHours: 0 },
];

export default function PipelinesModule({
  leads = [],
  pipelineStages = [],
  loading = false,
  error = null,
  onRetry,
  onSavePipeline,
  onLeadClick,
  onStageChange,
  onCloseDeal,
}) {
  const [stages, setStages] = useState(
    pipelineStages.length > 0 ? pipelineStages : DEFAULT_STAGES
  );
  const [activeStageId, setActiveStageId] = useState('new_lead');
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync stages if props update
  React.useEffect(() => {
    if (pipelineStages && pipelineStages.length > 0) {
      setStages(pipelineStages);
    }
  }, [pipelineStages]);

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  // Filter leads matching the active stage
  const stageLeads = useMemo(() => {
    return leads.filter((l) => {
      const s = (l.status || 'new_lead').toLowerCase();
      if (activeStageId === 'payment_done') {
        return ['payment_done', 'closed', 'won', 'closed / won', 'closed won', 'advance paid', 'subscription won'].includes(s);
      }
      if (activeStageId === 'converted') {
        return ['converted', 'qualified', 'negotiation', 'site_visit', 'documents uploaded', 'onboarded'].includes(s);
      }
      if (activeStageId === 'not_interested') {
        return ['not_interested', 'lost', 'not interested', 'rejected'].includes(s);
      }
      if (activeStageId === 'contacted') {
        return ['contacted', 'connected', 'attempted', 'inquiry', 'demo class', 'floor plan shared', 'follow-up scheduled'].includes(s);
      }
      return !['payment_done', 'closed', 'won', 'closed / won', 'closed won', 'advance paid', 'subscription won', 'converted', 'qualified', 'negotiation', 'site_visit', 'documents uploaded', 'onboarded', 'not_interested', 'lost', 'not interested', 'rejected', 'contacted', 'connected', 'attempted', 'inquiry', 'demo class', 'floor plan shared', 'follow-up scheduled'].includes(s);
    });
  }, [leads, activeStageId]);

  // Stage lead columns
  const stageColumns = [
    {
      header: 'Customer Name',
      accessor: 'name',
      render: (row) => (
        <div className="font-bold text-white text-xs hover:text-amber-300 transition-colors">
          {row.name}
          {row.company && <div className="text-[10px] text-slate-400 font-normal">{row.company}</div>}
        </div>
      ),
    },
    {
      header: 'Phone / Contact',
      accessor: 'phone',
      render: (row) => (
        <span className="font-mono text-slate-300 text-xs">{row.phone}</span>
      ),
    },
    {
      header: 'Origin',
      accessor: 'primarySource',
      render: (row) => <StatusBadge status={row.primarySource || row.source} size="xs" />,
    },
    {
      header: 'Assigned Agent',
      accessor: 'assignedTo',
      render: (row) => (
        <span className="text-xs text-slate-300">{row.assignedTo?.name || 'Unassigned'}</span>
      ),
    },
    {
      header: 'Deal Value',
      accessor: 'payable_amount',
      render: (row) => (
        <span className="font-mono font-bold text-xs text-emerald-400">
          ₹{(row.closedDealAmount || row.payable_amount || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onLeadClick && onLeadClick(row)}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            title="View Profile"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onCloseDeal && onCloseDeal(row)}
            className="p-1.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800"
            title="Close Deal"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const handleUpdateStageProp = (index, field, value) => {
    setStages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSavePipelineSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (onSavePipeline) {
        await onSavePipeline(stages);
        toast.success('Pipeline stages and SLA rules saved!');
        setShowConfigDrawer(false);
      }
    } catch (err) {
      toast.error('Failed to save pipeline configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stage Header & Navigation Tabs */}
      <div className="p-3 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Stage Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {DEFAULT_STAGES.map((s) => {
            const count = leads.filter((l) => {
              const st = (l.status || 'new_lead').toLowerCase();
              if (s.id === 'payment_done') return ['payment_done', 'closed', 'won', 'closed / won', 'closed won', 'advance paid', 'subscription won'].includes(st);
              if (s.id === 'converted') return ['converted', 'qualified', 'negotiation', 'site_visit', 'documents uploaded', 'onboarded'].includes(st);
              if (s.id === 'not_interested') return ['not_interested', 'lost', 'not interested', 'rejected'].includes(st);
              if (s.id === 'contacted') return ['contacted', 'connected', 'attempted', 'inquiry', 'demo class', 'floor plan shared', 'follow-up scheduled'].includes(st);
              return !['payment_done', 'closed', 'won', 'closed / won', 'closed won', 'advance paid', 'subscription won', 'converted', 'qualified', 'negotiation', 'site_visit', 'documents uploaded', 'onboarded', 'not_interested', 'lost', 'not interested', 'rejected', 'contacted', 'connected', 'attempted', 'inquiry', 'demo class', 'floor plan shared', 'follow-up scheduled'].includes(st);
            }).length;

            const isActive = activeStageId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStageId(s.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <span>{s.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={() => setShowConfigDrawer(!showConfigDrawer)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors shrink-0"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showConfigDrawer ? 'Hide Settings' : 'Stage SLA & Probabilities'}</span>
        </button>
      </div>

      {/* Stage Settings Editor Drawer (Collapsible) */}
      {showConfigDrawer && (
        <form onSubmit={handleSavePipelineSettings} className="p-4 rounded-xl bg-[#0d1424] border border-amber-500/30 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pipeline Stage Governance</h4>
              <p className="text-[11px] text-slate-400">Configure canonical probabilities, stage markers, and response SLAs</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {stages.map((stage, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => handleUpdateStageProp(idx, 'name', e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-bold text-xs flex-1 focus:border-amber-500 focus:outline-none"
                  />
                  <input
                    type="color"
                    value={stage.colorCode || '#6366f1'}
                    onChange={(e) => handleUpdateStageProp(idx, 'colorCode', e.target.value)}
                    className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                    title="Stage Color"
                  />
                  {stages.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setStages((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-slate-500 hover:text-red-400 rounded"
                      title="Remove Stage"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-slate-400 block mb-0.5">Win Probability %</label>
                    <input
                      type="number"
                      value={stage.probability || 0}
                      onChange={(e) => handleUpdateStageProp(idx, 'probability', Number(e.target.value))}
                      min={0}
                      max={100}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">SLA (Hours)</label>
                    <input
                      type="number"
                      value={stage.slaHours || 24}
                      onChange={(e) => handleUpdateStageProp(idx, 'slaHours', Number(e.target.value))}
                      min={0}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setStages((prev) => [...prev, { id: `custom_${Date.now()}`, name: 'New Custom Stage', probability: 50, colorCode: '#3b82f6', slaHours: 24 }])}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Custom Pipeline Stage</span>
            </button>
          </div>
        </form>
      )}

      {/* Stage Active Leads Table */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0d1424] overflow-hidden shadow-sm">
        <DataTable
          columns={stageColumns}
          data={stageLeads}
          loading={loading}
          emptyMessage={`No leads currently in the "${DEFAULT_STAGES.find((s) => s.id === activeStageId)?.name || activeStageId}" stage.`}
          onRowClick={(row) => onLeadClick && onLeadClick(row)}
        />
      </div>
    </div>
  );
}
