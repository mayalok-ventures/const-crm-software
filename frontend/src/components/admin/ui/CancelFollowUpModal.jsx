'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import { AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CancelFollowUpModal({
  isOpen,
  onClose,
  lead,
  onConfirm,
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      toast.error('A mandatory justification reason is required to cancel or disable this follow-up.');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(lead._id, cleanReason);
      setReason('');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel / Disable Active Follow-Up"
      subtitle={`Lead: ${lead.name} (${lead.phone})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-bold block">Business Rule Mandatory Requirement:</span>
            Cancelling an active follow-up silences the scheduled alert and records an official audit entry. You must provide a clear reason for cancellation.
          </div>
        </div>

        {lead.followUpDate && (
          <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Scheduled Time:</span>
            <span className="font-mono text-white font-medium">{new Date(lead.followUpDate).toLocaleString()}</span>
            {lead.followUpNote && (
              <div className="mt-1 text-slate-400 italic">
                Agenda: "{lead.followUpNote}"
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-200 block mb-1">
            Cancellation Justification Note <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            placeholder="e.g. Lead requested contact next quarter after budget approval / Client unresponsive after 3 attempts..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Keep Follow-Up
          </button>
          <button
            type="submit"
            disabled={submitting || !reason.trim()}
            className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm shadow-red-600/20"
          >
            {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
