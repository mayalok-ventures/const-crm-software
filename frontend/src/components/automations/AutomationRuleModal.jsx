'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import {
  X,
  Zap,
  MessageCircle,
  Mail,
  GitBranch,
  Bot,
  Clock,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  Copy,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ArrowRightLeft,
  Target,
  Layers,
  ArrowUp,
  ArrowDown,
  UserCheck,
  Tag,
  ShieldAlert,
  Info,
  Check,
  Eye,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import { STAGE_LABELS } from '@/components/LeadModals';

const FALLBACK_CAPABILITIES = {
  triggers: [
    {
      id: 'lead_created',
      name: 'New Lead Arrives',
      category: 'lead_lifecycle',
      description: 'Runs immediately when a new lead enters the CRM (via Ads, Webhook, API, or Manual Entry).',
      badge: 'Real-Time',
    },
    {
      id: 'stage_changed',
      name: 'Pipeline Stage Changes',
      category: 'pipeline',
      description: 'Runs when a lead is moved from one stage to another along the pipeline.',
      badge: 'Pipeline',
    },
    {
      id: 'stage_reached',
      name: 'Milestone Stage Reached',
      category: 'pipeline',
      description: 'Runs whenever a candidate achieves a specific admissions milestone (e.g. Campus Visit, Quota Booking).',
      badge: 'Milestone',
    },
    {
      id: 'stage_duration',
      name: 'Lead Inactive in Stage',
      category: 'inactivity',
      description: 'Runs automatically when a lead has remained stuck in a stage without activity for several days.',
      badge: 'Scheduled',
    },
    {
      id: 'whatsapp_inbound',
      name: 'Inbound WhatsApp Message',
      category: 'chatbots',
      description: 'Runs when a customer sends a WhatsApp message matching specific keywords.',
      badge: 'Chatbot',
    },
  ],
  fields: [
    { id: 'source', label: 'Lead Source', type: 'select' },
    { id: 'status', label: 'Lead Stage / Status', type: 'stage_select' },
    { id: 'city', label: 'City / Region', type: 'string' },
    { id: 'course', label: 'Target Program / Course', type: 'string' },
    { id: 'payable_amount', label: 'Tuition Fee / Deal Value (₹)', type: 'number' },
    { id: 'tags', label: 'Lead Tags', type: 'string' },
  ],
  operators: [
    { id: 'equals', label: 'is equal to' },
    { id: 'not_equals', label: 'is not equal to' },
    { id: 'contains', label: 'contains' },
    { id: 'not_contains', label: 'does not contain' },
    { id: 'gt', label: 'is greater than (>)' },
    { id: 'lt', label: 'is less than (<)' },
    { id: 'is_empty', label: 'is empty / not set' },
    { id: 'is_not_empty', label: 'has any value' },
  ],
  actions: [
    { id: 'send_whatsapp', name: 'Send WhatsApp Message', channel: 'whatsapp', description: 'Dispatches an automated personalized WhatsApp message.' },
    { id: 'send_email', name: 'Send Official Email', channel: 'email', description: 'Sends an email with prospectus or admissions guidance.' },
    { id: 'assign_counselor', name: 'Assign Counselor', channel: 'internal', description: 'Directly assigns or reassigns the lead to a counselor.' },
    { id: 'transfer_lead', name: 'Transfer Lead & Routing', channel: 'internal', description: 'Reassigns counselor, target campaign, stage, and transfer note.' },
    { id: 'update_lead_stage', name: 'Update Lead Stage', channel: 'internal', description: 'Transitions the lead into a new pipeline stage.' },
    { id: 'add_lead_tag', name: 'Add Tag to Lead', channel: 'internal', description: 'Applies an organizational or priority tag to the lead.' },
  ],
  variables: [
    { tag: '{{name}}', label: 'Lead Name' },
    { tag: '{{course}}', label: 'Course' },
    { tag: '{{phone}}', label: 'Phone' },
    { tag: '{{email}}', label: 'Email' },
    { tag: '{{city}}', label: 'City' },
    { tag: '{{stage}}', label: 'Stage' },
    { tag: '{{counselorName}}', label: 'Counselor Name' },
    { tag: '{{counselorPhone}}', label: 'Counselor Phone' },
    { tag: '{{counselorEmail}}', label: 'Counselor Email' },
    { tag: '{{companyName}}', label: 'Organization Name' },
    { tag: '{{source}}', label: 'Lead Source' },
    { tag: '{{amount}}', label: 'Fee Amount' },
  ],
  recipes: [],
};

const DEFAULT_STAGES = Object.entries(STAGE_LABELS).map(([value, label]) => ({
  value,
  label: label.replace(/^[^\s]+\s/, ''),
}));

