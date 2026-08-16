'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { waLink } from '@/lib/auth';
import { useAlarm } from '@/lib/AlarmContext';
import toast from 'react-hot-toast';
import {
  BellRing, Clock, AlertTriangle, MessageSquare,
  CheckCircle2, X, ChevronRight, Calendar, ArrowRight
} from 'lucide-react';

// ─── Inline base64 WAV chime — works on iOS/Android/Desktop, no file needed ──
// This is a tiny 2-note alert chime (440Hz + 880Hz, 0.4s each, 16-bit PCM WAV)
const CHIME_WAV_B64 = (() => {
  // Build a minimal WAV programmatically using AudioContext if available,
  // or use this tiny pre-encoded chime as a data URI fallback.
  // 440Hz sine wave, 0.5s, mono, 22050Hz sample rate — 22050 samples
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
    // Two-tone arpeggio: 659Hz for first half, 880Hz for second half
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
// Only compute on client
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

  // Register our setter with the global AlarmContext so any page can call dismissAlarm(leadId)
  const { register } = useAlarm();
  useEffect(() => { register(setDueLeads); }, [register]);

  // ─── Audio Chime: Inline WAV (primary) → Web Audio API (fallback) ─────────────
  // The inline WAV approach works on iOS PWA / Android Chrome without user-gesture
  // because it's triggered by the polling interval, not a new user action.
  const playAlarmSound = () => {
    if (isMuted) return;

    // 1st try: inline base64 WAV — most reliable across platforms
    const uri = getChimeUri();
    if (uri) {
      try {
        const audio = new Audio(uri);
        audio.volume = 0.75;
        const p = audio.play();
        if (p !== undefined) {
          p.then(() => {/* success */}).catch(() => playWebAudioBeep());
        }
        return;
      } catch {
        // fall through to WebAudio
      }
    }
    playWebAudioBeep();
  };

  // High-reliability Web Audio API oscillator beep
  const playWebAudioBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Note 1: E5 (659.25 Hz)
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

      // Note 2: G#5 (830.61 Hz)
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(830.61, ctx.currentTime);
          gain2.gain.setValueAtTime(0.4, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.45);
        } catch {}
      }, 180);

      // Note 3: B5 (987.77 Hz)
      setTimeout(() => {
        try {
          const osc3 = ctx.createOscillator();
          const gain3 = ctx.createGain();
          osc3.type = 'sine';
          osc3.frequency.setValueAtTime(987.77, ctx.currentTime);
          gain3.gain.setValueAtTime(0.4, ctx.currentTime);
          gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
          osc3.connect(gain3);
          gain3.connect(ctx.destination);
          osc3.start();
          osc3.stop(ctx.currentTime + 0.55);
        } catch {}
      }, 360);
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
          if (topLead._id) {
            router.push(`/leads/${topLead._id}`);
          }
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
        // 3-minute alarm interval (180,000 ms)
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
    } catch {
      // Ignore network errors during polling
    }
  };

  useEffect(() => {
    // Request notification permissions on user interaction if not yet determined
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      const handleUserClick = () => {
        Notification.requestPermission();
        window.removeEventListener('click', handleUserClick);
      };
      window.addEventListener('click', handleUserClick, { once: true });
    }

    checkDueFollowUps();
    timerRef.current = setInterval(checkDueFollowUps, 45000); // Poll every 45s

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pathname]);

  // Quick Reschedule Action
  const handleReschedule = async (leadId, hoursToAdd) => {
    try {
      const newDate = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
      await api.put(`/leads/${leadId}`, {
        followUpDate: newDate.toISOString(),
      });
      toast.success(`Follow-up postponed by ${hoursToAdd >= 24 ? hoursToAdd / 24 + ' day(s)' : hoursToAdd + ' hour(s)'} ⏰`);
      // Update local state
      setDueLeads(prev => prev.filter(l => l._id !== leadId));
      if (dueLeads.length <= 1) {
        setIsOpen(false);
      }
    } catch {
      toast.error('Failed to reschedule follow-up');
    }
  };

  // Quick Mark Status Action
  const handleUpdateStatus = async (leadId, status) => {
    let closedDealAmount = null;
    if (status === 'closed' || status === 'Closed') {
      const inputAmt = window.prompt("🏆 Enter Final Closed Deal Amount (₹):");
      if (!inputAmt) return;
      closedDealAmount = Number(inputAmt);
      if (!closedDealAmount || isNaN(closedDealAmount) || closedDealAmount <= 0) {
        return toast.error("Deal amount is required to close a lead.");
      }
    }

    try {
      const payload = { status };
      if (closedDealAmount) payload.closedDealAmount = closedDealAmount;
      await api.put(`/leads/${leadId}`, payload);
      toast.success(`Lead marked as ${status} ✅`);
      setDueLeads(prev => prev.filter(l => l._id !== leadId));
      if (dueLeads.length <= 1) {
        setIsOpen(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  if (!isOpen || dueLeads.length === 0) return null;

  return (
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

        <button
          onClick={() => setIsOpen(false)}
          title="Snooze for 5 minutes"
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

      {/* Leads List */}
      <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 16px' }}>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
          These prospect follow-ups are overdue. This reminder will re-alarm every 5 minutes until rescheduled.
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
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/leads/${lead._id}`);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#6366f1',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  Open <ArrowRight size={11} className="flex-shrink-0" />
                </button>
              </div>

              {/* Quick Action Buttons */}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', width: '100%' }}>
                {lead.phone && lead.phone !== '0000000000' && (
                  <a
                    href={waLink(lead.phone, `Hi ${lead.name}! Reaching out regarding your inquiry. Are you available for a quick update?`)}
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
                    <MessageSquare size={11} className="flex-shrink-0" /> WA Chat
                  </a>
                )}

                <button
                  onClick={() => handleReschedule(lead._id, 1)}
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
                  +1 Hour
                </button>

                <button
                  onClick={() => handleReschedule(lead._id, 24)}
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
                  Tomorrow
                </button>

                <button
                  onClick={() => handleUpdateStatus(lead._id, 'closed')}
                  style={{
                    padding: '5px 9px',
                    borderRadius: 6,
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ✓ Closed Won
                </button>
              </div>
            </div>
          ))}

          {dueLeads.length > 3 && (
            <div style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, color: '#94a3b8' }}>
              +{dueLeads.length - 3} more overdue follow-ups waiting
            </div>
          )}
        </div>
      </div>

      {/* Footer / Snooze Notice */}
      <div style={{
        background: '#090d16',
        padding: '10px 16px',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Auto-repeats in 5 mins
        </span>

        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ef4444',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Snooze All (5 mins)
        </button>
      </div>
    </div>
  );
}
