'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useModalA11y } from '@/lib/useModalA11y';
import {
  X, History, MessageCircle, Mail, Phone, Calendar,
  CreditCard, CheckCircle2, AlertCircle, RefreshCw, Filter
} from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_ICONS = {
  chat: <MessageCircle size={14} className="text-emerald-600" />,
  email: <Mail size={14} className="text-blue-600" />,
  call: <Phone size={14} className="text-indigo-600" />,
  followup: <Calendar size={14} className="text-purple-600" />,
  payment: <CreditCard size={14} className="text-amber-600" />,
  activity: <History size={14} className="text-slate-600" />,
  status: <CheckCircle2 size={14} className="text-teal-600" />,
};

export default function LeadTimelineDrawer({
  isOpen,
  onClose,
  leadId,
  leadName,
}) {
  const { modalRef } = useModalA11y({ isOpen, onClose });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    if (!isOpen || !leadId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    api.get(`/leads/${leadId}/timeline`)
      .then((res) => {
        if (isMounted) {
          const list = res.data?.events || res.data?.timeline || [];
          setEvents(list);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.response?.data?.message || 'Failed to load timeline events');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, leadId]);

  if (!isOpen) return null;

  const filteredEvents = selectedFilter === 'all'
    ? events
    : events.filter(e => (e.category || e.type || '').toLowerCase().includes(selectedFilter));

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-drawer-title"
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition ease-in-out duration-300"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <History className="text-indigo-600" size={20} />
            <div>
              <h2 id="timeline-drawer-title" className="text-sm font-bold text-slate-900">
                Omnichannel Timeline
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">
                {leadName || 'Lead Activity Feed'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            aria-label="Close timeline drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs bg-white shrink-0">
          <Filter size={12} className="text-slate-400 shrink-0 mr-1" />
          {['all', 'chat', 'email', 'followup', 'payment', 'status'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedFilter(cat)}
              className={`px-2 py-0.5 rounded-full capitalize whitespace-nowrap font-medium transition ${
                selectedFilter === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <RefreshCw className="animate-spin text-indigo-500" size={24} />
              <p className="text-xs">Loading interaction history...</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && filteredEvents.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs">
              <History size={32} className="mx-auto mb-2 opacity-40" />
              No timeline events recorded yet.
            </div>
          )}

          {!loading && !error && filteredEvents.length > 0 && (
            <ol className="relative border-l border-slate-200 ml-3 space-y-6">
              {filteredEvents.map((evt, idx) => {
                const icon = CATEGORY_ICONS[evt.category || evt.type] || CATEGORY_ICONS.activity;
                const formattedTime = evt.timestamp
                  ? format(new Date(evt.timestamp), 'dd MMM yyyy, hh:mm a')
                  : '';

                return (
                  <li key={evt.id || idx} className="mb-4 ml-6">
                    <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-white border border-slate-200 rounded-full shadow-xs">
                      {icon}
                    </span>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs shadow-2xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-800 capitalize">
                          {evt.title || evt.action || 'Activity'}
                        </span>
                        <time className="text-[10px] text-slate-400 shrink-0">
                          {formattedTime}
                        </time>
                      </div>
                      {evt.description && (
                        <p className="text-slate-600 whitespace-pre-wrap break-words">
                          {evt.description}
                        </p>
                      )}
                      {evt.performedByName && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          By: <span className="font-medium text-slate-600">{evt.performedByName}</span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