const LEAD_SOURCE_OPTIONS = [
  'meta_ads',
  'google_ads',
  'website_form',
  'landing_page',
  'whatsapp_direct',
  'walk_in',
  'referral',
  'education_fair',
  'portal',
  'manual',
];

export default function AutomationRuleModal({ isOpen, onClose, onSaved, initialRule = null }) {
  // Wizard Step: 1: 'when', 2: 'check', 3: 'do', 4: 'timing', 5: 'review'
  const [currentStep, setCurrentStep] = useState(1);
  const [capabilities, setCapabilities] = useState(FALLBACK_CAPABILITIES);
  const [showRecipePicker, setShowRecipePicker] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active'); // 'active' | 'paused' | 'draft'
  const [category, setCategory] = useState('lead_lifecycle');

  // Step 1: Trigger State
  const [triggerType, setTriggerType] = useState('lead_created');
  const [targetStage, setTargetStage] = useState('');
  const [fromStage, setFromStage] = useState('');
  const [daysInStage, setDaysInStage] = useState(3);
  const [leadSources, setLeadSources] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [matchType, setMatchType] = useState('contains');

  // Step 2: Conditions State
  const [useConditions, setUseConditions] = useState(false);
  const [conditionsMatch, setConditionsMatch] = useState('all');
  const [conditions, setConditions] = useState([]);

  // Step 3: Actions List (Multi-Action Support!)
  const [actions, setActions] = useState([
    {
      actionType: 'send_whatsapp',
      delayMinutes: 0,
      config: {
        whatsappMessage: 'Hello {{name}}! Welcome to {{course}} at {{companyName}}. I am {{counselorName}}, your personal admissions counselor. How can I assist you today?',
        emailSubject: '',
        emailBody: '',
        assignedUserId: '',
        targetCampaignId: '',
        newStage: '',
        transferNote: '',
        tagToAdd: '',
      },
    },
  ]);

  // Step 4: Timing State
  const [workflowDelayMinutes, setWorkflowDelayMinutes] = useState(0);

  // Aux data for selectors
  const [teamMembers, setTeamMembers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // Test Simulation State
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Load Capabilities, Team Members, and Campaigns
  useEffect(() => {
    if (!isOpen) return;

    api
      .get('/automations/capabilities')
      .then(({ data }) => {
        if (data.capabilities) setCapabilities(data.capabilities);
      })
      .catch((err) => console.warn('Using fallback capabilities:', err?.message));

    api
      .get('/company/members')
      .then(({ data }) => setTeamMembers(data.members || []))
      .catch(() => {});

    api
      .get('/campaigns/inbound')
      .then(({ data }) => setCampaigns(data.campaigns || []))
      .catch(() => {
        api.get('/campaigns').then(({ data }) => setCampaigns(data.campaigns || [])).catch(() => {});
      });
  }, [isOpen]);

  // Populate from initialRule on Edit Mode
  useEffect(() => {
    if (!isOpen) return;

    if (initialRule) {
      setName(initialRule.name || '');
      setDescription(initialRule.description || '');
      setStatus(initialRule.status || (initialRule.isActive ? 'active' : 'paused'));
      setCategory(initialRule.category || 'lead_lifecycle');
      setTriggerType(initialRule.triggerType || 'lead_created');

      const tCfg = initialRule.triggerConfig || {};
      setTargetStage(tCfg.targetStage || '');
      setFromStage(tCfg.fromStage || '');
      setDaysInStage(tCfg.daysInStage || 3);
      setLeadSources(tCfg.leadSources || []);
      setKeywords(tCfg.keywords || []);
      setMatchType(tCfg.matchType || 'contains');

      const conds = tCfg.conditions || initialRule.conditions || [];
      if (Array.isArray(conds) && conds.length > 0) {
        setUseConditions(true);
        setConditions(conds);
        setConditionsMatch(tCfg.conditionsMatch || 'all');
      } else {
        setUseConditions(false);
        setConditions([]);
      }

      setWorkflowDelayMinutes(initialRule.delayMinutes || 0);

      // Actions array
      if (Array.isArray(initialRule.actions) && initialRule.actions.length > 0) {
        setActions(
          initialRule.actions.map((act) => ({
            actionType: act.actionType || 'send_whatsapp',
            delayMinutes: act.delayMinutes || 0,
            config: {
              whatsappMessage: act.config?.whatsappMessage || act.config?.templateText || '',
              emailSubject: act.config?.emailSubject || '',
              emailBody: act.config?.emailBody || act.config?.templateText || '',
              assignedUserId: act.config?.assignedUserId || '',
              targetCampaignId: act.config?.targetCampaignId || '',
              newStage: act.config?.newStage || '',
              transferNote: act.config?.transferNote || '',
              tagToAdd: act.config?.tagToAdd || '',
            },
          }))
        );
      } else {
        // Legacy single action fallback
        setActions([
          {
            actionType: initialRule.actionType || 'send_whatsapp',
            delayMinutes: initialRule.delayMinutes || 0,
            config: {
              whatsappMessage: initialRule.actionConfig?.templateText || initialRule.actionConfig?.whatsappMessage || '',
              emailSubject: initialRule.actionConfig?.emailSubject || '',
              emailBody: initialRule.actionConfig?.templateText || initialRule.actionConfig?.emailBody || '',
              assignedUserId: initialRule.actionConfig?.assignedUserId || '',
              targetCampaignId: initialRule.actionConfig?.targetCampaignId || '',
              newStage: initialRule.actionConfig?.newStage || '',
              transferNote: initialRule.actionConfig?.transferNote || '',
              tagToAdd: initialRule.actionConfig?.tagToAdd || initialRule.actionConfig?.targetTag || '',
            },
          },
        ]);
      }
      setCurrentStep(1);
    } else {
      // New Rule Default
      setName('New Automated Speed-to-Lead Workflow');
      setDescription('');
      setStatus('active');
      setCategory('lead_lifecycle');
      setTriggerType('lead_created');
      setTargetStage('');
      setFromStage('');
      setDaysInStage(3);
      setLeadSources([]);
      setKeywords([]);
      setUseConditions(false);
      setConditions([]);
      setWorkflowDelayMinutes(0);
      setActions([
        {
          actionType: 'send_whatsapp',
          delayMinutes: 0,
          config: {
            whatsappMessage: 'Hello {{name}}! 👋 Thank you for inquiring about {{course}} at {{companyName}}. I am {{counselorName}}, your personal counselor. How can I assist you with admissions today?',
            emailSubject: '',
            emailBody: '',
            assignedUserId: '',
            targetCampaignId: '',
            newStage: '',
            transferNote: '',
            tagToAdd: '',
          },
        },
      ]);
      setCurrentStep(1);
    }

    setError(null);
    setValidationErrors([]);
    setTestResult(null);
  }, [isOpen, initialRule]);

  // Dynamic Natural Language Summary
  const liveSummary = useMemo(() => {
    let triggerText = '';
    if (triggerType === 'lead_created') {
      triggerText = leadSources.length > 0 ? `When a new lead arrives from ${leadSources.join(', ')}` : 'When a new lead arrives from any source';
    } else if (triggerType === 'stage_changed') {
      triggerText = fromStage
        ? `When lead moves from "${STAGE_LABELS[fromStage] || fromStage}" to "${STAGE_LABELS[targetStage] || targetStage || 'Target Stage'}"`
        : `When lead stage changes to "${STAGE_LABELS[targetStage] || targetStage || 'Target Stage'}"`;
    } else if (triggerType === 'stage_reached') {
      triggerText = `When lead reaches milestone stage "${STAGE_LABELS[targetStage] || targetStage || 'Milestone Stage'}"`;
    } else if (triggerType === 'stage_duration') {
      triggerText = `When lead remains inactive in "${STAGE_LABELS[targetStage] || targetStage || 'Stage'}" for ${daysInStage} days`;
    } else if (triggerType === 'whatsapp_inbound') {
      triggerText = `When inbound WhatsApp matches keywords: ${keywords.length > 0 ? keywords.map((k) => `"${k}"`).join(', ') : '(no keywords set)'}`;
    }

    let conditionText = '';
    if (useConditions && conditions.length > 0) {
      const parts = conditions.map((c) => `${c.field || 'Field'} ${c.operator || '='} "${c.value || ''}"`);
      conditionText = ` (only if ${conditionsMatch === 'any' ? 'any of' : 'all of'}: ${parts.join(', ')})`;
    }

    const actionParts = actions.map((act) => {
      const delay = act.delayMinutes || workflowDelayMinutes || 0;
      const delayPrefix = delay > 0 ? `wait ${delay}m then ` : '';
      if (act.actionType === 'send_whatsapp') return `${delayPrefix}send WhatsApp message`;
      if (act.actionType === 'send_email') return `${delayPrefix}send official email`;
      if (act.actionType === 'assign_counselor') return `${delayPrefix}assign to counselor`;
      if (act.actionType === 'transfer_lead') return `${delayPrefix}transfer lead`;
      if (act.actionType === 'update_lead_stage') return `${delayPrefix}move stage to "${STAGE_LABELS[act.config?.newStage] || act.config?.newStage || ''}"`;
      if (act.actionType === 'add_lead_tag') return `${delayPrefix}add tag "${act.config?.tagToAdd || ''}"`;
      return `${delayPrefix}execute action`;
    });

    return `${triggerText}${conditionText} ➔ ${actionParts.join(', then ')}.`;
  }, [triggerType, leadSources, targetStage, fromStage, daysInStage, keywords, useConditions, conditions, conditionsMatch, actions, workflowDelayMinutes]);

  // Apply a starter recipe
  const handleApplyRecipe = (recipe) => {
    setName(recipe.name);
    setDescription(recipe.description || '');
    setCategory(recipe.category || 'lead_lifecycle');
    setTriggerType(recipe.triggerType);

    const tCfg = recipe.triggerConfig || {};
    setTargetStage(tCfg.targetStage || '');
    setFromStage(tCfg.fromStage || '');
    setDaysInStage(tCfg.daysInStage || 3);
    setLeadSources(tCfg.leadSources || []);
    setKeywords(tCfg.keywords || []);

    if (Array.isArray(recipe.actions) && recipe.actions.length > 0) {
      setActions(
        recipe.actions.map((act) => ({
          actionType: act.actionType,
          delayMinutes: act.delayMinutes || 0,
          config: {
            whatsappMessage: act.config?.whatsappMessage || '',
            emailSubject: act.config?.emailSubject || '',
            emailBody: act.config?.emailBody || '',
            assignedUserId: act.config?.assignedUserId || '',
            targetCampaignId: act.config?.targetCampaignId || '',
            newStage: act.config?.newStage || '',
            transferNote: act.config?.transferNote || '',
            tagToAdd: act.config?.tagToAdd || '',
          },
        }))
      );
    }
    setShowRecipePicker(false);
  };

  // Condition Management
  const addCondition = () => {
    setConditions((prev) => [...prev, { field: 'source', operator: 'equals', value: 'meta_ads' }]);
  };

  const updateCondition = (idx, key, val) => {
    setConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, [key]: val } : c)));
  };

  const removeCondition = (idx) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  // Action Management
  const addAction = () => {
    setActions((prev) => [
      ...prev,
      {
        actionType: 'send_whatsapp',
        delayMinutes: 0,
        config: {
          whatsappMessage: 'Hi {{name}}! Counselor {{counselorName}} is reviewing your inquiry.',
          emailSubject: '',
          emailBody: '',
          assignedUserId: '',
          targetCampaignId: '',
          newStage: '',
          transferNote: '',
          tagToAdd: '',
        },
      },
    ]);
  };

  const updateAction = (idx, key, val) => {
    setActions((prev) =>
      prev.map((act, i) => {
        if (i !== idx) return act;
        if (key === 'actionType' || key === 'delayMinutes') {
          return { ...act, [key]: val };
        }
        return {
          ...act,
          config: { ...act.config, [key]: val },
        };
      })
    );
  };

  const removeAction = (idx) => {
    if (actions.length <= 1) return;
    setActions((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveAction = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= actions.length) return;
    const copy = [...actions];
    const [moved] = copy.splice(idx, 1);
    copy.splice(newIdx, 0, moved);
    setActions(copy);
  };

  // Insert variable into message
  const insertVariableIntoAction = (actionIdx, fieldKey, tag) => {
    const currentVal = actions[actionIdx]?.config?.[fieldKey] || '';
    updateAction(actionIdx, fieldKey, `${currentVal} ${tag}`.trim());
  };

  // Keywords management for WhatsApp Inbound
  const handleAddKeyword = () => {
    const val = keywordInput.trim().toLowerCase();
    if (val && !keywords.includes(val)) {
      setKeywords((prev) => [...prev, val]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (kw) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  // Test simulation (Dry Run)
  const handleRunTestSimulation = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const primaryAction = actions[0] || {};
      const templateToTest = primaryAction.config?.whatsappMessage || primaryAction.config?.emailBody || 'Hello {{name}}';

      const { data } = await api.post('/automations/test', {
        templateText: templateToTest,
        sampleData: {
          name: 'Aarav Sharma',
          course: 'B.Tech AI & Data Science',
          phone: '+91 98765 43210',
          email: 'aarav.sharma@example.com',
          city: 'Pune',
          status: 'Campus Visit Scheduled',
          counselorName: 'Dr. Ramesh Sharma',
          counselorPhone: '+91 91234 56789',
        },
      });

      setTestResult({
        rendered: data.preview,
        leadUsed: data.leadUsed,
      });
    } catch (err) {
      setTestResult({ error: err?.response?.data?.message || err.message });
    } finally {
      setTestLoading(false);
    }
  };

  // Save / Submit
  const handleSave = async (targetStatus = status) => {
    setLoading(true);
    setError(null);
    setValidationErrors([]);

    try {
      const primaryAction = actions[0] || {};
      const payload = {
        name: name.trim() || 'Untitled Automation',
        description: description.trim(),
        category,
        triggerType,
        triggerConfig: {
          targetStage: targetStage || undefined,
          fromStage: fromStage || undefined,
          daysInStage: triggerType === 'stage_duration' ? Number(daysInStage) : undefined,
          keywords: triggerType === 'whatsapp_inbound' ? keywords : undefined,
          matchType: triggerType === 'whatsapp_inbound' ? matchType : undefined,
          leadSources: triggerType === 'lead_created' && leadSources.length > 0 ? leadSources : undefined,
          conditions: useConditions ? conditions : [],
          conditionsMatch,
        },
        channel: primaryAction.actionType === 'send_email' ? 'email' : 'whatsapp',
        actionType: primaryAction.actionType || 'send_whatsapp',
        delayMinutes: Number(workflowDelayMinutes) || 0,
        actionConfig: {
          templateText: primaryAction.config?.whatsappMessage || primaryAction.config?.emailBody || '',
          emailSubject: primaryAction.config?.emailSubject || '',
          tagToAdd: primaryAction.config?.tagToAdd || '',
          assignedUserId: primaryAction.config?.assignedUserId || null,
          targetCampaignId: primaryAction.config?.targetCampaignId || null,
          newStage: primaryAction.config?.newStage || '',
          transferNote: primaryAction.config?.transferNote || '',
        },
        actions: actions.map((act, idx) => ({
          order: idx + 1,
          actionType: act.actionType,
          delayMinutes: Number(act.delayMinutes || workflowDelayMinutes || 0),
          config: act.config,
        })),
        status: targetStatus,
        isActive: targetStatus === 'active',
      };

      if (initialRule?._id) {
        await api.put(`/automations/${initialRule._id}`, payload);
      } else {
        await api.post('/automations', payload);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save automation:', err);
      const res = err?.response?.data;
      if (res?.errors && Array.isArray(res.errors)) {
        setValidationErrors(res.errors);
      } else {
        setError(res?.message || err.message || 'Failed to save automation rule');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Zap size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                {initialRule ? 'Edit Automation Workflow' : 'Build Custom Automation Workflow'}
                {status === 'draft' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Draft
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Mental Model: When event occurs ➔ Check conditions ➔ Do actions ➔ At scheduled time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!initialRule && (
              <button
                type="button"
                onClick={() => setShowRecipePicker(!showRecipePicker)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 transition flex items-center gap-1.5"
              >
                <Sparkles size={14} className="text-amber-400" />
                Templates
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Step Progression Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between overflow-x-auto scrollbar-none">
          {[
            { num: 1, label: '1. When (Trigger)', desc: 'Choose what starts it' },
            { num: 2, label: '2. Check (Conditions)', desc: 'Define filters' },
            { num: 3, label: '3. Do (Actions)', desc: 'Configure tasks' },
            { num: 4, label: '4. Timing', desc: 'Instant vs delay' },
            { num: 5, label: '5. Review & Save', desc: 'Summary & verify' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num)}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition text-left ${
                currentStep === s.num
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : currentStep > s.num
                  ? 'text-emerald-700 hover:bg-emerald-50'
                  : 'text-slate-500 hover:bg-slate-200/60'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                  currentStep === s.num
                    ? 'bg-white text-indigo-600'
                    : currentStep > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > s.num ? <Check size={12} strokeWidth={3} /> : s.num}
              </div>
              <div>
                <div className="text-xs font-bold whitespace-nowrap">{s.label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Recipe Picker Overlay */}
        {showRecipePicker && (
          <div className="p-4 bg-indigo-50/70 border-b border-indigo-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" />
                Select a Starter Recipe to Pre-populate (You can customize every field):
              </span>
              <button
                type="button"
                onClick={() => setShowRecipePicker(false)}
                className="text-xs text-indigo-700 hover:text-indigo-950 font-bold"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(capabilities.recipes || []).map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => handleApplyRecipe(recipe)}
                  className="p-3 bg-white hover:bg-indigo-50/50 rounded-xl border border-indigo-200/80 text-left transition flex flex-col justify-between group shadow-2xs"
                >
                  <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700">
                    {recipe.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{recipe.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal Body / Step Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Validation & Error Banners */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-amber-600" />
                Please address the following configuration items before saving:
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-700">
                {validationErrors.map((ve, idx) => (
                  <li key={idx}>{ve}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 1: WHEN (TRIGGER) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                  Step 1: Choose What Starts This Automation
                </h3>
                <p className="text-xs text-slate-500">
                  Select the exact real-time event, stage change, or schedule that triggers this workflow.
                </p>
              </div>

              {/* Trigger Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(capabilities.triggers || []).map((trig) => {
                  const isSelected = triggerType === trig.id;
                  return (
                    <button
                      key={trig.id}
                      type="button"
                      onClick={() => setTriggerType(trig.id)}
                      className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-600 shadow-md ring-2 ring-indigo-600/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {trig.badge || 'Trigger'}
                          </span>
                          {isSelected && <CheckCircle2 size={16} className="text-indigo-600" />}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{trig.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                          {trig.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Trigger Configuration Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders size={14} className="text-indigo-600" />
                  Trigger Details: {capabilities.triggers?.find((t) => t.id === triggerType)?.name}
                </div>

                {/* Lead Created Sources Filter */}
                {triggerType === 'lead_created' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Filter by Specific Lead Sources (Optional — leave unselected for all sources):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {LEAD_SOURCE_OPTIONS.map((src) => {
                        const checked = leadSources.includes(src);
                        return (
                          <button
                            key={src}
                            type="button"
                            onClick={() => {
                              setLeadSources((prev) =>
                                checked ? prev.filter((s) => s !== src) : [...prev, src]
                              );
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition border ${
                              checked
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {src.replace('_', ' ')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Stage Changed Config */}
                {triggerType === 'stage_changed' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        When Moved to Stage *
                      </label>
                      <select
                        value={targetStage}
                        onChange={(e) => setTargetStage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Target Stage --</option>
                        {DEFAULT_STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Only if Coming From Stage (Optional)
                      </label>
                      <select
                        value={fromStage}
                        onChange={(e) => setFromStage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Any Previous Stage --</option>
                        {DEFAULT_STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Stage Reached Config */}
                {triggerType === 'stage_reached' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Milestone Stage *
                    </label>
                    <select
                      value={targetStage}
                      onChange={(e) => setTargetStage(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Milestone Stage --</option>
                      {DEFAULT_STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Inactive in Stage Config */}
                {triggerType === 'stage_duration' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Inactive In Stage *
                      </label>
                      <select
                        value={targetStage}
                        onChange={(e) => setTargetStage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Inactive Stage --</option>
                        {DEFAULT_STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Days of Inactivity Threshold *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={daysInStage}
                        onChange={(e) => setDaysInStage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {/* Inbound WhatsApp Keywords */}
                {triggerType === 'whatsapp_inbound' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Trigger Keywords (Press Enter or click Add):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. 'fees', 'brochure', 'visit', 'hi'"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleAddKeyword}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                      >
                        Add
                      </button>
                    </div>

                    {keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {keywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-mono font-bold"
                          >
                            "{kw}"
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(kw)}
                              className="text-emerald-700 hover:text-emerald-950"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-2 text-xs">
                      <span className="font-semibold text-slate-600">Matching Mode:</span>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="matchType"
                          value="contains"
                          checked={matchType === 'contains'}
                          onChange={() => setMatchType('contains')}
                        />
                        <span>Message Contains Keyword</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="matchType"
                          value="exact"
                          checked={matchType === 'exact'}
                          onChange={() => setMatchType('exact')}
                        />
                        <span>Exact Match Only</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 2: CHECK (CONDITIONS) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                  Step 2: Define When This Automation Applies
                </h3>
                <p className="text-xs text-slate-500">
                  Choose whether this automation should run for every record or only when specific CRM conditions are met.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUseConditions(false);
                    setConditions([]);
                  }}
                  className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                    !useConditions
                      ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">Run for All Records</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      No additional filters. Every matching trigger will execute the actions.
                    </div>
                  </div>
                  {!useConditions && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUseConditions(true);
                    if (conditions.length === 0) addCondition();
                  }}
                  className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                    useConditions
                      ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">Only If Conditions Match</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Filter by Lead City, Program, Fee, Counselor, or custom fields.
                    </div>
                  </div>
                  {useConditions && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
                </button>
              </div>

              {/* Condition Rows Builder */}
              {useConditions && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Rule Matching Logic:
                    </span>
                    <div className="inline-flex rounded-xl bg-slate-200 p-0.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setConditionsMatch('all')}
                        className={`px-3 py-1 rounded-lg transition ${
                          conditionsMatch === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Match ALL Conditions (AND)
                      </button>
                      <button
                        type="button"
                        onClick={() => setConditionsMatch('any')}
                        className={`px-3 py-1 rounded-lg transition ${
                          conditionsMatch === 'any' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Match ANY Condition (OR)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {conditions.map((cond, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs"
                      >
                        {/* Field */}
                        <select
                          value={cond.field}
                          onChange={(e) => updateCondition(idx, 'field', e.target.value)}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                        >
                          {(capabilities.fields || []).map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>

                        {/* Operator */}
                        <select
                          value={cond.operator}
                          onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                        >
                          {(capabilities.operators || []).map((op) => (
                            <option key={op.id} value={op.id}>
                              {op.label}
                            </option>
                          ))}
                        </select>

                        {/* Value Input */}
                        {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
                          <input
                            type="text"
                            placeholder="Value to compare..."
                            value={cond.value || ''}
                            onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                          />
                        )}

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => removeCondition(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition self-end sm:self-center"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addCondition}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-indigo-700 text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Another Condition
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 3: DO (ACTIONS BUILDER) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                    Step 3: What Should Happen When Trigger & Conditions Match?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add one or more sequenced actions to execute (e.g. WhatsApp, Email, Assignment, Tagging).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addAction}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus size={14} /> Add Action
                </button>
              </div>

              {/* Actions List */}
              <div className="space-y-4">
                {actions.map((act, actIdx) => (
                  <div
                    key={actIdx}
                    className="p-5 rounded-2xl bg-white border-2 border-slate-200 shadow-xs space-y-4"
                  >
                    {/* Action Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black flex items-center justify-center">
                          {actIdx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          Action #{actIdx + 1}:
                        </span>
                        <select
                          value={act.actionType}
                          onChange={(e) => updateAction(actIdx, 'actionType', e.target.value)}
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-indigo-700"
                        >
                          {(capabilities.actions || []).map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={actIdx === 0}
                          onClick={() => moveAction(actIdx, -1)}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move Up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={actIdx === actions.length - 1}
                          onClick={() => moveAction(actIdx, 1)}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move Down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        {actions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAction(actIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Remove Action"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action Config Fields */}
                    {act.actionType === 'send_whatsapp' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          WhatsApp Message Body:
                        </label>

                        {/* Reusable Variable Bar */}
                        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <Sparkles size={11} className="text-indigo-600" /> Click to Insert Variable:
                          </span>
                          {(capabilities.variables || []).map((v) => (
                            <button
                              key={v.tag}
                              type="button"
                              onClick={() => insertVariableIntoAction(actIdx, 'whatsappMessage', v.tag)}
                              className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 text-[10px] font-mono font-bold transition"
                            >
                              {v.tag}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={4}
                          value={act.config?.whatsappMessage || ''}
                          onChange={(e) => updateAction(actIdx, 'whatsappMessage', e.target.value)}
                          placeholder="Type your WhatsApp message text here..."
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 font-sans"
                        />
                      </div>
                    )}

                    {act.actionType === 'send_email' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Email Subject Line *
                          </label>
                          <input
                            type="text"
                            value={act.config?.emailSubject || ''}
                            onChange={(e) => updateAction(actIdx, 'emailSubject', e.target.value)}
                            placeholder="e.g. Welcome to {{companyName}} - Admissions Prospectus"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Email Body Content *
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-2">
                            <span className="text-[10px] font-bold text-slate-500">Insert Variable:</span>
                            {(capabilities.variables || []).map((v) => (
                              <button
                                key={v.tag}
                                type="button"
                                onClick={() => insertVariableIntoAction(actIdx, 'emailBody', v.tag)}
                                className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 text-[10px] font-mono font-bold transition"
                              >
                                {v.tag}
                              </button>
                            ))}
                          </div>
                          <textarea
                            rows={4}
                            value={act.config?.emailBody || ''}
                            onChange={(e) => updateAction(actIdx, 'emailBody', e.target.value)}
                            placeholder="Dear {{name}}, thank you for reaching out..."
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    {act.actionType === 'assign_counselor' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Select Admissions Counselor / Team Member *
                        </label>
                        <select
                          value={act.config?.assignedUserId || ''}
                          onChange={(e) => updateAction(actIdx, 'assignedUserId', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Choose Counselor --</option>
                          {teamMembers.map((m) => (
                            <option key={m._id} value={m._id}>
                              {m.name} ({m.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {act.actionType === 'transfer_lead' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Reassign to Counselor (Optional)
                          </label>
                          <select
                            value={act.config?.assignedUserId || ''}
                            onChange={(e) => updateAction(actIdx, 'assignedUserId', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                          >
                            <option value="">-- Leave Assignee Unchanged --</option>
                            {teamMembers.map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Route to Campaign Pool (Optional)
                          </label>
                          <select
                            value={act.config?.targetCampaignId || ''}
                            onChange={(e) => updateAction(actIdx, 'targetCampaignId', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                          >
                            <option value="">-- Leave Campaign Unchanged --</option>
                            {campaigns.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.displayName || c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Move Stage To (Optional)
                          </label>
                          <select
                            value={act.config?.newStage || ''}
                            onChange={(e) => updateAction(actIdx, 'newStage', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                          >
                            <option value="">-- Leave Stage Unchanged --</option>
                            {DEFAULT_STAGES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Transfer Note / Audit Reason
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Reassigned to senior desk"
                            value={act.config?.transferNote || ''}
                            onChange={(e) => updateAction(actIdx, 'transferNote', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                          />
                        </div>
                      </div>
                    )}

                    {act.actionType === 'update_lead_stage' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          New Target Stage *
                        </label>
                        <select
                          value={act.config?.newStage || ''}
                          onChange={(e) => updateAction(actIdx, 'newStage', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Select Target Stage --</option>
                          {DEFAULT_STAGES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {act.actionType === 'add_lead_tag' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tag Name to Apply *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 'High Intent', 'Scholarship Eligible', 'VIP'"
                          value={act.config?.tagToAdd || ''}
                          onChange={(e) => updateAction(actIdx, 'tagToAdd', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 4: TIMING */}
          {/* ───────────────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                  Step 4: Configure Execution Timing
                </h3>
                <p className="text-xs text-slate-500">
                  Decide whether actions execute immediately upon trigger detection or after a specified delay.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWorkflowDelayMinutes(0)}
                  className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                    workflowDelayMinutes === 0
                      ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">Run Immediately</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Fastest speed-to-lead. Dispatches within seconds of event.
                    </div>
                  </div>
                  {workflowDelayMinutes === 0 && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setWorkflowDelayMinutes((prev) => (prev === 0 ? 15 : prev))}
                  className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                    workflowDelayMinutes > 0
                      ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">Wait for Delay</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Schedule actions for a natural follow-up interval (e.g. 15m, 1h).
                    </div>
                  </div>
                  {workflowDelayMinutes > 0 && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
                </button>
              </div>

              {workflowDelayMinutes > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                  <label className="block text-xs font-bold text-amber-950">
                    Delay Duration in Minutes:
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="10080"
                      value={workflowDelayMinutes}
                      onChange={(e) => setWorkflowDelayMinutes(Number(e.target.value))}
                      className="w-32 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900"
                    />
                    <div className="flex gap-2">
                      {[5, 15, 30, 60, 1440].map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => setWorkflowDelayMinutes(min)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            workflowDelayMinutes === min
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-600 border-amber-200 hover:bg-amber-100/50'
                          }`}
                        >
                          {min < 60 ? `${min}m` : min === 1440 ? '24h' : `${min / 60}h`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                    <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Durable Background Persistence:</strong> Scheduled delayed actions are safely stored as pending records in MongoDB. If the server or worker restarts during the delay, the cron recovery worker sweeps and executes the job at the exact scheduled timestamp.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 5: REVIEW, TEST & SAVE */}
          {/* ───────────────────────────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                  Step 5: Review Workflow & Choose Activation Status
                </h3>
                <p className="text-xs text-slate-500">
                  Verify the plain-English summary, run a simulated test, and choose whether to activate immediately or save as a draft.
                </p>
              </div>

              {/* Natural Language Summary Card */}
              <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2">
                <div className="text-[10px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-indigo-600" />
                  Plain-English Workflow Summary:
                </div>
                <div className="text-xs font-bold text-indigo-950 leading-relaxed">
                  "{liveSummary}"
                </div>
              </div>

              {/* Workflow Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Workflow Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Meta Ads High-Intent Welcome"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organizational Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="lead_lifecycle">Lead Management & Speed-to-Lead</option>
                    <option value="communication">Omnichannel Messaging</option>
                    <option value="pipeline">Pipeline Stages & Milestones</option>
                    <option value="routing">Counselor Assignment & Routing</option>
                    <option value="inactivity">Inactivity & Follow-up Alarms</option>
                    <option value="chatbots">Inbound WhatsApp Chatbots</option>
                  </select>
                </div>
              </div>

              {/* Live Test Simulation Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Play size={13} className="text-emerald-600" />
                    Test Simulation (Dry-Run Preview):
                  </span>
                  <button
                    type="button"
                    disabled={testLoading}
                    onClick={handleRunTestSimulation}
                    className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-indigo-700 shadow-2xs transition inline-flex items-center gap-1"
                  >
                    {testLoading ? 'Simulating...' : 'Run Dry-Run'}
                  </button>
                </div>

                {testResult?.rendered && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap">
                    {testResult.rendered}
                  </div>
                )}
                {testResult?.error && (
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800">
                    {testResult.error}
                  </div>
                )}
              </div>

              {/* Status Radio Choices */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  Set Initial Automation Status:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStatus('active')}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      status === 'active'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">Executes in background</div>
                    </div>
                    {status === 'active' && <CheckCircle2 size={16} className="text-emerald-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('paused')}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      status === 'paused'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-amber-950">Paused</div>
                      <div className="text-[10px] text-amber-700 mt-0.5">Saved but temporarily off</div>
                    </div>
                    {status === 'paused' && <CheckCircle2 size={16} className="text-amber-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('draft')}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      status === 'draft'
                        ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-400/20'
                        : 'bg-white border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">Draft</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Incomplete / Work in progress</div>
                    </div>
                    {status === 'draft' && <CheckCircle2 size={16} className="text-slate-700" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <ChevronLeft size={16} /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold transition"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-200"
              >
                Next Step <ChevronRight size={16} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSave('draft')}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSave(status)}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-200 flex items-center gap-1.5"
                >
                  {loading ? 'Saving...' : status === 'active' ? 'Activate Workflow' : 'Save Workflow'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
