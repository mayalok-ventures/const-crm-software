'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import LeadsContent from '@/components/leads/LeadsContent';
import {
  ChevronLeft, RefreshCw, AlertTriangle, CheckCircle, XCircle, ArrowLeft,
  Pause, Play, Trash, Users, Target, TrendingUp, Layers, CheckCircle2,
  Calendar, Globe, Shield, Sparkles, Filter
} from 'lucide-react';
import { getResolvedRouteParam } from '@/lib/routeParams';

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const [activeId, setActiveId] = useState(() => getResolvedRouteParam(params, 'id', 'campaigns'));
  const campaignId = activeId || getResolvedRouteParam(params, 'id', 'campaigns');

  useEffect(() => {
    const resolved = getResolvedRouteParam(params, 'id', 'campaigns');
    if (resolved && resolved !== activeId) {
      setActiveId(resolved);
    }
  }, [params, activeId]);

  const [campaign, setCampaign] = useState(null);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('leads'); // 'leads' | 'logs' (for broadcast)

  const fetchCampaign = async () => {
    if (!campaignId || campaignId === 'placeholder') return;
    try {
      const res = await api.get(`/campaigns/${campaignId}`);
      const data = res.data.campaign || res.data;
      setCampaign(data);
    } catch (err) {
      toast.error('Failed to load campaign info');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (p = page) => {
    if (!campaignId || campaignId === 'placeholder') return;
    setLogsLoading(true);
    try {
      const res = await api.get(`/campaigns/${campaignId}/logs?page=${p}&limit=50`);
      setLogs(res.data.logs || []);
      setTotalLogs(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
      setPage(res.data.page || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId && campaignId !== '[id]' && campaignId !== 'placeholder' && campaignId !== 'undefined') {
      fetchCampaign();
    }
  }, [campaignId]);

  // Load logs if this is a broadcast campaign
  useEffect(() => {
    if (campaign && (campaign.platform === 'broadcast' || campaign.campaignType === 'outbound_broadcast')) {
      fetchLogs(1);
    }
  }, [campaign?._id]);

  // Poll progress when running or queued
  useEffect(() => {
    if (!campaign || !['running', 'queued'].includes(campaign.status)) return;
    const interval = setInterval(() => {
      fetchCampaign();
      if (campaign.platform === 'broadcast') {
        fetchLogs(page);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [campaign?.status, page]);

  const handlePause = async () => {
    try {
      await api.post(`/campaigns/${campaignId}/pause`);
      toast.success('Campaign paused');
      fetchCampaign();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pause campaign');
    }
  };

  const handleResume = async () => {
    try {
      await api.post(`/campaigns/${campaignId}/resume`);
      toast.success('Campaign resumed');
      fetchCampaign();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume campaign');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success('Campaign cancelled');
      fetchCampaign();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel campaign');
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container" style={{ padding: 20 }}>
        <div className="empty-state">
          <h3>Campaign not found</h3>
          <p className="text-sm text-slate-500 mb-4">The requested campaign does not exist or you do not have permission to view it.</p>
          <Link href="/campaigns" className="btn btn-ghost">
            Back to Campaigns
          </Link>
        </div>
      </div>
    );
  }

  const isBroadcast = campaign.platform === 'broadcast' || campaign.campaignType === 'outbound_broadcast';
  const leadCount = campaign.leadCount ?? campaign.totalLeads ?? 0;
  const assignedCount = campaign.assignedCount ?? 0;
  const convertedCount = campaign.convertedCount ?? 0;
  const conversionRate = leadCount > 0 ? ((convertedCount / leadCount) * 100).toFixed(1) : '0.0';
  const progress = campaign.totalLeads > 0 ? Math.round(((campaign.lastSentIndex || 0) + 1) / campaign.totalLeads * 100) : 0;

  return (
    <div className="app-shell pb-mobile-nav">
      <div className="page-container max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8">
        
        {/* Campaign Navigation & Top Header */}
        <div className="page-header py-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/campaigns" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} className="hover:text-slate-900 transition">
              <ArrowLeft size={18} />
            </Link>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Campaigns / Details</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="page-title text-xl sm:text-2xl font-black text-slate-900 m-0">
                  {campaign.displayName || campaign.campaignName || campaign.name || 'Campaign'}
                </h1>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  campaign.status === 'completed' || campaign.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : campaign.status === 'running'
                    ? 'bg-blue-100 text-blue-800 border border-blue-200 animate-pulse'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {campaign.status || 'Active'}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                  {campaign.platform || 'Multi'}
                </span>
              </div>
              {campaign.description && (
                <p className="m-0 mt-1 text-xs text-slate-500">{campaign.description}</p>
              )}
              {isBroadcast && campaign.template && (
                <p className="m-0 mt-1 text-xs text-slate-500">
                  Template: {campaign.template.length > 60 ? campaign.template.slice(0, 60) + '...' : campaign.template}
                </p>
              )}
            </div>

            {/* Outbound Broadcast Controls (if applicable) */}
            {isBroadcast && (
              <div className="flex items-center gap-2">
                {['running', 'queued'].includes(campaign.status) ? (
                  <button onClick={handlePause} className="btn btn-sm btn-ghost text-amber-600 border border-amber-200 text-xs flex items-center gap-1">
                    <Pause size={13} /> Pause
                  </button>
                ) : campaign.status === 'paused' ? (
                  <button onClick={handleResume} className="btn btn-sm btn-ghost text-emerald-600 border border-emerald-200 text-xs flex items-center gap-1">
                    <Play size={13} /> Resume
                  </button>
                ) : null}

                {['running', 'queued', 'paused'].includes(campaign.status) && (
                  <button onClick={handleCancel} className="btn btn-sm btn-ghost text-red-600 border border-red-200 text-xs flex items-center gap-1">
                    <XCircle size={13} /> Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Campaign Metrics Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Total Leads</span>
              <Users size={16} className="text-indigo-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{leadCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Captured in campaign</div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Assigned</span>
              <Target size={16} className="text-blue-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{assignedCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Routed to counselors</div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Admitted / Deal</span>
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{convertedCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Closed successfully</div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Conversion Rate</span>
              <TrendingUp size={16} className="text-violet-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{conversionRate}%</div>
            <div className="text-[11px] text-slate-400 mt-1">Lead to conversion</div>
          </div>
        </div>

        {/* Broadcast Progress Bar (if broadcast) */}
        {isBroadcast && (
          <div className="card mb-4 p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className="text-slate-500 font-semibold">Delivery Progress</span>
              <strong className="text-slate-900">{(campaign.lastSentIndex || 0) + 1} / {campaign.totalLeads} ({progress}%)</strong>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Tab Selection for Broadcast campaigns */}
        {isBroadcast && (
          <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition ${
                activeTab === 'leads' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Campaign Leads ({leadCount})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition ${
                activeTab === 'logs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Delivery Log ({totalLogs})
            </button>
          </div>
        )}

        {/* Inbound Marketing or Broadcast Leads Tab: Unified Leads Component */}
        {(!isBroadcast || activeTab === 'leads') && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-5 mb-8">
            <Suspense fallback={<div className="spinner my-12" />}>
              <LeadsContent
                initialCampaignId={campaign._id || campaignId}
                initialCampaignName={campaign.campaignName || campaign.name}
                embedded={true}
                hideNav={true}
              />
            </Suspense>
          </div>
        )}

        {/* Broadcast Delivery Logs View */}
        {isBroadcast && activeTab === 'logs' && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-900 m-0">Delivery Logs ({totalLogs})</h3>
              <button onClick={() => fetchLogs(page)} className="btn btn-ghost btn-sm p-1.5">
                <RefreshCw size={14} className={logsLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {logs.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                  No delivery records found yet.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log._id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-800">{log.number}</div>
                      {log.error && <div className="text-[11px] text-red-500 mt-0.5">{log.error}</div>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {log.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={12} /> Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          <XCircle size={12} /> Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  disabled={page === 1}
                  onClick={() => fetchLogs(page - 1)}
                  className="btn btn-ghost btn-sm text-xs"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                <button
                  disabled={page === totalPages}
                  onClick={() => fetchLogs(page + 1)}
                  className="btn btn-ghost btn-sm text-xs"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      <BottomNav active="campaigns" />
    </div>
  );
}
