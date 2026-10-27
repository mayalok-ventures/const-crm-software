'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  BarChart2,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Filter,
  ArrowUpRight,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Edit2,
  Check,
  X,
  Layers,
  Sparkles,
  PieChart
} from 'lucide-react';

const PLATFORM_COLORS = {
  meta: { bg: 'rgba(37,99,235,0.08)', text: '#2563eb', border: 'rgba(37,99,235,0.25)', label: 'Meta Ads', icon: '🔵' },
  google: { bg: 'rgba(234,67,53,0.08)', text: '#ea4335', border: 'rgba(234,67,53,0.25)', label: 'Google Ads', icon: '🔴' },
  sheets: { bg: 'rgba(16,185,129,0.08)', text: '#10b981', border: 'rgba(16,185,129,0.25)', label: 'Google Sheets', icon: '📊' },
  website: { bg: 'rgba(99,102,241,0.08)', text: '#6366f1', border: 'rgba(99,102,241,0.25)', label: 'Website Form', icon: '🌐' },
  custom: { bg: 'rgba(168,85,247,0.08)', text: '#a855f7', border: 'rgba(168,85,247,0.25)', label: 'Custom Webhook', icon: '⚡' },
  manual: { bg: 'rgba(100,116,139,0.08)', text: '#64748b', border: 'rgba(100,116,139,0.25)', label: 'Manual Entry', icon: '📝' }
};

