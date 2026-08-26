'use client';

import React, { useMemo } from 'react';
import {
  HelpCircle,
  Calendar,
  Clock,
  DollarSign,
  Percent,
  Link as LinkIcon,
  Phone,
  Mail,
  Hash,
  AlignLeft,
  CheckSquare,
  ListFilter,
} from 'lucide-react';

/**
 * Evaluates conditional rule for real-time form rendering
 */
export function evaluateRule(rule, values) {
  if (!rule || !rule.field) return true;

  const parentVal = values[rule.field];
  const targetVal = rule.value;
  const operator = (rule.operator || '=').toLowerCase().trim();

  const strParent = parentVal !== undefined && parentVal !== null ? String(parentVal).trim().toLowerCase() : '';
  const strTarget = targetVal !== undefined && targetVal !== null ? String(targetVal).trim().toLowerCase() : '';
  const numParent = Number(parentVal);
  const numTarget = Number(targetVal);

  switch (operator) {
    case '=':
    case '==':
    case 'equals':
      return strParent === strTarget;

    case '!=':
    case '!==':
    case 'not_equals':
      return strParent !== strTarget;

    case '>':
      return !isNaN(numParent) && !isNaN(numTarget) && numParent > numTarget;

    case '>=':
      return !isNaN(numParent) && !isNaN(numTarget) && numParent >= numTarget;

    case '<':
      return !isNaN(numParent) && !isNaN(numTarget) && numParent < numTarget;

    case '<=':
      return !isNaN(numParent) && !isNaN(numTarget) && numParent <= numTarget;

    case 'contains':
      if (Array.isArray(parentVal)) {
        return parentVal.some((item) => String(item).trim().toLowerCase() === strTarget);
      }
      return strParent.includes(strTarget);

    case 'not contains':
    case 'not_contains':
      if (Array.isArray(parentVal)) {
        return !parentVal.some((item) => String(item).trim().toLowerCase() === strTarget);
      }
      return !strParent.includes(strTarget);

    case 'is empty':
    case 'is_empty':
    case 'empty':
      return parentVal === undefined || parentVal === null || strParent === '' || (Array.isArray(parentVal) && parentVal.length === 0);

    case 'is not empty':
    case 'is_not_empty':
    case 'not_empty':
      return parentVal !== undefined && parentVal !== null && strParent !== '' && (!Array.isArray(parentVal) || parentVal.length > 0);

    case 'in': {
      const allowed = Array.isArray(targetVal)
        ? targetVal.map((v) => String(v).trim().toLowerCase())
        : strTarget.split(',').map((v) => v.trim());
      return allowed.includes(strParent);
    }

    case 'not in':
    case 'not_in': {
      const forbidden = Array.isArray(targetVal)
        ? targetVal.map((v) => String(v).trim().toLowerCase())
        : strTarget.split(',').map((v) => v.trim());
      return !forbidden.includes(strParent);
    }

    default:
      return strParent === strTarget;
  }
}

/**
 * Checks if field is visible given current form state
 */
export function isFieldVisible(field, values = {}) {
  if (!field) return false;
  if (field.isHidden === true) return false;

  // Modern conditionalRules (Supports AND / OR combinators)
  if (field.conditionalRules && Array.isArray(field.conditionalRules.rules) && field.conditionalRules.rules.length > 0) {
    const { rules, combinator = 'AND' } = field.conditionalRules;
    const isAnd = combinator.toUpperCase() === 'AND';

    if (isAnd) {
      return rules.every((r) => evaluateRule(r, values));
    } else {
      return rules.some((r) => evaluateRule(r, values));
    }
  }

  // Backward compatibility with legacy dependsOn
  if (field.dependsOn && field.dependsOn.field) {
    const parentVal = values[field.dependsOn.field];
    const targetVal = field.dependsOn.value;
    return String(parentVal || '').trim().toLowerCase() === String(targetVal || '').trim().toLowerCase();
  }

  return true;
}

/**
 * Checks if field is required given current form state
 */
