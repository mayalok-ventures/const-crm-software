'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { useAlarm } from '@/lib/AlarmContext';
import {
  Plus, Search, Bell, MessageCircle, Phone, Calendar, Package,
  User, ChevronRight, Filter, X, ShieldAlert, CheckCircle, Volume2, Mic, AlertTriangle, ArrowRight, MapPin, Briefcase,
  Download, Upload, FileSpreadsheet, FileText, ChevronDown, Check, TrendingUp, DollarSign, Award, BarChart2,
  Edit2, Clock, CheckCircle2, RotateCcw, Zap, GraduationCap
} from 'lucide-react';
import { format } from 'date-fns';
import { getIndustryDefaults } from '@/lib/industryTemplates';
import LostReasonModal, { isLostStage, LOST_REASON_OPTIONS } from '@/components/LostReasonModal';
import PlanStatusWidget from '@/components/PlanStatusWidget';
import { SourcePill } from '@/lib/sourceHelper';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';

const STAGE_LABELS = {
  new_lead: '🆕 New Lead',
  contacted: '📞 Contacted',
  not_interested: '❌ Not Interested',
  converted: '🏆 Converted',
  payment_done: '💳 Payment Done',
  // Backward compatibility
  new: '🆕 New Lead',
  closed: '🏆 Converted',
  lost: '❌ Not Interested',
};

const STATUS_COLORS = {
  new_lead: 'badge-new',
  contacted: 'badge-tag',
  not_interested: 'badge-danger',
  converted: 'badge-closed',
  payment_done: 'badge-closed',
  // Backward compatibility
  new: 'badge-new',
  closed: 'badge-closed',
  lost: 'badge-danger',
};

