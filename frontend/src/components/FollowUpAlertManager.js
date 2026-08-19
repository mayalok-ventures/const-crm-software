'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { waLink } from '@/lib/auth';
import { useAlarm } from '@/lib/AlarmContext';
import toast from 'react-hot-toast';
import {
  BellRing, Clock, AlertTriangle, MessageSquare,
  CheckCircle2, X, ChevronRight, Calendar, ArrowRight, CheckCircle, VolumeX, Volume2,
  Sparkles, ShieldAlert, Timer
} from 'lucide-react';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';

// ─── Dual-Tone High-Clarity WAV chime (Cross-platform Browser Audio) ─────────
const CHIME_WAV_B64 = (() => {
  const sampleRate = 22050;
  const duration = 0.6;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = t < 0.3 ? 784 : 1046.5; // G5 then C6 urgent alert chime
    const envelope = Math.min(1, (t < 0.04 ? t / 0.04 : 1) * (t > 0.5 ? (0.6 - t) / 0.1 : 1));
    const sample = Math.round(envelope * 0.75 * 32767 * Math.sin(2 * Math.PI * freq * t));
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample)), true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
});

let _chimeUri = null;
const getChimeUri = () => {
  if (typeof window === 'undefined') return null;
  if (!_chimeUri) _chimeUri = CHIME_WAV_B64();
  return _chimeUri;
};

