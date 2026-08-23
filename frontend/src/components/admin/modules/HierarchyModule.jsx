'use client';

import React from 'react';
import { Plus, UserCheck, Shield, Edit2, Phone, Mail, Award, CheckCircle2 } from 'lucide-react';
import ErrorState from '../ui/ErrorState';

export default function HierarchyModule({
  hierarchy = { managers: [], unassignedAgents: [], otherUsers: [] },
  performance = [],
  loading = false,
  error = null,
  onRetry,
  onAddMember,
  onEditUser,
  onReassignLeads,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const { managers = [], unassignedAgents = [] } = hierarchy || {};

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Organizational Staffing & Hierarchy Tree
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Manage sales managers, representative team assignments, and lead quotas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onReassignLeads && (
            <button
              onClick={onReassignLeads}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              Reassign Leads
            </button>
          )}
          {onAddMember && (
            <button
              onClick={onAddMember}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Managers & Assigned Teams */}
      <div className="space-y-4">
        {managers.map((manager) => (
          <div
            key={manager._id}
            className="rounded-xl border border-slate-800 bg-[#0d1424] overflow-hidden shadow-sm"
          >
            {/* Manager Header Card */}
            <div className="p-4 bg-[#0a0f1d] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center font-bold text-sm text-purple-300">
                  {manager.name?.charAt(0) || 'M'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{manager.name}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                      MANAGER
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                    <span>{manager.email}</span>
                    {manager.phone && <span>• {manager.phone}</span>}
                    <span>• {manager.teamMembers?.length || 0} Team Reps</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditUser && onEditUser(manager)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="Edit Manager"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Team Agents Grid */}
            <div className="p-4">
              {manager.teamMembers && manager.teamMembers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {manager.teamMembers.map((agent) => (
                    <div
                      key={agent._id}
                      className="p-3 rounded-lg bg-[#111827] border border-slate-800/80 flex items-center justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                          {agent.name?.charAt(0) || 'A'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white text-xs truncate">{agent.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            Cap: {agent.leadCap || 50} | {agent.isAvailableForRouting !== false ? 'Routing ON' : 'Paused'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onEditUser && onEditUser(agent)}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        title="Edit Agent"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 text-xs">
                  No sales representatives currently assigned under this manager.
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Unassigned Agents Section */}
        {unassignedAgents.length > 0 && (
          <div className="rounded-xl border border-dashed border-slate-800 bg-[#0a0f1d]/50 p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Unassigned Representatives Pool ({unassignedAgents.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {unassignedAgents.map((agent) => (
                <div
                  key={agent._id}
                  className="p-3 rounded-lg bg-[#111827] border border-slate-800 flex items-center justify-between gap-2 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-400 shrink-0">
                      {agent.name?.charAt(0) || 'A'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs truncate">{agent.name}</div>
                      <div className="text-[10px] text-amber-400/80">No Manager Assigned</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onEditUser && onEditUser(agent)}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                    title="Assign Manager"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {managers.length === 0 && unassignedAgents.length === 0 && (
          <div className="text-center py-12 rounded-xl border border-dashed border-slate-800 bg-[#0d1424] text-slate-400 text-xs">
            No organization team members found. Click &quot;Add Member&quot; to build your hierarchy.
          </div>
        )}
      </div>
    </div>
  );
}
