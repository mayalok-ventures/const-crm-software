'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User, Building2, Shield, Key, Mail, Phone, Globe, MapPin,
  Save, CheckCircle2, Lock, Sparkles, RefreshCw, AlertCircle,
  Eye, EyeOff, BarChart2, TrendingUp, Users, Calendar, Award,
  CheckCircle, ArrowUpRight, ShieldCheck, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { isSuperAdmin, isOwner, isManager, isAgent } from '@/lib/auth';

const GLOBAL_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR ₹)' },
  { code: 'USD', symbol: '$', name: 'US Dollar (USD $)' },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR €)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (GBP £)' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham (AED د.إ)' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal (SAR ﷼)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CAD $)' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar (AUD $)' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (SGD $)' },
];

const AVATAR_OPTIONS = [
  { id: 'shield_gold', label: 'Golden Shield', emoji: '🛡️' },
  { id: 'crown_gold', label: 'Crown Gold', emoji: '👑' },
  { id: 'zap_gold', label: 'Thunderbolt', emoji: '⚡' },
  { id: 'star_gold', label: 'Executive Star', emoji: '⭐' },
  { id: 'briefcase', label: 'Briefcase', emoji: '💼' },
  { id: 'rocket', label: 'Rocket', emoji: '🚀' },
  { id: 'gem', label: 'Gemstone', emoji: '💎' },
  { id: 'building', label: 'Headquarters', emoji: '🏢' },
];

