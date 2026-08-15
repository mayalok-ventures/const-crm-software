'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, mergeTemplate } from '@/lib/auth';
import {
  ArrowLeft, MessageCircle, Phone, Edit2, Trash2, Mic, MicOff,
  Play, Pause, Send, Plus, X, Check, Calendar, AlertTriangle, ExternalLink,
  Image as ImageIcon, Video as VideoIcon, File as FileIcon, CheckCheck, RefreshCw,
  Paperclip, Copy, Package, UserCheck, ShieldCheck, History, Activity, Sparkles, Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import { getIndustryDefaults } from '@/lib/industryTemplates';
import LostReasonModal, { isLostStage, LOST_REASON_OPTIONS } from '@/components/LostReasonModal';

const STATUS_OPTIONS = [
  'new',
  'cold',
  'warm',
  'hot',
  'contacted',
  'site_visit_scheduled',
  'negotiation',
  'payment_done',
  'closed',
  'lost'
];

const STAGE_LABELS = {
  new: '🆕 New Lead',
  cold: '❄️ Cold',
  warm: '🌤️ Warm',
  hot: '🔥 Hot Lead',
  contacted: '📞 Contacted',
  site_visit_scheduled: '📅 Meeting / Demo Scheduled',
  negotiation: '🤝 In Negotiation',
  payment_done: '💳 Payment Done',
  closed: '🏆 Closed / Won',
  lost: '❌ Lost / Dropped'
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
    api.get(`/recordings/${leadId}`).then(r => setRecordings(r.data)).catch(() => {});
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
  const BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

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
function WhatsAppChatSection({ lead, waStatus, onOpenTemplates, refreshKey }) {
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [senderMode, setSenderMode] = useState('personal'); // 'company' | 'personal'
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatScrollRef = useRef(null);

  const canUseCompanyWA = Boolean(waStatus?.allowCompanyWhatsApp && waStatus?.company?.status === 'connected');
  const isPersonalConnected = waStatus?.personal?.status === 'connected';
  const isAnyConnected = isPersonalConnected || canUseCompanyWA;

  useEffect(() => {
    if (canUseCompanyWA && !isPersonalConnected) {
      setSenderMode('company');
    } else if (waStatus?.defaultSender) {
      setSenderMode(waStatus.defaultSender);
    }
  }, [waStatus]);

  const fetchHistory = async (silent = false) => {
    if (!lead?.phone) return;
    try {
      const { data } = await api.get(`/whatsapp/chats/${lead.phone}?leadId=${lead._id || ''}`);
      setMessages(data);
      if (!silent) setLoading(false);
    } catch {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(() => {
      fetchHistory(true);
    }, 3500);
    return () => clearInterval(interval);
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

  const BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

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

        <button
          onClick={() => fetchHistory()}
          title="Refresh messages"
          className="btn btn-ghost btn-sm"
          style={{ padding: 6, minHeight: 'auto', borderRadius: 8 }}
        >
          <RefreshCw size={13} />
        </button>
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
            <p style={{ margin: 0, fontSize: 11 }}>Send a proposal template or type a message below.</p>
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

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onOpenTemplates}
          title="Use saved template"
          className="btn btn-secondary btn-sm"
          style={{ padding: '8px 12px', height: 42, flexShrink: 0, gap: 5, borderRadius: 10 }}
        >
          <Paperclip size={14} />
          <span style={{ fontSize: 12 }}>Templates</span>
        </button>

        <input
          type="text"
          placeholder={`Type message (${senderMode === 'company' ? 'Org WA' : 'Personal WA'})...`}
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
      </form>
    </div>
  );
}

function TemplatePickerModal({ lead, waStatus, onClose, onSent }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    api.get('/templates').then(r => setTemplates(r.data)).finally(() => setLoading(false));
  }, []);

  const sendTemplate = async (template) => {
    const text = mergeTemplate(template.text, lead);
    const sender = (waStatus?.allowCompanyWhatsApp && waStatus?.company?.status === 'connected') ? 'company' : 'personal';

    setSendingId(template._id);
    try {
      await api.post('/whatsapp/send-media', {
        to: lead.phone,
        text,
        image: template.imageFile?.url,
        video: template.videoFile?.url,
        document: template.docFile?.url,
        sender,
      });
      api.post(`/templates/${template._id}/use`).catch(() => {});
      toast.success('Dispatched message directly to client! 🚀');
      if (onSent) onSent(template);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Choose Message Template</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><div className="spinner" /></div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            <p>No templates created yet.</p>
            <Link href="/templates" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }} onClick={onClose}>Create templates →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50dvh', overflowY: 'auto' }}>
            {templates.map(t => (
              <button
                key={t._id}
                disabled={sendingId !== null}
                onClick={() => sendTemplate(t)}
                style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {sendingId === t._id && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner" style={{ width: 20, height: 20 }} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.title}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.imageFile && <span style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(79,70,229,0.15)', borderRadius: 3, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 1 }}><ImageIcon size={8} /> Image</span>}
                    {t.videoFile && <span style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(234,179,8,0.15)', borderRadius: 3, color: '#d97706', display: 'flex', alignItems: 'center', gap: 1 }}><VideoIcon size={8} /> Video</span>}
                    {t.docFile && <span style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(34,197,94,0.15)', borderRadius: 3, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 1 }}><FileIcon size={8} /> Doc</span>}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {mergeTemplate(t.text, lead)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CloseDealModal({ isOpen, onClose, onConfirm, initialAmount }) {
  const [amount, setAmount] = useState(initialAmount || '');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || isNaN(num) || num <= 0) {
      toast.error('Please enter a valid deal amount greater than 0');
      return;
    }
    onConfirm(num);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              🏆
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Close Deal / Mark Won</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Enter the final closed transaction amount</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label" style={{ fontWeight: 700 }}>
              Final Deal Amount (₹) <span style={{ color: 'var(--red)' }}>*Required</span>
            </label>
            <input
              type="number"
              min="1"
              step="any"
              autoFocus
              required
              placeholder="e.g. 250000"
              className="input"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ fontSize: 16, fontWeight: 700, borderColor: 'var(--green)' }}
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

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lead, setLead] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [pendingLostStage, setPendingLostStage] = useState('');
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [waStatus, setWaStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) setCurrentUser(JSON.parse(u));
    } catch {}
  }, []);

  useEffect(() => {
    if (!id || id === '[id]' || id === 'placeholder') return;

    setLoading(true);
    Promise.all([
      api.get(`/leads/${id}`),
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
  }, [id]);

  const industryDefaults = getIndustryDefaults(currentUser?.industryType);

  const availableStages = (currentUser?.pipelineStages && currentUser.pipelineStages.length > 0)
    ? currentUser.pipelineStages
    : (currentUser?.customPipelineStages && currentUser.customPipelineStages.length > 0)
      ? currentUser.customPipelineStages
      : industryDefaults.pipelineStages;

  const rawSchema = (currentUser?.leadFormSchema && Array.isArray(currentUser.leadFormSchema) && currentUser.leadFormSchema.length > 0)
    ? currentUser.leadFormSchema
    : industryDefaults.leadFormSchema;

  // Real-time Conditional Logic Evaluator (dependsOn)
  const isFieldVisible = (field) => {
    if (field.isHidden) return false;
    if (!field.dependsOn || !field.dependsOn.field) return true;
    const parentVal = form[field.dependsOn.field] || form.customData?.[field.dependsOn.field] || '';
    return String(parentVal || '').trim().toLowerCase() === String(field.dependsOn.value || '').trim().toLowerCase();
  };

  const activeFields = [...rawSchema]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter(isFieldVisible);

  const handleConfirmCloseDeal = async (amount) => {
    setShowCloseModal(false);
    setForm(f => ({ ...f, status: 'closed', closedDealAmount: amount }));
    if (!editing) {
      try {
        const { data } = await api.put(`/leads/${id}`, { status: 'closed', closedDealAmount: amount });
        setLead(data);
        setForm(data);
        toast.success(`🎉 Deal Closed & Won for ₹${amount.toLocaleString('en-IN')}!`);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to close deal');
      }
    }
  };

  const handleConfirmLostReason = async ({ lostReason, lostReasonDetail, targetStage }) => {
    setShowLostModal(false);
    setForm(f => ({ ...f, status: targetStage, lostReason, lostReasonDetail }));
    if (!editing) {
      try {
        const { data } = await api.put(`/leads/${id}`, {
          status: targetStage,
          lostReason,
          lostReasonDetail,
        });
        setLead(data);
        setForm(data);
        toast.success(`Prospect moved to ${targetStage} (Lost)`);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to update stage');
      }
    }
  };

  const handleStatusSelectChange = (newStatus) => {
    if (newStatus === 'closed' || newStatus === 'Closed Won' || newStatus === 'Won') {
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
        toast.success(`Stage updated to ${newStatus}`);
      }).catch(err => {
        toast.error(err.response?.data?.message || 'Failed to update stage');
      });
    }
  };

  const saveLead = async () => {
    if (form.status === 'closed') {
      const amt = Number(form.closedDealAmount);
      if (!amt || isNaN(amt) || amt <= 0) {
        toast.error('Deal amount is required to close a lead.');
        setShowCloseModal(true);
        return;
      }
    }

    const isLost = isLostStage(form.status);
    if (isLost && !form.lostReason) {
      setPendingLostStage(form.status);
      setShowLostModal(true);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        closedDealAmount: form.closedDealAmount ? Number(form.closedDealAmount) : null,
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
        areasOfInterest: typeof form.areasOfInterest === 'string' ? form.areasOfInterest.split(',').map(t => t.trim()).filter(Boolean) : form.areasOfInterest,
        lostReason: isLost ? form.lostReason : '',
        lostReasonDetail: isLost ? form.lostReasonDetail : '',
      };
      const { data } = await api.put(`/leads/${id}`, payload);
      setLead(data);
      setForm(data);
      setEditing(false);
      toast.success('Lead updated ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async () => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api.delete(`/leads/${id}`);
      toast.success('Lead deleted successfully');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete lead');
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const { data } = await api.post(`/leads/${id}/notes`, { text: noteText });
      setLead(data);
      setNoteText('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="spinner" />
    </div>
  );

  if (!lead) return null;

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4, display: 'flex', borderRadius: 8 }}>
              <ArrowLeft size={22} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</h1>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>+{lead.phone}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                  <Edit2 size={14} /> Edit
                </button>
                <button onClick={deleteLead} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={15} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditing(false); setForm(lead); }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', fontSize: 13 }}>
                  <X size={15} /> Cancel
                </button>
                <button onClick={saveLead} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                  {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><Check size={14} /> Save</>}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="page-content">
          {/* Quick Action Top Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <a href={`tel:${lead.phone}`} className="btn btn-secondary" style={{ flex: 1, gap: 8, justifyContent: 'center', minWidth: 140 }}>
              <Phone size={16} /> Call Client
            </a>
            
            <button 
              onClick={() => setShowTemplates(true)} 
              className="btn btn-primary" 
              style={{ flex: 1.5, gap: 8, justifyContent: 'center', minWidth: 180 }}
            >
              <MessageCircle size={16} /> Send Proposal / Template
            </button>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              DESKTOP SPLIT-SCREEN LAYOUT:
              Left Column (40%): Deal Requirements, Info, Notes, Audio Memos
              Right Column (60%): WhatsApp Live Chat, Activity Audit Trail
             ───────────────────────────────────────────────────────────── */}
          <div className="details-split-grid">
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Deal & Lead Info Card */}
              <div className="card">
                <p className="section-title" style={{ margin: '0 0 12px' }}>📋 Deal Requirements & Client Info</p>
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {activeFields.map((field) => {
                      const isMandatory = ['name', 'phone', 'followUpDate'].includes(field.fieldId) || field.isRequired;
                      const isSystem = Boolean(field.isSystem);
                      const currentVal = isSystem ? (form[field.fieldId] || '') : (form.customData?.[field.fieldId] || '');

                      if (field.fieldId === 'projectId') {
                        return (
                          <div key={field.fieldId}>
                            <label className="label">{field.label} {isMandatory && '*'}</label>
                            <select
                              className="input"
                              value={form.projectId || ''}
                              onChange={e => {
                                const p = projects.find(proj => proj._id === e.target.value);
                                setForm(f => ({ ...f, projectId: e.target.value, project: p?.name || f.project }));
                              }}
                            >
                              <option value="">-- Select Offering --</option>
                              {projects.map(p => (
                                <option key={p._id} value={p._id}>📦 {p.name} ({p.location})</option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      if (field.fieldId === 'status') {
                        return (
                          <div key={field.fieldId}>
                            <label className="label">{field.label} {isMandatory && '*'}</label>
                            <select
                              className="input"
                              value={form.status || availableStages[0] || 'new'}
                              onChange={e => handleStatusSelectChange(e.target.value)}
                            >
                              {availableStages.map(s => (
                                <option key={s} value={s}>{STAGE_LABELS[s] || s}</option>
                              ))}
                            </select>

                            {form.status === 'closed' && (
                              <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10 }}>
                                <label className="label" style={{ color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span>🏆 Final Closed Deal Amount (₹) <span style={{ color: 'var(--red)' }}>*Required</span></span>
                                  <button
                                    type="button"
                                    onClick={() => setShowCloseModal(true)}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                  >
                                    Open Prompt
                                  </button>
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  placeholder="e.g. 250000"
                                  className="input"
                                  value={form.closedDealAmount || ''}
                                  onChange={e => setForm(f => ({ ...f, closedDealAmount: e.target.value }))}
                                  style={{ borderColor: 'var(--green)', fontWeight: 700, fontSize: 14 }}
                                />
                              </div>
                            )}

                            {isLostStage(form.status) && (
                              <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase' }}>
                                    ⚠️ Lost Reason Details (Mandatory)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => { setPendingLostStage(form.status); setShowLostModal(true); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                  >
                                    Open Dialog
                                  </button>
                                </div>
                                <select
                                  className="input"
                                  value={form.lostReason || ''}
                                  onChange={e => setForm(f => ({ ...f, lostReason: e.target.value }))}
                                  style={{ height: 36, fontSize: 12 }}
                                  required
                                >
                                  <option value="">-- Select Reason --</option>
                                  {LOST_REASON_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                                <input
                                  className="input"
                                  placeholder="Lost context / competitor feedback..."
                                  value={form.lostReasonDetail || ''}
                                  onChange={e => setForm(f => ({ ...f, lostReasonDetail: e.target.value }))}
                                  style={{ height: 36, fontSize: 12 }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (field.fieldType === 'dropdown') {
                        const options = field.options || [];
                        return (
                          <div key={field.fieldId}>
                            <label className="label">{field.label} {isMandatory && '*'}</label>
                            <select
                              className="input"
                              value={currentVal}
                              onChange={e => {
                                const val = e.target.value;
                                if (isSystem) {
                                  setForm(f => ({ ...f, [field.fieldId]: val }));
                                } else {
                                  setForm(f => ({ ...f, customData: { ...(f.customData || {}), [field.fieldId]: val } }));
                                }
                              }}
                            >
                              <option value="">Select {field.label}...</option>
                              {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                        );
                      }

                      if (field.fieldType === 'date') {
                        const isDateTime = field.fieldId === 'followUpDate' || field.fieldId === 'siteVisitDate';
                        const dateFormatted = currentVal ? new Date(currentVal).toISOString().slice(0, isDateTime ? 16 : 10) : '';

                        return (
                          <div key={field.fieldId}>
                            <label className="label">{field.label} {isMandatory && '*'}</label>
                            <input
                              className="input"
                              type={isDateTime ? 'datetime-local' : 'date'}
                              value={dateFormatted}
                              onChange={e => {
                                const val = e.target.value || null;
                                if (isSystem) {
                                  setForm(f => ({ ...f, [field.fieldId]: val }));
                                } else {
                                  setForm(f => ({ ...f, customData: { ...(f.customData || {}), [field.fieldId]: val } }));
                                }
                              }}
                              required={isMandatory}
                            />
                          </div>
                        );
                      }

                      if (field.fieldType === 'number') {
                        return (
                          <div key={field.fieldId}>
                            <label className="label">{field.label} {isMandatory && '*'}</label>
                            <input
                              className="input"
                              type="number"
                              placeholder={`Enter ${field.label}...`}
                              value={currentVal}
                              onChange={e => {
                                const val = e.target.value;
                                if (isSystem) {
                                  setForm(f => ({ ...f, [field.fieldId]: val }));
                                } else {
                                  setForm(f => ({ ...f, customData: { ...(f.customData || {}), [field.fieldId]: val } }));
                                }
                              }}
                              required={isMandatory}
                            />
                          </div>
                        );
                      }

                      // Text / Phone / Email
                      const inputType = field.fieldId === 'phone' ? 'tel' : (field.fieldId === 'email' ? 'email' : 'text');
                      return (
                        <div key={field.fieldId}>
                          <label className="label">{field.label} {isMandatory && '*'}</label>
                          <input
                            className="input"
                            type={inputType}
                            placeholder={`Enter ${field.label}...`}
                            value={currentVal}
                            onChange={e => {
                              const val = e.target.value;
                              if (isSystem) {
                                setForm(f => ({ ...f, [field.fieldId]: val }));
                              } else {
                                setForm(f => ({ ...f, customData: { ...(f.customData || {}), [field.fieldId]: val } }));
                              }
                            }}
                            required={isMandatory}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                      {(lead.status === 'closed' || lead.closedDealAmount) && (
                        <div style={{ gridColumn: '1/-1', padding: '12px 14px', background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                              🏆
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 11, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Final Closed Deal Revenue</p>
                              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: '#15803d' }}>
                                ₹{Number(lead.closedDealAmount || 0).toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>
                          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#22c55e', color: 'white', fontWeight: 700 }}>
                            Verified Won Deal
                          </span>
                        </div>
                      )}

                      {[
                        ['Pipeline Stage', <span key="s" className="badge badge-closed">{STAGE_LABELS[lead.status] || lead.status}</span>],
                        ['Linked Offering', (lead.projectId?.name || lead.project) ? <Link key="p" href="/projects" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>📦 {lead.projectId?.name || lead.project}</Link> : '—'],
                        ['Tier / Category', lead.propertyType || '—'],
                        ['Deal Value / Budget', lead.budget ? <strong key="b" style={{ color: 'var(--green)' }}>{lead.budget}</strong> : '—'],
                        ['Market / Region', lead.location || '—'],
                        ['Assigned Owner', lead.assignedToName || 'Unassigned (Common Pool)'],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>{val}</p>
                        </div>
                      ))}

                      {lead.siteVisitDate && (
                        <div style={{ gridColumn: '1/-1', padding: '10px 12px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Calendar size={16} color="#f97316" />
                          <p style={{ margin: 0, fontSize: 13, color: '#f97316', fontWeight: 600 }}>
                            Meeting / Demo Scheduled: {format(new Date(lead.siteVisitDate), 'dd MMM yyyy, h:mm a')}
                          </p>
                        </div>
                      )}

                      {/* Lost Reason Card (if marked lost) */}
                      {lead.lostReason && (
                        <div style={{ gridColumn: '1/-1', padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>❌</span>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Lost Reason Analysis
                            </p>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            {lead.lostReason}
                          </p>
                          {lead.lostReasonDetail && (
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              Context: {lead.lostReasonDetail}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Marketing & Attribution Source (if present) */}
                      {(lead.source || lead.utmCampaign || lead.utmMedium || lead.utmSource) && (
                        <div style={{ gridColumn: '1/-1', padding: '10px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            🎯 Inbound Attribution & Campaign Tracking
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
                            {lead.source && <span>Source: <strong>{lead.source}</strong></span>}
                            {lead.utmCampaign && <span>Campaign: <strong>{lead.utmCampaign}</strong></span>}
                            {lead.utmMedium && <span>Medium: <strong>{lead.utmMedium}</strong></span>}
                            {lead.utmSource && <span>UTM Source: <strong>{lead.utmSource}</strong></span>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dynamic Custom Data (View Mode) */}
                    {lead.customData && Object.keys(lead.customData).length > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.5 }}>
                          ✨ Dynamic Custom Attributes
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                          {Object.entries(lead.customData).map(([key, val]) => (
                            <div key={key} style={{ background: 'var(--surface)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize', display: 'block' }}>
                                {key.replace(/_/g, ' ')}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                                {String(val || '—')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes Card */}
              <div className="card">
                <p className="section-title" style={{ margin: '0 0 12px' }}>📝 Client & Negotiation Notes</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <textarea
                    className="input"
                    placeholder="Add customer requirements, deal notes..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    rows={2}
                    style={{ flex: 1, minHeight: 56 }}
                  />
                  <button
                    onClick={addNote}
                    disabled={addingNote || !noteText.trim()}
                    style={{ width: 44, background: 'var(--accent)', border: 'none', borderRadius: 12, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    {addingNote ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Plus size={18} />}
                  </button>
                </div>

                {lead.notes?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                    {[...lead.notes].reverse().map((n, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>{n.text}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                          {n.authorName || 'Agent'} • {format(new Date(n.createdAt), 'dd MMM, h:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '6px 0', margin: 0 }}>No notes yet</p>
                )}
              </div>

              {/* Audio Memos */}
              <div className="card">
                <RecordingSection leadId={id} />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* WhatsApp Live Conversation */}
              <WhatsAppChatSection
                lead={lead}
                waStatus={waStatus}
                onOpenTemplates={() => setShowTemplates(true)}
                refreshKey={chatRefreshKey}
              />

              {/* Activity Audit Trail */}
              <div className="card">
                <p className="section-title" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={16} color="var(--accent)" /> Client Activity Audit Trail
                </p>
                {lead.leadActivities && lead.leadActivities.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                    {lead.leadActivities.slice().reverse().map((act, i) => (
                      <div key={act._id || i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 16, marginTop: 1 }}>{ACTION_ICONS[act.action] || '📌'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{act.performerName || 'Agent'}</span>
                            <span>{format(new Date(act.timestamp), 'dd MMM, h:mm a')}</span>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{act.details}</p>
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
      </div>

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
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleConfirmCloseDeal}
          initialAmount={form.closedDealAmount || lead?.closedDealAmount}
        />
      )}

      {showLostModal && (
        <LostReasonModal
          isOpen={showLostModal}
          targetStage={pendingLostStage}
          leadName={lead?.name}
          onConfirm={handleConfirmLostReason}
          onCancel={() => {
            setShowLostModal(false);
            setPendingLostStage('');
          }}
        />
      )}
    </div>
  );
}
