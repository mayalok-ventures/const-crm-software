'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, mergeTemplate } from '@/lib/auth';
import {
  ArrowLeft, MessageCircle, Phone, Edit2, Trash2, Mic, MicOff,
  Play, Pause, Send, Plus, X, Check, Calendar, AlertTriangle, ExternalLink,
  Image as ImageIcon, Video as VideoIcon, File as FileIcon, CheckCheck, RefreshCw,
  Paperclip, Copy, Package, UserCheck, ShieldCheck, History, Activity, Sparkles, Briefcase,
  GraduationCap, BookOpen, Clock, Building2, ChevronRight, FileText, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { getIndustryDefaults } from '@/lib/industryTemplates';
import LostReasonModal, { isLostStage, LOST_REASON_OPTIONS } from '@/components/LostReasonModal';
import FollowUpSchedulerModal from '@/components/FollowUpSchedulerModal';
import FollowUpCompleteModal from '@/components/FollowUpCompleteModal';
import { SourcePill, getLeadSourceTag } from '@/lib/sourceHelper';
import ShareCollegeFeeModal from '@/components/leads/ShareCollegeFeeModal';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';
import { getResolvedRouteParam, isValidEntityId } from '@/lib/routeParams';

const STATUS_OPTIONS = [
  'new_lead',
  'contacted',
  'shortlisted',
  'site_visit_scheduled',
  'negotiation',
  'converted',
  'lost'
];

const STAGE_LABELS = {
  new_lead: '1. New Lead',
  new: '1. New Lead',
  contacted: '2. Tele-Counsel',
  shortlisted: '3. Shortlisted',
  site_visit_scheduled: '4. Campus Visit',
  negotiation: '5. Quota Booking',
  converted: '6. Confirmed Won',
  closed: '6. Confirmed Won',
  lost: '❌ Dropped / Lost'
};

const ACTION_ICONS = {
  lead_created: '✨',
  status_changed: '🔄',
  assigned_agent: '👤',
  site_visit_scheduled: '📅',
  site_visit_completed: '✅',
  note_added: '📝',
  message_sent: '🚀',
  message_received: '💬',
  recording_added: '🎙️',
  project_linked: '📦',
  lead_updated: '✍️',
};

// ── AUDIO NOTES & CALL MEMOS ──────────────────────────────────
function RecordingSection({ leadId }) {
  const [recordings, setRecordings] = useState([]);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [duration, setDuration] = useState(0);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const audioRefs = useRef({});
  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (leadId) {
      api.get(`/recordings/${leadId}`).then(r => setRecordings(r.data || [])).catch(() => {});
    }
  }, [leadId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunks.current = [];
      mr.ondataavailable = e => chunks.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, `recording-${Date.now()}.webm`);
        try {
          const { data } = await api.post(`/recordings/upload/${leadId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setRecordings(prev => [data, ...prev]);
          toast.success('Audio memo saved ✅');
        } catch {
          toast.error('Failed to save recording');
        }
        stream.getTracks().forEach(t => t.stop());
        setDuration(0);
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
    setMediaRecorder(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      return toast.error('File too large. Max size is 20MB.');
    }

    const formData = new FormData();
    formData.append('audio', file);
    setUploadingFile(true);
    try {
      const { data } = await api.post(`/recordings/upload/${leadId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRecordings(prev => [data, ...prev]);
      toast.success('Audio file uploaded ✅');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast.error('Failed to upload audio file');
    } finally {
      setUploadingFile(false);
    }
  };

  const togglePlay = (id, url) => {
    if (playingId === id) {
      audioRefs.current[id]?.pause();
      setPlayingId(null);
    } else {
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId].pause();
      }
      if (!audioRefs.current[id]) {
        const audio = new window.Audio(url);
        audio.onended = () => setPlayingId(null);
        audioRefs.current[id] = audio;
      }
      audioRefs.current[id].play();
      setPlayingId(id);
    }
  };

  const deleteRecording = async (recId) => {
    try {
      await api.delete(`/recordings/${recId}`);
      setRecordings(prev => prev.filter(r => r._id !== recId));
      toast.success('Recording deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const formatDuration = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://api-app.sahyak.com');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="section-title" style={{ margin: 0 }}>🎙️ Audio Notes & Call Memos</p>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{recordings.length} total</span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!recording ? (
            <button onClick={startRecording} className="btn btn-secondary btn-sm" style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
              <Mic size={15} color="var(--red)" /> Record Memo
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, padding: '6px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 10 }}>
              <span className="badge badge-new" style={{ animation: 'pulse 1s infinite' }}>REC</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--red)', fontSize: 13 }}>{formatDuration(duration)}</span>
              <button onClick={stopRecording} className="btn btn-danger btn-sm" style={{ marginLeft: 'auto', gap: 4 }}>
                <MicOff size={13} /> Stop
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <input 
          type="file" 
          accept="audio/*" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          style={{ display: 'none' }} 
        />
        <button 
          onClick={() => fileInputRef.current?.click()} 
          disabled={uploadingFile}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', justifyContent: 'center', gap: 6, fontSize: 12 }}
        >
          {uploadingFile ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><Plus size={14} /> Upload Audio File</>}
        </button>
      </div>

      {recordings.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recordings.map(r => (
            <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <button
                onClick={() => togglePlay(r._id, `${BASE}/uploads/recordings/${r.filename}`)}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                {playingId === r._id ? <Pause size={14} color="white" /> : <Play size={14} color="white" />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.originalName || r.filename}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{format(new Date(r.createdAt), 'dd MMM, h:mm a')}</p>
              </div>
              <button onClick={() => deleteRecording(r._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0', margin: 0 }}>No audio notes yet</p>
      )}
    </div>
  );
}

// ── LIVE WHATSAPP CHAT & DUAL SENDER SECTION ──────────────────────────────────
function WhatsAppChatSection({ lead, waStatus, onOpenTemplates, onOpenShareFee, refreshKey }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatText, setChatText] = useState('');
  const [senderMode, setSenderMode] = useState('personal'); // 'company' | 'personal'
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef(null);
  const isFetchingHistoryRef = useRef(false);

  const canUseCompanyWA = Boolean(waStatus?.allowCompanyWhatsApp && waStatus?.company?.status === 'connected');
  const isPersonalConnected = waStatus?.personal?.status === 'connected' || waStatus?.status === 'connected';
  const isAnyConnected = isPersonalConnected || canUseCompanyWA;

  useEffect(() => {
    if (canUseCompanyWA && !isPersonalConnected) {
      setSenderMode('company');
    } else if (waStatus?.defaultSender) {
      setSenderMode(waStatus.defaultSender);
    }
  }, [waStatus, canUseCompanyWA, isPersonalConnected]);

  const fetchHistory = async (silent = false) => {
    if (!lead?.phone) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (isFetchingHistoryRef.current) return;
    isFetchingHistoryRef.current = true;
    try {
      const { data } = await api.get(`/whatsapp/chats/${lead.phone}?leadId=${lead._id || ''}`);
      setMessages(data || []);
      if (!silent) setLoading(false);
    } catch {
      if (!silent) setLoading(false);
    } finally {
      isFetchingHistoryRef.current = false;
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(() => {
      fetchHistory(true);
    }, 3500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchHistory(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [lead?.phone, lead?._id, refreshKey]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || sending) return;

    if (!isAnyConnected) {
      return toast.error('Please connect WhatsApp in WhatsApp Hub to send messages.');
    }

    const textToSend = chatText.trim();
    setChatText('');

    const optimisticMsg = {
      _id: 'temp-' + Date.now(),
      direction: 'outbound',
      text: textToSend,
      senderName: senderMode === 'company' ? 'Organization WA' : 'You',
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setSending(true);

    try {
      await api.post(`/whatsapp/chats/${lead.phone}/send`, {
        text: textToSend,
        sender: senderMode,
      });
      toast.success(`Sent via ${senderMode === 'company' ? 'Organization WA 🏢' : 'Personal WA 📱'}!`);
      fetchHistory(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      setChatText(textToSend);
      setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
    } finally {
      setSending(false);
    }
  };

  const copyText = (txt) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    toast.success('Copied! 📋');
  };

  const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://api-app.sahyak.com');

  return (
    <div className="card" style={{ marginBottom: 16, padding: '16px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={17} color="var(--green)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>WhatsApp Client Conversation</h3>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>+{lead.phone}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => fetchHistory()}
            title="Refresh messages"
            className="btn btn-ghost btn-sm"
            style={{ padding: 6, minHeight: 'auto', borderRadius: 8 }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Dual Sender Toggle */}
      {canUseCompanyWA && (
        <div style={{
          display: 'flex',
          gap: 6,
          background: 'var(--surface)',
          padding: 4,
          borderRadius: 10,
          border: '1px solid var(--border)',
          marginBottom: 10,
        }}>
          <button
            type="button"
            onClick={() => setSenderMode('company')}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: senderMode === 'company' ? 'var(--accent)' : 'transparent',
              color: senderMode === 'company' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            🏢 Organization WA
          </button>
          <button
            type="button"
            onClick={() => setSenderMode('personal')}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: senderMode === 'personal' ? 'var(--accent)' : 'transparent',
              color: senderMode === 'personal' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            📱 Personal WA
          </button>
        </div>
      )}

      {/* Chat Thread Messages */}
      <div
        ref={chatScrollRef}
        style={{
          maxHeight: 340,
          minHeight: 200,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '12px 10px',
          marginBottom: 12,
          background: 'var(--bg)',
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div className="spinner" style={{ width: 22, height: 22 }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 12px', color: 'var(--text-muted)' }}>
            <MessageCircle size={32} color="var(--border)" style={{ marginBottom: 6 }} />
            <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 600 }}>No messages yet</p>
            <p style={{ margin: 0, fontSize: 11 }}>Send a proposal template or type an English message below.</p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isOutbound = m.direction === 'outbound';
            return (
              <div
                key={m._id || idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOutbound ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  alignSelf: isOutbound ? 'flex-end' : 'flex-start',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 2, paddingLeft: 4, paddingRight: 4 }}>
                  {isOutbound ? m.senderName || 'You' : (m.senderName || lead.name || 'Client')}
                </span>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 16,
                    borderBottomRightRadius: isOutbound ? 3 : 16,
                    borderBottomLeftRadius: !isOutbound ? 3 : 16,
                    background: isOutbound ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' : 'var(--surface)',
                    color: isOutbound ? '#ffffff' : 'var(--text)',
                    border: isOutbound ? 'none' : '1px solid var(--border)',
                    boxShadow: isOutbound ? '0 2px 8px rgba(79, 70, 229, 0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
                    wordBreak: 'break-word',
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  {m.mediaType === 'image' && m.mediaUrl && (
                    <a href={m.mediaUrl.startsWith('http') ? m.mediaUrl : `${BASE}${m.mediaUrl}`} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 6 }}>
                      <img
                        src={m.mediaUrl.startsWith('http') ? m.mediaUrl : `${BASE}${m.mediaUrl}`}
                        alt="Attached Media"
                        style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 10, objectFit: 'cover', display: 'block' }}
                      />
                    </a>
                  )}
                  {m.mediaType === 'video' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                      <VideoIcon size={14} /> <span>Video Attachment</span>
                    </div>
                  )}
                  {m.mediaType === 'document' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                      <FileIcon size={14} /> <span>Document Attachment</span>
                    </div>
                  )}

                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.text}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, paddingRight: 4, paddingLeft: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {m.timestamp ? format(new Date(m.timestamp), 'h:mm a, dd MMM') : ''}
                  </span>
                  {isOutbound && <CheckCheck size={12} color="#818cf8" />}
                  <button
                    onClick={() => copyText(m.text)}
                    title="Copy message"
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 4, opacity: 0.7 }}
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Bar & Direct Action Shortcuts */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onOpenTemplates}
            title="Use English template"
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', height: 38, flexShrink: 0, gap: 5, borderRadius: 10, fontSize: 12 }}
          >
            <Paperclip size={13} />
            <span>Templates</span>
          </button>

          <button
            type="button"
            onClick={onOpenShareFee}
            title="Share College Fee Structure"
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', height: 38, flexShrink: 0, gap: 5, borderRadius: 10, fontSize: 12, color: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            <GraduationCap size={14} />
            <span>Fee Structure</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder={`Type English message (${senderMode === 'company' ? 'Org WA' : 'Personal WA'})...`}
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            disabled={!isAnyConnected || sending}
            className="input"
            style={{ flex: 1, height: 42, fontSize: 13, borderRadius: 10 }}
          />

          <button
            type="submit"
            disabled={!isAnyConnected || !chatText.trim() || sending}
            className="btn btn-primary"
            style={{ width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 10 }}
          >
            {sending ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Send size={15} />}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── FULLY EDITABLE ENGLISH TEMPLATE PICKER MODAL ──────────────────────────────
