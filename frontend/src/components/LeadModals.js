'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAlarm } from '@/lib/AlarmContext';
import {
  FileSpreadsheet, FileText, Download, Upload, X, ShieldAlert,
  ArrowRight, Edit2, Calendar, CheckCircle2, Clock, Ban
} from 'lucide-react';
import { getIndustryDefaults } from '@/lib/industryTemplates';
import { isLostStage, LOST_REASON_OPTIONS } from '@/components/LostReasonModal';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';
import DynamicFormRenderer, { isFieldVisible as evaluateFieldVisible, isFieldRequired as evaluateFieldRequired } from '@/components/common/DynamicFormRenderer';

export const STAGE_LABELS = {
  new_lead: '🆕 1. New Lead',
  new: '🆕 1. New Lead',
  contacted: '📞 2. Tele-Counsel',
  shortlisted: '📋 3. Shortlisted',
  site_visit_scheduled: '🏛️ 4. Campus Visit',
  negotiation: '💳 5. Quota Booking',
  converted: '🎓 6. Confirmed Won',
  closed: '🎓 6. Confirmed Won',
  lost: '❌ Dropped / Lost',
  not_interested: '❌ Dropped / Lost',
  payment_done: '💳 5. Quota Booking',
};

export const STATUS_COLORS = {
  new_lead: 'badge-new',
  new: 'badge-new',
  contacted: 'badge-tag',
  shortlisted: 'badge-tag',
  site_visit_scheduled: 'badge-primary',
  negotiation: 'badge-warning',
  converted: 'badge-closed',
  closed: 'badge-closed',
  lost: 'badge-danger',
  not_interested: 'badge-danger',
  payment_done: 'badge-closed',
};

export function UpgradeModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center', padding: '24px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', marginBottom: 16 }}>
          <ShieldAlert size={32} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Lead Limit Reached</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, margin: '0 0 20px' }}>
          You have saved 10 leads on your free plan. Upgrade to a paid tier now for unlimited leads, product catalogs, bulk broadcasts, and full agency analytics.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/plans" className="btn btn-primary btn-full" style={{ justifyContent: 'center', textDecoration: 'none', gap: 8 }} onClick={onClose}>
            View Premium Plans <ArrowRight size={16} />
          </Link>
          <button className="btn btn-ghost btn-full" onClick={onClose}>Maybe Later</button>
        </div>
      </div>
    </div>
  );
}