export default function ProfileModule({
  currentUser = null,
  onUserUpdated = null,
  theme = 'light',
}) {
  const isTenantOwner = isOwner(currentUser) || isSuperAdmin(currentUser);
  const isTenantManager = isManager(currentUser);
  const isTenantAgent = isAgent(currentUser);

  // Personal Profile Form
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
    avatarIcon: currentUser?.avatarIcon || 'shield_gold',
  });

  // Organization Form (Owners Only)
  const [companyForm, setCompanyForm] = useState({
    companyName: currentUser?.companyInfo?.companyName || '',
    companyPhone: currentUser?.companyInfo?.companyPhone || '',
    companyEmail: currentUser?.companyInfo?.companyEmail || '',
    website: currentUser?.companyInfo?.website || '',
    address: currentUser?.companyInfo?.address || '',
    city: currentUser?.companyInfo?.city || '',
    state: currentUser?.companyInfo?.state || '',
    country: currentUser?.companyInfo?.country || 'India',
    zipCode: currentUser?.companyInfo?.zipCode || '',
    industryType: currentUser?.industryType || 'Real Estate & Properties',
  });

  // Localization / Preferences
  const [localizationForm, setLocalizationForm] = useState({
    currencyCode: currentUser?.localization?.currencyCode || 'INR',
    currencySymbol: currentUser?.localization?.currencySymbol || '₹',
    countryPhoneCode: currentUser?.localization?.countryPhoneCode || '91',
  });

  const [preferencesForm, setPreferencesForm] = useState({
    showFollowUpOnCreate: currentUser?.preferences?.showFollowUpOnCreate ?? true,
  });

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // States
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  // 2FA Disable State
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling2FA, setDisabling2FA] = useState(false);

  // Compact Performance Metrics (For Agent)
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const isDark = theme === 'dark';

  // Sync state with incoming user prop
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        email: currentUser.email || '',
        avatarIcon: currentUser.avatarIcon || 'shield_gold',
      });
      setCompanyForm({
        companyName: currentUser.companyInfo?.companyName || '',
        companyPhone: currentUser.companyInfo?.companyPhone || '',
        companyEmail: currentUser.companyInfo?.companyEmail || '',
        website: currentUser.companyInfo?.website || '',
        address: currentUser.companyInfo?.address || '',
        city: currentUser.companyInfo?.city || '',
        state: currentUser.companyInfo?.state || '',
        country: currentUser.companyInfo?.country || 'India',
        zipCode: currentUser.companyInfo?.zipCode || '',
        industryType: currentUser.industryType || 'Real Estate & Properties',
      });
      setLocalizationForm({
        currencyCode: currentUser.localization?.currencyCode || 'INR',
        currencySymbol: currentUser.localization?.currencySymbol || '₹',
        countryPhoneCode: currentUser.localization?.countryPhoneCode || '91',
      });
      setPreferencesForm({
        showFollowUpOnCreate: currentUser.preferences?.showFollowUpOnCreate ?? true,
      });
    }
  }, [currentUser]);

  // Fetch Agent Performance Metrics
  useEffect(() => {
    let isMounted = true;
    setLoadingAnalytics(true);
    api.get('/analytics')
      .then((res) => {
        if (isMounted && res.data) {
          setAnalytics(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingAnalytics(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) return toast.error('Full Name is required');

    setSavingProfile(true);
    try {
      const { data } = await api.put('/auth/profile', {
        name: profileForm.name.trim(),
        phone: profileForm.phone.replace(/\D/g, ''),
        avatarIcon: profileForm.avatarIcon,
        localization: localizationForm,
        preferences: preferencesForm,
      });

      toast.success('Personal profile updated successfully! ✅');
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Preferences Update
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPreferences(true);
    try {
      const { data } = await api.put('/auth/profile', {
        preferences: preferencesForm,
        localization: localizationForm,
      });

      toast.success('Preferences saved successfully! ✅');
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  // Handle Company / Org Update (Owner Only)
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const { data } = await api.put('/auth/profile', {
        companyInfo: companyForm,
        localization: localizationForm,
      });

      toast.success('Organization details saved successfully! ✅');
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save organization info');
    } finally {
      setSavingCompany(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) return toast.error('Current password is required');
    if (!passwordForm.newPassword) return toast.error('New password is required');
    if (passwordForm.newPassword.length < 6) return toast.error('New password must be at least 6 characters');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('New passwords do not match');
    }

    setPasswordSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      toast.success('Password changed successfully! 🔐');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password. Verify your current password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Handle Disable 2FA
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    if (!disablePassword) return toast.error('Account password is required to disable 2FA');

    setDisabling2FA(true);
    try {
      const res = await api.post('/auth/2fa/disable', {
        password: disablePassword,
      });

      toast.success(res.data?.message || 'Two-Factor Authentication disabled successfully');
      setShowDisable2FAModal(false);
      setDisablePassword('');

      const updatedUser = {
        ...(currentUser || {}),
        twoFactorEnabled: false,
      };

      if (onUserUpdated) {
        onUserUpdated(updatedUser);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('2fa-status-changed', { detail: { enabled: false } }));
        window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable 2FA. Verify your current password.');
    } finally {
      setDisabling2FA(false);
    }
  };

  const handleOpen2FASetup = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-2fa-setup'));
    }
  };

  const currentAvatar = AVATAR_OPTIONS.find((a) => a.id === profileForm.avatarIcon) || AVATAR_OPTIONS[0];

  const orgName =
    currentUser?.companyInfo?.companyName ||
    currentUser?.companyId?.companyInfo?.companyName ||
    currentUser?.companyId?.name ||
    'SalesCRM Organization';

  const joiningDateFormatted = currentUser?.joinedAt
    ? new Date(currentUser.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : (currentUser?.createdAt
      ? new Date(currentUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Active');

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. PROFILE HEADER CARD                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className={`p-6 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-5 transition-all ${
        isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm ${
            isDark
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
              : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
          }`}>
            {currentAvatar.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {profileForm.name || 'Sales Agent'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                isTenantOwner
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : isTenantManager
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {isTenantOwner
                  ? 'Organization Admin'
                  : isTenantManager
                  ? 'Sales Manager'
                  : (currentUser?.companyRole || 'Sales Agent')}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {currentUser?.employeeStatus || 'Active'}
              </span>
            </div>
            <p className={`text-xs mt-1 flex items-center gap-2 flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>{profileForm.email || 'agent@sahyak.com'}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">{orgName}</span>
              {currentUser?.usercode && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold text-slate-600">
                    ID: {currentUser.usercode}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 ${
            isDark
              ? 'bg-slate-900 border-slate-800 text-slate-300'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified CRM Account</span>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. MAIN PROFILE SECTIONS GRID                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* SECTION A: PERSONAL INFORMATION (EDITABLE) */}
        <form onSubmit={handleSaveProfile} className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
          isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <User className="w-4 h-4" />
              </div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Personal Information
              </h3>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50 ${
                isDark
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>

          {/* Avatar Selector */}
          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Profile Avatar Badge
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {AVATAR_OPTIONS.map((av) => {
                const isSelected = profileForm.avatarIcon === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setProfileForm((prev) => ({ ...prev, avatarIcon: av.id }))}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-500/20 font-bold shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className="text-lg">{av.emoji}</span>
                    <span className="text-[9px] font-medium truncate w-full text-center">{av.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10'
                }`}
                placeholder="Rahul Sharma"
              />
            </div>
          </div>

          {/* Email Address (Read-Only) */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Email Address <span className="text-[10px] font-normal text-slate-400">(Account Login)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                disabled
                value={profileForm.email}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs font-medium bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                placeholder="name@organization.com"
              />
            </div>
          </div>

          {/* Phone / WhatsApp */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Direct Phone / WhatsApp *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                required
                value={profileForm.phone}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10'
                }`}
                placeholder="9876543210"
              />
            </div>
          </div>
        </form>

        {/* SECTION B: WORK INFORMATION (READ-ONLY) */}
        <div className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
          isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Work & Assignment Info
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              Read-Only
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-400 font-medium">Assigned Role</span>
              <span className="font-bold text-slate-800 mt-0.5 block capitalize">
                {currentUser?.companyRole || currentUser?.role || 'Sales Agent'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-400 font-medium">Department / Vertical</span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                {currentUser?.industryType || 'Sales & Client Relations'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-400 font-medium">Employee / Agent ID</span>
              <span className="font-mono font-bold text-indigo-600 mt-0.5 block">
                {currentUser?.usercode || 'AGT-SYSTEM'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-400 font-medium">Reporting Manager</span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                {currentUser?.managerName || 'Direct to Organization Owner'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-400 font-medium">Joining Date</span>
              <span className="font-semibold text-slate-700 mt-0.5 block">
                {joiningDateFormatted}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="block text-[11px] text-slate-400 font-medium">Account Status</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 mt-0.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                {currentUser?.employeeStatus || 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION C: MY PERFORMANCE (COMPACT SUMMARY) */}
        <div className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
          isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
              }`}>
                <BarChart2 className="w-4 h-4" />
              </div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                My Performance Overview
              </h3>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              <span>Pipeline</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium block">Total Leads</span>
              <span className="text-lg font-black text-slate-900 mt-0.5 block">
                {analytics?.totalLeads ?? 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
              <span className="text-[11px] text-amber-700 font-medium block">Follow-ups</span>
              <span className="text-lg font-black text-amber-800 mt-0.5 block">
                {analytics?.todayFollowUps ?? analytics?.byStatus?.follow_up ?? 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <span className="text-[11px] text-emerald-700 font-medium block">Deals Won</span>
              <span className="text-lg font-black text-emerald-800 mt-0.5 block">
                {analytics?.byStatus?.closed ?? 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
              <span className="text-[11px] text-indigo-700 font-medium block">Conversion</span>
              <span className="text-lg font-black text-indigo-800 mt-0.5 block">
                {analytics?.conversionRate ?? 0}%
              </span>
            </div>
          </div>
        </div>

        {/* SECTION D: PREFERENCES */}
        <form onSubmit={handleSavePreferences} className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
          isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <Globe className="w-4 h-4" />
              </div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Preferences & Formatting
              </h3>
            </div>
            <button
              type="submit"
              disabled={savingPreferences}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingPreferences ? 'Saving...' : 'Save'}</span>
            </button>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Default Operating Currency
            </label>
            <select
              value={localizationForm.currencyCode}
              onChange={(e) => {
                const sel = GLOBAL_CURRENCIES.find((c) => c.code === e.target.value);
                setLocalizationForm((prev) => ({
                  ...prev,
                  currencyCode: e.target.value,
                  currencySymbol: sel ? sel.symbol : '₹',
                }));
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'
              }`}
            >
              {GLOBAL_CURRENCIES.map((cur) => (
                <option key={cur.code} value={cur.code}>
                  {cur.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preferencesForm.showFollowUpOnCreate}
                onChange={(e) =>
                  setPreferencesForm((prev) => ({ ...prev, showFollowUpOnCreate: e.target.checked }))
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-xs font-medium text-slate-700">
                Prompt to schedule a follow-up immediately after creating a new lead
              </span>
            </label>
          </div>
        </form>

        {/* SECTION E: SECURITY & PASSWORD */}
        <form onSubmit={handleChangePassword} className={`p-6 rounded-2xl border shadow-sm space-y-4 lg:col-span-2 ${
          isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <Lock className="w-4 h-4" />
              </div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Account Security & Password
              </h3>
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Current Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-xs font-medium outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-xs font-medium outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10'
                  }`}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10'
                  }`}
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">
                Two-Factor Authentication:{' '}
                <strong className={currentUser?.twoFactorEnabled ? 'text-emerald-600' : 'text-amber-600'}>
                  {currentUser?.twoFactorEnabled ? 'Status: Enabled ✅' : 'Status: Disabled ⚠️'}
                </strong>
              </span>
            </div>

            {isTenantOwner && (
              currentUser?.twoFactorEnabled ? (
                <button
                  type="button"
                  onClick={() => setShowDisable2FAModal(true)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1 cursor-pointer bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-200"
                >
                  <Lock size={13} />
                  <span>Disable 2FA</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpen2FASetup}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200"
                >
                  <ShieldCheck size={13} />
                  <span>Enable 2FA</span>
                  <ArrowUpRight size={13} />
                </button>
              )
            )}
          </div>
        </form>

        {/* SECTION F: ORGANIZATION MANAGEMENT (OWNERS / ADMINS ONLY) */}
        {isTenantOwner && (
          <form onSubmit={handleSaveCompany} className={`p-6 rounded-2xl border shadow-sm space-y-4 lg:col-span-2 ${
            isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3.5 ${
              isDark ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Organization & Entity Profile
                  </h3>
                  <p className="text-[11px] text-slate-500">Administrator controls for enterprise identity</p>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingCompany}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingCompany ? 'Saving...' : 'Save Organization'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-700">Company Legal Name *</label>
                <input
                  type="text"
                  required
                  value={companyForm.companyName}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium bg-white border-slate-200 text-slate-900 focus:border-indigo-600 outline-none"
                  placeholder="Acme Real Estate Pvt Ltd"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-700">Official Support Phone</label>
                <input
                  type="tel"
                  value={companyForm.companyPhone}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyPhone: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium bg-white border-slate-200 text-slate-900 focus:border-indigo-600 outline-none"
                  placeholder="+91 9876543210"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-700">Official Support Email</label>
                <input
                  type="email"
                  value={companyForm.companyEmail}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyEmail: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium bg-white border-slate-200 text-slate-900 focus:border-indigo-600 outline-none"
                  placeholder="support@acme.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-700">Company Website</label>
                <input
                  type="url"
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, website: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium bg-white border-slate-200 text-slate-900 focus:border-indigo-600 outline-none"
                  placeholder="https://acme.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1.5 text-slate-700">Registered Office Address</label>
                <input
                  type="text"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium bg-white border-slate-200 text-slate-900 focus:border-indigo-600 outline-none"
                  placeholder="Suite 400, Business Bay, Sector 62"
                />
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Disable 2FA Confirmation Modal */}
      {showDisable2FAModal && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => {
            setShowDisable2FAModal(false);
            setDisablePassword('');
          }}
        >
          <div
            className="w-full max-w-md bg-[#0f172a] text-white border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <Lock className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Disable Two-Factor Auth</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDisable2FAModal(false);
                  setDisablePassword('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Disabling 2FA reduces account security. Enter your account password to confirm:
            </p>

            <form onSubmit={handleDisable2FA} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Account Password</label>
                <input
                  type="password"
                  required
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium bg-slate-900 border-slate-700 text-white focus:border-red-500 outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowDisable2FAModal(false);
                    setDisablePassword('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disabling2FA || !disablePassword}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all disabled:opacity-50"
                >
                  {disabling2FA ? 'Disabling...' : 'Confirm & Disable 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
