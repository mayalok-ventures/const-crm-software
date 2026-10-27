'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X,
  Target,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  UserCheck,
  ArrowUpRight,
  Phone,
  MessageCircle,
  Mail,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  ChevronDown,
} from 'lucide-react';

export default function CampaignLeadsModal({ isOpen, onClose, campaign }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    leads: [],
    totalLeads: 0,
    sourceBreakdown: [],
    counselorBreakdown: [],
    stageBreakdown: [],
  });

  const [search, setSearch] = useState('');
  const [counselorFilter, setCounselorFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const fetchLeads = useCallback(async () => {
    if (!campaign?._id) return;
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (counselorFilter) params.counselorId = counselorFilter;
      if (stageFilter) params.stage = stageFilter;

      const res = await api.get(`/campaigns/${campaign._id}/leads`, { params });
      if (res.data?.success) {
        const stats = res.data.stats || {};
        setData({
          leads: res.data.leads || [],
          totalLeads: stats.totalLeads ?? res.data.totalLeads ?? 0,
          sourceBreakdown: stats.sourceBreakdown || res.data.sourceBreakdown || [],
          counselorBreakdown: stats.counselorBreakdown || res.data.counselorBreakdown || [],
          stageBreakdown: stats.stageBreakdown || res.data.stageBreakdown || [],
        });
      }
    } catch (err) {
      console.error('Failed to load campaign leads:', err);
      toast.error('Failed to load campaign lead attribution data');
    } finally {
      setLoading(false);
    }
  }, [campaign?._id, search, counselorFilter, stageFilter]);

  useEffect(() => {
    if (isOpen && campaign?._id) {
      fetchLeads();
    }
  }, [isOpen, campaign?._id, fetchLeads]);

  if (!isOpen || !campaign) return null;

  const stageBadgeClasses = (stage) => {
    switch (String(stage || '').toLowerCase()) {
      case 'enrolled':
      case 'converted':
      case 'admission_done':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'follow_up':
      case 'followup_scheduled':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'interested':
      case 'counseling':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'contacted':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'lost':
      case 'unqualified':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto animate-scale-up flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <Target size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{campaign.name || 'Campaign'}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                  {campaign.platform || 'Multi'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  campaign.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {campaign.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Lead Origin Tracking & Authoritative Counselor Assignment Audit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Subheader Analytics Cards */}
        <div className="px-6 py-3.5 bg-slate-50/40 border-b border-slate-100 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Leads Ingested
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {data.totalLeads}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Active Counselors
              </div>
              <div className="text-xl font-extrabold text-indigo-600 mt-0.5">
                {data.counselorBreakdown?.length || 0}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Origin Channels
              </div>
              <div className="text-xl font-extrabold text-emerald-600 mt-0.5">
                {data.sourceBreakdown?.length || 1}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Converted
              </div>
              <div className="text-xl font-extrabold text-purple-600 mt-0.5">
                {data.stageBreakdown?.find(s => ['converted', 'enrolled', 'admission_done'].includes(s.stage?.toLowerCase()))?.count || 0}
              </div>
            </div>
          </div>

          {/* Counselor Distribution Pills */}
          {data.counselorBreakdown?.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Assigned Counselors:
              </span>
              {data.counselorBreakdown.map((cb, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-800"
                >
                  <UserCheck size={12} className="text-indigo-600" />
                  {cb.name}: <strong className="text-indigo-900">{cb.count}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={counselorFilter}
              onChange={(e) => setCounselorFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 sm:flex-none"
            >
              <option value="">All Counselors</option>
              {data.counselorBreakdown?.map((c, idx) => (
                <option key={idx} value={c.counselorId}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 sm:flex-none"
            >
              <option value="">All Pipeline Stages</option>
              {data.stageBreakdown?.map((s, idx) => (
                <option key={idx} value={s.stage}>
                  {s.stage} ({s.count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leads Table / List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <div className="spinner w-6 h-6 border-2 border-indigo-600/20 border-t-indigo-600" />
              <div className="text-xs">Loading lead attribution records...</div>
            </div>
          ) : data.leads.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Target size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No leads captured under this campaign yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Once incoming leads arrive through the configured integration forms, ads, or webhooks, they will appear here with instant attribution and assignment logs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.leads.map((lead) => (
                <div
                  key={lead._id}
                  className="p-4 rounded-xl border border-slate-200/90 hover:border-indigo-200 hover:shadow-xs transition-all bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Lead Contact Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{lead.name || 'Unnamed Lead'}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stageBadgeClasses(
                            lead.status
                          )}`}
                        >
                          {lead.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {lead.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone size={12} className="text-slate-400" />
                            {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} className="text-slate-400" />
                            {lead.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Counselor Assignment & Reason Badge */}
                    <div className="flex items-center gap-3 sm:text-right">
                      <div className="text-left sm:text-right">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Assigned To
                        </div>
                        <div className="text-xs font-bold text-indigo-700 flex items-center sm:justify-end gap-1.5 mt-0.5">
                          <UserCheck size={14} className="text-indigo-600" />
                          {lead.assignedToName || 'Unassigned'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Origin & Routing Details Footer */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap text-slate-600">
                      <span className="font-semibold text-slate-500">Origin:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                        {lead.formName ? `Form: "${lead.formName}"` : lead.platform?.toUpperCase() || 'Inbound'}
                      </span>
                      {lead.adName && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          Ad: {lead.adName}
                        </span>
                      )}
                      {lead.course && (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                          Course: {lead.course}
                        </span>
                      )}
                    </div>

                    <div className="text-slate-400 flex items-center gap-1.5">
                      <Clock size={12} />
                      {new Date(lead.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Authoritative Assignment Reason String */}
                  {lead.assignmentReason && (
                    <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="font-semibold text-slate-700">Assignment Logic:</span> {lead.assignmentReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Showing <strong>{data.leads.length}</strong> of <strong>{data.totalLeads}</strong> leads captured under Campaign &quot;{campaign.name}&quot;
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
