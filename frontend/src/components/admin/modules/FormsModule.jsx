'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
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
  RotateCcw,
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
  { fieldId: 'name', label: 'Client Name', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 1 },
  { fieldId: 'phone', label: 'Phone Number', fieldType: 'phone', isRequired: false, isSystem: true, isHidden: false, order: 2 },
  { fieldId: 'email', label: 'Email Address', fieldType: 'email', isRequired: false, isSystem: true, isHidden: false, order: 3 },
  { fieldId: 'company', label: 'Company / Project', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 4 },
  { fieldId: 'budget', label: 'Budget Range', fieldType: 'currency', isRequired: false, isSystem: true, isHidden: false, order: 5 },
  { fieldId: 'location', label: 'Location Preference', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 6 },
  { fieldId: 'followUpDate', label: 'Next Follow-up Date', fieldType: 'date', isRequired: false, isSystem: true, isHidden: false, order: 7 },
];

const DEFAULT_PRODUCT_FIELDS = [
  { fieldId: 'name', label: 'Package / Product Name', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 1 },
  { fieldId: 'location', label: 'Market / Region / Location', fieldType: 'text', isRequired: false, isSystem: true, isHidden: false, order: 2 },
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
  loading: parentLoading = false,
  error = null,
  theme = 'light', // 'light' | 'dark'
  onRetry,
  onSaveSchema,
}) {
  const [formType, setFormType] = useState('lead'); // 'lead' | 'product'
  const [leadFields, setLeadFields] = useState(() => {
    const u = getUser();
    if (u?.leadFormSchema && Array.isArray(u.leadFormSchema) && u.leadFormSchema.length > 0) {
      return u.leadFormSchema;
    }
    return DEFAULT_LEAD_FIELDS;
  });
  const [productFields, setProductFields] = useState(() => {
    const u = getUser();
    if (u?.productFormSchema && Array.isArray(u.productFormSchema) && u.productFormSchema.length > 0) {
      return u.productFormSchema;
    }
    return DEFAULT_PRODUCT_FIELDS;
  });
  const [activeEditingField, setActiveEditingField] = useState(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(true);
  const [previewValues, setPreviewValues] = useState({});

  // Sync incoming schema from API (always bypass HTTP cache)
  useEffect(() => {
    async function loadSchemas() {
      setLoadingSchemas(true);
      try {
        const timestamp = Date.now();
        // Fetch active lead schema with cache-buster
        const resLead = await api.get(`/auth/form-schema?type=lead&_t=${timestamp}`);
        if (resLead.data?.schema && Array.isArray(resLead.data.schema) && resLead.data.schema.length > 0) {
          setLeadFields(resLead.data.schema);
        }

        // Fetch active product schema with cache-buster
        const resProd = await api.get(`/auth/form-schema?type=product&_t=${timestamp}`);
        if (resProd.data?.schema && Array.isArray(resProd.data.schema) && resProd.data.schema.length > 0) {
          setProductFields(resProd.data.schema);
        }
      } catch (e) {
        console.error('Error loading form schemas:', e);
      } finally {
        setLoadingSchemas(false);
      }
    }
    loadSchemas();
  }, []);

  const isDark = theme === 'dark';
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

  // 100% Owner Control: Toggle Visibility for ANY field
  const handleToggleHide = (idx) => {
    setActiveFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], isHidden: !next[idx].isHidden };
      return next;
    });
  };

  // 100% Owner Control: Toggle Mandatory / Optional for ANY field (including Name & Phone)
  const handleToggleRequired = (idx) => {
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
    setActiveFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResetToDefaults = () => {
    if (!confirm(`Are you sure you want to reset the ${formType === 'lead' ? 'Prospect Lead' : 'Product'} form fields to standard defaults?`)) {
      return;
    }
    if (formType === 'lead') {
      setLeadFields(DEFAULT_LEAD_FIELDS);
    } else {
      setProductFields(DEFAULT_PRODUCT_FIELDS);
    }
    toast.success('Form reset to defaults. Click "Save Configuration" to apply.');
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
    setSavedSuccess(false);
    try {
      const res = await api.put(`/auth/form-schema?type=${formType}`, {
        formType,
        schema: activeFields,
        fields: activeFields,
      });

      if (res.data?.success || res.status === 200) {
        const returnedSchema = formType === 'lead'
          ? (res.data?.leadFormSchema || activeFields)
          : (res.data?.productFormSchema || activeFields);

        if (formType === 'lead') {
          setLeadFields(returnedSchema);
        } else {
          setProductFields(returnedSchema);
        }

        setSavedSuccess(true);
        toast.success(`🎉 ${formType === 'lead' ? 'Prospect Lead' : 'Product / Package'} form configuration saved successfully!`);

        // Synchronize in local user state so dashboard reflects instantly
        try {
          const storedUser = getUser();
          if (storedUser) {
            if (formType === 'lead') {
              storedUser.leadFormSchema = returnedSchema;
            } else {
              storedUser.productFormSchema = returnedSchema;
            }
            localStorage.setItem('user', JSON.stringify(storedUser));
          }
        } catch (e) {}

        if (onSaveSchema) onSaveSchema(returnedSchema, formType);
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        toast.error(res.data?.message || 'Failed to save form layout');
      }
    } catch (err) {
      console.error('Save schema error:', err);
      toast.error(err.response?.data?.message || 'Error saving form schema to server');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs Navigation */}
      <div className={`p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 shadow-sm ${
        isDark ? 'bg-[#0b1120] border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
          }`}>
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Forms & Custom Fields Builder
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-100 text-indigo-700'
              }`}>
                Agency Control
              </span>
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Full owner control: customize field labels, toggle mandatory / optional status, hide unused fields, and reorder.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Form Switcher */}
          <div className={`flex p-1 rounded-xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setFormType('lead')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                formType === 'lead'
                  ? isDark
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-white text-indigo-600 font-bold shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Prospect Lead Form</span>
            </button>
            <button
              type="button"
              onClick={() => setFormType('product')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                formType === 'product'
                  ? isDark
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-white text-indigo-600 font-bold shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Product / Package Form</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetToDefaults}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
            title="Reset to default template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50 ${
              isDark
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
            }`}
          >
            {savedSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving Changes...' : (savedSuccess ? 'Saved & Applied! ✅' : 'Save Changes')}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Builder on Left + Live Form Preview on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Field Configuration (7 Cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <span>{formType === 'lead' ? 'Prospect Lead Form Fields' : 'Product / Package Fields'}</span>
              <span className="text-slate-400 font-mono">({activeFields.length})</span>
            </h4>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                  : 'bg-white hover:bg-slate-50 text-indigo-600 border-indigo-200 shadow-sm'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Field</span>
            </button>
          </div>

          {/* Field Items List */}
          <div className="space-y-2.5">
            {activeFields.map((field, idx) => {
              const hasConditional =
                (field.conditionalRules?.rules?.length || 0) > 0 || Boolean(field.dependsOn?.field);

              return (
                <div
                  key={field.fieldId || idx}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isDark
                      ? field.isHidden
                        ? 'border-slate-800/60 opacity-60 bg-slate-950/40'
                        : 'bg-[#0b1120] border-slate-800 hover:border-slate-700 shadow-sm'
                      : field.isHidden
                      ? 'border-slate-200 opacity-60 bg-slate-100'
                      : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm'
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
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(idx, 1)}
                          disabled={idx === activeFields.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{field.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono border ${
                            isDark
                              ? 'bg-slate-800 text-amber-300 border-slate-700'
                              : 'bg-slate-100 text-indigo-700 border-slate-200'
                          }`}>
                            {field.fieldType || 'text'}
                          </span>
                          {field.isRequired ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 font-semibold">
                              Mandatory
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 font-medium">
                              Optional
                            </span>
                          )}
                          {field.isHidden && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                              Hidden
                            </span>
                          )}
                          {hasConditional && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                              ⚡ Conditional
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>key: {field.fieldId}</span>
                          {field.placeholder && <span>• "{field.placeholder}"</span>}
                          {field.helpText && <span>• {field.helpText}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls: Full Owner Control */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Toggle Visibility */}
                      <button
                        type="button"
                        onClick={() => handleToggleHide(idx)}
                        className={`p-2 rounded-lg border text-xs transition-colors ${
                          field.isHidden
                            ? 'border-amber-300 text-amber-600 bg-amber-50'
                            : 'border-slate-300 text-slate-600 hover:text-slate-900 bg-white shadow-sm'
                        }`}
                        title={field.isHidden ? 'Hidden (Click to Show)' : 'Visible (Click to Hide)'}
                      >
                        {field.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>

                      {/* Toggle Required */}
                      <button
                        type="button"
                        onClick={() => handleToggleRequired(idx)}
                        className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
                          field.isRequired
                            ? 'border-rose-300 text-rose-700 bg-rose-50 shadow-sm'
                            : 'border-slate-300 text-slate-600 hover:text-slate-900 bg-white shadow-sm'
                        }`}
                        title="Click to toggle Mandatory vs Optional"
                      >
                        {field.isRequired ? 'Mandatory' : 'Optional'}
                      </button>

                      {/* Edit Field Details */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(field)}
                        className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:text-indigo-600 bg-white shadow-sm transition-colors"
                        title="Configure Label, Placeholder & Logic"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Custom Field */}
                      <button
                        type="button"
                        onClick={() => handleDeleteField(idx)}
                        className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 bg-white shadow-sm transition-colors"
                        title="Remove Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Live Form Preview (5 Cols) */}
        <div className="xl:col-span-5 sticky top-6 space-y-3">
          <div className={`p-5 rounded-2xl border shadow-md space-y-4 ${
            isDark ? 'bg-[#0b1120] border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Live Real-Time Form Preview
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Direct preview of how this form appears to your sales agents and prospect leads
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewValues({})}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="max-h-[60dvh] overflow-y-auto pr-1">
              <DynamicFormRenderer
                schema={activeFields}
                values={previewValues}
                onChange={(fieldId, val) => setPreviewValues((v) => ({ ...v, [fieldId]: val }))}
                gridCols={1}
                theme={theme}
              />
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Status: Live preview synced</span>
              <span>Visible fields: {activeFields.filter((f) => !f.isHidden).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Field Configuration Drawer / Modal */}
      {showFieldModal && activeEditingField && (
        <FieldConfigModal
          field={activeEditingField}
          allFields={activeFields}
          theme={theme}
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
function FieldConfigModal({ field, allFields, theme = 'light', onClose, onSave }) {
  const [form, setForm] = useState({ ...field });
  const [optionInput, setOptionInput] = useState('');

  const isSelectType = ['select', 'multiselect', 'radio', 'dropdown'].includes(form.fieldType);
  const isDark = theme === 'dark';

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`rounded-2xl w-full max-w-xl shadow-2xl max-h-[88dvh] flex flex-col text-left border animate-fade-in ${
        isDark ? 'bg-[#0b1120] border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Modal Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Configure Field: {form.label || form.fieldId || 'New Field'}
              </h3>
              <p className="text-[11px] text-slate-400">Customize display label, placeholder text, field options, and conditional visibility</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Basic Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Field Label *</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Full Name or Preferred Location"
                required
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-sm"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Field Type</label>
              <select
                value={form.fieldType}
                onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-sm"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Placeholder Text</label>
              <input
                type="text"
                value={form.placeholder || ''}
                onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                placeholder="e.g. Enter name or details..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-sm"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Help Text / Tooltip</label>
              <input
                type="text"
                value={form.helpText || ''}
                onChange={(e) => setForm({ ...form, helpText: e.target.value })}
                placeholder="e.g. Helper instructions for the sales rep"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-sm"
              />
            </div>
          </div>

          {/* Mandatory & Hidden Toggles inside Modal */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRequired === true}
                onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="font-semibold text-slate-700">Mandatory / Required Field</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isHidden === true}
                onChange={(e) => setForm({ ...form, isHidden: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="font-semibold text-slate-700">Hide on Form</span>
            </label>
          </div>

          {/* Options Builder for Select / Multi-Select / Radio */}
          {isSelectType && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="font-bold text-indigo-700 uppercase tracking-wider block text-[11px]">
                Option Choices ({form.options?.length || 0})
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  placeholder="e.g. Premium Plan or Residential 3BHK"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold shadow-sm"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {form.options?.map((opt, idx) => {
                  const label = typeof opt === 'object' ? opt.name || opt.value : String(opt);
                  return (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg bg-white text-slate-700 border border-slate-300 flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conditional Visibility Rules Builder */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-indigo-700 uppercase tracking-wider text-[11px]">
                  ⚡ Conditional Visibility Rules
                </h5>
                <p className="text-[11px] text-slate-500">Show this field only when conditions match other inputs</p>
              </div>

              <button
                type="button"
                onClick={handleAddConditionRule}
                className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-200"
              >
                + Add Rule
              </button>
            </div>

            {form.conditionalRules?.rules?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span>Match:</span>
                  <select
                    value={form.conditionalRules?.combinator || 'AND'}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        conditionalRules: { ...form.conditionalRules, combinator: e.target.value },
                      })
                    }
                    className="bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-900"
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
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800"
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
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800"
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
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900"
                      />
                    </div>

                    <div className="sm:col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveConditionRule(rIdx)}
                        className="text-slate-400 hover:text-rose-600"
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
        <div className={`p-4 border-t flex items-center justify-end gap-3 ${
          isDark ? 'bg-[#0b1120] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-600/20"
          >
            Apply Field Changes
          </button>
        </div>
      </div>
    </div>
  );
}
