'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Smartphone, Globe, Save, CheckCircle2 } from 'lucide-react';
import ErrorState from '../ui/ErrorState';

export default function SecurityModule({
  securitySettings = null,
  loading = false,
  error = null,
  onRetry,
  onSaveSecurity,
}) {
  const settings = securitySettings || {};
  const [require2FA, setRequire2FA] = useState(Boolean(settings.require2FA));
  const [ipAllowlist, setIpAllowlist] = useState((settings.ipAllowlist || []).join(', '));
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(
    settings.sessionTimeoutMinutes || 120
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (securitySettings) {
      setRequire2FA(Boolean(securitySettings.require2FA));
      setIpAllowlist((securitySettings.ipAllowlist || []).join(', '));
      setSessionTimeoutMinutes(securitySettings.sessionTimeoutMinutes || 120);
    }
  }, [securitySettings]);

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (onSaveSecurity) {
        await onSaveSecurity({
          require2FA,
          ipAllowlist: ipAllowlist.split(',').map((s) => s.trim()).filter(Boolean),
          sessionTimeoutMinutes: Number(sessionTimeoutMinutes) || 120,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Security Policies & Access Control
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Configure multi-factor authentication, IP restrictions, and session lifespan limits
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Updating...' : 'Save Policies'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 2FA Card */}
        <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase">Two-Factor Authentication (2FA)</h4>
            </div>
            <input
              type="checkbox"
              checked={require2FA}
              onChange={(e) => setRequire2FA(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Require all managers and sales representatives to verify their login with an authenticator app or OTP code.
          </p>
        </div>

        {/* Session Timeout Card */}
        <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-400" />
            <h4 className="text-xs font-bold text-white uppercase">Inactivity Session Timeout</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Automatically log users out if no activity is detected within the specified period.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="number"
              min="15"
              max="1440"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(e.target.value)}
              className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono text-center"
            />
            <span className="text-xs text-slate-300">Minutes</span>
          </div>
        </div>

        {/* IP Allowlist Card */}
        <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-3 md:col-span-2">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-400" />
            <h4 className="text-xs font-bold text-white uppercase">Corporate IP Allowlist</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Restricted IP addresses (comma separated). Leave empty to permit access from any network location.
          </p>
          <textarea
            value={ipAllowlist}
            onChange={(e) => setIpAllowlist(e.target.value)}
            placeholder="e.g. 103.21.244.0, 192.168.1.1"
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
      </div>
    </div>
  );
}
