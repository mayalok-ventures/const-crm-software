'use client';

import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { DollarSign, ShieldCheck, Tag, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CloseDealModal({
  isOpen,
  onClose,
  lead,
  plans = [],
  onConfirm,
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(lead?.selected_plan_id || '');
  const [closingAmount, setClosingAmount] = useState(lead?.closedDealAmount || lead?.payable_amount || 0);
  const [closingType, setClosingType] = useState('PAID'); // 'PAID' | 'COMPLIMENTARY' | 'CUSTOM_DEAL'
  const [closingReason, setClosingReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Set initial plan if empty
  React.useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0]._id || plans[0].code);
      setClosingAmount(plans[0].priceInPaise ? plans[0].priceInPaise / 100 : (plans[0].price || 0));
    }
  }, [plans, selectedPlanId]);

  const activePlan = useMemo(() => {
    return plans.find((p) => String(p._id) === String(selectedPlanId) || p.code === selectedPlanId);
  }, [plans, selectedPlanId]);

  const handlePlanChange = (planId) => {
    setSelectedPlanId(planId);
    const p = plans.find((pl) => String(pl._id) === String(planId) || pl.code === planId);
    if (p) {
      const price = p.priceInPaise ? p.priceInPaise / 100 : (p.price || 0);
      setClosingAmount(closingType === 'COMPLIMENTARY' ? 0 : price);
    }
  };

  const handleTypeChange = (type) => {
    setClosingType(type);
    if (type === 'COMPLIMENTARY') {
      setClosingAmount(0);
    } else if (activePlan) {
      setClosingAmount(activePlan.priceInPaise ? activePlan.priceInPaise / 100 : (activePlan.price || 0));
    }
  };

  // Real-time Commission Projections
  const commissionPreview = useMemo(() => {
    const amt = Number(closingAmount) || 0;
    const agentComm = (amt * 0.10); // 10% standard rep
    const mgrComm = (amt * 0.05);   // 5% standard manager override
    return { agentComm, mgrComm, totalComm: agentComm + mgrComm };
  }, [closingAmount]);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlanId) {
      toast.error('Plan selection is mandatory to close a deal');
      return;
    }
    if (closingAmount === undefined || isNaN(Number(closingAmount)) || Number(closingAmount) < 0) {
      toast.error('A valid actual closing amount is mandatory');
      return;
    }
    const cleanReason = closingReason.trim();
    if (!cleanReason) {
      toast.error('A closing reason / deal closing note is mandatory');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({
        leadId: lead._id,
        planId: selectedPlanId,
        closingAmount: Number(closingAmount),
        closingType,
        closingReason: cleanReason,
      });
      setClosingReason('');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to close deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Close Lead & Finalize Deal"
      subtitle={`Customer: ${lead.name} (${lead.company || lead.phone})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Deal Closure Guidelines */}
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <span className="font-bold block">Production Closing Contract:</span>
            Closing this lead transitions stage to <strong className="text-white">Payment Done</strong>, records actual sales revenue, and automatically calculates agent/manager commission payouts in the financial ledger.
          </div>
        </div>

        {/* 1. Plan Selection */}
        <div>
          <label className="text-xs font-semibold text-slate-200 block mb-1">
            Sold Subscription Plan <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => handlePlanChange(e.target.value)}
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

        {/* 2. Closing Type */}
        <div>
          <label className="text-xs font-semibold text-slate-200 block mb-1.5">
            Closing Commercial Model
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'PAID', label: 'Standard Paid Deal' },
              { id: 'CUSTOM_DEAL', label: 'Custom Enterprise Deal' },
              { id: 'COMPLIMENTARY', label: 'Free / Complimentary' },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => handleTypeChange(type.id)}
                className={`p-2 rounded-lg text-[11px] font-medium border text-center transition-all ${
                  closingType === type.id
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Actual Closing Amount */}
        <div>
          <label className="text-xs font-semibold text-slate-200 block mb-1">
            Actual Closing Revenue (₹ INR) <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">₹</span>
            <input
              type="number"
              value={closingAmount}
              onChange={(e) => setClosingAmount(Number(e.target.value))}
              disabled={closingType === 'COMPLIMENTARY'}
              required
              min={0}
              placeholder="0"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* 4. Automated Commission Preview */}
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-slate-300">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Automated Commission Preview:
            </span>
            <span className="font-mono text-emerald-400">
              ₹{commissionPreview.totalComm.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            <div>
              Agent ({lead.assignedTo?.name || 'Assigned Rep'}):{' '}
              <strong className="text-white font-mono">₹{commissionPreview.agentComm.toLocaleString('en-IN')}</strong> (10%)
            </div>
            <div>
              Manager ({lead.assignedManager?.name || 'Direct Manager'}):{' '}
              <strong className="text-white font-mono">₹{commissionPreview.mgrComm.toLocaleString('en-IN')}</strong> (5%)
            </div>
          </div>
        </div>

        {/* 5. Closing Reason Note */}
        <div>
          <label className="text-xs font-semibold text-slate-200 block mb-1">
            Closing Reason & Agreement Summary <span className="text-red-400">*</span>
          </label>
          <textarea
            value={closingReason}
            onChange={(e) => setClosingReason(e.target.value)}
            required
            rows={2}
            placeholder="e.g. Paid via Razorpay UPI after final demo; enrolled in annual enterprise bundle..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Action Buttons */}
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
            disabled={submitting || !closingReason.trim()}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-md shadow-emerald-600/20"
          >
            {submitting ? 'Finalizing Closure...' : 'Confirm Deal & Generate Ledger'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
