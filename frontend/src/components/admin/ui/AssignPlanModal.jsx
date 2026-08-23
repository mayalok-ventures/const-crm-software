'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import { Gift, ShieldCheck, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssignPlanModal({
  isOpen,
  onClose,
  lead,
  plans = [],
  onConfirm,
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(lead?.selected_plan_id || (plans[0]?._id || ''));
  const [isFree, setIsFree] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !lead) return null;

  const activePlan = plans.find((p) => String(p._id) === String(selectedPlanId) || p.code === selectedPlanId) || plans[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlanId) {
      toast.error('Please select a plan');
      return;
    }
    if (isFree && !reason.trim()) {
      toast.error('A mandatory justification reason is required when granting a free plan.');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({
        leadId: lead._id,
        planId: selectedPlanId,
        isFree,
        reason: reason.trim(),
      });
      setReason('');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to assign plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isFree ? 'Grant Complimentary / Free Plan' : 'Assign Subscription Plan'}
      subtitle={`Customer: ${lead.name} (${lead.phone})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isFree && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
            <Gift className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-bold block">Complimentary Plan Policy:</span>
              Granting a 100% complimentary subscription bypasses payment collection and generates an official Admin Audit report. A valid justification is required.
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-200 block mb-1">
            Select Subscription Plan <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            required
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            {plans.map((p) => (
              <option key={p._id || p.code} value={p._id || p.code}>
                {p.name} — ₹{((p.priceInPaise ? p.priceInPaise / 100 : p.price) || 0).toLocaleString('en-IN')} ({p.industry || 'General'} / {p.interval || 'monthly'})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <input
            type="checkbox"
            id="freePlanToggle"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900 cursor-pointer"
          />
          <label htmlFor="freePlanToggle" className="text-xs text-slate-300 cursor-pointer select-none">
            Grant as Complimentary / 100% Free Plan (Complimentary Access)
          </label>
        </div>

        {isFree && (
          <div>
            <label className="text-xs font-semibold text-slate-200 block mb-1">
              Complimentary Access Justification Note <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={2}
              placeholder="e.g. VIP Strategic partner demo account / Enterprise pilot with 14-day evaluation grace..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || (isFree && !reason.trim())}
            className={`px-4 py-1.5 rounded-lg text-slate-950 font-semibold text-xs transition-colors shadow-sm ${
              isFree ? 'bg-amber-500 hover:bg-amber-400' : 'bg-indigo-500 hover:bg-indigo-400 text-white'
            }`}
          >
            {submitting ? 'Assigning...' : isFree ? 'Grant Free Plan & Log' : 'Assign Plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
