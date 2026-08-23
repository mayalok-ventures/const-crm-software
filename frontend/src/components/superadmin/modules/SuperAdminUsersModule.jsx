'use client';

import React from 'react';
import { Users, Search, Filter, ShieldCheck, UserCheck, Shield } from 'lucide-react';

export default function SuperAdminUsersModule({
  users = [],
  pagination = {},
  loading = false,
  search = '',
  onSearchChange = null,
  roleFilter = 'all',
  onRoleFilterChange = null,
  onPageChange = null,
}) {
  return (
    <div className="space-y-4">
      {/* Search and Role Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Search users by name, email, phone..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange && onRoleFilterChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Organisation Admin</option>
            <option value="manager">Manager</option>
            <option value="agent">Agent / Sales Rep</option>
            <option value="user">User / Solo</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Total Platform Users: {pagination.total || users.length}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">User & Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Tenant Organisation</th>
                <th className="px-4 py-3">Assigned Manager</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{u.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email || u.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-medium">
                    {u.companyId?.companyInfo?.companyName || u.companyId?.name || (u.role === 'admin' ? 'Primary Owner' : 'Independent')}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                    {u.managerId?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                        u.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {u.isActive ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
