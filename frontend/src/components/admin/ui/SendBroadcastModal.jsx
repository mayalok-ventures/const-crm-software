'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import { Bell, Send, Users, ShieldAlert, Radio } from 'lucide-react';
import toast from 'react-hot-toast';

export const BROADCAST_AUDIENCE_OPTIONS = [
  { id: 'ALL_USERS', label: 'Message to all users on platform (Admins, Managers & Agents)', icon: '🌐' },
  { id: 'PLATFORM_MANAGERS_AGENTS', label: 'Message to all Managers & Agents', icon: '👥' },
  { id: 'PLATFORM_MANAGERS_ONLY', label: 'Message to Platform Managers only', icon: '👔' },
  { id: 'PLATFORM_AGENTS_ONLY', label: 'Message to Platform Agents only', icon: '💼' },
  { id: 'SOLO_USERS_ONLY', label: 'Message to all Solo Users only', icon: '👤' },
  { id: 'ORGANISATIONS_ONLY', label: 'Message to all Organizations / Owners only', icon: '🏢' },
  { id: 'MY_TEAM_ONLY', label: 'Message to My Organization / Team only', icon: '🛡️' },
];

export default function SendBroadcastModal({
  isOpen,
  onClose,
  onSendBroadcast,
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [targetAudience, setTargetAudience] = useState('ALL_USERS');
  const [deliveryChannels, setDeliveryChannels] = useState(['IN_APP']);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleChannel = (ch) => {
    setDeliveryChannels((prev) =>
      prev.includes(ch) ? (prev.length > 1 ? prev.filter((c) => c !== ch) : prev) : [...prev, ch]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Broadcast title is required');
    if (!message.trim()) return toast.error('Broadcast message content is required');

    setSubmitting(true);
    try {
      if (onSendBroadcast) {
        await onSendBroadcast({
          title: title.trim(),
          message: message.trim(),
          priority,
          targetAudience,
          deliveryChannels,
        });
        toast.success('Broadcast dispatched successfully! 🚀');
        setTitle('');
        setMessage('');
        onClose();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send broadcast');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span>Dispatch Organization Broadcast</span>
        </div>
      }
      subtitle="Send high-priority announcements and operational push alerts across targeted team screens"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Audience Scope Selection */}
        <div>
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
            Target Audience Scope <span className="text-red-400">*</span>
          </label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {BROADCAST_AUDIENCE_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  targetAudience === opt.id
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="targetAudience"
                  value={opt.id}
                  checked={targetAudience === opt.id}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
                />
                <span className="text-base">{opt.icon}</span>
                <span className="font-medium flex-1">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority & Delivery Channels */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
            >
              <option value="LOW">Low (Informational)</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent (Flash Alert)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Delivery Channels</label>
            <div className="flex items-center gap-2 pt-1">
              {['IN_APP', 'WHATSAPP', 'EMAIL'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-colors border ${
                    deliveryChannels.includes(ch)
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-[11px] font-semibold text-slate-300 block mb-1">
            Announcement Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Month-End Target Closing Blitz / Server Maintenance Notice"
            required
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-semibold"
          />
        </div>

        {/* Message Content */}
        <div>
          <label className="text-[11px] font-semibold text-slate-300 block mb-1">
            Message Content <span className="text-red-400">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter announcement details, instructions, or operational guidelines..."
            required
            rows={4}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Form Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !message.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors shadow-sm shadow-amber-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Dispatching...' : 'Dispatch Broadcast'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
