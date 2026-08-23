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
      <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner shadow-amber-500/20">
            {currentAvatar.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">{profileForm.name || 'Organization Administrator'}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                {currentUser?.role === 'superadmin' ? 'Super Admin' : currentUser?.role === 'admin' ? 'Admin' : 'Executive'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
              <span>{profileForm.email || 'admin@coresetu.com'}</span>
              <span>•</span>
              <span>{companyForm.companyName || 'CoreSetu OS Command Center'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Multi-Tenant Enterprise Node</span>
          </div>
        </div>
      </div>

      {/* Grid: Profile Details & Company Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. PERSONAL PROFILE */}
        <form onSubmit={handleSaveProfile} className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Personal Profile & Identity</h3>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm shadow-amber-500/20 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>

          {/* Avatar Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">Executive Avatar Badge</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setProfileForm((prev) => ({ ...prev, avatarIcon: av.id }))}
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                    profileForm.avatarIcon === av.id
                      ? 'bg-amber-500/20 border-amber-500/60 shadow-sm shadow-amber-500/20 text-amber-300'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <span className="text-lg">{av.emoji}</span>
                  <span className="text-[9px] font-semibold truncate w-full text-center">{av.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Email Address (Read-only)</label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={profileForm.email}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 cursor-not-allowed font-mono"
                  />
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 absolute right-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Direct Phone / WhatsApp</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Currency Preference */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Primary Operating Currency</label>
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
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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
        <form onSubmit={handleSaveCompany} className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Organization & Entity Details</h3>
            </div>
            <button
              type="submit"
              disabled={savingCompany}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingCompany ? 'Saving...' : 'Save Org Info'}</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Company / Organization Legal Name</label>
              <input
                type="text"
                value={companyForm.companyName}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="e.g. CoreSetu Technologies Pvt Ltd"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Official Support Email</label>
                <input
                  type="email"
                  value={companyForm.companyEmail}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyEmail: e.target.value }))}
                  placeholder="contact@company.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Official Company Phone</label>
                <input
                  type="text"
                  value={companyForm.companyPhone}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyPhone: e.target.value }))}
                  placeholder="+91 80000 00000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Company Website URL</label>
              <input
                type="url"
                value={companyForm.website}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="https://yourcompany.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Headquarters Address</label>
              <input
                type="text"
                value={companyForm.address}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Street address, Suite, Level"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">City</label>
                <input
                  type="text"
                  value={companyForm.city}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">State</label>
                <input
                  type="text"
                  value={companyForm.state}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, state: e.target.value }))}
                  placeholder="State"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">Zip Code</label>
                <input
                  type="text"
                  value={companyForm.zipCode}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, zipCode: e.target.value }))}
                  placeholder="Zip"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 3. SECURITY & CREDENTIAL MANAGEMENT */}
      <form onSubmit={handleChangePassword} className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Account Password & Security</h3>
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shadow-sm shadow-purple-600/20 disabled:opacity-50"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPass ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter current password"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono pr-9"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Min 6 characters"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono pr-9"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Re-enter new password"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
