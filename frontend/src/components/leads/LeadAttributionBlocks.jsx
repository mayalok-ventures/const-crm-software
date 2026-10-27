'use client';

import React from 'react';
import {
  Layers,
  FileText,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  Shield,
  HelpCircle,
  Hash,
  Compass
} from 'lucide-react';
import { getLeadSourceTag, SourceHierarchyBreadcrumb } from '@/lib/sourceHelper';

export default function LeadAttributionBlocks({ lead }) {
  if (!lead) return null;

  const ls = lead.leadSource || {};
  const tag = getLeadSourceTag(lead);

  // Extract Form Answers (excluding core profile & admission fields already rendered in main profile)
  const CORE_PROFILE_KEYS = new Set([
    'name', 'phone', 'email', 'company', 'location', 'targetStream', 'targetDomain',
    'targetCourse', 'targetState', 'targetCity', 'packageBudget', 'budget',
    'academicScore', 'academicScore10th', 'academicScore12th', 'academicScoreGrad',
    'entranceExam', 'entranceRank', 'quotaPreference', 'status', 'pipelineStage',
    'pipeline_stage', 'assignedTo', 'assignedToName', 'temperature', 'score',
    'followUpDate', 'followUpNote', 'source', 'closedDealAmount',
    'stallInventoryLock', 'eventPass', 'offers_applied', 'school'
  ]);

  const customAnswers = lead.customData || {};
  const answerEntries = Object.entries(customAnswers).filter(
    ([k, v]) =>
      v !== null &&
      v !== undefined &&
      v !== '' &&
      typeof v !== 'object' &&
      !CORE_PROFILE_KEYS.has(k)
  );

  // Assigned Counselor info
  const assignedName = lead.assignedTo?.name || lead.assignedToName || 'Unassigned (General Pool)';
  const assignedEmail = lead.assignedTo?.email || '';
  const assignedUsercode = lead.assignedTo?.usercode || '';
  const assignmentReason = lead.assignmentReason || (lead.assignedTo ? 'Direct Workspace Assignment' : 'Pending Counselor Triage');

  const hasAttributionChain = Boolean(tag.connection || tag.campaign || tag.adset || tag.ad || tag.isTest);

  return (
    <div className="space-y-4 my-3">
      {/* ─────────────────────────────────────────────────────────────
          BLOCK 1: SOURCE HIERARCHY BLOCK
         ───────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Compass size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider m-0">
                1. Source & Campaign Hierarchy
              </h3>
              <span className="text-[11px] text-[var(--text-muted)]">
                Normalized Inbound Attribution Chain
              </span>
            </div>
          </div>

          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: tag.bg, color: tag.color, border: `1px solid ${tag.border}` }}
          >
            {tag.icon} {tag.label}
          </span>
        </div>

        {/* Visual Breadcrumb (only if multi-tier attribution exists) */}
        {hasAttributionChain && (
          <div className="mb-3">
            <SourceHierarchyBreadcrumb lead={lead} />
          </div>
        )}

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">Platform</span>
            <span className="font-bold text-[var(--text)] capitalize">
              {ls.platform || lead.source || 'Manual'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">Connection / Asset</span>
            <span className="font-bold text-[var(--text)] truncate block" title={ls.connectionName || ls.connectionId}>
              {ls.connectionName || ls.connectionId || 'Default Channel'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">Campaign</span>
            <span className="font-bold text-indigo-600 truncate block" title={ls.campaignName || ls.campaignId}>
              {ls.campaignName || lead.utmCampaign || 'General Inbound'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">Ad / AdSet</span>
            <span className="font-medium text-[var(--text)] truncate block" title={ls.adName || ls.adSetName || ls.adGroupName}>
              {ls.adName || ls.adSetName || ls.adGroupName || '—'}
            </span>
          </div>

          {ls.externalLeadId && (
            <div className="col-span-2 sm:col-span-4 pt-1.5 border-t border-[var(--border)] mt-1 flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">External ID:</span>
              <code className="text-[10.5px] font-mono bg-[var(--card)] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text)]">
                {ls.externalLeadId}
              </code>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BLOCK 2: FORM ANSWERS & CUSTOM QUESTIONS BLOCK
         ───────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <FileText size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider m-0">
                2. Inbound Form Answers & Custom Data
              </h3>
              <span className="text-[11px] text-[var(--text-muted)]">
                Lossless answers mapped from sheets or instant forms
              </span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--bg)] px-2 py-0.5 rounded-full border border-[var(--border)]">
            {answerEntries.length} Answers
          </span>
        </div>

        {answerEntries.length === 0 ? (
          <div className="text-center py-4 bg-[var(--bg)] rounded-xl border border-[var(--border)] text-xs text-[var(--text-muted)]">
            No custom form questions submitted. Basic contact information stored in profile.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {answerEntries.map(([key, val]) => {
              const formattedLabel = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/[_-]/g, ' ')
                .replace(/^\w/, (c) => c.toUpperCase());

              return (
                <div
                  key={key}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-2.5 flex flex-col justify-between"
                >
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {formattedLabel}
                  </span>
                  <div className="text-xs font-bold text-[var(--text)] mt-1 break-words">
                    {String(val)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BLOCK 3: ASSIGNMENT CONTEXT & REASON BLOCK
         ───────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider m-0">
                3. Counselor Routing & Assignment Context
              </h3>
              <span className="text-[11px] text-[var(--text-muted)]">
                Who owns this lead and the automated rule that assigned it
              </span>
            </div>
          </div>

          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              lead.assignedTo
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {lead.assignedTo ? 'Assigned' : 'Unassigned'}
          </span>
        </div>

        <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">👤</span>
              <div>
                <span className="font-bold text-[var(--text)] text-sm">{assignedName}</span>
                {assignedEmail && (
                  <span className="text-[11px] text-[var(--text-muted)] ml-2">({assignedEmail})</span>
                )}
              </div>
            </div>
            {lead.createdAt && (
              <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                <Clock size={12} /> Received: {new Date(lead.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block mb-1">
              Assignment Rule & Rationale:
            </span>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 text-xs font-medium text-[var(--text)] flex items-center gap-2">
              <Sparkles size={13} className="text-purple-600 flex-shrink-0" />
              <span>{assignmentReason}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