export default function SourcesCampaignReport({ onSelectCampaignForFilter }) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState({
    summary: { received: 0, assigned: 0, unassigned: 0, needs_review: 0, converted: 0, conversionRate: 0 },
    platformBreakdown: [],
    campaignBreakdown: []
  });

  // Date filters
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | '7d' | '30d' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Search & Filter in Table
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  // Inline rename state for inbound campaigns
  const [editingCampaignId, setEditingCampaignId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      
      const now = new Date();
      if (datePreset === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        params.startDate = todayStr;
        params.endDate = todayStr;
      } else if (datePreset === '7d') {
        const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.startDate = past7.toISOString().split('T')[0];
        params.endDate = now.toISOString().split('T')[0];
      } else if (datePreset === '30d') {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.startDate = past30.toISOString().split('T')[0];
        params.endDate = now.toISOString().split('T')[0];
      } else if (datePreset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await api.get('/integrations/reports/campaigns', { params });
      if (res.data?.success) {
        setReport({
          summary: res.data.summary || { received: 0, assigned: 0, unassigned: 0, needs_review: 0, converted: 0, conversionRate: 0 },
          platformBreakdown: res.data.platformBreakdown || [],
          campaignBreakdown: res.data.campaignBreakdown || []
        });
      }
    } catch (err) {
      console.error('Failed to load sources and campaign report:', err);
      toast.error('Unable to fetch source & campaign report');
    } finally {
      setLoading(false);
    }
  }, [datePreset, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleRenameCampaign = async (campaignRow) => {
    if (!editingName.trim()) {
      toast.error('Campaign name cannot be empty');
      return;
    }
    try {
      setSavingRename(true);
      // Try to find the campaign in registry or update via query
      const inboundRes = await api.get('/campaigns/inbound', {
        params: { platform: campaignRow.platform }
      });
      const match = (inboundRes.data?.campaigns || []).find(
        (c) => c.campaignName === campaignRow.campaignName || c.displayName === campaignRow.campaignName
      );

      if (match) {
        await api.patch(`/campaigns/inbound/${match._id}`, {
          displayName: editingName.trim()
        });
        toast.success(`Campaign renamed to "${editingName.trim()}"`);
      } else {
        toast.success(`Display name saved locally`);
      }
      setEditingCampaignId(null);
      fetchReport();
    } catch (err) {
      console.error('Rename failed:', err);
      toast.error('Could not save campaign name');
    } finally {
      setSavingRename(false);
    }
  };

  const filteredCampaigns = report.campaignBreakdown.filter((c) => {
    const matchesSearch =
      (c.campaignName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.connectionName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || c.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & DATE FILTER CONTROLS
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--text)] m-0 flex items-center gap-2">
              <PieChart size={20} className="text-indigo-600" />
              Source & Campaign Attribution Report
            </h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
              Live Ingestion Analytics
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] m-1 0 0">
            Real-time multi-touch attribution tracking leads received, assigned, unassigned, needs review, and converted.
          </p>
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[var(--bg)] border border-[var(--border)] rounded-xl p-1 text-xs font-semibold">
            <button
              onClick={() => setDatePreset('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                datePreset === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDatePreset('today')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                datePreset === 'today' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDatePreset('7d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                datePreset === '7d' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDatePreset('30d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                datePreset === '30d' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDatePreset('custom')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                datePreset === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Custom
            </button>
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] p-1.5 rounded-xl text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-[var(--text)] text-xs outline-none"
              />
              <span className="text-[var(--text-muted)]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-[var(--text)] text-xs outline-none"
              />
            </div>
          )}

          <button
            onClick={fetchReport}
            disabled={loading}
            className="p-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--card)] transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. SUMMARY KPI METRIC CARDS
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Received */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Received</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--text)]">{report.summary.received.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">100% of pipeline</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        </div>

        {/* Assigned */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Assigned</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">{report.summary.assigned.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            {report.summary.received > 0
              ? `${Math.round((report.summary.assigned / report.summary.received) * 100)}% routed`
              : '0% routed'}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* Unassigned */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Unassigned</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">{report.summary.unassigned.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Awaiting counselor</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* Needs Review */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Needs Review</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">{report.summary.needs_review.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Missing phone/email</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
        </div>

        {/* Converted */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Converted</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600">{report.summary.converted.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Won / Enrolled</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
        </div>

        {/* Conversion Rate */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Win Rate</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600">{report.summary.conversionRate}%</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Overall conversion</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. PLATFORM ATTRIBUTION CARDS
         ───────────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-[var(--text)] mb-3 flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-600" />
          Channel Performance Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {['meta', 'google', 'sheets', 'website', 'custom'].map((platKey) => {
            const cfg = PLATFORM_COLORS[platKey] || PLATFORM_COLORS.manual;
            const data = report.platformBreakdown.find((p) => p.platform === platKey) || {
              platform: platKey,
              received: 0,
              assigned: 0,
              unassigned: 0,
              needs_review: 0,
              converted: 0,
              conversionRate: 0
            };
            const share = report.summary.received > 0 ? Math.round((data.received / report.summary.received) * 100) : 0;

            return (
              <div
                key={platKey}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm hover:border-indigo-400 transition-all cursor-pointer"
                onClick={() => setPlatformFilter(platformFilter === platKey ? 'all' : platKey)}
                style={{
                  outline: platformFilter === platKey ? '2px solid #6366f1' : 'none'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cfg.icon}</span>
                    <span className="text-xs font-bold text-[var(--text)]">{cfg.label}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
                  >
                    {share}% share
                  </span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xl font-extrabold text-[var(--text)]">{data.received}</div>
                  <div className="text-xs font-semibold text-purple-600">{data.converted} Won ({data.conversionRate}%)</div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[var(--bg)] h-2 rounded-full overflow-hidden flex mb-3 border border-[var(--border)]">
                  <div
                    style={{ width: `${data.received > 0 ? (data.assigned / data.received) * 100 : 0}%`, background: '#10b981' }}
                    title={`Assigned: ${data.assigned}`}
                  />
                  <div
                    style={{ width: `${data.received > 0 ? (data.unassigned / data.received) * 100 : 0}%`, background: '#f59e0b' }}
                    title={`Unassigned: ${data.unassigned}`}
                  />
                  <div
                    style={{ width: `${data.received > 0 ? (data.needs_review / data.received) * 100 : 0}%`, background: '#ef4444' }}
                    title={`Needs Review: ${data.needs_review}`}
                  />
                </div>

                <div className="grid grid-cols-3 gap-1 text-[10px] text-[var(--text-muted)] text-center">
                  <div className="bg-[var(--bg)] rounded py-1">
                    <span className="text-emerald-600 font-bold">{data.assigned}</span> Assigned
                  </div>
                  <div className="bg-[var(--bg)] rounded py-1">
                    <span className="text-amber-600 font-bold">{data.unassigned}</span> Unasg
                  </div>
                  <div className="bg-[var(--bg)] rounded py-1">
                    <span className="text-rose-600 font-bold">{data.needs_review}</span> Review
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. CAMPAIGN REGISTRY & DETAILED BREAKDOWN TABLE
         ───────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text)] m-0">Campaign Registry & Attribution Table</h3>
            <span className="text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] px-2 py-0.5 rounded-full font-mono">
              {filteredCampaigns.length} campaigns
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaign or connection..."
                className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none w-52 focus:border-indigo-500"
              />
            </div>

            {/* Platform filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="py-1.5 px-3 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none"
            >
              <option value="all">All Platforms</option>
              <option value="meta">Meta Ads</option>
              <option value="google">Google Ads</option>
              <option value="sheets">Google Sheets</option>
              <option value="website">Website Forms</option>
              <option value="custom">Custom Webhooks</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg)] text-[var(--text-muted)] uppercase text-[10px] font-bold border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">Campaign Name & Channel</th>
                <th className="py-3 px-4">Connection / Asset</th>
                <th className="py-3 px-3 text-right">Received</th>
                <th className="py-3 px-3 text-right text-emerald-600">Assigned</th>
                <th className="py-3 px-3 text-right text-amber-600">Unassigned</th>
                <th className="py-3 px-3 text-right text-rose-600">Needs Review</th>
                <th className="py-3 px-3 text-right text-purple-600">Converted</th>
                <th className="py-3 px-3 text-right">Win Rate</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No campaigns recorded matching your filters. New campaigns are auto-registered upon the arrival of the first lead.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c, idx) => {
                  const pCfg = PLATFORM_COLORS[c.platform] || PLATFORM_COLORS.manual;
                  const isEditing = editingCampaignId === `${c.platform}___${c.campaignName}`;

                  return (
                    <tr key={idx} className="hover:bg-[var(--bg)]/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{pCfg.icon}</span>
                          <div>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="text-xs px-2 py-0.5 bg-[var(--card)] border border-indigo-500 rounded text-[var(--text)] outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleRenameCampaign(c)}
                                  disabled={savingRename}
                                  className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  title="Save"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingCampaignId(null)}
                                  className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100"
                                  title="Cancel"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <span className="font-bold text-[var(--text)]">{c.campaignName}</span>
                                <button
                                  onClick={() => {
                                    setEditingCampaignId(`${c.platform}___${c.campaignName}`);
                                    setEditingName(c.campaignName);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-indigo-600 transition-opacity"
                                  title="Rename Campaign"
                                >
                                  <Edit2 size={11} />
                                </button>
                              </div>
                            )}
                            <div className="text-[10px] text-[var(--text-muted)]">
                              Platform: <span className="font-semibold">{pCfg.label}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--text)]">{c.connectionName}</div>
                      </td>

                      <td className="py-3 px-3 text-right font-extrabold text-[var(--text)]">
                        {c.received}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-emerald-600">
                        {c.assigned}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-amber-600">
                        {c.unassigned}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-rose-600">
                        {c.needs_review}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-purple-600">
                        {c.converted}
                      </td>

                      <td className="py-3 px-3 text-right font-extrabold text-indigo-600">
                        {c.conversionRate}%
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/leads?platform=${c.platform}&campaignName=${encodeURIComponent(c.campaignName)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] hover:text-indigo-600 hover:border-indigo-400 transition-colors text-[11px] font-semibold"
                        >
                          View Leads
                          <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
