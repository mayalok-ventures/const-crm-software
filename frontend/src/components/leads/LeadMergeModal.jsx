'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useModalA11y } from '@/lib/useModalA11y';
import {
  X, GitMerge, AlertTriangle, Check, RefreshCw,
  ArrowRight, ShieldAlert, Users, Layers
} from 'lucide-react';

export default function LeadMergeModal({
  isOpen,
  onClose,
  lead,
  onMerged,
}) {
  const { modalRef } = useModalA11y({ isOpen, onClose });
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedSecondaryId, setSelectedSecondaryId] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [merging, setMerging] = useState(false);
  const [fieldChoices, setFieldChoices] = useState({
    name: 'primary',
    email: 'primary',
    phone: 'primary',
    status: 'primary',
  });

  useEffect(() => {
    if (!isOpen || !lead?._id) return;
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        setLoadingCandidates(true);
        setSelectedSecondaryId('');
        setPreviewData(null);
      }
    });

    api.get(`/leads/${lead._id}/duplicate-candidates`)
      .then((res) => {
        if (isMounted) {
          const list = res.data?.candidates || [];
          setCandidates(list);
          if (list.length > 0) {
            setSelectedSecondaryId(list[0]._id);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          toast.error(err.response?.data?.message || 'Failed to check duplicate candidates');
        }
      })
      .finally(() => {
        if (isMounted) setLoadingCandidates(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, lead?._id]);

  // Fetch Dry-Run Preview when secondary lead or fieldChoices change
  useEffect(() => {
    if (!isOpen || !lead?._id || !selectedSecondaryId) {
      Promise.resolve().then(() => setPreviewData(null));
      return;
    }

    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) setLoadingPreview(true);
    });

    api.post('/leads/merge?dryRun=true', {
      primaryLeadId: lead._id,
      secondaryLeadId: selectedSecondaryId,
      fieldChoices,
    })
      .then((res) => {
        if (isMounted && res.data?.success) {
          setPreviewData(res.data.preview || res.data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Dry-run preview warning:', err.response?.data?.message);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingPreview(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, lead?._id, selectedSecondaryId, fieldChoices]);

  const handleFieldChoiceChange = (field, choice) => {
    setFieldChoices(prev => ({ ...prev, [field]: choice }));
  };

  const handleExecuteMerge = async () => {
    if (!selectedSecondaryId || merging) return;
    setMerging(true);
    try {
      const res = await api.post('/leads/merge', {
        primaryLeadId: lead._id,
        secondaryLeadId: selectedSecondaryId,
        fieldChoices,
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Leads merged successfully!');
        if (onMerged) onMerged();
        onClose();
      } else {
        toast.error(res.data?.message || 'Merge failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Server error executing lead merge');
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  const selectedCandidate = candidates.find(c => c._id === selectedSecondaryId);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !merging) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-modal-title"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <GitMerge size={20} />
            </div>
            <div>
              <h2 id="merge-modal-title" className="text-base font-bold text-slate-900">
                Merge Duplicate Leads
              </h2>
              <p className="text-xs text-slate-500">
                Primary: <span className="font-semibold text-slate-800">{lead?.name}</span> ({lead?._id})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={merging}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loadingCandidates && (
            <div className="text-center py-10 text-slate-400">
              <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-500" size={24} />
              <p className="text-xs">Scanning duplicate candidates by phone and email...</p>
            </div>
          )}

          {!loadingCandidates && candidates.length === 0 && (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Users size={36} className="mx-auto text-slate-300" />
              <p className="font-semibold text-sm text-slate-700">No duplicate candidates found</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No matching leads found with identical phone number or email address in this workspace.
              </p>
            </div>
          )}

          {!loadingCandidates && candidates.length > 0 && (
            <>
              {/* Candidate Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Secondary Lead to Merge Into Primary ({candidates.length} candidate{candidates.length > 1 ? 's' : ''})
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {candidates.map((cand) => (
                    <div
                      key={cand._id}
                      onClick={() => setSelectedSecondaryId(cand._id)}
                      className={`p-3 rounded-xl border cursor-pointer text-xs transition flex items-center justify-between ${
                        selectedSecondaryId === cand._id
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <span>{cand.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                            ID: {cand._id.slice(-6)}
                          </span>
                          {cand.matchReason && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                              {cand.matchReason.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[11px] flex gap-3">
                          <span>📞 {cand.phone || 'No phone'}</span>
                          <span>✉️ {cand.email || 'No email'}</span>
                          <span className="capitalize">Stage: {cand.status || 'N/A'}</span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        selectedSecondaryId === cand._id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {selectedSecondaryId === cand._id && <Check size={12} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Field Choice Configuration */}
              {selectedCandidate && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      2. Field Resolution (Select Surviving Values)
                    </span>
                    {loadingPreview && (
                      <span className="text-[10px] text-indigo-600 flex items-center gap-1 font-medium">
                        <RefreshCw size={10} className="animate-spin" /> Recalculating preview...
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    {['name', 'email', 'phone', 'status'].map((field) => {
                      const primVal = lead[field] || '—';
                      const secVal = selectedCandidate[field] || '—';
                      const choice = fieldChoices[field] || 'primary';

                      return (
                        <div key={field} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-4">
                          <span className="capitalize font-semibold text-slate-700 w-16">{field}</span>
                          <div className="flex items-center gap-4 flex-1">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                              <input
                                type="radio"
                                name={`field_${field}`}
                                checked={choice === 'primary'}
                                onChange={() => handleFieldChoiceChange(field, 'primary')}
                                className="text-indigo-600 focus:ring-indigo-500 text-xs"
                              />
                              <span className="truncate max-w-[150px]" title={String(primVal)}>
                                {String(primVal)} <span className="text-[10px] text-slate-400">(Primary)</span>
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                              <input
                                type="radio"
                                name={`field_${field}`}
                                checked={choice === 'secondary'}
                                onChange={() => handleFieldChoiceChange(field, 'secondary')}
                                className="text-indigo-600 focus:ring-indigo-500 text-xs"
                              />
                              <span className="truncate max-w-[150px]" title={String(secVal)}>
                                {String(secVal)} <span className="text-[10px] text-slate-400">(Secondary)</span>
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Repointing & Invariant Safeguards Summary */}
              {previewData && (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-900 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                    <Layers size={14} /> Atomic Merge Safeguards & Child Entity Moves
                  </div>
                  <p className="text-indigo-700 text-[11px]">
                    All child references across Follow-Ups, Payments, Admissions, Chat Messages, Emails, and Recordings will be atomically repointed to Primary Lead.
                  </p>
                  <p className="text-indigo-700 text-[11px]">
                    Secondary lead will be marked merged and soft-deleted. Financial payment records will NEVER be deleted.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={merging}
            className="btn btn-secondary btn-sm px-4 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>

          {candidates.length > 0 && (
            <button
              type="button"
              onClick={handleExecuteMerge}
              disabled={!selectedSecondaryId || merging}
              className="btn btn-primary btn-sm px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {merging ? (
                <>
                  <RefreshCw size={12} className="animate-spin" /> Merging...
                </>
              ) : (
                <>
                  <GitMerge size={12} /> Confirm & Merge Leads
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
