'use client';
import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X, CheckCircle2, FileText, Globe, Tag, Send, AlertCircle, RefreshCw,
  Sparkles, Smartphone, Eye, Plus, Trash2, ExternalLink, Phone,
  CornerDownLeft, MessageSquare, ShieldCheck, HelpCircle, CheckCheck
} from 'lucide-react';

const CATEGORIES = [
  { value: 'UTILITY', label: 'Utility', desc: 'Confirmations, counseling updates, document requests (Higher approval rate)' },
  { value: 'MARKETING', label: 'Marketing', desc: 'Admissions announcements, scholarship offers, campus open day invites' },
  { value: 'AUTHENTICATION', label: 'Authentication', desc: 'One-time passwords, login codes, verification' },
];

const LANGUAGES = [
  { code: 'en_US', name: 'English (US)' },
  { code: 'en', name: 'English (UK / Global)' },
  { code: 'hi', name: 'Hindi (हिंदी)' },
  { code: 'es', name: 'Spanish' },
  { code: 'ar', name: 'Arabic' },
];

const META_PRESETS = [
  {
    name: 'admission_enquiry_followup',
    title: 'Admission Enquiry Follow-up',
    category: 'UTILITY',
    headerText: 'Admissions Update 🎓',
    bodyText: 'Hello {{1}}, thank you for inquiring about the {{2}} program at Mayalok Institute. Our senior admissions counselor {{3}} will assist you with the syllabus and eligibility criteria. Would you like to schedule a 10-minute briefing call?',
    footerText: 'Mayalok Institute Admissions Desk',
    samples: { 1: 'Aarav Sharma', 2: 'B.Tech Computer Science', 3: 'Priya Verma' },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Yes, Call Me' },
      { type: 'QUICK_REPLY', text: 'Send Brochure' },
    ],
  },
  {
    name: 'document_verification_notice',
    title: 'Document Verification Notice',
    category: 'UTILITY',
    headerText: 'Action Required 📄',
    bodyText: 'Dear {{1}}, we are reviewing your application for {{2}}. Please upload your pending 12th marksheets and ID proof by {{3}} to finalize your provisional admission.',
    footerText: 'Reply HELP if you need assistance',
    samples: { 1: 'Sneha Patel', 2: 'BBA Honours', 3: 'Friday, 5:00 PM' },
    buttons: [
      { type: 'URL', text: 'Upload Marksheets', url: 'https://admissions.mayalok.edu/portal' },
      { type: 'PHONE_NUMBER', text: 'Call Helpdesk', phone_number: '+919876543210' },
    ],
  },
  {
    name: 'merit_scholarship_award',
    title: 'Merit Scholarship Award',
    category: 'MARKETING',
    headerText: 'Scholarship Award Notice 🏆',
    bodyText: 'Congratulations {{1}}! 🎉 Based on your academic score, you have been shortlisted for a {{2}}% Merit Scholarship for the {{3}} batch. Secure your seat before {{4}} to lock in your concession.',
    footerText: 'Terms & conditions apply',
    samples: { 1: 'Rohan Mehra', 2: '35', 3: 'MBA Executive 2026', 4: 'November 15' },
    buttons: [
      { type: 'URL', text: 'Claim Scholarship', url: 'https://admissions.mayalok.edu/scholarships' },
      { type: 'QUICK_REPLY', text: 'Talk to Counselor' },
    ],
  },
  {
    name: 'campus_openday_invite',
    title: 'Campus Open Day & Workshop',
    category: 'MARKETING',
    headerText: 'Campus Open Day Invitation 🏛️',
    bodyText: 'Namaste {{1}}! You are cordially invited to our Campus Open Day on {{2}}. Experience live lab demonstrations, meet faculty heads for {{3}}, and receive immediate profile evaluation.',
    footerText: 'Mayalok Campus, Sector 62',
    samples: { 1: 'Ananya Roy', 2: 'Saturday at 10:00 AM', 3: 'AI & Data Science' },
    buttons: [
      { type: 'QUICK_REPLY', text: 'I am Attending' },
      { type: 'URL', text: 'View Campus Map', url: 'https://maps.google.com' },
    ],
  },
  {
    name: 'interview_slot_confirmed',
    title: 'Interview Slot Confirmation',
    category: 'UTILITY',
    headerText: 'Counseling Slot Confirmed 🗓️',
    bodyText: 'Hi {{1}}, your 1-on-1 counseling appointment for {{2}} is confirmed for {{3}} with {{4}}. Please be available on this number for the call.',
    footerText: 'Mayalok Admissions Office',
    samples: { 1: 'Vikram Joshi', 2: 'M.Tech Robotics', 3: 'Tomorrow at 3:30 PM', 4: 'Dr. Anand' },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirm Slot' },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
    ],
  },
];

