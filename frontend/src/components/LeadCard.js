'use client';
import React, { useState } from 'react';
import {
  Phone, Mail, Briefcase, Calendar, Clock, DollarSign,
  Edit, CheckCircle, AlertTriangle, MessageSquare, ArrowRight,
  Shield, Check, X, AlertCircle, Sparkles, Lock, Ticket
} from 'lucide-react';
import { useAlarm } from '@/lib/AlarmContext';
import { SourcePill } from '@/lib/sourceHelper';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';

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

function LeadCardComponent({
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
  const [showEditFollowUpModal, setShowEditFollowUpModal] = useState(false);
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

  const [editFollowUpForm, setEditFollowUpForm] = useState({
    scheduled_at: '',
    note: '',
  });

  const [completeForm, setCompleteForm] = useState({
    note: '',
    next_followup_at: '',
    next_followup_note: '',
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
          return;
        }
        setErrorMessage(data.message || 'Failed to update stage');
        return;
      }
      onLeadUpdated(data.lead);
    } catch (e) {
      setErrorMessage('Network error updating stage');
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

  // 3. Schedule Follow-Up (Timezone Safe)
  const handleScheduleFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpForm.scheduled_at || !followUpForm.note?.trim()) {
      setErrorMessage('Scheduled timestamp and mandatory note are required');
      return;
    }
    try {
      setSubmitting(true);
      const isoDate = fromLocalDatetimeStringToISO(followUpForm.scheduled_at);
      const res = await fetch(`${API_BASE}/admin/leads/${lead._id}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scheduled_at: isoDate,
          note: followUpForm.note.trim(),
        }),
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

  // 4. Complete Follow-Up Flow (STRICT RULE: Mandatory Note + Instant Silence + Optional Next Follow-Up)
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

      // Schedule subsequent follow-up seamlessly if provided
      if (completeForm.next_followup_at) {
        const isoNextDate = fromLocalDatetimeStringToISO(completeForm.next_followup_at);
        await fetch(`${API_BASE}/admin/leads/${lead._id}/followups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            scheduled_at: isoNextDate,
            note: completeForm.next_followup_note?.trim() || `Next step after: ${outcomeNote}`,
          }),
        });
      }

      // STRICT RULE: Alarm is cleared only upon successful note save
      dismissAlarm(lead._id);
      setShowCompleteModal(false);
      setCompleteForm({ note: '', next_followup_at: '', next_followup_note: '' });
      onLeadUpdated(lead);
    } catch (e) {
      setErrorMessage('Error completing follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // 4b. Edit Scheduled Follow-Up
  const handleSaveEditFollowUp = async (e) => {
    e.preventDefault();
    if (!editFollowUpForm.scheduled_at) {
      setErrorMessage('Scheduled date and time are required.');
      return;
    }
    if (!editFollowUpForm.note?.trim()) {
      setErrorMessage('Follow-up note/reason is required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      const targetIso = fromLocalDatetimeStringToISO(editFollowUpForm.scheduled_at);

      let updatedLead = null;

      if (openFollowUp?._id) {
        const res = await fetch(`${API_BASE}/admin/followups/${openFollowUp._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            scheduled_at: targetIso,
            note: editFollowUpForm.note.trim(),
          }),
        });
        const data = await res.json();
        if (data.lead) updatedLead = data.lead;
      }

      const leadRes = await fetch(`${API_BASE}/leads/${lead._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          followUpDate: targetIso,
        }),
      });
      if (leadRes.ok) {
        const data = await leadRes.json();
        updatedLead = data;
      }

      dismissAlarm(lead._id);
      setShowEditFollowUpModal(false);
      onLeadUpdated(updatedLead || {
        ...lead,
        followUpDate: targetIso,
        nextFollowUp: {
          ...(openFollowUp || {}),
          scheduled_at: targetIso,
          note: editFollowUpForm.note.trim(),
          status: 'open',
        },
      });
    } catch (err) {
      setErrorMessage('Error updating follow-up schedule: ' + err.message);
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

      {/* Event Management Indicators: Stall Lock & Event Entry Pass */}
      {(lead.customData?.stallInventoryLock?.isLocked || lead.customData?.eventPass?.passCode) && (
        <div className="flex items-center gap-2 flex-wrap text-[10px]">
          {lead.customData?.stallInventoryLock?.isLocked && (
            <div className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold flex items-center gap-1">
              <Lock className="w-3 h-3 text-indigo-400" />
              <span>Stall Locked ({lead.customData.stallInventoryLock.lockCode})</span>
            </div>
          )}
          {lead.customData?.eventPass?.passCode && (
            <div className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
              <Ticket className="w-3 h-3 text-emerald-400" />
              <span>Pass Issued ({lead.customData.eventPass.passCode})</span>
            </div>
          )}
        </div>
      )}

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
              Due: {formatDisplayDateTime(openFollowUp.scheduled_at || openFollowUp.scheduledAt)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setErrorMessage('');
                const currentDue = openFollowUp.scheduled_at || openFollowUp.scheduledAt || openFollowUp.dueDate;
                setEditFollowUpForm({
                  scheduled_at: currentDue ? toLocalDatetimeString(new Date(currentDue)) : toLocalDatetimeString(new Date()),
                  note: openFollowUp.note || openFollowUp.reason || '',
                });
                setShowEditFollowUpModal(true);
              }}
              className="p-1 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
              title="Edit Follow-Up Schedule"
            >
              <Edit className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setErrorMessage('');
                setCompleteForm({ note: '', next_followup_at: '', next_followup_note: '' });
                setShowCompleteModal(true);
              }}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-[10px] font-bold shrink-0 transition"
            >
              Mark Done
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setErrorMessage('');
            setFollowUpForm({
              scheduled_at: toLocalDatetimeString(new Date(Date.now() + 24 * 60 * 60 * 1000)),
              note: '',
            });
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
          <span className={`w-2 h-2 rounded-full ${stageObj.dot}`} />
          <span className="text-[11px] font-bold text-slate-300">{stageObj.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setErrorMessage('');
              setShowEditModal(true);
            }}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
            title="Edit Lead"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <select
            value={lead.status}
            onChange={(e) => handleStageChange(e.target.value)}
            disabled={submitting}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold py-1 px-2 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {KANBAN_STAGES.map((st) => (
              <option key={st.id} value={st.id}>{st.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── MODAL 1: EDIT LEAD ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in text-left">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Edit className="w-5 h-5 text-indigo-400" />
              Edit Lead Details
            </h3>
            <p className="text-xs text-slate-400 mb-4">Edit core details for {lead.name}.</p>
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Lead Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone (E.164) *</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
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
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Service Required</label>
                  <select
                    value={editForm.serviceRequired}
                    onChange={(e) => setEditForm({ ...editForm, serviceRequired: e.target.value })}
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
                    value={editForm.monthlySpend}
                    onChange={(e) => setEditForm({ ...editForm, monthlySpend: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Date & Time (Local Time) *</label>
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

      {/* ── MODAL 3: COMPLETE FOLLOW-UP (Mandatory Outcome Note + Optional Next Follow-Up) ── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0b1120] border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in text-left">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Complete Follow-Up & Stop Alarm
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Record outcome note to resolve this follow-up and stop audio/visual alerts.
            </p>
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <form onSubmit={handleCompleteFollowUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Outcome Note *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Discussed pricing and deliverables with client. Sent proposal on WhatsApp."
                  value={completeForm.note}
                  onChange={(e) => setCompleteForm({ ...completeForm, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Optional Next Follow-Up Section */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    Set Next Follow-Up (Optional)
                  </label>
                  {completeForm.next_followup_at && (
                    <button
                      type="button"
                      onClick={() => setCompleteForm({ ...completeForm, next_followup_at: '' })}
                      className="text-[10px] text-slate-400 hover:text-rose-400"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {/* Quick Presets */}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: '+24h', hours: 24 },
                    { label: '+48h', hours: 48 },
                    { label: '+3d', hours: 72 },
                    { label: '+1w', hours: 168 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        const target = new Date(Date.now() + p.hours * 60 * 60 * 1000);
                        setCompleteForm({ ...completeForm, next_followup_at: toLocalDatetimeString(target) });
                      }}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-medium transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input
                  type="datetime-local"
                  value={completeForm.next_followup_at}
                  onChange={(e) => setCompleteForm({ ...completeForm, next_followup_at: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
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
                  {submitting ? 'Saving...' : 'Save Note & Silence Alarm'}
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

      {/* ── MODAL: EDIT SCHEDULED FOLLOW-UP ── */}
      {showEditFollowUpModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0b1120] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in text-left">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Edit Scheduled Follow-Up
            </h3>
            <p className="text-xs text-slate-400 mb-4">Modify scheduled date, time, and reason for {lead.name}.</p>

            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Scheduled Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={editFollowUpForm.scheduled_at}
                  onChange={(e) => setEditFollowUpForm({ ...editFollowUpForm, scheduled_at: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Follow-Up Reason / Agenda *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Reason / action items for this follow-up..."
                  value={editFollowUpForm.note}
                  onChange={(e) => setEditFollowUpForm({ ...editFollowUpForm, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditFollowUpModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5"
                >
                  {submitting ? 'Updating...' : 'Update Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function areLeadPropsEqual(prevProps, nextProps) {
  if (prevProps.token !== nextProps.token) return false;
  if (prevProps.lead === nextProps.lead) return true;
  if (!prevProps.lead || !nextProps.lead) return false;

  return (
    prevProps.lead._id === nextProps.lead._id &&
    prevProps.lead.status === nextProps.lead.status &&
    prevProps.lead.name === nextProps.lead.name &&
    prevProps.lead.phone === nextProps.lead.phone &&
    prevProps.lead.updatedAt === nextProps.lead.updatedAt &&
    prevProps.lead.followUpDate === nextProps.lead.followUpDate &&
    prevProps.lead.activeFollowUp?.status === nextProps.lead.activeFollowUp?.status &&
    prevProps.lead.activeFollowUp?.scheduledAt === nextProps.lead.activeFollowUp?.scheduledAt &&
    prevProps.canonicalPlans === nextProps.canonicalPlans
  );
}

const LeadCard = React.memo(LeadCardComponent, areLeadPropsEqual);
export default LeadCard;
