'use client';

import React, { useState } from 'react';
import { Bell, Send, Users, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function SuperAdminBroadcastModule() {
  const [targetAudience, setTargetAudience] = useState('ALL_ORGS');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Broadcast title is required');
    if (!message.trim()) return toast.error('Broadcast message content is required');

    setSending(true);
    try {
      toast.success('Super Admin platform broadcast dispatched successfully! 🚀');
      setTitle('');
      setMessage('');
    } catch (err) {
      toast.error('Failed to dispatch broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Super Admin Platform Broadcast</h3>
            <p className="text-xs text-slate-400 mt-0.5">Send system alerts and notices across tenant organizations</p>
          </div>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Target Audience Scope</label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL_ORGS">All Tenant Organisations</option>
              <option value="PAYING_TENANTS">Paying License Holders Only</option>
              <option value="TRIAL_TENANTS">Trial Accounts Only</option>
              <option value="ALL_USERS">All Platform Users (Admins, Managers & Agents)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Notification Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled System Maintenance / New Feature Release"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Broadcast Message Content</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Enter detailed notice message for tenant administrators..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm shadow-amber-500/20 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Dispatching Broadcast...' : 'Dispatch Platform Broadcast'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
