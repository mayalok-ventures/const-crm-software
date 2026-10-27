'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X, MessageSquare, Sparkles, Check, FileText, Smartphone,
  Tag, Send, RefreshCw, Copy, CheckCheck
} from 'lucide-react';
import { format } from 'date-fns';

const LOCAL_PRESETS = [
  {
    title: 'Admissions Welcome & Introduction',
    category: 'admission',
    text: 'Namaste {{name}}! 🙏\n\nMain Mayalok Admissions team se bol raha hoon. Aapne hamare {{course}} program ke liye enquiry submit ki thi.\n\nKya hum abhi 5 minute connect kar sakte hain details discuss karne ke liye?',
  },
  {
    title: 'Prospectus & Curriculum Share',
    category: 'admission',
    text: 'Hello {{name}}! 📄\n\nAapke request ke mutabiq, {{course}} ka complete syllabus, eligibility aur placement report share kar raha hoon.\n\nKripya ise review karein aur koi bhi doubt ho toh yahan reply karein.',
  },
  {
    title: 'Counseling Follow-Up #1',
    category: 'follow_up',
    text: 'Hi {{name}}! 😊\n\nBas check kar raha tha ki aapko course details mil gayi? Next batch ke seats fast fill ho rahi hain.\n\nKya main aapka counselor slot confirm kar doon?',
  },
  {
    title: 'Scholarship & Fee Concession',
    category: 'scholarship',
    text: 'Congratulations {{name}}! 🎓\n\nAapke academic record ke basis par aap 25% merit scholarship ke liye qualify ho chuke hain for {{course}}.\n\nFee structure discuss karne ke liye kab baat ho sakti hai?',
  },
  {
    title: 'Campus Visit Invitation',
    category: 'schedule',
    text: 'Namaste {{name}}! 🏛️\n\nAap weekend par campus tour aur faculty se milne ke liye सादर aamantrit hain.\n\nKya aap Saturday ya Sunday ko visit plan kar sakte hain?',
  },
];

const CATEGORIES = [
  { value: 'general', label: 'General Message' },
  { value: 'admission', label: 'Admission Prospectus' },
  { value: 'follow_up', label: 'Counseling Follow-up' },
  { value: 'scholarship', label: 'Scholarships & Grants' },
  { value: 'schedule', label: 'Campus Visit / Call Schedule' },
  { value: 'fees', label: 'Fee Structure' },
];

export default function LocalTemplateModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(initialData?._id);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || initialData.name || '');
        setCategory(initialData.category || 'general');
        setText(initialData.text || initialData.content || '');
      } else {
        setTitle('');
        setCategory('general');
        setText('Namaste {{name}}, thank you for contacting admissions regarding {{course}}.');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset) => {
    setTitle(preset.title);
    setCategory(preset.category);
    setText(preset.text);
    toast.success(`Preset "${preset.title}" applied! ✨`);
  };

  const insertVariable = (variable) => {
    setText((prev) => prev + ` {{${variable}}}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Template title is required');
    if (!text.trim()) return toast.error('Template text is required');

    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/templates/${initialData._id}`, {
          title: title.trim(),
          name: title.trim(),
          text: text.trim(),
          content: text.trim(),
          category,
          channel: 'WHATSAPP',
        });
        toast.success('Local template updated successfully! ✅');
      } else {
        await api.post('/templates', {
          title: title.trim(),
          name: title.trim(),
          text: text.trim(),
          content: text.trim(),
          category,
          channel: 'WHATSAPP',
        });
        toast.success('Local template created successfully! 🚀');
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  // Preview replacement: replace {{name}} and {{course}} with sample student values
  const previewText = text
    .replace(/{{\s*name\s*}}/gi, 'Rahul Sharma')
    .replace(/{{\s*course\s*}}/gi, 'MBA in Marketing')
    .replace(/{{\s*phone\s*}}/gi, '+91 98765 43210')
    .replace(/{{\s*company\s*}}/gi, 'Mayalok Education');

  // Format WhatsApp basic markdown (*bold*, _italic_, ~strike~)
  const formattedPreviewText = previewText
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">
                {isEdit ? 'Edit Local WhatsApp Template' : 'Create Local WhatsApp Template'}
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Canned response for fast 1-tap counselor replies via connected phone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 2-Column Layout (Builder + Live WhatsApp Phone Preview) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left Column: Form Controls (7 cols) */}
          <form onSubmit={handleSubmit} id="local-template-form" className="lg:col-span-7 p-6 space-y-4">
            {/* Quick Industry Presets */}
            {!isEdit && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Quick High-Converting Presets
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {LOCAL_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap transition cursor-pointer"
                    >
                      {p.title.split(' ')[0]} {p.title.split(' ')[1] || ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Template Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Template Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MBA Course Fee Breakdown & Prospectus"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Message Body & Variable Inserters */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Message Content *
                </label>
                <span className="text-[11px] text-slate-400">
                  Supports *bold*, _italic_, ~strikethrough~
                </span>
              </div>

              {/* Dynamic Variable Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Insert Tag:
                </span>
                {['name', 'course', 'phone', 'company'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-slate-700 text-[11px] font-mono transition cursor-pointer"
                  >
                    +{`{${v}}`}
                  </button>
                ))}
              </div>

              <textarea
                rows={7}
                required
                placeholder="Type your WhatsApp message template here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full p-3.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans leading-relaxed resize-y"
              />
            </div>
          </form>

          {/* Right Column: Real-time Live WhatsApp Phone Preview (5 cols) */}
          <div className="lg:col-span-5 p-6 bg-slate-100/70 flex flex-col items-center justify-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              Live WhatsApp Preview
            </span>

            {/* Simulated Phone Shell */}
            <div className="w-full max-w-[320px] rounded-3xl border-4 border-slate-800 bg-[#efeae2] shadow-xl overflow-hidden flex flex-col">
              {/* WhatsApp App Bar */}
              <div className="bg-[#075e54] text-white px-3.5 py-2.5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0">
                  MC
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold leading-tight truncate">Mayalok Admissions</p>
                  <p className="text-[10px] text-emerald-200 leading-tight">Online • verified</p>
                </div>
              </div>

              {/* Chat Canvas with Doodle Wallpaper Background */}
              <div
                className="p-3.5 min-h-[280px] max-h-[360px] overflow-y-auto flex flex-col justify-end"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
                  backgroundSize: '12px 12px',
                }}
              >
                {/* Date Stamp */}
                <div className="text-center my-2">
                  <span className="bg-white/80 backdrop-blur-xs text-[10px] text-slate-600 font-medium px-2 py-0.5 rounded-full shadow-2xs">
                    Today
                  </span>
                </div>

                {/* Sent WhatsApp Message Bubble */}
                <div className="self-end max-w-[92%] bg-[#dcf8c6] text-slate-900 rounded-2xl rounded-tr-none p-3 shadow-xs text-xs relative space-y-1">
                  <div
                    className="whitespace-pre-wrap leading-relaxed text-[12px] font-sans break-words"
                    dangerouslySetInnerHTML={{
                      __html: formattedPreviewText || '<span class="text-slate-400 italic">Type message text...</span>',
                    }}
                  />
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 pt-0.5">
                    <span>{format(new Date(), 'HH:mm')}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-sky-600 inline" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Candidate variables will auto-fill from CRM lead profile
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/80">
          <span className="text-xs text-slate-500">
            Channel: <strong className="text-emerald-700">WhatsApp (Baileys &amp; Canned)</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="local-template-form"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {isEdit ? 'Update Template' : 'Save Local Template'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
