'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { waLink } from '@/lib/auth';
import { useAlarm } from '@/lib/AlarmContext';
import toast from 'react-hot-toast';
import {
  BellRing, Clock, AlertTriangle, MessageSquare,
  CheckCircle2, X, ChevronRight, Calendar, ArrowRight, CheckCircle, VolumeX, Volume2
} from 'lucide-react';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';

// ─── Inline base64 WAV chime — works on iOS/Android/Desktop, no file needed ──
const CHIME_WAV_B64 = (() => {
  const sampleRate = 22050;
  const duration = 0.5;
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
    const freq = t < 0.25 ? 659 : 880;
    const envelope = Math.min(1, (t < 0.05 ? t / 0.05 : 1) * (t > 0.4 ? (0.5 - t) / 0.1 : 1));
    const sample = Math.round(envelope * 0.6 * 32767 * Math.sin(2 * Math.PI * freq * t));
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
  const timerRef = useRef(null);

  // Dedicated single smooth modal state
  const [resolvingLead, setResolvingLead] = useState(null);
  const [outcomeNote, setOutcomeNote] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [resolvingLoading, setResolvingLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Register setter with global AlarmContext
  const { register } = useAlarm();
  useEffect(() => { register(setDueLeads); }, [register]);

  const playAlarmSound = () => {
    if (isMuted) return;

    const uri = getChimeUri();
    if (uri) {
      try {
        const audio = new Audio(uri);
        audio.volume = 0.75;
        const p = audio.play();
        if (p !== undefined) {
          p.then(() => {}).catch(() => playWebAudioBeep());
        }
        return;
      } catch {}
    }
    playWebAudioBeep();
  };

  const playWebAudioBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.4, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);
    } catch (err) {
      console.warn('[FollowUpAlert] WebAudio beep error:', err);
    }
  };

  const triggerBrowserNotification = (leads) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
      return;
    }

    if (Notification.permission === 'granted' && leads.length > 0) {
      const topLead = leads[0];
      const count = leads.length;
      const title = count === 1 ? `⏰ Follow-up Due: ${topLead.name}` : `⏰ ${count} Leads Due for Follow-up!`;
      const body = count === 1
        ? `Phone: ${topLead.phone} • Requirement: ${topLead.project || topLead.budget || 'Pending call'}`
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
        console.warn('[FollowUpNotification] Native notification failed:', err);
      }
    }
  };

  const checkDueFollowUps = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const isAuthPage = pathname === '/login' || pathname === '/signup';
    if (!token || isAuthPage) return;

    try {
      const { data } = await api.get('/leads/follow-ups/due');
      const leads = Array.isArray(data) ? data : [];
      setDueLeads(leads);

      if (leads.length > 0) {
        const now = Date.now();
        const threeMinutes = 3 * 60 * 1000;
        if (now - lastAlarmTimeRef.current >= threeMinutes) {
          lastAlarmTimeRef.current = now;
          playAlarmSound();
          triggerBrowserNotification(leads);
          setIsOpen(true);
        }
      } else {
        setIsOpen(false);
      }
    } catch {}
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      const handleUserClick = () => {
        Notification.requestPermission();
        window.removeEventListener('click', handleUserClick);
      };
      window.addEventListener('click', handleUserClick, { once: true });
    }

    checkDueFollowUps();
    timerRef.current = setInterval(checkDueFollowUps, 45000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pathname]);

  // Open single smooth modal & instantly silence alarm
  const openResolveModal = (lead) => {
    setIsMuted(true);
    setResolvingLead(lead);
    setOutcomeNote('');
    setNextFollowUpDate('');
    setModalError('');
  };

  const handleSaveResolve = async (e) => {
    e.preventDefault();
    if (!outcomeNote || !outcomeNote.trim()) {
      setModalError('Mandatory: An outcome note is required to resolve this follow-up.');
      return;
    }

    setResolvingLoading(true);
    setModalError('');
    try {
      const leadId = resolvingLead._id;
      const cleanNote = outcomeNote.trim();

      // 1. Post note (Appends to lead.notes and creates ActivityLog entry with timestamp)
      await api.post(`/leads/${leadId}/notes`, {
        text: `[Follow-Up Completed]: ${cleanNote}`,
      });

      // 2. Reschedule next follow-up if provided, or mark notified
      if (nextFollowUpDate) {
        const isoNextDate = fromLocalDatetimeStringToISO(nextFollowUpDate);
        await api.put(`/leads/${leadId}`, {
          followUpDate: isoNextDate,
          followUpNotified: false,
        });
      } else {
        await api.put(`/leads/${leadId}`, {
          followUpNotified: true,
        });
      }

      toast.success('Follow-up resolved and activity note recorded ✅');
      setDueLeads(prev => prev.filter(l => l._id !== leadId));
      setResolvingLead(null);
      if (dueLeads.length <= 1) {
        setIsOpen(false);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to resolve follow-up');
    } finally {
      setResolvingLoading(false);
    }
  };

  // Quick Reschedule Action
  const handleQuickReschedule = async (leadId, hoursToAdd) => {
    try {
      const newDate = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
      const isoDate = newDate.toISOString();
      await api.put(`/leads/${leadId}`, {
        followUpDate: isoDate,
        followUpNotified: false,
      });
      await api.post(`/leads/${leadId}/notes`, {
        text: `📅 Follow-up postponed by ${hoursToAdd >= 24 ? hoursToAdd / 24 + ' day(s)' : hoursToAdd + ' hour(s)'} to ${formatDisplayDateTime(isoDate)}`,
      });
      toast.success(`Follow-up postponed by ${hoursToAdd >= 24 ? hoursToAdd / 24 + ' day(s)' : hoursToAdd + ' hour(s)'} ⏰`);
      setDueLeads(prev => prev.filter(l => l._id !== leadId));
      if (dueLeads.length <= 1) {
        setIsOpen(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reschedule follow-up');
    }
  };

  return (
    <>
      {/* ── ALARM OVERLAY MODAL (Single Smooth Modal for Silence & Mandatory Note) ── */}
      {resolvingLead && (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setResolvingLead(null)}
        >
          <div
            className="bg-[#0b1120] border border-emerald-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Resolve Follow-Up & Silence Alarm
              </h3>
              <button
                onClick={() => setResolvingLead(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Prospect: <strong className="text-white">{resolvingLead.name}</strong> ({resolvingLead.phone})
            </p>

            {modalError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mandatory Outcome Note (Visible to Org Admins) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Call connected with decision maker. Client agreed to review quote; follow-up scheduled."
                  value={outcomeNote}
                  onChange={(e) => setOutcomeNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Optional Next Follow-Up Section */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    Schedule Next Follow-Up (Optional)
                  </label>
                  {nextFollowUpDate && (
                    <button
                      type="button"
                      onClick={() => setNextFollowUpDate('')}
                      className="text-[10px] text-slate-400 hover:text-rose-400"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick Presets */}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: '+24h', hours: 24 },
                    { label: '+48h', hours: 48 },
                    { label: '+3 Days', hours: 72 },
                    { label: '+1 Week', hours: 168 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        const target = new Date(Date.now() + p.hours * 60 * 60 * 1000);
                        setNextFollowUpDate(toLocalDatetimeString(target));
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input
                  type="datetime-local"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingLead(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolvingLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
                >
                  {resolvingLoading ? 'Saving...' : 'Save Note & Silence Alarm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FLOATING ALERT BAR ── */}
      {isOpen && dueLeads.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 74,
          right: 16,
          left: 16,
          zIndex: 9000,
          maxWidth: 420,
          margin: '0 auto',
          background: '#0f172a',
          borderRadius: 16,
          border: '2px solid #ef4444',
          boxShadow: '0 20px 40px -10px rgba(239, 68, 68, 0.4), 0 0 0 1px rgba(239, 68, 68, 0.2)',
          color: '#f8fafc',
          overflow: 'hidden',
          animation: 'slideUp 0.3s ease-out'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minWidth: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                flexShrink: 0,
              }}>
                <BellRing size={14} className="animate-pulse" />
              </div>
              <span className="truncate" style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 0 }}>
                Follow-Up Due Alert ({dueLeads.length})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setIsMuted(m => !m)}
                title={isMuted ? 'Unmute alarm' : 'Mute alarm sound'}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: 'none',
                  color: 'white',
                  borderRadius: 6,
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Snooze alert"
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: 'none',
                  color: 'white',
                  borderRadius: 6,
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Leads List */}
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 16px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
              These prospect follow-ups are overdue. Click <strong>Note & Resolve</strong> to record outcome and silence alarm.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dueLeads.slice(0, 3).map(lead => (
                <div
                  key={lead._id}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 12,
                    padding: '12px 14px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, width: '100%', minWidth: 0, marginBottom: 6 }}>
                    <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                      <h4 className="truncate" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                        {lead.name}
                      </h4>
                      <div className="truncate" style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
                        <span className="truncate">+{lead.phone}</span>
                        {lead.company && <span className="truncate">• {lead.company}</span>}
                        {lead.followUpDate && <span className="text-amber-400 font-semibold truncate">• Due: {formatDisplayDateTime(lead.followUpDate)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', width: '100%' }}>
                    {lead.phone && lead.phone !== '0000000000' && (
                      <a
                        href={waLink(lead.phone, `Hi ${lead.name}! Reaching out regarding your inquiry.`)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 9px',
                          borderRadius: 6,
                          background: 'rgba(34, 197, 94, 0.15)',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          color: '#22c55e',
                          textDecoration: 'none',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        <MessageSquare size={11} className="flex-shrink-0" /> WA
                      </a>
                    )}

                    <button
                      onClick={() => handleQuickReschedule(lead._id, 24)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: 6,
                        background: '#334155',
                        border: '1px solid #475569',
                        color: '#f8fafc',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      +24h
                    </button>

                    <button
                      onClick={() => openResolveModal(lead)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        background: 'rgba(34, 197, 94, 0.25)',
                        border: '1px solid rgba(34, 197, 94, 0.5)',
                        color: '#4ade80',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      ✓ Note & Silence Alarm
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