export default function MetaTemplateModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [language, setLanguage] = useState('en_US');
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('Hello {{1}}, thank you for inquiring about {{2}} at Mayalok Admissions. Our team is ready to assist you.');
  const [footerText, setFooterText] = useState('Reply STOP to unsubscribe');
  const [sampleValues, setSampleValues] = useState({ 1: 'Aarav Sharma', 2: 'B.Tech Computer Science' });
  const [buttons, setButtons] = useState([]);
  const [previewMode, setPreviewMode] = useState('sample'); // 'sample' | 'raw'
  const [loading, setLoading] = useState(false);

  // Extract detected variables {{1}}, {{2}}, etc. from body text
  const detectedVariables = useMemo(() => {
    const matches = bodyText.match(/{{\s*(\d+)\s*}}/g) || [];
    const numbers = matches.map(m => parseInt(m.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    return Array.from(new Set(numbers)).sort((a, b) => a - b);
  }, [bodyText]);

  const getSampleForVar = (num) => {
    return sampleValues[num] !== undefined ? sampleValues[num] : `Sample ${num}`;
  };

  if (!isOpen) return null;

  // Apply a pre-built educational template preset
  const handleApplyPreset = (preset) => {
    setName(preset.name);
    setCategory(preset.category);
    setHeaderText(preset.headerText || '');
    setBodyText(preset.bodyText);
    setFooterText(preset.footerText || '');
    setSampleValues(preset.samples || {});
    setButtons(preset.buttons ? JSON.parse(JSON.stringify(preset.buttons)) : []);
    toast.success(`Meta preset "${preset.title}" applied! ✨`);
  };

  // Add next variable {{n}} to body text
  const handleInsertNextVariable = () => {
    const nextNum = detectedVariables.length > 0 ? Math.max(...detectedVariables) + 1 : 1;
    setBodyText(prev => `${prev} {{${nextNum}}}`);
  };

  // Insert formatting wrapper
  const handleFormatText = (prefix, suffix = prefix) => {
    setBodyText(prev => `${prev} ${prefix}highlighted${suffix}`);
  };

  // Add a button
  const handleAddButton = (type) => {
    if (buttons.length >= 3) {
      return toast.error('Meta templates support a maximum of 3 buttons');
    }
    if (type === 'QUICK_REPLY') {
      setButtons(prev => [...prev, { type: 'QUICK_REPLY', text: 'Quick Reply' }]);
    } else if (type === 'URL') {
      setButtons(prev => [...prev, { type: 'URL', text: 'Visit Website', url: 'https://' }]);
    } else if (type === 'PHONE_NUMBER') {
      setButtons(prev => [...prev, { type: 'PHONE_NUMBER', text: 'Call Desk', phone_number: '+91' }]);
    }
  };

  const handleRemoveButton = (index) => {
    setButtons(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateButton = (index, field, value) => {
    setButtons(prev => prev.map((btn, i) => (i === index ? { ...btn, [field]: value } : btn)));
  };

  // Render preview body text with sample variables or raw tags
  const renderPreviewBody = () => {
    let text = bodyText || '';
    if (previewMode === 'sample') {
      detectedVariables.forEach(num => {
        const val = getSampleForVar(num);
        text = text.replace(new RegExp(`{{\\s*${num}\\s*}}`, 'g'), val);
      });
    }

    // Format lines with linebreaks
    const parts = text.split('\n').map((line, lineIdx) => {
      return (
        <span key={lineIdx} className="block min-h-[1.1rem]">
          {line || '\u00A0'}
        </span>
      );
    });

    return parts;
  };

  // Validation checks
  const isNameValid = /^[a-z0-9_]+$/.test(name.trim()) && name.trim().length >= 2;
  const areVariablesSequential = detectedVariables.every((val, idx) => val === idx + 1);
  const areAllSamplesProvided = detectedVariables.every(num => Boolean(getSampleForVar(num)?.trim()));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formattedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!formattedName || !isNameValid) {
      return toast.error('Template name must contain only lowercase letters, numbers, and underscores (e.g. admission_update)');
    }
    if (!bodyText.trim()) {
      return toast.error('Template body text is required');
    }
    if (!areVariablesSequential) {
      return toast.error('Meta requires variables to start sequentially: {{1}}, {{2}}, {{3}} without gaps.');
    }
    if (!areAllSamplesProvided) {
      return toast.error('Please provide sample values for all variables. Meta requires samples for AI verification.');
    }

    const components = [];

    // 1. Header (if specified)
    if (headerText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: headerText.trim(),
      });
    }

    // 2. Body with Meta-required sample values
    const bodyComponent = {
      type: 'BODY',
      text: bodyText.trim(),
    };

    if (detectedVariables.length > 0) {
      const sampleArray = detectedVariables.map(num => sampleValues[num]?.trim() || `Sample ${num}`);
      bodyComponent.example = {
        body_text: [sampleArray],
      };
    }
    components.push(bodyComponent);

    // 3. Footer (if specified)
    if (footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText.trim(),
      });
    }

    // 4. Buttons (if specified)
    if (buttons.length > 0) {
      const formattedButtons = buttons.map(b => {
        if (b.type === 'QUICK_REPLY') {
          return { type: 'QUICK_REPLY', text: b.text.trim() };
        }
        if (b.type === 'URL') {
          return { type: 'URL', text: b.text.trim(), url: b.url.trim() };
        }
        if (b.type === 'PHONE_NUMBER') {
          return { type: 'PHONE_NUMBER', text: b.text.trim(), phone_number: b.phone_number.trim() };
        }
        return b;
      });

      components.push({
        type: 'BUTTONS',
        buttons: formattedButtons,
      });
    }

    setLoading(true);
    try {
      await api.post('/whatsapp/meta/templates', {
        name: formattedName,
        category,
        language,
        components,
      });
      toast.success('Template submitted to Meta for approval! 🚀 (Review usually takes 2–15 mins)');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit template to Meta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-linear-to-r from-slate-50 via-white to-indigo-50/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Meta WhatsApp Template Studio
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Official Cloud HSM
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Design compliant message templates for bulk broadcasting outside the 24-hour service window.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Content Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column: Form & Configuration (7 cols) */}
          <div className="lg:col-span-7 p-6 overflow-y-auto space-y-5 border-r border-slate-200 min-h-0">
            {/* Quick Presets Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Quick Presets for Fast Approval
                </label>
                <span className="text-[11px] text-slate-400">1-click ready</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {META_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                  >
                    <span>{preset.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Identifier & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. admission_update_2026"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${
                    name && !isNameValid ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300 focus:ring-indigo-500'
                  } bg-white text-slate-900 focus:outline-hidden focus:ring-2`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Lowercase, digits and underscores only.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label} ({c.value})</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 truncate">
                  {CATEGORIES.find(c => c.value === category)?.desc}
                </p>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Template Language <span className="text-rose-500">*</span>
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                ))}
              </select>
            </div>

            {/* Header (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Header (Optional)
                </label>
                <span className="text-[10px] text-slate-400">{headerText.length}/60 chars</span>
              </div>
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. Mayalok Admissions Update 🎓"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Body Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Body Content <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInsertNextVariable}
                    className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Insert Variable
                  </button>
                  <span className="text-[10px] text-slate-400">{bodyText.length}/1024 chars</span>
                </div>
              </div>

              {/* Formatting helper bar */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[11px] font-medium text-slate-500 px-1">Formatting:</span>
                <button
                  type="button"
                  onClick={() => handleFormatText('*')}
                  className="px-2 py-0.5 rounded-md hover:bg-slate-200 text-slate-700 font-bold"
                  title="Bold"
                >
                  *B*
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatText('_')}
                  className="px-2 py-0.5 rounded-md hover:bg-slate-200 text-slate-700 italic"
                  title="Italic"
                >
                  _I_
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatText('~')}
                  className="px-2 py-0.5 rounded-md hover:bg-slate-200 text-slate-700 line-through"
                  title="Strikethrough"
                >
                  ~S~
                </button>
              </div>

              <textarea
                required
                rows={5}
                maxLength={1024}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Write your message body here. Use {{1}}, {{2}} for dynamic variables..."
                className="w-full p-3 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
              />
            </div>

            {/* Variable Sample Values (Required by Meta for approval) */}
            {detectedVariables.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-900">
                      Sample Values Required by Meta AI Review
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-medium">
                    {detectedVariables.length} variable(s) detected
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-normal">
                  Meta requires real sample data for every variable to verify compliance before approving your template.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {detectedVariables.map((num) => (
                    <div key={num}>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                        Sample for <code>{`{{${num}}}`}</code>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={`e.g. Sample value for {{${num}}}`}
                        value={sampleValues[num] || ''}
                        onChange={(e) =>
                          setSampleValues(prev => ({ ...prev, [num]: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Footer Text (Optional)
                </label>
                <span className="text-[10px] text-slate-400">{footerText.length}/60 chars</span>
              </div>
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. Reply STOP to opt out"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Interactive Buttons (Optional) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Interactive Buttons ({buttons.length}/3)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddButton('QUICK_REPLY')}
                    disabled={buttons.length >= 3}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-40"
                  >
                    + Quick Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddButton('URL')}
                    disabled={buttons.length >= 3}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-40"
                  >
                    + Website URL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddButton('PHONE_NUMBER')}
                    disabled={buttons.length >= 3}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-40"
                  >
                    + Call Button
                  </button>
                </div>
              </div>

              {buttons.map((btn, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500" />}
                      {btn.type === 'URL' && <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />}
                      {btn.type === 'PHONE_NUMBER' && <Phone className="w-3.5 h-3.5 text-indigo-500" />}
                      Button {index + 1}: {btn.type.replace('_', ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveButton(index)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Button Label</label>
                      <input
                        type="text"
                        maxLength={25}
                        placeholder="Button text"
                        value={btn.text}
                        onChange={(e) => handleUpdateButton(index, 'text', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900"
                      />
                    </div>
                    {btn.type === 'URL' && (
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Website URL</label>
                        <input
                          type="url"
                          placeholder="https://example.com"
                          value={btn.url || ''}
                          onChange={(e) => handleUpdateButton(index, 'url', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900"
                        />
                      </div>
                    )}
                    {btn.type === 'PHONE_NUMBER' && (
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Phone Number (with country code)</label>
                        <input
                          type="tel"
                          placeholder="+919876543210"
                          value={btn.phone_number || ''}
                          onChange={(e) => handleUpdateButton(index, 'phone_number', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live WhatsApp Phone Preview (5 cols) */}
          <div className="lg:col-span-5 p-6 bg-slate-100/70 flex flex-col items-center justify-start overflow-y-auto">
            {/* View Mode Toggle */}
            <div className="w-full max-w-sm flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Live Preview
              </span>
              <div className="flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
                <button
                  type="button"
                  onClick={() => setPreviewMode('sample')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                    previewMode === 'sample'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  With Samples
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('raw')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                    previewMode === 'raw'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Raw Variables
                </button>
              </div>
            </div>

            {/* Smartphone Frame Mockup */}
            <div className="w-full max-w-[340px] rounded-[36px] bg-slate-900 p-3 shadow-2xl border-4 border-slate-800">
              {/* Phone Speaker Notch */}
              <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-10 h-1 bg-slate-700 rounded-full" />
              </div>

              {/* Screen Area */}
              <div className="bg-[#efeae2] rounded-[26px] overflow-hidden flex flex-col min-h-[440px] shadow-inner relative">
                {/* WhatsApp Chat Header */}
                <div className="bg-[#075e54] text-white px-3 py-2.5 flex items-center gap-2.5 shrink-0 shadow-xs">
                  <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold border border-emerald-500/50">
                    M
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold truncate">Mayalok Admissions</p>
                      <CheckCircle2 className="w-3 h-3 text-emerald-300 fill-emerald-300/30 shrink-0" />
                    </div>
                    <p className="text-[10px] text-emerald-100 truncate">Official Business Account</p>
                  </div>
                </div>

                {/* Chat Wallpaper Area */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {/* Encryption Notice */}
                  <div className="bg-[#ffeecd] border border-[#f3d99e] text-[#54656f] text-[10px] p-2 rounded-xl text-center shadow-2xs font-medium leading-tight">
                    🔒 Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen.
                  </div>

                  {/* WhatsApp Message Bubble */}
                  <div className="ml-auto max-w-[92%] bg-[#d9fdd3] text-slate-800 rounded-2xl rounded-tr-xs p-3 shadow-sm border border-[#c4eabf] space-y-1.5 relative">
                    {/* Header */}
                    {headerText.trim() && (
                      <p className="font-bold text-xs text-slate-900 pb-0.5 border-b border-[#c4eabf]/50">
                        {headerText}
                      </p>
                    )}

                    {/* Body Text */}
                    <div className="text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap break-words">
                      {renderPreviewBody()}
                    </div>

                    {/* Footer */}
                    {footerText.trim() && (
                      <p className="text-[10px] text-slate-500 italic pt-0.5">
                        {footerText}
                      </p>
                    )}

                    {/* Time & Read Ticks */}
                    <div className="flex items-center justify-end gap-1 pt-0.5">
                      <span className="text-[9px] text-slate-500">10:42 AM</span>
                      <CheckCheck className="w-3 h-3 text-sky-500" />
                    </div>
                  </div>

                  {/* Buttons Rendered Outside Bubble */}
                  {buttons.length > 0 && (
                    <div className="ml-auto max-w-[92%] space-y-1">
                      {buttons.map((btn, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-xl py-2 px-3 text-center text-xs font-semibold text-emerald-700 shadow-xs border border-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-50 transition"
                        >
                          {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="w-3 h-3 text-emerald-600" />}
                          {btn.type === 'URL' && <ExternalLink className="w-3 h-3 text-emerald-600" />}
                          {btn.type === 'PHONE_NUMBER' && <Phone className="w-3 h-3 text-emerald-600" />}
                          <span>{btn.text || `Button ${i + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Meta Approval Readiness Checklist */}
            <div className="w-full max-w-sm mt-4 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Meta Approval Readiness
              </p>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className={isNameValid ? 'text-emerald-600' : 'text-slate-400'}>
                    {isNameValid ? '✓' : '○'}
                  </span>
                  <span className={isNameValid ? 'text-slate-700' : 'text-slate-400'}>
                    Name syntax valid (lowercase &amp; underscores)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={areVariablesSequential ? 'text-emerald-600' : 'text-slate-400'}>
                    {areVariablesSequential ? '✓' : '○'}
                  </span>
                  <span className={areVariablesSequential ? 'text-slate-700' : 'text-slate-400'}>
                    Variables sequential ({`{{1}}, {{2}}...`})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={areAllSamplesProvided ? 'text-emerald-600' : 'text-slate-400'}>
                    {areAllSamplesProvided ? '✓' : '○'}
                  </span>
                  <span className={areAllSamplesProvided ? 'text-slate-700' : 'text-slate-400'}>
                    Sample values populated for Meta AI
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/70 shrink-0">
          <p className="text-xs text-slate-500 hidden sm:block">
            Once submitted, Meta automated systems evaluate templates in ~2–15 minutes.
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-200/60 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !isNameValid || !areVariablesSequential || !areAllSamplesProvided}
              className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Submitting to Meta...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Template to Meta
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
