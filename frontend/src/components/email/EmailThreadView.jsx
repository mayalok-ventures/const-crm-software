'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  ArrowLeft, Star, Trash2, Archive, Reply, ReplyAll, Forward,
  Paperclip, User, RefreshCw, Send, Sparkles, ExternalLink, Mail,
  ChevronDown, ChevronUp, CheckCheck
} from 'lucide-react';

/**
 * Client-side HTML sanitizer to protect against XSS injection
 */
function sanitizeHtml(html) {
  if (!html) return '';
  // Basic robust sanitization: remove script tags, onload/onerror/onclick attributes, javascript: hrefs
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/on\w+=\S+/gi, '')
    .replace(/href\s*=\s*["']?javascript:[^"'>]*/gi, 'href="#"');
}

export default function EmailThreadView({
  selectedMessage,
  onBack,
  onMessageUpdated,
  onOpenReply,
  accounts = [],
}) {
  const [threadMessages, setThreadMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [collapsedMap, setCollapsedMap] = useState({});

  const fetchThread = async () => {
    if (!selectedMessage?.threadId) return;
    try {
      setLoading(true);
      const res = await api.get(`/email/threads/${selectedMessage.threadId}`);
      const msgs = res.data.messages || [];
      setThreadMessages(msgs);

      // Auto-collapse older messages except the last one
      const map = {};
      msgs.forEach((m, idx) => {
        map[m._id] = idx !== msgs.length - 1; // expand latest
      });
      setCollapsedMap(map);

      // Auto mark read if unread
      if (!selectedMessage.isRead) {
        await api.patch(`/email/messages/${selectedMessage._id}/read`, { isRead: true });
        if (onMessageUpdated) onMessageUpdated();
      }
    } catch (err) {
      toast.error('Failed to load full thread messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [selectedMessage?.threadId]);

  const toggleStar = async () => {
    try {
      const next = !selectedMessage.isStarred;
      await api.patch(`/email/messages/${selectedMessage._id}/star`, { isStarred: next });
      toast.success(next ? 'Starred ★' : 'Unstarred');
      if (onMessageUpdated) onMessageUpdated();
    } catch (err) {
      toast.error('Failed to update star');
    }
  };

  const handleMoveFolder = async (folder) => {
    try {
      await api.patch(`/email/messages/${selectedMessage._id}/folder`, { folder });
      toast.success(`Moved to ${folder}`);
      if (onMessageUpdated) onMessageUpdated();
      if (onBack) onBack();
    } catch (err) {
      toast.error('Failed to move message');
    }
  };

  const handleSendQuickReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || sendingReply) return;

    try {
      setSendingReply(true);
      const lastMsg = threadMessages[threadMessages.length - 1] || selectedMessage;
      const recipient = lastMsg.from?.email || selectedMessage.from?.email;

      await api.post('/email/send', {
        accountId: selectedMessage.accountId?._id || selectedMessage.accountId,
        to: [recipient],
        subject: selectedMessage.subject.startsWith('Re:')
          ? selectedMessage.subject
          : `Re: ${selectedMessage.subject}`,
        bodyHtml: replyText,
        inReplyTo: lastMsg.messageId,
        threadId: selectedMessage.threadId,
        leadId: selectedMessage.leadId?._id || selectedMessage.leadId || null,
      });

      toast.success('Reply sent! 🚀');
      setReplyText('');
      fetchThread();
      if (onMessageUpdated) onMessageUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  if (!selectedMessage) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mb-3">
          <Mail size={32} />
        </div>
        <h4 className="text-sm font-bold text-slate-700 mb-1">Select an email to read</h4>
        <p className="text-xs text-slate-400 max-w-xs">
          Choose a conversation from the list to view the full message thread, download attachments, or reply.
        </p>
      </div>
    );
  }

  const linkedLead = selectedMessage.leadId;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Top Header & Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 md:hidden transition shrink-0"
                title="Back to list"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-sm md:text-base font-bold text-slate-900 truncate m-0">
              {selectedMessage.subject || '(No Subject)'}
            </h2>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleStar}
              className={`p-2 rounded-lg transition ${
                selectedMessage.isStarred
                  ? 'text-amber-500 hover:bg-amber-50'
                  : 'text-slate-400 hover:bg-slate-100'
              }`}
              title={selectedMessage.isStarred ? 'Unstar' : 'Star'}
            >
              <Star size={16} fill={selectedMessage.isStarred ? 'currentColor' : 'none'} />
            </button>

            <button
              onClick={() => handleMoveFolder('archive')}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="Archive"
            >
              <Archive size={16} />
            </button>

            <button
              onClick={() => handleMoveFolder('trash')}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>

            <button
              onClick={() => {
                if (onOpenReply) {
                  onOpenReply({
                    to: selectedMessage.from?.email,
                    subject: selectedMessage.subject.startsWith('Re:')
                      ? selectedMessage.subject
                      : `Re: ${selectedMessage.subject}`,
                    inReplyTo: selectedMessage.messageId,
                    threadId: selectedMessage.threadId,
                    leadId: selectedMessage.leadId?._id || selectedMessage.leadId,
                    accountId: selectedMessage.accountId?._id || selectedMessage.accountId,
                  });
                }
              }}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
            >
              <Reply size={14} /> Reply
            </button>
          </div>
        </div>

        {/* CRM Lead Association Banner */}
        {linkedLead && (
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                🎓
              </span>
              <div>
                <span className="font-bold text-indigo-950">
                  {linkedLead.name || 'Candidate Lead'}
                </span>
                {linkedLead.targetCourse && (
                  <span className="text-indigo-700 font-medium ml-1.5">
                    • {linkedLead.targetCourse}
                  </span>
                )}
                {linkedLead.phone && (
                  <span className="text-slate-500 ml-1.5">
                    (+{linkedLead.phone})
                  </span>
                )}
              </div>
            </div>

            <Link
              href={`/leads/${linkedLead._id || linkedLead}`}
              prefetch={false}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-800 transition underline"
            >
              <span>View CRM Profile</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        )}
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            <span className="text-xs">Loading conversation history...</span>
          </div>
        ) : (
          threadMessages.map((msg, index) => {
            const isCollapsed = collapsedMap[msg._id];
            const senderInitial = (msg.from?.name || msg.from?.email || '?').charAt(0).toUpperCase();

            return (
              <div
                key={msg._id}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm transition hover:border-slate-300"
              >
                {/* Message Header */}
                <div
                  onClick={() => setCollapsedMap(prev => ({ ...prev, [msg._id]: !prev[msg._id] }))}
                  className="p-4 flex items-center justify-between cursor-pointer bg-slate-50/40 hover:bg-slate-50 transition select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                      {senderInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {msg.from?.name || msg.from?.email}
                        </span>
                        {msg.folder === 'sent' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            Sent
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate m-0">
                        To: {msg.to?.map(t => t.name || t.email).join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
                    <span>
                      {format(new Date(msg.date || msg.createdAt), 'dd MMM yyyy, h:mm a')}
                    </span>
                    {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </div>
                </div>

                {/* Collapsible Content */}
                {!isCollapsed && (
                  <div className="p-5 border-t border-slate-100 space-y-4">
                    {/* Rendered HTML Body */}
                    <div
                      className="text-xs text-slate-800 leading-relaxed font-normal overflow-x-auto select-text prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(msg.bodyHtml || msg.bodyText?.replace(/\n/g, '<br/>')),
                      }}
                    />

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Attachments ({msg.attachments.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {msg.attachments.map((att, attIdx) => (
                            <a
                              key={attIdx}
                              href={att.url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs text-slate-700 transition"
                            >
                              <Paperclip size={13} className="text-slate-500" />
                              <span className="font-medium truncate max-w-[200px]">
                                {att.filename}
                              </span>
                              {att.size > 0 && (
                                <span className="text-[10px] text-slate-400">
                                  ({Math.round(att.size / 1024)} KB)
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Inline Quick Reply Box */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 shrink-0">
        <form onSubmit={handleSendQuickReply} className="space-y-2">
          <div className="relative">
            <textarea
              rows={3}
              placeholder="Type your quick reply here..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              className="w-full p-3 pr-24 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={sendingReply || !replyText.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingReply ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>Reply</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