function UpgradeModal({ onClose }) {
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

function ImportLeadsModal({ onClose, onImported }) {
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

function ExportLeadsModal({ onClose, user, statusFilter, projectFilter, search }) {
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

        {/* Anti-Theft / Anti-Churn Policy Notice */}
        <div style={{ padding: '10px 12px', background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <ShieldAlert size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--text)' }}>Anti-Theft Security Policy:</strong> Direct spreadsheet exports may be subject to a 90-day tenure verification gate depending on subscription tier to prevent unauthorized lead poaching.
          </div>
        </div>

        <form onSubmit={handleDownload}>
          {/* Format Selection */}
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

          {/* Status Selection Checklist */}
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

function ExportAnalyticsModal({ onClose, isCompanyOwner }) {
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

function AddLeadModal({ onClose, onCreated, onLimitReached, user }) {
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

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
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

  const rawSchema = (user?.leadFormSchema && Array.isArray(user.leadFormSchema) && user.leadFormSchema.length > 0)
    ? user.leadFormSchema
    : defaults.leadFormSchema;

  // Real-time Conditional Logic Evaluator (dependsOn & showFollowUpOnCreate)
  const isFieldVisible = (field) => {
    if (field.isHidden) return false;
    if (field.fieldId === 'followUpDate' && !showFollowUpOnCreate) return false;
    if (!field.dependsOn || !field.dependsOn.field) return true;
    const parentVal = values[field.dependsOn.field] || '';
    return String(parentVal || '').trim().toLowerCase() === String(field.dependsOn.value || '').trim().toLowerCase();
  };

  const activeFields = [...rawSchema]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter(isFieldVisible);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!values.name?.trim() || !values.phone?.trim()) {
      return toast.error('Name and Phone are required');
    }
    if (showFollowUpOnCreate && !values.followUpDate) {
      return toast.error('Next follow-up date is mandatory');
    }

    // Check lost reason requirement if moving straight to lost
    if (isLostStage(values.status) && !values.lostReason) {
      return toast.error('Please select a Lost Reason for this lost stage');
    }

    // Check active mandatory fields (excluding followUpDate which is governed by showFollowUpOnCreate)
    for (const f of activeFields) {
      if (f.fieldId === 'followUpDate') continue;
      if (f.isRequired && !values[f.fieldId]?.toString().trim()) {
        return toast.error(`${f.label} is required`);
      }
    }

    setLoading(true);
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

      // Populate extra dynamic fields into customData
      for (const [k, v] of Object.entries(values)) {
        if (!knownSystem.has(k) && v !== undefined && v !== '') {
          payload.customData[k] = v;
        }
      }

      const { data } = await api.post('/leads', payload);
      toast.success('Prospect lead created successfully ✅');
      onCreated(data);
      onClose();
    } catch (err) {
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
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
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

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68dvh', overflowY: 'auto', paddingRight: 4 }}>
          {activeFields.map((field) => {
            const isMandatory = ['name', 'phone', 'followUpDate'].includes(field.fieldId) || field.isRequired;
            const currentVal = values[field.fieldId] || '';

            if (field.fieldId === 'projectId') {
              return (
                <div key={field.fieldId}>
                  <label className="label">{field.label} {isMandatory && '*'}</label>
                  <select className="input" value={values.projectId || ''} onChange={handleProjectSelect} required={isMandatory}>
                    <option value="">-- Select Offering / Project (Optional) --</option>
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
                  <select className="input" value={values.status || ''} onChange={setVal('status')} required={isMandatory}>
                    {initialStages.map(s => (
                      <option key={s} value={s}>{STAGE_LABELS[s] || s}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.fieldType === 'dropdown') {
              const options = field.options || [];
              return (
                <div key={field.fieldId}>
                  <label className="label">{field.label} {isMandatory && '*'}</label>
                  <select className="input" value={currentVal} onChange={setVal(field.fieldId)} required={isMandatory}>
                    <option value="">Select {field.label}...</option>
                    {options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.fieldType === 'date') {
              const isDateTime = field.fieldId === 'followUpDate';
              return (
                <div key={field.fieldId}>
                  <label className="label">{field.label} {isMandatory && '*'}</label>
                  <input
                    className="input"
                    type={isDateTime ? 'datetime-local' : 'date'}
                    value={currentVal}
                    onChange={setVal(field.fieldId)}
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
                    onChange={setVal(field.fieldId)}
                    required={isMandatory}
                  />
                </div>
              );
            }

            // Standard text / tel / email
            const inputType = field.fieldId === 'phone' ? 'tel' : (field.fieldId === 'email' ? 'email' : 'text');
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

          {/* Conditional Lost Reason Inputs in Add Lead */}
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
                  onChange={setVal('lostReason')}
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
                  onChange={setVal('lostReasonDetail')}
                  style={{ height: 38, fontSize: 13 }}
                />
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ height: 42 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: 42 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Create Prospect Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STRICT EDIT LEAD MODAL (Only original form creation fields)
// ─────────────────────────────────────────────────────────────
function EditLeadModal({ lead, onClose, onUpdated, user }) {
  const defaults = getIndustryDefaults(user?.industryType);
  const rawSchema = (user?.leadFormSchema && Array.isArray(user.leadFormSchema) && user.leadFormSchema.length > 0)
    ? user.leadFormSchema
    : defaults.leadFormSchema;

  // Strict Isolation: Only fields present in the creation form, excluding status & followUpDate
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
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
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

            const inputType = field.fieldType === 'number' ? 'number' : field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : field.fieldType === 'date' ? 'date' : 'text';

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

// ─────────────────────────────────────────────────────────────
// DEDICATED SCHEDULE FOLLOW-UP MODAL (The Follow-Up Hub)
// ─────────────────────────────────────────────────────────────
function ScheduleFollowUpModal({ lead, onClose, onUpdated }) {
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
      const { data } = await api.put(`/leads/${lead._id}`, {
        followUpDate: isoDate,
        followUpNotified: false,
      });

      if (scheduleNote.trim()) {
        await api.post(`/leads/${lead._id}/notes`, {
          text: `📅 Follow-up scheduled for ${formatDisplayDateTime(isoDate)}: ${scheduleNote.trim()}`,
        });
      }

      toast.success('Follow-up scheduled successfully ⏰');
      onUpdated(data);
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
          {/* Quick Preset Buttons */}
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

// ─────────────────────────────────────────────────────────────
// DEDICATED COMPLETE FOLLOW-UP MODAL (Mandatory Outcome Note)
// ─────────────────────────────────────────────────────────────
function CompleteFollowUpModal({ lead, onClose, onCompleted, onPromptScheduleNext }) {
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
      await api.post(`/leads/${lead._id}/notes`, { text: cleanNote });
      await api.put(`/leads/${lead._id}`, { followUpNotified: true });
      dismissAlarm(lead._id);
      toast.success('Follow-up resolved & outcome note recorded ✅');
      onCompleted(lead);
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

export default function DashboardPage() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState(''); // '' | 'unclaimed' | 'me'
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExportLeadsModal, setShowExportLeadsModal] = useState(false);
  const [showExportAnalyticsModal, setShowExportAnalyticsModal] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [schedulingFollowUpLead, setSchedulingFollowUpLead] = useState(null);
  const [completingFollowUpLead, setCompletingFollowUpLead] = useState(null);
  const [unread, setUnread] = useState(0);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const { dismissAlarm } = useAlarm();

  const isCompanyOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';
  const isSuperAdmin = user?.role === 'superadmin' || user?.isAdmin;

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        setUser(parsed);
      } else {
        router.replace('/login');
        return;
      }
    } catch {} finally {
      setLoadingUser(false);
    }
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, [router]);

  const fetchMetrics = useCallback(async () => {
    try {
      const { data } = await api.get('/analytics');
      setAnalyticsData(data);
    } catch {}
  }, []);

  const fetchLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (projectFilter) params.projectId = projectFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (ownerFilter === 'unclaimed') {
        params.unclaimed = 'true';
      } else if (ownerFilter === 'me' && user?._id) {
        params.assignedTo = user._id;
      }
      const { data } = await api.get('/leads', { params });
      setLeads(data.leads);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load leads');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, statusFilter, projectFilter, sourceFilter, ownerFilter, page, user]);

  useEffect(() => {
    fetchLeads(false);
    fetchMetrics();
  }, [fetchLeads, fetchMetrics]);

  useEffect(() => {
    api.get('/leads/follow-ups/today').then(r => setFollowUps(r.data)).catch(() => {});
    api.get('/notifications').then(r => setUnread(r.data.unreadCount || 0)).catch(() => {});
  }, []);

  const [eventPipelineMode, setEventPipelineMode] = useState('stall'); // 'stall' | 'corporate'
  const isEventManagement = String(user?.industryType || '').toLowerCase().includes('event');

  const availableStages = (() => {
    if (isEventManagement) {
      if (eventPipelineMode === 'corporate') {
        return ['Prospecting', 'Pitch Deck Sent', 'Meeting Scheduled', 'Custom Proposal Sent', 'Contract Signed'];
      }
      return ['Lead Captured', 'Floor Plan Shared', 'Stall Blocked', 'Quotation Sent', 'Advance Paid', 'Onboarded'];
    }
    if (user?.customPipelineStages && user.customPipelineStages.length > 0) return user.customPipelineStages;
    if (user?.pipelineStages && user.pipelineStages.length > 0) return user.pipelineStages;
    const defaults = getIndustryDefaults(user?.industryType);
    return defaults.pipelineStages;
  })();

  const isFreePlan = user?.plan === 'free';
  const leadLimitReached = isFreePlan && (pagination.total >= 10);

  const industryDefaults = getIndustryDefaults(user?.industryType);
  const availableStatuses = (user?.pipelineStages && Array.isArray(user.pipelineStages) && user.pipelineStages.length > 0)
    ? user.pipelineStages
    : ((user?.customPipelineStages && Array.isArray(user.customPipelineStages) && user.customPipelineStages.length > 0)
      ? user.customPipelineStages
      : (industryDefaults?.pipelineStages || ['new_lead', 'contacted', 'not_interested', 'converted', 'payment_done']));

  if (loadingUser || user?.role === 'superadmin' || user?.isAdmin) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          {/* Top Row: Title + Plan Status & Notifications */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
            <div>
              <h1 className="page-title" style={{ fontSize: 'clamp(17px, 4vw, 22px)' }}>Sales Pipeline & Leads</h1>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)' }}>
                Active prospects ({pagination.total || leads.length})
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {/* Dynamic Plan & Upgrade Widget */}
              <PlanStatusWidget />

              {/* Notification Bell */}
              <Link href="/notifications" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none' }}>
                <Bell size={16} />
                {unread > 0 && <div className="notif-badge" />}
              </Link>
            </div>
          </div>

          {/* Bottom Row: Mobile Horizontal Scrollable Quick Action Strip */}
          <div className="action-strip">
            <button
              onClick={() => {
                if (leadLimitReached) setShowUpgrade(true);
                else setShowAdd(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ gap: 4, borderRadius: 8, flexShrink: 0 }}
            >
              <Plus size={14} /> Add Lead
            </button>

            <button
              onClick={() => setShowImport(true)}
              className="btn btn-secondary btn-sm"
              style={{ gap: 4, borderRadius: 8, flexShrink: 0 }}
              title="Bulk Import Leads"
            >
              <Upload size={13} /> Import
            </button>

            <button
              onClick={() => setShowExportLeadsModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ gap: 4, borderRadius: 8, flexShrink: 0 }}
              title="Selective Lead Export"
            >
              <Download size={13} /> Export
            </button>

            <Link href="/integrations" className="btn btn-secondary btn-sm" style={{ gap: 4, borderRadius: 8, flexShrink: 0, color: '#2563eb', borderColor: 'rgba(37,99,235,0.3)' }} title="Meta & Google Ads Integrations">
              <Zap size={13} /> Ads & APIs
            </Link>

            <button
              onClick={() => setShowExportAnalyticsModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ gap: 4, borderRadius: 8, flexShrink: 0, color: 'var(--accent)', borderColor: 'var(--accent)' }}
              title="Analytics Report"
            >
              <BarChart2 size={13} /> Analytics
            </button>

            {String(user?.industryType || '').trim().toLowerCase() === 'education' ? (
              <Link href="/catalogue" className="btn btn-secondary btn-sm" style={{ gap: 4, borderRadius: 8, flexShrink: 0 }}>
                <GraduationCap size={13} /> Colleges & Courses
              </Link>
            ) : (
              <Link href="/projects" className="btn btn-secondary btn-sm" style={{ gap: 4, borderRadius: 8, flexShrink: 0 }}>
                <Package size={13} /> Catalog
              </Link>
            )}
          </div>
        </div>

        <div className="page-content">
          {/* SuperAdmin Quick Switcher Banner */}
          {isSuperAdmin && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.06) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 14,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>👑</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.02em' }}>
                    ADMIN ACCESS ACTIVE
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    You have full platform admin control. Open the Admin Panel anytime.
                  </div>
                </div>
              </div>
              <Link
                href="/admin"
                className="btn btn-primary"
                style={{
                  background: '#f59e0b',
                  borderColor: '#f59e0b',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: 12,
                  padding: '6px 14px',
                  borderRadius: 8,
                }}
              >
                Open Admin Panel ⚡
              </Link>
            </div>
          )}

          {/* Master Revenue & Performance KPI Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(79,70,229,0.1) 0%, rgba(34,197,94,0.1) 100%)',
            border: '1px solid rgba(79,70,229,0.2)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 16,
          }}>
            <div className="kpi-grid-mobile" style={{ alignItems: 'center' }}>
              {/* Total Revenue Generated Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 8px rgba(16,185,129,0.3)',
                  flexShrink: 0
                }}>
                  <Award size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#10b981', letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Revenue Won
                  </p>
                  <h3 style={{ margin: '1px 0 0', fontSize: 'clamp(15px, 3.5vw, 19px)', fontWeight: 800, color: 'var(--text)' }}>
                    {user?.localization?.currencySymbol || '₹'}{Number(analyticsData?.totalRevenue || 0).toLocaleString()}
                  </h3>
                </div>
              </div>

              {/* Conversion Rate */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 8px rgba(79,70,229,0.3)',
                  flexShrink: 0
                }}>
                  <TrendingUp size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Win Rate
                  </p>
                  <h3 style={{ margin: '1px 0 0', fontSize: 'clamp(15px, 3.5vw, 19px)', fontWeight: 800, color: 'var(--text)' }}>
                    {analyticsData?.conversionRate || 0}%
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Follow-ups / Scheduled Meetings */}
          {followUps.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p className="section-title" style={{ margin: '0 0 8px' }}>📅 Today's Actions & Scheduled Demos ({followUps.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {followUps.map(lead => (
                  <Link key={lead._id} href={`/leads/${lead._id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 12 }}>
                      <Calendar size={18} color="#f97316" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.name} {lead.project ? `• ${lead.project}` : ''}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>+{lead.phone}</p>
                      </div>
                      <span className={`badge ${STATUS_COLORS[lead.status] || 'badge-tag'}`} style={{ fontSize: 10 }}>
                        {STAGE_LABELS[lead.status] || lead.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, width: '100%' }}>
            <div className="search-bar" style={{ flex: '1 1 200px', minWidth: 160, position: 'relative' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 13 }} />
              <input
                className="input"
                type="search"
                placeholder="Search leads by name, phone, package..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: 36, height: 42, fontSize: 13, borderRadius: 10 }}
              />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>}
            </div>

            <select
              value={ownerFilter}
              onChange={e => { setOwnerFilter(e.target.value); setPage(1); }}
              className="input"
              style={{ flex: '1 1 140px', minWidth: 130, height: 42, fontSize: 12, borderRadius: 10 }}
            >
              <option value="">All Pipeline Leads</option>
              <option value="me">Owned by Me</option>
              <option value="unclaimed">Unclaimed Pool</option>
            </select>

            <select
              value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
              className="input"
              style={{ flex: '1 1 140px', minWidth: 130, height: 42, fontSize: 12, borderRadius: 10 }}
            >
              <option value="">All Sources</option>
              <option value="meta">Meta Ads</option>
              <option value="google">Google Ads</option>
              <option value="website">Organic / Web</option>
              <option value="referral">Referral</option>
              <option value="import">Import / CSV</option>
              <option value="direct">Direct / Manual</option>
            </select>

            {projects.length > 0 && (
              <select
                value={projectFilter}
                onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
                className="input"
                style={{ flex: '1 1 140px', minWidth: 130, height: 42, fontSize: 12, borderRadius: 10 }}
              >
                <option value="">All Packages</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Event Management Dual Pipeline Switcher */}
          {isEventManagement && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: 'var(--surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => { setEventPipelineMode('stall'); setStatusFilter(''); setPage(1); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: eventPipelineMode === 'stall' ? 'var(--accent)' : 'transparent',
                  color: eventPipelineMode === 'stall' ? 'white' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                🏢 Stall Booking Pipeline
              </button>
              <button
                type="button"
                onClick={() => { setEventPipelineMode('corporate'); setStatusFilter(''); setPage(1); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: eventPipelineMode === 'corporate' ? '#9333ea' : 'transparent',
                  color: eventPipelineMode === 'corporate' ? 'white' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                🤝 Corporate Sponsorship Pipeline
              </button>
            </div>
          )}

          {/* Pipeline Stage Filter Chips */}
          <div className="filter-chips" style={{ marginBottom: 20 }}>
            <button className={`chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => { setStatusFilter(''); setPage(1); }}>
              All Stages ({pagination.total || leads.length})
            </button>
            {availableStages.map(stage => (
              <button
                key={stage}
                className={`chip ${statusFilter === stage ? 'active' : ''}`}
                onClick={() => { setStatusFilter(stage); setPage(1); }}
              >
                {STAGE_LABELS[stage] || stage}
              </button>
            ))}
          </div>

          {/* Leads Listing */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
          ) : leads.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No client leads found</h3>
              <p>Add your first prospect, import a spreadsheet, or adjust filters.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
                <button onClick={() => setShowAdd(true)} className="btn btn-primary">Add Lead</button>
                <button onClick={() => setShowImport(true)} className="btn btn-secondary">Import Spreadsheet</button>
              </div>
            </div>
          ) : (
            <div className="leads-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {leads.map(lead => (
                <div
                  key={lead._id}
                  onClick={() => router.push(`/leads/${lead._id}`)}
                  style={{ textDecoration: 'none', display: 'block', width: '100%', cursor: 'pointer' }}
                >
                  <div className="lead-card">
                    {/* Header Row: Lead Name + Source Badge + Stage Dropdown */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, width: '100%', minWidth: 0, marginBottom: 6 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <h3 className="lead-name truncate" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                            {lead.name}
                          </h3>
                          <SourcePill lead={lead} showDetail={false} />
                        </div>
                        <p className="truncate" style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                          +{lead.phone} {lead.company ? `• ${lead.company}` : ''}
                        </p>
                      </div>

                      <select
                        value={lead.status}
                        onClick={e => e.stopPropagation()}
                        onChange={async (e) => {
                          e.stopPropagation();
                          const newStatus = e.target.value;
                          const isConverting = ['converted', 'payment_done', 'closed', 'Closed', 'Closed / Won'].includes(newStatus);
                          let paymentAmount = null;
                          let paymentMethod = null;
                          if (isConverting) {
                            const inputAmt = window.prompt("🏆 Enter Final Closed Deal / Payment Amount (₹):");
                            if (!inputAmt) return;
                            paymentAmount = Number(inputAmt);
                            if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
                              return toast.error("Payment amount (> 0) is required to convert a lead.");
                            }
                            const inputMethod = window.prompt("💳 Enter Payment Method (e.g. bank_transfer, upi, cash, card):", "bank_transfer");
                            if (!inputMethod || !inputMethod.trim()) {
                              return toast.error("Payment method is required to convert a lead.");
                            }
                            paymentMethod = inputMethod.trim();
                          }
                          try {
                            await api.put(`/leads/${lead._id}`, {
                              status: newStatus,
                              paymentAmount,
                              paymentMethod
                            });
                            toast.success(`Lead stage updated to "${STAGE_LABELS[newStatus] || newStatus}" ✅`);
                            fetchLeads(true);
                          } catch (err) {
                            toast.error(err.response?.data?.message || 'Failed to update stage');
                          }
                        }}
                        className={`badge ${STATUS_COLORS[lead.status] || 'badge-tag'} flex-shrink-0`}
                        style={{
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          fontSize: 11,
                          fontWeight: 700,
                          outline: 'none',
                          maxWidth: '140px'
                        }}
                      >
                        {availableStages.map(st => (
                          <option key={st} value={st} style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {STAGE_LABELS[st] || st}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Metadata & Attribution Strip */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0', width: '100%', minWidth: 0 }}>
                      <SourcePill lead={lead} showDetail={true} />
                      {lead.project && (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface)', borderRadius: 4, color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0 }}>
                          📦 {lead.project}
                        </span>
                      )}
                      {lead.budget && (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(34,197,94,0.1)', borderRadius: 4, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>
                          💰 {lead.budget}
                        </span>
                      )}
                      {lead.closedDealAmount && (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(16,185,129,0.15)', borderRadius: 4, color: '#10b981', fontWeight: 700, flexShrink: 0 }}>
                          🏆 Won: ₹{Number(lead.closedDealAmount).toLocaleString('en-IN')}
                        </span>
                      )}
                      {lead.location && (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface)', borderRadius: 4, color: 'var(--text-muted)', flexShrink: 0 }}>
                          📍 {lead.location}
                        </span>
                      )}
                      {lead.assignedToName ? (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(99,102,241,0.1)', borderRadius: 4, color: 'var(--accent)', fontWeight: 500, flexShrink: 0 }}>
                          👤 {lead.assignedToName}
                        </span>
                      ) : (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', borderRadius: 4, color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>
                          🌐 Common Pool
                        </span>
                      )}
                      {(lead.serviceRequired || lead.service_required) && (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(16,185,129,0.1)', borderRadius: 4, color: '#10b981', fontWeight: 600, flexShrink: 0 }}>
                          📦 {lead.service_required?.replace(/_/g, ' ') || 'Smart Solo'}
                        </span>
                      )}

                      {/* Event Management Credentials Strip */}
                      {lead.customData?.stallInventoryLock?.isLocked && (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(99,102,241,0.15)', borderRadius: 4, color: '#818cf8', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)', flexShrink: 0 }}>
                          🔒 Stall Locked ({lead.customData.stallInventoryLock.lockCode})
                        </span>
                      )}
                      {lead.customData?.eventPass?.passCode && (
                        <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(16,185,129,0.15)', borderRadius: 4, color: '#34d399', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)', flexShrink: 0 }}>
                          🎟️ Pass Issued ({lead.customData.eventPass.passCode})
                        </span>
                      )}
                    </div>

                    {lead.followUpDate && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, width: '100%' }}>
                        <p className="truncate" style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                          <Calendar size={12} className="flex-shrink-0" />
                          <span className="truncate">Next Follow-up: {format(new Date(lead.followUpDate), 'dd MMM yyyy, h:mm a')}</span>
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSchedulingFollowUpLead(lead);
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '1px 6px', fontSize: 10, height: 22, color: 'var(--accent)', gap: 3, flexShrink: 0 }}
                          title="Edit Follow-up Schedule & Agenda"
                        >
                          <Edit2 size={10} /> Edit
                        </button>
                      </div>
                    )}

                    {/* Mobile-First Responsive Action Grid: Row 1 (Call & WA) + Row 2 (FollowUp, Note, Edit) */}
                    <div className="lead-card-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                        <a
                          href={`tel:${lead.phone}`}
                          className="lead-action-btn lead-action-call"
                          style={{ flex: 1, minWidth: 0, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            api.post(`/leads/${lead._id}/track-call`).then(() => fetchLeads(true)).catch(() => {});
                          }}
                        >
                          <Phone size={13} className="flex-shrink-0" /> Call
                        </a>
                        <a
                          href={waLink(lead.phone, `Hello ${lead.name}, regarding your inquiry for ${lead.project || 'our subscription plans'}...`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="lead-action-btn lead-action-wa"
                          style={{ flex: 1, minWidth: 0, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            api.post(`/leads/${lead._id}/track-message`).then(() => fetchLeads(true)).catch(() => {});
                          }}
                        >
                          <MessageCircle size={13} className="flex-shrink-0" /> WhatsApp
                        </a>
                      </div>

                      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                        <button
                          type="button"
                          className="lead-action-btn"
                          style={{ flex: 1, minWidth: 0, height: 32, fontSize: 11.5, background: 'rgba(59,130,246,0.08)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSchedulingFollowUpLead(lead);
                          }}
                          title="Schedule or reschedule follow-up"
                        >
                          <Calendar size={12} className="flex-shrink-0" /> Follow-Up
                        </button>
                        <button
                          type="button"
                          className="lead-action-btn"
                          style={{ flex: 1, minWidth: 0, height: 32, fontSize: 11.5, background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompletingFollowUpLead(lead);
                          }}
                          title="Complete follow-up with mandatory outcome note"
                        >
                          <CheckCircle size={12} className="flex-shrink-0" /> Note / Done
                        </button>
                        <button
                          type="button"
                          className="lead-action-btn"
                          style={{ flex: 1, minWidth: 0, height: 32, fontSize: 11.5, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLead(lead);
                          }}
                          title="Edit original lead creation fields"
                        >
                          <Edit2 size={12} className="flex-shrink-0" /> Edit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--text-muted)' }}>
                Page {page} of {pagination.pages}
              </span>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Add Lead Button */}
      <button
        className="fab fab-right"
        onClick={() => {
          if (leadLimitReached) {
            setShowUpgrade(true);
          } else {
            setShowAdd(true);
          }
        }}
        aria-label="Add lead"
      >
        <Plus size={24} />
      </button>

      {showAdd && (
        <AddLeadModal
          user={user}
          onClose={() => setShowAdd(false)}
          onCreated={l => { setLeads(prev => [l, ...prev]); fetchLeads(true); fetchMetrics(); }}
          onLimitReached={() => setShowUpgrade(true)}
        />
      )}

      {showImport && (
        <ImportLeadsModal
          onClose={() => setShowImport(false)}
          onImported={() => { fetchLeads(false); fetchMetrics(); }}
        />
      )}

      {showExportLeadsModal && (
        <ExportLeadsModal
          user={user}
          statusFilter={statusFilter}
          projectFilter={projectFilter}
          search={search}
          onClose={() => setShowExportLeadsModal(false)}
        />
      )}

      {showExportAnalyticsModal && (
        <ExportAnalyticsModal
          isCompanyOwner={isCompanyOwner}
          onClose={() => setShowExportAnalyticsModal(false)}
        />
      )}

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      {editingLead && (
        <EditLeadModal
          lead={editingLead}
          user={user}
          onClose={() => setEditingLead(null)}
          onUpdated={() => fetchLeads(true)}
        />
      )}

      {schedulingFollowUpLead && (
        <ScheduleFollowUpModal
          lead={schedulingFollowUpLead}
          onClose={() => setSchedulingFollowUpLead(null)}
          onUpdated={() => fetchLeads(true)}
        />
      )}

      {completingFollowUpLead && (
        <CompleteFollowUpModal
          lead={completingFollowUpLead}
          onClose={() => setCompletingFollowUpLead(null)}
          onCompleted={() => fetchLeads(true)}
          onPromptScheduleNext={(ld) => setSchedulingFollowUpLead(ld)}
        />
      )}

      <BottomNav active="dashboard" />
    </div>
  );
}
