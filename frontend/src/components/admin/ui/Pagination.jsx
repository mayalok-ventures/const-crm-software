'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  limit = 50,
  onPageChange,
}) {
  if (totalPages <= 1 && totalRecords <= limit) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/80 bg-[#070b14]/50 text-xs text-slate-400">
      <div>
        Showing <span className="font-semibold text-white">{(currentPage - 1) * limit + 1}</span> to{' '}
        <span className="font-semibold text-white">{Math.min(currentPage * limit, totalRecords)}</span> of{' '}
        <span className="font-semibold text-white">{totalRecords}</span> entries
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-800 bg-[#0d1424] text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="px-3 py-1 text-xs font-semibold text-slate-200">
          {currentPage} / {totalPages || 1}
        </span>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-slate-800 bg-[#0d1424] text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
