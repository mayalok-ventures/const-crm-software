'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Save, FileText, Check, GripVertical } from 'lucide-react';
import ErrorState from '../ui/ErrorState';

export default function FormsModule({
  formFields = [],
  loading = false,
  error = null,
  onRetry,
  onSaveSchema,
}) {
  const defaultFields = [
    { label: 'Full Name', name: 'name', type: 'text', isRequired: true, placeholder: 'Enter full name' },
    { label: 'Phone Number', name: 'phone', type: 'phone', isRequired: true, placeholder: 'Enter phone number' },
    { label: 'Email Address', name: 'email', type: 'email', isRequired: false, placeholder: 'Enter email address' },
    { label: 'Company Name', name: 'company', type: 'text', isRequired: false, placeholder: 'Enter company' },
  ];

  const [fields, setFields] = useState(
    Array.isArray(formFields) && formFields.length > 0 ? formFields : defaultFields
  );
  const [newField, setNewField] = useState({ label: '', name: '', type: 'text', isRequired: false, placeholder: '' });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (Array.isArray(formFields) && formFields.length > 0) {
      setFields(formFields);
    }
  }, [formFields]);

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const handleAddField = (e) => {
    e.preventDefault();
    if (!newField.label) return;
    const name = newField.name || newField.label.toLowerCase().replace(/\s+/g, '_');
    setFields((prev) => [...prev, { ...newField, name }]);
    setNewField({ label: '', name: '', type: 'text', isRequired: false, placeholder: '' });
  };

  const handleDeleteField = (idx) => {
    if (fields[idx]?.name === 'name' || fields[idx]?.name === 'phone') return;
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleToggleRequired = (idx) => {
    if (fields[idx]?.name === 'name' || fields[idx]?.name === 'phone') return;
    setFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], isRequired: !next[idx].isRequired };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSaveSchema) {
        await onSaveSchema(fields);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Lead Capture Forms & Schema Centre
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Design dynamic input fields for web forms, landing pages, and manual lead creation
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Form Schema'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Existing Active Fields List */}
        <div className="lg:col-span-2 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Active Form Fields ({fields.length})
          </h4>

          {fields.map((f, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-[#0d1424] border border-slate-800/80 flex items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{f.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                      {f.type}
                    </span>
                    {f.isRequired && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">key: {f.name}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleRequired(idx)}
                  disabled={f.name === 'name' || f.name === 'phone'}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                    f.isRequired
                      ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                      : 'border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.isRequired ? 'Mandatory' : 'Optional'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteField(idx)}
                  disabled={f.name === 'name' || f.name === 'phone'}
                  className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-20 transition-colors"
                  title="Remove Field"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Custom Field Box */}
        <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800/80 shadow-sm h-fit space-y-4">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
            Add Custom Field
          </h4>

          <form onSubmit={handleAddField} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Field Label</label>
              <input
                type="text"
                value={newField.label}
                onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                placeholder="e.g. Budget Range"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Field Type</label>
              <select
                value={newField.type}
                onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="text">Text Input</option>
                <option value="phone">Phone Number</option>
                <option value="email">Email Address</option>
                <option value="number">Numeric</option>
                <option value="dropdown">Dropdown Selection</option>
                <option value="textarea">Multi-line Text</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="reqField"
                checked={newField.isRequired}
                onChange={(e) => setNewField({ ...newField, isRequired: e.target.checked })}
                className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900"
              />
              <label htmlFor="reqField" className="text-xs text-slate-300 cursor-pointer">
                Mark as Mandatory Field
              </label>
            </div>

            <button
              type="submit"
              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Append Field</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
