'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Award, TrendingUp, Search, Phone, MessageSquare, RefreshCw,
  DollarSign, CheckCircle2, XCircle, Clock, ChevronRight, Plus,
  FileText, Building2, GraduationCap, ShieldCheck
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';
import { STAGE_LABELS } from '@/components/LeadModals';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsOptions, dealsSummaryOptions } from '@/lib/queries';

export default function DealsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [subTab, setSubTab] = useState('confirmed'); // 'confirmed' | 'seat_locked' | 'pipeline'

  const queryClient = useQueryClient();
  const { data: dealsData, isLoading: isDealsLoading, refetch: refetchDeals } = useQuery(dealsOptions({ limit: 100 }));
  const { data: commissionSummaryData, refetch: refetchSummary } = useQuery(dealsSummaryOptions());

  const deals = Array.isArray(dealsData) ? dealsData : [];
  const commissionSummary = commissionSummaryData || null;
  const loading = isDealsLoading && deals.length === 0;
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submittingDeal, setSubmittingDeal] = useState(false);

  // New Deal Form State
  const [dealForm, setDealForm] = useState({
    studentName: '',
    studentPhone: '',
    studentEmail: '',
    collegeName: '',
    courseName: '',
    quota: 'Merit',
    tuitionValue: '',
    tokenFeePaid: '',
    commissionRate: '10',
    invoiceNumber: '',
  });

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const handleRefresh = useCallback(() => {
    refetchDeals();
    refetchSummary();
  }, [refetchDeals, refetchSummary]);

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    if (!dealForm.studentName || !dealForm.collegeName || !dealForm.courseName) {
      toast.error('Please enter student name, college, and course');
      return;
    }

    setSubmittingDeal(true);
    try {
      const tuition = Number(dealForm.tuitionValue) || 0;
      const rate = Number(dealForm.commissionRate) || 0;
      const expectedAmount = tuition * rate / 100;

      await api.post('/deals', {
        studentName: dealForm.studentName.trim(),
        studentPhone: dealForm.studentPhone.trim(),
        studentEmail: dealForm.studentEmail.trim(),
        collegeName: dealForm.collegeName.trim(),
        courseName: dealForm.courseName.trim(),
        quota: dealForm.quota,
        tuitionValue: tuition,
        tokenFeePaid: Number(dealForm.tokenFeePaid) || 0,
        admissionStatus: 'confirmed',
        commission: {
          ratePercent: rate,
          expectedAmount,
          invoiceNumber: dealForm.invoiceNumber.trim(),
          invoiceStatus: dealForm.invoiceNumber ? 'invoiced' : 'unbilled',
        },
      });

      toast.success('Admission deal recorded successfully! 🎉');
      setShowCreateModal(false);
      setDealForm({
        studentName: '', studentPhone: '', studentEmail: '',
        collegeName: '', courseName: '', quota: 'Merit',
        tuitionValue: '', tokenFeePaid: '', commissionRate: '10', invoiceNumber: ''
      });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record deal');
    } finally {
      setSubmittingDeal(false);
    }
  };

  const confirmedDeals = deals.filter(d => d.admissionStatus === 'confirmed');
  const lockedDeals = deals.filter(d => d.admissionStatus === 'seat_locked');
  const allDeals = deals;

  const activeList = (subTab === 'confirmed' ? confirmedDeals : subTab === 'seat_locked' ? lockedDeals : allDeals)
    .filter(d => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (d.studentName && d.studentName.toLowerCase().includes(q)) ||
        (d.studentPhone && d.studentPhone.includes(q)) ||
        (d.collegeName && d.collegeName.toLowerCase().includes(q)) ||
        (d.courseName && d.courseName.toLowerCase().includes(q))
      );
    });

  const totalTuitionRevenue = commissionSummary?.totalTuition || deals.reduce((sum, d) => sum + (Number(d.tuitionValue) || 0), 0);
  const totalExpectedCommission = commissionSummary?.totalExpectedCommission || deals.reduce((sum, d) => sum + (Number(d.commission?.expectedAmount) || 0), 0);
  const totalReceivedCommission = commissionSummary?.totalReceivedCommission || deals.reduce((sum, d) => sum + (Number(d.commission?.receivedAmount) || 0), 0);
  const outstandingCommission = Math.max(0, totalExpectedCommission - totalReceivedCommission);

  return (
    <div className="app-container">
      <BottomNav active="deals" />

      <main className="main-content" data-crm-canvas="true">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5">
                <Award size={24} className="text-emerald-600 shrink-0" /> Admissions & Deals Ledger
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Track confirmed admissions, university quota bookings, tuition contracts, and commission invoices.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-100 bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus size={16} />
                <span>Record Admission</span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                className="btn btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
                title="Refresh Deals"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Financial KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mb-5 deals-kpi-grid">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase block truncate">Tuition Volume</span>
              <h2 className="text-base sm:text-xl font-extrabold m-0 mt-1 text-slate-900 truncate">
                ₹{totalTuitionRevenue.toLocaleString('en-IN')}
              </h2>
              <span className="text-[10px] text-slate-400 mt-0.5 block truncate">{confirmedDeals.length} Confirmed Seats</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase block truncate">Expected Commission</span>
              <h2 className="text-base sm:text-xl font-extrabold m-0 mt-1 text-indigo-600 truncate">
                ₹{totalExpectedCommission.toLocaleString('en-IN')}
              </h2>
              <span className="text-[10px] text-indigo-500 mt-0.5 block truncate">University Payouts</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase block truncate">Received Commission</span>
              <h2 className="text-base sm:text-xl font-extrabold m-0 mt-1 text-emerald-600 truncate">
                ₹{totalReceivedCommission.toLocaleString('en-IN')}
              </h2>
              <span className="text-[10px] text-emerald-600 mt-0.5 block truncate">Settled to Bank</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase block truncate">Outstanding</span>
              <h2 className="text-base sm:text-xl font-extrabold m-0 mt-1 text-amber-600 truncate">
                ₹{outstandingCommission.toLocaleString('en-IN')}
              </h2>
              <span className="text-[10px] text-amber-600 mt-0.5 block truncate">Pending Invoices</span>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSubTab('confirmed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap shrink-0 ${
                subTab === 'confirmed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 size={14} /> Confirmed ({confirmedDeals.length})
            </button>

            <button
              type="button"
              onClick={() => setSubTab('seat_locked')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap shrink-0 ${
                subTab === 'seat_locked'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Clock size={14} /> Seat Locked ({lockedDeals.length})
            </button>

            <button
              type="button"
              onClick={() => setSubTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap shrink-0 ${
                subTab === 'all'
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>All Deals ({deals.length})</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              className="input input-search w-full text-xs sm:text-sm pl-10 pr-9 h-10 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              placeholder="Search candidate, college, course..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Deals Listing */}
          {loading && deals.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-500" size={24} />
              <p className="text-xs">Loading admission deals...</p>
            </div>
          ) : activeList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
              <Award size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
              <h3 className="text-sm font-bold text-slate-800 m-0">No Admission Deals in this View</h3>
              <p className="text-xs text-slate-400 m-0 mt-1">
                Record a confirmed candidate admission or advance leads in your pipeline.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary text-xs mt-3 inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> Record First Deal
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeList.map(deal => (
                <div
                  key={deal._id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-indigo-200 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0 mt-0.5">
                      <GraduationCap size={20} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm">{deal.studentName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                          {deal.admissionStatus}
                        </span>
                        {deal.quota && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {deal.quota} Quota
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                        <Building2 size={13} className="text-slate-400" />
                        <span>{deal.collegeName}</span> • <span className="text-indigo-600">{deal.courseName}</span>
                      </div>

                      {deal.studentPhone && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Phone size={11} /> {deal.studentPhone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial & Commission Status */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 justify-between md:justify-end">
                    <div className="text-left md:text-right min-w-[120px]">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Tuition / Commission</span>
                      <span className="text-xs font-bold text-slate-900">₹{(deal.tuitionValue || 0).toLocaleString('en-IN')}</span>
                      <span className="text-[11px] text-indigo-600 block font-semibold">
                        Est. ₹{(deal.commission?.expectedAmount || 0).toLocaleString('en-IN')} ({deal.commission?.ratePercent || 10}%)
                      </span>
                    </div>

                    <div className="text-left md:text-right pl-2 border-l border-slate-100 min-w-[90px]">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Payout Status</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5 ${
                        deal.commission?.payoutStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : deal.commission?.invoiceStatus === 'invoiced'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {deal.commission?.payoutStatus === 'paid' ? 'Paid' : deal.commission?.invoiceStatus === 'invoiced' ? 'Invoiced' : 'Unbilled'}
                      </span>
                      {deal.commission?.invoiceNumber && (
                        <span className="text-[10px] text-slate-400 block font-mono">Inv #{deal.commission.invoiceNumber}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Record Admission Deal Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl animate-fade-in border border-slate-100 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                    <Award size={18} className="text-emerald-600" />
                    Record Confirmed Admission Deal
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateDeal} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Student Name *</label>
                      <input
                        type="text"
                        value={dealForm.studentName}
                        onChange={e => setDealForm({ ...dealForm, studentName: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="input w-full text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={dealForm.studentPhone}
                        onChange={e => setDealForm({ ...dealForm, studentPhone: e.target.value })}
                        placeholder="e.g. 9876543210"
                        className="input w-full text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">College / University *</label>
                      <input
                        type="text"
                        value={dealForm.collegeName}
                        onChange={e => setDealForm({ ...dealForm, collegeName: e.target.value })}
                        placeholder="e.g. Manipal Institute of Technology"
                        className="input w-full text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Course / Branch *</label>
                      <input
                        type="text"
                        value={dealForm.courseName}
                        onChange={e => setDealForm({ ...dealForm, courseName: e.target.value })}
                        placeholder="e.g. B.Tech Computer Science"
                        className="input w-full text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Seat Quota</label>
                      <select
                        value={dealForm.quota}
                        onChange={e => setDealForm({ ...dealForm, quota: e.target.value })}
                        className="input w-full text-xs"
                      >
                        <option value="Merit">Merit Quota</option>
                        <option value="Management">Management Quota</option>
                        <option value="NRI">NRI Quota</option>
                        <option value="State">State Quota</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Total Tuition (₹)</label>
                      <input
                        type="number"
                        value={dealForm.tuitionValue}
                        onChange={e => setDealForm({ ...dealForm, tuitionValue: e.target.value })}
                        placeholder="e.g. 450000"
                        className="input w-full text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Commission %</label>
                      <input
                        type="number"
                        value={dealForm.commissionRate}
                        onChange={e => setDealForm({ ...dealForm, commissionRate: e.target.value })}
                        placeholder="10"
                        className="input w-full text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Token Fee Paid (₹)</label>
                      <input
                        type="number"
                        value={dealForm.tokenFeePaid}
                        onChange={e => setDealForm({ ...dealForm, tokenFeePaid: e.target.value })}
                        placeholder="e.g. 50000"
                        className="input w-full text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Invoice Number (Optional)</label>
                      <input
                        type="text"
                        value={dealForm.invoiceNumber}
                        onChange={e => setDealForm({ ...dealForm, invoiceNumber: e.target.value })}
                        placeholder="e.g. INV-2026-081"
                        className="input w-full text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                    <p className="m-0">
                      Admission deals separate student confirmation from university commission billing and payout reconciliation.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="btn btn-secondary text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingDeal}
                      className="btn btn-primary text-xs px-4 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {submittingDeal ? 'Recording...' : 'Record Deal'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
