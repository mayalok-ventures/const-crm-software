'use client';

import React, { useState, useEffect } from 'react';
import {
  User, Building2, Shield, Key, Mail, Phone, Globe, MapPin,
  Save, CheckCircle2, Lock, Sparkles, RefreshCw, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

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
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
    avatarIcon: currentUser?.avatarIcon || 'shield_gold',
  });

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

  const [localizationForm, setLocalizationForm] = useState({
    currencyCode: currentUser?.localization?.currencyCode || 'INR',
    currencySymbol: currentUser?.localization?.currencySymbol || '₹',
    countryPhoneCode: currentUser?.localization?.countryPhoneCode || '91',
  });

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

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
    }
  }, [currentUser]);

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
      });

      toast.success('Personal profile updated successfully!');
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Company / Org Update
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const { data } = await api.put('/auth/profile', {
        companyInfo: companyForm,
        localization: localizationForm,
      });

      toast.success('Organization details saved successfully!');
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

  const currentAvatar = AVATAR_OPTIONS.find((a) => a.id === profileForm.avatarIcon) || AVATAR_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`p-5 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-4 transition-all ${
        isDark
          ? 'bg-[#0d1424] border-slate-800'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
            isDark
              ? 'bg-amber-500/10 border border-amber-500/30 shadow-amber-500/20'
              : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
          }`}>
            {currentAvatar.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {profileForm.name || 'Organization Administrator'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                isDark
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {currentUser?.role === 'superadmin' ? 'Super Admin' : currentUser?.role === 'admin' ? 'Admin' : 'Executive'}
              </span>
            </div>
            <p className={`text-xs mt-0.5 flex items-center gap-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>{profileForm.email || 'admin@sahyak.com'}</span>
              <span>•</span>
              <span className="font-medium">{companyForm.companyName || 'CoreSetu OS Command Center'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 ${
            isDark
              ? 'bg-slate-900 border-slate-800 text-slate-300'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Multi-Tenant Enterprise Node</span>
          </div>
        </div>
      </div>

      {/* Grid: Profile Details & Company Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 1. PERSONAL PROFILE */}
        <form onSubmit={handleSaveProfile} className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
          isDark
            ? 'bg-[#0d1424] border-slate-800'
            : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <User className="w-4 h-4" />
              </div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Personal Profile & Identity
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
              Executive Avatar Badge
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
                        ? isDark
                          ? 'bg-amber-500/20 border-amber-500/60 shadow-sm shadow-amber-500/20 text-amber-300'
                          : 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-500/20 font-bold shadow-sm'
                        : isDark
                        ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <span className="text-lg">{av.emoji}</span>
                    <span className="text-[9px] font-medium truncate w-full text-center">{av.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Full Name *
              </label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
                className={`w-full rounded-xl px-3.5 py-2 text-xs transition-all focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-sm'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Email Address (Read-only)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={profileForm.email}
                    className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono cursor-not-allowed ${
                      isDark
                        ? 'bg-slate-950 border border-slate-800 text-slate-400'
                        : 'bg-slate-50 border border-slate-200 text-slate-600'
                    }`}
                  />
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Direct Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono transition-all focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500'
                      : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-sm'
                  }`}
                />
              </div>
            </div>

            {/* Currency Preference */}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Primary Operating Currency
              </label>
              <select
                value={localizationForm.currencyCode}
                onChange={(e) => {
                  const selected = GLOBAL_CURRENCIES.find((c) => c.code === e.target.value);
                  setLocalizationForm((prev) => ({
                    ...prev,
                    currencyCode: selected?.code || 'INR',
                    currencySymbol: selected?.symbol || '₹',
                  }));
                }}
                className={`w-full rounded-xl px-3.5 py-2 text-xs transition-all focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border border-slate-700 text-white focus:border-amber-500'
                    : 'bg-white border border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-sm'
                }`}
              >
                {GLOBAL_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        {/* 2. ORGANIZATION / COMPANY DETAILS */}
        <form onSubmit={handleSaveCompany} className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
          isDark
            ? 'bg-[#0d1424] border-slate-800'
            : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3.5 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Organization & Entity Details
              </h3>
            </div>
            <button
              type="submit"
              disabled={savingCompany}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingCompany ? 'Saving...' : 'Save Org Info'}</span>
            </button>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Company / Organization Legal Name
              </label>
              <input
                type="text"
                value={companyForm.companyName}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="e.g. CoreSetu Technologies Pvt Ltd"
                className={`w-full rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Official Support Email
                </label>
                <input
                  type="email"
                  value={companyForm.companyEmail}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyEmail: e.target.value }))}
                  placeholder="contact@company.com"
                  className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono transition-all focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Official Company Phone
                </label>
                <input
                  type="text"
                  value={companyForm.companyPhone}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyPhone: e.target.value }))}
                  placeholder="+91 80000 00000"
                  className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono transition-all focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Company Website URL
              </label>
              <input
                type="url"
                value={companyForm.website}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="https://yourcompany.com"
                className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono transition-all focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Headquarters Address
              </label>
              <input
                type="text"
                value={companyForm.address}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Street address, Suite, Level"
                className={`w-full rounded-xl px-3.5 py-2 text-xs transition-all focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                }`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  City
                </label>
                <input
                  type="text"
                  value={companyForm.city}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                  className={`w-full rounded-xl px-3 py-1.5 text-xs transition-all focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  State
                </label>
                <input
                  type="text"
                  value={companyForm.state}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, state: e.target.value }))}
                  placeholder="State"
                  className={`w-full rounded-xl px-3 py-1.5 text-xs transition-all focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Zip Code
                </label>
                <input
                  type="text"
                  value={companyForm.zipCode}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, zipCode: e.target.value }))}
                  placeholder="Zip"
                  className={`w-full rounded-xl px-3 py-1.5 text-xs font-mono transition-all focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                  }`}
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 3. SECURITY & CREDENTIAL MANAGEMENT */}
      <form onSubmit={handleChangePassword} className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
        isDark
          ? 'bg-[#0d1424] border-slate-800'
          : 'bg-white border-slate-200'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3.5 ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'
            }`}>
              <Lock className="w-4 h-4" />
            </div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Account Password & Security
            </h3>
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-sm shadow-purple-600/20 disabled:opacity-50"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPass ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter current password"
                className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono pr-9 transition-all focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 shadow-sm'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Min 6 characters"
                className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono pr-9 transition-all focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 shadow-sm'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Re-enter new password"
              className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono transition-all focus:outline-none ${
                isDark
                  ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500'
                  : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 shadow-sm'
              }`}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
