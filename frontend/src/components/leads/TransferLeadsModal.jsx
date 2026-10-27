'use client';

import { useState, useMemo } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X,
  ArrowRightLeft,
  Users,
  Target,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  UserCheck,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { STAGE_LABELS } from '@/components/LeadModals';

export default function TransferLeadsModal({
  isOpen,
  onClose,
  selectedCount = 0,
  selectedLeadIds = [],
  selectAllFiltered = false,
  filterQuery = {},
  members = [],
  campaigns = [],
  onTransferred,
}) {
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [targetCampaignId, setTargetCampaignId] = useState('');
  const [applyCampaignAssignmentRule, setApplyCampaignAssignmentRule] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sanitize and filter members
  const validMembers = useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.filter((m) => Boolean(m && typeof m === 'object'));
  }, [members]);

  // Filter members by search input
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return validMembers;
    const q = memberSearch.toLowerCase().trim();
    return validMembers.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q)
    );
  }, [validMembers, memberSearch]);

  // Selected member object
  const selectedMember = useMemo(() => {
    if (!assignedToUserId) return null;
    return validMembers.find((m) => {
      const id = String(m.userId?._id || m.userId || m._id || m.id || '');
      return id && id === String(assignedToUserId);
    });
  }, [validMembers, assignedToUserId]);

  // Selected campaign object
  const selectedCampaign = useMemo(() => {
    if (!targetCampaignId) return null;
    return campaigns.find((c) => String(c._id || c.id) === String(targetCampaignId));
  }, [campaigns, targetCampaignId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!assignedToUserId && !targetCampaignId && !newStage) {
      toast.error('Please select at least one transfer target: a Counselor/Manager, Campaign, or Stage.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        leadIds: selectedLeadIds,
        transferAllFiltered: Boolean(selectAllFiltered),
        filterQuery: selectAllFiltered ? filterQuery : undefined,
        assignedToUserId: assignedToUserId || undefined,
        targetCampaignId: targetCampaignId || undefined,
        applyCampaignAssignmentRule,
        newStage: newStage || undefined,
        transferNote: transferNote.trim() || undefined,
      };

      const res = await api.post('/leads/transfer', payload);

      if (res.data?.success) {
        toast.success(res.data.message || `Successfully transferred ${res.data.count || selectedCount} leads.`);
        onTransferred?.();
        onClose();
      } else {
        toast.error(res.data?.message || 'Transfer failed');
      }
    } catch (err) {
      console.error('Transfer leads error:', err);
      toast.error(err?.response?.data?.message || 'Failed to transfer leads');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto animate-scale-up">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
              <ArrowRightLeft size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span>Transfer Candidate Leads</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-indigo-100 text-indigo-700">
                  {selectAllFiltered ? `All Filtered (${selectedCount})` : `${selectedCount} Selected`}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Reallocate candidate ownership, campaign tracking, or pipeline stage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-3.5 sm:p-6 max-h-[calc(100dvh-130px)] sm:max-h-[70vh] overflow-y-auto space-y-4 sm:space-y-5">
            {/* Target 1: Reassign to Counselor or Manager */}
            <div className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-2.5 sm:space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Users size={15} className="text-indigo-600" />
                  1. Assign to Counselor or Manager
                </label>
                {assignedToUserId && (
                  <button
                    type="button"
                    onClick={() => setAssignedToUserId('')}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {/* Search Member */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search counselor or manager by name or role..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Members Selection List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {filteredMembers.map((m, idx) => {
                  const mId = String(m.userId?._id || m.userId || m._id || m.id || '');
                  const uniqueKey = m._id ? `membership-${m._id}` : (m.userId ? `user-${m.userId?._id || m.userId}` : `member-${idx}`);
                  const isSelected = assignedToUserId && String(assignedToUserId) === mId;
                  const roleName = m.role || m.companyRole || 'Counsellor';

                  return (
                    <button
                      key={uniqueKey}
                      type="button"
                      onClick={() => setAssignedToUserId(isSelected ? '' : mId)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/30'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold truncate">{m.name || m.email}</div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {roleName} • {m.email}
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target 2: Transfer to Campaign */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Target size={15} className="text-amber-500" />
                  2. Transfer to Marketing Campaign
                </label>
                {targetCampaignId && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetCampaignId('');
                      setApplyCampaignAssignmentRule(false);
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <select
                value={targetCampaignId}
                onChange={(e) => setTargetCampaignId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Do Not Change Campaign --</option>
                {campaigns.map((camp, idx) => {
                  const campKey = camp._id || camp.id || `camp-${idx}`;
                  const campVal = camp._id || camp.id;
                  return (
                    <option key={campKey} value={campVal}>
                      {camp.displayName || camp.name} ({camp.platform?.toUpperCase() || 'MULTI'})
                    </option>
                  );
                })}
              </select>

              {/* Option to apply Campaign's authoritative rule if no member explicitly selected */}
              {targetCampaignId && !assignedToUserId && (
                <label className="flex items-start gap-2.5 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyCampaignAssignmentRule}
                    onChange={(e) => setApplyCampaignAssignmentRule(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-bold">Apply Campaign Assignment Rules</span>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Automatically rotates these leads across this campaign&apos;s configured counselor pool or dedicated counselor.
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* Target 3: Move Pipeline Stage (Optional) */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers size={15} className="text-emerald-600" />
                3. Update Pipeline Stage (Optional)
              </label>

              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Keep Current Stages --</option>
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Transfer Note / Audit Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Audit Reason / Notes (Recorded in Lead History)
              </label>
              <input
                type="text"
                placeholder='e.g., "Reallocated from Meta Form X for urgent counselor follow-up"'
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 gap-2 border-t border-slate-100 bg-slate-50/70">
            <button
              type="button"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || (!assignedToUserId && !targetCampaignId && !newStage)}
              className="px-4 sm:px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting && <div className="spinner w-3.5 h-3.5 border-2 border-white/30 border-t-white" />}
              <span>Transfer {selectedCount} Lead{selectedCount === 1 ? '' : 's'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
