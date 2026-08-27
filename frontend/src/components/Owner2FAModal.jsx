'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Smartphone, Copy, Check, Lock,
  AlertTriangle, X, RefreshCw, KeyRound, ShieldAlert
} from 'lucide-react';
import api from '@/lib/api';
import { getUser, setUser, isOwner } from '@/lib/auth';

export default function Owner2FAModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [otp, setOtp] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const startSetup = useCallback(async () => {
    const user = getUser();
    if (!user || !isOwner(user)) {
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setOtp('');
    setSuccess(false);

    try {
      const res = await api.post('/auth/2fa/setup');
      if (res.data) {
        setSetupData(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to initialize 2FA setup. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    const user = getUser();
    if (!user || !isOwner(user)) {
      toast.error('2FA setup is available only for Organization Owners.');
      return;
    }
    setIsOpen(true);
    startSetup();
  }, [startSetup]);

  const handleClose = () => {
    setIsOpen(false);
    setSetupData(null);
    setOtp('');
    setErrorMsg('');
    setSuccess(false);
  };

  useEffect(() => {
    const onOpenEvent = () => handleOpen();
    window.addEventListener('open-2fa-setup', onOpenEvent);
    return () => {
      window.removeEventListener('open-2fa-setup', onOpenEvent);
    };
  }, [handleOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleCopySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedKey(true);
    toast.success('Secret key copied to clipboard! 📋');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleCopyRecoveryCodes = () => {
    if (!setupData?.recoveryCodes) return;
    navigator.clipboard.writeText(setupData.recoveryCodes.join('\n'));
    setCopiedCodes(true);
    toast.success('Emergency recovery codes copied! 🔐');
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  const handleVerifyAndEnable = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMsg('Please enter the full 6-digit code from your authenticator app.');
      return;
    }

    setVerifying(true);
    setErrorMsg('');

    try {
      const res = await api.post('/auth/2fa/enable', {
        code: cleanOtp,
      });

      if (res.data?.twoFactorEnabled || res.data?.success) {
        setSuccess(true);
        toast.success('Two-Factor Authentication is now enabled! 🔒');

        // Update local user authentication state
        const currentUser = getUser();
        if (currentUser) {
          const updated = {
            ...currentUser,
            twoFactorEnabled: true,
          };
          setUser(updated);
        }

        // Notify other listeners to refresh 2FA state
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('2fa-status-changed', { detail: { enabled: true } }));
        }

        setTimeout(() => {
          handleClose();
        }, 1800);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid 6-digit code. Please check your authenticator app and try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0f172a] text-white border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#090d16]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Two-Factor Authentication Setup
              </h2>
              <p className="text-[11px] text-slate-400">
                Protect your Owner account with TOTP authenticator
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[calc(85vh-120px)] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-slate-300 font-medium">
                Generating cryptographically secure TOTP secret & QR Code...
              </p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h3 className="text-base font-bold text-white">2FA Activated Successfully!</h3>
              <p className="text-xs text-slate-300 max-w-sm">
                Your account is now protected. You will be prompted for your 6-digit code on next login.
              </p>
            </div>
          ) : setupData ? (
            <>
              {/* Step 1: Scan QR Code */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>Scan QR Code with Authenticator App</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Open <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>Authy</strong> and scan the code below:
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-white text-slate-900 border border-slate-200">
                  {setupData.qrCode ? (
                    <div className="bg-white p-2 rounded-lg border border-slate-300 shadow-sm flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={setupData.qrCode}
                        alt="2FA QR Code"
                        width={140}
                        height={140}
                        className="rounded"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2 text-xs w-full">
                    <p className="font-semibold text-slate-700">
                      Can&apos;t scan the QR code?
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Enter this secret key manually into your authenticator app:
                    </p>
                    <div className="flex items-center gap-1.5 p-2 bg-slate-100 rounded-lg border border-slate-300 font-mono text-[11px] font-bold text-slate-800 break-all select-all">
                      <span className="flex-1 truncate">{setupData.secret}</span>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="p-1 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 transition-colors flex-shrink-0"
                        title="Copy Secret Key"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Emergency Backup Codes */}
              {Array.isArray(setupData.recoveryCodes) && setupData.recoveryCodes.length > 0 && (
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Emergency Recovery Codes</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyRecoveryCodes}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300"
                    >
                      {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCodes ? 'Copied' : 'Copy All Codes'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Save these single-use codes in a safe place. You can use them to log in if you lose access to your authenticator app.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    {setupData.recoveryCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="px-2 py-1 rounded bg-black/40 border border-slate-800 text-center font-mono text-[11px] text-slate-300 font-semibold select-all"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Enter 6-Digit OTP */}
              <form onSubmit={handleVerifyAndEnable} className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>Enter 6-Digit Verification Code</span>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Authenticator Code:
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-2xl tracking-[0.4em] font-mono font-bold py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 text-center">
                    Enter the 6-digit code currently generated by your app
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifying || otp.replace(/\D/g, '').length !== 6}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify & Enable 2FA</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="p-4 text-center space-y-3">
              <p className="text-xs text-red-400">{errorMsg || 'Failed to load 2FA setup.'}</p>
              <button
                type="button"
                onClick={startSetup}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                Retry Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
