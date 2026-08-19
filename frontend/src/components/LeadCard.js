  'use client';

import React, { useState } from 'react';
import {
  Phone, Mail, Briefcase, Calendar, Clock, DollarSign,
  Edit, CheckCircle, AlertTriangle, MessageSquare, ArrowRight,
  Shield, Check, X, AlertCircle
} from 'lucide-react';
import { useAlarm } from '@/lib/AlarmContext';
import { SourcePill } from '@/lib/sourceHelper';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Standardized 6 Subscription Plans Catalog (3 Individual, 3 Organization)
export const SERVICE_CATALOG = {
  basic_solo: { label: 'Basic Solo (₹399/mo)', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30', category: 'Individual' },
  smart_solo: { label: 'Smart Solo (₹799/mo)', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', category: 'Individual' },
  power_solo: { label: 'Power Solo (₹1,299/mo)', color: 'bg-violet-500/15 text-violet-300 border-violet-500/30', category: 'Individual' },
  team_starter: { label: 'Team Starter (₹1,499/mo)', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', category: 'Organization' },
  business: { label: 'Business Agency (₹2,499/mo)', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', category: 'Organization' },
  enterprise: { label: 'Enterprise Command (₹4,999/mo)', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', category: 'Organization' },
  // Backward compatibility fallback
  custom_enterprise: { label: 'Custom Enterprise', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30', category: 'Organization' },
  digital_marketing: { label: 'Smart Solo (₹799/mo)', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', category: 'Individual' },
  web_development: { label: 'Business Agency (₹2,499/mo)', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', category: 'Organization' },
  crm_automation: { label: 'Enterprise Command (₹4,999/mo)', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', category: 'Organization' },
};

// Standardized 5 Pipeline Stages
export const KANBAN_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'border-slate-500/40 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' },
  { id: 'contacted', label: 'Contacted', color: 'border-blue-500/40 bg-blue-500/10 text-blue-300', dot: 'bg-blue-400' },
  { id: 'not_interested', label: 'Not Interested', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
  { id: 'converted', label: 'Converted', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  { id: 'payment_done', label: 'Payment Done', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300', dot: 'bg-purple-400' },
];

export const TIMELINE_OPTIONS = [
  { id: 'immediate', label: 'Immediate (< 1 week)' },
  { id: 'within_1_month', label: 'Within 1 Month' },
  { id: '1_to_3_months', label: '1 - 3 Months' },
  { id: '3_to_6_months', label: '3 - 6 Months' },
  { id: 'flexible', label: 'Flexible / Exploring' },
];

export default function LeadCard({
  lead,
  token,
  canonicalPlans = [],
  onLeadUpdated = () => {},
  onClick = () => {},
}) {
  const { dismissAlarm } = useAlarm();

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [editForm, setEditForm] = useState({
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    company: lead.company || '',
    serviceRequired: lead.serviceRequired || lead.service_required || 'digital_marketing',
    monthlySpend: lead.monthlySpend ?? lead.monthly_spend ?? '',
    goalTimeline: lead.goalTimeline || lead.goal_timeline || 'immediate',
  });

  const [followUpForm, setFollowUpForm] = useState({
    scheduled_at: '',
    note: '',
  });

  const [completeForm, setCompleteForm] = useState({
    note: '',
    promptNextFollowUp: true,
  });

  const [convertForm, setConvertForm] = useState({
    plan_id: canonicalPlans[0]?.code || 'IND_STARTER_MONTHLY_V1',
    custom_payment_amount: '',
    custom_price_reason: '',
    payment_method: 'bank_transfer',
    transaction_id: `TXN-${Date.now()}`,
    verify_payment: true,
  });

  const serviceKey = lead.serviceRequired || lead.service_required || 'digital_marketing';
  const serviceObj = SERVICE_CATALOG[serviceKey] || SERVICE_CATALOG.digital_marketing;
  const stageObj = KANBAN_STAGES.find(s => s.id === lead.status) || KANBAN_STAGES[0];
  const openFollowUp = lead.followUps?.find(f => f.status === 'open') || (lead.nextFollowUp?.status === 'open' ? lead.nextFollowUp : null);

  // 1. Direct Pipeline Stage Update
  const handleStageChange = async (newStage) => {
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/admin/leads/${lead._id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage: newStage }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'PAYMENT_REQUIRED_FOR_CONVERSION') {
          setShowConvertModal(true);
        } else {
          alert(data.message || 'Failed to update stage');
        }
        return;
      }
      onLeadUpdated(data.lead);
    } catch (e) {
      alert('Error updating stage');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Edit Lead (Strict 7 Basic Fields)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/admin/leads/${lead._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email,
          company: editForm.company,
          service_required: editForm.serviceRequired,
          monthly_spend: Number(editForm.monthlySpend || 0),
          goal_timeline: editForm.goalTimeline,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to update lead');
        return;
      }
      setShowEditModal(false);
      onLeadUpdated(data.lead);
    } catch (e) {
      setErrorMessage('Network error saving changes');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Schedule Follow-Up
  const handleScheduleFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpForm.scheduled_at || !followUpForm.note?.trim()) {
      setErrorMessage('Scheduled timestamp and mandatory note are required');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/admin/leads/${lead._id}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(followUpForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to schedule follow-up');
        return;
      }
      setShowFollowUpModal(false);
      setFollowUpForm({ scheduled_at: '', note: '' });
      onLeadUpdated(data.lead || lead);
    } catch (e) {
      setErrorMessage('Error scheduling follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Complete Follow-Up Flow (STRICT RULE: Note is Mandatory to dismiss alarm)
  const handleCompleteFollowUp = async (e) => {
    e.preventDefault();
    const outcomeNote = completeForm.note?.trim();
    if (!outcomeNote) {
      setErrorMessage('Mandatory outcome note is required to complete follow-up and clear alarm.');
      return;
    }

    try {
      setSubmitting(true);
      const targetFuId = openFollowUp?._id || lead.followUps?.[0]?._id;
      if (!targetFuId) {
        // Fallback: append note directly to lead and clear notification
        await fetch(`${API_BASE}/admin/leads/${lead._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ notes: outcomeNote }),
        });
      } else {
        const res = await fetch(`${API_BASE}/admin/followups/${targetFuId}/complete`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ note: outcomeNote }),
        });
        if (!res.ok) {
          const d = await res.json();
          setErrorMessage(d.message || 'Failed to complete follow-up');
          return;
        }
      }

      // STRICT RULE: Alarm is cleared only upon successful note save
      dismissAlarm(lead._id);
      setShowCompleteModal(false);
      setCompleteForm({ note: '', promptNextFollowUp: true });
      onLeadUpdated(lead);

      // Prompt next follow-up
      if (window.confirm('Follow-up marked complete! Would you like to schedule the subsequent follow-up now?')) {
        setFollowUpForm({ scheduled_at: '', note: '' });
        setShowFollowUpModal(true);
      }
    } catch (e) {
      setErrorMessage('Error completing follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Convert Lead & Anti-Fraud Discrepancy Flagging
  const handleConvertDeal = async (e) => {
    e.preventDefault();
    if (convertForm.custom_payment_amount && !convertForm.custom_price_reason?.trim()) {
      setErrorMessage('Justification reason is strictly required when entering custom payment amount');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/admin/leads/${lead._id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(convertForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'Conversion failed');
        return;
      }
      setShowConvertModal(false);
      onLeadUpdated(data.lead);
    } catch (e) {
      setErrorMessage('Error converting deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClick}
      className="group bg-[#0f172a] hover:bg-[#131d35] border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col gap-3 relative"
    >
      {/* Top Header: Service Badge, Source Tag & Anti-Fraud Audit Flag */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SourcePill lead={lead} showDetail={true} />
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border uppercase tracking-wider ${serviceObj.color}`}>
            {serviceObj.label}
          </span>
        </div>
        {lead.metadata?.admin_flag && (
          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse flex items-center gap-1">
            <Shield className="w-3 h-3 text-amber-400" />
            AUDIT REVIEW
          </span>
        )}
      </div>

      {/* Lead Title & Company */}
      <div>
        <h4 className="font-extrabold text-sm text-white group-hover:text-indigo-300 transition line-clamp-1">
          {lead.name}
        </h4>
        {lead.company && (
          <div className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{lead.company}</span>
          </div>
        )}
      </div>

      {/* Contact Coordinates */}
      <div className="space-y-1 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-mono">
          <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{lead.phone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>

      {/* Spend & Timeline Box */}
      <div className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-950/70 px-3 py-2 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-slate-500 text-[10px] uppercase block">Monthly Spend</span>
          <strong className="text-emerald-400 text-xs">₹{(lead.monthlySpend ?? lead.monthly_spend ?? 0).toLocaleString()}</strong>
        </div>
        <div className="text-right">
          <span className="text-slate-500 text-[10px] uppercase block">Timeline</span>
          <span className="capitalize font-semibold text-slate-300">{lead.goalTimeline?.replace(/_/g, ' ') || lead.goal_timeline?.replace(/_/g, ' ') || 'Immediate'}</span>
        </div>
      </div>

      {/* Follow-Up / Alarm Status */}
      {openFollowUp ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="truncate font-semibold text-[11px]">
              Due: {new Date(openFollowUp.scheduled_at || openFollowUp.scheduledAt).toLocaleDateString()}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setErrorMessage('');
              setShowCompleteModal(true);
            }}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-[10px] font-bold shrink-0 transition"
          >
            Mark Done
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setErrorMessage('');
            setShowFollowUpModal(true);
          }}
          className="w-full py-2 bg-slate-900/90 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-indigo-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
        >
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          <span>Schedule Next Follow-Up</span>
        </button>
      )}

      {/* Bottom Action Footer & Stage Selector */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 mt-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <a
            href={`https://wa.me/${String(lead.phone).replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            title="WhatsApp Chat"
            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </a>
          <a
            href={`tel:${lead.phone}`}
            title="Call"
            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => {
              setErrorMessage('');
              setShowEditModal(true);
            }}
            title="Edit 7 Basic Fields"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {lead.status !== 'converted' && lead.status !== 'payment_done' && (
            <button
              onClick={() => {
                setErrorMessage('');
                setShowConvertModal(true);
              }}
              title="Convert Lead"
              className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/30 flex items-center gap-1 transition"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Convert</span>
            </button>
          )}
        </div>

        {/* Inline Stage Dropdown */}
        <select
          value={lead.status}
          onChange={(e) => handleStageChange(e.target.value)}
          disabled={submitting}
          className="text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
        >
          {KANBAN_STAGES.map((s) => (
            <option key={s.id} value={s.id}>➔ {s.label}</option>
          ))}
        </select>
      </div>

      {/* ── MODAL 1: EDIT LEAD (7 Basic Fields) ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in text-left">
            <h3 className="text-base font-bold text-white mb-1">Edit Basic Lead Details</h3>
            <p className="text-xs text-slate-400 mb-4">Modify the 7 core fields entered during creation.</p>
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone (E.164) *</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Service Required</label>
                  <select
                    value={editForm.serviceRequired}
                    onChange={(e) => setEditForm({ ...editForm, serviceRequired: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
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
                    value={editForm.monthlySpend}
                    onChange={(e) => setEditForm({ ...editForm, monthlySpend: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Goal Timeline</label>
                <select
                  value={editForm.goalTimeline}
                  onChange={(e) => setEditForm({ ...editForm, goalTimeline: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  {TIMELINE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: SCHEDULE FOLLOW-UP ── */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in text-left">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Schedule Follow-Up
            </h3>
            <p className="text-xs text-slate-400 mb-4">Set target date & mandatory note for {lead.name}.</p>
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <form onSubmit={handleScheduleFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={followUpForm.scheduled_at}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, scheduled_at: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Note *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Schedule commercial contract signing and payment collection"
                  value={followUpForm.note}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30"
                >
                  {submitting ? 'Saving...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: COMPLETE FOLLOW-UP (Mandatory Outcome Note Enforced) ── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0b1120] border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in text-left">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Complete Follow-Up & Stop Alarm
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              STRICT ENFORCEMENT: A detailed outcome note is mandatory to resolve this follow-up and stop audio/visual alerts.
            </p>
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <form onSubmit={handleCompleteFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Outcome Note *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Call connected with decision maker. Discussed deliverables; client requested invoice."
                  value={completeForm.note}
                  onChange={(e) => setCompleteForm({ ...completeForm, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30"
                >
                  {submitting ? 'Resolving...' : 'Save Note & Resolve Alarm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: CONVERT DEAL WITH PLANS & ANTI-FRAUD FLAGGING ── */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0b1120] border border-purple-500/40 rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto text-left">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-400" />
              Convert Lead & Process Subscription
            </h3>
            <p className="text-xs text-slate-400 mb-4">Select an authorized subscription plan or enter a custom amount.</p>
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <form onSubmit={handleConvertDeal} className="space-y-4">
              {/* Standard Plans Catalog */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Available Subscription Plans</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {canonicalPlans.slice(0, 6).map((plan) => (
                    <div
                      key={plan.code}
                      onClick={() => setConvertForm({ ...convertForm, plan_id: plan.code })}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        convertForm.plan_id === plan.code && !convertForm.custom_payment_amount
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/20'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs truncate">{plan.name}</div>
                      <div className="text-sm font-black text-purple-300 mt-1">₹{plan.price.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Payment Amount Input */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Custom Payment Amount (₹) <span className="text-[10px] text-slate-500 font-normal">(Optional Override)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter custom amount if different from standard plan"
                    value={convertForm.custom_payment_amount}
                    onChange={(e) => setConvertForm({ ...convertForm, custom_payment_amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {convertForm.custom_payment_amount && (
                  <div className="space-y-3 animate-fade-in">
                    {/* Live Anti-Fraud Warning Banner */}
                    <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <span>
                        <strong>ANTI-FRAUD AUDIT TRIGGERED:</strong> Custom amount of ₹{Number(convertForm.custom_payment_amount).toLocaleString()} will be logged in <code>AbuseLog</code> and flagged to SuperAdmin in the review queue.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-amber-300 mb-1">Justification Reason *</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Explain why custom price is offered (e.g. Enterprise prepayment discount)"
                        value={convertForm.custom_price_reason}
                        onChange={(e) => setConvertForm({ ...convertForm, custom_price_reason: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={convertForm.payment_method}
                    onChange={(e) => setConvertForm({ ...convertForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="upi">UPI / QR Payment</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash Receipt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Transaction ID / UTR</label>
                  <input
                    type="text"
                    required
                    value={convertForm.transaction_id}
                    onChange={(e) => setConvertForm({ ...convertForm, transaction_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30"
                >
                  {submitting ? 'Converting...' : 'Confirm Conversion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
