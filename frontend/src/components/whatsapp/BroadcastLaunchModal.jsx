'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X, Send, Zap, Users, ShieldCheck, Smartphone, Sparkles,
  AlertCircle, CheckCircle2, RefreshCw, FileText, ChevronRight
} from 'lucide-react';

export default function BroadcastLaunchModal({
  isOpen,
  onClose,
  onSuccess,
  metaTemplates = [],
  localTemplates = [],
  baileysConnected = false,
  metaConnected = false,
}) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('meta_cloud'); // 'meta_cloud' | 'baileys'
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState('');
  const [selectedLocalTemplateId, setSelectedLocalTemplateId] = useState('');
  const [customText, setCustomText] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter approved Meta templates only
  const approvedMetaTemplates = metaTemplates.filter(t => t.status === 'APPROVED');

  useEffect(() => {
    if (isOpen) {
      // Default channel based on connectivity
      if (metaConnected && approvedMetaTemplates.length > 0) {
        setChannel('meta_cloud');
      } else if (baileysConnected) {
        setChannel('baileys');
      }

      // Fetch Groups
      setLoadingGroups(true);
      api.get('/groups')
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.groups || []);
          setGroups(list);
          if (list.length > 0 && !selectedGroupId) {
            setSelectedGroupId(list[0]._id);
          }
        })
        .catch(() => toast.error('Failed to load lead groups'))
        .finally(() => setLoadingGroups(false));

      // Set default Meta template if available
      if (approvedMetaTemplates.length > 0) {
        setSelectedMetaTemplate(approvedMetaTemplates[0].name);
      }
    }
  }, [isOpen, metaConnected, baileysConnected, approvedMetaTemplates.length]);

  if (!isOpen) return null;

  const selectedGroup = groups.find(g => g._id === selectedGroupId);
  const activeMetaTmpl = approvedMetaTemplates.find(t => t.name === selectedMetaTemplate);
  const activeLocalTmpl = localTemplates.find(t => t._id === selectedLocalTemplateId);

  const handleInsertVariable = (varName) => {
    setCustomText(prev => `${prev} {{${varName}}}`);
  };

  const handleSelectLocalTmpl = (e) => {
    const tmplId = e.target.value;
    setSelectedLocalTemplateId(tmplId);
    const tmpl = localTemplates.find(t => t._id === tmplId);
    if (tmpl) {
      setCustomText(tmpl.content || tmpl.text || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Please enter a campaign name');
    if (!selectedGroupId) return toast.error('Please select a target lead group');

    if (channel === 'meta_cloud') {
      if (!selectedMetaTemplate) {
        return toast.error('Please select an approved Meta HSM template');
      }
    } else {
      if (!customText.trim()) {
        return toast.error('Please enter message text or select a local template');
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        groupId: selectedGroupId,
        channel,
        template: channel === 'baileys' ? customText.trim() : selectedMetaTemplate,
        templateName: channel === 'meta_cloud' ? selectedMetaTemplate : undefined,
        languageCode: activeMetaTmpl?.language || 'en',
      };

      await api.post('/campaigns', payload);
      toast.success('Broadcast queued successfully! 🚀 Monitor progress in real time.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to launch broadcast');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-linear-to-r from-slate-50 via-white to-indigo-50/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Launch WhatsApp Broadcast
              </h2>
              <p className="text-xs text-slate-500">
                Send personalized bulk updates directly from the CRM without external tools.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} id="broadcast-launch-form" className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Campaign Name */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Broadcast Campaign Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2026 Batch - Merit Scholarship Announcement"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Broadcast Channel Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Select WhatsApp Dispatch Channel <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Meta Cloud API */}
              <div
                onClick={() => setChannel('meta_cloud')}
                className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                  channel === 'meta_cloud'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      Meta Cloud API (HSM)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      High Speed
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Pre-approved Meta templates. Zero phone block risk; dispatches at scale via Meta servers.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${metaConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                  <span className="text-slate-600 font-medium">
                    {metaConnected ? 'Official WABA Connected' : 'Requires WABA Connection'}
                  </span>
                </div>
              </div>

              {/* Baileys Direct Line */}
              <div
                onClick={() => setChannel('baileys')}
                className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                  channel === 'baileys'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      Direct Baileys Line
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      Personalized
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    P2P delivery from connected counselor phone with anti-spam random jitter (3–7s delay).
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${baileysConnected ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                  <span className="text-slate-600 font-medium">
                    {baileysConnected ? 'Phone Line Linked' : 'Phone Not Linked'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Target Group */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Target Lead Audience <span className="text-rose-500">*</span>
              </label>
              {selectedGroup && (
                <span className="text-[11px] font-semibold text-indigo-600">
                  {selectedGroup.leadCount || selectedGroup.leadIds?.length || 0} Leads in group
                </span>
              )}
            </div>

            {loadingGroups ? (
              <div className="py-3 text-center text-xs text-slate-400">Loading groups...</div>
            ) : groups.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                No audience groups found. Please create a group in the Contacts/Groups section first.
              </div>
            ) : (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {groups.map(g => (
                  <option key={g._id} value={g._id}>
                    {g.name} ({g.type === 'tag_based' ? `Tag: ${g.tags?.join(', ')}` : `${g.leadIds?.length || 0} leads`})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template / Message Content depending on channel */}
          {channel === 'meta_cloud' ? (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  Select Meta-Approved HSM Template <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  {approvedMetaTemplates.length} approved template(s)
                </span>
              </div>

              {approvedMetaTemplates.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">No Approved Meta Templates Available</p>
                  <p className="text-[11px]">
                    Submit a template for approval in the Template Library or switch to Direct Baileys Line.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedMetaTemplate}
                  onChange={(e) => setSelectedMetaTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {approvedMetaTemplates.map(tmpl => (
                    <option key={tmpl.name} value={tmpl.name}>
                      {tmpl.name} [{tmpl.category} &bull; {tmpl.language}]
                    </option>
                  ))}
                </select>
              )}

              {/* Template Body Preview */}
              {activeMetaTmpl && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Template Message Preview
                  </p>
                  <p className="text-slate-800 leading-relaxed font-sans">
                    {activeMetaTmpl.components?.find(c => c.type === 'BODY')?.text || 'No body text'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  Baileys Message Content <span className="text-rose-500">*</span>
                </label>
                {localTemplates.length > 0 && (
                  <span className="text-[11px] text-slate-500">
                    Or pick from {localTemplates.length} local template(s)
                  </span>
                )}
              </div>

              {localTemplates.length > 0 && (
                <select
                  value={selectedLocalTemplateId}
                  onChange={handleSelectLocalTmpl}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium mb-2"
                >
                  <option value="">-- Choose from Local Canned Templates (Optional) --</option>
                  {localTemplates.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name || t.title}
                    </option>
                  ))}
                </select>
              )}

              {/* Variable Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">Insert:</span>
                {['name', 'course', 'phone', 'college', 'city'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleInsertVariable(v)}
                    className="px-2 py-0.5 text-[11px] font-mono rounded-lg bg-white border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 transition"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>

              <textarea
                required
                rows={4}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Enter message to send to leads. Use {{name}} to personalize..."
                className="w-full p-3 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
              />

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Anti-spam random delays of 3–7 seconds will be applied automatically.
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="broadcast-launch-form"
            disabled={submitting || (channel === 'meta_cloud' && approvedMetaTemplates.length === 0)}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Queueing Broadcast...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Start Broadcast
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
