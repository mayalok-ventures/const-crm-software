'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Bell, Phone, Check, ArrowRight, X, Clock, AlertTriangle, Sparkles, MessageCircle, ExternalLink } from 'lucide-react';
import api, { cachedGet } from '@/lib/api';
import { getUser } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function MobileTopHeader() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dueFollowUps, setDueFollowUps] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  // Fetch unread count & due follow-ups periodically
  const fetchAlerts = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;

      const [notifRes, followUpRes] = await Promise.all([
        cachedGet('/notifications/unread-count', { ttl: 15000, silentAuth: true, _isBackground: true }).catch(() => ({ data: { unreadCount: 0 } })),
        cachedGet('/leads/follow-ups/due', { ttl: 15000, silentAuth: true, _isBackground: true }).catch(() => ({ data: [] })),
      ]);

      const count = notifRes.data?.unreadCount || 0;
      const dueList = Array.isArray(followUpRes.data) ? followUpRes.data.slice(0, 5) : [];
      setUnreadCount(count + dueList.length);
      setDueFollowUps(dueList);
    } catch {
      // Handled silently
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close drawer on click outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setShowDrawer(false);
      }
    };
    if (showDrawer) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [showDrawer]);

  const handleCompleteFollowUp = async (leadId) => {
    try {
      await api.patch(`/leads/${leadId}`, {
        followUpStatus: 'completed',
        followUpNotified: true,
      });
      toast.success('Follow-up marked as completed! 🎯');
      setDueFollowUps(prev => prev.filter(f => f._id !== leadId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      toast.error('Failed to update follow-up');
    }
  };

  return (
    <>
      {/* ── STICKY MOBILE TOP BAR ────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 w-full h-[52px] bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3.5 flex items-center justify-between shadow-2xs">
        {/* Brand & Workspace Identity */}
        <Link href="/dashboard" className="flex items-center gap-2.5 text-decoration-none min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs overflow-hidden shrink-0">
            <Image
              src="/logo.png"
              alt="Logo"
              width={20}
              height={20}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-extrabold text-slate-900 leading-tight truncate">
              Sahyak CRM
            </span>
            <span className="text-[10px] font-medium text-slate-500 truncate leading-tight">
              {user?.companyInfo?.companyName || user?.name || 'Workspace'}
            </span>
          </div>
        </Link>

        {/* Action Controls: Notification Bell */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDrawer(prev => !prev)}
            aria-label="Open Alerts"
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition"
          >
            <Bell size={19} className="stroke-[2.2]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── QUICK ALERTS POPUP / DRAWER ──────────────────────────────── */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-950/60 backdrop-blur-xs flex flex-col justify-start p-3 pt-14 animate-fade-in">
          <div
            ref={drawerRef}
            className="w-full max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slide-down"
          >
            {/* Drawer Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold text-xs">
                  ⏰
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 m-0">Urgent Follow-Up Alarms</h4>
                  <p className="text-[10px] text-slate-500 m-0">1-Tap calls & student outreach</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X size={15} />
              </button>
            </div>

            {/* List of Due Follow-Ups */}
            <div className="p-3 overflow-y-auto space-y-2.5 flex-1">
              {dueFollowUps.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 text-sm">
                    ✓
                  </div>
                  <p className="text-xs font-bold text-slate-700 m-0">All Follow-ups Cleared!</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">No overdue calls pending right now.</p>
                </div>
              ) : (
                dueFollowUps.map(lead => (
                  <div
                    key={lead._id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 block">
                          {lead.name || 'Candidate'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          +{lead.phone || 'No phone'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-extrabold uppercase">
                        Due Now
                      </span>
                    </div>

                    {lead.followUpNote && (
                      <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60 m-0 line-clamp-2">
                        💬 {lead.followUpNote}
                      </p>
                    )}

                    {/* 1-Tap Quick Actions (Lazy user optimization) */}
                    <div className="pt-1 flex items-center gap-2">
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          onClick={() => setShowDrawer(false)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs hover:bg-emerald-700 transition"
                        >
                          <Phone size={12} /> Call Now
                        </a>
                      )}

                      {lead.phone && (
                        <Link
                          href={`/whatsapp`}
                          onClick={() => setShowDrawer(false)}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition"
                          title="Open WhatsApp"
                        >
                          <MessageCircle size={15} />
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCompleteFollowUp(lead._id)}
                        className="py-1.5 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-50 transition flex items-center gap-1"
                      >
                        <Check size={12} className="text-emerald-600" /> Done
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Global Link */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/notifications"
                onClick={() => setShowDrawer(false)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Open Full Notification Center <ArrowRight size={13} />
              </Link>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
