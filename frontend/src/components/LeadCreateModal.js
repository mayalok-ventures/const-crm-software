'use client';

import React, { useState } from 'react';
import { Plus, X, AlertCircle, Calendar } from 'lucide-react';
import { SERVICE_CATALOG, TIMELINE_OPTIONS } from './LeadCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function LeadCreateModal({
  isOpen,
  onClose,
  token,
  agents = [],
  onLeadCreated = () => {},
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // STRICT 7 Basic Fields ONLY
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    serviceRequired: 'smart_solo',
    monthlySpend: '',
    goalTimeline: 'immediate',
    assignedTo: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.phone?.trim()) {
      setErrorMessage('Lead Name and Phone Number are mandatory');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const res = await fetch(`${API_BASE}/admin/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email?.trim() || undefined,
          company: form.company?.trim() || '',
          service_required: form.serviceRequired,
          monthly_spend: Number(form.monthlySpend || 0),
          goal_timeline: form.goalTimeline,
          assignedTo: form.assignedTo || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to create lead');
        return;
      }

      // Reset Form
      setForm({
        name: '',
        phone: '',
        email: '',
        company: '',
        serviceRequired: 'smart_solo',
        monthlySpend: '',
        goalTimeline: 'immediate',
        assignedTo: '',
      });

      onLeadCreated(data.lead);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Error creating lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in text-left">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            Add New Lead (Admin/Agent)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Strict fast intake form restricted strictly to the 7 core business fields.
        </p>

        {errorMessage && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. Name & 2. Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Lead Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Rohan Mehta"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (E.164) *</label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 3. Email & 4. Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="rohan@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
              <input
                type="text"
                placeholder="e.g. Apex Corporation"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 5. Service Required & 6. Monthly Spend */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Service Required *</label>
              <select
                value={form.serviceRequired}
                onChange={(e) => setForm({ ...form, serviceRequired: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {Object.entries(SERVICE_CATALOG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly Spend (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 50000"
                value={form.monthlySpend}
                onChange={(e) => setForm({ ...form, monthlySpend: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 7. Goal Timeline & Assignment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Goal Timeline</label>
              <select
                value={form.goalTimeline}
                onChange={(e) => setForm({ ...form, goalTimeline: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {TIMELINE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assign to Agent</label>
              <select
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Unassigned Pool</option>
                {agents.map((a) => (
                  <option key={a._id} value={a._id}>{a.name} ({a.usercode || 'Agent'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
            >
              {loading ? 'Creating...' : 'Save & Schedule Follow-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
