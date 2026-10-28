'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  Zap, Check, Copy, ArrowRight, Shield, Code2, Play,
  CheckCircle2, RefreshCw, Eye
} from 'lucide-react';

export default function CustomWebhookModal({ isOpen = true, onClose, onSuccess, members = [] }) {
  const [name, setName] = useState('');
  const [defaultCampaign, setDefaultCampaign] = useState('Custom Webhook Inbound');
  const [assignmentType, setAssignmentType] = useState('round_robin');
  const [specificCounselorId, setSpecificCounselorId] = useState('');

  const [createdDoc, setCreatedDoc] = useState(null);
  const [secretKey, setSecretKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isOpen === false) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a channel name');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/integrations', {
        provider: 'custom',
        accountName: name.trim(),
        defaultCampaignLabel: defaultCampaign.trim() || 'Custom Inbound',
        assignmentRule: {
          type: assignmentType,
          specificCounselorId: specificCounselorId || null,
          skipInactive: true,
        },
      });

      setCreatedDoc(res.data.integration);
      setSecretKey(res.data.plaintextSecretOnce || '');
      toast.success('Custom webhook channel created!');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create custom webhook');
    } finally {
      setLoading(false);
    }
  };

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://api-app.sahyak.com');
  const webhookUrl = createdDoc ? `${backendUrl}/api/integrations/custom/webhook/${createdDoc._id}` : '';

  const sampleCurl = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-crm-secret: ${secretKey}" \\
  -d '{
    "name": "Alex Mercer",
    "phone": "+919876543210",
    "email": "alex.mercer@example.com",
    "city": "Bengaluru",
    "course": "MBA Tech",
    "campaign": "${defaultCampaign}"
  }'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-white space-y-6">

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Custom Inbound Webhook</h3>
              <p className="text-xs text-slate-400">Connect Zapier, Make, JustDial, LinkedIn, HubSpot, etc.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">✕</button>
        </div>

        {!createdDoc ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Channel / Integration Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zapier LinkedIn Lead Gen"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
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
                placeholder="e.g. LinkedIn Sponsored Ads 2026"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Used when the JSON payload doesn't contain a specific "campaign" field.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Assignment Rule</label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setAssignmentType('round_robin')}
                  className={`p-3 rounded-xl border cursor-pointer text-xs ${
                    assignmentType === 'round_robin'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-semibold block mb-0.5">Round Robin</span>
                  Evenly distributes across team
                </div>
                <div
                  onClick={() => setAssignmentType('specific_counselor')}
                  className={`p-3 rounded-xl border cursor-pointer text-xs ${
                    assignmentType === 'specific_counselor'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-semibold block mb-0.5">Specific Counselor</span>
                  Directs to dedicated person
                </div>
              </div>
            </div>

            {assignmentType === 'specific_counselor' && (
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Select Counselor</label>
                <select
                  value={specificCounselorId}
                  onChange={(e) => setSpecificCounselorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select counselor...</option>
                  {members.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name || m.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                type="button"
                disabled={loading}
                onClick={handleCreate}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold flex items-center gap-2 transition"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Generate Webhook Endpoint
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in">
            {/* Generated Credentials Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Webhook URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-300"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast.success('Webhook URL copied!');
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Secret Key (<strong className="text-amber-400">a password that proves rows come from your tool</strong>)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={secretKey}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(secretKey);
                      setCopiedKey(true);
                      toast.success('Secret key copied!');
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Pass this in the <code className="text-amber-300">x-crm-secret</code> header or as query parameter <code className="text-amber-300">?key=</code>.</p>
              </div>
            </div>

            {/* Sample cURL Command */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>Sample cURL Request</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sampleCurl);
                    setCopiedCurl(true);
                    toast.success('cURL command copied!');
                    setTimeout(() => setCopiedCurl(false), 2000);
                  }}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
                >
                  {copiedCurl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCurl ? 'Copied' : 'Copy cURL'}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-amber-200/90 overflow-x-auto leading-relaxed">
                {sampleCurl}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
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
