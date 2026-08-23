'use client';

import React from 'react';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no items to display in this table.',
  emptyActionLabel,
  onEmptyAction,
  onRowClick,
}) {
  if (loading) {
    return <LoadingSkeleton type="table" />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="rounded-xl border border-slate-800/80 bg-[#0d1424] overflow-hidden shadow-sm">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#070b14]/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`p-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {data.map((row, rIdx) => (
              <tr
                key={row._id || rIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`hover:bg-slate-800/40 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col, cIdx) => (
                  <td key={cIdx} className={`p-3.5 ${col.cellClassName || ''}`}>
                    {col.render ? col.render(row, rIdx) : row[col.accessor] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
