'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser, clearAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import AvatarPickerModal from '@/components/AvatarPickerModal';
import { AVATAR_ICONS, getAvatarConfig, UserAvatarRenderer } from '@/lib/avatarIcons';
import {
  User, Shield, Link2, Copy, LogOut, Star, Building2, Users,
  CheckCircle2, ShieldCheck, Key, Edit2, Plus, Trash2, X, Check,
  Briefcase, IndianRupee, MessageCircle, AlertCircle, Zap, ShieldAlert,
  Lock, Clock, UserPlus, QrCode, Layers, RotateCcw, Sliders, ShieldQuestion,
  ChevronRight, Crown, Settings, FileText, CheckSquare, Hash, Calendar as CalendarIcon, ListFilter, Globe,
  ArrowUp, ArrowDown, Eye, EyeOff, Sparkles
} from 'lucide-react';

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
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY ¥)' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (CNY ¥)' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real (BRL R$)' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand (ZAR R)' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit (MYR RM)' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso (PHP ₱)' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht (THB ฿)' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah (IDR Rp)' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong (VND ₫)' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee (PKR ₨)' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (BDT ৳)' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee (LKR Rs)' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee (NPR Rs)' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar (KWD KD)' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal (QAR QR)' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial (OMR)' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar (BHD BD)' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar (NZ$)' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc (CHF)' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona (SEK kr)' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone (NOK kr)' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone (DKK kr)' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty (PLN zł)' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira (TRY ₺)' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound (EGP E£)' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (NGN ₦)' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling (KES KSh)' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi (GHS GH₵)' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso (MXN $)' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso (ARS $)' },
  { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso (CLP $)' },
  { code: 'COP', symbol: 'CO$', name: 'Colombian Peso (COP $)' },
  { code: 'PEN', symbol: 'S/.', name: 'Peruvian Sol (PEN S/.)' },
];

const GLOBAL_COUNTRY_CODES = [
  { code: '91', country: 'India (+91)' },
  { code: '1', country: 'United States / Canada (+1)' },
  { code: '44', country: 'United Kingdom (+44)' },
  { code: '971', country: 'United Arab Emirates (+971)' },
  { code: '966', country: 'Saudi Arabia (+966)' },
  { code: '61', country: 'Australia (+61)' },
  { code: '65', country: 'Singapore (+65)' },
  { code: '49', country: 'Germany (+49)' },
  { code: '33', country: 'France (+33)' },
  { code: '39', country: 'Italy (+39)' },
  { code: '34', country: 'Spain (+34)' },
  { code: '31', country: 'Netherlands (+31)' },
  { code: '41', country: 'Switzerland (+41)' },
  { code: '46', country: 'Sweden (+46)' },
  { code: '47', country: 'Norway (+47)' },
  { code: '45', country: 'Denmark (+45)' },
  { code: '81', country: 'Japan (+81)' },
  { code: '82', country: 'South Korea (+82)' },
  { code: '86', country: 'China (+86)' },
  { code: '852', country: 'Hong Kong (+852)' },
  { code: '60', country: 'Malaysia (+60)' },
  { code: '63', country: 'Philippines (+63)' },
  { code: '66', country: 'Thailand (+66)' },
  { code: '62', country: 'Indonesia (+62)' },
  { code: '84', country: 'Vietnam (+84)' },
  { code: '92', country: 'Pakistan (+92)' },
  { code: '880', country: 'Bangladesh (+880)' },
  { code: '94', country: 'Sri Lanka (+94)' },
  { code: '977', country: 'Nepal (+977)' },
  { code: '965', country: 'Kuwait (+965)' },
  { code: '974', country: 'Qatar (+974)' },
  { code: '968', country: 'Oman (+968)' },
  { code: '973', country: 'Bahrain (+973)' },
  { code: '20', country: 'Egypt (+20)' },
  { code: '27', country: 'South Africa (+27)' },
  { code: '234', country: 'Nigeria (+234)' },
  { code: '254', country: 'Kenya (+254)' },
  { code: '233', country: 'Ghana (+233)' },
  { code: '55', country: 'Brazil (+55)' },
  { code: '52', country: 'Mexico (+52)' },
  { code: '54', country: 'Argentina (+54)' },
  { code: '56', country: 'Chile (+56)' },
  { code: '57', country: 'Colombia (+57)' },
  { code: '51', country: 'Peru (+51)' },
  { code: '64', country: 'New Zealand (+64)' },
  { code: '90', country: 'Turkey (+90)' },
  { code: '48', country: 'Poland (+48)' },
  { code: '353', country: 'Ireland (+353)' },
  { code: '351', country: 'Portugal (+351)' },
  { code: '30', country: 'Greece (+30)' },
  { code: '43', country: 'Austria (+43)' },
  { code: '32', country: 'Belgium (+32)' },
];

const DEFAULT_STAGES = [
  'New Lead',
  'Cold Lead',
  'Warm Lead',
  'Hot Lead',
  'Contacted',
  'Meeting / Demo Scheduled',
  'In Negotiation',
  'Payment Done',
  'Closed / Won',
  'Lost / Dropped'
];

import { getIndustryDefaults } from '@/lib/industryTemplates';

