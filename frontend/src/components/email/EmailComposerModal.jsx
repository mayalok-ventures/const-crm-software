'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getUser } from '@/lib/auth';
import {
  X, Send, Paperclip, FileText, User, ChevronDown, Trash2,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link2,
  Sparkles, RefreshCw, Check, Code, Eye, Palette, AlignLeft,
  AlignCenter, AlignRight, Quote, Minus, Plus, BookmarkPlus,
  Smartphone, Monitor, Image as ImageIcon, MousePointerClick, ShieldCheck
} from 'lucide-react';

export default function EmailComposerModal({
  isOpen,
  onClose,
  initialData = {},
  onSent,
  accounts = [],
}) {
  const currentUser = getUser();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [linkedLeadId, setLinkedLeadId] = useState('');
  const [linkedLead, setLinkedLead] = useState(null);

  // Editor mode: 'visual' | 'code' | 'preview'
  const [editorMode, setEditorMode] = useState('visual');
  const [previewDevice, setPreviewDevice] = useState('desktop');

  // Popover / Sub-Modal States
  const [showButtonModal, setShowButtonModal] = useState(false);
  const [btnText, setBtnText] = useState('Schedule Consultation');
  const [btnUrl, setBtnUrl] = useState('https://');
  const [btnBgColor, setBtnBgColor] = useState('#4f46e5');
  const [btnTextColor, setBtnTextColor] = useState('#ffffff');
  const [btnAlign, setBtnAlign] = useState('center');

  const [showImageModal, setShowImageModal] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('Company Logo');
  const [imgWidth, setImgWidth] = useState('180px');
  const [imgAlign, setImgAlign] = useState('left');

  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('general');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showVariableMenu, setShowVariableMenu] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [leadsList, setLeadsList] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  // Color presets
  const TEXT_COLORS = [
    { label: 'Slate Dark', value: '#0f172a' },
    { label: 'Muted Slate', value: '#64748b' },
    { label: 'Royal Blue', value: '#2563eb' },
    { label: 'Emerald Green', value: '#059669' },
    { label: 'Amber Orange', value: '#d97706' },
    { label: 'Crimson Red', value: '#dc2626' },
    { label: 'Purple Indigo', value: '#7c3aed' },
  ];

  const HIGHLIGHT_COLORS = [
    { label: 'None', value: 'transparent' },
    { label: 'Soft Yellow', value: '#fef08a' },
    { label: 'Soft Green', value: '#bbf7d0' },
    { label: 'Soft Blue', value: '#bfdbfe' },
    { label: 'Soft Rose', value: '#fecdd3' },
    { label: 'Soft Purple', value: '#e9d5ff' },
    { label: 'Slate Light', value: '#f1f5f9' },
  ];

  const MERGE_VARIABLES = [
    { tag: '{{name}}', label: 'Candidate Name' },
    { tag: '{{course}}', label: 'Target Course' },
    { tag: '{{phone}}', label: 'Candidate Phone' },
    { tag: '{{email}}', label: 'Candidate Email' },
    { tag: '{{counselorName}}', label: 'Counselor Name' },
    { tag: '{{counselorPhone}}', label: 'Counselor Phone' },
  ];

  // Fetch templates for Email
  const fetchTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const res = await api.get('/templates?channel=EMAIL');
      const tList = Array.isArray(res.data) ? res.data : [];
      setTemplates(tList);
    } catch {
      // Fallback: fetch all templates
      api.get('/templates').then(res => {
        const tList = Array.isArray(res.data) ? res.data : [];
        setTemplates(tList);
      }).catch(() => {});
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Initialize data
  useEffect(() => {
    if (isOpen) {
      if (accounts && accounts.length > 0) {
        setSelectedAccountId(initialData.accountId || accounts[0]._id);
      }
      if (initialData.to) {
        setTo(Array.isArray(initialData.to) ? initialData.to.map(t => t.email || t).join(', ') : initialData.to);
      }
      if (initialData.subject) setSubject(initialData.subject);

      const initialBody = initialData.bodyHtml || '<p>Hi {{name}},</p><p>Thank you for reaching out regarding admissions.</p>';
      setBodyHtml(initialBody);

      if (initialData.leadId) {
        setLinkedLeadId(initialData.leadId);
        api.get(`/leads/${initialData.leadId}`).then(res => setLinkedLead(res.data)).catch(() => {});
      }

      fetchTemplates();

      // Fetch leads for quick autocomplete
      api.get('/leads?limit=30').then(res => {
        const lList = res.data?.leads || res.data || [];
        setLeadsList(Array.isArray(lList) ? lList : []);
      }).catch(() => {});
    }
  }, [isOpen, initialData, accounts, fetchTemplates]);

  // Sync contenteditable with bodyHtml when entering visual mode or on initial load
  useEffect(() => {
    if (editorMode === 'visual' && editorRef.current) {
      if (editorRef.current.innerHTML !== bodyHtml) {
        editorRef.current.innerHTML = bodyHtml || '';
      }
    }
  }, [editorMode, bodyHtml]);

  // Handle visual editor input
  const handleEditorInput = () => {
    if (editorRef.current) {
      setBodyHtml(editorRef.current.innerHTML);
    }
  };

  // Execute formatting command
  const execCmd = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleEditorInput();
  };

  // Insert arbitrary HTML fragment at current selection cursor
  const insertHtmlAtCursor = (htmlToInsert) => {
    if (editorMode === 'code') {
      setBodyHtml(prev => prev + '\n' + htmlToInsert);
      return;
    }

    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const el = document.createElement('div');
        el.innerHTML = htmlToInsert;
        const frag = document.createDocumentFragment();
        let node;
        let lastNode;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        handleEditorInput();
        return;
      }
    }

    // Fallback: append to innerHTML
    if (editorRef.current) {
      editorRef.current.innerHTML += htmlToInsert;
      handleEditorInput();
    } else {
      setBodyHtml(prev => prev + '\n' + htmlToInsert);
    }
  };

  // Modular Elements Inserters
  const handleInsertButton = (e) => {
    e.preventDefault();
    if (!btnText || !btnUrl) return toast.error('Button text and URL are required');
    const buttonMarkup = `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 22px 0; width: 100%;">
  <tr>
    <td align="${btnAlign}">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="border-radius: 8px; background-color: ${btnBgColor};">
            <a href="${btnUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${btnTextColor}; text-decoration: none; border-radius: 8px;">
              ${btnText}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
    insertHtmlAtCursor(buttonMarkup);
    setShowButtonModal(false);
    toast.success('CTA Button inserted! 🔘');
  };

  const handleInsertImage = (e) => {
    e.preventDefault();
    if (!imgUrl) return toast.error('Image URL is required');
    const imgMarkup = `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 16px 0; width: 100%;">
  <tr>
    <td align="${imgAlign}">
      <img src="${imgUrl}" alt="${imgAlt}" style="max-width: ${imgWidth}; height: auto; display: block; border: 0; outline: none; text-decoration: none; border-radius: 6px;" />
    </td>
  </tr>
</table>`;
    insertHtmlAtCursor(imgMarkup);
    setShowImageModal(false);
    toast.success('Image/Logo inserted! 🖼️');
  };

  const handleInsertSignature = () => {
    const selectedAccount = accounts.find(a => a._id === selectedAccountId);
    const counselorName = currentUser?.name || selectedAccount?.displayName || 'Admissions Counselor';
    const counselorEmail = selectedAccount?.email || currentUser?.email || 'counselor@mayalokventures.com';
    const counselorPhone = currentUser?.phone || '+91 98765 43210';
    const companyName = currentUser?.companyName || 'Mayalok Education';

    const signatureMarkup = `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top: 30px; padding-top: 18px; border-top: 2px solid #e2e8f0; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <tr>
    <td style="vertical-align: middle;">
      <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
        ${counselorName}
      </div>
      <div style="font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 6px;">
        Senior Academic Advisor • ${companyName}
      </div>
      <div style="font-size: 12px; color: #475569; line-height: 1.5;">
        <span>📞 ${counselorPhone}</span> &nbsp;|&nbsp; 
        <span>✉️ <a href="mailto:${counselorEmail}" style="color: #4f46e5; text-decoration: none;">${counselorEmail}</a></span>
      </div>
      <div style="margin-top: 8px; display: inline-block; padding: 3px 8px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 11px; font-weight: 600; color: #166534;">
        ✓ Verified Education Advisor
      </div>
    </td>
  </tr>
</table>`;
    insertHtmlAtCursor(signatureMarkup);
    toast.success('Counselor signature card inserted! ✍️');
  };

  const handleInsertFooter = () => {
    const companyName = currentUser?.companyName || 'Mayalok Ventures';
    const year = new Date().getFullYear();
    const footerMarkup = `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top: 36px; padding-top: 18px; border-top: 1px dashed #cbd5e1; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;">
  <tr>
    <td style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
      <p style="margin: 0 0 6px 0; font-weight: 600; color: #64748b;">${companyName} • Admissions & Student Services</p>
      <p style="margin: 0 0 8px 0; max-width: 500px; margin-left: auto; margin-right: auto;">This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error please notify the sender.</p>
      <p style="margin: 0; font-size: 10px; color: #cbd5e1;">© ${year} ${companyName}. All rights reserved.</p>
    </td>
  </tr>
</table>`;
    insertHtmlAtCursor(footerMarkup);
    toast.success('Organization footer & disclaimer inserted! 🏛️');
  };

  const handleApplyTemplate = (tmpl) => {
    if (!tmpl) return;

    let sub = tmpl.subject || tmpl.title || '';
    let body = tmpl.bodyHtml || tmpl.content || tmpl.text || '';

    // If template is plain text, wrap into paragraphs
    if (!/<(p|div|table|h[1-6])\b/i.test(body)) {
      body = body.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('\n');
    }

    // If lead is linked, substitute variables
    if (linkedLead) {
      const selectedAccount = accounts.find(a => a._id === selectedAccountId);
      const vars = {
        name: linkedLead.name || 'Candidate',
        course: linkedLead.targetCourse || linkedLead.targetStream || 'your course',
        phone: linkedLead.phone || '',
        email: linkedLead.email || '',
        counselorName: currentUser?.name || selectedAccount?.displayName || 'Advisor',
        counselorPhone: currentUser?.phone || '+91 98765 43210',
      };

      Object.entries(vars).forEach(([k, v]) => {
        const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'gi');
        sub = sub.replace(regex, v);
        body = body.replace(regex, v);
      });
    }

    if (sub && !subject) setSubject(sub);
    setBodyHtml(body);
    if (editorRef.current) {
      editorRef.current.innerHTML = body;
    }
    toast.success(`Template "${tmpl.title || tmpl.name}" applied! ✨`);
  };

  const handleSaveAsTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplateTitle.trim()) return toast.error('Template title is required');
    if (!bodyHtml.trim()) return toast.error('Cannot save empty email as template');

    try {
      setSavingTemplate(true);
      const res = await api.post('/templates', {
        title: newTemplateTitle.trim(),
        channel: 'EMAIL',
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        category: newTemplateCategory,
      });

      toast.success('Template saved successfully! 💾');
      setShowSaveTemplateModal(false);
      setNewTemplateTitle('');
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newAttachments = files.map(f => ({
      file: f,
      filename: f.name,
      size: f.size,
      contentType: f.type,
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveDraft = async () => {
    if (!selectedAccountId) return toast.error('Select an account to save draft');
    try {
      setSavingDraft(true);
      const toList = to.split(',').map(s => s.trim()).filter(Boolean);
      await api.post('/email/drafts', {
        accountId: selectedAccountId,
        to: toList,
        subject,
        bodyHtml,
        leadId: linkedLeadId || null,
        inReplyTo: initialData.inReplyTo || null,
        threadId: initialData.threadId || null,
      });
      toast.success('Draft saved 💾');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedAccountId) {
      return toast.error('Please select an email account to send from');
    }

    const toList = to.split(',').map(s => s.trim()).filter(Boolean);
    if (!toList.length) {
      return toast.error('Please enter at least one recipient email');
    }

    try {
      setSending(true);

      const ccList = cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : [];
      const bccList = bcc ? bcc.split(',').map(s => s.trim()).filter(Boolean) : [];

      // If attachments exist, send as FormData
      if (attachments.length > 0) {
        const formData = new FormData();
        formData.append('accountId', selectedAccountId);
        toList.forEach(email => formData.append('to[]', email));
        ccList.forEach(email => formData.append('cc[]', email));
        bccList.forEach(email => formData.append('bcc[]', email));
        formData.append('subject', subject || '(No Subject)');
        formData.append('bodyHtml', bodyHtml);
        if (linkedLeadId) formData.append('leadId', linkedLeadId);
        if (initialData.inReplyTo) formData.append('inReplyTo', initialData.inReplyTo);
        if (initialData.threadId) formData.append('threadId', initialData.threadId);

        attachments.forEach(att => {
          if (att.file) {
            formData.append('attachments', att.file);
          }
        });

        await api.post('/email/send', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/email/send', {
          accountId: selectedAccountId,
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject: subject || '(No Subject)',
          bodyHtml,
          leadId: linkedLeadId || null,
          inReplyTo: initialData.inReplyTo || null,
          threadId: initialData.threadId || null,
        });
      }

      toast.success('Email sent successfully with rich formatting! 🚀');
      if (onSent) onSent();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const activeAccount = accounts.find(a => a._id === selectedAccountId);

  return (
    <div className="fixed inset-0 z-[9990] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header & Mode Selector */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shadow-xs">
              ✉
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 m-0 leading-tight">
                {initialData.inReplyTo ? 'Reply to Conversation' : 'Rich Email Designer'}
              </h3>
              <p className="text-[11px] text-slate-500 m-0">
                Visual designer & code editor with bulletproof email deliverability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Editor Mode Tabs */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEditorMode('visual')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                  editorMode === 'visual'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Palette size={13} /> Visual
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('code')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                  editorMode === 'code'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code size={13} /> HTML Code
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('preview')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                  editorMode === 'preview'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={13} /> Preview
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition ml-1"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 bg-white">
            {/* From Account Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-16 font-semibold text-slate-500 shrink-0">From:</span>
              {accounts.length > 0 ? (
                <select
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {accounts.map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.displayName || acc.email} ({acc.email})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-rose-600 font-medium text-xs">
                  No connected mailboxes. Please connect an account in Settings first.
                </span>
              )}
            </div>

            {/* To Recipient Input */}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-16 font-semibold text-slate-500 shrink-0">To:</span>
              <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-indigo-500 bg-white">
                <input
                  type="text"
                  required
                  placeholder="student@example.com (comma separated for multiple)"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="flex-1 text-xs border-none focus:outline-none bg-transparent text-slate-900"
                />
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  {!showCc && (
                    <button
                      type="button"
                      onClick={() => setShowCc(true)}
                      className="hover:text-indigo-600 font-semibold cursor-pointer"
                    >
                      Cc
                    </button>
                  )}
                  {!showBcc && (
                    <button
                      type="button"
                      onClick={() => setShowBcc(true)}
                      className="hover:text-indigo-600 font-semibold cursor-pointer"
                    >
                      Bcc
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Cc Input */}
            {showCc && (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 font-semibold text-slate-500 shrink-0">Cc:</span>
                <input
                  type="text"
                  placeholder="counselor@example.com"
                  value={cc}
                  onChange={e => setCc(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Bcc Input */}
            {showBcc && (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 font-semibold text-slate-500 shrink-0">Bcc:</span>
                <input
                  type="text"
                  placeholder="manager@example.com"
                  value={bcc}
                  onChange={e => setBcc(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Subject Input */}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-16 font-semibold text-slate-500 shrink-0">Subject:</span>
              <input
                type="text"
                placeholder="Course Inquiry Response / Admission Prospectus"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* CRM Lead Association & Template Toolbar Bar */}
            <div className="flex flex-wrap items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs gap-2">
              {/* Lead Link */}
              <div className="flex items-center gap-2 min-w-0">
                <User size={13} className="text-indigo-600 shrink-0" />
                <span className="font-semibold text-slate-700">CRM Lead:</span>
                {linkedLead ? (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold truncate max-w-[200px]">
                    {linkedLead.name} {linkedLead.targetCourse ? `• ${linkedLead.targetCourse}` : ''}
                  </span>
                ) : (
                  <select
                    value={linkedLeadId}
                    onChange={e => {
                      const lId = e.target.value;
                      setLinkedLeadId(lId);
                      const f = leadsList.find(x => x._id === lId);
                      setLinkedLead(f || null);
                      if (f && f.email && !to) setTo(f.email);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700"
                  >
                    <option value="">Link to student/lead...</option>
                    {leadsList.map(l => (
                      <option key={l._id} value={l._id}>
                        {l.name} {l.email ? `(${l.email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Template Picker & Save as Template */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <FileText size={13} className="text-violet-600" />
                  <select
                    onChange={e => {
                      const t = templates.find(x => x._id === e.target.value);
                      if (t) handleApplyTemplate(t);
                    }}
                    defaultValue=""
                    className="bg-white border border-violet-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-700 focus:outline-none"
                  >
                    <option value="" disabled>
                      {loadingTemplates ? 'Loading templates...' : 'Apply Template...'}
                    </option>
                    {templates.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.title || t.name} {t.category ? `(${t.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewTemplateTitle(subject || '');
                    setShowSaveTemplateModal(true);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 shadow-2xs transition"
                  title="Save current email design as reusable template"
                >
                  <BookmarkPlus size={12} className="text-emerald-600" /> Save as Template
                </button>
              </div>
            </div>

            {/* Editor Canvas Area */}
            <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 bg-white shadow-2xs">
              {/* Visual Mode: Rich Formatting Toolbar */}
              {editorMode === 'visual' && (
                <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 bg-slate-50/90 text-slate-600 text-xs">
                  {/* Heading Block Dropdown */}
                  <select
                    onChange={e => execCmd('formatBlock', e.target.value)}
                    defaultValue="p"
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="p">Paragraph</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                  </select>

                  <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

                  {/* Inline Typography */}
                  <button
                    type="button"
                    onClick={() => execCmd('bold')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Bold (Ctrl+B)"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('italic')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Italic (Ctrl+I)"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('underline')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Underline (Ctrl+U)"
                  >
                    <Underline size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('strikeThrough')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Strikethrough"
                  >
                    <Strikethrough size={13} />
                  </button>

                  <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

                  {/* Color Palette Popovers */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowColorPicker(!showColorPicker);
                        setShowHighlightPicker(false);
                      }}
                      className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition flex items-center gap-1"
                      title="Text Color"
                    >
                      <Palette size={13} className="text-indigo-600" />
                      <ChevronDown size={10} />
                    </button>
                    {showColorPicker && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 flex flex-col gap-1 w-40">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Text Color</span>
                        <div className="grid grid-cols-4 gap-1.5 my-1">
                          {TEXT_COLORS.map(c => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => {
                                execCmd('foreColor', c.value);
                                setShowColorPicker(false);
                              }}
                              className="w-6 h-6 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition cursor-pointer"
                              style={{ backgroundColor: c.value }}
                              title={c.label}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowHighlightPicker(!showHighlightPicker);
                        setShowColorPicker(false);
                      }}
                      className="px-2 py-1 hover:bg-slate-200/80 rounded text-slate-700 text-xs transition flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200"
                      title="Background Highlight"
                    >
                      <span className="font-bold text-[11px]">A</span> Highlight
                    </button>
                    {showHighlightPicker && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 flex flex-col gap-1 w-44">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Highlight Color</span>
                        <div className="grid grid-cols-4 gap-1.5 my-1">
                          {HIGHLIGHT_COLORS.map(c => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => {
                                execCmd('hiliteColor', c.value);
                                setShowHighlightPicker(false);
                              }}
                              className="w-6 h-6 rounded-md border border-slate-300 shadow-2xs hover:scale-110 transition cursor-pointer"
                              style={{ backgroundColor: c.value }}
                              title={c.label}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

                  {/* Alignment */}
                  <button
                    type="button"
                    onClick={() => execCmd('justifyLeft')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Align Left"
                  >
                    <AlignLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('justifyCenter')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Align Center"
                  >
                    <AlignCenter size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('justifyRight')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Align Right"
                  >
                    <AlignRight size={13} />
                  </button>

                  <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

                  {/* Lists & Separators */}
                  <button
                    type="button"
                    onClick={() => execCmd('insertUnorderedList')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Bullet List"
                  >
                    <List size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('insertOrderedList')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Numbered List"
                  >
                    <ListOrdered size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('insertHorizontalRule')}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Horizontal Divider"
                  >
                    <Minus size={13} />
                  </button>

                  <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

                  {/* Link Dialog */}
                  <button
                    type="button"
                    onClick={() => {
                      const url = prompt('Enter Hyperlink URL:', 'https://');
                      if (url) execCmd('createLink', url);
                    }}
                    className="p-1.5 hover:bg-slate-200/80 rounded text-slate-700 transition"
                    title="Insert Link"
                  >
                    <Link2 size={13} />
                  </button>

                  <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

                  {/* Quick Component Inserters */}
                  <button
                    type="button"
                    onClick={() => setShowButtonModal(true)}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <MousePointerClick size={12} /> + Button
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowImageModal(true)}
                    className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <ImageIcon size={12} /> + Logo/Image
                  </button>

                  <button
                    type="button"
                    onClick={handleInsertSignature}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <ShieldCheck size={12} /> + Signature
                  </button>

                  <button
                    type="button"
                    onClick={handleInsertFooter}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    + Footer
                  </button>

                  {/* Dynamic Merge Variables Chips */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowVariableMenu(!showVariableMenu)}
                      className="px-2 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Sparkles size={12} /> Merge Tags <ChevronDown size={10} />
                    </button>
                    {showVariableMenu && (
                      <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2 flex flex-col gap-1 w-48">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dynamic Fields</span>
                        {MERGE_VARIABLES.map(v => (
                          <button
                            key={v.tag}
                            type="button"
                            onClick={() => {
                              insertHtmlAtCursor(`<strong>${v.tag}</strong>`);
                              setShowVariableMenu(false);
                            }}
                            className="text-left px-2 py-1 rounded hover:bg-violet-50 text-slate-700 hover:text-violet-700 text-xs font-medium transition flex items-center justify-between"
                          >
                            <span>{v.label}</span>
                            <code className="text-[10px] text-violet-600 bg-violet-50 px-1 rounded">{v.tag}</code>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Visual Editor Canvas */}
              {editorMode === 'visual' && (
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleEditorInput}
                  onBlur={handleEditorInput}
                  className="min-h-[260px] max-h-[420px] overflow-y-auto p-5 text-slate-900 focus:outline-none leading-relaxed text-[15px]"
                  style={{
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    lineHeight: '1.6',
                  }}
                />
              )}

              {/* HTML Code Editor Mode */}
              {editorMode === 'code' && (
                <div className="flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-300 text-xs border-b border-slate-800">
                    <span className="font-mono text-[11px] text-emerald-400">
                      HTML Source View • Paste custom HTML templates (Canva, Figma, Stripo, BeeFree)
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditorMode('visual')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-medium transition"
                    >
                      Return to Visual Editor
                    </button>
                  </div>
                  <textarea
                    rows={13}
                    value={bodyHtml}
                    onChange={e => setBodyHtml(e.target.value)}
                    placeholder="<html><body>Write or paste raw HTML code here...</body></html>"
                    className="w-full p-4 font-mono text-xs bg-slate-950 text-emerald-300 border-none focus:outline-none resize-y leading-relaxed"
                  />
                </div>
              )}

              {/* Live Preview Mode */}
              {editorMode === 'preview' && (
                <div className="p-4 bg-slate-100 flex flex-col items-center min-h-[300px] max-h-[460px] overflow-y-auto">
                  {/* Device Switcher */}
                  <div className="flex items-center gap-1 mb-3 bg-white p-1 rounded-xl shadow-xs border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Monitor size={13} /> Desktop (640px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Smartphone size={13} /> Mobile (375px)
                    </button>
                  </div>

                  {/* Rendered Email Card */}
                  <div
                    className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden transition-all duration-300"
                    style={{
                      width: previewDevice === 'mobile' ? '375px' : '100%',
                      maxWidth: previewDevice === 'mobile' ? '375px' : '640px',
                    }}
                  >
                    {/* Simulated Mailbox Client Header */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/70 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 truncate">
                          {activeAccount?.displayName || 'Advisor'} &lt;{activeAccount?.email || 'support@crm.com'}&gt;
                        </span>
                        <span className="text-[11px] text-slate-400">Just now</span>
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        To: <span className="font-medium text-slate-800">{to || 'candidate@example.com'}</span>
                      </div>
                      <div className="text-slate-900 font-semibold text-xs pt-1">
                        Subject: {subject || '(No Subject)'}
                      </div>
                    </div>

                    {/* Email Content Container */}
                    <div
                      className="p-5 text-slate-900 text-[15px] leading-relaxed"
                      style={{
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                      }}
                      dangerouslySetInnerHTML={{ __html: bodyHtml || '<p className="text-slate-400 italic">No content yet.</p>' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Attachments Section */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Attachments ({attachments.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800 shadow-2xs"
                    >
                      <Paperclip size={12} className="text-slate-500" />
                      <span className="truncate max-w-[180px]">{att.filename}</span>
                      <span className="text-[10px] text-slate-400">
                        ({Math.round(att.size / 1024)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-slate-400 hover:text-rose-600 transition"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Paperclip size={14} /> Attach Files
              </button>

              <button
                type="button"
                disabled={savingDraft}
                onClick={handleSaveDraft}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/60 rounded-xl transition text-xs font-semibold cursor-pointer"
              >
                {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={sending || !accounts.length}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {sending ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* ----------------- SUB-MODALS ----------------- */}

        {/* Insert CTA Button Modal */}
        {showButtonModal && (
          <div className="fixed inset-0 z-[9995] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 m-0 flex items-center gap-2">
                  <MousePointerClick size={16} className="text-indigo-600" /> Insert Call-To-Action Button
                </h4>
                <button
                  type="button"
                  onClick={() => setShowButtonModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleInsertButton} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Button Text</label>
                  <input
                    type="text"
                    required
                    value={btnText}
                    onChange={e => setBtnText(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Link URL</label>
                  <input
                    type="url"
                    required
                    value={btnUrl}
                    onChange={e => setBtnUrl(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Button Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={btnBgColor}
                        onChange={e => setBtnBgColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={btnBgColor}
                        onChange={e => setBtnBgColor(e.target.value)}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alignment</label>
                    <select
                      value={btnAlign}
                      onChange={e => setBtnAlign(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                {/* Live Button Preview */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Preview</span>
                  <div style={{ textAlign: btnAlign }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '10px 24px',
                        backgroundColor: btnBgColor,
                        color: btnTextColor,
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      {btnText || 'Button'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowButtonModal(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-xs"
                  >
                    Insert Button
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Insert Image / Logo Modal */}
        {showImageModal && (
          <div className="fixed inset-0 z-[9995] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 m-0 flex items-center gap-2">
                  <ImageIcon size={16} className="text-sky-600" /> Insert Logo or Banner Image
                </h4>
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleInsertImage} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Image URL (Hosted HTTPS Link)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://yourdomain.com/logo.png"
                    value={imgUrl}
                    onChange={e => setImgUrl(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Max Width</label>
                    <select
                      value={imgWidth}
                      onChange={e => setImgWidth(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="120px">120px (Compact Logo)</option>
                      <option value="180px">180px (Standard Logo)</option>
                      <option value="260px">260px (Header Logo)</option>
                      <option value="100%">100% (Full Width Banner)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alignment</label>
                    <select
                      value={imgAlign}
                      onChange={e => setImgAlign(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alt Text (Accessibility)</label>
                  <input
                    type="text"
                    value={imgAlt}
                    onChange={e => setImgAlt(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowImageModal(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 shadow-xs"
                  >
                    Insert Image
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Save as Template Modal */}
        {showSaveTemplateModal && (
          <div className="fixed inset-0 z-[9995] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 m-0 flex items-center gap-2">
                  <BookmarkPlus size={16} className="text-emerald-600" /> Save as Reusable Email Template
                </h4>
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveAsTemplate} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Template Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MBA Admission Offer & Fee Schedule"
                    value={newTemplateTitle}
                    onChange={e => setNewTemplateTitle(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Subject Line</label>
                  <input
                    type="text"
                    placeholder="e.g. Congratulations {{name}}! Admission Approved"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newTemplateCategory}
                    onChange={e => setNewTemplateCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="general">General Outreach</option>
                    <option value="admission">Admission Prospectus</option>
                    <option value="follow_up">Counseling Follow-Up</option>
                    <option value="scholarship">Scholarship & Grants</option>
                    <option value="fees">Fee Breakdown</option>
                  </select>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-[11px] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check size={13} className="text-emerald-600" /> Multi-Tenant Reusability
                  </div>
                  <p className="m-0 leading-relaxed text-emerald-700">
                    This template will be saved to your CRM account and available for all counselors to insert with one click.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTemplate}
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 shadow-xs flex items-center gap-1.5"
                  >
                    {savingTemplate ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
