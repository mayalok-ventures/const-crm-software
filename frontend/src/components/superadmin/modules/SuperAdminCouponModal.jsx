'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Ticket,
  Percent,
  DollarSign,
  Calendar,
  Layers,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import api from '@/lib/api';

export default function SuperAdminCouponModal({
  isOpen = false,
  onClose = () => {},
  couponToEdit = null,
  onSuccess = () => {},
}) {
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form State
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('PERCENTAGE'); // 'PERCENTAGE' | 'FLAT'
  const [discountValue, setDiscountValue] = useState(20);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [targetType, setTargetType] = useState('ALL'); // 'ALL' | 'INDIVIDUAL' | 'ORGANIZATION' | 'SPECIFIC'
  const [selectedPlanIds, setSelectedPlanIds] = useState([]);
  const [isUnlimitedOverall, setIsUnlimitedOverall] = useState(true);
  const [maxOverallUses, setMaxOverallUses] = useState(100);
  const [maxUsesPerUser, setMaxUsesPerUser] = useState(1);
  const [status, setStatus] = useState('ACTIVE');

  // Load available plans for targeting
  useEffect(() => {
    if (!isOpen) return;
    setLoadingPlans(true);
    api.get('/plans')
      .then(res => {
        const all = res.data?.plans?.all || [
          ...(res.data?.plans?.individual || []),
          ...(res.data?.plans?.organization || []),
        ];
        setPlans(all);
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, [isOpen]);

  // Populate or reset form
  useEffect(() => {
    if (couponToEdit) {
      setCode(couponToEdit.code || '');
      setDescription(couponToEdit.description || '');
      setDiscountType(couponToEdit.discountType || 'PERCENTAGE');
      setDiscountValue(couponToEdit.discountValue || 0);
      setMaxDiscountAmount(couponToEdit.maxDiscountAmount ? String(couponToEdit.maxDiscountAmount) : '');
      setMinOrderValue(couponToEdit.minOrderValue ? String(couponToEdit.minOrderValue) : '');
      
      if (couponToEdit.validFrom) {
        setValidFrom(new Date(couponToEdit.validFrom).toISOString().slice(0, 16));
      } else {
        setValidFrom(new Date().toISOString().slice(0, 16));
      }

      if (couponToEdit.validUntil) {
        setValidUntil(new Date(couponToEdit.validUntil).toISOString().slice(0, 16));
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setValidUntil(d.toISOString().slice(0, 16));
      }

      if (couponToEdit.appliesToAllPlans) {
        setTargetType('ALL');
      } else if (couponToEdit.applicableCategories?.includes('INDIVIDUAL') && couponToEdit.applicableCategories?.length === 1) {
        setTargetType('INDIVIDUAL');
      } else if (couponToEdit.applicableCategories?.includes('ORGANIZATION') && couponToEdit.applicableCategories?.length === 1) {
        setTargetType('ORGANIZATION');
      } else {
        setTargetType('SPECIFIC');
        setSelectedPlanIds(couponToEdit.applicablePlans || []);
      }

      if (couponToEdit.maxOverallUses === null || couponToEdit.maxOverallUses === -1 || couponToEdit.maxOverallUses === undefined) {
        setIsUnlimitedOverall(true);
        setMaxOverallUses(100);
      } else {
        setIsUnlimitedOverall(false);
        setMaxOverallUses(couponToEdit.maxOverallUses);
      }

      setMaxUsesPerUser(couponToEdit.maxUsesPerUser || 1);
      setStatus(couponToEdit.status || 'ACTIVE');
    } else {
      setCode('');
      setDescription('');
      setDiscountType('PERCENTAGE');
      setDiscountValue(20);
      setMaxDiscountAmount('');
      setMinOrderValue('');
      setValidFrom(new Date().toISOString().slice(0, 16));
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      setValidUntil(nextMonth.toISOString().slice(0, 16));
      setTargetType('ALL');
      setSelectedPlanIds([]);
      setIsUnlimitedOverall(true);
      setMaxOverallUses(100);
      setMaxUsesPerUser(1);
      setStatus('ACTIVE');
    }
    setErrorMsg(null);
  }, [couponToEdit, isOpen]);

  if (!isOpen) return null;

  const handleTogglePlanSelection = (planId) => {
    setSelectedPlanIds(prev =>
      prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode) {
      setErrorMsg('Coupon code is required');
      return;
    }

    if (!validUntil) {
      setErrorMsg('Expiration date is required');
      return;
    }

    const payload = {
      code: cleanCode,
      description: description.trim(),
      discountType,
      discountValue: Number(discountValue),
      currency: 'INR',
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      minOrderValue: minOrderValue ? Number(minOrderValue) : 0,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: new Date(validUntil),
      appliesToAllPlans: targetType === 'ALL',
      applicableCategories: targetType === 'INDIVIDUAL' ? ['INDIVIDUAL'] : targetType === 'ORGANIZATION' ? ['ORGANIZATION'] : [],
      applicablePlans: targetType === 'SPECIFIC' ? selectedPlanIds : ['ALL'],
      maxOverallUses: isUnlimitedOverall ? -1 : Number(maxOverallUses),
      maxUsesPerUser: Number(maxUsesPerUser) || 1,
      status,
    };

    try {
      setIsSubmitting(true);
      let res;
      if (couponToEdit?._id) {
        res = await api.put(`/api/super-admin/coupons/${couponToEdit._id}`, payload);
      } else {
        res = await api.post('/api/super-admin/coupons', payload);
      }

      if (res.data?.success) {
        onSuccess(res.data.coupon);
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Failed to save coupon');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Server error saving coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0b101b] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1424]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {couponToEdit ? `Edit Coupon: ${couponToEdit.code}` : 'Create Promotional Coupon'}
              </h2>
              <p className="text-xs text-slate-400">Configure promotional discount rules, plan targets, and usage limits.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Row 1: Code & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Coupon Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. FESTIVE30"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-white text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE (Ready to redeem)</option>
                <option value="INACTIVE">INACTIVE (Paused)</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          </div>

          {/* Row 2: Description */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Special 30% discount for solo sales agents"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Row 3: Discount Engine */}
          <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Percent className="w-4 h-4" />
              <span>Discount Engine & Pricing Rules</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Type</label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENTAGE')}
                    className={`py-1 text-xs font-bold rounded ${discountType === 'PERCENTAGE' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}
                  >
                    % Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('FLAT')}
                    className={`py-1 text-xs font-bold rounded ${discountType === 'FLAT' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}
                  >
                    ₹ Flat
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  {discountType === 'PERCENTAGE' ? 'Discount %' : 'Flat Discount (₹)'}
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  min="1"
                  max={discountType === 'PERCENTAGE' ? '100' : '100000'}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Max Cap (₹, Optional)
                </label>
                <input
                  type="number"
                  value={maxDiscountAmount}
                  onChange={e => setMaxDiscountAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Minimum Order Value (₹, Optional)
              </label>
              <input
                type="number"
                value={minOrderValue}
                onChange={e => setMinOrderValue(e.target.value)}
                placeholder="e.g. 999 (0 for no minimum)"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 4: Plan Applicability */}
          <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Target Plan Applicability</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'ALL', label: 'All Plans' },
                { id: 'INDIVIDUAL', label: 'Solo / Solo Reps' },
                { id: 'ORGANIZATION', label: 'Agency / Org' },
                { id: 'SPECIFIC', label: 'Specific Plans' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetType(t.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    targetType === t.id
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500'
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {targetType === 'SPECIFIC' && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[11px] text-slate-400 block font-medium">Select applicable commercial plans:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                  {plans.map(p => {
                    const planId = p._id || p.id || p.code;
                    const isChecked = selectedPlanIds.includes(planId) || selectedPlanIds.includes(p.slug) || selectedPlanIds.includes(p.code);
                    return (
                      <label
                        key={planId}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked ? 'bg-indigo-950/40 border-indigo-500/60 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePlanSelection(planId)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase ml-auto">{p.category || p.accountType}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Row 5: Validity Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Valid From</span>
              </label>
              <input
                type="datetime-local"
                value={validFrom}
                onChange={e => setValidFrom(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>Valid Until (Expiry) <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="datetime-local"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Row 6: Usage Limits */}
          <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Usage Limits & Quotas</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Total Overall Uses
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-amber-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnlimitedOverall}
                      onChange={e => setIsUnlimitedOverall(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Unlimited</span>
                  </label>
                </div>
                <input
                  type="number"
                  value={isUnlimitedOverall ? '' : maxOverallUses}
                  onChange={e => setMaxOverallUses(e.target.value)}
                  disabled={isUnlimitedOverall}
                  placeholder={isUnlimitedOverall ? 'Unlimited redemptions' : 'e.g. 100'}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-white font-mono text-sm focus:border-amber-500 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Max Uses Per Customer
                </label>
                <input
                  type="number"
                  value={maxUsesPerUser}
                  onChange={e => setMaxUsesPerUser(e.target.value)}
                  min="1"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Coupon...' : (couponToEdit ? 'Update Coupon' : 'Create & Publish Coupon')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