export default function FollowUpAlertManager() {
  const router = useRouter();
  const pathname = usePathname();
  const [dueLeads, setDueLeads] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const lastAlarmTimeRef = useRef(0);
  const pollTimerRef = useRef(null);

  // Modal Resolution & Delay States
  const [resolvingLead, setResolvingLead] = useState(null);
  const [outcomeNote, setOutcomeNote] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [nextAgendaNote, setNextAgendaNote] = useState('');
  const [delayMinutesInput, setDelayMinutesInput] = useState(15);
  const [delayReason, setDelayReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [activeTab, setActiveTab] = useState('complete'); // 'complete' | 'delay'

  // Register setter with global AlarmContext
  const { register } = useAlarm();
  useEffect(() => { register(setDueLeads); }, [register]);

  const playWebAudioChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Double high chime
      [0, 0.25].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 880 : 1174.66, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.5, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.2);
      });
    } catch (err) {
      console.warn('[FollowUpAlert] WebAudio error:', err);
    }
  };

  const playAlarmSound = useCallback(() => {
    if (isMuted) return;

    const uri = getChimeUri();
    if (uri) {
      try {
        const audio = new Audio(uri);
        audio.volume = 0.85;
        const p = audio.play();
        if (p !== undefined) {
          p.then(() => {}).catch(() => playWebAudioChime());
        }
        return;
      } catch {}
    }
    playWebAudioChime();
  }, [isMuted]);

  const triggerBrowserNotification = (leads) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
      return;
    }

    if (Notification.permission === 'granted' && leads.length > 0) {
      const topLead = leads[0];
      const count = leads.length;
      const title = count === 1 ? `⏰ Urgent Follow-Up Due: ${topLead.name}` : `⏰ ${count} Leads Due for Follow-up!`;
      const body = count === 1
        ? `Phone: ${topLead.phone} • Agenda: ${topLead.followUpNote || 'Urgent Callback'}`
        : `${topLead.name} and ${count - 1} other client(s) need immediate follow-up.`;

      try {
        const notif = new Notification(title, {
          body,
          icon: '/android-chrome-192x192.png',
          badge: '/favicon-32x32.png',
          tag: 'follow-up-alert',
          requireInteraction: true,
        });

        notif.onclick = () => {
          window.focus();
          openResolveModal(topLead);
          notif.close();
        };
      } catch (err) {
        console.warn('[FollowUpNotification] Native notification notice:', err);
      }
    }
  };

  // 2-Minute Recurring Check & Fail-Safe Audio Engine
  const checkDueFollowUps = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const isAuthPage = pathname === '/login' || pathname === '/signup';
    if (!token || isAuthPage) return;

    try {
      const { data } = await api.get('/leads/follow-ups/due');
      const leads = Array.isArray(data) ? data : [];
      setDueLeads(leads);

      if (leads.length > 0) {
        const now = Date.now();
        const twoMinutes = 120 * 1000; // 2 minutes (120,000 ms) strict recurring interval
        if (now - lastAlarmTimeRef.current >= twoMinutes) {
          lastAlarmTimeRef.current = now;
          playAlarmSound();
          triggerBrowserNotification(leads);
          setIsOpen(true);
        }
      } else {
        setIsOpen(false);
      }
    } catch {}
  }, [pathname, playAlarmSound]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      const handleUserClick = () => {
        Notification.requestPermission();
        window.removeEventListener('click', handleUserClick);
      };
      window.addEventListener('click', handleUserClick, { once: true });
    }

    checkDueFollowUps();
    // Poll every 15 seconds to check if any scheduled follow-up has crossed the clock
    pollTimerRef.current = setInterval(checkDueFollowUps, 15000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [checkDueFollowUps]);

  // Open Resolution Modal
  const openResolveModal = (lead) => {
    setResolvingLead(lead);
    setOutcomeNote('');
    setScheduleNext(false);
    setNextFollowUpDate('');
    setNextAgendaNote('');
    setDelayMinutesInput(15);
    setDelayReason('');
    setModalError('');
    setActiveTab('complete');
  };

  // Complete Follow-Up Handler (Silences Alarm Permanently)
  const handleSaveComplete = async (e) => {
    e.preventDefault();
    const cleanNote = outcomeNote.trim();
    if (!cleanNote) {
      setModalError('Mandatory: An outcome note is required to complete this follow-up and silence the alarm.');
      return;
    }

    let nextPayload = null;
    if (scheduleNext) {
      if (!nextFollowUpDate) {
        setModalError('Please specify the date and time for the next follow-up.');
        return;
      }
      nextPayload = {
        scheduledAt: fromLocalDatetimeStringToISO(nextFollowUpDate),
        note: (nextAgendaNote || '').trim() || `Next step after: ${cleanNote}`,
      };
    }

    setActionLoading(true);
    setModalError('');
    try {
      const leadId = resolvingLead._id;
      const res = await api.post(`/leads/${leadId}/follow-up/complete`, {
        outcomeNote: cleanNote,
        nextFollowUp: nextPayload,
      });

      toast.success(res.data?.message || 'Follow-up completed & alarm silenced! ✅');
      setDueLeads(prev => prev.filter(l => l._id !== leadId));
      setResolvingLead(null);
      if (dueLeads.length <= 1) {
        setIsOpen(false);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to complete follow-up');
    } finally {
      setActionLoading(false);
    }
  };

  // Delay / Snooze Handler (Strict 2 Delays Limit Enforcement)
  const handleApplyDelay = async (e) => {
    e.preventDefault();
    const mins = parseInt(delayMinutesInput, 10);
    if (isNaN(mins) || mins < 5 || mins > 60) {
      setModalError('Delay duration must be between 5 minutes and 60 minutes.');
      return;
    }

    const currentDelays = resolvingLead?.activeFollowUp?.delayCount ?? resolvingLead?.followUpDelayCount ?? 0;
    if (currentDelays >= 2) {
      setModalError('Maximum 2 delays already reached for this follow-up. You must add an outcome note to complete it.');
      return;
    }

    setActionLoading(true);
    setModalError('');
    try {
      const leadId = resolvingLead._id;
      const res = await api.post(`/leads/${leadId}/follow-up/delay`, {
        delayMinutes: mins,
        reason: delayReason.trim(),
      });

      toast.success(res.data?.message || `Follow-up delayed by ${mins} minutes ⏰`);
      setDueLeads(prev => prev.filter(l => l._id !== leadId));
      setResolvingLead(null);
      if (dueLeads.length <= 1) {
        setIsOpen(false);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to delay follow-up');
    } finally {
      setActionLoading(false);
    }
  };

  const minDatetime = toLocalDatetimeString(new Date().toISOString());

  // Quick Preset Helper for Next Date in Complete Form
  const applyPresetTomorrow = (hours, minutes = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hours, minutes, 0, 0);
    setNextFollowUpDate(toLocalDatetimeString(d.toISOString()));
  };

  const applyPresetDays = (days, hours = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hours, 0, 0, 0);
    setNextFollowUpDate(toLocalDatetimeString(d.toISOString()));
  };

  return (
    <>
      {/* ── ALARM RESOLUTION MODAL ── */}
      {resolvingLead && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setResolvingLead(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in text-left"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                    <BellRing size={19} className="animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white m-0 flex items-center gap-1.5">
                      Urgent Follow-Up Action
                    </h3>
                    <p className="text-xs text-rose-100 m-0">
                      Prospect: <strong className="text-white">{resolvingLead.name}</strong> ({resolvingLead.phone})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResolvingLead(null)}
                  className="text-white/80 hover:text-white text-xl p-1 leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Agenda Note Box */}
              {resolvingLead.followUpNote && (
                <div className="mt-2.5 p-2 bg-black/20 rounded-lg text-xs text-rose-50 border border-white/10">
                  <span className="font-semibold text-white">Follow-Up Agenda:</span> {resolvingLead.followUpNote}
                </div>
              )}
            </div>

            {/* Modal Body & Tabs */}
            <div className="p-4 sm:p-5">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-3.5 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Tab Switcher */}
              {(() => {
                const delaysUsed = resolvingLead?.activeFollowUp?.delayCount ?? resolvingLead?.followUpDelayCount ?? 0;
                const isDelayBlocked = delaysUsed >= 2;

                return (
                  <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveTab('complete')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        activeTab === 'complete'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Add Note & Stop Alarm
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('delay')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        activeTab === 'delay'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Timer size={14} className={isDelayBlocked ? 'text-rose-500' : 'text-indigo-600'} />
                      Apply Delay ({delaysUsed}/2 Used)
                    </button>
                  </div>
                );
              })()}

              {/* TAB 1: COMPLETE & SILENCE ALARM */}
              {activeTab === 'complete' && (
                <form onSubmit={handleSaveComplete} className="space-y-4">
                  <div>
                    <label className="label text-xs font-semibold text-slate-800 flex items-center justify-between">
                      <span>Conversation Outcome Note *</span>
                      <span className="text-[10px] text-rose-500 font-bold uppercase">Mandatory to Stop Alarm</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="e.g. Spoke with client. Discussed scholarship eligibility and revised fees. Client confirmed demo for tomorrow..."
                      value={outcomeNote}
                      onChange={e => setOutcomeNote(e.target.value)}
                      className="input text-xs"
                      autoFocus
                    />
                  </div>

                  {/* Schedule Next Follow-Up Sub-section */}
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
                        Schedule Next Follow-Up on this Lead (Resets delay count)
                      </span>
                    </label>

                    {scheduleNext && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Quick Date Presets
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => applyPresetTomorrow(10, 0)}
                              className="text-xs py-1 px-2 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-medium transition text-center"
                            >
                              🌅 Tomorrow 10 AM
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPresetTomorrow(15, 0)}
                              className="text-xs py-1 px-2 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-medium transition text-center"
                            >
                              ☀️ Tomorrow 3 PM
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPresetDays(2, 10)}
                              className="text-xs py-1 px-2 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-medium transition text-center"
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
                            value={nextFollowUpDate}
                            onChange={e => setNextFollowUpDate(e.target.value)}
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
                            placeholder="e.g. Conduct live demo and discuss fee installments"
                            value={nextAgendaNote}
                            onChange={e => setNextAgendaNote(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setResolvingLead(null)}
                      className="btn btn-ghost btn-sm flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading || !outcomeNote.trim()}
                      className="btn btn-primary btn-sm flex-1 bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white font-bold"
                    >
                      {actionLoading ? <div className="spinner w-4 h-4" /> : <><CheckCircle2 size={15} /> Save & Silence Alarm Permanently</>}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: APPLY DELAY (SNOOZE 5m - 60m, MAX 2 STRICTLY ENFORCED) */}
              {activeTab === 'delay' && (() => {
                const delaysUsed = resolvingLead?.activeFollowUp?.delayCount ?? resolvingLead?.followUpDelayCount ?? 0;
                const isDelayBlocked = delaysUsed >= 2;

                if (isDelayBlocked) {
                  return (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                        <ShieldAlert size={22} />
                      </div>
                      <h4 className="text-sm font-bold text-rose-900 m-0">
                        Maximum Delays Exceeded (2/2 Used)
                      </h4>
                      <p className="text-xs text-rose-700 m-0">
                        You have already delayed this follow-up twice. As per policy, you must submit an outcome note to silence the alarm.
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('complete')}
                          className="btn btn-primary btn-sm bg-rose-600 hover:bg-rose-700 text-white border-rose-600 font-bold"
                        >
                          Switch to Outcome Note Form
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <form onSubmit={handleApplyDelay} className="space-y-4">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Timer size={14} className="text-amber-600" /> Delays Used:
                      </span>
                      <span className="font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                        {delaysUsed} / 2 Allowed (1 Delay Remaining)
                      </span>
                    </div>

                    <div>
                      <label className="label text-xs font-semibold text-slate-800 mb-1.5 block">
                        Quick Delay Duration Presets (5 to 60 Minutes)
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[5, 10, 15, 30, 45, 60].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setDelayMinutesInput(m)}
                            className={`text-xs py-1.5 px-2 rounded-lg border font-semibold transition text-center ${
                              delayMinutesInput === m
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            +{m} Mins
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="label text-xs font-semibold text-slate-800">
                        Custom Delay Minutes (5m to 60m)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={delayMinutesInput}
                        onChange={e => setDelayMinutesInput(Math.min(60, Math.max(5, parseInt(e.target.value, 10) || 5)))}
                        className="input text-xs"
                      />
                    </div>

                    <div>
                      <label className="label text-xs font-semibold text-slate-800">
                        Delay Reason (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Client currently in another meeting; asked for 15 min callback"
                        value={delayReason}
                        onChange={e => setDelayReason(e.target.value)}
                        className="input text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setResolvingLead(null)}
                        className="btn btn-ghost btn-sm flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="btn btn-primary btn-sm flex-1 bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white font-bold"
                      >
                        {actionLoading ? <div className="spinner w-4 h-4" /> : <><Timer size={14} /> Snooze for {delayMinutesInput} Mins ⏰</>}
                      </button>
                    </div>
                  </form>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING URGENT ALARM BAR ── */}
      {isOpen && dueLeads.length > 0 && (
        <div
          className="fixed bottom-16 right-4 left-4 sm:left-auto sm:right-6 sm:w-[420px] z-[9000] bg-slate-900 border-2 border-rose-500 rounded-2xl shadow-2xl overflow-hidden animate-slide-up text-white"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-600 to-red-700 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-white text-rose-600 flex items-center justify-center font-bold shrink-0">
                <BellRing size={15} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-extrabold uppercase tracking-wide m-0 text-white truncate">
                  Urgent Follow-Up Alarm ({dueLeads.length})
                </h4>
                <p className="text-[10px] text-rose-100 m-0 font-medium truncate">
                  Ringing every 2 mins until note is recorded
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMuted(m => !m)}
                title={isMuted ? 'Unmute Alarm' : 'Mute Alarm'}
                className="w-7 h-7 rounded-lg bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition"
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize banner"
                className="w-7 h-7 rounded-lg bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition text-base leading-none"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Overdue Leads List */}
          <div className="max-h-72 overflow-y-auto p-3 space-y-2">
            {dueLeads.map(lead => {
              const delaysUsed = lead.activeFollowUp?.delayCount ?? lead.followUpDelayCount ?? 0;

              return (
                <div
                  key={lead._id}
                  className="p-3 bg-slate-800/90 border border-slate-700/80 rounded-xl space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{lead.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded">
                          OVERDUE
                        </span>
                        {delaysUsed > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                            Delay: {delaysUsed}/2
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        +{lead.phone} {lead.company ? `• ${lead.company}` : ''}
                      </div>
                      {lead.followUpNote && (
                        <div className="text-[11px] text-amber-300 bg-amber-950/40 px-2 py-1 rounded border border-amber-800/40 mt-1.5 line-clamp-2">
                          <strong className="text-white font-medium">Agenda:</strong> {lead.followUpNote}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    {lead.phone && lead.phone !== '0000000000' && (
                      <a
                        href={waLink(lead.phone, `Hi ${lead.name}! Reaching out regarding your inquiry.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition"
                      >
                        <MessageSquare size={12} /> WA
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => openResolveModal(lead)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={13} /> Resolve & Silence Alarm
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
