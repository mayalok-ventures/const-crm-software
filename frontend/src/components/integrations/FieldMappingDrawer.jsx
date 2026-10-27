'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  Sliders, Plus, Trash2, Check, ArrowRight, Eye, Sparkles, HelpCircle, RefreshCw
} from 'lucide-react';

const STANDARD_CRM_FIELDS = [
  { value: 'name', label: 'Full Name' },
  { value: 'phone', label: 'Phone / WhatsApp' },
  { value: 'email', label: 'Email Address' },
  { value: 'course', label: 'Target Course / Interest' },
  { value: 'city', label: 'Target City / Location' },
  { value: 'custom', label: 'Custom Question / Answer' },
];

export default function FieldMappingDrawer({ integration, isOpen = true, onClose, onSaveSuccess, onSaved }) {
  const [mappings, setMappings] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (integration) {
      setMappings(Array.isArray(integration.fieldMapping) ? [...integration.fieldMapping] : []);
    }
  }, [integration]);

  if (isOpen === false || !integration) return null;

  const handleAddRule = () => {
    setMappings([
      ...mappings,
      {
        sourceField: '',
        crmField: 'custom',
        displayLabel: '',
        isCustom: true,
        showOnProfile: true,
      },
    ]);
  };

  const handleRemoveRule = (index) => {
    const updated = [...mappings];
    updated.splice(index, 1);
    setMappings(updated);
  };

  const handleChange = (index, key, value) => {
    const updated = [...mappings];
    updated[index][key] = value;
    if (key === 'crmField') {
      updated[index].isCustom = value === 'custom';
    }
    setMappings(updated);
  };

  const handleSave = async () => {
    // Validate empty source fields
    const invalid = mappings.some(m => !m.sourceField.trim());
    if (invalid) {
      toast.error('All mapping rules must have a source field name');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/integrations/${integration._id}`, {
        fieldMapping: mappings,
      });
      toast.success('Field mappings updated successfully!');
      if (onSaveSuccess) onSaveSuccess();
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save field mappings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full p-6 sm:p-8 flex flex-col justify-between overflow-y-auto text-white shadow-2xl">

        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Custom Field Mapping</h3>
                <p className="text-xs text-slate-400">
                  {integration.accountName} ({integration.provider?.toUpperCase()})
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">✕</button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Data Loss Guarantee:</strong> Any fields not explicitly mapped to Name, Phone, or Email are automatically saved as <strong>Custom Answers</strong> on the lead profile. They will never be dropped!
            </span>
          </div>

          {/* Mapping Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Field Translation Rules ({mappings.length})
              </h4>
              <button
                type="button"
                onClick={handleAddRule}
                className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Mapping
              </button>
            </div>

            {mappings.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                No custom mappings defined. Standard synonym auto-matching is active for Full Name, Phone, Email, City, and Course.
              </div>
            ) : (
              <div className="space-y-2.5">
                {mappings.map((m, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      value={m.sourceField}
                      onChange={(e) => handleChange(idx, 'sourceField', e.target.value)}
                      placeholder="e.g. Student_Mobile"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                    <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                    <select
                      value={m.crmField}
                      onChange={(e) => handleChange(idx, 'crmField', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                      {STANDARD_CRM_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(idx)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* "Where Will This Data Go?" Interactive Preview (Part 3) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-400" /> Where will this data go? (Lead Profile Preview)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-semibold">Standard Contact Block:</span>
                <p className="text-slate-300">
                  Mapped to <span className="text-emerald-400 font-mono">Lead Name, Phone, Email</span>.
                </p>
                <p className="text-slate-500 text-[11px]">Enables 1-click WhatsApp messaging and calls.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-semibold">Form Answers Block:</span>
                <p className="text-slate-300">
                  Custom fields land in <span className="text-blue-400 font-mono">Custom Questions & Answers</span>.
                </p>
                <p className="text-slate-500 text-[11px]">Visible prominently in the lead detail view.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
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
            className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-500/20"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Mappings
          </button>
        </div>

      </div>
    </div>
  );
}
