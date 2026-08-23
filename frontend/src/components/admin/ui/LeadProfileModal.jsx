'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import {
  User, Building2, Phone, Mail, MapPin, Tag, Calendar, Clock, DollarSign,
  Briefcase, MessageSquare, History, Shield, ArrowRight, CheckCircle2,
  AlertCircle, Sparkles, Send, Gift, CheckCheck, XCircle, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeadProfileModal({
  isOpen,
  onClose,
  lead,
  plans = [],
  teamMembers = [],
  onStageChange,
  onOpenCancelFollowUp,
  onOpenCloseDeal,
  onOpenAssignPlan,
  onReassignAgent,
  onAddNote,
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'attribution' | 'commercials' | 'followup' | 'timeline' | 'ledger'
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  if (!isOpen || !lead) return null;

  const isCompany = Boolean(lead.company || lead.companyId || lead.workStatus === 'company_owner');
  const activePlan = plans.find((p) => String(p._id) === String(lead.selected_plan_id) || p.code === lead.selected_plan_id || p.code === lead.service_required);

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setAddingNote(true);
    try {
      if (onAddNote) {
        await onAddNote(lead._id, newNoteText.trim());
        setNewNoteText('');
      }
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>{lead.name}</span>
          <StatusBadge status={lead.status || 'new_lead'} size="xs" />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {isCompany ? 'ORGANIZATION' : 'SOLO USER'}
          </span>
        </div>
      }
      subtitle={lead.company || lead.phone || 'Direct Inbound Contact Profile'}
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
          {[
            { id: 'overview', label: 'Overview & Contact' },
            { id: 'attribution', label: 'Origin & Attribution' },
            { id: 'commercials', label: 'Plan & Commercials' },
            { id: 'followup', label: 'Follow-Up & Alarm' },
            { id: 'timeline', label: 'Activity & Notes' },
            { id: 'ledger', label: 'Commission Ledger' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: OVERVIEW & CONTACT
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Phone Number</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono text-white font-bold">{lead.phone}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Email Address</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-300 truncate">{lead.email || '—'}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Account Entity Type</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isCompany ? <Building2 className="w-3.5 h-3.5 text-blue-400" /> : <User className="w-3.5 h-3.5 text-purple-400" />}
                  <span className="text-white font-medium">{isCompany ? `Organization (${lead.company || 'Enterprise'})` : 'Solo Sales Rep'}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Location / City</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-300">{lead.location || 'Pan-India'}</span>
                </div>
              </div>
            </div>

            {/* Assignment & Pipeline Controls */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Sales Stage Status</label>
                <select
                  value={lead.status || 'new_lead'}
                  onChange={(e) => onStageChange && onStageChange(lead._id, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="new_lead">New Lead</option>
                  <option value="contacted">Contacted</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="converted">Converted</option>
                  <option value="payment_done">Payment Done</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Assigned Sales Agent</label>
                <select
                  value={lead.assignedTo?._id || lead.assignedTo || ''}
                  onChange={(e) => onReassignAgent && onReassignAgent(lead._id, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Unassigned Pool</option>
                  {teamMembers.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.role || 'Agent'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: ORIGIN & ATTRIBUTION
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'attribution' && (
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Primary Lead Origin</span>
                <div className="mt-1">
                  <StatusBadge status={lead.primarySource || lead.source} size="sm" />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Source Provider</span>
                <span className="text-white font-mono font-medium block mt-1">
                  {lead.leadSource?.provider || lead.source || 'Direct Rep Manual'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Campaign Name</span>
                <span className="text-amber-300 font-medium block mt-0.5">
                  {lead.leadSource?.campaignName || lead.utmCampaign || 'Organic Direct Inbound'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ad Set / Ad Name</span>
                <span className="text-slate-300 block mt-0.5">
                  {lead.leadSource?.adSetName ? `${lead.leadSource.adSetName} / ${lead.leadSource.adName || ''}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Lead Form Ingestion</span>
                <span className="text-slate-300 block mt-0.5">
                  {lead.leadSource?.formName || 'CoreSetu Native Ingestion Form'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Creation Timestamp</span>
                <span className="text-slate-400 font-mono block mt-0.5">
                  {new Date(lead.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: PLAN & COMMERCIALS
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'commercials' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Active Commercial Plan</span>
                <span className="text-white font-bold text-sm block mt-0.5">
                  {activePlan?.name || lead.service_required || 'No Plan Assigned'}
                </span>
                <span className="text-slate-400 text-[11px]">
                  Industry: <strong className="text-amber-300">{activePlan?.industry || 'General'}</strong> | Cycle: {activePlan?.interval || 'monthly'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Deal Revenue</span>
                <span className="text-emerald-400 font-mono font-bold text-base block">
                  ₹{(lead.closedDealAmount || lead.paid_amount || lead.payable_amount || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400">
                  Status: <strong className="text-white">{lead.status === 'payment_done' ? 'PAID & CLOSED' : 'IN NEGOTIATION'}</strong>
                </span>
              </div>
            </div>

            {/* Plan Action Triggers */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onOpenAssignPlan && onOpenAssignPlan(lead)}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-colors"
              >
                <Tag className="w-4 h-4 text-indigo-400 mb-1" />
                <div className="font-semibold text-white text-xs">Assign Plan</div>
                <div className="text-[10px] text-slate-400">Change plan offering</div>
              </button>
              <button
                type="button"
                onClick={() => onOpenAssignPlan && onOpenAssignPlan(lead, true)}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-colors"
              >
                <Gift className="w-4 h-4 text-amber-400 mb-1" />
                <div className="font-semibold text-white text-xs">Free / Complimentary</div>
                <div className="text-[10px] text-slate-400">Grant free access & log</div>
              </button>
              <button
                type="button"
                onClick={() => onOpenCloseDeal && onOpenCloseDeal(lead)}
                className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 hover:border-emerald-700 text-left transition-colors"
              >
                <Sparkles className="w-4 h-4 text-emerald-400 mb-1" />
                <div className="font-semibold text-emerald-300 text-xs">Close Deal</div>
                <div className="text-[10px] text-emerald-400/80">Finalize & calculate commission</div>
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 4: FOLLOW-UP & ALARM
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'followup' && (
          <div className="space-y-3">
            {lead.followUpDate ? (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Scheduled Follow-Up</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                    ⏰ {lead.followUpStatus?.toUpperCase() || 'SCHEDULED'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Due Timestamp:</span>
                  <span className="font-mono text-white font-bold text-sm">
                    {new Date(lead.followUpDate).toLocaleString()}
                  </span>
                </div>
                {lead.followUpNote && (
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-slate-300 text-xs">
                    Agenda: "{lead.followUpNote}"
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => onOpenCancelFollowUp && onOpenCancelFollowUp(lead)}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-colors"
                  >
                    Cancel / Disable Follow-Up
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                <Calendar className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                No active follow-up scheduled for this customer.
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 5: ACTIVITY & NOTES TIMELINE
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {/* Note input form */}
            <form onSubmit={handleCreateNote} className="flex gap-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Add a customer note or call outcome..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={addingNote || !newNoteText.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                Add Note
              </button>
            </form>

            {/* Activity and notes chronological list */}
            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {(lead.notes || []).map((note, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-amber-300">{note.authorName || 'Agent'}</span>
                    <span>{note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Recent'}</span>
                  </div>
                  <p className="text-slate-200">{note.text}</p>
                </div>
              ))}
              {(lead.leadActivities || []).map((act, i) => (
                <div key={`act-${i}`} className="p-2 rounded-lg bg-slate-950 border border-slate-800/60 text-[11px] flex items-center justify-between text-slate-400">
                  <span className="text-slate-300">
                    <strong className="text-white">{act.performerName || 'System'}</strong>: {act.details || act.action}
                  </span>
                  <span className="font-mono text-[10px] shrink-0 ml-2">
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 6: COMMISSION & LEDGER
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'ledger' && (
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Deal Financial Summary</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">
                ₹{(lead.closedDealAmount || lead.paid_amount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            {lead.closingReason && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Closing Reason & Notes</span>
                "{lead.closingReason}"
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <div>
                Assigned Agent:{' '}
                <strong className="text-white">{lead.assignedTo?.name || 'Unassigned'}</strong>
              </div>
              <div>
                Assigned Manager:{' '}
                <strong className="text-white">{lead.assignedManager?.name || 'None'}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Quick Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${lead.phone}`}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              📞 Call
            </a>
            <a
              href={`https://wa.me/${String(lead.phone).replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors"
            >
              💬 WhatsApp
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
          >
            Close Profile
          </button>
        </div>
      </div>
    </Modal>
  );
}
