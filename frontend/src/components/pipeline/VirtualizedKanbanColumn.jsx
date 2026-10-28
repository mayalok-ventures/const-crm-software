'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { Phone, MessageSquare, Flame, Clock } from 'lucide-react';
import { waLink } from '@/lib/auth';

/**
 * Virtualized Kanban Column Card Stack
 * Prevents DOM degradation when individual pipeline columns contain 500+ cards.
 */
export default function VirtualizedKanbanColumn({
  stage,
  leads = [],
  onDragStart,
  onCardDrop,
}) {
  const columnRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => columnRef.current,
    estimateSize: () => 110, // ~110px average Kanban card height
    overscan: 4,
  });

  return (
    <div
      ref={columnRef}
      className="flex-1 overflow-y-auto px-2 py-2 max-h-[640px] min-h-[200px]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData('text/plain');
        if (leadId && onCardDrop) {
          onCardDrop(leadId, stage.id || stage.name);
        }
      }}
    >
      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-400">
          No candidates in this stage
        </div>
      ) : (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const lead = leads[virtualItem.index];
            if (!lead) return null;
            const leadId = lead._id || lead.id;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="pb-2.5"
              >
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', leadId);
                    if (onDragStart) onDragStart(lead);
                  }}
                  className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <Link
                      href={`/leads/${leadId}`}
                      prefetch={false}
                      className="font-semibold text-slate-900 dark:text-slate-100 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-1"
                    >
                      {lead.name || 'Unnamed Candidate'}
                    </Link>
                    {lead.temperature === 'HOT' && (
                      <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                    {lead.targetCourse || lead.targetStream || lead.phone || 'General Inquiry'}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                    <span className="text-[11px] font-medium text-slate-400">
                      {lead.score ? `Score: ${lead.score}` : 'New'}
                    </span>

                    <div className="flex items-center gap-2">
                      {lead.phone && (
                        <>
                          <a
                            href={`tel:${lead.phone}`}
                            className="text-slate-400 hover:text-emerald-600"
                            title="Call"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={waLink(lead.phone, `Hello ${lead.name || ''}, regarding your admission query.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-emerald-600"
                            title="WhatsApp"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
