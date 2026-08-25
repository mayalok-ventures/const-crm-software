'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  FileText,
  Check,
  GripVertical,
  Eye,
  EyeOff,
  Settings2,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Package,
  UserPlus,
  Sliders,
  HelpCircle,
  X,
  CheckCircle2,
} from 'lucide-react';
import ErrorState from '../ui/ErrorState';
import DynamicFormRenderer from '@/components/common/DynamicFormRenderer';

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input', icon: 'Aa' },
  { value: 'textarea', label: 'Multi-line Textarea', icon: '¶' },
  { value: 'number', label: 'Number / Quantity', icon: '#' },
  { value: 'email', label: 'Email Address', icon: '@' },
  { value: 'phone', label: 'Phone Number', icon: '📞' },
  { value: 'date', label: 'Date Picker', icon: '📅' },
  { value: 'datetime', label: 'Date & Time', icon: '🕒' },
  { value: 'select', label: 'Select (Dropdown)', icon: '▼' },
  { value: 'multiselect', label: 'Multi-Select Tags', icon: '☑' },
  { value: 'radio', label: 'Radio Choices', icon: '◉' },
  { value: 'checkbox', label: 'Single Checkbox', icon: '✓' },
  { value: 'currency', label: 'Currency (₹)', icon: '₹' },
  { value: 'percentage', label: 'Percentage (%)', icon: '%' },
  { value: 'url', label: 'Website / URL', icon: '🔗' },
];

const OPERATORS = [
  { value: '=', label: 'Equals (=)' },
  { value: '!=', label: 'Not Equals (!=)' },
  { value: '>', label: 'Greater Than (>)' },
  { value: '>=', label: 'Greater Than / Equal (>=)' },
  { value: '<', label: 'Less Than (<)' },
  { value: '<=', label: 'Less Than / Equal (<=)' },
  { value: 'contains', label: 'Contains' },
  { value: 'not contains', label: 'Does Not Contain' },
  { value: 'is empty', label: 'Is Empty' },
  { value: 'is not empty', label: 'Is Not Empty' },
  { value: 'in', label: 'In (Comma-separated)' },
  { value: 'not in', label: 'Not In' },
];

const DEFAULT_LEAD_FIELDS = [
  { fieldId: 'name', label: 'Full Name', fieldType: 'text', isRequired: true, isSystem: true, isHidden: false, order: 1 },
  { fieldId: 'phone', label: 'Phone Number', fieldType: 'phone', isRequired: true, isSystem: true, isHidden: false, order: 2 },
  { fieldId: 'email', label: 'Email Address', fieldType: 'email', isRequired: false, isSystem: true, isHidden: false, order: 3 },
  { fieldId: 'company', label: 'Company Name', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 4 },
  { fieldId: 'budget', label: 'Budget Range', fieldType: 'currency', isRequired: false, isSystem: true, isHidden: false, order: 5 },
  { fieldId: 'location', label: 'Location Preference', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 6 },
  { fieldId: 'followUpDate', label: 'Next Follow-up Date', fieldType: 'date', isRequired: false, isSystem: true, isHidden: false, order: 7 },
];

const DEFAULT_PRODUCT_FIELDS = [
  { fieldId: 'name', label: 'Package / Product Name', fieldType: 'text', isRequired: true, isSystem: true, isHidden: false, order: 1 },
  { fieldId: 'location', label: 'Market / Region / Location', fieldType: 'text', isRequired: true, isSystem: true, isHidden: false, order: 2 },
  { fieldId: 'city', label: 'City / Territory', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 3 },
  { fieldId: 'vendorOrBrand', label: 'Vendor / Brand / Provider', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 4 },
  { fieldId: 'basePrice', label: 'Base Pricing / Rate', fieldType: 'currency', isRequired: false, isSystem: true, isHidden: false, order: 5 },
  { fieldId: 'productCategory', label: 'Tiers / Variant Categories', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 6 },
  { fieldId: 'amenities', label: 'Key Features & Inclusions', fieldType: 'textarea', isRequired: false, isSystem: true, isHidden: false, order: 7 },
  {
    fieldId: 'status',
    label: 'Catalog Status',
    fieldType: 'select',
    options: ['available', 'in_development', 'upcoming', 'sold_out', 'archived'],
    isRequired: false,
    isSystem: true,
    isHidden: false,
    order: 8,
  },
  { fieldId: 'deliveryOrCompletionDate', label: 'Delivery / Completion Timeline', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 9 },
  { fieldId: 'description', label: 'Detailed Scope & Description', fieldType: 'textarea', isRequired: false, isSystem: true, isHidden: false, order: 10 },
];

