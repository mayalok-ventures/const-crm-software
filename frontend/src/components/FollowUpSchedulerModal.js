'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Calendar, Clock, X, Check, Sparkles, Building, MapPin } from 'lucide-react';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';

export default function FollowUpSchedulerModal({ lead, isOpen, onClose, onSuccess }) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [agendaNote, setAgendaNote] = useState('');
  const [followUpType, setFollowUpType] = useState('call');
  const [selectedProjectId, setSelectedProjectId] = useState(lead?.projectId || '');
  const [siteVisitLocation, setSiteVisitLocation] = useState(lead?.location || '');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/projects').then(res => setProjects(res.data || [])).catch(() => {});
      if (lead?.projectId) setSelectedProjectId(lead.projectId);
      if (lead?.location) setSiteVisitLocation(lead.location);
    }
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

  // Quick Preset Handlers
  const applyPresetMinutes = (mins) => {
    const d = new Date(Date.now() + mins * 60 * 1000);
    setScheduledDate(toLocalDatetimeString(d.toISOString()));
  };

  const applyPresetTomorrow = (hours, minutes = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hours, minutes, 0, 0);
    setScheduledDate(toLocalDatetimeString(d.toISOString()));
  };

  const applyPresetDays = (days, hours = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hours, 0, 0, 0);
    setScheduledDate(toLocalDatetimeString(d.toISOString()));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduledDate) {
      return toast.error('Please select follow-up date and time.');
    }
    const cleanNote = agendaNote.trim();
    if (!cleanNote) {
      return toast.error('Mandatory: Please enter what this follow-up is about.');
    }

    setLoading(true);
    try {
      const isoDate = fromLocalDatetimeStringToISO(scheduledDate);
      const payload = {
        scheduledAt: isoDate,
        note: cleanNote,
        type: followUpType,
      };

      if (followUpType === 'site_visit') {
        payload.siteVisitDetails = {
          projectId: selectedProjectId || lead.projectId || null,
          location: siteVisitLocation.trim() || lead.location || '',
        };
      }

      const res = await api.post(`/leads/${lead._id}/follow-up`, payload);

      toast.success(`${followUpType === 'site_visit' ? 'Site visit' : 'Follow-up'} scheduled for ${formatDisplayDateTime(isoDate)} ⏰`);
      if (onSuccess) onSuccess(res.data?.lead || { ...lead, followUpDate: isoDate, followUpNote: cleanNote });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule follow-up');
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
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 m-0">Schedule Follow-Up</h3>
              <p className="text-xs text-slate-500 m-0">
                Prospect: <strong className="text-slate-800">{lead.name}</strong> ({lead.phone})
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
          {/* Quick Date-Time Preset Selector */}
          <div>
            <label className="label text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <Sparkles size={13} className="text-indigo-500" /> Quick Date & Time Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => applyPresetMinutes(15)}
                className="text-xs py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 font-medium transition text-center"
              >
                ⚡ +15 Mins
              </button>
              <button
                type="button"
                onClick={() => applyPresetMinutes(30)}
                className="text-xs py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 font-medium transition text-center"
              >
                ⚡ +30 Mins
              </button>
              <button
                type="button"
                onClick={() => applyPresetMinutes(60)}
                className="text-xs py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 font-medium transition text-center"
              >
                ⏳ +1 Hour
              </button>
              <button
                type="button"
                onClick={() => applyPresetMinutes(120)}
                className="text-xs py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 font-medium transition text-center"
              >
                ⏳ +2 Hours
              </button>
              <button
                type="button"
                onClick={() => applyPresetTomorrow(10, 0)}
                className="text-xs py-1.5 px-2 rounded-lg bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold transition text-center"
              >
                🌅 Tomorrow 10 AM
              </button>
              <button
                type="button"
                onClick={() => applyPresetTomorrow(15, 0)}
                className="text-xs py-1.5 px-2 rounded-lg bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold transition text-center"
              >
                ☀️ Tomorrow 3 PM
              </button>
              <button
                type="button"
                onClick={() => applyPresetDays(2, 10)}
                className="text-xs py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 font-medium transition text-center"
              >
                📅 In 2 Days
              </button>
              <button
                type="button"
                onClick={() => applyPresetDays(7, 10)}
                className="text-xs py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 font-medium transition text-center"
              >
                🗓️ In 1 Week
              </button>
            </div>
          </div>

          {/* Follow-Up Activity Type */}
          <div>
            <label className="label text-xs font-semibold text-slate-700">
              Follow-Up Activity Type
            </label>
            <select
              className="input text-xs"
              value={followUpType}
              onChange={e => setFollowUpType(e.target.value)}
            >
              <option value="call">📞 Phone Call</option>
              <option value="site_visit">🏡 Site Visit / Property Tour</option>
              <option value="meeting">🤝 In-Person Meeting</option>
              <option value="whatsapp">💬 WhatsApp Message</option>
              <option value="email">✉️ Email Follow-Up</option>
              <option value="document_collection">📄 Document Collection</option>
              <option value="payment_reminder">💳 Payment Reminder</option>
            </select>
          </div>

          {/* Conditional Site Visit Details (Shown only when type is site_visit) */}
          {followUpType === 'site_visit' && (
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                <Building size={13} className="text-indigo-600" />
                <span>Site Visit Configuration</span>
              </div>

              <div>
                <label className="label text-[11px] font-semibold text-slate-600 mb-1">
                  Target Project / Property Offering
                </label>
                <select
                  className="input text-xs"
                  value={selectedProjectId}
                  onChange={e => {
                    setSelectedProjectId(e.target.value);
                    const p = projects.find(proj => proj._id === e.target.value);
                    if (p?.location && !siteVisitLocation) setSiteVisitLocation(p.location);
                  }}
                >
                  <option value="">-- Select Project / Property --</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>📦 {p.name} ({p.location || 'Location'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <MapPin size={11} className="text-indigo-600" /> Visit Venue / Meeting Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sector 150 Site Office / Model Flat"
                  className="input text-xs"
                  value={siteVisitLocation}
                  onChange={e => setSiteVisitLocation(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Date & Time Picker */}
          <div>
            <label className="label text-xs font-semibold text-slate-700">
              Scheduled Date & Time *
            </label>
            <input
              type="datetime-local"
              className="input text-sm"
              min={minDatetime}
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              required
            />
          </div>

          {/* Mandatory Agenda Note */}
          <div>
            <label className="label text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>{followUpType === 'site_visit' ? 'Site Visit Agenda / Purpose *' : 'Follow-Up Agenda / Note *'}</span>
              <span className="text-[10px] text-rose-500 font-bold uppercase">Mandatory</span>
            </label>
            <textarea
              className="input text-xs"
              placeholder={followUpType === 'site_visit' ? 'e.g. Showing 3BHK sample flat and discussing payment plans...' : 'e.g. Call client to discuss customized proposal & seat reservation...'}
              rows={3}
              value={agendaNote}
              onChange={e => setAgendaNote(e.target.value)}
              required
            />
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
              disabled={loading || !scheduledDate || !agendaNote.trim()}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              {loading ? <div className="spinner w-4 h-4" /> : <><Check size={14} /> Schedule Follow-Up ⏰</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