export function ImportLeadsModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDownloadSample = () => {
    const headers = [
      'Name', 'Phone', 'Email', 'Company', 'Stage', 'Deal Value', 'Market',
      'Follow-up Date', 'Offering', 'Tier', 'Tags'
    ];
    const sampleRow = [
      'Alex Johnson', '15550199283', 'alex@company.com', 'Acme Corp', 'New Lead', '$7500', 'New York',
      '2026-08-25', 'Premium Suite', 'Standard Tier', 'vip, inbound'
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), sampleRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_lead_import_template.csv');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    toast.success('Sample import template downloaded 📥');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select an Excel or CSV file');

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(data.message || 'Leads imported successfully! 🎉', { duration: 5000 });
      onImported();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import leads from file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={20} color="var(--accent)" /> Smart Bulk Lead Import
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Upload your client spreadsheet. Auto-detects names, phone numbers, deal stages, and custom dynamic fields.
        </p>

        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            border: '2px dashed var(--border)',
            borderRadius: 12,
            padding: '24px 16px',
            textAlign: 'center',
            background: 'var(--surface)',
            cursor: 'pointer',
            position: 'relative'
          }}>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Upload size={32} color="var(--accent)" />
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  {file ? file.name : 'Click to select or drag and drop spreadsheet'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  {file ? `${(file.size / 1024).toFixed(1)} KB • Ready for auto-mapping` : 'Supports Excel (.xlsx, .xls) and CSV (.csv) up to 15MB'}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, gap: 5, color: 'var(--accent)', padding: '4px 8px' }}
            >
              <Download size={13} /> Download Sample Template
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose} disabled={uploading}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-full" disabled={uploading || !file}>
              {uploading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Start Smart Import 🚀'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExportLeadsModal({ onClose, user, statusFilter, projectFilter, search }) {
  const allDefaultStatuses = [
    'new', 'cold', 'warm', 'hot', 'contacted',
    'site_visit_scheduled', 'negotiation', 'payment_done', 'closed', 'lost'
  ];
  const availableStatuses = (user?.customPipelineStages && user.customPipelineStages.length > 0)
    ? Array.from(new Set([...user.customPipelineStages, ...allDefaultStatuses]))
    : allDefaultStatuses;

  const [selectedStatuses, setSelectedStatuses] = useState(
    statusFilter ? [statusFilter] : availableStatuses
  );
  const [format, setFormat] = useState('xlsx');
  const [downloading, setDownloading] = useState(false);

  const toggleStatus = (st) => {
    setSelectedStatuses(prev =>
      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
    );
  };

  const selectAll = () => setSelectedStatuses(availableStatuses);
  const selectNone = () => setSelectedStatuses([]);

  const handleDownload = async (e) => {
    e.preventDefault();
    if (selectedStatuses.length === 0) {
      return toast.error('Please select at least one pipeline stage to export.');
    }

    setDownloading(true);
    try {
      toast.loading(`Generating ${format.toUpperCase()} export...`, { id: 'export-leads-toast' });
      const params = {
        format,
        statuses: selectedStatuses.join(','),
      };
      if (projectFilter) params.projectId = projectFilter;
      if (search) params.search = search;

      const response = await api.get('/leads/export', {
        params,
        responseType: 'blob',
      });

      const mimeType = format === 'pdf'
        ? 'application/pdf'
        : (format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} export complete! 📁`, { id: 'export-leads-toast' });
      onClose();
    } catch (err) {
      let errorMsg = 'Failed to export leads';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          errorMsg = parsed.message || errorMsg;
        } catch {}
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      }
      toast.error(errorMsg, { id: 'export-leads-toast', duration: 6000 });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(79,70,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <Download size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Selective Lead Export</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Choose specific pipeline stages & export format</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '10px 12px', background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <ShieldAlert size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--text)' }}>Anti-Theft Security Policy:</strong> Direct spreadsheet exports may be subject to a 90-day tenure verification gate depending on subscription tier to prevent unauthorized lead poaching.
          </div>
        </div>

        <form onSubmit={handleDownload}>
          <div style={{ marginBottom: 16 }}>
            <label className="label" style={{ fontWeight: 700, marginBottom: 8 }}>Choose Export File Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet, color: '#10b981' },
                { id: 'pdf', label: 'PDF Report', icon: FileText, color: '#ef4444' },
                { id: 'csv', label: 'CSV (.csv)', icon: FileText, color: '#3b82f6' },
              ].map(fmt => {
                const Icon = fmt.icon;
                const isSelected = format === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormat(fmt.id)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'rgba(79,70,229,0.08)' : 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={18} color={fmt.color} />
                    <span style={{ fontSize: 11, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                      {fmt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="label" style={{ fontWeight: 700, margin: 0 }}>
                Filter by Pipeline Stages ({selectedStatuses.length}/{availableStatuses.length})
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={selectAll} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 11, color: 'var(--accent)' }}>Select All</button>
                <button type="button" onClick={selectNone} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 11, color: 'var(--text-muted)' }}>Clear</button>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 6,
              maxHeight: 180,
              overflowY: 'auto',
              padding: 8,
              background: 'var(--surface)',
              borderRadius: 10,
              border: '1px solid var(--border)'
            }}>
              {availableStatuses.map(st => {
                const isChecked = selectedStatuses.includes(st);
                return (
                  <div
                    key={st}
                    onClick={() => toggleStatus(st)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: isChecked ? 'var(--card)' : 'transparent',
                      border: `1px solid ${isChecked ? 'var(--accent)' : 'transparent'}`,
                      cursor: 'pointer',
                      fontSize: 12,
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: isChecked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {STAGE_LABELS[st] || st}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-full" disabled={downloading}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-full" disabled={downloading || selectedStatuses.length === 0}>
              {downloading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Download Filtered Leads 🚀'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExportAnalyticsModal({ onClose, isCompanyOwner }) {
  const [format, setFormat] = useState('xlsx');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    e.preventDefault();
    setDownloading(true);
    try {
      toast.loading(`Generating Analytics ${format.toUpperCase()} report...`, { id: 'analytics-toast' });
      const endpoint = isCompanyOwner ? '/company/analytics/export' : '/analytics/export';
      const response = await api.get(endpoint, {
        params: { format },
        responseType: 'blob',
      });

      const mimeType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_performance_report_${new Date().toISOString().slice(0, 10)}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Analytics ${format.toUpperCase()} downloaded! 📊`, { id: 'analytics-toast' });
      onClose();
    } catch {
      toast.error('Failed to export analytics report', { id: 'analytics-toast' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              📊
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Export Analytics Report</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {isCompanyOwner ? 'Organization KPIs, Agent Leaderboard & Total Revenue' : 'Pipeline Breakdown, Stage Conversion & Revenue'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleDownload}>
          <div style={{ marginBottom: 18 }}>
            <label className="label" style={{ fontWeight: 700, marginBottom: 8 }}>Choose Report Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: `1.5px solid ${format === 'xlsx' ? 'var(--accent)' : 'var(--border)'}`,
                  background: format === 'xlsx' ? 'rgba(79,70,229,0.08)' : 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <FileSpreadsheet size={22} color="#10b981" />
                <span style={{ fontSize: 13, fontWeight: format === 'xlsx' ? 700 : 500 }}>Excel (.xlsx)</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Multi-sheet dataset</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: `1.5px solid ${format === 'pdf' ? 'var(--accent)' : 'var(--border)'}`,
                  background: format === 'pdf' ? 'rgba(79,70,229,0.08)' : 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <FileText size={22} color="#ef4444" />
                <span style={{ fontSize: 13, fontWeight: format === 'pdf' ? 700 : 500 }}>PDF Document</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Executive report</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-full" disabled={downloading}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-full" disabled={downloading} style={{ background: '#16a34a', borderColor: '#16a34a' }}>
              {downloading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Download Analytics 📊'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddLeadModal({ onClose, onCreated, onLimitReached, user }) {
  const defaults = getIndustryDefaults(user?.industryType);
  const initialStages = (user?.pipelineStages && user.pipelineStages.length > 0)
    ? user.pipelineStages
    : (user?.customPipelineStages && user.customPipelineStages.length > 0)
      ? user.customPipelineStages
      : defaults.pipelineStages;

  const [values, setValues] = useState({
    name: '',
    phone: '',
    company: '',
    email: '',
    location: '',
    projectId: '',
    project: '',
    propertyType: '',
    budget: '',
    status: initialStages[0] || 'new',
    followUpDate: '',
    siteVisitDate: '',
    tags: '',
    source: '',
    utmCampaign: '',
    utmMedium: '',
    utmSource: '',
    lostReason: '',
    lostReasonDetail: '',
  });

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    api.get('/catalogue').then(r => setProjects(r.data?.data || r.data?.colleges || [])).catch(() => {});
    api.get('/auth/form-schema?type=lead').then(r => {
      if (r.data?.schema && Array.isArray(r.data.schema) && r.data.schema.length > 0) {
        setSchema(r.data.schema);
      }
    }).catch(() => {});
  }, []);

  const userShowFollowUp = (() => {
    if (user?.showFollowUpOnCreate !== undefined) return user.showFollowUpOnCreate;
    if (user?.preferences?.showFollowUpOnCreate !== undefined) return user.preferences.showFollowUpOnCreate;
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.showFollowUpOnCreate !== undefined) return parsed.showFollowUpOnCreate;
        if (parsed.preferences?.showFollowUpOnCreate !== undefined) return parsed.preferences.showFollowUpOnCreate;
      }
    } catch {}
    return true;
  })();
  const showFollowUpOnCreate = userShowFollowUp !== false;

  const activeSchema = (schema.length > 0)
    ? schema
    : ((user?.leadFormSchema && Array.isArray(user.leadFormSchema) && user.leadFormSchema.length > 0)
      ? user.leadFormSchema
      : defaults.leadFormSchema);

  const filteredSchema = activeSchema.filter(f => {
    if (f.fieldId === 'followUpDate' && !showFollowUpOnCreate) return false;
    return true;
  });

  const handleFieldChange = (fieldId, value) => {
    setValues(v => ({ ...v, [fieldId]: value }));
    if (formErrors[fieldId]) {
      setFormErrors(errs => ({ ...errs, [fieldId]: null }));
    }
  };

  const handleProjectSelect = (e) => {
    const pId = e.target.value;
    if (!pId) {
      setValues(v => ({ ...v, projectId: '', project: '' }));
      return;
    }
    const selected = projects.find(p => p._id === pId);
    setValues(v => ({
      ...v,
      projectId: pId,
      project: selected?.name || '',
      location: v.location || selected?.location || '',
      budget: v.budget || selected?.basePrice || '',
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    const validationErrors = {};
    for (const field of filteredSchema) {
      if (!evaluateFieldVisible(field, values)) continue;
      const isReq = evaluateFieldRequired(field, values);
      const fieldVal = values[field.fieldId];
      const isEmpty = fieldVal === undefined || fieldVal === null || String(fieldVal).trim() === '' || (Array.isArray(fieldVal) && fieldVal.length === 0);
      
      if (isReq && isEmpty && field.fieldId !== 'followUpDate') {
        validationErrors[field.fieldId] = `${field.label || field.fieldId} is required.`;
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      const firstErrMsg = Object.values(validationErrors)[0];
      return toast.error(firstErrMsg);
    }

    if (showFollowUpOnCreate && filteredSchema.some(f => f.fieldId === 'followUpDate' && f.isRequired) && !values.followUpDate) {
      return toast.error('Next follow-up date is mandatory');
    }

    if (isCurrentLostStage && !values.lostReason) {
      return toast.error('Please select a Lost Reason for this lost stage');
    }

    setLoading(true);
    setFormErrors({});
    try {
      const knownSystem = new Set([
        'name', 'phone', 'email', 'company', 'tags', 'status', 'followUpDate',
        'location', 'profession', 'budget', 'areasOfInterest', 'project',
        'projectId', 'propertyType', 'siteVisitDate', 'assignedTo',
        'source', 'utmCampaign', 'utmMedium', 'utmSource', 'lostReason', 'lostReasonDetail'
      ]);

      const payload = {
        name: (values.name || '').trim(),
        phone: (values.phone || '').replace(/\D/g, ''),
        company: values.company || undefined,
        email: values.email ? values.email.toLowerCase().trim() : undefined,
        tags: values.tags ? (Array.isArray(values.tags) ? values.tags : values.tags.split(',').map(t => t.trim()).filter(Boolean)) : [],
        status: values.status || 'new',
        followUpDate: (showFollowUpOnCreate && values.followUpDate) ? fromLocalDatetimeStringToISO(values.followUpDate) : undefined,
        location: values.location || '',
        budget: values.budget || '',
        propertyType: values.propertyType || '',
        siteVisitDate: values.siteVisitDate ? fromLocalDatetimeStringToISO(values.siteVisitDate) : undefined,
        projectId: values.projectId || undefined,
        project: values.project || undefined,
        source: values.source || undefined,
        utmCampaign: values.utmCampaign || undefined,
        utmMedium: values.utmMedium || undefined,
        utmSource: values.utmSource || undefined,
        lostReason: values.lostReason || undefined,
        lostReasonDetail: values.lostReasonDetail || undefined,
        customData: {},
      };

      for (const [k, v] of Object.entries(values)) {
        if (!knownSystem.has(k) && v !== undefined && v !== '') {
          payload.customData[k] = v;
          payload[k] = v;
        }
      }

      const { data } = await api.post('/leads', payload);
      toast.success('Prospect lead created successfully ✅');
      onCreated(data);
      onClose();
    } catch (err) {
      if (err.response?.data?.errors) {
        setFormErrors(err.response.data.errors);
      }
      if (err.response?.data?.code === 'LIMIT_REACHED') {
        onClose();
        onLimitReached();
      } else {
        toast.error(err.response?.data?.message || 'Failed to create lead');
      }
    } finally {
      setLoading(false);
    }
  };

  const isCurrentLostStage = isLostStage(values.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add New Prospect Lead</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Dynamically formatted for {user?.industryType || 'Universal'} CRM
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '72dvh', overflowY: 'auto', paddingRight: 4 }}>
          <DynamicFormRenderer
            schema={filteredSchema}
            values={values}
            onChange={handleFieldChange}
            errors={formErrors}
            theme="light"
            gridCols={2}
          />

          {projects.length > 0 && !filteredSchema.some(f => f.fieldId === 'projectId') && (
            <div>
              <label className="label">Offering / Project Link (Optional)</label>
              <select className="input" value={values.projectId || ''} onChange={handleProjectSelect}>
                <option value="">-- Select Offering / Project (Optional) --</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>📦 {p.name} ({p.location})</option>
                ))}
              </select>
            </div>
          )}

          {isCurrentLostStage && (
            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>
                ⚠️ Mandatory Lost Reason Details
              </span>
              <div>
                <label className="label" style={{ fontSize: 11 }}>Lost Reason *</label>
                <select
                  className="input"
                  value={values.lostReason || ''}
                  onChange={e => handleFieldChange('lostReason', e.target.value)}
                  required
                  style={{ height: 38, fontSize: 13 }}
                >
                  <option value="">-- Select Reason --</option>
                  {LOST_REASON_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" style={{ fontSize: 11 }}>Lost Notes / Context (Optional)</label>
                <input
                  className="input"
                  placeholder="e.g. Higher pricing than competitor"
                  value={values.lostReasonDetail || ''}
                  onChange={e => handleFieldChange('lostReasonDetail', e.target.value)}
                  style={{ height: 38, fontSize: 13 }}
                />
              </div>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ height: 44, borderRadius: 12 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: 44, borderRadius: 12 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Create Prospect Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditLeadModal({ lead, onClose, onUpdated, user }) {
  const defaults = getIndustryDefaults(user?.industryType);
  const rawSchema = (user?.leadFormSchema && Array.isArray(user.leadFormSchema) && user.leadFormSchema.length > 0)
    ? user.leadFormSchema
    : defaults.leadFormSchema;

  const isEditField = (f) => !f.isHidden && !['status', 'followUpDate'].includes(f.fieldId);
  const activeFields = [...rawSchema]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter(isEditField);

  const [values, setValues] = useState(() => {
    const initial = {
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      company: lead.company || '',
      location: lead.location || '',
      profession: lead.profession || '',
      budget: lead.budget || '',
      propertyType: lead.propertyType || '',
      project: lead.project || '',
      projectId: lead.projectId || '',
      tags: Array.isArray(lead.tags) ? lead.tags.join(', ') : (lead.tags || ''),
      service_required: lead.service_required || lead.serviceRequired || '',
      monthly_spend: lead.monthly_spend ?? lead.monthlySpend ?? '',
      goal_timeline: lead.goal_timeline || lead.goalTimeline || '',
    };
    if (lead.customData && typeof lead.customData === 'object') {
      Object.assign(initial, lead.customData);
    }
    return initial;
  });

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/catalogue').then(r => setProjects(r.data?.data || r.data?.colleges || [])).catch(() => {});
  }, []);

  const setVal = (fieldId) => (e) => {
    setValues(v => ({ ...v, [fieldId]: e.target.value }));
  };

  const handleProjectSelect = (e) => {
    const pId = e.target.value;
    if (!pId) {
      setValues(v => ({ ...v, projectId: '', project: '' }));
      return;
    }
    const selected = projects.find(p => p._id === pId);
    setValues(v => ({
      ...v,
      projectId: pId,
      project: selected?.name || '',
      location: v.location || selected?.location || '',
      budget: v.budget || selected?.basePrice || '',
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!values.name?.trim() || !values.phone?.trim()) {
      return toast.error('Name and Phone are required');
    }

    for (const f of activeFields) {
      if (f.isRequired && !values[f.fieldId]?.toString().trim()) {
        return toast.error(`${f.label} is required`);
      }
    }

    setLoading(true);
    try {
      const knownSystem = new Set([
        'name', 'phone', 'email', 'company', 'tags',
        'location', 'profession', 'budget', 'areasOfInterest', 'project',
        'projectId', 'propertyType', 'service_required', 'monthly_spend', 'goal_timeline'
      ]);

      const payload = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email?.trim() || undefined,
        company: values.company?.trim() || undefined,
        location: values.location?.trim() || '',
        profession: values.profession?.trim() || '',
        budget: values.budget?.trim() || '',
        propertyType: values.propertyType || '',
        project: values.project || '',
        projectId: values.projectId || null,
        tags: typeof values.tags === 'string' ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : values.tags,
        service_required: values.service_required || undefined,
        monthly_spend: values.monthly_spend ? Number(values.monthly_spend) : undefined,
        goal_timeline: values.goal_timeline || undefined,
        customData: {},
      };

      for (const [k, v] of Object.entries(values)) {
        if (!knownSystem.has(k) && !['status', 'followUpDate'].includes(k)) {
          payload.customData[k] = v;
        }
      }

      const { data } = await api.put(`/leads/${lead._id}`, payload);
      toast.success('Lead updated successfully ✅');
      onUpdated(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '92vw', maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit2 size={18} color="var(--accent)" /> Edit Lead Details
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Modify original lead creation attributes ({lead.name})
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleUpdate} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeFields.map(field => {
            const isMandatory = field.isRequired || ['name', 'phone'].includes(field.fieldId);
            const currentVal = values[field.fieldId] || '';

            if (field.fieldId === 'projectId') {
              return (
                <div key={field.fieldId}>
                  <label className="label">{field.label} {isMandatory && '*'}</label>
                  <select className="input" value={values.projectId || ''} onChange={handleProjectSelect} required={isMandatory}>
                    <option value="">-- Select Offering / Package (Optional) --</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>{p.name} {p.basePrice ? `(₹${p.basePrice})` : ''}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.fieldType === 'dropdown') {
              return (
                <div key={field.fieldId}>
                  <label className="label">{field.label} {isMandatory && '*'}</label>
                  <select className="input" value={currentVal} onChange={setVal(field.fieldId)} required={isMandatory}>
                    <option value="">-- Select {field.label} --</option>
                    {(field.options || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              );
            }

            const isDateTime = field.fieldType === 'datetime' || field.fieldId === 'followUpDate' || field.fieldId === 'siteVisitDate';
            const inputType = field.fieldType === 'number' ? 'number' : field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : isDateTime ? 'datetime-local' : field.fieldType === 'date' ? 'date' : 'text';

            return (
              <div key={field.fieldId}>
                <label className="label">{field.label} {isMandatory && '*'}</label>
                <input
                  className="input"
                  type={inputType}
                  placeholder={`Enter ${field.label}...`}
                  value={currentVal}
                  onChange={setVal(field.fieldId)}
                  required={isMandatory}
                />
              </div>
            );
          })}

          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ height: 40 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: 40 }}>
              {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Save Changes ✅'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ScheduleFollowUpModal({ lead, onClose, onUpdated }) {
  const [followUpDate, setFollowUpDate] = useState(() => {
    if (lead?.followUpDate) {
      return toLocalDatetimeString(lead.followUpDate);
    }
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return toLocalDatetimeString(tomorrow);
  });
  const [scheduleNote, setScheduleNote] = useState('');
  const [loading, setLoading] = useState(false);

  const applyOffset = (hours) => {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    setFollowUpDate(toLocalDatetimeString(target));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!followUpDate) {
      return toast.error('Please select a follow-up date and time');
    }
    setLoading(true);
    try {
      const isoDate = fromLocalDatetimeStringToISO(followUpDate);
      let res;
      if (lead.followUpDate) {
        res = await api.post(`/leads/${lead._id}/followups/reschedule`, {
          scheduledAt: isoDate,
          reason: scheduleNote.trim() || 'Appointment rescheduled',
        });
      } else {
        res = await api.post(`/leads/${lead._id}/followups`, {
          scheduledAt: isoDate,
          note: scheduleNote.trim() || 'Scheduled follow-up',
        });
      }

      toast.success(res.data?.message || 'Follow-up scheduled successfully ⏰');
      onUpdated(res.data?.lead || { ...lead, followUpDate: isoDate });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '92vw' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color="var(--accent)" /> Schedule Follow-Up
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Set date & time reminder for <strong>{lead.name}</strong> ({lead.phone})
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSave} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label" style={{ fontSize: 11, marginBottom: 6 }}>Quick Presets</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => applyOffset(24)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--surface)' }}>
                +24 Hours
              </button>
              <button type="button" onClick={() => applyOffset(48)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--surface)' }}>
                +48 Hours
              </button>
              <button type="button" onClick={() => applyOffset(72)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--surface)' }}>
                +3 Days
              </button>
              <button type="button" onClick={() => applyOffset(168)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--surface)' }}>
                +1 Week
              </button>
            </div>
          </div>

          <div>
            <label className="label">Follow-Up Date & Time *</label>
            <input
              type="datetime-local"
              className="input"
              value={followUpDate}
              onChange={e => setFollowUpDate(e.target.value)}
              required
              style={{ height: 42, fontSize: 13 }}
            />
          </div>

          <div>
            <label className="label">Scheduled Agenda / Notes (Optional)</label>
            <textarea
              className="input"
              placeholder="e.g. Call client back with custom proposal after team review..."
              value={scheduleNote}
              onChange={e => setScheduleNote(e.target.value)}
              rows={2}
              style={{ padding: '8px 12px', fontSize: 13, resize: 'vertical' }}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ height: 40 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: 40, background: 'var(--accent)' }}>
              {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Set Follow-Up ⏰'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CompleteFollowUpModal({ lead, onClose, onCompleted, onPromptScheduleNext }) {
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const { dismissAlarm } = useAlarm();

  const handleComplete = async (e) => {
    e.preventDefault();
    const cleanNote = noteText.trim();
    if (!cleanNote) {
      return toast.error('Compulsory: Outcome note is required to complete follow-up and clear alarm.');
    }

    setLoading(true);
    try {
      const res = await api.post(`/leads/${lead._id}/followups/complete`, {
        outcomeNote: cleanNote,
      });
      dismissAlarm(lead._id);
      toast.success(res.data?.message || 'Follow-up resolved & outcome note recorded ✅');
      onCompleted(res.data?.lead || lead);
      onClose();

      if (window.confirm('Follow-up marked done! Would you like to schedule the next follow-up now?')) {
        onPromptScheduleNext(lead);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record outcome note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '92vw' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="#10b981" /> Complete Follow-Up
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Record outcome for <strong>{lead.name}</strong> ({lead.phone})
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleComplete} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '10px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10 }}>
            <span style={{ fontSize: 11.5, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              🔒 Note is Compulsory to Clear Alarm & Mark Done
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              Enter what transpired during your call, WhatsApp conversation, or client interaction.
            </p>
          </div>

          <div>
            <label className="label">Interaction / Outcome Note *</label>
            <textarea
              className="input"
              placeholder="e.g. Spoke with client. They requested a 10% discount on Business plan. Scheduling demo for Friday..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              required
              rows={4}
              style={{ padding: '10px 12px', fontSize: 13, resize: 'vertical' }}
              autoFocus
            />
          </div>

          <div className="modal-actions" style={{ marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ height: 40 }}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !noteText.trim()}
              style={{ height: 40, background: '#10b981', borderColor: '#10b981' }}
            >
              {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Resolve Follow-Up ✅'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CancelFollowUpModal({ lead, onClose, onCancelled }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { dismissAlarm } = useAlarm();

  const presets = [
    'Candidate not interested',
    'Joined another college / institution',
    'Requested not to call / Do not disturb',
    'Invalid or unreachable contact number',
  ];

  const handleCancel = async (e) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      return toast.error('A cancellation reason or note is required to stop the follow-up.');
    }

    setLoading(true);
    try {
      const res = await api.post(`/leads/${lead._id}/follow-up/cancel`, {
        reason: cleanReason,
      });
      dismissAlarm(lead._id);
      toast.success(res.data?.message || 'Follow-up stopped & alarms silenced permanently ✅');
      if (onCancelled) onCancelled(res.data?.lead || lead);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to stop follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '92vw' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e11d48' }}>
              <Ban size={18} color="#e11d48" /> Stop Active Follow-Up
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Permanently stop alarms and reminders for <strong>{lead.name}</strong> ({lead.phone})
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleCancel} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '10px 12px', background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: 10 }}>
            <span style={{ fontSize: 11.5, color: '#e11d48', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              🛑 Permanent Alarm & Schedule Cancellation
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              Stopping this follow-up clears upcoming alarms, removes this prospect from due alerts, and logs a permanent cancellation note in the activity trail.
            </p>
          </div>

          <div>
            <label className="label" style={{ fontSize: 11.5, marginBottom: 4 }}>Quick Reasons:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(p)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    height: 'auto',
                    border: reason === p ? '1px solid #e11d48' : '1px solid var(--border)',
                    background: reason === p ? 'rgba(225,29,72,0.08)' : 'var(--surface)',
                    color: reason === p ? '#e11d48' : 'var(--text)',
                    borderRadius: 8,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <label className="label">Cancellation Reason / Explanation Note *</label>
            <textarea
              className="input"
              placeholder="e.g. Spoke with candidate, they took admission elsewhere and asked not to be contacted again..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              rows={3}
              style={{ padding: '10px 12px', fontSize: 13, resize: 'vertical' }}
              autoFocus
            />
          </div>

          <div className="modal-actions" style={{ marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ height: 40 }}>Back</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !reason.trim()}
              style={{ height: 40, background: '#e11d48', borderColor: '#e11d48' }}
            >
              {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Confirm & Stop Follow-Up 🛑'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
