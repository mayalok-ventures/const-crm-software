'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X, CheckCircle2, Shield, Key, Phone, Building2, HelpCircle,
  ExternalLink, Copy, AlertTriangle, RefreshCw
} from 'lucide-react';

export default function MetaConnectModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const [formData, setFormData] = useState({
    wabaId: '',
    phoneNumberId: '',
    displayPhoneNumber: '',
    verifiedName: '',
    accessToken: '',
    appSecret: '',
    metaAppId: '',
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'instructions'

  useEffect(() => {
    if (initialData) {
      setFormData({
        wabaId: initialData.wabaId || '',
        phoneNumberId: initialData.phoneNumberId || '',
        displayPhoneNumber: initialData.displayPhoneNumber || '',
        verifiedName: initialData.verifiedName || '',
        accessToken: '', // Keep blank for security
        appSecret: '',
        metaAppId: initialData.metaAppId || '',
      });
    }
  }, [initialData]);

  if (!isOpen) return null;

  const getBackendBase = () => {
    if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/+$/, '');
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '');
    if (typeof window !== 'undefined') {
      const hn = window.location.hostname;
      if (hn === 'localhost' || hn === '127.0.0.1') {
        return `http://${hn}:5000`;
      }
    }
    return 'https://api.sahyak.com';
  };

  const webhookCallbackUrl = `${getBackendBase()}/api/whatsapp/meta/webhook`;
  const webhookVerifyToken = 'sahyak_crm_meta_wa_2026';

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard! 📋`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.wabaId || !formData.phoneNumberId || !formData.accessToken) {
      return toast.error('WABA ID, Phone Number ID, and System User Access Token are required');
    }

    setLoading(true);
    try {
      const res = await api.post('/whatsapp/meta/connect', formData);
      toast.success('Official WhatsApp Business Account connected successfully! 🎉');
      if (onSuccess) onSuccess(res.data?.account);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect official WhatsApp account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Connect Official WhatsApp Business Platform
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Meta Cloud API
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Enterprise Cloud API hosted directly on Meta infrastructure
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

        {/* Tab switch inside modal */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/30">
          <button
            onClick={() => setStep('form')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              step === 'form'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            API Credentials &amp; Credentials
          </button>
          <button
            onClick={() => setStep('instructions')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              step === 'instructions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Meta Setup Guide &amp; Webhooks
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} id="meta-connect-form" className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Owner / Administrator Authorization Required</p>
                  <p className="mt-0.5 text-amber-700">
                    Credentials entered here are encrypted via AES-256-GCM in your tenant database and never exposed in frontend responses.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    WhatsApp Business Account ID (WABA ID) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 102938475610293"
                      value={formData.wabaId}
                      onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number ID <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 987654321098765"
                      value={formData.phoneNumberId}
                      onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Display Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={formData.displayPhoneNumber}
                    onChange={(e) => setFormData({ ...formData, displayPhoneNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Verified Business Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sahyak Admissions"
                    value={formData.verifiedName}
                    onChange={(e) => setFormData({ ...formData, verifiedName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  System User Permanent Access Token <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="EAA..."
                    value={formData.accessToken}
                    onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Must include <code className="font-mono text-indigo-600">whatsapp_business_messaging</code> and <code className="font-mono text-indigo-600">whatsapp_business_management</code> scopes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Meta App Secret (Recommended for Webhook HMAC)
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. 7f8a9b..."
                    value={formData.appSecret}
                    onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Meta App ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 192837465"
                    value={formData.metaAppId}
                    onChange={(e) => setFormData({ ...formData, metaAppId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Prerequisites in Meta Developers Dashboard
                </h3>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
                  <li>Log in to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">developers.facebook.com</a> with your Meta Business account.</li>
                  <li>Create or select an App of type <strong>Business</strong>.</li>
                  <li>Add the <strong>WhatsApp</strong> product to your App.</li>
                  <li>In <strong>Business Settings &gt; System Users</strong>, create an Admin System User and generate a token with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>.</li>
                  <li>Under <strong>WhatsApp &gt; Configuration</strong>, set up your Webhook using the values below.</li>
                </ol>
              </div>

              {/* Webhook Configuration Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 space-y-3 font-mono">
                <p className="font-bold text-xs uppercase tracking-wider text-indigo-600">Webhook Configuration</p>
                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                    <span>Callback URL:</span>
                    <button
                      onClick={() => copyToClipboard(webhookCallbackUrl, 'Callback URL')}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold transition"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-white text-[11px] break-all border border-slate-200 font-semibold text-slate-700 select-all shadow-2xs">
                    {webhookCallbackUrl}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                    <span>Verify Token:</span>
                    <button
                      onClick={() => copyToClipboard(webhookVerifyToken, 'Verify Token')}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold transition"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-white text-[11px] border border-slate-200 font-semibold text-slate-700 select-all shadow-2xs">
                    {webhookVerifyToken}
                  </div>
                </div>

                <div className="text-[11px] text-slate-600">
                  Webhook Subscription Field: <strong className="text-slate-900 font-bold">messages</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <a
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
          >
            Official Meta Docs <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            {step === 'form' && (
              <button
                type="submit"
                form="meta-connect-form"
                disabled={loading}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Validating with Meta...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Save &amp; Verify Account
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
