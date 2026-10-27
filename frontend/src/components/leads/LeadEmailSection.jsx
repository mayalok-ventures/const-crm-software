'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Mail, Send, RefreshCw, Paperclip, ChevronRight, Plus,
  CheckCheck, AlertCircle, ExternalLink, Star
} from 'lucide-react';
import EmailComposerModal from '@/components/email/EmailComposerModal';

export default function LeadEmailSection({ lead, onEmailSent, refreshKey }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [composerInitialData, setComposerInitialData] = useState({});

  const fetchEmails = async (silent = false) => {
    if (!lead?._id) return;
    try {
      if (!silent) setLoading(true);
      const [emailRes, accRes] = await Promise.all([
        api.get(`/email/lead/${lead._id}`),
        api.get('/email/accounts'),
      ]);
      setEmails(emailRes.data.emails || []);
      setAccounts(accRes.data.accounts || []);
    } catch {
      // Handled silently
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [lead?._id, refreshKey]);

  const handleOpenCompose = () => {
    if (!lead.email) {
      return toast.error('This candidate does not have an email address recorded. Please add one first.');
    }
    setComposerInitialData({
      to: lead.email,
      leadId: lead._id,
      subject: `Admissions Query - ${lead.targetCourse || 'Course Information'}`,
    });
    setShowComposer(true);
  };

  const handleReplyEmail = (em) => {
    setComposerInitialData({
      to: em.from?.email === lead.email ? em.from?.email : em.to?.[0]?.email || lead.email,
      leadId: lead._id,
      accountId: em.accountId?._id || em.accountId,
      subject: em.subject?.startsWith('Re:') ? em.subject : `Re: ${em.subject || ''}`,
      inReplyTo: em.messageId,
      threadId: em.threadId,
    });
    setShowComposer(true);
  };

  return (
    <div className="card" style={{ marginBottom: 16, padding: '16px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={16} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>Email Correspondence</h3>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
              {lead.email ? lead.email : 'No email address specified'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => fetchEmails()}
            title="Refresh emails"
            className="btn btn-ghost btn-sm"
            style={{ padding: 6, minHeight: 'auto', borderRadius: 8 }}
          >
            <RefreshCw size={13} />
          </button>

          <button
            type="button"
            onClick={handleOpenCompose}
            className="btn btn-primary btn-sm"
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={13} /> Compose
          </button>
        </div>
      </div>

      {/* Email List Stream */}
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
            <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 6px' }} />
            <span>Loading emails...</span>
          </div>
        ) : emails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)' }}>
            <Mail size={22} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>No emails recorded yet</p>
            <p style={{ margin: '2px 0 10px', fontSize: 11 }}>
              Send admission details, fee quotes, or university brochures directly to this student.
            </p>
            <button
              type="button"
              onClick={handleOpenCompose}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8 }}
            >
              Send First Email
            </button>
          </div>
        ) : (
          emails.map(em => {
            const isOutbound = em.folder === 'sent' || em.status === 'sent';
            return (
              <div
                key={em._id}
                onClick={() => handleReplyEmail(em)}
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  transition: 'border 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 800,
                        background: isOutbound ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)',
                        color: isOutbound ? 'var(--accent)' : '#10b981',
                      }}
                    >
                      {isOutbound ? 'SENT' : 'RECEIVED'}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {em.from?.name || em.from?.email}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 10 }}>
                    {em.hasAttachments && <Paperclip size={11} />}
                    <span>{format(new Date(em.date || em.createdAt), 'dd MMM, h:mm a')}</span>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  {em.subject || '(No Subject)'}
                </p>

                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {em.snippet || 'No preview available'}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <EmailComposerModal
          isOpen={showComposer}
          onClose={() => setShowComposer(false)}
          initialData={composerInitialData}
          accounts={accounts}
          onSent={() => {
            fetchEmails(true);
            if (onEmailSent) onEmailSent();
          }}
        />
      )}
    </div>
  );
}