export function isFieldRequired(field, values = {}) {
  if (!isFieldVisible(field, values)) return false;
  if (field.isRequired === true) return true;

  if (field.conditionalRequiredRules && Array.isArray(field.conditionalRequiredRules.rules) && field.conditionalRequiredRules.rules.length > 0) {
    const { rules, combinator = 'AND' } = field.conditionalRequiredRules;
    const isAnd = combinator.toUpperCase() === 'AND';

    if (isAnd) {
      return rules.every((r) => evaluateRule(r, values));
    } else {
      return rules.some((r) => evaluateRule(r, values));
    }
  }

  return false;
}

export default function DynamicFormRenderer({
  schema = [],
  values = {},
  onChange = () => {},
  errors = {},
  disabled = false,
  gridCols = 2,
  theme = 'light', // 'light' (default) | 'dark'
}) {
  const sortedFields = useMemo(() => {
    if (!Array.isArray(schema)) return [];
    return [...schema].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [schema]);

  const visibleFields = useMemo(() => {
    return sortedFields.filter((f) => isFieldVisible(f, values));
  }, [sortedFields, values]);

  const handleInputChange = (fieldId, value) => {
    onChange(fieldId, value);
  };

  const handleMultiSelectToggle = (fieldId, optionValue) => {
    const current = Array.isArray(values[fieldId]) ? [...values[fieldId]] : [];
    const index = current.indexOf(optionValue);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(optionValue);
    }
    onChange(fieldId, current);
  };

  const isDark = theme === 'dark';
  const inputClass = isDark
    ? 'w-full bg-[#0d1424] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors'
    : 'w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm';

  const labelClass = isDark
    ? 'text-xs font-semibold text-slate-300 flex items-center justify-between'
    : 'text-xs font-bold text-slate-700 flex items-center justify-between';

  return (
    <div className={`grid grid-cols-1 ${gridCols === 2 ? 'sm:grid-cols-2' : ''} gap-3.5`}>
      {visibleFields.map((field) => {
        const fieldKey = field.fieldId || field.name;
        const required = isFieldRequired(field, values);
        const fieldType = (field.fieldType || field.type || 'text').toLowerCase();
        const value = values[fieldKey] !== undefined ? values[fieldKey] : (field.defaultValue || '');
        const error = errors[fieldKey];

        const optionsList = Array.isArray(field.options)
          ? field.options.map((opt) => {
              if (typeof opt === 'object' && opt !== null) {
                return {
                  name: opt.name || opt.label || opt.value,
                  value: opt.value || opt.name || opt.label,
                  disabled: Boolean(opt.disabled),
                };
              }
              return { name: String(opt), value: String(opt), disabled: false };
            })
          : [];

        const isFullWidth = ['textarea', 'multiselect', 'radio'].includes(fieldType) || field.fullWidth;

        return (
          <div key={fieldKey} className={`space-y-1 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
            <label className={labelClass}>
              <span className="flex items-center gap-1">
                {field.label || fieldKey}
                {required && <span className={isDark ? 'text-rose-400' : 'text-rose-600 font-bold'}>*</span>}
              </span>
              {field.helpText && (
                <span className="text-[11px] text-slate-400 font-normal flex items-center gap-1" title={field.helpText}>
                  <HelpCircle className="w-3 h-3 text-slate-400" />
                  <span className="hidden sm:inline">{field.helpText}</span>
                </span>
              )}
            </label>

            {/* Field Type Specific Rendering */}
            {fieldType === 'textarea' ? (
              <textarea
                rows={3}
                disabled={disabled}
                placeholder={field.placeholder || `Enter ${field.label}...`}
                value={value}
                onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                className={`${inputClass} resize-none`}
              />
            ) : fieldType === 'select' || fieldType === 'dropdown' ? (
              <div className="relative">
                <select
                  disabled={disabled}
                  value={value}
                  onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                  className={`${inputClass} appearance-none cursor-pointer pr-8`}
                >
                  <option value="">{field.placeholder || `-- Select ${field.label} --`}</option>
                  {optionsList.map((opt, idx) => (
                    <option key={idx} value={opt.value} disabled={opt.disabled}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ListFilter className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : fieldType === 'multiselect' ? (
              <div className={`flex flex-wrap gap-2 p-2 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                {optionsList.map((opt, idx) => {
                  const selected = Array.isArray(value) && value.includes(opt.value);
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={disabled || opt.disabled}
                      onClick={() => handleMultiSelectToggle(fieldKey, opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        selected
                          ? isDark
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'bg-indigo-600 text-white font-bold shadow-sm'
                          : isDark
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 shadow-sm'
                      }`}
                    >
                      <CheckSquare className={`w-3.5 h-3.5 ${selected ? (isDark ? 'text-slate-950' : 'text-white') : 'text-slate-400'}`} />
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            ) : fieldType === 'radio' ? (
              <div className="flex flex-wrap gap-3 pt-1">
                {optionsList.map((opt, idx) => (
                  <label key={idx} className={`flex items-center gap-2 cursor-pointer text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                    <input
                      type="radio"
                      name={fieldKey}
                      disabled={disabled || opt.disabled}
                      value={opt.value}
                      checked={String(value) === String(opt.value)}
                      onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                      className={isDark ? 'text-amber-500 focus:ring-0 bg-slate-900 border-slate-700' : 'text-indigo-600 focus:ring-0'}
                    />
                    <span>{opt.name}</span>
                  </label>
                ))}
              </div>
            ) : fieldType === 'checkbox' ? (
              <label className="flex items-center gap-2.5 pt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={Boolean(value)}
                  onChange={(e) => handleInputChange(fieldKey, e.target.checked)}
                  className={`rounded w-4 h-4 cursor-pointer ${isDark ? 'border-slate-700 text-amber-500 bg-slate-900' : 'border-slate-300 text-indigo-600'}`}
                />
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{field.placeholder || `Enable ${field.label}`}</span>
              </label>
            ) : fieldType === 'date' ? (
              <div className="relative">
                <input
                  type="date"
                  disabled={disabled}
                  value={value}
                  onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                  className={inputClass}
                />
              </div>
            ) : fieldType === 'datetime' ? (
              <div className="relative">
                <input
                  type="datetime-local"
                  disabled={disabled}
                  value={value}
                  onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                  className={inputClass}
                />
              </div>
            ) : fieldType === 'currency' ? (
              <div className="relative">
                <div className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs ${isDark ? 'text-amber-400' : 'text-indigo-600'}`}>
                  ₹
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={disabled}
                  placeholder={field.placeholder || 'e.g. 500000'}
                  value={value}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^\d.,]/g, '');
                    handleInputChange(fieldKey, clean);
                  }}
                  className={`${inputClass} pl-7`}
                />
              </div>
            ) : fieldType === 'percentage' ? (
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={disabled}
                  placeholder={field.placeholder || 'e.g. 18'}
                  value={value}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^\d.]/g, '');
                    handleInputChange(fieldKey, clean);
                  }}
                  className={`${inputClass} pr-7`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Percent className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : fieldType === 'phone' ? (
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  disabled={disabled}
                  placeholder={field.placeholder || 'e.g. 9876543210'}
                  value={value}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^\d+\s()-]/g, '');
                    handleInputChange(fieldKey, clean);
                  }}
                  className={`${inputClass} pl-9`}
                />
              </div>
            ) : fieldType === 'email' ? (
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  type="email"
                  disabled={disabled}
                  placeholder={field.placeholder || 'e.g. client@example.com'}
                  value={value}
                  onChange={(e) => handleInputChange(fieldKey, e.target.value.trim())}
                  className={`${inputClass} pl-9`}
                />
              </div>
            ) : fieldType === 'url' ? (
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <LinkIcon className="w-3.5 h-3.5" />
                </div>
                <input
                  type="url"
                  disabled={disabled}
                  placeholder={field.placeholder || 'https://example.com'}
                  value={value}
                  onChange={(e) => handleInputChange(fieldKey, e.target.value.trim())}
                  className={`${inputClass} pl-9`}
                />
              </div>
            ) : fieldType === 'number' ? (
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Hash className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={disabled}
                  placeholder={field.placeholder || '0'}
                  value={value}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^\d.-]/g, '');
                    handleInputChange(fieldKey, clean);
                  }}
                  className={`${inputClass} pl-9`}
                />
              </div>
            ) : (
              <input
                type="text"
                disabled={disabled}
                placeholder={field.placeholder || `Enter ${field.label}...`}
                value={value}
                onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                className={inputClass}
              />
            )}

            {/* Validation Error Message */}
            {error && (
              <p className={`text-[11px] font-semibold flex items-center gap-1 mt-1 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                <span>⚠️</span>
                <span>{error}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