export default function FormsModule({
  formFields = [],
  loading = false,
  error = null,
  onRetry,
  onSaveSchema,
}) {
  const [formType, setFormType] = useState('lead'); // 'lead' | 'product'
  const [leadFields, setLeadFields] = useState(DEFAULT_LEAD_FIELDS);
  const [productFields, setProductFields] = useState(DEFAULT_PRODUCT_FIELDS);
  const [activeEditingField, setActiveEditingField] = useState(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewValues, setPreviewValues] = useState({});

  // Sync incoming schema
  useEffect(() => {
    if (Array.isArray(formFields) && formFields.length > 0) {
      setLeadFields(formFields);
    }
  }, [formFields]);

  // Load product schema if switching tabs
  useEffect(() => {
    async function loadProductSchema() {
      if (formType === 'product') {
        try {
          const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE}/auth/form-schema?type=product`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.schema && Array.isArray(data.schema) && data.schema.length > 0) {
            setProductFields(data.schema);
          }
        } catch (e) {}
      }
    }
    loadProductSchema();
  }, [formType]);

  const activeFields = formType === 'lead' ? leadFields : productFields;
  const setActiveFields = (updater) => {
    if (formType === 'lead') {
      setLeadFields(updater);
    } else {
      setProductFields(updater);
    }
  };

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const handleToggleHide = (idx) => {
    const field = activeFields[idx];
    if (formType === 'lead' && (field.fieldId === 'name' || field.fieldId === 'phone')) return;
    if (formType === 'product' && (field.fieldId === 'name' || field.fieldId === 'location')) return;

    setActiveFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], isHidden: !next[idx].isHidden };
      return next;
    });
  };

  const handleToggleRequired = (idx) => {
    const field = activeFields[idx];
    if (formType === 'lead' && (field.fieldId === 'name' || field.fieldId === 'phone')) return;
    if (formType === 'product' && (field.fieldId === 'name' || field.fieldId === 'location')) return;

    setActiveFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], isRequired: !next[idx].isRequired };
      return next;
    });
  };

  const handleMoveOrder = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= activeFields.length) return;

    setActiveFields((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next.map((f, i) => ({ ...f, order: i + 1 }));
    });
  };

  const handleDeleteField = (idx) => {
    const field = activeFields[idx];
    if (field.isSystem) return;
    setActiveFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleOpenAddModal = () => {
    setActiveEditingField({
      fieldId: '',
      label: '',
      fieldType: 'text',
      placeholder: '',
      helpText: '',
      defaultValue: '',
      isRequired: false,
      isSystem: false,
      isHidden: false,
      order: activeFields.length + 1,
      options: [],
      conditionalRules: { combinator: 'AND', rules: [] },
      conditionalRequiredRules: { combinator: 'AND', rules: [] },
      validationRules: {},
    });
    setShowFieldModal(true);
  };

  const handleOpenEditModal = (field) => {
    setActiveEditingField({
      ...field,
      options: Array.isArray(field.options) ? [...field.options] : [],
      conditionalRules: field.conditionalRules || { combinator: 'AND', rules: [] },
      conditionalRequiredRules: field.conditionalRequiredRules || { combinator: 'AND', rules: [] },
      validationRules: field.validationRules || {},
    });
    setShowFieldModal(true);
  };

  const handleSaveFieldFromModal = (fieldData) => {
    const key = fieldData.fieldId || fieldData.label.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const preparedField = {
      ...fieldData,
      fieldId: key,
    };

    setActiveFields((prev) => {
      const existsIndex = prev.findIndex((f) => f.fieldId === preparedField.fieldId);
      if (existsIndex > -1) {
        const next = [...prev];
        next[existsIndex] = preparedField;
        return next;
      }
      return [...prev, preparedField];
    });

    setShowFieldModal(false);
    setActiveEditingField(null);
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');

      const res = await fetch(`${API_BASE}/auth/form-schema?type=${formType}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          formType,
          schema: activeFields,
          fields: activeFields,
        }),
      });
      const data = await res.json();
      if (data.success && onSaveSchema) {
        onSaveSchema(activeFields, formType);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs Navigation */}
      <div className="p-4 rounded-2xl bg-[#0b1120] border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Forms & Custom Fields Builder
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                Dynamic Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize input fields, add custom attributes, and configure real-time conditional logic
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Form Switcher */}
          <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setFormType('lead')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                formType === 'lead'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Prospect Lead Form</span>
            </button>
            <button
              type="button"
              onClick={() => setFormType('product')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                formType === 'product'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Product / Package Form</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Schema...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Builder on Left + Live Form Preview on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Field Configuration (7 Cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>{formType === 'lead' ? 'Prospect Lead Form Fields' : 'Product / Package Fields'}</span>
              <span className="text-slate-500 font-mono">({activeFields.length})</span>
            </h4>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Field</span>
            </button>
          </div>

          {/* Field Items List */}
          <div className="space-y-2.5">
            {activeFields.map((field, idx) => {
              const isMandatorySystem =
                formType === 'lead'
                  ? ['name', 'phone'].includes(field.fieldId)
                  : ['name', 'location'].includes(field.fieldId);

              const hasConditional =
                (field.conditionalRules?.rules?.length || 0) > 0 || Boolean(field.dependsOn?.field);

              return (
                <div
                  key={field.fieldId || idx}
                  className={`p-3.5 rounded-xl bg-[#0b1120] border transition-all ${
                    field.isHidden
                      ? 'border-slate-800/60 opacity-60 bg-slate-950/40'
                      : 'border-slate-800 hover:border-slate-700 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Order Controls */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-slate-500 hover:text-white disabled:opacity-20"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(idx, 1)}
                          disabled={idx === activeFields.length - 1}
                          className="p-1 text-slate-500 hover:text-white disabled:opacity-20"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-xs truncate">{field.label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono border border-slate-700">
                            {field.fieldType || 'text'}
                          </span>
                          {field.isRequired && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                              Required
                            </span>
                          )}
                          {hasConditional && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                              ⚡ Conditional
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>key: {field.fieldId}</span>
                          {field.helpText && <span>• {field.helpText}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Toggle Visibility */}
                      <button
                        type="button"
                        onClick={() => handleToggleHide(idx)}
                        disabled={isMandatorySystem}
                        className={`p-1.5 rounded-lg border text-xs transition-colors ${
                          field.isHidden
                            ? 'border-slate-800 text-slate-500 hover:text-slate-300'
                            : 'border-slate-700 text-slate-300 hover:text-white bg-slate-900'
                        }`}
                        title={field.isHidden ? 'Show Field' : 'Hide Field'}
                      >
                        {field.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>

                      {/* Toggle Required */}
                      <button
                        type="button"
                        onClick={() => handleToggleRequired(idx)}
                        disabled={isMandatorySystem}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                          field.isRequired
                            ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                            : 'border-slate-700 text-slate-400 hover:text-white bg-slate-900'
                        }`}
                      >
                        {field.isRequired ? 'Mandatory' : 'Optional'}
                      </button>

                      {/* Edit Field Details */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(field)}
                        className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-amber-400 bg-slate-900 transition-colors"
                        title="Configure Logic & Options"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Custom Field */}
                      {!field.isSystem && (
                        <button
                          type="button"
                          onClick={() => handleDeleteField(idx)}
                          className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Remove Custom Field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Live Form Preview (5 Cols) */}
        <div className="xl:col-span-5 sticky top-6 space-y-3">
          <div className="p-5 rounded-2xl bg-[#0b1120] border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Live Interactive Form Preview
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Type into the fields to test real-time conditional logic and validations
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewValues({})}
                className="text-[10px] text-slate-400 hover:text-amber-400 transition-colors"
              >
                Reset Preview
              </button>
            </div>

            <div className="max-h-[60dvh] overflow-y-auto pr-1">
              <DynamicFormRenderer
                schema={activeFields}
                values={previewValues}
                onChange={(fieldId, val) => setPreviewValues((v) => ({ ...v, [fieldId]: val }))}
                gridCols={1}
              />
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Status: Synchronized with builder</span>
              <span>Fields visible: {activeFields.filter((f) => !f.isHidden).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Field Configuration Drawer / Modal */}
      {showFieldModal && activeEditingField && (
        <FieldConfigModal
          field={activeEditingField}
          allFields={activeFields}
          onClose={() => {
            setShowFieldModal(false);
            setActiveEditingField(null);
          }}
          onSave={handleSaveFieldFromModal}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FIELD CONFIGURATION & LOGIC MODAL
// ─────────────────────────────────────────────────────────────
function FieldConfigModal({ field, allFields, onClose, onSave }) {
  const [form, setForm] = useState({ ...field });
  const [optionInput, setOptionInput] = useState('');

  const isSelectType = ['select', 'multiselect', 'radio', 'dropdown'].includes(form.fieldType);

  const handleAddOption = (e) => {
    e.preventDefault();
    if (!optionInput.trim()) return;
    const current = Array.isArray(form.options) ? [...form.options] : [];
    current.push(optionInput.trim());
    setForm({ ...form, options: current });
    setOptionInput('');
  };

  const handleRemoveOption = (index) => {
    const current = Array.isArray(form.options) ? [...form.options] : [];
    current.splice(index, 1);
    setForm({ ...form, options: current });
  };

  const handleAddConditionRule = () => {
    const currentRules = form.conditionalRules?.rules ? [...form.conditionalRules.rules] : [];
    currentRules.push({ field: allFields[0]?.fieldId || '', operator: '=', value: '' });
    setForm({
      ...form,
      conditionalRules: {
        combinator: form.conditionalRules?.combinator || 'AND',
        rules: currentRules,
      },
    });
  };

  const handleRemoveConditionRule = (idx) => {
    const currentRules = [...(form.conditionalRules?.rules || [])];
    currentRules.splice(idx, 1);
    setForm({
      ...form,
      conditionalRules: { ...form.conditionalRules, rules: currentRules },
    });
  };

  const handleUpdateConditionRule = (idx, key, val) => {
    const currentRules = [...(form.conditionalRules?.rules || [])];
    currentRules[idx] = { ...currentRules[idx], [key]: val };
    setForm({
      ...form,
      conditionalRules: { ...form.conditionalRules, rules: currentRules },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl max-h-[88dvh] flex flex-col text-left animate-fade-in">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {form.isSystem ? `Configure Field: ${form.label}` : 'Custom Field & Conditional Rules'}
              </h3>
              <p className="text-[11px] text-slate-400">Define label, options, validation, and conditional visibility</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Basic Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Field Label *</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Preferred Location"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Field Type</label>
              <select
                disabled={form.isSystem}
                value={form.fieldType}
                onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Placeholder Text</label>
              <input
                type="text"
                value={form.placeholder || ''}
                onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                placeholder="e.g. Enter preferred sector..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Help Text / Tooltip</label>
              <input
                type="text"
                value={form.helpText || ''}
                onChange={(e) => setForm({ ...form, helpText: e.target.value })}
                placeholder="e.g. Select your primary requirement"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Options Builder for Select / Multi-Select / Radio */}
          {isSelectType && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <label className="font-semibold text-amber-300 uppercase tracking-wider block text-[11px]">
                Option Choices ({form.options?.length || 0})
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  placeholder="e.g. Residential 3BHK"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold"
                >
                  Add Option
                </button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {form.options?.map((opt, idx) => {
                  const label = typeof opt === 'object' ? opt.name || opt.value : String(opt);
                  return (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5"
                    >
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conditional Visibility Rules Builder */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-semibold text-indigo-300 uppercase tracking-wider text-[11px]">
                  ⚡ Conditional Visibility Rules
                </h5>
                <p className="text-[11px] text-slate-400">Show this field only when conditions match</p>
              </div>

              <button
                type="button"
                onClick={handleAddConditionRule}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold hover:bg-indigo-500/30"
              >
                + Add Rule
              </button>
            </div>

            {form.conditionalRules?.rules?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Match:</span>
                  <select
                    value={form.conditionalRules?.combinator || 'AND'}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        conditionalRules: { ...form.conditionalRules, combinator: e.target.value },
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white"
                  >
                    <option value="AND">ALL Rules (AND)</option>
                    <option value="OR">ANY Rule (OR)</option>
                  </select>
                </div>

                {form.conditionalRules.rules.map((rule, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4">
                      <select
                        value={rule.field}
                        onChange={(e) => handleUpdateConditionRule(rIdx, 'field', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
                      >
                        {allFields
                          .filter((f) => f.fieldId !== form.fieldId)
                          .map((f) => (
                            <option key={f.fieldId} value={f.fieldId}>
                              {f.label}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <select
                        value={rule.operator || '='}
                        onChange={(e) => handleUpdateConditionRule(rIdx, 'operator', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => handleUpdateConditionRule(rIdx, 'value', e.target.value)}
                        placeholder="Target Value"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                      />
                    </div>

                    <div className="sm:col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveConditionRule(rIdx)}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-[#0b1120]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSaveFieldFromModal(form)}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20"
          >
            Apply Field Changes
          </button>
        </div>
      </div>
    </div>
  );
}