function TemplatePickerModal({ lead, waStatus, onClose, onSent }) {
  const [dbTemplates, setDbTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editableText, setEditableText] = useState('');
  const [sending, setSending] = useState(false);

  // Standard high-converting English admission templates
  const defaultEnglishPresets = useMemo(() => [
    {
      _id: 'preset-inquiry',
      title: '🎓 1. Admission Inquiry & Course Details',
      text: `Hello ${lead.name || 'Student'},

Thank you for reaching out to us regarding your higher education admission! 🎓

We have received your interest in ${lead.targetCourse || 'the requested program'}. Our admission team is ready to guide you on eligibility criteria, seat availability, and upcoming admission rounds.

Would you be available for a quick 5-minute telephonic counseling session today?

Best regards,
Admissions Team`
    },
    {
      _id: 'preset-fee-scholarship',
      title: '💰 2. College Fee & Merit Scholarship Overview',
      text: `Dear ${lead.name || 'Student'},

Here is a quick overview regarding course fees and scholarship opportunities for ${lead.targetCourse || 'your desired course'}:

✅ Institutional Merit Scholarships available up to 40%
✅ Flexible semester-wise installment options
✅ Complete bank loan assistance and documentation support

Please let me know if you would like me to share the verified fee breakdown of your preferred colleges!

Warm regards,
Academic Counselor`
    },
    {
      _id: 'preset-campus-visit',
      title: '🏛️ 3. Campus Tour & Counseling Invitation',
      text: `Hi ${lead.name || 'Student'},

We invite you and your parents to visit our campus for an in-person counseling session and campus tour! 🏛️

During your visit, you can:
- Tour the labs, libraries, and hostel facilities
- Interact directly with senior department faculty
- Verify required admission documents

Please share your preferred day (Monday - Saturday) between 10 AM to 4 PM so we can reserve your counseling slot.

Warm regards,
Admissions Coordinator`
    },
    {
      _id: 'preset-seat-reservation',
      title: '🔒 4. Provisional Seat Booking Reminder',
      text: `Dear ${lead.name || 'Candidate'},

This is an important update regarding seat allocation for ${lead.targetCourse || 'your program'}.

Seats in the preferred quota are filling rapidly. To safeguard your provisional admission and secure the scholarship benefit, we recommend completing the token confirmation within the next 48 hours.

Please reply or call us directly if you need any clarification on the admission procedure.

Best regards,
Director of Admissions`
    }
  ], [lead]);

  useEffect(() => {
    api.get('/templates')
      .then(r => setDbTemplates(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allTemplates = useMemo(() => {
    return [...defaultEnglishPresets, ...dbTemplates];
  }, [defaultEnglishPresets, dbTemplates]);

  // Select initial template
  useEffect(() => {
    if (!selectedTemplate && allTemplates.length > 0) {
      const first = allTemplates[0];
      setSelectedTemplate(first);
      setEditableText(mergeTemplate(first.text, lead));
    }
  }, [allTemplates, selectedTemplate, lead]);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setEditableText(mergeTemplate(template.text, lead));
  };

  const handleSend = async () => {
    if (!editableText.trim() || sending) return;
    const sender = (waStatus?.allowCompanyWhatsApp && waStatus?.company?.status === 'connected') ? 'company' : 'personal';

    setSending(true);
    try {
      await api.post('/whatsapp/send-media', {
        to: lead.phone,
        text: editableText.trim(),
        image: selectedTemplate?.imageFile?.url,
        video: selectedTemplate?.videoFile?.url,
        document: selectedTemplate?.docFile?.url,
        sender,
      });

      if (selectedTemplate?._id && !selectedTemplate._id.startsWith('preset-')) {
        api.post(`/templates/${selectedTemplate._id}/use`).catch(() => {});
      }

      toast.success('Dispatched English message to client via WhatsApp! 🚀');
      if (onSent) onSent();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch message');
    } finally {
      setSending(false);
    }
  };

  const handleOpenWebWA = () => {
    if (!lead?.phone || !editableText.trim()) return;
    const url = waLink(lead.phone, editableText.trim());
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = () => {
    if (!editableText.trim()) return;
    navigator.clipboard.writeText(editableText.trim());
    toast.success('English message copied to clipboard! 📋');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
              💬 Send English Template via WhatsApp
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Choose a template, edit any sentence before dispatching to <strong>+{lead.phone}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4 }}>
            {/* Template Selector Horizontal Pill Carousel */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Select Preset or Custom Template
              </label>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
                {allTemplates.map(t => {
                  const isSelected = selectedTemplate?._id === t._id;
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => handleSelectTemplate(t)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--surface)',
                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <span>{t.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable English Text Area */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Editable English Message Review
                </label>
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                  ✏️ You can edit anything below
                </span>
              </div>
              <textarea
                className="input"
                rows={9}
                value={editableText}
                onChange={e => setEditableText(e.target.value)}
                placeholder="Compose your English message..."
                style={{ width: '100%', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: 5, fontSize: 12 }}
                >
                  <Copy size={13} /> Copy
                </button>
                <button
                  type="button"
                  onClick={handleOpenWebWA}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: 5, fontSize: 12, color: 'var(--green)' }}
                >
                  <ExternalLink size={13} /> Web WA
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !editableText.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ gap: 6, fontWeight: 700 }}
                >
                  {sending ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Send size={13} />}
                  <span>Send via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CLOSE DEAL MODAL ──────────────────────────────────────────────────────────
function CloseDealModal({ isOpen, onClose, onConfirm, initialAmount }) {
  const [dealAmount, setDealAmount] = useState(initialAmount || '');

  useEffect(() => {
    setDealAmount(initialAmount || '');
  }, [initialAmount]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = Number(dealAmount);
    if (!val || isNaN(val) || val <= 0) {
      return toast.error('Please enter a valid deal amount.');
    }
    onConfirm(val);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
            🏆 Confirmed Admission / Won Deal
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
          Please enter the finalized package or token amount to mark this candidate as closed won.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label" style={{ fontSize: 12, fontWeight: 600 }}>Total Package / Token Value (₹) *</label>
            <input
              type="number"
              className="input"
              required
              min="1"
              step="any"
              placeholder="e.g. 150000"
              value={dealAmount}
              onChange={e => setDealAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }}>
              Confirm & Mark Closed Won 🏆
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN LEAD DETAIL PAGE COMPONENT ───────────────────────────────────────────
export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [leadId, setLeadId] = useState(() => getResolvedRouteParam(params, 'id', 'leads', isValidEntityId));
  const id = leadId || getResolvedRouteParam(params, 'id', 'leads', isValidEntityId);

  useEffect(() => {
    const resolved = getResolvedRouteParam(params, 'id', 'leads', isValidEntityId);
    if (resolved && resolved !== leadId) {
      setLeadId(resolved);
    }
  }, [params]);

  const [lead, setLead] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShareFeeModal, setShowShareFeeModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [pendingLostStage, setPendingLostStage] = useState('');
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [showCompleteFollowUpModal, setShowCompleteFollowUpModal] = useState(false);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [waStatus, setWaStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [mobileTab, setMobileTab] = useState('details');
  const [activeRightTab, setActiveRightTab] = useState('chat'); // 'chat' | 'notes' | 'memos' | 'audit'
  const [editTab, setEditTab] = useState('academics'); // 'academics' | 'entrance' | 'preferences' | 'personal' | 'milestones'

  useEffect(() => {
    if (!leadId) {
      const resolved = getActualId();
      if (resolved) setLeadId(resolved);
    }
  }, [params]);

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) setCurrentUser(JSON.parse(u));
    } catch {}
  }, []);

  useEffect(() => {
    const activeId = leadId || getActualId();
    if (!activeId || activeId === '[id]' || activeId === 'placeholder' || activeId === 'undefined' || activeId === 'null' || !/^[0-9a-fA-F]{24}$/.test(activeId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      api.get(`/leads/${activeId}`),
      api.get('/projects').catch(() => ({ data: [] })),
      api.get('/whatsapp/status').catch(() => ({ data: null })),
    ]).then(([leadRes, projRes, waRes]) => {
      setLead(leadRes.data);
      setForm(leadRes.data);
      setProjects(projRes.data || []);
      setWaStatus(waRes.data);
    }).catch(() => {
      toast.error('Lead not found');
    }).finally(() => {
      setLoading(false);
    });
  }, [id, leadId]);

  const industryDefaults = getIndustryDefaults(currentUser?.industryType);

  const rawSchema = (currentUser?.leadFormSchema && Array.isArray(currentUser.leadFormSchema) && currentUser.leadFormSchema.length > 0)
    ? currentUser.leadFormSchema
    : industryDefaults.leadFormSchema;

  const isFieldVisible = (field) => {
    if (field.isHidden) return false;
    if (!field.dependsOn || !field.dependsOn.field) return true;
    const parentVal = form[field.dependsOn.field] || form.customData?.[field.dependsOn.field] || '';
    return String(parentVal || '').trim().toLowerCase() === String(field.dependsOn.value || '').trim().toLowerCase();
  };

  const activeFields = [...rawSchema]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter(isFieldVisible);

  const isRealEstate = Boolean(
    String(currentUser?.industryType || '').toLowerCase().includes('real') ||
    String(currentUser?.industryType || '').toLowerCase().includes('estate') ||
    lead?.propertyType
  );

  const handleQuickTemperature = async (newTemp) => {
    try {
      const { data } = await api.put(`/leads/${id}`, { temperature: newTemp });
      setLead(data);
      setForm(data);
      toast.success(`Priority updated to ${newTemp}!`);
    } catch {
      toast.error('Failed to update temperature');
    }
  };

  const handleStatusSelectChange = (newStatus) => {
    if (newStatus === 'closed' || newStatus === 'converted' || newStatus === 'Closed Won' || newStatus === 'Won') {
      setShowCloseModal(true);
      return;
    }
    if (isLostStage(newStatus)) {
      setPendingLostStage(newStatus);
      setShowLostModal(true);
      return;
    }
    setForm(f => ({ ...f, status: newStatus }));
    if (!editing) {
      api.put(`/leads/${id}`, { status: newStatus }).then(res => {
        setLead(res.data);
        setForm(res.data);
        toast.success(`Stage updated to ${STAGE_LABELS[newStatus] || newStatus}`);
      }).catch(err => {
        toast.error(err.response?.data?.message || 'Failed to update stage');
      });
    }
  };

  const handleConfirmCloseDeal = async (amount) => {
    setShowCloseModal(false);
    const targetStatus = lead.status === 'converted' ? 'converted' : 'closed';
    setForm(f => ({ ...f, status: targetStatus, closedDealAmount: amount, admissionFinalFee: amount }));
    try {
      const { data } = await api.put(`/leads/${id}`, { status: targetStatus, closedDealAmount: amount, admissionFinalFee: amount });
      setLead(data);
      setForm(data);
      toast.success(`🎉 Deal Confirmed & Closed Won for ₹${amount.toLocaleString('en-IN')}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close deal');
    }
  };

  const handleConfirmLostReason = async ({ lostReason, lostReasonDetail, targetStage }) => {
    setShowLostModal(false);
    setForm(f => ({ ...f, status: targetStage, lostReason, lostReasonDetail }));
    try {
      const { data } = await api.put(`/leads/${id}`, {
        status: targetStage,
        lostReason,
        lostReasonDetail,
      });
      setLead(data);
      setForm(data);
      toast.success(`Status updated to ${targetStage}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const startEditing = () => {
    setForm({
      ...lead,
      name: lead.name || '',
      phone: lead.phone || '',
      alternatePhone: lead.alternatePhone || '',
      email: lead.email || '',
      dob: lead.dob ? toLocalDatetimeString(lead.dob).slice(0, 10) : '',
      gender: lead.gender || '',
      category: lead.category || '',
      city: lead.city || lead.targetCity || '',
      state: lead.state || lead.targetState || '',
      address: lead.address || '',
      pincode: lead.pincode || '',
      fatherName: lead.fatherName || '',
      fatherPhone: lead.fatherPhone || '',
      fatherOccupation: lead.fatherOccupation || '',
      motherName: lead.motherName || '',
      tenthBoard: lead.tenthBoard || '',
      tenthPercentage: lead.tenthPercentage ?? lead.academicScore10th ?? '',
      tenthYear: lead.tenthYear || '',
      twelfthBoard: lead.twelfthBoard || '',
      twelfthStream: lead.twelfthStream || lead.stream || '',
      twelfthPercentage: lead.twelfthPercentage ?? lead.academicScore12th ?? '',
      twelfthGroupPercentage: lead.twelfthGroupPercentage ?? '',
      twelfthYear: lead.twelfthYear || '',
      gradDegree: lead.gradDegree || '',
      gradCollege: lead.gradCollege || '',
      gradPercentage: lead.gradPercentage ?? lead.academicScoreGrad ?? '',
      gradYear: lead.gradYear || '',
      entranceExam: lead.entranceExam || '',
      entranceExamRollNo: lead.entranceExamRollNo || '',
      entranceScore: lead.entranceScore || '',
      entranceRank: lead.entranceRank || '',
      entrancePercentile: lead.entrancePercentile || '',
      targetCourse: lead.targetCourse || '',
      targetStream: lead.targetStream || lead.targetDomain || '',
      degreeLevel: lead.degreeLevel || '',
      preferredSpecialization: lead.preferredSpecialization || '',
      preferredColleges: lead.preferredColleges || '',
      targetState: lead.targetState || '',
      quotaPreference: lead.quotaPreference || '',
      budget: lead.budget || lead.packageBudget || '',
      campusVisitDate: (lead.campusVisitDate || lead.siteVisitDate) ? toLocalDatetimeString(lead.campusVisitDate || lead.siteVisitDate).slice(0, 16) : '',
      tokenAdvancePaid: lead.tokenAdvancePaid || '',
      admissionFinalFee: lead.admissionFinalFee || lead.closedDealAmount || '',
      customData: { ...(lead.customData || {}) },
    });
    setEditing(true);
  };

  const saveLead = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        closedDealAmount: form.closedDealAmount ? Number(form.closedDealAmount) : (form.admissionFinalFee ? Number(form.admissionFinalFee) : null),
        admissionFinalFee: form.admissionFinalFee ? Number(form.admissionFinalFee) : (form.closedDealAmount ? Number(form.closedDealAmount) : 0),
        tokenAdvancePaid: form.tokenAdvancePaid ? Number(form.tokenAdvancePaid) : 0,
        tenthPercentage: form.tenthPercentage !== '' && form.tenthPercentage !== null && !isNaN(Number(form.tenthPercentage)) ? Number(form.tenthPercentage) : null,
        academicScore10th: form.tenthPercentage !== '' && form.tenthPercentage !== null && !isNaN(Number(form.tenthPercentage)) ? Number(form.tenthPercentage) : null,
        twelfthPercentage: form.twelfthPercentage !== '' && form.twelfthPercentage !== null && !isNaN(Number(form.twelfthPercentage)) ? Number(form.twelfthPercentage) : null,
        academicScore12th: form.twelfthPercentage !== '' && form.twelfthPercentage !== null && !isNaN(Number(form.twelfthPercentage)) ? Number(form.twelfthPercentage) : null,
        twelfthGroupPercentage: form.twelfthGroupPercentage !== '' && form.twelfthGroupPercentage !== null && !isNaN(Number(form.twelfthGroupPercentage)) ? Number(form.twelfthGroupPercentage) : null,
        gradPercentage: form.gradPercentage !== '' && form.gradPercentage !== null && !isNaN(Number(form.gradPercentage)) ? Number(form.gradPercentage) : null,
        academicScoreGrad: form.gradPercentage !== '' && form.gradPercentage !== null && !isNaN(Number(form.gradPercentage)) ? Number(form.gradPercentage) : null,
        dob: form.dob ? new Date(form.dob) : null,
        campusVisitDate: form.campusVisitDate ? new Date(form.campusVisitDate) : null,
        siteVisitDate: form.campusVisitDate ? new Date(form.campusVisitDate) : (form.siteVisitDate ? new Date(form.siteVisitDate) : null),
      };
      const { data } = await api.put(`/leads/${id}`, payload);
      setLead(data);
      setForm(data);
      setEditing(false);
      toast.success('Candidate profile updated ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async () => {
    if (!confirm('Are you sure you want to delete this candidate record?')) return;
    try {
      await api.delete(`/leads/${id}`);
      toast.success('Lead deleted successfully');
      router.push('/leads');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete lead');
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const { data } = await api.post(`/leads/${id}/notes`, { text: noteText.trim() });
      setLead(data);
      setNoteText('');
      toast.success('Counseling note added ✅');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="app-shell pb-mobile-nav">
      <div className="page-container max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8">
        
        {/* ── PSYCHOLOGICALLY IMPACTFUL EXECUTIVE HERO & PIPELINE BANNER ── */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm mb-4 space-y-4">
          
          {/* Top Row: Candidate Identity, Source & Priority */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition shrink-0 mt-0.5 sm:mt-0"
                title="Go back"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0 truncate">
                    {lead.name}
                  </h1>
                  <SourcePill lead={lead} showDetail={true} />

                  {/* Priority / Temperature Toggle */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickTemperature('HOT')}
                      className={`px-2.5 py-0.5 rounded-md font-bold transition flex items-center gap-1 ${
                        (lead.temperature || 'WARM').toUpperCase() === 'HOT'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'text-slate-500 hover:text-rose-600'
                      }`}
                      title="Set Priority: Hot"
                    >
                      🔥 Hot
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickTemperature('WARM')}
                      className={`px-2.5 py-0.5 rounded-md font-bold transition flex items-center gap-1 ${
                        (lead.temperature || 'WARM').toUpperCase() === 'WARM'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-500 hover:text-amber-600'
                      }`}
                      title="Set Priority: Warm"
                    >
                      🌤️ Warm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickTemperature('COLD')}
                      className={`px-2.5 py-0.5 rounded-md font-bold transition flex items-center gap-1 ${
                        (lead.temperature || 'WARM').toUpperCase() === 'COLD' || (lead.temperature || 'WARM').toUpperCase() === 'COL'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-sky-600'
                      }`}
                      title="Set Priority: Cold"
                    >
                      ❄️ Cold
                    </button>
                  </div>
                </div>

                {/* Subtitle Contact Details */}
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <a
                    href={`tel:${lead.phone}`}
                    className="font-mono font-bold text-slate-700 hover:text-indigo-600 flex items-center gap-1 transition"
                  >
                    📞 +{lead.phone}
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(lead.phone);
                      toast.success('Phone copied! 📋');
                    }}
                    className="text-slate-400 hover:text-slate-700"
                    title="Copy phone"
                  >
                    <Copy size={11} />
                  </button>

                  {lead.email && (
                    <>
                      <span>•</span>
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-slate-600 hover:text-indigo-600 flex items-center gap-1 truncate max-w-xs"
                      >
                        ✉️ {lead.email}
                      </a>
                    </>
                  )}

                  {lead.targetCourse && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
                        <GraduationCap size={12} /> {lead.targetCourse}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Profile & Action Tools */}
            <div className="flex items-center gap-2 self-end md:self-center">
              {!editing ? (
                <>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <Edit2 size={13} /> Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={deleteLead}
                    className="btn btn-ghost btn-sm text-rose-600 hover:bg-rose-50 p-2 rounded-xl"
                    title="Delete Candidate Record"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(lead);
                      setEditing(false);
                    }}
                    className="btn btn-secondary btn-sm text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveLead}
                    disabled={saving}
                    className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    {saving ? <div className="spinner" style={{ width: 13, height: 13 }} /> : <Check size={14} />}
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Admissions Funnel Stepper */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Admissions Funnel Progression:
              </span>
              <span className="text-[11px] font-bold text-indigo-700 capitalize">
                Stage: {STAGE_LABELS[lead.status] || (lead.status || 'new').replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-7 gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 scroll-smooth snap-x touch-pan-x">
              {[
                { key: 'new_lead', aliases: ['new', 'new_lead'], label: '1. New Lead' },
                { key: 'contacted', aliases: ['contacted'], label: '2. Tele-Counsel' },
                { key: 'shortlisted', aliases: ['shortlisted'], label: '3. Shortlisted' },
                { key: 'site_visit_scheduled', aliases: ['site_visit_scheduled'], label: '4. Campus Visit' },
                { key: 'negotiation', aliases: ['negotiation'], label: '5. Quota Booking' },
                { key: 'converted', aliases: ['closed', 'converted'], label: '6. Confirmed Won' },
                { key: 'lost', aliases: ['lost', 'not_interested'], label: '❌ Dropped / Lost' },
              ].map(st => {
                const isActive = st.aliases.includes(lead.status) || lead.status === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => handleStatusSelectChange(st.key)}
                    className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer shrink-0 whitespace-nowrap min-w-[110px] sm:min-w-0 sm:shrink snap-start ${
                      isActive
                        ? (st.key === 'converted' || lead.status === 'closed')
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : (st.key === 'lost' || lead.status === 'not_interested')
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scheduled Follow-Up Alert Strip */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Follow-Up:</span>
              {lead.followUpDate ? (
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Clock size={13} className="text-amber-500" />
                  <span>{formatDisplayDateTime(lead.followUpDate)}</span>
                  {lead.followUpStatus === 'completed' && (
                    <span className="badge badge-closed text-[10px]">Completed ✅</span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 italic">No scheduled follow-up</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {lead.followUpDate && lead.followUpStatus !== 'completed' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCompleteFollowUpModal(true)}
                    className="btn btn-xs btn-primary font-bold px-3 py-1 rounded-lg flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 size={12} /> Mark Done
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSchedulerModal(true)}
                    className="btn btn-xs btn-secondary font-bold px-3 py-1 rounded-lg flex items-center gap-1"
                  >
                    <Calendar size={12} /> Reschedule
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSchedulerModal(true)}
                  className="btn btn-xs btn-secondary font-bold px-3 py-1 rounded-lg flex items-center gap-1 text-indigo-700"
                >
                  <Calendar size={12} /> Schedule Follow-Up
                </button>
              )}
            </div>
          </div>

          {/* 1-Click High-Converting Action Command Bar */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1 border-t border-slate-100">
            <a
              href={`tel:${lead.phone}`}
              className="btn btn-secondary btn-sm flex-1 sm:flex-initial min-w-[75px] sm:min-w-[105px] text-xs py-2 px-2.5 sm:px-3.5 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Phone size={14} className="text-indigo-600 shrink-0" /> <span>Call</span>
            </a>

            <button
              type="button"
              onClick={() => {
                setActiveRightTab('chat');
                setMobileTab('chat');
              }}
              className="btn btn-secondary btn-sm flex-1 sm:flex-initial min-w-[100px] sm:min-w-[125px] text-xs py-2 px-2.5 sm:px-3.5 rounded-xl font-bold flex items-center justify-center gap-1.5 text-emerald-700 bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100 shadow-xs"
            >
              <MessageCircle size={14} className="text-emerald-600 shrink-0" /> <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="btn btn-secondary btn-sm flex-1 sm:flex-initial min-w-[100px] sm:min-w-[130px] text-xs py-2 px-2.5 sm:px-3.5 rounded-xl font-bold flex items-center justify-center gap-1.5 text-indigo-700 bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100 shadow-xs"
            >
              <Paperclip size={14} className="text-indigo-600 shrink-0" /> <span>Templates</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShareFeeModal(true)}
              className="btn btn-primary btn-sm flex-1 sm:flex-initial min-w-[125px] sm:min-w-[160px] text-xs py-2 px-3 sm:px-4 rounded-xl font-bold flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 text-white shadow-md hover:from-indigo-700 hover:to-blue-700 transition"
            >
              <GraduationCap size={15} className="text-white shrink-0" />
              <span>Share Fee</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="lg:hidden mb-3">
          <div className="segmented-control bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setMobileTab('details')}
              className={`segmented-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
                mobileTab === 'details'
                  ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 border border-transparent'
              }`}
            >
              📋 Info
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('chat')}
              className={`segmented-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
                mobileTab === 'chat'
                  ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 border border-transparent'
              }`}
            >
              💬 Chat
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('notes')}
              className={`segmented-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
                mobileTab === 'notes'
                  ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 border border-transparent'
              }`}
            >
              📝 Notes
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('memos')}
              className={`segmented-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
                mobileTab === 'memos'
                  ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 border border-transparent'
              }`}
            >
              🎙️ Audio
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('audit')}
              className={`segmented-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
                mobileTab === 'audit'
                  ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 border border-transparent'
              }`}
            >
              ⏱️ Audit
            </button>
          </div>
        </div>

        {/* ── DESKTOP SPLIT-SCREEN WORKSPACE ── */}
        <div className="details-split-grid">
          
          {/* LEFT COLUMN: Candidate Dossier & Academic Profile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Academic & Personal Profile Card */}
            <div className={`card ${mobileTab === 'details' ? 'block' : 'hidden lg:block'}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GraduationCap size={16} color="var(--accent)" /> Student Candidate Dossier
                </p>
                <div className="flex items-center gap-2">
                  {lead.score !== undefined && lead.score > 0 && (
                    <span className="badge badge-primary text-[10px] font-bold">
                      Score: {lead.score}/100
                    </span>
                  )}
                  {editing && (
                    <span className="badge badge-warning text-[10px] font-bold">
                      Editing Mode
                    </span>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="space-y-4">
                  {/* Edit Tabs Controller */}
                  <div className="segmented-control bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80 overflow-x-auto">
                    {[
                      { id: 'academics', label: '🎓 Academics' },
                      { id: 'entrance', label: '📝 Entrance' },
                      { id: 'preferences', label: '🏛️ Preferences' },
                      { id: 'personal', label: '👤 Personal & Family' },
                      { id: 'milestones', label: '💼 Milestones & Fee' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEditTab(tab.id)}
                        className={`segmented-btn flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
                          editTab === tab.id
                            ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 font-extrabold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* 1. Academics Tab */}
                  {editTab === 'academics' && (
                    <div className="space-y-4 pt-1">
                      {/* 10th Details */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                        <span className="text-[11px] font-extrabold uppercase text-slate-500 block mb-2">
                          📘 10th Standard / Secondary School
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">10th Board</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. CBSE, ICSE, State Board"
                              value={form.tenthBoard ?? ''}
                              onChange={e => setForm(f => ({ ...f, tenthBoard: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">10th Percentage (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="input text-xs"
                              placeholder="e.g. 88.5"
                              value={form.tenthPercentage ?? form.academicScore10th ?? ''}
                              onChange={e => setForm(f => ({ ...f, tenthPercentage: e.target.value, academicScore10th: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Passing Year</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. 2022"
                              value={form.tenthYear ?? ''}
                              onChange={e => setForm(f => ({ ...f, tenthYear: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 12th Details */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                        <span className="text-[11px] font-extrabold uppercase text-slate-500 block mb-2">
                          📗 12th Standard / Higher Secondary (10+2)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">12th Board</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. CBSE, ISC, State Board"
                              value={form.twelfthBoard ?? ''}
                              onChange={e => setForm(f => ({ ...f, twelfthBoard: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Academic Stream</label>
                            <select
                              className="input text-xs cursor-pointer"
                              value={form.twelfthStream ?? form.stream ?? ''}
                              onChange={e => setForm(f => ({ ...f, twelfthStream: e.target.value, stream: e.target.value }))}
                            >
                              <option value="">-- Select Stream --</option>
                              <option value="PCM">PCM (Physics, Chemistry, Maths)</option>
                              <option value="PCB">PCB (Physics, Chemistry, Biology)</option>
                              <option value="PCMB">PCMB (Maths & Biology)</option>
                              <option value="Commerce">Commerce</option>
                              <option value="Arts / Humanities">Arts / Humanities</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Aggregate Marks (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="input text-xs"
                              placeholder="e.g. 84.2"
                              value={form.twelfthPercentage ?? form.academicScore12th ?? ''}
                              onChange={e => setForm(f => ({ ...f, twelfthPercentage: e.target.value, academicScore12th: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">PCM / PCB Group (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="input text-xs"
                              placeholder="Key for B.Tech/MBBS"
                              value={form.twelfthGroupPercentage ?? ''}
                              onChange={e => setForm(f => ({ ...f, twelfthGroupPercentage: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Passing Year</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. 2024"
                              value={form.twelfthYear ?? ''}
                              onChange={e => setForm(f => ({ ...f, twelfthYear: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Graduation Details */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                        <span className="text-[11px] font-extrabold uppercase text-slate-500 block mb-2">
                          🎓 Graduation / Undergraduate (For PG/MBA applicants)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Graduation Degree</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. B.Tech, B.Com, B.Sc, BBA"
                              value={form.gradDegree ?? ''}
                              onChange={e => setForm(f => ({ ...f, gradDegree: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">College / University</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. Delhi University, VTU, Pune University"
                              value={form.gradCollege ?? ''}
                              onChange={e => setForm(f => ({ ...f, gradCollege: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Graduation % / CGPA</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="input text-xs"
                              placeholder="e.g. 76.5 or 8.1"
                              value={form.gradPercentage ?? form.academicScoreGrad ?? ''}
                              onChange={e => setForm(f => ({ ...f, gradPercentage: e.target.value, academicScoreGrad: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Passing / Completion Year</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. 2025"
                              value={form.gradYear ?? ''}
                              onChange={e => setForm(f => ({ ...f, gradYear: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Entrance Exams Tab */}
                  {editTab === 'entrance' && (
                    <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 space-y-3 pt-2">
                      <span className="text-[11px] font-extrabold uppercase text-slate-500 block">
                        📝 Competitive & National / State Entrance Examinations
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Exam Name</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. NEET-UG, JEE-Main, CAT, CUET, CLAT"
                            value={form.entranceExam ?? ''}
                            onChange={e => setForm(f => ({ ...f, entranceExam: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Roll / Application Number</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. 2403100582"
                            value={form.entranceExamRollNo ?? ''}
                            onChange={e => setForm(f => ({ ...f, entranceExamRollNo: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Marks / Score Obtained</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. 580/720 or 195/300"
                            value={form.entranceScore ?? ''}
                            onChange={e => setForm(f => ({ ...f, entranceScore: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">All India Rank (AIR)</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. 14250"
                            value={form.entranceRank ?? ''}
                            onChange={e => setForm(f => ({ ...f, entranceRank: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Percentile (%ile)</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. 96.8"
                            value={form.entrancePercentile ?? ''}
                            onChange={e => setForm(f => ({ ...f, entrancePercentile: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Preferences & Quota Tab */}
                  {editTab === 'preferences' && (
                    <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 space-y-3 pt-2">
                      <span className="text-[11px] font-extrabold uppercase text-slate-500 block">
                        🏛️ Target Program, Quota & College Preferences
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Target Program / Course</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. B.Tech Computer Science, MBBS, MBA"
                            value={form.targetCourse ?? ''}
                            onChange={e => setForm(f => ({ ...f, targetCourse: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Stream / Domain</label>
                          <select
                            className="input text-xs cursor-pointer"
                            value={form.targetStream ?? form.targetDomain ?? ''}
                            onChange={e => setForm(f => ({ ...f, targetStream: e.target.value, targetDomain: e.target.value }))}
                          >
                            <option value="">-- Select Domain --</option>
                            <option value="Engineering (B.Tech/BE)">Engineering (B.Tech/BE)</option>
                            <option value="Management (MBA/PGDM/BBA)">Management (MBA/PGDM/BBA)</option>
                            <option value="Medical (MBBS/BDS/BAMS)">Medical (MBBS/BDS/BAMS)</option>
                            <option value="Pharmacy (B.Pharm)">Pharmacy (B.Pharm)</option>
                            <option value="Law (BA LLB/BBA LLB)">Law (BA LLB/BBA LLB)</option>
                            <option value="Architecture / Design">Architecture / Design</option>
                            <option value="Nursing & Allied Health">Nursing & Allied Health</option>
                            <option value="Arts & Sciences">Arts & Sciences</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Degree Level</label>
                          <select
                            className="input text-xs cursor-pointer"
                            value={form.degreeLevel ?? ''}
                            onChange={e => setForm(f => ({ ...f, degreeLevel: e.target.value }))}
                          >
                            <option value="">-- Select Degree Level --</option>
                            <option value="Undergraduate (UG)">Undergraduate (UG)</option>
                            <option value="Postgraduate (PG)">Postgraduate (PG)</option>
                            <option value="Diploma">Diploma</option>
                            <option value="Doctorate (Ph.D)">Doctorate (Ph.D)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Preferred Specialization</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. AI & ML, Data Science, Pediatrics"
                            value={form.preferredSpecialization ?? ''}
                            onChange={e => setForm(f => ({ ...f, preferredSpecialization: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Preferred Colleges / Universities</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. Ramaiah, RVCE, Manipal, SRM"
                            value={form.preferredColleges ?? ''}
                            onChange={e => setForm(f => ({ ...f, preferredColleges: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Preferred State / Location</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. Karnataka / Bangalore, Maharashtra"
                            value={form.targetState ?? ''}
                            onChange={e => setForm(f => ({ ...f, targetState: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Admission Quota Preference</label>
                          <select
                            className="input text-xs cursor-pointer"
                            value={form.quotaPreference ?? ''}
                            onChange={e => setForm(f => ({ ...f, quotaPreference: e.target.value }))}
                          >
                            <option value="">-- No Quota Specified --</option>
                            <option value="Merit Quota">Merit Quota</option>
                            <option value="Management / Institutional Quota">Management / Institutional Quota</option>
                            <option value="NRI Quota">NRI Quota</option>
                            <option value="Govt / Sponsored Quota">Govt / Sponsored Quota</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Total Package Budget</label>
                          <input
                            type="text"
                            className="input text-xs"
                            placeholder="e.g. ₹5 - ₹10 Lakhs, ₹15 - ₹20 Lakhs"
                            value={form.budget ?? form.packageBudget ?? ''}
                            onChange={e => setForm(f => ({ ...f, budget: e.target.value, packageBudget: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Personal & Family Tab */}
                  {editTab === 'personal' && (
                    <div className="space-y-4 pt-1">
                      {/* Personal Coordinates */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                        <span className="text-[11px] font-extrabold uppercase text-slate-500 block mb-2">
                          👤 Candidate Coordinates
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Full Name *</label>
                            <input
                              type="text"
                              required
                              className="input text-xs font-semibold"
                              value={form.name ?? ''}
                              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Primary Phone Number *</label>
                            <input
                              type="text"
                              required
                              className="input text-xs font-semibold"
                              value={form.phone ?? ''}
                              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Alternate Phone / WhatsApp</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. 9876543210"
                              value={form.alternatePhone ?? ''}
                              onChange={e => setForm(f => ({ ...f, alternatePhone: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Email Address</label>
                            <input
                              type="email"
                              className="input text-xs"
                              value={form.email ?? ''}
                              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Date of Birth</label>
                            <input
                              type="date"
                              className="input text-xs"
                              value={form.dob ?? ''}
                              onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Gender</label>
                            <select
                              className="input text-xs cursor-pointer"
                              value={form.gender ?? ''}
                              onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                            >
                              <option value="">-- Select Gender --</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Category / Quota</label>
                            <select
                              className="input text-xs cursor-pointer"
                              value={form.category ?? ''}
                              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            >
                              <option value="">-- Select Category --</option>
                              <option value="General">General / Open</option>
                              <option value="OBC-NCL">OBC-NCL</option>
                              <option value="SC">SC</option>
                              <option value="ST">ST</option>
                              <option value="EWS">EWS</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">City</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. Pune"
                              value={form.city ?? form.targetCity ?? ''}
                              onChange={e => setForm(f => ({ ...f, city: e.target.value, targetCity: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">State</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. Maharashtra"
                              value={form.state ?? form.targetState ?? ''}
                              onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Full Address / Pincode</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="Address with Pincode"
                              value={form.address ?? ''}
                              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Parent & Guardian Coordinates */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                        <span className="text-[11px] font-extrabold uppercase text-slate-500 block mb-2">
                          👨‍👩‍👦 Guardian & Family Information
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Father / Guardian Name</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. Ramesh Kumar"
                              value={form.fatherName ?? ''}
                              onChange={e => setForm(f => ({ ...f, fatherName: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Father / Guardian Phone</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. 9876543210"
                              value={form.fatherPhone ?? ''}
                              onChange={e => setForm(f => ({ ...f, fatherPhone: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Father / Guardian Occupation</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. Business / Govt Service / Private"
                              value={form.fatherOccupation ?? ''}
                              onChange={e => setForm(f => ({ ...f, fatherOccupation: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Mother Name</label>
                            <input
                              type="text"
                              className="input text-xs"
                              placeholder="e.g. Sunita Devi"
                              value={form.motherName ?? ''}
                              onChange={e => setForm(f => ({ ...f, motherName: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. Milestones & Fees Tab */}
                  {editTab === 'milestones' && (
                    <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 space-y-3 pt-2">
                      <span className="text-[11px] font-extrabold uppercase text-slate-500 block">
                        💼 Pipeline Milestones & Financials
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Campus Visit Scheduled Date</label>
                          <input
                            type="datetime-local"
                            className="input text-xs"
                            value={form.campusVisitDate ?? ''}
                            onChange={e => setForm(f => ({ ...f, campusVisitDate: e.target.value, siteVisitDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Token Advance Paid (₹)</label>
                          <input
                            type="number"
                            min="0"
                            className="input text-xs"
                            placeholder="e.g. 50000"
                            value={form.tokenAdvancePaid ?? ''}
                            onChange={e => setForm(f => ({ ...f, tokenAdvancePaid: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Confirmed Admission Deal Value (₹)</label>
                          <input
                            type="number"
                            min="0"
                            className="input text-xs font-bold text-emerald-700"
                            placeholder="e.g. 1200000"
                            value={form.admissionFinalFee ?? form.closedDealAmount ?? ''}
                            onChange={e => setForm(f => ({ ...f, admissionFinalFee: e.target.value, closedDealAmount: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* View Section 1: Academic Scores */}
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-700 flex items-center gap-1.5 mb-2.5">
                      <GraduationCap size={14} /> Academic Qualifications
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {/* 10th Card */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">10th Standard</span>
                        {lead.tenthPercentage || lead.academicScore10th ? (
                          <>
                            <p className="text-sm font-extrabold text-slate-800 m-0">
                              {lead.tenthPercentage ?? lead.academicScore10th}%
                            </p>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {lead.tenthBoard || 'Board not specified'} {lead.tenthYear ? `(${lead.tenthYear})` : ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Not recorded</span>
                        )}
                      </div>

                      {/* 12th Card */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">12th Standard</span>
                        {lead.twelfthPercentage || lead.academicScore12th ? (
                          <>
                            <p className="text-sm font-extrabold text-slate-800 m-0">
                              {lead.twelfthPercentage ?? lead.academicScore12th}%
                            </p>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {lead.twelfthStream || lead.stream || 'Stream N/A'} {lead.twelfthBoard ? `• ${lead.twelfthBoard}` : ''}
                            </span>
                            {lead.twelfthGroupPercentage && (
                              <span className="text-[10px] font-semibold text-indigo-600 block mt-0.5">
                                Group PCM/PCB: {lead.twelfthGroupPercentage}%
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Not recorded</span>
                        )}
                      </div>

                      {/* Graduation Card */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Undergraduate / Degree</span>
                        {lead.gradPercentage || lead.academicScoreGrad || lead.gradDegree ? (
                          <>
                            <p className="text-sm font-extrabold text-slate-800 m-0">
                              {lead.gradDegree || 'Degree'} {lead.gradPercentage || lead.academicScoreGrad ? `(${lead.gradPercentage || lead.academicScoreGrad}%)` : ''}
                            </p>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {lead.gradCollege || 'University N/A'} {lead.gradYear ? `• ${lead.gradYear}` : ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Not applicable / N/A</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* View Section 2: Entrance Exams */}
                  {(lead.entranceExam || lead.entranceRank || lead.entranceScore) && (
                    <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700 flex items-center gap-1.5 mb-2.5">
                        📝 Entrance Examination
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        {lead.entranceExam && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Exam</span>
                            <span className="font-bold text-slate-800 text-xs">{lead.entranceExam}</span>
                          </div>
                        )}
                        {lead.entranceRank && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">AIR / Rank</span>
                            <span className="font-extrabold text-amber-600 text-xs">#{lead.entranceRank}</span>
                          </div>
                        )}
                        {lead.entranceScore && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Score / Marks</span>
                            <span className="font-bold text-slate-800 text-xs">{lead.entranceScore}</span>
                          </div>
                        )}
                        {lead.entrancePercentile && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Percentile</span>
                            <span className="font-bold text-indigo-700 text-xs">{lead.entrancePercentile}%ile</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* View Section 3: Target Preferences */}
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-700 flex items-center gap-1.5 mb-2.5">
                      🏛️ Admission Preferences
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {lead.targetCourse && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Course</span>
                          <span className="font-bold text-indigo-700 text-xs">🎓 {lead.targetCourse}</span>
                        </div>
                      )}
                      {(lead.targetStream || lead.targetDomain) && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Domain / Stream</span>
                          <span className="font-semibold text-slate-800 text-xs">{lead.targetStream || lead.targetDomain}</span>
                        </div>
                      )}
                      {lead.degreeLevel && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Degree Level</span>
                          <span className="font-semibold text-slate-800 text-xs">{lead.degreeLevel}</span>
                        </div>
                      )}
                      {lead.preferredSpecialization && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Specialization</span>
                          <span className="font-semibold text-slate-800 text-xs">{lead.preferredSpecialization}</span>
                        </div>
                      )}
                      {lead.preferredColleges && (
                        <div className="col-span-1 sm:col-span-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Preferred Colleges</span>
                          <span className="font-semibold text-slate-800 text-xs">🏛️ {lead.preferredColleges}</span>
                        </div>
                      )}
                      {lead.targetState && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Preferred Location</span>
                          <span className="font-semibold text-slate-800 text-xs">📍 {lead.targetState}</span>
                        </div>
                      )}
                      {/* Quota Preference ONLY displayed if explicitly provided! */}
                      {lead.quotaPreference && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Quota Preference</span>
                          <span className="font-semibold text-slate-800 text-xs">🏛️ {lead.quotaPreference}</span>
                        </div>
                      )}
                      {(lead.budget || lead.packageBudget) && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Package Budget</span>
                          <span className="font-extrabold text-emerald-700 text-xs">💰 {lead.budget || lead.packageBudget}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* View Section 4: Personal & Family Dossier */}
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-700 flex items-center gap-1.5 mb-2.5">
                      👤 Personal & Family Dossier
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone</span>
                        <span className="font-semibold text-slate-800 text-xs">📞 {lead.phone}</span>
                        {lead.alternatePhone && (
                          <span className="text-[11px] text-emerald-600 block mt-0.5">WA: {lead.alternatePhone}</span>
                        )}
                      </div>
                      {lead.email && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Email</span>
                          <span className="font-semibold text-slate-800 text-xs truncate block">{lead.email}</span>
                        </div>
                      )}
                      {(lead.dob || lead.gender || lead.category) && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Identity / Category</span>
                          <span className="font-semibold text-slate-800 text-xs">
                            {[lead.gender, lead.category].filter(Boolean).join(' • ')}
                            {lead.dob ? ` (DOB: ${new Date(lead.dob).toLocaleDateString()})` : ''}
                          </span>
                        </div>
                      )}
                      {(lead.city || lead.state || lead.location) && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Location</span>
                          <span className="font-semibold text-slate-800 text-xs">
                            📍 {[lead.city, lead.state, lead.location].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                          </span>
                        </div>
                      )}
                      {lead.fatherName && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Father / Guardian</span>
                          <span className="font-semibold text-slate-800 text-xs">
                            👨 {lead.fatherName} {lead.fatherPhone ? `(${lead.fatherPhone})` : ''}
                          </span>
                          {lead.fatherOccupation && (
                            <span className="text-[11px] text-slate-500 block">{lead.fatherOccupation}</span>
                          )}
                        </div>
                      )}
                      {lead.motherName && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Mother</span>
                          <span className="font-semibold text-slate-800 text-xs">👩 {lead.motherName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* View Section 5: Milestones & Commercials */}
                  {(lead.campusVisitDate || lead.siteVisitDate || lead.tokenAdvancePaid > 0 || lead.closedDealAmount > 0 || lead.admissionFinalFee > 0) && (
                    <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-700 flex items-center gap-1.5 mb-2.5">
                        💼 Pipeline Milestones & Commercials
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {(lead.campusVisitDate || lead.siteVisitDate) && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">🏛️ Campus Visit</span>
                            <span className="font-bold text-indigo-700 text-xs">
                              {formatDisplayDateTime(lead.campusVisitDate || lead.siteVisitDate)}
                            </span>
                          </div>
                        )}
                        {lead.tokenAdvancePaid > 0 && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">💳 Token Advance Paid</span>
                            <span className="font-extrabold text-amber-700 text-xs">
                              ₹{Number(lead.tokenAdvancePaid).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                        {(lead.closedDealAmount > 0 || lead.admissionFinalFee > 0) && (
                          <div className="bg-white p-2.5 rounded-lg border border-emerald-300 bg-emerald-50/30">
                            <span className="text-[10px] uppercase font-bold text-emerald-600 block">🏆 Confirmed Package Value</span>
                            <span className="font-extrabold text-emerald-800 text-sm">
                              ₹{Number(lead.closedDealAmount || lead.admissionFinalFee).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Ad Attribution Details (if available) */}
                  {lead.leadSource?.provider && (
                    <div style={{ marginTop: 10, padding: 12, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🎯 Digital Inbound Attribution
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: 12 }}>
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Provider</span>
                          <strong>{lead.leadSource.provider.toUpperCase()}</strong>
                        </div>
                        {lead.leadSource.campaignName && (
                          <div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Campaign</span>
                            <span className="truncate block">{lead.leadSource.campaignName}</span>
                          </div>
                        )}
                        {lead.leadSource.adName && (
                          <div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Ad Creative</span>
                            <span className="truncate block">{lead.leadSource.adName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dropped / Lost Reason (if lost) */}
                  {isLostStage(lead.status) && lead.lostReason && (
                    <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase' }}>
                        ⚠️ Dropped Reason:
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {lead.lostReason}
                      </p>
                      {lead.lostReasonDetail && (
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                          {lead.lostReasonDetail}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Real Estate Panel (if detected) */}
            {isRealEstate && lead && (
              <div className={mobileTab === 'details' ? 'block' : 'hidden lg:block'}>
                <RealEstateLeadPanel lead={lead} onLeadUpdate={setLead} />
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Unified Communication & Interaction Hub */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Desktop Interaction Tab Controller */}
            <div className="hidden lg:block mb-3">
              <div className="segmented-control bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveRightTab('chat')}
                  className={`segmented-btn flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeRightTab === 'chat'
                      ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 border border-transparent'
                  }`}
                >
                  💬 WhatsApp Live
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('notes')}
                  className={`segmented-btn flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeRightTab === 'notes'
                      ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 border border-transparent'
                  }`}
                >
                  📝 Notes ({lead.notes?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('memos')}
                  className={`segmented-btn flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeRightTab === 'memos'
                      ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 border border-transparent'
                  }`}
                >
                  🎙️ Audio Memos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('audit')}
                  className={`segmented-btn flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeRightTab === 'audit'
                      ? 'active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200/60 dark:border-slate-700 font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 border border-transparent'
                  }`}
                >
                  ⏱️ Activity Audit
                </button>
              </div>
            </div>

            {/* 1. WhatsApp Live Conversation */}
            <div className={`${mobileTab === 'chat' || (activeRightTab === 'chat' && mobileTab === 'details') ? 'block' : 'hidden lg:hidden'} ${activeRightTab === 'chat' ? 'lg:block' : ''}`}>
              <WhatsAppChatSection
                lead={lead}
                waStatus={waStatus}
                onOpenTemplates={() => setShowTemplates(true)}
                onOpenShareFee={() => setShowShareFeeModal(true)}
                refreshKey={chatRefreshKey}
              />
            </div>

            {/* 2. Counseling Notes */}
            <div className={`card ${mobileTab === 'notes' || (activeRightTab === 'notes' && mobileTab === 'details') ? 'block' : 'hidden lg:hidden'} ${activeRightTab === 'notes' ? 'lg:block' : ''}`}>
              <p className="section-title" style={{ margin: '0 0 12px' }}>📝 Client & Negotiation Notes</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <textarea
                  className="input"
                  placeholder="Record admissions counseling discussion, fee negotiations, preferences..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={2}
                  style={{ flex: 1, minHeight: 56 }}
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={addingNote || !noteText.trim()}
                  style={{ width: 44, background: 'var(--accent)', border: 'none', borderRadius: 12, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  {addingNote ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Plus size={18} />}
                </button>
              </div>

              {lead.notes?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {[...lead.notes].reverse().map((n, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 10, borderLeft: '3px solid var(--accent)', width: '100%', boxSizing: 'border-box' }}>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>{n.text}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                        {n.authorName || 'Counselor'} • {format(new Date(n.createdAt), 'dd MMM, h:mm a')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', margin: 0 }}>No counseling notes added yet</p>
              )}
            </div>

            {/* 3. Audio Memos */}
            <div className={`card ${mobileTab === 'memos' || (activeRightTab === 'memos' && mobileTab === 'details') ? 'block' : 'hidden lg:hidden'} ${activeRightTab === 'memos' ? 'lg:block' : ''}`}>
              <RecordingSection leadId={id} />
            </div>

            {/* 4. Activity Audit Trail */}
            <div className={`card ${mobileTab === 'audit' || (activeRightTab === 'audit' && mobileTab === 'details') ? 'block' : 'hidden lg:hidden'} ${activeRightTab === 'audit' ? 'lg:block' : ''}`}>
              <p className="section-title" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={16} color="var(--accent)" /> Client Activity Audit Trail
              </p>
              {lead.leadActivities && lead.leadActivities.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                  {lead.leadActivities.slice().reverse().map((act, i) => (
                    <div key={act._id || i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', minWidth: 0 }}>
                      <div style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>{ACTION_ICONS[act.action] || '📌'}</div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap', gap: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{act.performerName || 'Counselor'}</span>
                          <span>{format(new Date(act.timestamp), 'dd MMM, h:mm a')}</span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{act.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', margin: 0 }}>No activity logged yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS SAFELY NESTED INSIDE ROOT APP-SHELL ── */}
      {showShareFeeModal && (
        <ShareCollegeFeeModal
          isOpen={showShareFeeModal}
          lead={lead}
          waStatus={waStatus}
          onClose={() => setShowShareFeeModal(false)}
          onSent={() => setChatRefreshKey(k => k + 1)}
        />
      )}

      {showTemplates && (
        <TemplatePickerModal
          lead={lead}
          waStatus={waStatus}
          onClose={() => setShowTemplates(false)}
          onSent={() => setChatRefreshKey(k => k + 1)}
        />
      )}

      {showCloseModal && (
        <CloseDealModal
          isOpen={showCloseModal}
          initialAmount={lead.closedDealAmount || form.closedDealAmount || ''}
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleConfirmCloseDeal}
        />
      )}

      {showLostModal && (
        <LostReasonModal
          isOpen={showLostModal}
          currentStage={pendingLostStage || lead.status}
          onClose={() => setShowLostModal(false)}
          onConfirm={handleConfirmLostReason}
        />
      )}

      {showSchedulerModal && (
        <FollowUpSchedulerModal
          lead={lead}
          isOpen={showSchedulerModal}
          onClose={() => setShowSchedulerModal(false)}
          onSuccess={(updatedLead) => {
            setLead(updatedLead);
            setForm(updatedLead);
          }}
        />
      )}

      {showCompleteFollowUpModal && (
        <FollowUpCompleteModal
          lead={lead}
          isOpen={showCompleteFollowUpModal}
          onClose={() => setShowCompleteFollowUpModal(false)}
          onSuccess={(updatedLead) => {
            setLead(updatedLead);
            setForm(updatedLead);
          }}
        />
      )}
    </div>
  );
}