const formatPlanName = (p) => {
  if (!p || p === 'free') return 'Free Trial (10 Leads)';
  const names = {
    basic_solo: 'Basic Solo Plan',
    smart_solo: 'Smart Solo Plan',
    power_solo: 'Power Solo Plan',
    team_starter: 'Team Starter Plan',
    business: 'Business Agency Plan',
    enterprise: 'Enterprise Command Plan',
    custom_enterprise: 'Custom Enterprise Plan',
    starter: 'Starter Plan (Legacy)',
    growth: 'Growth Plan (Legacy)',
    pro: 'Pro Plan (Legacy)',
  };
  return names[p] || `${String(p).replace(/_/g, ' ').toUpperCase()} Plan`;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(() => getUser());
  const [loading, setLoading] = useState(() => !getUser());
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'security' | 'customization' | 'organization'

  // Personal Info Form
  const [profileForm, setProfileForm] = useState(() => {
    const u = getUser();
    return { name: u?.name || '', phone: u?.phone || '' };
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Universal Localization state
  const [localizationForm, setLocalizationForm] = useState({
    currencyCode: 'INR',
    currencySymbol: '₹',
    countryPhoneCode: '91',
  });
  const [savingLocalization, setSavingLocalization] = useState(false);

  // Security Form (Password change)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  // 2FA TOTP Authenticator state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [loading2FASetup, setLoading2FASetup] = useState(false);
  const [enabling2FA, setEnabling2FA] = useState(false);

  // Custom Pipeline Stages state
  const [pipelineStages, setPipelineStages] = useState(DEFAULT_STAGES);
  const [newStageInput, setNewStageInput] = useState('');
  const [editingStageIdx, setEditingStageIdx] = useState(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [savingStages, setSavingStages] = useState(false);

  // Fully Customizable Form Engine state
  const [formSchema, setFormSchema] = useState([]);
  const [editingFieldIdx, setEditingFieldIdx] = useState(null);
  const [editingFieldData, setEditingFieldData] = useState(null);
  const [newField, setNewField] = useState({
    label: '',
    fieldType: 'text',
    optionsStr: '',
    isRequired: false,
    enableConditional: false,
    dependsOnField: '',
    dependsOnValue: '',
  });
  const [savingSchema, setSavingSchema] = useState(false);

  // Agency / Team state
  const [agentsData, setAgentsData] = useState({ company: null, agents: [] });
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    companyName: '', companyPhone: '', companyEmail: '', companyAddress: '',
    reraNumber: '', gstNumber: '', website: '', leadSharingMode: 'common_pool',
    incentivePerConversion: 0,
  });
  const [savingCompany, setSavingCompany] = useState(false);

  // Avatar Icon selection state (10 presets)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const handleSelectAvatar = async (avatarId) => {
    setSavingAvatar(true);
    try {
      const { data } = await api.put('/auth/profile', { avatarIcon: avatarId });
      toast.success('Profile avatar icon updated! 🌟');
      setShowAvatarPicker(false);
      setUser(prev => ({ ...prev, avatarIcon: avatarId }));
      try {
        const u = localStorage.getItem('user');
        if (u) {
          const parsed = JSON.parse(u);
          parsed.avatarIcon = avatarId;
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      } catch {}
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      setTwoFactorEnabled(data.twoFactorEnabled || false);
      setProfileForm({
        name: data.name || '',
        phone: data.phone || '',
      });

      if (data.localization) {
        setLocalizationForm({
          currencyCode: data.localization.currencyCode || 'INR',
          currencySymbol: data.localization.currencySymbol || '₹',
          countryPhoneCode: data.localization.countryPhoneCode || '91',
        });
      }

      const industryDefaults = getIndustryDefaults(data.industryType);

      if (data.pipelineStages && Array.isArray(data.pipelineStages) && data.pipelineStages.length > 0) {
        setPipelineStages(data.pipelineStages);
      } else if (data.customPipelineStages && Array.isArray(data.customPipelineStages) && data.customPipelineStages.length > 0) {
        setPipelineStages(data.customPipelineStages);
      } else {
        setPipelineStages(industryDefaults.pipelineStages);
      }

      if (data.leadFormSchema && Array.isArray(data.leadFormSchema) && data.leadFormSchema.length > 0) {
        setFormSchema([...data.leadFormSchema].sort((a, b) => (a.order || 0) - (b.order || 0)));
      } else {
        setFormSchema(industryDefaults.leadFormSchema);
      }

      if (data.companyInfo || data.companySettings) {
        setCompanyForm({
          companyName: data.companyInfo?.companyName || '',
          companyPhone: data.companyInfo?.companyPhone || '',
          companyEmail: data.companyInfo?.companyEmail || '',
          companyAddress: data.companyInfo?.companyAddress || '',
          reraNumber: data.companyInfo?.reraNumber || '',
          gstNumber: data.companyInfo?.gstNumber || '',
          website: data.companyInfo?.website || '',
          leadSharingMode: data.companySettings?.leadSharingMode || 'common_pool',
          incentivePerConversion: data.companySettings?.incentivePerConversion || 0,
        });
      }

      const isOwnerOrMember = data.workStatus === 'company_owner' || data.companyRole === 'owner' || data.companyId;
      if (isOwnerOrMember && data.role !== 'superadmin' && !data.isAdmin) {
        fetchAgents();
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const { data } = await api.get('/company/agents');
      setAgentsData(data);
    } catch {}
    finally {
      setLoadingAgents(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }
    }
    fetchProfile();
  }, []);

  const copyUsercode = () => {
    if (!user?.usercode) return;
    navigator.clipboard.writeText(user.usercode);
    toast.success(`Usercode ${user.usercode} copied! 📋`);
  };

  // Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put('/auth/profile', profileForm);
      toast.success(data.message || 'Profile updated ✅');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Universal Localization Save
  const handleSaveLocalization = async (e) => {
    e.preventDefault();
    setSavingLocalization(true);
    try {
      const { data } = await api.put('/auth/profile', {
        localization: localizationForm,
      });
      toast.success('Regional & Currency preferences updated ✅');
      try {
        const u = localStorage.getItem('user');
        if (u) {
          const parsed = JSON.parse(u);
          parsed.localization = localizationForm;
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      } catch {}
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update regional preferences');
    } finally {
      setSavingLocalization(false);
    }
  };

  // Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      return toast.error('New passwords do not match');
    }
    if (passwordForm.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setSavingPassword(true);
    try {
      const { data } = await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success(data.message || 'Password changed successfully ✅');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  // 2FA TOTP Setup
  const handleOpen2FASetup = async () => {
    setLoading2FASetup(true);
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setTotpSetupData(data);
      setShow2FAModal(true);
    } catch {
      toast.error('Failed to initialize 2FA Authenticator setup');
    } finally {
      setLoading2FASetup(false);
    }
  };

  const handleVerifyAndEnable2FA = async (e) => {
    e.preventDefault();
    if (!totpVerifyCode || totpVerifyCode.length < 6) {
      return toast.error('Please enter the 6-digit code from your Authenticator app');
    }

    setEnabling2FA(true);
    try {
      const { data } = await api.post('/auth/2fa/enable', {
        secret: totpSetupData.secret,
        token: totpVerifyCode.trim(),
      });
      toast.success(data.message);
      setTwoFactorEnabled(true);
      setShow2FAModal(false);
      setTotpVerifyCode('');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('2fa-status-changed'));
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setEnabling2FA(false);
    }
  };

  // Pipeline Stages Handlers
  const moveStage = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= pipelineStages.length) return;
    const updated = [...pipelineStages];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setPipelineStages(updated);
  };

  const handleAddStage = (e) => {
    e.preventDefault();
    if (!newStageInput.trim()) return;
    if (pipelineStages.includes(newStageInput.trim())) {
      return toast.error('Stage already exists');
    }
    setPipelineStages(prev => [...prev, newStageInput.trim()]);
    setNewStageInput('');
  };

  const handleStartEditStage = (idx) => {
    setEditingStageIdx(idx);
    setEditingStageName(pipelineStages[idx]);
  };

  const handleSaveEditStage = (idx) => {
    if (!editingStageName.trim()) return toast.error('Stage name cannot be empty');
    const updated = [...pipelineStages];
    updated[idx] = editingStageName.trim();
    setPipelineStages(updated);
    setEditingStageIdx(null);
    setEditingStageName('');
  };

  const handleDeleteStage = (index) => {
    if (pipelineStages.length <= 1) return toast.error('At least one stage is required');
    setPipelineStages(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetStages = () => {
    if (!window.confirm('Reset pipeline stages to industry defaults?')) return;
    const defaults = getIndustryDefaults(user?.industryType).pipelineStages;
    setPipelineStages(defaults);
    toast.success('Reset to industry defaults! Click "Save Pipeline Stages" to persist.');
  };

  const handleSavePipelineStages = async () => {
    setSavingStages(true);
    try {
      const { data } = await api.put('/auth/pipeline-stages', { stages: pipelineStages });
      toast.success(data.message);
      fetchProfile();
    } catch {
      toast.error('Failed to save pipeline stages');
    } finally {
      setSavingStages(false);
    }
  };

  // Fully Customizable Form Engine Handlers
  const moveField = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= formSchema.length) return;

    const updated = [...formSchema];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    // Recalculate order
    const ordered = updated.map((f, i) => ({ ...f, order: i + 1 }));
    setFormSchema(ordered);
  };

  const toggleFieldHidden = (idx) => {
    const field = formSchema[idx];
    if (['name', 'phone'].includes(field.fieldId)) {
      return toast.error('Name and Phone are strictly mandatory system keys and cannot be hidden.');
    }
    const updated = [...formSchema];
    updated[idx] = { ...field, isHidden: !field.isHidden };
    setFormSchema(updated);
  };

  const handleOpenEditField = (idx) => {
    const field = formSchema[idx];
    setEditingFieldIdx(idx);
    setEditingFieldData({
      ...field,
      optionsStr: Array.isArray(field.options) ? field.options.join(', ') : '',
      enableConditional: Boolean(field.dependsOn?.field),
      dependsOnField: field.dependsOn?.field || '',
      dependsOnValue: field.dependsOn?.value || '',
    });
  };

  const handleSaveEditedField = (e) => {
    e.preventDefault();
    if (!editingFieldData.label.trim()) return toast.error('Label is required');

    let parsedOptions = editingFieldData.options || [];
    if (editingFieldData.fieldType === 'dropdown') {
      parsedOptions = (editingFieldData.optionsStr || '').split(',').map(o => o.trim()).filter(Boolean);
      if (parsedOptions.length === 0 && !editingFieldData.isSystem) {
        return toast.error('Please enter at least one dropdown option');
      }
    }

    const isMandatory = ['name', 'phone'].includes(editingFieldData.fieldId);
    const dependsOn = editingFieldData.enableConditional && editingFieldData.dependsOnField
      ? { field: editingFieldData.dependsOnField.trim(), value: (editingFieldData.dependsOnValue || '').trim() }
      : { field: null, value: null };

    const updated = [...formSchema];
    updated[editingFieldIdx] = {
      ...editingFieldData,
      label: editingFieldData.label.trim(),
      options: parsedOptions,
      isRequired: isMandatory || editingFieldData.fieldId === 'followUpDate' ? true : Boolean(editingFieldData.isRequired),
      isHidden: isMandatory ? false : Boolean(editingFieldData.isHidden),
      dependsOn,
    };

    setFormSchema(updated);
    setEditingFieldIdx(null);
    setEditingFieldData(null);
    toast.success('Field updated in layout! Click "Save Form Layout" to persist.');
  };

  const handleDeleteField = (idx) => {
    const field = formSchema[idx];
    if (field.isSystem) {
      return toast.error('Default system fields cannot be deleted. You can hide them instead.');
    }
    const updated = formSchema.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i + 1 }));
    setFormSchema(updated);
    toast.success(`Removed field "${field.label}"`);
  };

  const handleAddField = (e) => {
    e.preventDefault();
    if (!newField.label.trim()) return toast.error('Field label is required');

    const cleanBase = newField.label.toLowerCase().replace(/[^a-z0-9_]/g, '_').trim();
    const fieldId = formSchema.some(f => f.fieldId === cleanBase)
      ? `${cleanBase}_${Date.now().toString().slice(-4)}`
      : cleanBase;

    let parsedOptions = [];
    if (newField.fieldType === 'dropdown') {
      parsedOptions = newField.optionsStr.split(',').map(o => o.trim()).filter(Boolean);
      if (parsedOptions.length === 0) {
        return toast.error('Please enter at least one comma-separated option for dropdown');
      }
    }

    const dependsOn = newField.enableConditional && newField.dependsOnField
      ? { field: newField.dependsOnField.trim(), value: (newField.dependsOnValue || '').trim() }
      : { field: null, value: null };

    const created = {
      fieldId,
      label: newField.label.trim(),
      fieldType: newField.fieldType,
      options: parsedOptions,
      isRequired: Boolean(newField.isRequired),
      isSystem: false,
      isHidden: false,
      order: formSchema.length + 1,
      dependsOn,
    };

    setFormSchema(prev => [...prev, created]);
    setNewField({
      label: '',
      fieldType: 'text',
      optionsStr: '',
      isRequired: false,
      enableConditional: false,
      dependsOnField: '',
      dependsOnValue: '',
    });
    toast.success(`Added "${created.label}" to layout!`);
  };

  const handleSaveFormSchema = async () => {
    setSavingSchema(true);
    try {
      const { data } = await api.put('/auth/form-schema', { schema: formSchema });
      toast.success(data.message || 'Customizable form layout saved ✅');
      try {
        const u = localStorage.getItem('user');
        if (u) {
          const parsed = JSON.parse(u);
          parsed.leadFormSchema = data.leadFormSchema || formSchema;
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      } catch {}
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save form layout');
    } finally {
      setSavingSchema(false);
    }
  };

  const handleResetFormSchema = () => {
    if (!window.confirm('Reset all form fields to standard industry defaults? Your custom field additions will be cleared.')) return;
    const defaults = getIndustryDefaults(user?.industryType).leadFormSchema;
    setFormSchema(defaults);
    toast.success('Form layout reset to defaults! Click "Save Form Layout" to persist.');
  };

  // Organization & Team Handlers
  const handleSaveCompanySettings = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      await api.put('/company/settings', {
        companyInfo: {
          companyName: companyForm.companyName,
          companyPhone: companyForm.companyPhone,
          companyEmail: companyForm.companyEmail,
          companyAddress: companyForm.companyAddress,
          reraNumber: companyForm.reraNumber,
          gstNumber: companyForm.gstNumber,
          website: companyForm.website,
        },
        companySettings: {
          leadSharingMode: companyForm.leadSharingMode,
          incentivePerConversion: Number(companyForm.incentivePerConversion) || 0,
        }
      });
      toast.success('Organization settings saved ✅');
      setShowCompanyModal(false);
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setCreatingAgent(true);
    try {
      const { data } = await api.post('/company/agents', newAgentForm);
      toast.success(data.message);
      setShowCreateAgentModal(false);
      setNewAgentForm({ name: '', email: '', phone: '', password: '' });
      fetchAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create team member');
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleJoinCompany = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return toast.error('Please enter the Organization Usercode');

    setJoining(true);
    try {
      const { data } = await api.post('/company/join', { usercode: joinCode.trim() });
      toast.success(data.message);
      setShowJoinModal(false);
      setJoinCode('');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join organization');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveCompany = async () => {
    const isVoluntary = user.companyJoinMethod === 'joined_voluntarily' || !user.companyJoinMethod || user.companyJoinMethod === 'none';
    const confirmMsg = isVoluntary
      ? 'Are you sure you want to leave your organization? You will return to solo status.'
      : 'You were added directly by the organization owner. Submitting this will request admin approval to detach. Proceed?';

    if (!confirm(confirmMsg)) return;

    try {
      const { data } = await api.post('/company/leave');
      toast.success(data.message);
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave organization');
    }
  };

  const handleApproveLeave = async (agentId) => {
    try {
      const { data } = await api.post(`/company/agents/${agentId}/approve-leave`);
      toast.success(data.message);
      fetchAgents();
    } catch {
      toast.error('Failed to approve leave request');
    }
  };

  const handleRejectLeave = async (agentId) => {
    try {
      const { data } = await api.post(`/company/agents/${agentId}/reject-leave`);
      toast.success(data.message);
      fetchAgents();
    } catch {
      toast.error('Failed to reject leave request');
    }
  };

  const handleToggleAgentWhatsApp = async (agentId, currentVal) => {
    try {
      await api.put(`/company/agents/${agentId}/permissions`, {
        allowCompanyWhatsApp: !currentVal,
      });
      toast.success('WhatsApp access updated');
      fetchAgents();
    } catch {
      toast.error('Failed to update permission');
    }
  };

  const handleToggleAgentExport = async (agentId, currentVal) => {
    const nextVal = currentVal === 'restricted' ? 'allowed' : 'restricted';
    try {
      await api.put(`/company/agents/${agentId}/permissions`, {
        exportPermissionStatus: nextVal,
      });
      toast.success(`Export permission set to ${nextVal.toUpperCase()} 📁`);
      fetchAgents();
    } catch {
      toast.error('Failed to update export permission');
    }
  };

  const handleRemoveAgent = async (agentId, agentName) => {
    if (!confirm(`Are you sure you want to detach ${agentName} from your organization?`)) return;
    try {
      await api.delete(`/company/agents/${agentId}`);
      toast.success(`Detached ${agentName}`);
      fetchAgents();
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const logout = () => {
    clearAuth();
    router.replace('/login');
  };

  const isSuperAdmin = user?.role === 'superadmin' || user?.isAdmin;
  const isCompanyOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';
  const isAgentInCompany = user?.companyRole === 'agent' && user?.companyId;
  const isSoloAgent = user?.workStatus === 'independent_agent' && !user?.companyId;

  if (loading) return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Account & Command Hub</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Manage profile credentials, security protocols, form builder & organization roster
            </p>
          </div>
          <button onClick={logout} className="btn btn-ghost btn-sm" style={{ gap: 6, color: 'var(--red)', borderRadius: 10 }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>

        <div className="page-content">
          {/* User Profile Hero Card — Professional & Responsive Redesign */}
          <div className="card" style={{
            padding: '22px 24px',
            marginBottom: 20,
            background: 'linear-gradient(135deg, var(--card, #ffffff) 0%, var(--surface, #f8fafc) 100%)',
            border: '1.5px solid var(--border)',
            borderRadius: 20,
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                {/* Interactive Avatar Icon */}
                <div
                  onClick={() => !isSuperAdmin && setShowAvatarPicker(true)}
                  style={{
                    position: 'relative',
                    cursor: isSuperAdmin ? 'default' : 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  className={!isSuperAdmin ? 'hover:scale-105' : ''}
                  title={isSuperAdmin ? 'Super Administrator' : 'Click to customize profile icon (10 styles)'}
                >
                  {isSuperAdmin ? (
                    <div style={{
                      width: 62,
                      height: 62,
                      borderRadius: 18,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      boxShadow: '0 4px 18px rgba(245,158,11,0.4)',
                      border: '2px solid rgba(255,255,255,0.3)',
                    }}>
                      <Crown size={30} />
                    </div>
                  ) : (
                    <>
                      <UserAvatarRenderer avatarId={user?.avatarIcon || 'avatar-1'} size={62} iconSize={28} />
                      <div style={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--card, #ffffff)',
                        border: '2px solid var(--border, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                        color: 'var(--accent, #6366f1)',
                      }}>
                        <Edit2 size={11} strokeWidth={2.5} />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>
                      {user?.name || 'Sales Professional'}
                    </h2>
                    <span className="badge badge-tag" style={{
                      fontSize: 11,
                      background: isSuperAdmin ? 'rgba(245,158,11,0.15)' : 'rgba(79,70,229,0.1)',
                      color: isSuperAdmin ? '#f59e0b' : 'var(--accent)',
                      fontWeight: 700,
                      borderRadius: 8,
                      padding: '3px 8px'
                    }}>
                      {isSuperAdmin ? '👑 Super Admin' : (isCompanyOwner ? '🏢 Organization Owner' : (isAgentInCompany ? '💼 Team Member' : '👤 Solo Representative'))}
                    </span>
                  </div>

                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {user?.email || 'No email set'} {user?.phone ? `• +${user.phone}` : ''} {!isSuperAdmin && `• Industry: ${user?.industryType || 'Agency'}`}
                  </p>

                  {!isSuperAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <button
                        onClick={() => setShowAvatarPicker(true)}
                        style={{
                          background: 'rgba(99,102,241,0.08)',
                          border: '1px solid rgba(99,102,241,0.25)',
                          borderRadius: 8,
                          padding: '3px 8px',
                          color: 'var(--accent)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <Sparkles size={12} /> {getAvatarConfig(user?.avatarIcon).name} {getAvatarConfig(user?.avatarIcon).emoji} • Change Icon
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {isSuperAdmin ? (
                  <Link
                    href="/superadmin-dashboard"
                    className="btn btn-primary"
                    style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 800, gap: 6, borderRadius: 10 }}
                  >
                    <Crown size={16} /> Open SuperAdmin Command Center
                  </Link>
                ) : (
                  user?.usercode && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--surface)',
                      border: '1.5px solid var(--accent)',
                      padding: '6px 12px',
                      borderRadius: 10,
                    }}>
                      <div>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
                          Unique Usercode
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)' }}>
                          {user.usercode}
                        </span>
                      </div>
                      <button onClick={copyUsercode} title="Copy code" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}>
                        <Copy size={15} />
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              CURRENT PLAN & BILLING CARD (Prominent Plan Upgrade CTA)
             ───────────────────────────────────────────────────────────── */}
          {!isSuperAdmin && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(147,51,234,0.08) 100%)',
              border: '1.5px solid rgba(99,102,241,0.35)',
              borderRadius: 18,
              padding: '20px 22px',
              marginBottom: 24,
              boxShadow: '0 8px 24px -4px rgba(79,70,229,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(79,70,229,0.4)'
                  }}>
                    <Zap size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.6 }}>
                        Current Subscription
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        textTransform: 'uppercase',
                        background: user?.subscriptionLifecycle?.isLocked
                          ? 'rgba(239,68,68,0.2)'
                          : (user?.subscriptionLifecycle?.isGracePeriod || user?.subscriptionLifecycle?.isExpiringSoon
                            ? 'rgba(245,158,11,0.2)'
                            : 'rgba(34,197,94,0.18)'),
                        color: user?.subscriptionLifecycle?.isLocked
                          ? '#ef4444'
                          : (user?.subscriptionLifecycle?.isGracePeriod || user?.subscriptionLifecycle?.isExpiringSoon
                            ? '#f59e0b'
                            : '#22c55e'),
                        border: `1px solid ${user?.subscriptionLifecycle?.isLocked ? 'rgba(239,68,68,0.4)' : (user?.subscriptionLifecycle?.isGracePeriod ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)')}`
                      }}>
                        {user?.subscriptionLifecycle?.state || (user?.plan === 'free' ? 'FREE TIER' : 'ACTIVE')}
                      </span>
                    </div>
                    <h3 style={{ margin: '3px 0 0', fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>
                      {formatPlanName(user?.subscriptionLifecycle?.effectivePlan || user?.plan)}
                    </h3>
                  </div>
                </div>

                {(() => {
                  const plan = user?.subscriptionLifecycle?.effectivePlan || user?.plan || 'free';
                  const isHighest = plan === 'power_solo' || plan === 'enterprise' || plan === 'custom_enterprise' || plan.includes('power');
                  const isMid = plan !== 'free' && !isHighest;
                  const daysLeft = user?.subscriptionLifecycle?.daysLeft ?? (
                    user?.planEndDate ? Math.max(0, Math.ceil((new Date(user.planEndDate) - new Date()) / (1000 * 60 * 60 * 24))) : 0
                  );

                  if (isHighest) {
                    return (
                      <Link
                        href="/plans"
                        style={{
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 12px',
                          borderRadius: 8,
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#10b981',
                          fontWeight: 700,
                          fontSize: 11,
                          marginLeft: 'auto'
                        }}
                        title="Highest Tier Plan Active. Click to view subscription."
                      >
                        <span>👑</span>
                        <span>{daysLeft}d remaining</span>
                      </Link>
                    );
                  }

                  if (isMid) {
                    return (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: 'rgba(99, 102, 241, 0.12)',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          color: '#818cf8',
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          ⏱️ {daysLeft}d left
                        </span>
                        <Link
                          href="/plans"
                          style={{
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 14px',
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: 12,
                            boxShadow: '0 3px 10px rgba(79,70,229,0.3)',
                          }}
                        >
                          <Sparkles size={14} /> Upgrade Plan <ChevronRight size={14} />
                        </Link>
                      </div>
                    );
                  }

                  return (
                    <Link
                      href="/plans"
                      style={{
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 18px',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 13,
                        boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      <Sparkles size={16} /> Upgrade to Premium <ChevronRight size={16} />
                    </Link>
                  );
                })()}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(99,102,241,0.15)',
                fontSize: 12
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Subscription Cycle</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>
                    {user?.billingCycle || 'Monthly'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    {user?.plan === 'free' ? 'Lead Quota' : 'Time Remaining'}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {user?.plan === 'free' ? (
                      '10 Leads Max Capacity'
                    ) : user?.subscriptionLifecycle?.daysLeft !== null && user?.subscriptionLifecycle?.daysLeft !== undefined ? (
                      user.subscriptionLifecycle.daysLeft > 0
                        ? `${user.subscriptionLifecycle.daysLeft} days remaining`
                        : (user.subscriptionLifecycle.isGracePeriod
                            ? `Grace Period (${user.subscriptionLifecycle.graceDaysLeft}d left)`
                            : 'Plan Expired')
                    ) : (
                      'Active Subscription'
                    )}
                  </span>
                </div>
                {user?.subscriptionLifecycle?.isSubAgent && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Organization Link</span>
                    <span style={{ fontWeight: 700, color: '#818cf8' }}>
                      🏢 Inherited from {user.subscriptionLifecycle.companyName || 'Agency Owner'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULAR TAB-BASED NAVIGATION
             ───────────────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            marginBottom: 20,
            overflowX: 'auto',
            paddingBottom: 4
          }}>
            <button
              onClick={() => setActiveTab('personal')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px 10px 0 0',
                border: 'none',
                background: activeTab === 'personal' ? 'var(--surface)' : 'transparent',
                borderBottom: activeTab === 'personal' ? '3px solid var(--accent)' : '3px solid transparent',
                color: activeTab === 'personal' ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: activeTab === 'personal' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap'
              }}
            >
              <User size={16} /> Personal Info
            </button>

            <button
              onClick={() => setActiveTab('security')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px 10px 0 0',
                border: 'none',
                background: activeTab === 'security' ? 'var(--surface)' : 'transparent',
                borderBottom: activeTab === 'security' ? '3px solid var(--accent)' : '3px solid transparent',
                color: activeTab === 'security' ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: activeTab === 'security' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap'
              }}
            >
              <Shield size={16} /> Security & 2FA
            </button>

            {!isSuperAdmin && (
              <button
                onClick={() => setActiveTab('customization')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px 10px 0 0',
                  border: 'none',
                  background: activeTab === 'customization' ? 'var(--surface)' : 'transparent',
                  borderBottom: activeTab === 'customization' ? '3px solid var(--accent)' : '3px solid transparent',
                  color: activeTab === 'customization' ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: activeTab === 'customization' ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap'
                }}
              >
                <Sliders size={16} /> CRM Customizations
              </button>
            )}

            {!isSuperAdmin && (
              <button
                onClick={() => setActiveTab('organization')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px 10px 0 0',
                  border: 'none',
                  background: activeTab === 'organization' ? 'var(--surface)' : 'transparent',
                  borderBottom: activeTab === 'organization' ? '3px solid var(--accent)' : '3px solid transparent',
                  color: activeTab === 'organization' ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: activeTab === 'organization' ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap'
                }}
              >
                <Building2 size={16} /> Organization / Team
              </button>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: PERSONAL INFO
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
              {/* Card 1: General Account Details */}
              <div className="card" style={{ padding: '20px 18px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={18} color="var(--accent)" /> General Account Details
                </h3>

                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="label">Full Name</label>
                    <input
                      className="input"
                      value={profileForm.name}
                      onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Phone Number (Digits only)</label>
                    <input
                      className="input"
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="e.g. 919999999999"
                    />
                  </div>

                  <button type="submit" disabled={savingProfile} className="btn btn-primary" style={{ alignSelf: 'flex-start', borderRadius: 10, marginTop: 6 }}>
                    {savingProfile ? 'Saving...' : 'Update Details ✅'}
                  </button>
                </form>
              </div>

              {/* Card 2: Professional Profile Avatar (10 Themes) */}
              <div className="card" style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={18} color="var(--accent)" /> Profile Icon & Persona
                    </h3>
                    <span className="badge badge-tag" style={{ fontSize: 10, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', fontWeight: 700 }}>
                      10 Styles Available
                    </span>
                  </div>

                  {(() => {
                    const currentAvatar = getAvatarConfig(user?.avatarIcon || 'avatar-1');
                    const IconComp = currentAvatar.icon;
                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        background: 'var(--surface)',
                        padding: '14px 16px',
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                        marginBottom: 14
                      }}>
                        <div style={{
                          width: 54,
                          height: 54,
                          borderRadius: 16,
                          background: currentAvatar.gradient,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 4px 16px ${currentAvatar.shadow}`,
                          flexShrink: 0
                        }}>
                          <IconComp size={26} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                              {currentAvatar.name}
                            </span>
                            <span style={{ fontSize: 14 }}>{currentAvatar.emoji}</span>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                            {currentAvatar.role}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(true)}
                  className="btn btn-outline"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 10,
                    fontWeight: 700,
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                    background: 'rgba(99,102,241,0.04)'
                  }}
                >
                  <Sparkles size={16} /> Choose from 10 Profile Icons
                </button>
              </div>

              <div className="card" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lock size={18} color="var(--accent)" /> Role & Permissions
                  </h3>

                  {/* Active Role Status */}
                  <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Active Role Status</span>
                      <span className="badge badge-tag" style={{ fontSize: 10, background: 'rgba(79,70,229,0.1)', color: 'var(--accent)' }}>
                        🔒 Locked
                      </span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      {isSuperAdmin
                        ? 'Super Administrator: Global platform configuration, user moderation, telemetry & revenue overview.'
                        : (isCompanyOwner
                          ? 'Agency Owner: Controls company catalog offerings, team roster, commission payouts, and lead routing.'
                          : 'Independent Agent: Manages direct leads, custom deal stages, and WhatsApp follow-ups.')}
                    </p>
                  </div>

                  {/* Locked Industry Vertical */}
                  {!isSuperAdmin && (
                    <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Industry Vertical</span>
                        <span className="badge badge-tag" style={{ fontSize: 10, background: 'rgba(79,70,229,0.1)', color: 'var(--accent)' }}>
                          🔒 Locked
                        </span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {user?.industryType || 'Agency'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                        Configured during account creation and permanently locked.
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  Account Created: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'} • Status: <strong style={{ color: 'var(--green)' }}>Active</strong>
                </div>
              </div>

              {/* SECTION: Universal Localization & Regional Currency Settings */}
              <div className="card" style={{ padding: '20px 16px', borderLeft: '4px solid #3b82f6', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Globe size={18} color="#3b82f6" /> Universal SaaS Localization & Regional Settings
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Configure your preferred default operating currency, currency symbol, and country dialing code for WhatsApp routing and revenue reports.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveLocalization} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full items-end">
                  {/* Currency Selector */}
                  <div>
                    <label className="label">Default Operating Currency</label>
                    <select
                      className="input"
                      value={localizationForm.currencyCode}
                      onChange={e => {
                        const selected = GLOBAL_CURRENCIES.find(c => c.code === e.target.value);
                        setLocalizationForm(f => ({
                          ...f,
                          currencyCode: e.target.value,
                          currencySymbol: selected?.symbol || f.currencySymbol || '$',
                        }));
                      }}
                      style={{ height: 42, fontSize: 13 }}
                    >
                      {GLOBAL_CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>
                          {curr.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Currency Symbol Preview */}
                  <div>
                    <label className="label">Display Currency Symbol</label>
                    <input
                      className="input"
                      value={localizationForm.currencySymbol}
                      onChange={e => setLocalizationForm(f => ({ ...f, currencySymbol: e.target.value }))}
                      placeholder="e.g. $, €, £, ₹"
                      required
                      style={{ height: 42, fontSize: 14, fontWeight: 700 }}
                    />
                  </div>

                  {/* Country Dialing Code */}
                  <div>
                    <label className="label">Default Country Dialing Code</label>
                    <select
                      className="input"
                      value={localizationForm.countryPhoneCode}
                      onChange={e => setLocalizationForm(f => ({ ...f, countryPhoneCode: e.target.value }))}
                      style={{ height: 42, fontSize: 13 }}
                    >
                      {GLOBAL_COUNTRY_CODES.map(country => (
                        <option key={country.code} value={country.code}>
                          {country.country}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={savingLocalization}
                    className="btn btn-primary"
                    style={{ height: 42, borderRadius: 10, background: '#3b82f6', borderColor: '#3b82f6', width: '100%', justifyContent: 'center' }}
                  >
                    {savingLocalization ? 'Saving...' : 'Save Settings 🌐'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: SECURITY & 2FA
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
              {/* 2FA Card */}
              <div className="card" style={{ padding: '22px 20px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={18} color={twoFactorEnabled ? 'var(--green)' : '#f59e0b'} />
                  Two-Factor Authentication (TOTP)
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {twoFactorEnabled
                    ? 'Your account is secured with Google Authenticator / Authy TOTP. 2FA is active and permanently locked for high security.'
                    : 'Add a layer of security to your CRM account using Google Authenticator, Authy, or 1Password.'}
                </p>

                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: twoFactorEnabled ? 'var(--green)' : '#f59e0b' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {twoFactorEnabled ? '2FA Active & Locked 🔒' : '2FA Not Configured ⚠️'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                    {twoFactorEnabled ? 'Verification required on each login' : 'Setup now to protect your client pipeline data'}
                  </p>
                </div>

                <button
                  onClick={handleOpen2FASetup}
                  disabled={loading2FASetup}
                  className={`btn ${twoFactorEnabled ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ borderRadius: 10 }}
                >
                  {twoFactorEnabled ? 'Re-configure Authenticator 🔄' : 'Setup Authenticator App (TOTP)'}
                </button>
              </div>

              {/* Password Change Card */}
              <div className="card" style={{ padding: '22px 20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Key size={18} color="var(--accent)" /> Change Password
                </h3>

                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="label">Current Password</label>
                    <input
                      className="input"
                      type="password"
                      placeholder="Enter current password"
                      value={passwordForm.currentPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">New Password</label>
                    <input
                      className="input"
                      type="password"
                      placeholder="Min 6 characters"
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Confirm New Password</label>
                    <input
                      className="input"
                      type="password"
                      placeholder="Repeat new password"
                      value={passwordForm.confirmNewPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, confirmNewPassword: e.target.value }))}
                      required
                    />
                  </div>

                  <button type="submit" disabled={savingPassword} className="btn btn-secondary" style={{ alignSelf: 'flex-start', borderRadius: 10, marginTop: 4 }}>
                    {savingPassword ? 'Updating...' : 'Change Password'}
                  </button>
                </form>
              </div>

              {/* Legal & Privacy Compliance Card */}
              <div className="card" style={{ padding: '22px 20px', gridColumn: '1 / -1', borderLeft: '4px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={18} color="#10b981" /> Legal Compliance, Privacy & Data Protection
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      CoreSetu adheres to strict multi-tenant data isolation, 60-day auto-purge lifecycles, and zero message monetization.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="btn btn-outline btn-sm"
                      style={{ borderRadius: 8, gap: 6, fontWeight: 600 }}
                    >
                      <FileText size={14} /> Read Privacy Policy <ChevronRight size={14} />
                    </Link>
                    <Link
                      href="/terms"
                      target="_blank"
                      className="btn btn-ghost btn-sm"
                      style={{ borderRadius: 8, gap: 6 }}
                    >
                      Terms of Service <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: CRM CUSTOMIZATIONS (Pipelines & Form Builder)
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'customization' && !isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* SECTION A: Custom Pipeline Stages */}
              <div className="card" style={{ padding: '22px 20px', borderLeft: '4px solid var(--accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={18} color="var(--accent)" /> Sales Pipeline Stages ({pipelineStages.length})
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Customize your sales pipeline stages to reflect your exact deal closing process. Reorder with arrows, rename, or add custom stages.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleResetStages} className="btn btn-ghost btn-sm" style={{ gap: 4, borderRadius: 8, fontSize: 12 }}>
                      <RotateCcw size={13} /> Reset Defaults
                    </button>
                    <button type="button" onClick={handleSavePipelineStages} disabled={savingStages} className="btn btn-primary btn-sm" style={{ borderRadius: 8, fontSize: 12, gap: 4 }}>
                      <Check size={14} /> {savingStages ? 'Saving...' : 'Save Pipeline Stages ✅'}
                    </button>
                  </div>
                </div>

                {/* Stage List Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {pipelineStages.map((stage, idx) => {
                    const isEditing = editingStageIdx === idx;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          gap: 8,
                        }}
                      >
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                            <input
                              className="input"
                              value={editingStageName}
                              onChange={e => setEditingStageName(e.target.value)}
                              style={{ height: 32, fontSize: 13, flex: 1 }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditStage(idx)}
                              className="btn btn-primary btn-sm"
                              style={{ height: 32, padding: '0 8px', borderRadius: 6 }}
                              title="Save stage name"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStageIdx(null)}
                              className="btn btn-ghost btn-sm"
                              style={{ height: 32, padding: '0 8px', borderRadius: 6 }}
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                              {/* Reorder Arrows */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <button
                                  type="button"
                                  onClick={() => moveStage(idx, -1)}
                                  disabled={idx === 0}
                                  style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 3,
                                    color: idx === 0 ? 'var(--text-muted)' : 'var(--text)',
                                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                    padding: '1px 3px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title="Move stage up"
                                >
                                  <ArrowUp size={10} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveStage(idx, 1)}
                                  disabled={idx === pipelineStages.length - 1}
                                  style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 3,
                                    color: idx === pipelineStages.length - 1 ? 'var(--text-muted)' : 'var(--text)',
                                    cursor: idx === pipelineStages.length - 1 ? 'not-allowed' : 'pointer',
                                    padding: '1px 3px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title="Move stage down"
                                >
                                  <ArrowDown size={10} />
                                </button>
                              </div>

                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', minWidth: 20 }}>
                                #{idx + 1}
                              </span>

                              <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {stage}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => handleStartEditStage(idx)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                                title="Rename stage"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStage(idx)}
                                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }}
                                title="Delete stage"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Stage Form */}
                <form onSubmit={handleAddStage} style={{ display: 'flex', gap: 8, maxWidth: 460 }}>
                  <input
                    className="input"
                    placeholder="e.g. Discovery Scheduled / Proposal Sent"
                    value={newStageInput}
                    onChange={e => setNewStageInput(e.target.value)}
                    style={{ height: 38, fontSize: 13 }}
                  />
                  <button type="submit" className="btn btn-secondary btn-sm" style={{ height: 38, padding: '0 14px', borderRadius: 8, gap: 4 }}>
                    <Plus size={14} /> Add Stage
                  </button>
                </form>
              </div>

              {/* SECTION B: Fully Customizable Form Engine */}
              <div className="card" style={{ padding: '22px 20px', borderLeft: '4px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={18} color="#10b981" /> Fully Customizable Form Engine ({formSchema.length} Fields)
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Reorder fields with arrows, customize labels, configure conditional visibility (e.g. Only show "Expected Price" if Purpose == 'Sell'), toggle visibility, and create custom inputs.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleResetFormSchema} className="btn btn-ghost btn-sm" style={{ gap: 4, borderRadius: 8, fontSize: 12 }}>
                      <RotateCcw size={13} /> Reset Defaults
                    </button>
                    <button type="button" onClick={handleSaveFormSchema} disabled={savingSchema} className="btn btn-primary btn-sm" style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8, fontSize: 12, gap: 4 }}>
                      <Check size={14} /> {savingSchema ? 'Saving...' : 'Save Form Layout ✅'}
                    </button>
                  </div>
                </div>

                {/* Field List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {formSchema.map((field, idx) => {
                    const isMandatorySystem = ['name', 'phone'].includes(field.fieldId);
                    const isMandatoryDate = field.fieldId === 'followUpDate';
                    const isHidden = Boolean(field.isHidden);
                    const hasDependency = Boolean(field.dependsOn?.field && field.dependsOn?.value);

                    return (
                      <div
                        key={field.fieldId || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: isHidden ? 'rgba(255,255,255,0.02)' : 'var(--surface)',
                          border: isHidden ? '1px dashed var(--border)' : '1px solid var(--border)',
                          opacity: isHidden ? 0.65 : 1,
                          borderRadius: 12,
                          flexWrap: 'wrap',
                          gap: 10,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Left Controls: Up/Down + Position Badge + Label info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {/* Reordering Up/Down buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button
                              type="button"
                              onClick={() => moveField(idx, -1)}
                              disabled={idx === 0}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                color: idx === 0 ? 'var(--text-muted)' : 'var(--text)',
                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                padding: '2px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Move field up"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveField(idx, 1)}
                              disabled={idx === formSchema.length - 1}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                color: idx === formSchema.length - 1 ? 'var(--text-muted)' : 'var(--text)',
                                cursor: idx === formSchema.length - 1 ? 'not-allowed' : 'pointer',
                                padding: '2px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Move field down"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>

                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: 24, textAlign: 'center' }}>
                            #{idx + 1}
                          </span>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: isHidden ? 'var(--text-muted)' : 'var(--text)' }}>
                                {field.label}
                              </span>

                              {/* System vs Custom badge */}
                              {field.isSystem ? (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 600 }}>
                                  System
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 600 }}>
                                  Custom
                                </span>
                              )}

                              {/* Field Type Badge */}
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-light)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                                {field.fieldType}
                              </span>

                              {/* Required Badge */}
                              {(field.isRequired || isMandatorySystem || isMandatoryDate) && (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 700 }}>
                                  Required
                                </span>
                              )}

                              {/* Hidden Badge */}
                              {isHidden && (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 700 }}>
                                  Hidden from Form
                                </span>
                              )}

                              {/* Conditional Visibility Badge */}
                              {hasDependency && (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(234,179,8,0.15)', color: '#eab308', fontWeight: 600 }}>
                                  ⚡ Only when {field.dependsOn.field} is "{field.dependsOn.value}"
                                </span>
                              )}
                            </div>

                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                              Field ID: <code style={{ color: 'var(--accent)' }}>{field.fieldId}</code>
                              {field.fieldType === 'dropdown' && field.options?.length > 0 && (
                                <span> • Options: {field.options.slice(0, 3).join(', ')}{field.options.length > 3 ? ` +${field.options.length - 3} more` : ''}</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right Action buttons: Toggle Visibility, Edit, Delete */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {/* Visibility Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleFieldHidden(idx)}
                            disabled={isMandatorySystem}
                            style={{
                              background: isHidden ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              color: isHidden ? '#f59e0b' : '#10b981',
                              padding: '5px 8px',
                              cursor: isMandatorySystem ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600
                            }}
                            title={isMandatorySystem ? 'Name & Phone cannot be hidden' : (isHidden ? 'Click to show in form' : 'Click to hide from form')}
                          >
                            {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                            <span>{isHidden ? 'Hidden' : 'Visible'}</span>
                          </button>

                          {/* Edit Field button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditField(idx)}
                            className="btn btn-secondary btn-sm"
                            style={{ borderRadius: 8, fontSize: 11, padding: '5px 8px', gap: 4 }}
                            title="Edit label, options, conditional rules, or requirements"
                          >
                            <Edit2 size={13} /> Edit
                          </button>

                          {/* Delete Field button */}
                          {!field.isSystem && (
                            <button
                              type="button"
                              onClick={() => handleDeleteField(idx)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}
                              title="Delete custom field"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add New Custom Field Form */}
                <form onSubmit={handleAddField} style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>
                    ✨ Add New Dynamic Custom Field
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label className="label">Field Label *</label>
                      <input
                        className="input"
                        placeholder="e.g. Expected Price, Loan Amount, Target City"
                        value={newField.label}
                        onChange={e => setNewField(f => ({ ...f, label: e.target.value }))}
                        style={{ height: 38, fontSize: 13 }}
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Field Type</label>
                      <select
                        className="input"
                        value={newField.fieldType}
                        onChange={e => setNewField(f => ({ ...f, fieldType: e.target.value }))}
                        style={{ height: 38, fontSize: 13 }}
                      >
                        <option value="text">📝 Single-line Text</option>
                        <option value="email">📧 Email Address</option>
                        <option value="phone">📞 Phone / WhatsApp</option>
                        <option value="number">🔢 Number</option>
                        <option value="date">📅 Date Picker</option>
                        <option value="dropdown">🔽 Dropdown Select</option>
                      </select>
                    </div>

                    {newField.fieldType === 'dropdown' && (
                      <div style={{ gridColumn: '1/-1' }}>
                        <label className="label">Dropdown Options (Comma-separated) *</label>
                        <input
                          className="input"
                          placeholder="e.g. Option A, Option B, Option C"
                          value={newField.optionsStr}
                          onChange={e => setNewField(f => ({ ...f, optionsStr: e.target.value }))}
                          style={{ height: 38, fontSize: 13 }}
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Conditional Visibility Section */}
                  <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: newField.enableConditional ? 10 : 0 }}>
                      <input
                        type="checkbox"
                        checked={newField.enableConditional}
                        onChange={e => setNewField(f => ({ ...f, enableConditional: e.target.checked }))}
                      />
                      <span>⚡ Enable Conditional Visibility (dependsOn)</span>
                    </label>

                    {newField.enableConditional && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                        <div>
                          <label className="label" style={{ fontSize: 11 }}>Parent Field (Trigger)</label>
                          <select
                            className="input"
                            value={newField.dependsOnField}
                            onChange={e => setNewField(f => ({ ...f, dependsOnField: e.target.value }))}
                            style={{ height: 34, fontSize: 12 }}
                          >
                            <option value="">-- Select Parent Field --</option>
                            {formSchema.map(f => (
                              <option key={f.fieldId} value={f.fieldId}>
                                {f.label} ({f.fieldId})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label" style={{ fontSize: 11 }}>Matching Value to Show Field</label>
                          <input
                            className="input"
                            placeholder="e.g. Sell, Buy, Enterprise"
                            value={newField.dependsOnValue}
                            onChange={e => setNewField(f => ({ ...f, dependsOnValue: e.target.value }))}
                            style={{ height: 34, fontSize: 12 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newField.isRequired}
                        onChange={e => setNewField(f => ({ ...f, isRequired: e.target.checked }))}
                      />
                      <span>Make this field mandatory</span>
                    </label>

                    <button type="submit" className="btn btn-secondary btn-sm" style={{ borderRadius: 8, fontSize: 12, gap: 4 }}>
                      <Plus size={13} /> Add Field to Layout
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 4: ORGANIZATION & TEAM (Hidden for SuperAdmin)
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'organization' && !isSuperAdmin && (
            <div>
              {/* Agency Owner Suite */}
              {isCompanyOwner && (
                <div className="card" style={{ padding: '22px 20px', borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                        🏢 {user.companyInfo?.companyName || 'Organization Operations'}
                      </h3>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                        Share organization code <strong style={{ color: 'var(--accent)' }}>{user.usercode}</strong> to add team members
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowCreateAgentModal(true)} className="btn btn-primary btn-sm" style={{ gap: 4, borderRadius: 8 }}>
                        <UserPlus size={13} /> Add Team Member
                      </button>
                      <button onClick={() => setShowCompanyModal(true)} className="btn btn-secondary btn-sm" style={{ gap: 4, borderRadius: 8 }}>
                        <Edit2 size={13} /> Settings
                      </button>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lead Sharing Mode</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
                        {user.companySettings?.leadSharingMode === 'common_pool' ? '🏊 Common Pool' : '🎯 Assigned Only'}
                      </p>
                    </div>
                    <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Commission / Deal</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                        ₹{user.companySettings?.incentivePerConversion || 0} / closed deal
                      </p>
                    </div>
                    {user.companyInfo?.reraNumber && (
                      <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>License / Reg. No.</span>
                        <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600 }}>
                          {user.companyInfo.reraNumber}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Team Roster */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={16} /> Sales Team Roster ({agentsData.agents.length})
                    </h4>

                    {loadingAgents ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><div className="spinner" /></div>
                    ) : agentsData.agents.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 10 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 13 }}>No team members added yet.</p>
                        <p style={{ margin: 0, fontSize: 11 }}>Ask sales reps to register and enter code <strong style={{ color: 'var(--text)' }}>{user.usercode}</strong> under their Profile, or click "Add Team Member".</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {agentsData.agents.map(ag => {
                          const hasPendingLeave = ag.companyLeaveRequest === 'pending';

                          return (
                            <div
                              key={ag._id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                background: hasPendingLeave ? 'rgba(245,158,11,0.08)' : 'var(--surface)',
                                borderRadius: 12,
                                border: hasPendingLeave ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                                flexWrap: 'wrap',
                                gap: 8
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{ag.name}</span>
                                  <span className="badge badge-tag" style={{ fontSize: 10 }}>{ag.usercode}</span>
                                  {hasPendingLeave && (
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f59e0b', color: '#000', fontWeight: 800 }}>
                                      ⏳ LEAVE REQUEST PENDING
                                    </span>
                                  )}
                                </div>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                                  {ag.email} • {ag.totalLeads || 0} leads • <strong>{ag.closedLeads || 0} closed deals</strong>
                                </p>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
                                  Earned Commission: ₹{ag.earnedIncentives || 0}
                                </p>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {hasPendingLeave ? (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      onClick={() => handleApproveLeave(ag._id)}
                                      className="btn btn-sm"
                                      style={{ background: '#22c55e', color: 'white', fontSize: 11, padding: '4px 10px', borderRadius: 8, border: 'none', fontWeight: 700 }}
                                    >
                                      Approve Leave
                                    </button>
                                    <button
                                      onClick={() => handleRejectLeave(ag._id)}
                                      className="btn btn-sm btn-ghost"
                                      style={{ color: '#ef4444', fontSize: 11, padding: '4px 8px' }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleToggleAgentWhatsApp(ag._id, ag.allowCompanyWhatsApp)}
                                      className={`btn btn-sm ${ag.allowCompanyWhatsApp ? 'btn-primary' : 'btn-secondary'}`}
                                      style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8 }}
                                      title="Toggle organization WhatsApp access"
                                    >
                                      {ag.allowCompanyWhatsApp ? '🟢 WA Granted' : '⚪ WA Revoked'}
                                    </button>
                                    <button
                                      onClick={() => handleToggleAgentExport(ag._id, ag.exportPermissionStatus)}
                                      className={`btn btn-sm ${ag.exportPermissionStatus === 'restricted' ? 'btn-secondary' : 'btn-ghost'}`}
                                      style={{
                                        fontSize: 11,
                                        padding: '4px 8px',
                                        borderRadius: 8,
                                        color: ag.exportPermissionStatus === 'restricted' ? 'var(--red)' : '#10b981',
                                        border: `1px solid ${ag.exportPermissionStatus === 'restricted' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`
                                      }}
                                      title="Toggle agent lead export permission"
                                    >
                                      {ag.exportPermissionStatus === 'restricted' ? '🔒 Export Blocked' : '📥 Export Allowed'}
                                    </button>
                                    <button
                                      onClick={() => handleRemoveAgent(ag._id, ag.name)}
                                      className="btn btn-ghost btn-sm"
                                      style={{ color: 'var(--red)', padding: 4 }}
                                      title="Remove member"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mapped Team Member Suite */}
              {isAgentInCompany && (
                <div className="card" style={{ padding: '22px 20px', borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                        🏢 Member of {user.companyId?.companyInfo?.companyName || user.companyId?.name}
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        You have access to team catalog offerings, shared lead pools & organization WhatsApp.
                      </p>
                      {user.companyLeaveRequest === 'pending' && (
                        <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>
                          <Clock size={14} /> Leave request submitted. Awaiting Organization Admin approval.
                        </div>
                      )}
                    </div>

                    <div>
                      {user.companyLeaveRequest === 'pending' ? (
                        <button disabled className="btn btn-secondary btn-sm" style={{ opacity: 0.7, borderRadius: 8 }}>
                          ⏳ Pending Approval
                        </button>
                      ) : (
                        <button onClick={handleLeaveCompany} className="btn btn-secondary btn-sm" style={{ color: 'var(--red)', borderRadius: 8 }}>
                          {user.companyJoinMethod === 'created_by_company' ? 'Request to Leave Organization' : 'Leave Organization'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Solo Agent Suite: Join Company */}
              {isSoloAgent && (
                <div className="card" style={{ padding: '22px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                        🏢 Join an Organization Team
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        If you are joining an agency sales team, enter their Organization Usercode here to get access to shared catalog & pool.
                      </p>
                    </div>
                    <button onClick={() => setShowJoinModal(true)} className="btn btn-primary btn-sm" style={{ gap: 6, borderRadius: 8 }}>
                      <Plus size={14} /> Join Organization Team
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Setup 2FA TOTP Authenticator Modal */}
      {show2FAModal && totpSetupData && (
        <div className="modal-overlay" onClick={() => setShow2FAModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <QrCode size={20} color="var(--accent)" /> Setup 2FA Authenticator
              </h2>
              <button onClick={() => setShow2FAModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
              Scan the QR Code using <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>1Password</strong> on your phone.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface)', padding: 16, borderRadius: 14, border: '1px solid var(--border)', marginBottom: 16 }}>
              {(() => {
                const qrSrc = totpSetupData.qrCode || totpSetupData.qrCodeUrl || (totpSetupData.secret ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetupData.otpauthUrl || `otpauth://totp/CRM?secret=${totpSetupData.secret}`)}` : null);
                return qrSrc ? (
                  <img src={qrSrc} alt="2FA QR Code" style={{ width: 180, height: 180, borderRadius: 8, background: 'white', padding: 4 }} />
                ) : (
                  <div className="spinner" />
                );
              })()}
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Or enter manual secret key:</span>
                <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: 'var(--accent)', letterSpacing: 1 }}>
                  {totpSetupData.secret}
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyAndEnable2FA} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Enter 6-Digit Code from App</label>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={totpVerifyCode}
                  onChange={e => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                  style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, letterSpacing: 6 }}
                  required
                />
              </div>

              <button type="submit" disabled={enabling2FA || totpVerifyCode.length < 6} className="btn btn-primary btn-full" style={{ height: 44, borderRadius: 12 }}>
                {enabling2FA ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Verify & Enable 2FA 🔒'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Sub-Agent Modal */}
      {showCreateAgentModal && (
        <div className="modal-overlay" onClick={() => setShowCreateAgentModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add Team Member</h2>
              <button onClick={() => setShowCreateAgentModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Full Name *</label>
                <input className="input" placeholder="Sales Rep Name" value={newAgentForm.name} onChange={e => setNewAgentForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Email Address *</label>
                <input className="input" type="email" placeholder="rep@agency.com" value={newAgentForm.email} onChange={e => setNewAgentForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Phone (Digits only)</label>
                <input className="input" type="tel" placeholder="919999999999" value={newAgentForm.phone} onChange={e => setNewAgentForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Initial Password *</label>
                <input className="input" type="password" placeholder="Temporary password" value={newAgentForm.password} onChange={e => setNewAgentForm(f => ({ ...f, password: e.target.value }))} required />
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                ℹ️ Team members added directly require Admin approval if they request to detach later.
              </p>
              <button type="submit" disabled={creatingAgent} className="btn btn-primary btn-full" style={{ height: 44, borderRadius: 12, marginTop: 6 }}>
                {creatingAgent ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Create & Assign to Team'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Organization Settings Modal */}
      {showCompanyModal && (
        <div className="modal-overlay" onClick={() => setShowCompanyModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Organization & Commission Settings</h2>
              <button onClick={() => setShowCompanyModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveCompanySettings} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70dvh', overflowY: 'auto' }}>
              <div>
                <label className="label">Organization / Agency Name</label>
                <input className="input" value={companyForm.companyName} onChange={e => setCompanyForm(f => ({ ...f, companyName: e.target.value }))} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Business License / Registration #</label>
                  <input className="input" placeholder="e.g. REG-849201" value={companyForm.reraNumber} onChange={e => setCompanyForm(f => ({ ...f, reraNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Tax ID / GST / EIN</label>
                  <input className="input" placeholder="e.g. 27AABCS1429B1Z8" value={companyForm.gstNumber} onChange={e => setCompanyForm(f => ({ ...f, gstNumber: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Lead Sharing Mode</label>
                <select className="input" value={companyForm.leadSharingMode} onChange={e => setCompanyForm(f => ({ ...f, leadSharingMode: e.target.value }))}>
                  <option value="common_pool">🏊 Common Pool (All reps see & action all organization leads)</option>
                  <option value="assigned">🎯 Assigned Only (Reps only see leads assigned directly to them)</option>
                </select>
              </div>

              <div>
                <label className="label">Commission / Incentive Per Closed Deal (in ₹ / $ Currency)</label>
                <input type="number" className="input" placeholder="e.g. 25000" value={companyForm.incentivePerConversion} onChange={e => setCompanyForm(f => ({ ...f, incentivePerConversion: e.target.value }))} />
              </div>

              <div>
                <label className="label">Headquarters / Office Address</label>
                <input className="input" value={companyForm.companyAddress} onChange={e => setCompanyForm(f => ({ ...f, companyAddress: e.target.value }))} />
              </div>

              <button type="submit" disabled={savingCompany} className="btn btn-primary btn-full" style={{ marginTop: 8, height: 44, borderRadius: 12 }}>
                {savingCompany ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Save Settings'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join Organization Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Join Organization Team</h2>
              <button onClick={() => setShowJoinModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleJoinCompany} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                Ask your Organization Administrator for their <strong>Organization Usercode</strong> (e.g. <code>CMP-849201</code>).
              </p>

              <div>
                <label className="label">Organization Usercode</label>
                <input
                  className="input"
                  placeholder="e.g. CMP-849201"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <button type="submit" disabled={joining} className="btn btn-primary btn-full" style={{ height: 44, borderRadius: 12 }}>
                {joining ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Join Sales Team'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT FORM ENGINE FIELD
         ───────────────────────────────────────────────────────────── */}
      {editingFieldIdx !== null && editingFieldData && (
        <div className="modal-overlay" onClick={() => { setEditingFieldIdx(null); setEditingFieldData(null); }} style={{ zIndex: 9999 }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚙️ Customize {editingFieldData.isSystem ? 'System Field' : 'Custom Field'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Path: <code>{editingFieldData.isSystem ? `lead.${editingFieldData.fieldId}` : `customData.${editingFieldData.fieldId}`}</code>
                </p>
              </div>
              <button onClick={() => { setEditingFieldIdx(null); setEditingFieldData(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedField}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Display Label on Forms *</label>
                  <input
                    className="input"
                    value={editingFieldData.label}
                    onChange={e => setEditingFieldData(d => ({ ...d, label: e.target.value }))}
                    placeholder="e.g. WhatsApp Number or Target City"
                    required
                  />
                </div>

                {editingFieldData.fieldType === 'dropdown' && (
                  <div>
                    <label className="label">Dropdown Options (Comma-separated) *</label>
                    <input
                      className="input"
                      value={editingFieldData.optionsStr || ''}
                      onChange={e => setEditingFieldData(d => ({ ...d, optionsStr: e.target.value }))}
                      placeholder="e.g. Option 1, Option 2, Option 3"
                    />
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      Separate options by comma.
                    </p>
                  </div>
                )}

                {/* Conditional Visibility Configuration */}
                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: editingFieldData.enableConditional ? 10 : 0 }}>
                    <input
                      type="checkbox"
                      checked={editingFieldData.enableConditional}
                      onChange={e => setEditingFieldData(d => ({ ...d, enableConditional: e.target.checked }))}
                    />
                    <span>⚡ Conditional Visibility (dependsOn)</span>
                  </label>

                  {editingFieldData.enableConditional && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                      <div>
                        <label className="label" style={{ fontSize: 11 }}>Parent Field (Trigger)</label>
                        <select
                          className="input"
                          value={editingFieldData.dependsOnField || ''}
                          onChange={e => setEditingFieldData(d => ({ ...d, dependsOnField: e.target.value }))}
                          style={{ height: 34, fontSize: 12 }}
                        >
                          <option value="">-- Select Parent Field --</option>
                          {formSchema.filter(f => f.fieldId !== editingFieldData.fieldId).map(f => (
                            <option key={f.fieldId} value={f.fieldId}>
                              {f.label} ({f.fieldId})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 11 }}>Matching Value to Show Field</label>
                        <input
                          className="input"
                          placeholder="e.g. Sell, Buy, Enterprise"
                          value={editingFieldData.dependsOnValue || ''}
                          onChange={e => setEditingFieldData(d => ({ ...d, dependsOnValue: e.target.value }))}
                          style={{ height: 34, fontSize: 12 }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  {/* Required Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: ['name', 'phone', 'followUpDate'].includes(editingFieldData.fieldId) ? 'not-allowed' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={['name', 'phone', 'followUpDate'].includes(editingFieldData.fieldId) ? true : Boolean(editingFieldData.isRequired)}
                      disabled={['name', 'phone', 'followUpDate'].includes(editingFieldData.fieldId)}
                      onChange={e => setEditingFieldData(d => ({ ...d, isRequired: e.target.checked }))}
                    />
                    <span>
                      Mandatory / Required Field {['name', 'phone', 'followUpDate'].includes(editingFieldData.fieldId) && '(Locked by CRM)'}
                    </span>
                  </label>

                  {/* Hidden Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: ['name', 'phone'].includes(editingFieldData.fieldId) ? 'not-allowed' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={['name', 'phone'].includes(editingFieldData.fieldId) ? false : Boolean(editingFieldData.isHidden)}
                      disabled={['name', 'phone'].includes(editingFieldData.fieldId)}
                      onChange={e => setEditingFieldData(d => ({ ...d, isHidden: e.target.checked }))}
                    />
                    <span>
                      Hide this field from Prospect Creation & Edit views {['name', 'phone'].includes(editingFieldData.fieldId) && '(Name & Phone cannot be hidden)'}
                    </span>
                  </label>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => { setEditingFieldIdx(null); setEditingFieldData(null); }} className="btn btn-ghost" style={{ height: 42 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ height: 42 }}>
                    Update Field Layout
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Avatar Preset Picker Modal (10 Professional Themes) */}
      <AvatarPickerModal
        isOpen={showAvatarPicker}
        currentAvatarId={user?.avatarIcon || 'avatar-1'}
        onClose={() => setShowAvatarPicker(false)}
        onSelect={handleSelectAvatar}
        saving={savingAvatar}
      />

      <BottomNav active="profile" />
    </div>
  );
}
