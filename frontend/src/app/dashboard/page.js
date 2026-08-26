'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, isOwner, isManager, isAgent } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { useAlarm } from '@/lib/AlarmContext';
import {
  Plus, Search, Bell, MessageCircle, Phone, Calendar, Package,
  User, Users, Home, ChevronRight, Filter, X, ShieldAlert, CheckCircle, Volume2, Mic, AlertTriangle, ArrowRight, MapPin, Briefcase,
  Download, Upload, FileSpreadsheet, FileText, ChevronDown, Check, TrendingUp, DollarSign, Award, BarChart2,
  Edit2, Clock, CheckCircle2, RotateCcw, Zap, GraduationCap
} from 'lucide-react';
import { format } from 'date-fns';
import { getIndustryDefaults } from '@/lib/industryTemplates';
import LostReasonModal, { isLostStage, LOST_REASON_OPTIONS } from '@/components/LostReasonModal';
import PlanStatusWidget from '@/components/PlanStatusWidget';
import { SourcePill } from '@/lib/sourceHelper';
import { toLocalDatetimeString, fromLocalDatetimeStringToISO, formatDisplayDateTime } from '@/lib/dateUtils';
import DynamicFormRenderer, { isFieldVisible as evaluateFieldVisible, isFieldRequired as evaluateFieldRequired } from '@/components/common/DynamicFormRenderer';

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
  const [schema, setSchema] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
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

  // Filter out followUpDate if showFollowUpOnCreate is disabled
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

    // Dynamic Schema Validation based on owner-configured field requirements
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

    // Check lost reason requirement if moving straight to lost
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

      // Populate extra dynamic fields into customData & top level for validator
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
          {/* Dynamic Form Layout */}
          <DynamicFormRenderer
            schema={filteredSchema}
            values={values}
            onChange={handleFieldChange}
            errors={formErrors}
            theme="light"
            gridCols={2}
          />

          {/* Offering / Project Link (Optional) */}
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
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateTab = () => {
        const params = new URLSearchParams(window.location.search);
        setActiveTab(params.get('tab') || 'overview');
      };
      updateTab();
      window.addEventListener('popstate', updateTab);
      return () => window.removeEventListener('popstate', updateTab);
    }
  }, []);

  const [unclaimedLeads, setUnclaimedLeads] = useState([]);
  const [loadingUnclaimed, setLoadingUnclaimed] = useState(false);
  const [allFollowUps, setAllFollowUps] = useState([]);
  const [fuSubTab, setFuSubTab] = useState('today');
  const [svSubTab, setSvSubTab] = useState('scheduled');

  const isTenantAgent = isAgent(user);
  const isTenantManager = isManager(user);
  const isTenantOwner = isOwner(user) || user?.role === 'superadmin';

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed.role === 'superadmin') {
          router.replace('/superadmin-dashboard');
          return;
        }
        setUser(parsed);
      } else {
        router.replace('/login');
        return;
      }
    } catch {} finally {
      setLoadingUser(false);
    }
    // Handle integration callback query parameters
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const integration = params.get('integration');
      if (integration === 'meta_success') {
        toast.success('Meta Ads account connected successfully! 🔵');
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (integration === 'meta_error') {
        const errorMsg = params.get('message') || 'Connection failed';
        toast.error(`Meta Ads connection failed: ${errorMsg}`);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (integration === 'google_success') {
        toast.success('Google Ads account connected successfully! 🔴');
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (integration === 'google_error') {
        const errorMsg = params.get('message') || 'Connection failed';
        toast.error(`Google Ads connection failed: ${errorMsg}`);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, [router]);

  const [reAnalytics, setReAnalytics] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const { data } = await api.get('/analytics');
      setAnalyticsData(data);
    } catch {}
    if (String(user?.industryType || '').toLowerCase() === 'real estate') {
      try {
        const { data } = await api.get('/real-estate/analytics/summary');
        if (data?.success) setReAnalytics(data.data);
      } catch {}
    }
  }, [user]);

  const fetchLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page: Math.max(1, parseInt(page, 10) || 1), limit: 30 };
      if (search && search.trim()) params.search = search.trim();
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (projectFilter && projectFilter !== 'all' && projectFilter !== 'undefined') params.projectId = projectFilter;
      if (sourceFilter && sourceFilter !== 'all') params.source = sourceFilter;
      if (ownerFilter === 'unclaimed') {
        params.unclaimed = 'true';
      } else if (ownerFilter === 'me' && user?._id) {
        params.assignedTo = user._id;
      }
      const { data } = await api.get('/leads', { params });
      setLeads(data?.leads || []);
      setPagination(data?.pagination || {});
    } catch (err) {
      console.error('Fetch leads error:', err);
      toast.error('Failed to load leads');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, statusFilter, projectFilter, sourceFilter, ownerFilter, page, user]);

  const fetchUnclaimedLeads = useCallback(async () => {
    setLoadingUnclaimed(true);
    try {
      const { data } = await api.get('/leads', { params: { unclaimed: 'true', limit: 50 } });
      setUnclaimedLeads(data?.leads || []);
    } catch {
      setUnclaimedLeads([]);
    } finally {
      setLoadingUnclaimed(false);
    }
  }, []);

  const handleClaimLead = async (leadId) => {
    try {
      toast.loading('Claiming lead...', { id: 'claim-toast' });
      await api.put(`/leads/${leadId}/reassign`, {
        toAgentId: user?._id,
        reason: 'Claimed by Agent from common pool',
      });
      toast.success('Lead claimed and added to your pipeline! 🎯', { id: 'claim-toast' });
      fetchLeads(true);
      fetchMetrics();
      fetchUnclaimedLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to claim lead', { id: 'claim-toast' });
    }
  };

  const fetchAllFollowUps = useCallback(async () => {
    try {
      const [todayRes, dueRes] = await Promise.allSettled([
        api.get('/leads/follow-ups/today'),
        api.get('/leads/follow-ups/due'),
      ]);
      const todayData = todayRes.status === 'fulfilled' ? (todayRes.value.data || []) : [];
      const dueData = dueRes.status === 'fulfilled' ? (dueRes.value.data || []) : [];
      setFollowUps(todayData);
      setAllFollowUps([...todayData, ...dueData]);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLeads(false);
    fetchMetrics();
    fetchUnclaimedLeads();
    fetchAllFollowUps();
    api.get('/notifications').then(r => setUnread(r.data.unreadCount || 0)).catch(() => {});
  }, [fetchLeads, fetchMetrics, fetchUnclaimedLeads, fetchAllFollowUps]);

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

  if (loadingUser) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const pageTitle = (() => {
    if (activeTab === 'unclaimed') return 'New / Unclaimed Leads Pool';
    if (activeTab === 'my_leads') return 'My Leads Pipeline';
    if (activeTab === 'follow_ups') return 'Follow-ups & Action Schedule';
    if (activeTab === 'pipeline') return 'Sales Pipeline Stages';
    if (activeTab === 'deals') return 'Deals & Opportunities';
    if (activeTab === 'site_visits') return 'Site Visits & Property Tours';
    if (isTenantAgent) return 'Agent Dashboard';
    return 'Sales Pipeline & Leads';
  })();

  const pageSubtitle = (() => {
    if (activeTab === 'unclaimed') return `Available unassigned prospects (${unclaimedLeads.length}) ready to claim`;
    if (activeTab === 'my_leads') return `Active assigned prospects (${pagination.total || leads.length})`;
    if (activeTab === 'follow_ups') return `Scheduled demos, client calls & follow-ups (${followUps.length} today)`;
    if (activeTab === 'pipeline') return 'Visual stage-by-stage conversion workflow';
    if (activeTab === 'deals') return `Closed revenue and active negotiation deals (${analyticsData?.byStatus?.closed || 0} won)`;
    if (activeTab === 'site_visits') return 'Scheduled client property visits and outcome logs';
    if (isTenantAgent) return 'Welcome to your daily sales operational workspace';
    return `Active prospects (${pagination.total || leads.length})`;
  })();

  const getGreeting = (name) => {
    const hour = new Date().getHours();
    let timeStr = 'Good morning';
    if (hour >= 12 && hour < 17) timeStr = 'Good afternoon';
    else if (hour >= 17) timeStr = 'Good evening';
    return `${timeStr}, ${name || 'Agent'}! 👋`;
  };

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          {/* Top Row: Title + Plan Status & Notifications */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
            <div>
              <h1 className="page-title" style={{ fontSize: 'clamp(17px, 4vw, 22px)' }}>
                {pageTitle}
              </h1>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)' }}>
                {pageSubtitle}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {/* Dynamic Plan & Upgrade Widget (Only for Tenant Owners) */}
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

            {/* Ads & Lead Integrations (Strictly for Tenant Owners) */}
            {isTenantOwner && (
              <Link href="/integrations" className="btn btn-secondary btn-sm" style={{ gap: 4, borderRadius: 8, flexShrink: 0, color: '#2563eb', borderColor: 'rgba(37,99,235,0.3)' }} title="Meta & Google Ads Integrations">
                <Zap size={13} /> Ads & APIs
              </Link>
            )}

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

          {/* Sub-tab Navigation Bar for Agents */}
          {isTenantAgent && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 4,
                scrollbarWidth: 'none',
                marginTop: 6,
                borderTop: '1px solid var(--border)',
                paddingTop: 8,
              }}
            >
              {[
                { id: 'overview', label: 'Dashboard', icon: Home, href: '/dashboard' },
                { id: 'unclaimed', label: 'New / Unclaimed', icon: Plus, badge: unclaimedLeads.length || null, href: '/dashboard?tab=unclaimed' },
                { id: 'my_leads', label: 'My Leads', icon: Users, badge: pagination.total || leads.length, href: '/dashboard?tab=my_leads' },
                { id: 'follow_ups', label: 'Follow-ups', icon: Calendar, badge: followUps.length || null, href: '/dashboard?tab=follow_ups' },
                { id: 'pipeline', label: 'Pipeline', icon: TrendingUp, href: '/dashboard?tab=pipeline' },
                { id: 'deals', label: 'Deals', icon: Award, href: '/dashboard?tab=deals' },
                { id: 'site_visits', label: 'Site Visits', icon: MapPin, href: '/dashboard?tab=site_visits' },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      background: isActive ? 'var(--accent)' : 'var(--surface)',
                      color: isActive ? '#ffffff' : 'var(--text)',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    <TabIcon size={14} color={isActive ? '#ffffff' : 'currentColor'} />
                    <span>{tab.label}</span>
                    {tab.badge !== null && tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(79,70,229,0.12)',
                          color: isActive ? '#ffffff' : 'var(--accent)',
                        }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="page-content">
          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 1: AGENT DASHBOARD (OVERVIEW HOME)                        */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Welcome & Agent Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(99,102,241,0.04) 100%)',
                border: '1px solid rgba(79,70,229,0.18)',
                borderRadius: 16,
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                      {getGreeting(user?.name)}
                    </h2>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}>
                      ● Active Agent Workspace
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Here is your real-time pipeline status, scheduled follow-ups, and lead pool for today.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, borderRadius: 10, fontSize: 12 }}
                  >
                    <Plus size={14} /> Add Prospect
                  </button>
                  <Link
                    href="/dashboard?tab=unclaimed"
                    className="btn btn-secondary btn-sm"
                    style={{ gap: 6, borderRadius: 10, fontSize: 12, color: 'var(--accent)', borderColor: 'rgba(79,70,229,0.3)' }}
                  >
                    Claim Leads ({unclaimedLeads.length})
                  </Link>
                </div>
              </div>

              {/* 4 Top KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {/* 1. My Leads */}
                <Link href="/dashboard?tab=my_leads" style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px', transition: 'all 0.15s ease' }} className="hover:border-indigo-500">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>My Leads</span>
                      <Users size={16} color="var(--accent)" />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>
                      {pagination.total || leads.length}
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600 }}>Active in pipeline →</span>
                  </div>
                </Link>

                {/* 2. Follow-ups Today */}
                <Link href="/dashboard?tab=follow_ups" style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 14, padding: '14px', transition: 'all 0.15s ease' }} className="hover:border-orange-500">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#c2410c', textTransform: 'uppercase' }}>Follow-ups</span>
                      <Calendar size={16} color="#ea580c" />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#9a3412' }}>
                      {followUps.length}
                    </div>
                    <span style={{ fontSize: 10.5, color: '#c2410c', fontWeight: 600 }}>Scheduled today →</span>
                  </div>
                </Link>

                {/* 3. Site Visits */}
                <Link href="/dashboard?tab=site_visits" style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, padding: '14px', transition: 'all 0.15s ease' }} className="hover:border-purple-500">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase' }}>Site Visits</span>
                      <MapPin size={16} color="#7c3aed" />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#5b21b6' }}>
                      {reAnalytics?.siteVisits?.total || (followUps.filter(f => f.type === 'site_visit').length)}
                    </div>
                    <span style={{ fontSize: 10.5, color: '#6d28d9', fontWeight: 600 }}>Property tours →</span>
                  </div>
                </Link>

                {/* 4. Deals Won */}
                <Link href="/dashboard?tab=deals" style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 14, padding: '14px', transition: 'all 0.15s ease' }} className="hover:border-emerald-500">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>Deals Won</span>
                      <Award size={16} color="#059669" />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#065f46' }}>
                      {analyticsData?.byStatus?.closed || 0}
                    </div>
                    <span style={{ fontSize: 10.5, color: '#047857', fontWeight: 600 }}>Closed revenue →</span>
                  </div>
                </Link>
              </div>

              {/* 2-Column Responsive Dashboard Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {/* Left Column: Unclaimed Leads Preview + Today's Follow-up Schedule */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* NEW / UNCLAIMED LEADS WIDGET */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(79,70,229,0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={16} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>New / Unclaimed Leads ({unclaimedLeads.length})</h3>
                      </div>
                      <Link href="/dashboard?tab=unclaimed" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
                        View All →
                      </Link>
                    </div>

                    {loadingUnclaimed ? (
                      <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner" style={{ width: 20, height: 20 }} /></div>
                    ) : unclaimedLeads.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        No unclaimed leads in common pool right now.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {unclaimedLeads.slice(0, 4).map(lead => (
                          <div key={lead._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }} className="truncate">{lead.name}</span>
                                <SourcePill lead={lead} showDetail={false} />
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{lead.phone}</span>
                            </div>
                            <button
                              onClick={() => handleClaimLead(lead._id)}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 10px', fontSize: 11, borderRadius: 8, gap: 4 }}
                            >
                              Claim Lead 🎯
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* TODAY'S SCHEDULE WIDGET */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(249,115,22,0.12)', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Calendar size={16} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Today's Follow-ups ({followUps.length})</h3>
                      </div>
                      <Link href="/dashboard?tab=follow_ups" style={{ fontSize: 11.5, fontWeight: 700, color: '#ea580c', textDecoration: 'none' }}>
                        Manage →
                      </Link>
                    </div>

                    {followUps.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        No follow-ups due today. You're completely up to date! 🎉
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {followUps.slice(0, 4).map(lead => (
                          <div key={lead._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }} className="truncate">{lead.name}</span>
                                <span className={`badge ${STATUS_COLORS[lead.status] || 'badge-tag'}`} style={{ fontSize: 9.5, padding: '1px 5px' }}>
                                  {STAGE_LABELS[lead.status] || lead.status}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{lead.phone}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <a href={`tel:${lead.phone}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', borderRadius: 8, color: '#059669' }}>
                                <Phone size={13} />
                              </a>
                              <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', borderRadius: 8, color: '#16a34a' }}>
                                <MessageCircle size={13} />
                              </a>
                              <button
                                onClick={() => setCompletingFollowUpLead(lead)}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 8px', fontSize: 11, borderRadius: 8 }}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Pipeline Stage Distribution + Performance Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* MY PIPELINE SUMMARY */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TrendingUp size={16} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>My Pipeline Stages</h3>
                      </div>
                      <Link href="/dashboard?tab=pipeline" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
                        View Pipeline →
                      </Link>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {availableStages.map(st => {
                        const count = leads.filter(l => l.status === st).length;
                        const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                        return (
                          <div key={st} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{STAGE_LABELS[st] || st}</span>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{count} leads ({pct}%)</span>
                            </div>
                            <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* MY PERFORMANCE SUMMARY */}
                  <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.03) 100%)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Award size={16} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#065f46' }}>My Sales Performance</h3>
                      </div>
                      <Link href="/analytics" style={{ fontSize: 11.5, fontWeight: 700, color: '#059669', textDecoration: 'none' }}>
                        Full Analytics →
                      </Link>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#ffffff', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '10px 12px' }}>
                        <span style={{ fontSize: 10.5, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Closed Revenue</span>
                        <div style={{ fontSize: 17, fontWeight: 900, color: '#065f46', marginTop: 2 }}>
                          {user?.localization?.currencySymbol || '₹'}{Number(analyticsData?.totalRevenue || 0).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '10px 12px' }}>
                        <span style={{ fontSize: 10.5, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Win Rate</span>
                        <div style={{ fontSize: 17, fontWeight: 900, color: '#065f46', marginTop: 2 }}>
                          {analyticsData?.conversionRate || 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'unclaimed' ? (
            /* ───────────────────────────────────────────────────────────── */
            /* TAB 2: NEW / UNCLAIMED LEADS POOL                             */
            /* ───────────────────────────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: 'var(--surface)', padding: '14px 18px', borderRadius: 14, border: '1px solid var(--border)' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Available Unclaimed Prospects ({unclaimedLeads.length})</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Leads in the open pool ready to be claimed into your individual sales pipeline</p>
                </div>
                <button
                  onClick={fetchUnclaimedLeads}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: 4, borderRadius: 8 }}
                >
                  <RotateCcw size={13} /> Refresh Pool
                </button>
              </div>

              {loadingUnclaimed ? (
                <div style={{ padding: '60px 0', textAlign: 'center' }}><div className="spinner" /></div>
              ) : unclaimedLeads.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎯</div>
                  <h3>No unclaimed leads available</h3>
                  <p>All client leads are currently assigned. Check back later or add a new direct prospect.</p>
                  <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ marginTop: 10 }}>Add New Lead</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                  {unclaimedLeads.map(lead => (
                    <div key={lead._id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{lead.name}</h3>
                          <SourcePill lead={lead} showDetail={false} />
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>+{lead.phone}</p>
                        {lead.project && (
                          <span style={{ display: 'inline-block', fontSize: 11, padding: '2px 6px', background: 'var(--card)', borderRadius: 4, color: 'var(--text)', border: '1px solid var(--border)', marginTop: 6 }}>
                            📦 {lead.project}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <button
                          onClick={() => router.push(`/leads/${lead._id}`)}
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, borderRadius: 8, fontSize: 12 }}
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleClaimLead(lead._id)}
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, borderRadius: 8, fontSize: 12, gap: 4 }}
                        >
                          Claim Lead 🎯
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'follow_ups' ? (
            /* ───────────────────────────────────────────────────────────── */
            /* TAB 3: DEDICATED FOLLOW-UPS MODULE                           */
            /* ───────────────────────────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                {[
                  { id: 'today', label: `Today (${followUps.length})` },
                  { id: 'upcoming', label: 'Upcoming' },
                  { id: 'overdue', label: 'Overdue' },
                  { id: 'completed', label: 'Completed' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setFuSubTab(sub.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: fuSubTab === sub.id ? 700 : 500,
                      border: 'none',
                      cursor: 'pointer',
                      background: fuSubTab === sub.id ? 'var(--accent)' : 'transparent',
                      color: fuSubTab === sub.id ? '#ffffff' : 'var(--text-muted)',
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {followUps.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📅</div>
                  <h3>No follow-ups in this queue</h3>
                  <p>All scheduled client follow-ups are completed.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {followUps.map(lead => (
                    <div key={lead._id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ minWidth: 200, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{lead.name}</h3>
                          <span className={`badge ${STATUS_COLORS[lead.status] || 'badge-tag'}`} style={{ fontSize: 10 }}>
                            {STAGE_LABELS[lead.status] || lead.status}
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                          +{lead.phone} {lead.project ? `• ${lead.project}` : ''}
                        </p>
                        {lead.followUpNote && (
                          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#c2410c', fontWeight: 500 }}>
                            📝 {lead.followUpNote}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <a href={`tel:${lead.phone}`} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px', borderRadius: 8, color: '#059669', gap: 4 }}>
                          <Phone size={13} /> Call
                        </a>
                        <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '6px 10px', borderRadius: 8, color: '#16a34a', gap: 4 }}>
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                        <button
                          onClick={() => setSchedulingFollowUpLead(lead)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 10px', borderRadius: 8, gap: 4 }}
                        >
                          <Clock size={13} /> Delay
                        </button>
                        <button
                          onClick={() => setCompletingFollowUpLead(lead)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12 }}
                        >
                          <Check size={13} /> Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'pipeline' ? (
            /* ───────────────────────────────────────────────────────────── */
            /* TAB 4: DEDICATED PIPELINE VISUALIZER                          */
            /* ───────────────────────────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, scrollbarWidth: 'thin' }}>
                {availableStages.map(stage => {
                  const stageLeads = leads.filter(l => l.status === stage);
                  return (
                    <div key={stage} style={{ minWidth: 260, maxWidth: 300, flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{STAGE_LABELS[stage] || stage}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'var(--card)', border: '1px solid var(--border)' }}>
                          {stageLeads.length}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120, maxHeight: 480, overflowY: 'auto' }}>
                        {stageLeads.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'var(--text-muted)' }}>
                            No prospects in this stage
                          </div>
                        ) : (
                          stageLeads.map(lead => (
                            <div
                              key={lead._id}
                              onClick={() => router.push(`/leads/${lead._id}`)}
                              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px', cursor: 'pointer' }}
                              className="hover:border-indigo-500"
                            >
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{lead.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{lead.phone}</div>
                              {lead.project && (
                                <div style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 4 }}>📦 {lead.project}</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'deals' ? (
            /* ───────────────────────────────────────────────────────────── */
            /* TAB 5: DEDICATED DEALS & OPPORTUNITIES MODULE                 */
            /* ───────────────────────────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Deals Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 14, padding: '16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>Closed Revenue</span>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#065f46', marginTop: 4 }}>
                    {user?.localization?.currencySymbol || '₹'}{Number(analyticsData?.totalRevenue || 0).toLocaleString()}
                  </div>
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deals Won</span>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>
                    {analyticsData?.byStatus?.closed || 0}
                  </div>
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Negotiation Stage</span>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>
                    {leads.filter(l => l.status === 'negotiation' || l.status === 'not_interested').length}
                  </div>
                </div>
              </div>

              {/* Converted Deals List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {leads.filter(l => ['converted', 'closed', 'Closed', 'Closed / Won', 'payment_done'].includes(l.status)).length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">🏆</div>
                    <h3>No won deals recorded yet</h3>
                    <p>When you convert prospects in your pipeline, their deal value and closed contract details will appear here.</p>
                  </div>
                ) : (
                  leads.filter(l => ['converted', 'closed', 'Closed', 'Closed / Won', 'payment_done'].includes(l.status)).map(deal => (
                    <div key={deal._id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 800 }}>{deal.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.15)', color: '#047857' }}>
                            🏆 WON DEAL
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                          +{deal.phone} {deal.project ? `• ${deal.project}` : ''}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#047857' }}>
                          {user?.localization?.currencySymbol || '₹'}{Number(deal.closedDealAmount || 0).toLocaleString()}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {deal.updatedAt ? format(new Date(deal.updatedAt), 'dd MMM yyyy') : 'Converted'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeTab === 'site_visits' ? (
            /* ───────────────────────────────────────────────────────────── */
            /* TAB 6: DEDICATED SITE VISITS MODULE                           */
            /* ───────────────────────────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                {[
                  { id: 'scheduled', label: 'Scheduled Visits' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'cancelled', label: 'Cancelled' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setSvSubTab(sub.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: svSubTab === sub.id ? 700 : 500,
                      border: 'none',
                      cursor: 'pointer',
                      background: svSubTab === sub.id ? 'var(--accent)' : 'transparent',
                      color: svSubTab === sub.id ? '#ffffff' : 'var(--text-muted)',
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {followUps.filter(f => f.type === 'site_visit' || Boolean(f.siteVisitDetails)).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏢</div>
                  <h3>No site visits scheduled</h3>
                  <p>Schedule client property tours from any lead card to track visit outcomes and feedback.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {followUps.filter(f => f.type === 'site_visit' || Boolean(f.siteVisitDetails)).map(visit => (
                    <div key={visit._id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{visit.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'rgba(139,92,246,0.12)', color: '#6d28d9' }}>
                            🏢 Site Visit
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                          +{visit.phone} {visit.project ? `• ${visit.project}` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={`tel:${visit.phone}`} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px', borderRadius: 8 }}>
                          <Phone size={13} />
                        </a>
                        <button
                          onClick={() => setCompletingFollowUpLead(visit)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12 }}
                        >
                          Record Outcome
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ───────────────────────────────────────────────────────────── */
            /* TAB 7: MY LEADS PIPELINE (DEFAULT PIPELINE LISTING)          */
            /* ───────────────────────────────────────────────────────────── */
            <div>
              {/* Pipeline Stage Filter Chips */}
              <div className="filter-chips" style={{ marginBottom: 16 }}>
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
                          {lead.assignedToName ? (
                            <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(99,102,241,0.1)', borderRadius: 4, color: 'var(--accent)', fontWeight: 500, flexShrink: 0 }}>
                              👤 {lead.assignedToName}
                            </span>
                          ) : (
                            <span className="truncate max-w-full" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', borderRadius: 4, color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>
                              🌐 Common Pool
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
                              style={{ flex: 1, minWidth: 0, height: 34, fontSize: 12 }}
                            >
                              <Phone size={13} className="flex-shrink-0" /> Call
                            </a>
                            <a
                              href={waLink(lead.phone, `Hi ${lead.name || ''}, `)}
                              target="_blank"
                              rel="noreferrer"
                              className="lead-action-btn lead-action-wa"
                              style={{ flex: 1, minWidth: 0, height: 34, fontSize: 12 }}
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
