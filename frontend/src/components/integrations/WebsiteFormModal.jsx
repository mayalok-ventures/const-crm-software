'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  Globe, Check, Copy, ArrowRight, ShieldCheck, Code2, AlertCircle, RefreshCw
} from 'lucide-react';

export default function WebsiteFormModal({ isOpen = true, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [origins, setOrigins] = useState('');
  const [defaultCampaign, setDefaultCampaign] = useState('Website Inbound');
  const [loading, setLoading] = useState(false);
  const [createdDoc, setCreatedDoc] = useState(null);
  const [embedCode, setEmbedCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  if (isOpen === false) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a form name');
      return;
    }
    const originList = origins.split(',').map(o => o.trim()).filter(Boolean);
    if (originList.length === 0) {
      toast.error('Please specify at least one allowed domain (or * for testing)');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/integrations', {
        provider: 'website',
        accountName: name.trim(),
        defaultCampaignLabel: defaultCampaign.trim() || 'Website Inbound',
        websiteFormConfig: {
          allowedOrigins: originList,
        },
      });

      const intDoc = res.data.integration;
      setCreatedDoc(intDoc);

      const snippetRes = await api.get(`/integrations/${intDoc._id}/snippet`);
      setEmbedCode(snippetRes.data.snippet);
      toast.success('Website form created successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create website form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-white space-y-6">

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Embed Website Lead Form</h3>
              <p className="text-xs text-slate-400">Zero-backend HTML form snippet for landing pages and university portals</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">✕</button>
        </div>

        {!createdDoc ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Form Name / Location <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Homepage Inquiry Modal / Admissions 2026"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Default Campaign Label
              </label>
              <input
                type="text"
                value={defaultCampaign}
                onChange={(e) => setDefaultCampaign(e.target.value)}
                placeholder="e.g. Website Organic Admissions"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Falls back to this if the form submission lacks a <code className="text-purple-300">utm_campaign</code> parameter.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Allowed Domain Origins <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                placeholder="e.g. mycollege.edu, apply.mycollege.edu (or * for testing)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Comma-separated list of approved web domains allowed to submit to this form (anti-CORS hijacking).
              </p>
            </div>

            {/* Anti-abuse Rate Limiter Info (Part 4) */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" /> Built-in Anti-Abuse Protections:
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed pl-5">
                Rate limited to <strong>30 submissions per 10 minutes per IP</strong> to prevent spam bots from flooding the counselor queue, paired with an invisible honeypot trap field.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                disabled={loading}
                onClick={handleCreate}
                className="px-6 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold flex items-center gap-2 transition"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Generate HTML Embed
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
              <span>Embed HTML Snippet</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(embedCode);
                  setCopiedCode(true);
                  toast.success('Embed code copied!');
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copied' : 'Copy HTML'}
              </button>
            </div>

            <pre className="w-full max-h-60 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-purple-200/90 leading-relaxed">
              {embedCode}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
