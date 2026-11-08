'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Eye, Lock, Phone, MessageCircle, Copy, Check } from 'lucide-react';
import { isOwner, isSuperAdmin, hasPermission } from '@/lib/auth';

export default function LeadPhoneReveal({
  lead,
  user,
  onPhoneUpdated,
}) {
  const [unmasking, setUnmasking] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!lead) return null;

  const currentPhone = revealedPhone || lead.phone || '';
  const isMasked = !revealedPhone && (lead.isPhoneMasked || currentPhone.includes('*'));
  const canUnmask = isSuperAdmin(user) || isOwner(user) || hasPermission(user, 'leads.view_phone_unmasked');

  const handleReveal = async () => {
    if (unmasking) return;
    setUnmasking(true);
    try {
      const res = await api.post(`/leads/${lead._id}/reveal-phone`, {
        reason: 'Authorized counsellor contact verification',
      });
      if (res.data?.success && res.data?.phone) {
        setRevealedPhone(res.data.phone);
        toast.success('Phone unmasked successfully');
        if (onPhoneUpdated) {
          onPhoneUpdated(res.data.phone);
        }
      } else {
        toast.error('Could not reveal phone number');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unauthorized to unmask phone number');
    } finally {
      setUnmasking(false);
    }
  };

  const handleCopy = () => {
    if (isMasked) {
      toast.error('Cannot copy masked phone digits');
      return;
    }
    navigator.clipboard.writeText(currentPhone);
    setCopied(true);
    toast.success('Phone copied to clipboard! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');
  const callHref = isMasked
    ? `${apiBase}/leads/${lead._id}/call-redirect`
    : `tel:${currentPhone}`;

  const waHref = isMasked
    ? `${apiBase}/leads/${lead._id}/whatsapp-redirect`
    : `https://wa.me/${currentPhone.replace(/[^0-9]/g, '')}`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
        {isMasked ? <Lock size={12} className="text-amber-600 shrink-0" /> : <Phone size={12} className="text-indigo-600 shrink-0" />}
        <span>{isMasked ? currentPhone : `+${currentPhone}`}</span>
      </div>

      {isMasked && canUnmask && (
        <button
          type="button"
          onClick={handleReveal}
          disabled={unmasking}
          className="btn btn-xs inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition disabled:opacity-50"
          title="Click to reveal raw unmasked phone number"
        >
          <Eye size={12} />
          {unmasking ? 'Revealing...' : 'Reveal'}
        </button>
      )}

      {!isMasked && (
        <button
          type="button"
          onClick={handleCopy}
          className="text-slate-400 hover:text-slate-700 p-0.5 transition"
          title="Copy phone"
        >
          {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
        </button>
      )}

      {/* Server-Mediated / Direct Action Links */}
      <a
        href={callHref}
        target={isMasked ? '_blank' : undefined}
        rel="noopener noreferrer"
        className="btn btn-xs inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition"
        title={isMasked ? 'Server-mediated call redirect' : 'Direct Call'}
      >
        <Phone size={11} className="text-indigo-600" />
        <span>Call</span>
      </a>

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-xs inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition"
        title={isMasked ? 'Server-mediated WhatsApp redirect' : 'Direct WhatsApp'}
      >
        <MessageCircle size={11} className="text-emerald-600" />
        <span>WhatsApp</span>
      </a>
    </div>
  );
}
