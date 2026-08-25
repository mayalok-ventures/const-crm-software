'use client';
import { useEffect, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter, usePathname } from 'next/navigation';

export default function NotificationPoller() {
  const router = useRouter();
  const pathname = usePathname();
  const lastSeenIdRef = useRef(null);
  const isFetchingRef = useRef(false);
  const timerRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Play synthesized crisp notification tone (D5 then A5 notes) using Web Audio API oscillators
  const playAlertSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // First Note: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);

      // Second Note: A5 (880 Hz) after a short delay
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880.00, ctx.currentTime);
          gain2.gain.setValueAtTime(0.3, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.5);
        } catch {}
      }, 150);

    } catch (e) {
      console.warn('Web Audio playback failed or blocked:', e.message);
    }
  };

  const handleNewNotification = (notification) => {
    if (!notification || !notification._id) return;
    if (lastSeenIdRef.current === notification._id) return;

    lastSeenIdRef.current = notification._id;
    playAlertSound();

    // Native Browser Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notification.title || 'SalesCRM Alert', {
          body: notification.message,
          icon: '/android-chrome-192x192.png'
        });
      } catch {}
    }

    // Interactive Toast
    const isWAReply = notification.type === 'wa_reply';
    toast((t) => (
      <div 
        onClick={() => {
          toast.dismiss(t.id);
          if (notification.leadId) {
            const leadIdStr = typeof notification.leadId === 'object' ? notification.leadId._id : notification.leadId;
            router.push(`/leads/${leadIdStr}`);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: isWAReply ? '#22c55e' : '#6366f1' }}>
          {isWAReply ? '💬 WhatsApp Reply' : (notification.title || '⏰ Reminder')}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{notification.message}</p>
      </div>
    ), { duration: 7000 });
  };

  useEffect(() => {
    const isPublicPage = pathname === '/login' || pathname === '/signup' || pathname === '/privacy' || pathname === '/terms' || pathname === '/data-deletion';
    if (isPublicPage) return;

    let backoffMs = 0;

    const checkNotifications = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token || isFetchingRef.current) return;

      isFetchingRef.current = true;
      try {
        const { data } = await api.get('/notifications');
        backoffMs = 0;
        const notifications = data.notifications || [];
        
        if (notifications.length > 0) {
          const latest = notifications[0];
          
          if (lastSeenIdRef.current && latest._id !== lastSeenIdRef.current) {
            handleNewNotification(latest);
          } else if (!lastSeenIdRef.current) {
            lastSeenIdRef.current = latest._id;
          }
        }
      } catch (err) {
        if (err.response?.status === 429 || err.response?.status >= 500) {
          backoffMs = Math.min((backoffMs || 25000) * 2, 120000);
        }
      } finally {
        isFetchingRef.current = false;
      }
    };

    checkNotifications();

    // Polling timer: 25s when visible + backoff on error
    const poll = () => {
      const delay = 25000 + backoffMs;
      return setTimeout(async () => {
        await checkNotifications();
        timerRef.current = poll();
      }, delay);
    };

    timerRef.current = poll();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [pathname]);

  return null;
}
