'use client';

import React from 'react';
import { Plus, MessageSquare, Trash2, Mail, Phone, CheckCircle2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';

export default function TemplatesModule({
  templates = [],
  loading = false,
  error = null,
  onRetry,
  onAddTemplate,
  onDeleteTemplate,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const columns = [
    {
      header: 'Template Name & Content',
      accessor: 'name',
      render: (row) => (
        <div className="max-w-md">
          <div className="font-bold text-white text-xs flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{row.name}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 bg-slate-900/60 p-2 rounded border border-slate-800 font-mono">
            {row.content}
          </div>
        </div>
      ),
    },
    {
      header: 'Channel',
      accessor: 'channel',
      render: (row) => {
        const ch = String(row.channel || 'WHATSAPP').toUpperCase();
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              ch === 'WHATSAPP'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : ch === 'EMAIL'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
            }`}
          >
            {ch}
          </span>
        );
      },
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (row) => (
        <span className="text-xs text-slate-300 font-medium">{row.category || 'GENERAL'}</span>
      ),
    },
    {
      header: 'Dynamic Variables',
      accessor: 'variables',
      render: (row) => (
        <div className="flex gap-1 flex-wrap">
          {(row.variables || []).length > 0 ? (
            row.variables.map((v, i) => (
              <span key={i} className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 text-[10px] font-mono">
                {`{{${v}}}`}
              </span>
            ))
          ) : (
            <span className="text-slate-400 text-[11px]">Static</span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (row) => (
        <button
          onClick={() => onDeleteTemplate && onDeleteTemplate(row._id)}
          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
          title="Delete Template"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Communication Template Centre
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Standardize outreach scripts and follow-up templates for WhatsApp, Email, and SMS
          </p>
        </div>

        {onAddTemplate && (
          <button
            onClick={onAddTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Template</span>
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={templates}
        loading={loading}
        emptyTitle="No templates created"
        emptyDescription="Create standard WhatsApp and Email pitch templates for your sales representatives."
        emptyActionLabel="Create First Template"
        onEmptyAction={onAddTemplate}
      />
    </div>
  );
}
