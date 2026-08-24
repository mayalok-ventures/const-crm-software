'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  MessageCircle, Search, User, Phone, CheckCircle2, AlertTriangle,
  Send, ExternalLink, Sparkles, Building2, GraduationCap, X,
  ShieldCheck, RefreshCw, Check, Clock, DollarSign
} from 'lucide-react';

export default function SendFeeStructureWhatsAppModal({
  isOpen,
  onClose,
  college,
  degree,
  course,
}) {
  const [waLoading, setWaLoading] = useState(true);
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', phone: null });
  const [sender, setSender] = useState('personal'); // 'personal' | 'company'

  // Leads Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsResults, setLeadsResults] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);

  // Manual Recipient State
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  // Remarks & Notes
  const [counselorRemark, setCounselorRemark] = useState('');
  const [sending, setSending] = useState(false);

  // Search debounce ref
  const debounceTimeout = useRef(null);

  // Load WhatsApp status & initial recent leads on open
  useEffect(() => {
    if (isOpen) {
      checkWhatsAppStatus();
      loadRecentLeads('');
    }
  }, [isOpen]);

  const checkWhatsAppStatus = async () => {
    setWaLoading(true);
    try {
      const res = await api.get('/whatsapp/status');
      if (res.data) {
        setWaStatus(res.data);
        if (res.data.companySession?.status === 'connected' && res.data.personalSession?.status !== 'connected') {
          setSender('company');
        }
      }
    } catch {
      setWaStatus({ status: 'disconnected' });
    } finally {
      setWaLoading(false);
    }
  };

  const loadRecentLeads = async (query = '') => {
    setLeadsLoading(true);
    try {
      const params = { limit: 12 };
      if (query && query.trim()) params.search = query.trim();
      const res = await api.get('/leads', { params });
      const items = res.data?.leads || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setLeadsResults(items);
    } catch (err) {
      console.error('Failed to load leads for WhatsApp selector:', err);
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      loadRecentLeads(val);
    }, 250);
  };

  // Derive Fee and College details
  const collegeName = college?.customCollegeName || college?.name || 'Partner Institution';
  const collegeLocation = `${college?.location?.city ? college.location.city + ', ' : ''}${college?.location?.state || ''}`;
  const degreeName = degree?.degreeName || course?.degreeName || 'Degree Program';
  const specialization = course?.specialization || 'General Stream';
  const fee = course?.customFeeStructure || {};
  const currency = fee.currency || 'INR';
  const annualTuition = Number(fee.annualTuitionFee) || 0;
  const packageFee = Number(fee.packageFee) || (annualTuition * (degree?.durationYears || 4));
  const hostelFee = Number(fee.hostelFeePerYear) || 0;
  const oneTimeFee = Number(fee.oneTimeAdmissionFee) || 0;

  // Effective recipient phone & name
  const effectiveRecipientName = selectedLead ? (selectedLead.name || 'Student') : (manualName || 'Student');
  const effectiveRecipientPhone = selectedLead ? (selectedLead.phone || '') : manualPhone;

  // Is active WhatsApp session connected?
  const isConnected =
    (sender === 'personal' && (waStatus.personalSession?.status === 'connected' || waStatus.status === 'connected')) ||
    (sender === 'company' && waStatus.companySession?.status === 'connected') ||
    waStatus.status === 'connected';

  // Live Message Preview generator
  const previewMessage = useMemo(() => {
    return `🎓 *ADMISSION & FEE STRUCTURE DETAILS*
━━━━━━━━━━━━━━━━━━━━
👤 *Dear ${effectiveRecipientName}*,
Greetings! Here is the official fee breakdown and admission details for your requested program:

🏛️ *Institution:* *${collegeName}*
${collegeLocation ? `📍 *Location:* ${collegeLocation}\n` : ''}📚 *Program:* *${degreeName}*
🎯 *Specialization:* *${specialization}*
⏱️ *Duration:* ${degree?.durationYears || course?.durationYears || 4} Years (${degree?.level || course?.level || 'Undergraduate'})
⚡ *Status:* 🟢 Admissions Open

💰 *OFFICIAL FEE STRUCTURE*
━━━━━━━━━━━━━━━━━━━━
💵 *Annual Tuition Fee:* *${currency} ${annualTuition.toLocaleString('en-IN')}/year*
📦 *Total Package Fee:* *${currency} ${packageFee.toLocaleString('en-IN')}*
${hostelFee ? `🏠 *Hostel & Mess:* ${currency} ${hostelFee.toLocaleString('en-IN')}/year\n` : ''}${oneTimeFee ? `📝 *One-Time Registration/Adm Fee:* ${currency} ${oneTimeFee.toLocaleString('en-IN')}\n` : ''}
${counselorRemark ? `💬 *Counselor Remark:* _${counselorRemark.trim()}_\n\n` : ''}━━━━━━━━━━━━━━━━━━━━
${college?.website ? `🌐 *Website:* ${college.website}\n` : ''}
📞 *Need Assistance with Seat Reservation?*
Reply to this message for direct admission support.`;
  }, [effectiveRecipientName, collegeName, collegeLocation, degreeName, specialization, annualTuition, packageFee, hostelFee, oneTimeFee, counselorRemark, college?.website, currency, degree, course]);

  const handleSendWhatsApp = async () => {
    if (!effectiveRecipientPhone || !effectiveRecipientPhone.trim()) {
      toast.error('Please select a lead or enter a valid mobile number');
      return;
    }

    if (!isConnected) {
      toast.error('WhatsApp session is not connected. Please connect in WhatsApp module first.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        leadId: selectedLead?._id || null,
        recipientPhone: effectiveRecipientPhone.trim(),
        recipientName: effectiveRecipientName.trim(),
        collegeId: college?._id,
        courseId: course?._id,
        specializationName: specialization,
        degreeName: degreeName,
        customNotes: counselorRemark,
        sender: sender,
      };

      const res = await api.post('/catalogue/send-fee-structure-whatsapp', payload);

      if (res.data?.success) {
        toast.success(res.data.message || `Fee structure sent to ${effectiveRecipientName} on WhatsApp! 🎉`);
        onClose();
      } else {
        toast.error(res.data?.message || 'Failed to send fee structure');
      }
    } catch (err) {
      if (err.response?.data?.code === 'WHATSAPP_NOT_CONNECTED') {
        toast.error('WhatsApp is disconnected. Please re-scan QR in WhatsApp section.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to send WhatsApp message');
      }
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10050 }}>
      <div
        className="modal-sheet max-w-2xl bg-white p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
              <MessageCircle size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white m-0 flex items-center gap-2">
                Send Fee Structure on WhatsApp
              </h3>
              <p className="text-xs text-emerald-100 m-0 mt-0.5">
                Instant structured admission prospectus directly to student
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition text-lg"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 max-h-[80vh] overflow-y-auto space-y-4">
          
          {/* 1. College & Course Highlight Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  {degreeName}
                </span>
                <span className="text-xs text-slate-500 font-medium truncate">
                  {collegeLocation}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 m-0 mt-1 truncate">
                {collegeName} — <span className="text-indigo-600">{specialization}</span>
              </h4>
            </div>

            <div className="text-left sm:text-right flex-shrink-0 bg-white sm:bg-transparent p-2.5 sm:p-0 rounded-lg border sm:border-0 border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Annual Tuition Fee</span>
              <span className="text-sm font-black text-emerald-600">
                ₹{annualTuition.toLocaleString('en-IN')}/yr
              </span>
              <span className="text-[11px] font-semibold text-slate-600 block">
                Total: ₹{packageFee.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* 2. WhatsApp Connection Status Banner */}
          {waLoading ? (
            <div className="py-2 text-center text-xs text-slate-400">
              Checking WhatsApp session...
            </div>
          ) : isConnected ? (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span>
                  WhatsApp Connected: <strong>{waStatus.phone || waStatus.personalSession?.phone || 'Active Session'}</strong>
                </span>
              </div>

              {waStatus.companySession?.status === 'connected' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium">Sender:</span>
                  <select
                    value={sender}
                    onChange={e => setSender(e.target.value)}
                    className="text-xs bg-white border border-emerald-300 text-emerald-800 rounded-md px-2 py-1 font-bold"
                  >
                    <option value="personal">Personal WhatsApp</option>
                    <option value="company">Company Desk</option>
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block">WhatsApp Is Not Connected</strong>
                  <span className="text-amber-700 text-[11px]">
                    To send this fee structure, your WhatsApp session must be linked.
                  </span>
                </div>
              </div>

              <Link
                href="/whatsapp"
                target="_blank"
                className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white text-xs py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
              >
                <ExternalLink size={13} /> Connect WhatsApp
              </Link>
            </div>
          )}

          {/* 3. Recipient Selector: Leads Search vs Manual Phone */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-indigo-600" /> Select Recipient Student / Lead
              </label>

              <button
                type="button"
                onClick={() => {
                  setUseManualEntry(!useManualEntry);
                  setSelectedLead(null);
                }}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline transition"
              >
                {useManualEntry ? '← Search from CRM Leads' : '+ Enter Mobile Manually'}
              </button>
            </div>

            {!useManualEntry ? (
              <div className="space-y-2">
                {/* Search Input */}
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by Student Name, Phone, or Email (e.g. Rahul, 9876543210)..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="input pl-9 pr-8 py-2 text-xs w-full bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        loadRecentLeads('');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm font-bold"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Selected Lead Highlight Chip */}
                {selectedLead && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
                        {selectedLead.name ? selectedLead.name.substring(0, 2).toUpperCase() : 'LD'}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block truncate">
                          {selectedLead.name}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                          <Phone size={10} className="text-emerald-600" /> {selectedLead.phone}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedLead(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold p-1 rounded-md hover:bg-rose-50"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Leads Search Results List */}
                {!selectedLead && (
                  <div className="border border-slate-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {leadsLoading ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Searching leads...
                      </div>
                    ) : leadsResults.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">
                        No matching leads found.
                        <button
                          type="button"
                          onClick={() => setUseManualEntry(true)}
                          className="text-indigo-600 font-bold block mx-auto mt-1 hover:underline"
                        >
                          Enter student number directly
                        </button>
                      </div>
                    ) : (
                      leadsResults.map((ld) => (
                        <div
                          key={ld._id}
                          onClick={() => setSelectedLead(ld)}
                          className="p-2.5 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between gap-3 transition group"
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-600 font-bold flex items-center justify-center text-[10px] flex-shrink-0 transition">
                              {ld.name ? ld.name.substring(0, 2).toUpperCase() : 'ST'}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-600">
                                {ld.name || 'Unnamed Lead'}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {ld.phone}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {ld.status && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                                {ld.status.replace(/_/g, ' ')}
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn btn-xs btn-primary py-1 px-2.5 text-[10px] rounded-lg font-bold"
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Manual Recipient Form */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Student / Parent Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Aditi Sharma"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    className="input text-xs py-2 w-full bg-white rounded-lg border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">WhatsApp Mobile Number *</label>
                  <input
                    type="tel"
                    placeholder="e.g. 919876543210"
                    value={manualPhone}
                    onChange={e => setManualPhone(e.target.value)}
                    className="input text-xs py-2 w-full bg-white rounded-lg border-slate-200 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Counselor Remark / Custom Note */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
              💬 Optional Counselor Remark / Scholarship Note
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 15% Early bird scholarship valid if seat confirmed by this Friday. Hostel allocation available."
              value={counselorRemark}
              onChange={e => setCounselorRemark(e.target.value)}
              className="input text-xs py-2 w-full bg-slate-50 border-slate-200 rounded-xl focus:bg-white resize-none"
            />
          </div>

          {/* 5. Live Styled WhatsApp Preview Bubble */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
              <span>📱 Live WhatsApp Preview</span>
              <span className="text-[10px] text-emerald-600 font-bold">Auto-formatted Emojis & Bold</span>
            </label>

            <div className="bg-[#e5ddd5] p-3.5 rounded-xl border border-slate-300 font-sans shadow-inner max-h-56 overflow-y-auto">
              <div className="bg-white rounded-lg p-3 text-xs text-slate-900 whitespace-pre-wrap leading-relaxed shadow-sm max-w-lg border border-slate-200/60 font-sans">
                {previewMessage}
                <div className="text-[10px] text-slate-400 text-right mt-1.5 flex items-center justify-end gap-1 font-mono">
                  <span>Just now</span>
                  <span className="text-emerald-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Recipient: <strong className="text-slate-900">{effectiveRecipientName}</strong> {effectiveRecipientPhone ? `(${effectiveRecipientPhone})` : ''}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm flex-1 sm:flex-initial text-xs py-2 px-4 rounded-xl font-semibold"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={sending || !isConnected || !effectiveRecipientPhone}
              className="btn btn-primary btn-sm flex-1 sm:flex-initial text-xs py-2 px-5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <div className="spinner w-4 h-4" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Send via WhatsApp 🚀</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
