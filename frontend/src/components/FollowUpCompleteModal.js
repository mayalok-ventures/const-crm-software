'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { CheckCircle2, Calendar, Sparkles, X, Plus } from 'lucide-react';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';

export default function FollowUpCompleteModal({ lead, isOpen, onClose, onSuccess }) {
  const [outcomeNote, setOutcomeNote] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextScheduledDate, setNextScheduledDate] = useState('');
  const [nextAgendaNote, setNextAgendaNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !lead) return null;

  // Quick Preset Handlers for Next Follow-Up
  const applyPresetTomorrow = (hours, minutes = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hours, minutes, 0, 0);
    setNextScheduledDate(toLocalDatetimeString(d.toISOString()));
  };

  const applyPresetDays = (days, hours = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hours, 0, 0, 0);
    setNextScheduledDate(toLocalDatetimeString(d.toISOString()));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanOutcome = outcomeNote.trim();
    if (!cleanOutcome) {
      return toast.error('Mandatory: Please add an outcome note describing the conversation.');
    }

    let nextFollowUpPayload = null;
    if (scheduleNext) {
      if (!nextScheduledDate) {
        return toast.error('Please specify the date and time for the next follow-up.');
      }
      nextFollowUpPayload = {
        scheduledAt: fromLocalDatetimeStringToISO(nextScheduledDate),
        note: (nextAgendaNote || '').trim() || `Next step after: ${cleanOutcome}`,
      };
    }

    setLoading(true);
    try {
      const res = await api.post(`/leads/${lead._id}/follow-up/complete`, {
        outcomeNote: cleanOutcome,
        nextFollowUp: nextFollowUpPayload,
      });

      toast.success(res.data?.message || 'Follow-up completed & alarm silenced! ✅');
      if (onSuccess) onSuccess(res.data?.lead || { ...lead, followUpDate: nextFollowUpPayload ? nextFollowUpPayload.scheduledAt : null });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete follow-up');
    } finally {
      setLoading(false);
    }
  };

  const minDatetime = toLocalDatetimeString(new Date().toISOString());

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-sheet max-w-lg bg-white" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={19} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 m-0">Complete Follow-Up</h3>
              <p className="text-xs text-slate-500 m-0">
                Record outcome for <strong className="text-slate-800">{lead.name}</strong> ({lead.phone})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg p-1"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mandatory Outcome Note */}
          <div>
            <label className="label text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Follow-Up Outcome / Conversation Note *</span>
              <span className="text-[10px] text-rose-500 font-bold uppercase">Mandatory to silence alarm</span>
            </label>
            <textarea
              className="input text-xs"
              placeholder="e.g. Spoke with client. Discussed scholarship eligibility and scheduled campus tour..."
              rows={3}
              value={outcomeNote}
              onChange={e => setOutcomeNote(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Schedule Next Follow-Up Checkbox / Accordion */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scheduleNext}
                onChange={e => setScheduleNext(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-600" />
                Schedule Next Follow-Up on this Lead
              </span>
            </label>

            {scheduleNext && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3">
                {/* Quick Presets */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Quick Next-Date Presets
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPresetTomorrow(10, 0)}
                      className="text-xs py-1.5 px-2 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-medium transition text-center"
                    >
                      🌅 Tomorrow 10 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetTomorrow(15, 0)}
                      className="text-xs py-1.5 px-2 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-medium transition text-center"
                    >
                      ☀️ Tomorrow 3 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetDays(2, 10)}
                      className="text-xs py-1.5 px-2 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-medium transition text-center"
                    >
                      📅 In 2 Days
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label text-[11px] font-semibold text-slate-600">
                    Next Scheduled Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    className="input text-xs"
                    min={minDatetime}
                    value={nextScheduledDate}
                    onChange={e => setNextScheduledDate(e.target.value)}
                    required={scheduleNext}
                  />
                </div>

                <div>
                  <label className="label text-[11px] font-semibold text-slate-600">
                    Next Follow-Up Agenda Note
                  </label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="e.g. Confirm document submission and registration payment"
                    value={nextAgendaNote}
                    onChange={e => setNextAgendaNote(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !outcomeNote.trim()}
              className="btn btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white flex items-center gap-1.5"
            >
              {loading ? <div className="spinner w-4 h-4" /> : <><CheckCircle2 size={14} /> Save Note & Silence Alarm ✅</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
