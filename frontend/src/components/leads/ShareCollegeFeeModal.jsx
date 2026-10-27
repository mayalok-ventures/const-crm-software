'use client';

import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink } from '@/lib/auth';
import {
  MessageCircle,
  Building2,
  GraduationCap,
  Search,
  Send,
  ExternalLink,
  Copy,
  X,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Clock,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';

export default function ShareCollegeFeeModal({
  isOpen,
  onClose,
  lead,
  waStatus,
  onSent,
}) {
  const [colleges, setColleges] = useState([]);
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [collegeSearch, setCollegeSearch] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [senderMode, setSenderMode] = useState('personal'); // 'personal' | 'company'
  const [customRemark, setCustomRemark] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [sending, setSending] = useState(false);

  // Check connection status
  const canUseCompanyWA = Boolean(waStatus?.allowCompanyWhatsApp && waStatus?.company?.status === 'connected');
  const isPersonalConnected = waStatus?.personal?.status === 'connected' || waStatus?.status === 'connected';
  const isConnected = isPersonalConnected || canUseCompanyWA;

  useEffect(() => {
    if (canUseCompanyWA && !isPersonalConnected) {
      setSenderMode('company');
    }
  }, [canUseCompanyWA, isPersonalConnected]);

  // Load Colleges when opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadColleges() {
      setLoadingColleges(true);
      try {
        const res = await api.get('/catalogue');
        if (isMounted) {
          const list = res.data?.colleges || res.data?.data || [];
          setColleges(list);

          // If lead has a preferred college or shortlisted college, pre-select it
          if (list.length > 0) {
            const preferredName = lead?.targetCollege || lead?.shortlistedColleges?.[0];
            let matched = null;
            if (preferredName) {
              matched = list.find(c =>
                c.name?.toLowerCase().includes(preferredName.toLowerCase()) ||
                c.collegeName?.toLowerCase().includes(preferredName.toLowerCase())
              );
            }
            const activeCol = matched || list[0];
            setSelectedCollegeId(activeCol._id);

            // Match course to lead.targetCourse if available
            if (Array.isArray(activeCol.courses) && activeCol.courses.length > 0) {
              let matchedCourse = null;
              if (lead?.targetCourse) {
                matchedCourse = activeCol.courses.find(crs =>
                  crs.degreeName?.toLowerCase().includes(lead.targetCourse.toLowerCase()) ||
                  crs.specialization?.toLowerCase().includes(lead.targetCourse.toLowerCase())
                );
              }
              setSelectedCourseId((matchedCourse || activeCol.courses[0])._id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load catalogue colleges:', err);
        toast.error('Unable to fetch colleges list');
      } finally {
        if (isMounted) setLoadingColleges(false);
      }
    }
    loadColleges();

    return () => {
      isMounted = false;
    };
  }, [isOpen, lead]);

  // Active College & Course derivation
  const activeCollege = useMemo(() => {
    return colleges.find(c => String(c._id) === String(selectedCollegeId)) || null;
  }, [colleges, selectedCollegeId]);

  const activeCourse = useMemo(() => {
    if (!activeCollege || !Array.isArray(activeCollege.courses)) return null;
    return activeCollege.courses.find(c => String(c._id) === String(selectedCourseId)) || activeCollege.courses[0] || null;
  }, [activeCollege, selectedCourseId]);

  // Filtered colleges list based on search
  const filteredColleges = useMemo(() => {
    if (!collegeSearch.trim()) return colleges;
    const q = collegeSearch.toLowerCase().trim();
    return colleges.filter(c =>
      (c.name || c.collegeName || '').toLowerCase().includes(q) ||
      (c.location || c.city || '').toLowerCase().includes(q)
    );
  }, [colleges, collegeSearch]);

  // Auto-generate default English message breakdown
  const defaultEnglishMessage = useMemo(() => {
    if (!lead || !activeCollege) return '';

    const studentName = lead.name || 'Student';
    const colName = activeCollege.customCollegeName || activeCollege.name || activeCollege.collegeName || 'Partner College';
    const loc = activeCollege.location || (activeCollege.city ? `${activeCollege.city}, ${activeCollege.state || ''}` : '');
    const degreeName = activeCourse?.degreeName || lead.targetCourse || 'Degree Program';
    const spec = activeCourse?.specialization || 'General Specialization';
    const duration = activeCourse?.durationYears || 4;
    const level = activeCourse?.level || 'Undergraduate';

    const fees = activeCourse?.customFeeStructure || {};
    const currency = fees.currency || 'INR';
    const annualTuition = Number(fees.annualTuitionFee) || 0;
    const packageFee = Number(fees.packageFee) || (annualTuition * duration);
    const hostelFee = Number(fees.hostelFeePerYear) || 0;
    const regFee = Number(fees.oneTimeAdmissionFee) || 0;

    let remarkSection = '';
    if (customRemark && customRemark.trim()) {
      remarkSection = `💬 *Counselor Remark:* _${customRemark.trim()}_\n`;
    } else if (fees.feeNotes) {
      remarkSection = `📌 *Note:* ${fees.feeNotes}\n`;
    }

    return `🎓 *OFFICIAL ADMISSION & FEE STRUCTURE*
━━━━━━━━━━━━━━━━━━━━
👤 *Dear ${studentName}*,
Greetings! Here is the verified fee breakdown and admission criteria for your selected program:

🏛️ *Institution:* *${colName}*
${loc ? `📍 *Location:* ${loc}\n` : ''}📚 *Program:* *${degreeName}*
🎯 *Specialization:* *${spec}*
⏱️ *Duration:* ${duration} Years (${level})
⚡ *Status:* 🟢 Admissions Open (Quota Applicable)

💰 *OFFICIAL FEE STRUCTURE*
━━━━━━━━━━━━━━━━━━━━
💵 *Annual Tuition Fee:* *${currency} ${annualTuition.toLocaleString('en-IN')}/year*
📦 *Total Package Fee:* *${currency} ${packageFee.toLocaleString('en-IN')}*
${hostelFee ? `🏠 *Hostel & Mess (Optional):* ${currency} ${hostelFee.toLocaleString('en-IN')}/year\n` : ''}${regFee ? `📝 *One-Time Registration/Admission Fee:* ${currency} ${regFee.toLocaleString('en-IN')}\n` : ''}${remarkSection}━━━━━━━━━━━━━━━━━━━━
📞 *Need Direct Assistance with Seat Reservation or Scholarship?*
Feel free to reply directly to this message or contact your admission counselor for priority processing.`;
  }, [lead, activeCollege, activeCourse, customRemark]);

  // Sync default message into edited message unless user manually modified it
  useEffect(() => {
    if (!isManualEdit) {
      setEditedMessage(defaultEnglishMessage);
    }
  }, [defaultEnglishMessage, isManualEdit]);

  // When college changes, switch course
  const handleSelectCollege = (colId) => {
    setSelectedCollegeId(colId);
    setIsManualEdit(false);
    const found = colleges.find(c => String(c._id) === String(colId));
    if (found && Array.isArray(found.courses) && found.courses.length > 0) {
      setSelectedCourseId(found.courses[0]._id);
    } else {
      setSelectedCourseId('');
    }
  };

  const handleSelectCourse = (crsId) => {
    setSelectedCourseId(crsId);
    setIsManualEdit(false);
  };

  const handleResetToDefault = () => {
    setIsManualEdit(false);
    setEditedMessage(defaultEnglishMessage);
    toast.success('Message reset to standard English format');
  };

  const handleSendWhatsApp = async () => {
    if (!lead?.phone) {
      toast.error('Lead phone number is missing');
      return;
    }

    if (!editedMessage.trim()) {
      toast.error('Message content cannot be empty');
      return;
    }

    setSending(true);
    try {
      const payload = {
        leadId: lead._id,
        recipientPhone: lead.phone,
        recipientName: lead.name,
        collegeId: selectedCollegeId,
        courseId: selectedCourseId,
        specializationName: activeCourse?.specialization,
        degreeName: activeCourse?.degreeName,
        customNotes: customRemark,
        sender: senderMode,
        message: editedMessage.trim(), // custom edited text
      };

      const res = await api.post('/catalogue/send-fee-structure-whatsapp', payload);

      if (res.data?.success) {
        toast.success(`🎉 Fee Structure successfully sent to ${lead.name} on WhatsApp!`);
        if (onSent) onSent();
        onClose();
      } else {
        toast.error(res.data?.message || 'Failed to dispatch WhatsApp message');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error sending fee structure';
      if (err.response?.data?.code === 'WHATSAPP_NOT_CONNECTED') {
        toast.error('WhatsApp session disconnected. Opening WhatsApp Web instead...');
        const url = waLink(lead.phone, editedMessage);
        window.open(url, '_blank');
      } else {
        toast.error(errMsg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleOpenWhatsAppWeb = () => {
    if (!lead?.phone) return;
    const url = waLink(lead.phone, editedMessage);
    window.open(url, '_blank');
  };

  const handleCopyMessage = () => {
    if (!editedMessage) return;
    navigator.clipboard.writeText(editedMessage);
    toast.success('Fee structure message copied to clipboard! 📋');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10050 }}>
      <div
        className="modal-sheet modal-sheet-dialog max-w-3xl bg-white shadow-2xl border border-slate-200"
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'min(94vh, 94dvh)',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 20,
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white m-0 flex items-center gap-2">
                Share College Fee Structure
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">
                  English Template
                </span>
              </h3>
              <p className="text-xs text-indigo-100 m-0 mt-0.5">
                Recipient: <strong>{lead?.name}</strong> (+{lead?.phone})
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

        {/* Scrollable Body */}
        <div
          className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Step 1: Select College & Program */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={14} className="text-indigo-600" />
                1. Select Institution & Course
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {colleges.length} Colleges Available
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* College Dropdown with Search */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Target College / University *
                </label>
                {loadingColleges ? (
                  <div className="p-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl">
                    Loading institutions...
                  </div>
                ) : (
                  <select
                    value={selectedCollegeId}
                    onChange={e => handleSelectCollege(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 shadow-sm"
                  >
                    {colleges.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.customCollegeName || c.name || c.collegeName} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Course / Specialization Dropdown */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Program & Specialization *
                </label>
                {activeCollege?.courses?.length > 0 ? (
                  <select
                    value={selectedCourseId}
                    onChange={e => handleSelectCourse(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 shadow-sm"
                  >
                    {activeCollege.courses.map(crs => {
                      const tuition = crs.customFeeStructure?.annualTuitionFee || 0;
                      return (
                        <option key={crs._id} value={crs._id}>
                          {crs.degreeName} - {crs.specialization} (₹{(tuition / 100000).toFixed(1)}L/yr)
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="p-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-xl">
                    No customized courses found for this college
                  </div>
                )}
              </div>
            </div>

            {/* Quick Fee Highlights Pill */}
            {activeCourse && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Annual Tuition</span>
                  <span className="font-extrabold text-emerald-600">
                    ₹{Number(activeCourse.customFeeStructure?.annualTuitionFee || 0).toLocaleString('en-IN')}/yr
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Package</span>
                  <span className="font-extrabold text-indigo-700">
                    ₹{Number(activeCourse.customFeeStructure?.packageFee || (activeCourse.customFeeStructure?.annualTuitionFee || 0) * (activeCourse.durationYears || 4)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Duration</span>
                  <span className="font-bold text-slate-800">
                    {activeCourse.durationYears || 4} Years
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Admission Quota</span>
                  <span className="font-bold text-amber-600 capitalize">
                    {(activeCourse.quotaType || 'Merit').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Custom Remark / Scholarship Note */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
              2. Optional Counselor Remark / Scholarship Note
            </label>
            <input
              type="text"
              placeholder="e.g. ₹50,000 Early Bird scholarship applicable if documents confirmed by this Saturday."
              value={customRemark}
              onChange={e => {
                setCustomRemark(e.target.value);
                setIsManualEdit(false);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 shadow-sm"
            />
          </div>

          {/* Step 3: Editable Message in English */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                3. Review & Edit WhatsApp Message (English)
              </label>
              <div className="flex items-center gap-2">
                {isManualEdit && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline transition"
                  >
                    Reset to Default Format
                  </button>
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  {editedMessage.length} chars
                </span>
              </div>
            </div>

            <textarea
              rows={9}
              value={editedMessage}
              onChange={e => {
                setEditedMessage(e.target.value);
                setIsManualEdit(true);
              }}
              placeholder="Message to be dispatched to student..."
              className="w-full bg-white border border-slate-300 rounded-2xl p-3.5 text-xs text-slate-900 leading-relaxed font-mono focus:outline-none focus:border-indigo-600 shadow-inner"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              💡 <strong>Editable:</strong> You can edit any sentence, price, or scholarship condition above before dispatching.
            </p>
          </div>

          {/* Sender Mode Selection */}
          {canUseCompanyWA && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 font-semibold">
                Dispatch WhatsApp Channel:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSenderMode('personal')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    senderMode === 'personal'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📱 Personal WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setSenderMode('company')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    senderMode === 'company'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  🏢 Organization Desk
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0"
          style={{
            flexShrink: 0,
            paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="btn btn-secondary btn-sm text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 font-semibold"
              title="Copy message to clipboard"
            >
              <Copy size={13} /> Copy Text
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsAppWeb}
              className="btn btn-secondary btn-sm text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 font-semibold text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
              title="Open directly in WhatsApp Web"
            >
              <ExternalLink size={13} /> Web WA
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm flex-1 sm:flex-initial text-xs py-2.5 px-4 rounded-xl font-semibold"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={sending || !editedMessage.trim()}
              className="btn btn-primary btn-sm flex-2 sm:flex-initial text-xs py-2.5 px-6 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition"
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
