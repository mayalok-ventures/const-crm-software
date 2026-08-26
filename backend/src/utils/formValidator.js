/**
 * Reusable Form Validation & Conditional Logic Engine
 * Strictly isolated for Prospect Lead and Product/Package dynamic forms.
 */

// Evaluate single conditional rule
function evaluateRule(rule, values) {
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
        return parentVal.some(item => String(item).trim().toLowerCase() === strTarget);
      }
      return strParent.includes(strTarget);

    case 'not contains':
    case 'not_contains':
      if (Array.isArray(parentVal)) {
        return !parentVal.some(item => String(item).trim().toLowerCase() === strTarget);
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
        ? targetVal.map(v => String(v).trim().toLowerCase())
        : strTarget.split(',').map(v => v.trim());
      return allowed.includes(strParent);
    }

    case 'not in':
    case 'not_in': {
      const forbidden = Array.isArray(targetVal)
        ? targetVal.map(v => String(v).trim().toLowerCase())
        : strTarget.split(',').map(v => v.trim());
      return !forbidden.includes(strParent);
    }

    default:
      return strParent === strTarget;
  }
}

// Evaluate whether a field is visible based on conditional logic
function isFieldVisible(field, values = {}) {
  if (!field) return false;
  if (field.isHidden === true) return false;

  // Modern conditionalRules (Supports AND / OR combinators)
  if (field.conditionalRules && Array.isArray(field.conditionalRules.rules) && field.conditionalRules.rules.length > 0) {
    const { rules, combinator = 'AND' } = field.conditionalRules;
    const isAnd = combinator.toUpperCase() === 'AND';

    if (isAnd) {
      return rules.every(r => evaluateRule(r, values));
    } else {
      return rules.some(r => evaluateRule(r, values));
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

// Evaluate whether a field is conditionally required
function isFieldRequired(field, values = {}) {
  if (!isFieldVisible(field, values)) return false;

  // Base requirement
  if (field.isRequired === true) return true;

  // Conditional Required Rules
  if (field.conditionalRequiredRules && Array.isArray(field.conditionalRequiredRules.rules) && field.conditionalRequiredRules.rules.length > 0) {
    const { rules, combinator = 'AND' } = field.conditionalRequiredRules;
    const isAnd = combinator.toUpperCase() === 'AND';

    if (isAnd) {
      return rules.every(r => evaluateRule(r, values));
    } else {
      return rules.some(r => evaluateRule(r, values));
    }
  }

  return false;
}

// Standard Default Product/Package Schema
function getDefaultProductFormSchema() {
  return [
    {
      fieldId: 'name',
      label: 'Package / Product Name',
      fieldType: 'text',
      placeholder: 'e.g. Enterprise Growth Suite',
      isRequired: true,
      isSystem: true,
      isHidden: false,
      order: 1,
    },
    {
      fieldId: 'location',
      label: 'Market / Region / Location',
      fieldType: 'text',
      placeholder: 'e.g. North America or Mumbai',
      isRequired: true,
      isSystem: true,
      isHidden: false,
      order: 2,
    },
    {
      fieldId: 'city',
      label: 'City / Territory',
      fieldType: 'text',
      placeholder: 'e.g. National / Remote',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 3,
    },
    {
      fieldId: 'vendorOrBrand',
      label: 'Vendor / Brand / Provider',
      fieldType: 'text',
      placeholder: 'e.g. Acme Cloud Corp',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 4,
    },
    {
      fieldId: 'basePrice',
      label: 'Base Pricing / Rate',
      fieldType: 'currency',
      placeholder: 'e.g. $4,500/mo or ₹2.5 Lakhs',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 5,
    },
    {
      fieldId: 'productCategory',
      label: 'Tiers / Variant Categories',
      fieldType: 'text',
      placeholder: 'e.g. Starter, Growth, Enterprise, Custom',
      helpText: 'Comma-separated tiers or packages',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 6,
    },
    {
      fieldId: 'amenities',
      label: 'Key Features & Inclusions',
      fieldType: 'textarea',
      placeholder: 'e.g. Dedicated Manager, 24/7 SLA, API Access, Custom Setup',
      helpText: 'Comma-separated features included in this package',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 7,
    },
    {
      fieldId: 'status',
      label: 'Catalog Status',
      fieldType: 'select',
      options: ['available', 'in_development', 'upcoming', 'sold_out', 'archived'],
      defaultValue: 'available',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 8,
    },
    {
      fieldId: 'deliveryOrCompletionDate',
      label: 'Delivery / Completion Timeline',
      fieldType: 'text',
      placeholder: 'e.g. Immediate / 2-3 Weeks / Q4 2026',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 9,
    },
    {
      fieldId: 'referenceId',
      label: 'SKU / Catalog Reference ID',
      fieldType: 'text',
      placeholder: 'e.g. SKU-8849-PKG',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 10,
    },
    {
      fieldId: 'description',
      label: 'Detailed Scope & Description',
      fieldType: 'textarea',
      placeholder: 'Comprehensive description of services, terms, and deliverables',
      isRequired: false,
      isSystem: true,
      isHidden: false,
      order: 11,
    },
  ];
}

// Full Form Data Validator
function validateFormData(schema = [], values = {}) {
  const errors = {};
  if (!Array.isArray(schema) || schema.length === 0) {
    return { isValid: true, errors };
  }

  for (const field of schema) {
    const fieldKey = field.fieldId || field.name;
    if (!fieldKey) continue;

    const isVisible = isFieldVisible(field, values);
    if (!isVisible) {
      // Hidden fields must never fail validation
      continue;
    }

    const required = isFieldRequired(field, values);
    const val = values[fieldKey];
    const isValEmpty = val === undefined || val === null || String(val).trim() === '' || (Array.isArray(val) && val.length === 0);

    // followUpDate is optional unless user enforces follow-up preference
    if (required && isValEmpty && fieldKey !== 'followUpDate') {
      errors[fieldKey] = `${field.label || fieldKey} is required.`;
      continue;
    }

    if (!isValEmpty) {
      const fieldType = (field.fieldType || field.type || 'text').toLowerCase();

      // Email validation
      if (fieldType === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val).trim())) {
          errors[fieldKey] = `Please enter a valid email address for ${field.label}.`;
        }
      }

      // Phone validation
      if (fieldType === 'phone') {
        const digits = String(val).replace(/\D/g, '');
        if (digits.length === 0) {
          if (required) {
            errors[fieldKey] = `${field.label || fieldKey} is required.`;
          }
        } else if (digits.length < 7 || digits.length > 15) {
          errors[fieldKey] = `Please enter a valid phone number for ${field.label}.`;
        }
      }

      // Numeric / Currency / Percentage
      if (['number', 'currency', 'percentage'].includes(fieldType)) {
        const cleanStr = String(val).replace(/[^0-9.-]+/g, '');
        if (!cleanStr) {
          if (required) {
            errors[fieldKey] = `${field.label || fieldKey} is required.`;
          }
        } else {
          const cleanNum = Number(cleanStr);
          if (isNaN(cleanNum)) {
            errors[fieldKey] = `${field.label} must be a valid number.`;
          } else {
            if (field.validationRules?.min !== undefined && cleanNum < field.validationRules.min) {
              errors[fieldKey] = `${field.label} cannot be less than ${field.validationRules.min}.`;
            }
            if (field.validationRules?.max !== undefined && cleanNum > field.validationRules.max) {
              errors[fieldKey] = `${field.label} cannot exceed ${field.validationRules.max}.`;
            }
          }
        }
      }

      // Select / Radio option check
      if (['select', 'radio', 'dropdown'].includes(fieldType) && Array.isArray(field.options) && field.options.length > 0) {
        const optValues = field.options.map(opt => (typeof opt === 'object' && opt ? opt.value || opt.name : String(opt)));
        const normalizedVal = String(val).trim();
        const matches = optValues.some(ov => String(ov).trim().toLowerCase() === normalizedVal.toLowerCase());
        if (!matches && required) {
          errors[fieldKey] = `Selected value for ${field.label} is invalid.`;
        }
      }

      // Text Length / Pattern
      if (typeof val === 'string') {
        if (field.validationRules?.minLength && val.length < field.validationRules.minLength) {
          errors[fieldKey] = `${field.label} must be at least ${field.validationRules.minLength} characters.`;
        }
        if (field.validationRules?.maxLength && val.length > field.validationRules.maxLength) {
          errors[fieldKey] = `${field.label} cannot exceed ${field.validationRules.maxLength} characters.`;
        }
        if (field.validationRules?.pattern) {
          try {
            const regex = new RegExp(field.validationRules.pattern);
            if (!regex.test(val)) {
              errors[fieldKey] = `${field.label} format is invalid.`;
            }
          } catch {}
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

module.exports = {
  evaluateRule,
  isFieldVisible,
  isFieldRequired,
  validateFormData,
  getDefaultProductFormSchema,
};
