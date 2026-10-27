'use client';
import {
  X, CheckCircle2, AlertCircle, ShieldAlert, Cpu, Check, AlertTriangle, Layers
} from 'lucide-react';

const CAPABILITIES = [
  {
    feature: 'Underlying Protocol',
    baileys: 'WhatsApp Web Multi-Device WebSockets',
    meta: 'Official Meta Graph REST API (v21.0)',
    notes: 'Baileys runs socket session; Meta runs enterprise cloud endpoint.',
  },
  {
    feature: 'Connection Onboarding',
    baileys: 'Scan QR or enter 8-digit Pairing Code on device',
    meta: 'System User Permanent Access Token + Phone Number ID',
    notes: 'Baileys connects physical phone; Meta registers enterprise WABA number.',
  },
  {
    feature: 'Authorized Setup Roles',
    baileys: 'Organization Owner or permitted member',
    meta: 'Strictly Organization Owner / Admin',
    notes: 'Official WABA is managed centrally at company level.',
  },
  {
    feature: '24-Hour Messaging Window',
    baileys: 'No protocol restriction (Phone acts as normal user)',
    meta: 'Strictly Enforced: Free-text allowed only within 24h of inbound message',
    notes: 'Outside 24h, Meta requires sending pre-approved templates.',
  },
  {
    feature: 'Templates Support',
    baileys: 'Local CRM canned responses with dynamic variable merge',
    meta: 'Official Meta HSM Templates (APPROVED / PENDING / REJECTED)',
    notes: 'Meta templates must be submitted to Meta review before dispatch.',
  },
  {
    feature: 'Group Messaging & Management',
    baileys: 'Supported (Sends to group JIDs)',
    meta: 'UNSUPPORTED on Meta Cloud API',
    notes: 'Meta Cloud API does NOT support creating or chatting in consumer WhatsApp groups.',
  },
  {
    feature: 'Delivery & Read Receipts',
    baileys: 'Basic socket acknowledgment events',
    meta: 'Cryptographically verified Webhook signatures (sent, delivered, read, failed)',
    notes: 'Webhook receipts are signed via HMAC-SHA256 for zero spoofing.',
  },
  {
    feature: 'Bulk Broadcast Campaigns',
    baileys: 'Throttled sequential dispatch (3-7s delay) to reduce ban risk',
    meta: 'High-throughput enterprise broadcast with pre-approved marketing templates',
    notes: 'Official Cloud API carries 0% risk of phone number blocking by WhatsApp.',
  },
  {
    feature: 'Hardware Dependency',
    baileys: 'Physical phone must stay charged & connected periodically',
    meta: '100% Serverless Cloud API (No phone hardware required)',
    notes: 'Meta runs 24/7 in Meta data centers regardless of device state.',
  },
];

export default function CapabilityMatrixModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                WhatsApp Dual Transport Capability Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Architectural comparison: Method A (Baileys Session) vs Method B (Official Meta Cloud API)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3 font-semibold text-slate-900 w-1/4">Capability / Dimension</th>
                  <th className="p-3 font-semibold text-emerald-700 w-3/8 bg-emerald-50/30">
                    Method A: Baileys WebSockets
                  </th>
                  <th className="p-3 font-semibold text-blue-700 w-3/8 bg-blue-50/30">
                    Method B: Official Meta Cloud API
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CAPABILITIES.map((cap, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 font-medium text-slate-900">
                      <div>{cap.feature}</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">{cap.notes}</div>
                    </td>
                    <td className="p-3 text-slate-700 bg-emerald-50/10">
                      {cap.baileys}
                    </td>
                    <td className="p-3 text-slate-700 bg-blue-50/10 font-medium">
                      {cap.meta.includes('UNSUPPORTED') ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> {cap.meta}
                        </span>
                      ) : (
                        cap.meta
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/50 text-xs">
          <span className="text-slate-500">
            Both methods operate side-by-side inside Sahyak CRM with zero cross-tenant contamination.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
}
