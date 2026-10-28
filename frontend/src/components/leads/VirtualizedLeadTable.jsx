'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { Phone, MessageSquare, Flame, CheckCircle, ChevronRight, User } from 'lucide-react';
import { waLink } from '@/lib/auth';

/**
 * Ultra-Fast Virtualized Lead Table
 * Employs @tanstack/react-virtual to render 10,000+ leads with 60 FPS buttery scrolling
 * by keeping only visible rows in the browser DOM.
 */
export default function VirtualizedLeadTable({
  leads = [],
  onSelectLead,
  selectedLeadIds = new Set(),
  onToggleSelect,
}) {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // 72px average row height
    overscan: 5,
  });

  if (!leads || leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <User className="w-12 h-12 stroke-[1.5] mb-3 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-medium">No candidate leads found in this view.</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="relative overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm max-h-[720px] w-full"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const lead = leads[virtualRow.index];
          if (!lead) return null;
          const leadId = lead._id || lead.id;
          const isSelected = selectedLeadIds.has(leadId);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
              }`}
            >
              {/* Left Column: Checkbox & Name/Profile */}
              <div className="flex items-center gap-3 min-w-0">
                {onToggleSelect && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(leadId)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/leads/${leadId}`}
                      prefetch={false}
                      className="font-semibold text-slate-900 dark:text-slate-100 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                    >
                      {lead.name || 'Unnamed Candidate'}
                    </Link>
                    {lead.temperature === 'HOT' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                        <Flame className="w-2.5 h-2.5 mr-0.5 fill-rose-500 text-rose-500" />
                        HOT
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{lead.phone || 'No phone'}</span>
                    {lead.targetCourse && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[140px] text-slate-600 dark:text-slate-300">
                          {lead.targetCourse}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle: Stage & Score Badges */}
              <div className="hidden sm:flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {lead.pipelineStage || lead.status || 'Lead Received'}
                </span>
                {typeof lead.score === 'number' && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Score: {lead.score}
                  </span>
                )}
              </div>

              {/* Right: Quick Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {lead.phone && (
                  <>
                    <a
                      href={`tel:${lead.phone}`}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                      title="Call Candidate"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <a
                      href={waLink(lead.phone, `Hello ${lead.name || ''}, counseling team here.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                      title="WhatsApp Chat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                  </>
                )}

                <Link
                  href={`/leads/${leadId}`}
                  prefetch={false}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
