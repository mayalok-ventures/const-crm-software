'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  Users, Check, RefreshCw, Sliders, Shield, AlertCircle
} from 'lucide-react';

export default function AssignmentDrawer({ integration, isOpen = true, onClose, onSaveSuccess, onSaved, members = [] }) {
  const [ruleType, setRuleType] = useState('round_robin');
  const [specificCounselorId, setSpecificCounselorId] = useState('');
  const [fallbackUserId, setFallbackUserId] = useState('');
  const [skipInactive, setSkipInactive] = useState(true);
  const [counselorPool, setCounselorPool] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (integration?.assignmentRule) {
      const rule = integration.assignmentRule;
      setRuleType(rule.type || 'round_robin');
      setSpecificCounselorId(rule.specificCounselorId || '');
      setFallbackUserId(rule.fallbackUserId || '');
      setSkipInactive(rule.skipInactive !== false);
      setCounselorPool(Array.isArray(rule.counselorPool) ? rule.counselorPool : []);
    }
  }, [integration]);

  if (isOpen === false || !integration) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/integrations/${integration._id}`, {
        assignmentRule: {
          type: ruleType,
          specificCounselorId: specificCounselorId || null,
          fallbackUserId: fallbackUserId || null,
          skipInactive,
          counselorPool,
        },
      });
      toast.success('Assignment rule updated successfully!');
      if (onSaveSuccess) onSaveSuccess();
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update assignment rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full p-6 sm:p-8 flex flex-col justify-between overflow-y-auto text-white shadow-2xl">

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Team Assignment Rule</h3>
                <p className="text-xs text-slate-400">{integration.accountName} ({integration.provider?.toUpperCase()})</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">✕</button>
          </div>

          {/* Rule Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Distribution Strategy
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'round_robin', title: 'Round Robin', desc: 'Cycles incoming leads evenly across active counselors.' },
                { id: 'specific_counselor', title: 'Dedicated Counselor', desc: 'Routes all leads from this connection to a specific user.' },
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setRuleType(opt.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    ruleType === opt.id
                      ? 'bg-purple-500/10 border-purple-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-white">{opt.title}</span>
                    {ruleType === opt.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {ruleType === 'specific_counselor' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Primary Counselor</label>
              <select
                value={specificCounselorId}
                onChange={(e) => setSpecificCounselorId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="">Select counselor...</option>
                {members.map(m => (
                  <option key={m._id} value={m._id}>{m.name || m.email} ({m.role})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Fallback Assignee</label>
            <select
              value={fallbackUserId}
              onChange={(e) => setFallbackUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="">Select fallback admin or owner...</option>
              {members.map(m => (
                <option key={m._id} value={m._id}>{m.name || m.email}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">If the assigned counselor is deleted, disabled, or over capacity, leads fall back to this user.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <label className="flex items-center gap-3 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={skipInactive}
                onChange={(e) => setSkipInactive(e.target.checked)}
                className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
              />
              <span className="text-slate-200 font-medium">Skip inactive/suspended team members automatically</span>
            </label>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4 mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-purple-500/20"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Assignment Rule
          </button>
        </div>

      </div>
    </div>
  );
}
