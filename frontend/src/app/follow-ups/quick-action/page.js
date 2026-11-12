'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  CheckCircle2, Clock, Calendar, AlertCircle, ArrowRight,
  ShieldCheck, Loader2, Sparkles, MessageSquare, ExternalLink
} from 'lucide-react';
import Link from 'next/link';

function QuickActionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token');
  const initialAction = searchParams.get('action') || 'complete';
  const initialDelay = parseInt(searchParams.get('delayMinutes') || '15', 10);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Form State
  const [action, setAction] = useState(initialAction); // 'complete' | 'snooze' | 'reschedule'
  const [note, setNote] = useState('');
  const [delayMinutes, setDelayMinutes] = useState(initialDelay);
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing quick-action authentication token. Please open from a notification or check link.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    api.get(`/leads/follow-ups/quick-action/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!isMounted) return;
        setData(res.data);
        if (res.data.action && ['complete', 'snooze', 'reschedule'].includes(res.data.action)) {
          setAction(res.data.action);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg = err.response?.data?.message || err.message || 'Token verification failed';
        setError(msg);
        setLoading(false);
      });

    return () => { isMounted = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const cleanNote = note.trim();
    if (!cleanNote) {
      setSubmitError('A mandatory outcome note is required to complete, snooze, or reschedule.');
      return;
    }

    if (action === 'reschedule') {
      if (!scheduledAt) {
        setSubmitError('Please select a valid future date and time.');
        return;
      }
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        setSubmitError('Rescheduled time must be in the future.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        token,
        action,
        note: cleanNote,
        delayMinutes,
        scheduledAt: action === 'reschedule' ? new Date(scheduledAt).toISOString() : undefined,
        idempotencyKey: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };

      await api.post('/leads/follow-ups/quick-action', payload);
      setCompleted(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to execute quick action';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-300">Verifying notification security token...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Action Expired or Already Completed</h2>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition"
            >
              Open CRM Dashboard <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Follow-Up Successfully Recorded</h2>
            <p className="text-xs text-slate-300 mt-1">
              Alarm permanently silenced and candidate notes have been updated.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            {data?.lead?._id && (
              <Link
                href={`/leads/${data.lead._id}`}
                className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition"
              >
                View Full Lead Profile <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            )}
            <Link
              href="/follow-ups"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition"
            >
              Return to Follow-Ups List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lead = data?.lead;
  const followUp = data?.followUp;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Quick Action Resolution</h1>
              <p className="text-[11px] text-slate-400">Mobile Push Follow-Up Response</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Secure Token
          </span>
        </div>

        {/* Lead & Follow-Up Card */}
        <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-800 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white text-sm">{lead?.name || 'Candidate'}</span>
            {lead?.phone && <span className="text-slate-400 text-[11px] font-mono">{lead.phone}</span>}
          </div>
          <div className="text-slate-400 flex items-center gap-1.5 pt-0.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate italic">"{followUp?.note || 'Follow-up call'}"</span>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Choose Action
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
            {[
              { id: 'complete', label: 'Done', icon: CheckCircle2 },
              { id: 'snooze', label: 'Snooze', icon: Clock },
              { id: 'reschedule', label: 'Reschedule', icon: Calendar },
            ].map((btn) => {
              const Icon = btn.icon;
              const active = action === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setAction(btn.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conditional Sub-Inputs */}
        {action === 'snooze' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 block">Snooze Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDelayMinutes(mins)}
                  className={`py-1.5 text-xs font-semibold rounded-xl border transition ${
                    delayMinutes === mins
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {mins === 60 ? '1 hour' : `${mins} mins`}
                </button>
              ))}
            </div>
          </div>
        )}

        {action === 'reschedule' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 block">New Date &amp; Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
        )}

        {/* Mandatory Note */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Mandatory Outcome Note <span className="text-rose-400">*</span></span>
              <span className="text-[10px] text-slate-400">Required by policy</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                action === 'complete'
                  ? 'E.g., Call completed. Candidate interested in CS program.'
                  : action === 'snooze'
                  ? 'E.g., Candidate in a meeting, asked to call back in 15 mins.'
                  : 'E.g., Candidate requested reschedule to Saturday morning.'
              }
              className="w-full p-3 text-xs rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              required
            />
          </div>

          {submitError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Recording Note &amp; Stopping Alarm...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Submit Outcome &amp; Silence Alarm</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function QuickActionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      }
    >
      <QuickActionContent />
    </Suspense>
  );
}
