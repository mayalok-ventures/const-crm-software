'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  CreditCard, Plus, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, DollarSign, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { hasPermission } from '@/lib/auth';

const STATUS_BADGES = {
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partially_paid: 'bg-blue-100 text-blue-800 border-blue-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  overdue: 'bg-rose-100 text-rose-800 border-rose-200 font-bold animate-pulse',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function FeeInstallmentsCard({
  leadId,
  user,
}) {
  const [installments, setInstallments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // New installment form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newGraceDays, setNewGraceDays] = useState('0');
  const [savingInstallment, setSavingInstallment] = useState(false);

  // Quick Pay Modal State
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [paying, setPaying] = useState(false);

  const canEdit = user && (
    hasPermission(user, 'deals.create') ||
    hasPermission(user, 'deals.edit')
  );

  const fetchInstallments = () => {
    if (!leadId) return;
    setLoading(true);
    api.get(`/leads/${leadId}/installments`)
      .then((res) => {
        if (res.data?.success) {
          setInstallments(res.data.installments || []);
          setSummary(res.data.summary || null);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch installments:', err.response?.data?.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInstallments();
  }, [leadId]);

  const handleCreateInstallment = async (e) => {
    e.preventDefault();
    if (!newAmount || Number(newAmount) <= 0) {
      toast.error('Please enter a valid installment amount');
      return;
    }
    if (!newDueDate) {
      toast.error('Due date is required');
      return;
    }

    setSavingInstallment(true);
    try {
      const res = await api.post(`/leads/${leadId}/installments`, {
        installments: [
          {
            title: newTitle.trim() || `Installment #${installments.length + 1}`,
            amount: Number(newAmount),
            dueDate: newDueDate,
            gracePeriodDays: Number(newGraceDays) || 0,
          },
        ],
      });

      if (res.data?.success) {
        toast.success('Installment scheduled successfully');
        setShowAddForm(false);
        setNewTitle('');
        setNewAmount('');
        setNewDueDate('');
        setNewGraceDays('0');
        fetchInstallments();
      } else {
        toast.error(res.data?.message || 'Failed to schedule installment');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Server error scheduling installment');
    } finally {
      setSavingInstallment(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payTarget) return;

    const amt = Number(payAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setPaying(true);
    try {
      const res = await api.post(`/leads/${leadId}/installments/${payTarget._id}/pay`, {
        amount: amt,
        paymentMethod: payMethod,
      });

      if (res.data?.success) {
        toast.success(`Payment of ₹${amt.toLocaleString('en-IN')} recorded!`);
        setPayTarget(null);
        fetchInstallments();
      } else {
        toast.error(res.data?.message || 'Failed to record payment');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Server error recording payment');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-4">
      {/* Header */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <CreditCard size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Fee Installments & Collection Schedule</span>
              {summary && summary.totalOverdue > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold border border-rose-200">
                  Overdue: ₹{summary.totalOverdue.toLocaleString('en-IN')}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Track course fee tranches, due dates, grace periods, and receipts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn-secondary btn-xs font-semibold px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1 transition"
            >
              <Plus size={12} /> Schedule Tranche
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
            aria-label="Toggle card"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Summary Metric Ribbon */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Fee</span>
                <p className="text-sm font-bold text-slate-800">₹{summary.totalFee?.toLocaleString('en-IN') || 0}</p>
              </div>
              <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-600">Collected</span>
                <p className="text-sm font-bold text-emerald-700">₹{summary.totalPaid?.toLocaleString('en-IN') || 0}</p>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-amber-600">Pending</span>
                <p className="text-sm font-bold text-amber-700">₹{summary.totalPending?.toLocaleString('en-IN') || 0}</p>
              </div>
              <div className={`p-2.5 rounded-xl border ${summary.totalOverdue > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                <span className={`text-[10px] uppercase font-bold ${summary.totalOverdue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Overdue</span>
                <p className={`text-sm font-bold ${summary.totalOverdue > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                  ₹{summary.totalOverdue?.toLocaleString('en-IN') || 0}
                </p>
              </div>
            </div>
          )}

          {/* Inline Form to Add Installment */}
          {showAddForm && (
            <form onSubmit={handleCreateInstallment} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
              <span className="text-xs font-bold text-indigo-900 block">Schedule New Fee Installment</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">Tranche Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Admission Term 1"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">Amount (₹) *</label>
                  <input
                    type="number"
                    placeholder="50000"
                    min="1"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">Grace Days</label>
                  <input
                    type="number"
                    min="0"
                    value={newGraceDays}
                    onChange={(e) => setNewGraceDays(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-secondary btn-xs text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInstallment}
                  className="btn btn-primary btn-xs text-xs bg-indigo-600 text-white font-bold px-3"
                >
                  {savingInstallment ? 'Scheduling...' : 'Save Installment'}
                </button>
              </div>
            </form>
          )}

          {/* Installments Listing */}
          {loading && (
            <div className="text-center py-6 text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw size={14} className="animate-spin text-indigo-600" />
              <span>Loading fee schedule...</span>
            </div>
          )}

          {!loading && installments.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs">
              <CreditCard size={28} className="mx-auto mb-1.5 opacity-40" />
              No fee installments scheduled yet for this student.
            </div>
          )}

          {!loading && installments.length > 0 && (
            <div className="space-y-2">
              {installments.map((inst) => {
                const badgeClass = STATUS_BADGES[inst.status] || STATUS_BADGES.pending;
                const formattedDueDate = inst.dueDate ? format(new Date(inst.dueDate), 'dd MMM yyyy') : '—';
                const remaining = Math.max(0, (inst.amount || 0) - (inst.paidAmount || 0));

                return (
                  <div
                    key={inst._id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/40 flex items-center justify-between text-xs gap-3 hover:bg-slate-50 transition"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          #{inst.installmentNumber}: {inst.title}
                        </span>
                        <span className={`text-[10px] px-2 py-0.2 rounded-full border capitalize ${badgeClass}`}>
                          {inst.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>Due: {formattedDueDate}</span>
                        {inst.gracePeriodDays > 0 && (
                          <span>Grace: +{inst.gracePeriodDays}d</span>
                        )}
                        <span>Paid: ₹{(inst.paidAmount || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        ₹{inst.amount?.toLocaleString('en-IN')}
                      </span>

                      {canEdit && inst.status !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayTarget(inst);
                            setPayAmount(String(remaining));
                          }}
                          className="btn btn-xs btn-primary bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-lg text-xs"
                        >
                          Record Pay
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Pay Modal */}
          {payTarget && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-bold text-sm text-slate-900">
                    Record Installment Payment
                  </h4>
                  <button
                    type="button"
                    onClick={() => setPayTarget(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-xs space-y-1 text-slate-600">
                  <p>Tranche: <strong>{payTarget.title}</strong></p>
                  <p>Total Installment: <strong>₹{payTarget.amount?.toLocaleString('en-IN')}</strong></p>
                </div>

                <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Received Amount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="bank_transfer">Bank Transfer / NEFT</option>
                      <option value="upi">UPI / QR Code</option>
                      <option value="card">Credit / Debit Card</option>
                      <option value="cash">Cash Counter</option>
                      <option value="cheque">Demand Draft / Cheque</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPayTarget(null)}
                      className="btn btn-secondary btn-xs text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={paying}
                      className="btn btn-primary btn-xs text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3"
                    >
                      {paying ? 'Recording...' : 'Confirm Payment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
