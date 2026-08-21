'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Users, UserCheck, GitFork, Workflow, FileText,
  MessageSquare, ShoppingBag, Radio, Target, DollarSign, Ticket,
  Bell, BarChart3, History, Shield, Activity, Plus, Search,
  Filter, Check, X, RefreshCw, Phone, Mail, ChevronRight,
  TrendingUp, Award, Layers, Zap, Copy, ExternalLink, Settings,
  AlertCircle, CheckCircle2, ChevronDown, Clock, Download, ArrowUpRight
} from 'lucide-react';
import { getUser } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const NAV_CENTRES = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, category: 'Core' },
  { id: 'leads', label: 'Leads & Sources', icon: Users, category: 'Leads' },
  { id: 'distribution', label: 'Lead Distribution', icon: GitFork, category: 'Leads' },
  { id: 'pipelines', label: 'Pipelines', icon: Workflow, category: 'Leads' },
  { id: 'hierarchy', label: 'Hierarchy & Teams', icon: UserCheck, category: 'Organization' },
  { id: 'forms', label: 'Forms Centre', icon: FileText, category: 'Growth' },
  { id: 'templates', label: 'Template Centre', icon: MessageSquare, category: 'Growth' },
  { id: 'catalogue', label: 'Catalogue Centre', icon: ShoppingBag, category: 'Commerce' },
  { id: 'integrations', label: 'Integration Centre', icon: Radio, category: 'System' },
  { id: 'campaigns', label: 'Campaigns & Ads', icon: Target, category: 'Growth' },
  { id: 'commissions', label: 'Commission Engine', icon: DollarSign, category: 'Commerce' },
  { id: 'coupons', label: 'Coupon Engine', icon: Ticket, category: 'Commerce' },
  { id: 'broadcasts', label: 'Broadcast Centre', icon: Bell, category: 'Organization' },
  { id: 'analytics', label: 'Universal Analytics', icon: BarChart3, category: 'Intelligence' },
  { id: 'activity', label: 'Activity & Audit Logs', icon: History, category: 'Intelligence' },
  { id: 'security', label: 'Security & Access', icon: Shield, category: 'System' },
  { id: 'health', label: 'System Health', icon: Activity, category: 'System' },
];

const KANBAN_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'border-slate-500/40 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' },
  { id: 'contacted', label: 'Contacted', color: 'border-blue-500/40 bg-blue-500/10 text-blue-300', dot: 'bg-blue-400' },
  { id: 'not_interested', label: 'Not Interested', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
  { id: 'converted', label: 'Converted', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  { id: 'payment_done', label: 'Payment Done', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300', dot: 'bg-purple-400' },
];

export default function AdminControlCenter() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab Data States
  const [metrics, setMetrics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsPagination, setLeadsPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [distributionRules, setDistributionRules] = useState([]);
  const [hierarchy, setHierarchy] = useState({ managers: [], unassignedAgents: [] });
  const [performanceList, setPerformanceList] = useState([]);
  const [pipelineStages, setPipelineStages] = useState([]);
  const [formSchemas, setFormSchemas] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [catalogues, setCatalogues] = useState([]);
  const [integrationsStatus, setIntegrationsStatus] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [commissionRules, setCommissionRules] = useState([]);
  const [commissionPayouts, setCommissionPayouts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [universalAnalytics, setUniversalAnalytics] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [securitySettings, setSecuritySettings] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  // Filter States
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('all');
  const [leadStageFilter, setLeadStageFilter] = useState('all');
  const [leadViewMode, setLeadViewMode] = useState('kanban');
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');

  // Modals & Drawers
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showAddPipelineModal, setShowAddPipelineModal] = useState(false);
  const [showAddFormModal, setShowAddFormModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignFromAgent, setReassignFromAgent] = useState(null);
  const [reassignToAgentId, setReassignToAgentId] = useState('');
  const [showAddCommissionModal, setShowAddCommissionModal] = useState(false);
  const [showAddCouponModal, setShowAddCouponModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showAddCampaignModal, setShowAddCampaignModal] = useState(false);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [showAddCatalogueModal, setShowAddCatalogueModal] = useState(false);
  const [showConfigureIntegrationModal, setShowConfigureIntegrationModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [broadcastsList, setBroadcastsList] = useState([]);

  // Forms State
  const [leadFormData, setLeadFormData] = useState({
    name: '', phone: '', email: '', company: '', service_required: 'smart_solo',
    monthly_spend: '', source: 'manual', primarySource: 'SOURCE_A_MANUAL', assignedTo: '', notes: ''
  });
  const [agentFormData, setAgentFormData] = useState({
    name: '', email: '', phone: '', password: '', role: 'agent', managerId: '', incentive_pct: 10, leadCap: 50, isAvailableForRouting: true
  });
  const [ruleFormData, setRuleFormData] = useState({
    name: '', strategy: 'ROUND_ROBIN', priority: 1, isActive: true, assignees: [], conditions: { sourceType: 'ALL' }
  });
  const [pipelineFormData, setPipelineFormData] = useState([
    { name: 'New Lead', probability: 10, colorCode: '#64748b', slaHours: 24 },
    { name: 'Contacted', probability: 30, colorCode: '#3b82f6', slaHours: 48 },
    { name: 'Follow-Up Scheduled', probability: 50, colorCode: '#f97316', slaHours: 24 },
    { name: 'Converted', probability: 80, colorCode: '#10b981', slaHours: 72 },
    { name: 'Payment Done', probability: 100, colorCode: '#8b5cf6', slaHours: 0 },
  ]);
  const [formFieldsData, setFormFieldsData] = useState([
    { label: 'Full Name', name: 'name', type: 'text', isRequired: true, placeholder: 'Enter full name' },
    { label: 'Phone Number', name: 'phone', type: 'phone', isRequired: true, placeholder: 'Enter phone number' },
    { label: 'Email Address', name: 'email', type: 'email', isRequired: false, placeholder: 'Enter email address' },
    { label: 'Company Name', name: 'company', type: 'text', isRequired: false, placeholder: 'Enter company' },
  ]);
  const [newFieldInput, setNewFieldInput] = useState({ label: '', name: '', type: 'text', isRequired: false, placeholder: '' });
  const [commFormData, setCommFormData] = useState({
    ruleName: '', targetRole: 'AGENT', commissionType: 'PERCENTAGE', value: 10, stageThreshold: 'payment_done'
  });
  const [couponFormData, setCouponFormData] = useState({
    code: '', description: '', discountType: 'PERCENTAGE', discountValue: 20, applicablePlans: ['ALL'], validUntil: '', maxOverallUses: 100, maxUsesPerUser: 1
  });
  const [broadcastFormData, setBroadcastFormData] = useState({
    title: '', message: '', priority: 'NORMAL', targetAudience: 'INTERNAL_ALL', targetIds: [], deliveryChannels: ['IN_APP']
  });
  const [campaignFormData, setCampaignFormData] = useState({
    campaignName: '', platform: 'META', campaignId: '', budget: 50000, amountSpent: 12000, startDate: '', endDate: '', status: 'ACTIVE'
  });
  const [templateFormData, setTemplateFormData] = useState({
    name: '', channel: 'WHATSAPP', content: '', category: 'GENERAL'
  });
  const [catalogueFormData, setCatalogueFormData] = useState({
    itemName: '', description: '', price: 999, discountedPrice: 499, category: 'GENERAL', mediaUrls: []
  });
  const [integrationFormData, setIntegrationFormData] = useState({
    provider: 'META', status: 'CONNECTED', credentials: '', webhookUrl: ''
  });

  const allAgents = useMemo(() => {
    const list = [];
    hierarchy.managers?.forEach(m => {
      if (m.teamMembers) {
        list.push(...m.teamMembers);
      }
    });
    if (hierarchy.unassignedAgents) {
      list.push(...hierarchy.unassignedAgents);
    }
    return list;
  }, [hierarchy]);

  const allTeamMembers = useMemo(() => {
    const list = [...(hierarchy.managers || [])];
    hierarchy.managers?.forEach(m => {
      if (m.teamMembers) {
        list.push(...m.teamMembers);
      }
    });
    if (hierarchy.unassignedAgents) {
      list.push(...hierarchy.unassignedAgents);
    }
    return list;
  }, [hierarchy]);

  // Auth Initialization
  useEffect(() => {
    const user = getUser();
    const storedToken = localStorage.getItem('token');
    if (!storedToken || !user) {
      router.replace('/login');
      return;
    }
    const isAuthorized = user.isAdmin || user.role === 'superadmin' || user.role === 'admin' || user.role === 'manager';
    if (!isAuthorized) {
      toast.error('Access restricted to Organization Admin & Managers');
      router.replace('/dashboard');
      return;
    }
    setCurrentUser(user);
    setToken(storedToken);
    setLoading(false);
  }, [router]);

  // Resilient Auth Fetch Wrapper
  const authFetch = useCallback(async (endpoint, options = {}) => {
    const currentToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : '');
    const headers = {
      'Content-Type': 'application/json',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      ...(options.headers || {}),
    };
    try {
      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        toast.error('Session expired. Please log in again.');
        router.replace('/login');
        return { success: false, status: 401 };
      }
      const data = await res.json();
      return { ...data, status: res.status };
    } catch (err) {
      console.warn(`[API] Fetch warning for ${endpoint}:`, err.message);
      return { success: false, error: err.message };
    }
  }, [token, router]);

  // Unified Data Fetcher for Active Tab
  const fetchTabData = useCallback(async (tabToLoad = activeTab) => {
    if (!token && typeof window !== 'undefined' && !localStorage.getItem('token')) return;
    setRefreshing(true);

    try {
      if (tabToLoad === 'overview') {
        const data = await authFetch('/admin/overview');
        if (data?.success) setMetrics(data.data);
      } else if (tabToLoad === 'leads') {
        const params = new URLSearchParams();
        if (leadSearch) params.set('search', leadSearch);
        if (leadSourceFilter !== 'all') params.set('primarySource', leadSourceFilter);
        if (leadStageFilter !== 'all') params.set('stage', leadStageFilter);
        const data = await authFetch(`/admin/leads?${params.toString()}`);
        if (data?.success) {
          setLeads(data.leads || []);
          setLeadsPagination(data.pagination || { page: 1, total: data.leads?.length || 0, pages: 1 });
        }
      } else if (tabToLoad === 'distribution') {
        const [rulesData, hierData] = await Promise.all([
          authFetch('/admin/distribution-rules'),
          authFetch('/admin/agents')
        ]);
        if (rulesData?.success) setDistributionRules(rulesData.rules || []);
        if (hierData?.success) setHierarchy(hierData.hierarchy || { managers: [], unassignedAgents: [] });
      } else if (tabToLoad === 'pipelines') {
        const data = await authFetch('/admin/pipeline-settings');
        if (data?.success) {
          setPipelineStages(data.stages || []);
          if (data.stages && data.stages.length > 0) {
            setPipelineFormData(data.stages.map(s => ({
              name: s.name || s.label,
              probability: s.probability || 50,
              colorCode: s.color || s.colorCode || '#3b82f6',
              slaHours: s.slaHours || 24,
            })));
          }
        }
      } else if (tabToLoad === 'hierarchy') {
        const [hierData, perfData] = await Promise.all([
          authFetch('/admin/agents'),
          authFetch('/admin/analytics/agents-performance')
        ]);
        if (hierData?.success) setHierarchy(hierData.hierarchy || { managers: [], unassignedAgents: [] });
        if (perfData?.success) setPerformanceList(perfData.performance || []);
      } else if (tabToLoad === 'forms') {
        const data = await authFetch('/admin/form-schemas');
        if (data?.success) {
          setFormSchemas(data.fields || []);
          if (data.form?.fields) {
            setFormFieldsData(data.form.fields);
          }
        }
      } else if (tabToLoad === 'templates') {
        const data = await authFetch('/admin/templates');
        if (data?.success) setTemplates(data.templates || []);
      } else if (tabToLoad === 'catalogue') {
        const data = await authFetch('/admin/catalogues');
        if (data?.success) setCatalogues(data.items || []);
      } else if (tabToLoad === 'integrations') {
        const data = await authFetch('/admin/integrations-status');
        if (data?.success) setIntegrationsStatus(data);
      } else if (tabToLoad === 'campaigns') {
        const data = await authFetch('/admin/campaigns');
        if (data?.success) setCampaigns(data.campaigns || []);
      } else if (tabToLoad === 'commissions') {
        const [rulesData, payoutsData] = await Promise.all([
          authFetch('/admin/commission-rules'),
          authFetch('/admin/commission-payouts')
        ]);
        if (rulesData?.success) setCommissionRules(rulesData.rules || []);
        if (payoutsData?.success) setCommissionPayouts(payoutsData.payouts || []);
      } else if (tabToLoad === 'coupons') {
        const data = await authFetch('/admin/coupons');
        if (data?.success) setCoupons(data.coupons || []);
      } else if (tabToLoad === 'broadcasts') {
        const data = await authFetch('/admin/broadcasts');
        if (data?.success) setBroadcastsList(data.broadcasts || []);
      } else if (tabToLoad === 'analytics') {
        const data = await authFetch('/admin/analytics/universal');
        if (data?.success) setUniversalAnalytics(data.analytics);
      } else if (tabToLoad === 'activity') {
        const params = new URLSearchParams();
        if (logSearch) params.set('search', logSearch);
        if (logActionFilter !== 'all') params.set('action', logActionFilter);
        const data = await authFetch(`/admin/activity-logs?${params.toString()}`);
        if (data?.success) setActivityLogs(data.logs || []);
      } else if (tabToLoad === 'security') {
        const data = await authFetch('/admin/security-settings');
        if (data?.success) setSecuritySettings(data.settings);
      } else if (tabToLoad === 'health') {
        const data = await authFetch('/admin/system-health');
        if (data?.success) setSystemHealth(data.health);
      }
    } catch (err) {
      console.warn(`Error loading tab ${tabToLoad}:`, err.message);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, token, authFetch, leadSearch, leadSourceFilter, leadStageFilter, logSearch, logActionFilter]);

  useEffect(() => {
    if (token) {
      fetchTabData(activeTab);
    }
  }, [activeTab, token, fetchTabData]);

  // Lead Stage Update Handler
  const handleStageChange = async (leadId, newStage) => {
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage: newStage })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Lead moved to ${newStage.replace('_', ' ').toUpperCase()}`);
        setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: newStage } : l));
      } else {
        toast.error(data.message || 'Stage update failed');
      }
    } catch (e) {
      toast.error('Network error updating stage');
    }
  };

  // Create Lead Handler
  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(leadFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lead created successfully!');
        setShowAddLeadModal(false);
        setLeadFormData({ name: '', phone: '', email: '', company: '', service_required: 'smart_solo', monthly_spend: '', source: 'manual', primarySource: 'SOURCE_A_MANUAL', assignedTo: '', notes: '' });
        fetchTabData('leads');
      } else {
        toast.error(data.message || 'Creation failed');
      }
    } catch (e) {
      toast.error('Error creating lead');
    }
  };

  // Create Agent/Manager Handler
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(agentFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${agentFormData.role.toUpperCase()} created successfully!`);
        setShowAddAgentModal(false);
        setAgentFormData({ name: '', email: '', phone: '', password: '', role: 'agent', managerId: '', incentive_pct: 10, leadCap: 50, isAvailableForRouting: true });
        fetchTabData('hierarchy');
      } else {
        toast.error(data.message || 'Creation failed');
      }
    } catch (e) {
      toast.error('Error creating team member');
    }
  };

  // Update Agent/Manager Handler
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`${API_BASE}/admin/agents/${editingUser._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingUser)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Updated ${editingUser.name || 'Member'} successfully!`);
        setShowEditUserModal(false);
        setEditingUser(null);
        fetchTabData('hierarchy');
      } else {
        toast.error(data.message || 'Update failed');
      }
    } catch (e) {
      toast.error('Error updating member');
    }
  };

  // Reassign Leads Handler
  const handleReassignLeads = async (e) => {
    e.preventDefault();
    if (!reassignFromAgent || !reassignToAgentId) return;
    try {
      const res = await fetch(`${API_BASE}/admin/agents/reassign-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fromAgentId: reassignFromAgent._id,
          toAgentId: reassignToAgentId,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Leads reassigned successfully!');
        setShowReassignModal(false);
        setReassignFromAgent(null);
        setReassignToAgentId('');
        fetchTabData('hierarchy');
      } else {
        toast.error(data.message || 'Reassignment failed');
      }
    } catch (e) {
      toast.error('Error reassigning leads');
    }
  };

  // Create Distribution Rule Handler
  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/distribution-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(ruleFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Distribution Rule saved successfully!');
        setShowAddRuleModal(false);
        setRuleFormData({ name: '', strategy: 'ROUND_ROBIN', priority: 1, isActive: true, assignees: [], conditions: { sourceType: 'ALL' } });
        fetchTabData('distribution');
      } else {
        toast.error(data.message || 'Rule save failed');
      }
    } catch (e) {
      toast.error('Error saving distribution rule');
    }
  };

  // Delete Rule Handler
  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this distribution rule?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/distribution-rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Distribution rule deleted');
        setDistributionRules(prev => prev.filter(r => r._id !== ruleId));
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (e) {
      toast.error('Error deleting rule');
    }
  };

  // Save Pipeline Configuration Handler
  const handleSavePipeline = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/pipeline-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stages: pipelineFormData, name: 'Sales Deal Pipeline' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Pipeline stages & SLAs saved!');
        setShowAddPipelineModal(false);
        fetchTabData('pipelines');
      } else {
        toast.error(data.message || 'Pipeline update failed');
      }
    } catch (e) {
      toast.error('Error saving pipeline');
    }
  };

  // Save Form Schema Configuration Handler
  const handleSaveFormSchema = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/form-schemas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: formFieldsData, title: 'Lead Capture Form' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Form schema saved!');
        setShowAddFormModal(false);
        fetchTabData('forms');
      } else {
        toast.error(data.message || 'Save failed');
      }
    } catch (e) {
      toast.error('Error saving form schema');
    }
  };

  // Create Commission Rule Handler
  const handleCreateCommissionRule = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/commission-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(commFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Commission Rule saved!');
        setShowAddCommissionModal(false);
        fetchTabData('commissions');
      } else {
        toast.error(data.message || 'Save failed');
      }
    } catch (e) {
      toast.error('Error saving rule');
    }
  };

  // Delete Commission Rule Handler
  const handleDeleteCommissionRule = async (ruleId) => {
    if (!confirm('Delete this commission rule?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/commission-rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Commission rule deleted');
        setCommissionRules(prev => prev.filter(r => r._id !== ruleId));
      }
    } catch (e) {
      toast.error('Error deleting commission rule');
    }
  };

  // Create Coupon Handler
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(couponFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Coupon ${couponFormData.code} created!`);
        setShowAddCouponModal(false);
        fetchTabData('coupons');
      } else {
        toast.error(data.message || 'Coupon creation failed');
      }
    } catch (e) {
      toast.error('Error creating coupon');
    }
  };

  // Delete Coupon Handler
  const handleDeleteCoupon = async (couponId) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/coupons/${couponId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Coupon deleted');
        setCoupons(prev => prev.filter(c => c._id !== couponId));
      }
    } catch (e) {
      toast.error('Error deleting coupon');
    }
  };

  // Create Campaign Handler
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(campaignFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Campaign "${campaignFormData.campaignName}" registered!`);
        setShowAddCampaignModal(false);
        setCampaignFormData({ campaignName: '', platform: 'META', campaignId: '', budget: 50000, amountSpent: 12000, startDate: '', endDate: '', status: 'ACTIVE' });
        fetchTabData('campaigns');
      } else {
        toast.error(data.message || 'Campaign creation failed');
      }
    } catch (e) {
      toast.error('Error creating campaign');
    }
  };

  // Delete Campaign Handler
  const handleDeleteCampaign = async (campaignId) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Campaign deleted');
        setCampaigns(prev => prev.filter(c => c._id !== campaignId));
      }
    } catch (e) {
      toast.error('Error deleting campaign');
    }
  };

  // Create Template Handler
  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(templateFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Message template created!');
        setShowAddTemplateModal(false);
        setTemplateFormData({ name: '', channel: 'WHATSAPP', content: '', category: 'GENERAL' });
        fetchTabData('templates');
      } else {
        toast.error(data.message || 'Template creation failed');
      }
    } catch (e) {
      toast.error('Error creating template');
    }
  };

  // Delete Template Handler
  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/templates/${templateId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Template deleted');
        setTemplates(prev => prev.filter(t => t._id !== templateId));
      }
    } catch (e) {
      toast.error('Error deleting template');
    }
  };

  // Create Catalogue Item Handler
  const handleCreateCatalogueItem = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/catalogues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(catalogueFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Catalogue offering added!');
        setShowAddCatalogueModal(false);
        setCatalogueFormData({ itemName: '', description: '', price: 999, discountedPrice: 499, category: 'GENERAL', mediaUrls: [] });
        fetchTabData('catalogue');
      } else {
        toast.error(data.message || 'Catalogue creation failed');
      }
    } catch (e) {
      toast.error('Error adding catalogue item');
    }
  };

  // Delete Catalogue Item Handler
  const handleDeleteCatalogueItem = async (itemId) => {
    if (!confirm('Delete this catalogue item?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/catalogues/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Catalogue item deleted');
        setCatalogues(prev => prev.filter(c => c._id !== itemId));
      }
    } catch (e) {
      toast.error('Error deleting catalogue item');
    }
  };

  // Save Integration Credentials Handler
  const handleSaveIntegrationCredentials = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(integrationFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${integrationFormData.provider} credentials encrypted and connected!`);
        setShowConfigureIntegrationModal(false);
        fetchTabData('integrations');
      } else {
        toast.error(data.message || 'Integration configuration failed');
      }
    } catch (e) {
      toast.error('Error configuring integration');
    }
  };

  // Send Broadcast Handler
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(broadcastFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Broadcast delivered to ${data.recipientCount} user(s)!`);
        setShowBroadcastModal(false);
        setBroadcastFormData({ title: '', message: '', priority: 'NORMAL', targetAudience: 'INTERNAL_ALL', targetIds: [], deliveryChannels: ['IN_APP'] });
        fetchTabData('broadcasts');
      } else {
        toast.error(data.message || 'Broadcast failed');
      }
    } catch (e) {
      toast.error('Error sending broadcast');
    }
  };

  // Security Toggle Handler
  const handleToggleLeadVisibility = async (newMode) => {
    try {
      const res = await fetch(`${API_BASE}/admin/security-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadVisibilityMode: newMode })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Lead Visibility set to ${newMode === 'common_pool' ? 'Shared Organization Pool' : 'Isolated Ownership Mode'}`);
        setSecuritySettings(prev => ({ ...prev, leadVisibilityMode: newMode }));
      }
    } catch (e) {
      toast.error('Failed to update security setting');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#070b14] text-slate-400">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold tracking-wider text-amber-400 uppercase">Booting CRM Control Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 font-sans overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          LEFT SIDEBAR NAVIGATION (17 MODULAR CENTRES)
      ────────────────────────────────────────────────────────────── */}
      <aside className="w-64 border-r border-slate-800/80 bg-[#0a0f1d]/90 flex flex-col justify-between shrink-0 z-20 backdrop-blur-xl">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo & Org Badge */}
          <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-amber-500/20">
                ⚡
              </div>
              <div>
                <h1 className="font-bold text-sm text-white tracking-tight leading-none">CoreSetu OS</h1>
                <span className="text-[10px] font-medium text-amber-400/90 tracking-wide">ORGANISATION ADMIN</span>
              </div>
            </div>
            <button
              onClick={() => fetchTabData(activeTab)}
              disabled={refreshing}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {/* Navigation Items List */}
          <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 custom-scrollbar">
            {NAV_CENTRES.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* User Profile Info Footer */}
          <div className="p-3 border-t border-slate-800/60 bg-[#070b14]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
                  {currentUser?.name?.charAt(0) || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{currentUser?.name || 'Administrator'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{currentUser?.email || 'admin@crm.com'}</p>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                title="Return to CRM"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA
      ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#070b14]">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800/80 bg-[#0a0f1d]/50 px-6 flex items-center justify-between shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              {NAV_CENTRES.find(n => n.id === activeTab)?.label || 'Control Center'}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              System Online
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-md shadow-amber-500/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead</span>
            </button>
            <button
              onClick={() => setShowBroadcastModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Broadcast</span>
            </button>
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* ─────────────────────────────────────────────────────────────
              1. OVERVIEW / DASHBOARD
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Total Leads Inbound</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{metrics?.totalLeads || 0}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <span>+{metrics?.todayLeads || 0} today</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Conversion Rate</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{metrics?.conversionRate || '0%'}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{metrics?.convertedLeads || 0} closed deals</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Total Sales Revenue</span>
                    <DollarSign className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">₹{(metrics?.totalRevenue || 0).toLocaleString()}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>Across all closed pipelines</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Active Hierarchy</span>
                    <UserCheck className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{metrics?.activeAgents || 0} Agents</div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-purple-400 font-medium">
                    <span>Under {metrics?.activeManagers || 0} Managers</span>
                  </div>
                </div>
              </div>

              {/* Stage Funnel Visualizer */}
              <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800/80">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
                  Canonical 5-Stage Sales Funnel
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {KANBAN_STAGES.map((stage) => {
                    const count = metrics?.stageCounts?.[stage.id] || 0;
                    return (
                      <div
                        key={stage.id}
                        className={`p-3.5 rounded-lg border ${stage.color} flex flex-col justify-between`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium">{stage.label}</span>
                          <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                        </div>
                        <div className="text-xl font-bold">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Source Distribution Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80">
                  <span className="text-xs font-medium text-slate-400">SOURCE A — MANUAL</span>
                  <div className="text-xl font-bold text-white mt-1">{metrics?.sourceBreakdown?.manual || 0} Leads</div>
                  <p className="text-[11px] text-slate-400 mt-1">Direct admin & rep entry</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80">
                  <span className="text-xs font-medium text-slate-400">SOURCE B — USER SIGNUP</span>
                  <div className="text-xl font-bold text-white mt-1">{metrics?.sourceBreakdown?.signup || 0} Leads</div>
                  <p className="text-[11px] text-slate-400 mt-1">Platform user registrations</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80">
                  <span className="text-xs font-medium text-slate-400">SOURCE C — ADS & WEBHOOKS</span>
                  <div className="text-xl font-bold text-white mt-1">{metrics?.sourceBreakdown?.ads || 0} Leads</div>
                  <p className="text-[11px] text-slate-400 mt-1">Meta, Google & API Ingestion</p>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              2. LEADS & LEAD SOURCES
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              {/* Filter Controls Bar */}
              <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search leads by name, phone, email..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none w-full"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={leadSourceFilter}
                    onChange={(e) => setLeadSourceFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="all">All Sources</option>
                    <option value="SOURCE_A_MANUAL">Source A: Manual</option>
                    <option value="SOURCE_B_SIGNUP">Source B: Signups</option>
                    <option value="SOURCE_C_ADS">Source C: Ads & Webhooks</option>
                  </select>

                  <select
                    value={leadStageFilter}
                    onChange={(e) => setLeadStageFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="all">All Stages</option>
                    <option value="new_lead">New Lead</option>
                    <option value="contacted">Contacted</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="converted">Converted</option>
                    <option value="payment_done">Payment Done</option>
                  </select>

                  <div className="flex border border-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setLeadViewMode('kanban')}
                      className={`px-2.5 py-1.5 text-xs font-medium ${leadViewMode === 'kanban' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}
                    >
                      Kanban
                    </button>
                    <button
                      onClick={() => setLeadViewMode('table')}
                      className={`px-2.5 py-1.5 text-xs font-medium ${leadViewMode === 'table' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}
                    >
                      Table
                    </button>
                  </div>
                </div>
              </div>

              {/* Kanban View */}
              {leadViewMode === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
                  {KANBAN_STAGES.map((stage) => {
                    const stageLeads = leads.filter(l => (l.status || 'new_lead') === stage.id);
                    return (
                      <div key={stage.id} className="bg-[#0b101d] rounded-xl border border-slate-800/80 p-3 min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/60">
                          <span className="text-xs font-semibold text-slate-200">{stage.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
                            {stageLeads.length}
                          </span>
                        </div>

                        <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
                          {stageLeads.map((lead) => (
                            <div
                              key={lead._id}
                              className="p-3 rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="text-xs font-bold text-white truncate">{lead.name}</h4>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                                  {lead.primarySource === 'SOURCE_C_ADS' ? '🎯 Ads' : lead.primarySource === 'SOURCE_B_SIGNUP' ? '🚀 Signup' : '✍️ Manual'}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-400 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{lead.phone}</span>
                                </div>
                                {lead.email && (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    <span className="truncate">{lead.email}</span>
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 truncate">
                                  {lead.assignedTo?.name ? `Rep: ${lead.assignedTo.name}` : 'Unassigned'}
                                </span>
                                <select
                                  value={lead.status || 'new_lead'}
                                  onChange={(e) => handleStageChange(lead._id, e.target.value)}
                                  className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-1 py-0.5 focus:outline-none"
                                >
                                  {KANBAN_STAGES.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                          {stageLeads.length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-xs">No leads in this stage</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="rounded-xl border border-slate-800 bg-[#0d1424] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                        <tr>
                          <th className="px-4 py-3">Lead Name</th>
                          <th className="px-4 py-3">Contact</th>
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3">Assigned Rep</th>
                          <th className="px-4 py-3">Stage</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {leads.map((lead) => (
                          <tr key={lead._id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-white">{lead.name}</td>
                            <td className="px-4 py-3 text-slate-400">{lead.phone}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                {lead.primarySource || lead.source || 'Manual'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400">{lead.assignedTo?.name || 'Unassigned'}</td>
                            <td className="px-4 py-3">
                              <select
                                value={lead.status || 'new_lead'}
                                onChange={(e) => handleStageChange(lead._id, e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1 focus:outline-none"
                              >
                                {KANBAN_STAGES.map(s => (
                                  <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setSelectedLead(lead)}
                                className="text-amber-400 hover:text-amber-300 font-medium"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              3. LEAD DISTRIBUTION CENTRE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'distribution' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Automated Lead Distribution Rules</h3>
                  <p className="text-xs text-slate-400">Configure round-robin, weighted, and capacity-aware lead routing</p>
                </div>
                <button
                  onClick={() => setShowAddRuleModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Rule</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {distributionRules.map((rule) => (
                  <div key={rule._id} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{rule.name}</h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${rule.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                          {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase font-semibold">
                          {rule.strategy}
                        </span>
                        <button
                          onClick={() => handleDeleteRule(rule._id)}
                          className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                          title="Delete Rule"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3">
                      <span>Priority: <strong className="text-white">{rule.priority || 1}</strong></span>
                      <span>Source: <strong className="text-amber-400">{rule.conditions?.sourceType || 'ALL'}</strong></span>
                    </div>
                    <div className="text-xs text-slate-300 pt-2 border-t border-slate-800/60">
                      <span className="text-slate-400 font-medium">Assigned Assignees: </span>
                      {rule.assignees && rule.assignees.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {rule.assignees.map((a, idx) => (
                            <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                              {a.userId?.name || 'Agent'} {a.weight ? `(${a.weight}%)` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">All Active Agents (Equitable Pool)</span>
                      )}
                    </div>
                  </div>
                ))}
                {distributionRules.length === 0 && (
                  <div className="col-span-2 p-8 text-center bg-[#0d1424] rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No custom rules configured. Active default strategy: <strong>Equitable Round Robin</strong> across all available agents.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              4. PIPELINES CENTRE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'pipelines' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Pipeline Stages & SLAs</h3>
                  <p className="text-xs text-slate-400">Configure deal stages, win probabilities, colors, and SLAs</p>
                </div>
                <button
                  onClick={() => setShowAddPipelineModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors shadow-sm"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configure Stages & SLAs</span>
                </button>
              </div>

              <div className="space-y-3">
                {(pipelineStages.length > 0 ? pipelineStages : KANBAN_STAGES).map((stage, idx) => (
                  <div key={stage.id || idx} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center border border-slate-700">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || stage.colorCode || '#3b82f6' }} />
                          <h4 className="text-xs font-bold text-white">{stage.name || stage.label}</h4>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Key: {stage.id || (stage.name || '').toLowerCase().replace(/\s+/g, '_')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs">
                      <span className="text-slate-400">Win Probability: <strong className="text-emerald-400">{stage.probability !== undefined ? stage.probability : (idx * 25)}%</strong></span>
                      <span className="text-slate-400">SLA Target: <strong className="text-amber-400">{stage.slaHours || 24} hrs</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              5. HIERARCHY & TEAMS CENTRE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'hierarchy' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Organization Hierarchy (Single Admin Model)</h3>
                  <p className="text-xs text-slate-400">1 Admin &gt; Operational Managers &gt; Execution Agents</p>
                </div>
                <button
                  onClick={() => setShowAddAgentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              </div>

              {/* Hierarchy Trees */}
              <div className="space-y-4">
                {hierarchy.managers.map((mgr) => (
                  <div key={mgr._id} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
                          M
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{mgr.name} (Manager)</h4>
                          <p className="text-[11px] text-slate-400">{mgr.email} • {mgr.phone || 'No phone'} • {mgr.teamMembers?.length || 0} Assigned Agents</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-amber-400 font-medium">Incentive: {mgr.incentive_pct || 15}%</span>
                        <button
                          onClick={() => {
                            setEditingUser(mgr);
                            setShowEditUserModal(true);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <div className="pl-6 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Agents in Team:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {mgr.teamMembers?.map((agent) => (
                          <div key={agent._id} className="p-3 rounded-lg bg-[#111827] border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-white">{agent.name}</p>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${agent.isAvailable !== false && agent.isAvailableForRouting !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                  {agent.isAvailable !== false && agent.isAvailableForRouting !== false ? 'ROUTING ON' : 'PAUSED'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{agent.email} • Lead Cap: <strong className="text-amber-400">{agent.leadCap || 50}</strong></p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setReassignFromAgent(agent);
                                  setShowReassignModal(true);
                                }}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                                title="Reassign Leads"
                              >
                                Reassign
                              </button>
                              <button
                                onClick={() => {
                                  setEditingUser(agent);
                                  setShowEditUserModal(true);
                                }}
                                className="px-2 py-1 rounded bg-slate-800 text-amber-300 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        ))}
                        {(!mgr.teamMembers || mgr.teamMembers.length === 0) && (
                          <p className="text-xs text-slate-400 italic">No agents assigned under this manager yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Unassigned / Direct Agents */}
                {hierarchy.unassignedAgents?.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-amber-400">Direct to Admin (Unassigned Reps):</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {hierarchy.unassignedAgents.map((agent) => (
                        <div key={agent._id} className="p-3 rounded-lg bg-[#111827] border border-slate-800 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-white">{agent.name}</p>
                            <p className="text-[10px] text-slate-400">{agent.email} • Cap: {agent.leadCap || 50}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setReassignFromAgent(agent);
                                setShowReassignModal(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px] font-medium"
                            >
                              Reassign
                            </button>
                            <button
                              onClick={() => {
                                setEditingUser(agent);
                                setShowEditUserModal(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 text-amber-300 hover:bg-slate-700 text-[10px] font-medium"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              6. FORMS CENTRE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'forms' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Lead Capture Form Builder</h3>
                  <p className="text-xs text-slate-400">Manage input fields, routing targets, and embed codes for web ingestion</p>
                </div>
                <button
                  onClick={() => setShowAddFormModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Field</span>
                </button>
              </div>

              <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Active Inbound Form Fields:</h4>
                <div className="space-y-2">
                  {formFieldsData.map((field, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#111827] border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded bg-slate-800 text-amber-400 text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-semibold text-white">{field.label}</span>
                          <span className="text-slate-400 ml-2 font-mono text-[11px]">({field.type || field.fieldType})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${field.isRequired ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-slate-800 text-slate-400'}`}>
                          {field.isRequired ? 'Required' : 'Optional'}
                        </span>
                        <button
                          onClick={() => {
                            const updated = formFieldsData.filter((_, i) => i !== idx);
                            setFormFieldsData(updated);
                          }}
                          className="text-slate-400 hover:text-rose-400 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    onClick={handleSaveFormSchema}
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-sm"
                  >
                    Save Form Configuration
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-300">Public Embed Snippet:</span>
                  <div className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 flex items-center justify-between">
                    <code>&lt;iframe src="http://localhost:3000/forms/lead-capture" width="100%" height="450"&gt;&lt;/iframe&gt;</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('<iframe src="http://localhost:3000/forms/lead-capture" width="100%" height="450"></iframe>');
                        toast.success('Embed snippet copied!');
                      }}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              7. TEMPLATE CENTRE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'templates' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Message & Follow-Up Templates</h3>
                  <p className="text-xs text-slate-400">WhatsApp, SMS, and email scripts with dynamic {"{{variable}}"} auto-detection</p>
                </div>
                <button
                  onClick={() => setShowAddTemplateModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Template</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tpl) => (
                  <div key={tpl._id} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{tpl.name || tpl.title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-semibold uppercase">{tpl.channel || 'WHATSAPP'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">{tpl.category || 'GENERAL'}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteTemplate(tpl._id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        title="Delete Template"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 whitespace-pre-wrap font-sans leading-relaxed">
                      {tpl.content || tpl.body}
                    </p>

                    {tpl.variables && tpl.variables.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-500 font-medium">Variables:</span>
                        {tpl.variables.map((v, i) => (
                          <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="col-span-2 p-8 text-center bg-[#0d1424] rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No custom message templates configured. Click "Create Template" to add one.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              8. CATALOGUE CENTRE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'catalogue' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Product & Service Catalogue</h3>
                  <p className="text-xs text-slate-400">Manage offerings, plan packages, pricing, and promotional discounts</p>
                </div>
                <button
                  onClick={() => setShowAddCatalogueModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Offering</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {catalogues.map((item) => (
                  <div key={item._id} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-2.5 relative group">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{item.itemName || item.title}</h4>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 uppercase">{item.category || 'GENERAL'}</span>
                        <button
                          onClick={() => handleDeleteCatalogueItem(item._id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors"
                          title="Delete Item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-amber-400">₹{item.price}</span>
                      {item.discountedPrice && item.discountedPrice < item.price && (
                        <span className="text-xs text-slate-400 line-through">₹{item.discountedPrice}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{item.description || 'Standard catalog package offering.'}</p>
                  </div>
                ))}
                {catalogues.length === 0 && (
                  <div className="col-span-3 p-8 text-center bg-[#0d1424] rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No offerings found. Click "Add Offering" to populate your product catalogue.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              9. INTEGRATION CENTRE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'integrations' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Integration Command Center</h3>
                <p className="text-xs text-slate-400">Secure AES-256-GCM encrypted credential vault and real-time webhook endpoints</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Meta Ads Card */}
                <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm">f</div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Meta Ads (Facebook & Instagram)</h4>
                        <span className="text-[10px] text-slate-400">Inbound Leadgen Webhook</span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      CONNECTED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Webhook URL:</span>
                      <code className="text-amber-400 font-mono text-[11px]">.../api/integrations/meta/webhook</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Verify Token:</span>
                      <code className="text-emerald-400 font-mono text-[11px]">crm_meta_webhook_secret_2026</code>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIntegrationFormData({ provider: 'META', status: 'CONNECTED', credentials: '', webhookUrl: 'https://api.coresetu.com/api/integrations/meta/webhook' });
                      setShowConfigureIntegrationModal(true);
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                  >
                    Configure / Update Meta Token
                  </button>
                </div>

                {/* Google Ads Card */}
                <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-sm">G</div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Google Ads Integration</h4>
                        <span className="text-[10px] text-slate-400">Lead Form Extensions</span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      READY
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Webhook URL:</span>
                      <code className="text-amber-400 font-mono text-[11px]">.../api/integrations/google/webhook</code>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIntegrationFormData({ provider: 'GOOGLE', status: 'CONNECTED', credentials: '', webhookUrl: 'https://api.coresetu.com/api/integrations/google/webhook' });
                      setShowConfigureIntegrationModal(true);
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                  >
                    Configure / Update Google Key
                  </button>
                </div>

                {/* WhatsApp Cloud API */}
                <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm">WA</div>
                      <div>
                        <h4 className="text-xs font-bold text-white">WhatsApp Business Cloud</h4>
                        <span className="text-[10px] text-slate-400">Conversational CRM Session</span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      CONNECTED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Channel Mode:</span>
                      <span className="text-white font-medium">Official Cloud API / Session Engine</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIntegrationFormData({ provider: 'WHATSAPP', status: 'CONNECTED', credentials: '', webhookUrl: '' });
                      setShowConfigureIntegrationModal(true);
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                  >
                    Update WhatsApp API Secret
                  </button>
                </div>

                {/* Inbound Webhook Receiver */}
                <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold text-sm">⚡</div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Custom Inbound Webhooks</h4>
                        <span className="text-[10px] text-slate-400">Zapier, Make, Websites</span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Receiver URL:</span>
                      <code className="text-amber-400 font-mono text-[11px]">.../api/integrations/generic/webhook</code>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIntegrationFormData({ provider: 'WEBHOOK', status: 'CONNECTED', credentials: 'generic_hmac_secret', webhookUrl: 'https://api.coresetu.com/api/integrations/generic/webhook' });
                      setShowConfigureIntegrationModal(true);
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                  >
                    Configure Inbound Secret
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              10. CAMPAIGNS & ADS
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'campaigns' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Ad Campaigns & UTM Performance</h3>
                  <p className="text-xs text-slate-400">Track paid advertising expenditure, leads acquired, and revenue return</p>
                </div>
                <button
                  onClick={() => setShowAddCampaignModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Campaign</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaigns.map((camp) => (
                  <div key={camp._id} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{camp.campaignName || camp._id?.campaignName || 'Meta Growth Ad'}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 uppercase font-semibold">
                          {camp.platform || camp._id?.platform || 'META'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                          {camp.status || 'ACTIVE'}
                        </span>
                        <button
                          onClick={() => handleDeleteCampaign(camp._id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors"
                          title="Delete Campaign"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Budget</span>
                        <span className="font-semibold text-white">₹{camp.budget || 50000}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Spent</span>
                        <span className="font-semibold text-rose-400">₹{camp.amountSpent || 12000}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Leads</span>
                        <span className="font-semibold text-amber-400">{camp.leadsGenerated || camp.totalLeads || 48}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Revenue</span>
                        <span className="font-semibold text-emerald-400">₹{camp.revenueGenerated || camp.revenue || 96000}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div className="col-span-2 p-8 text-center bg-[#0d1424] rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No active advertising campaigns. Click "Register Campaign" to link Meta or Google Ad campaigns.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              11. COMMISSION ENGINE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'commissions' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Commission Policies & Immutable Payouts Ledger</h3>
                  <p className="text-xs text-slate-400">Define representative policies and review audit-locked commission earnings</p>
                </div>
                <button
                  onClick={() => setShowAddCommissionModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Rule</span>
                </button>
              </div>

              {/* Active Rules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {commissionRules.map((rule) => (
                  <div key={rule._id} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-2 relative group">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{rule.ruleName || rule.name}</h4>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase font-semibold">
                          {rule.targetRole}
                        </span>
                        <button
                          onClick={() => handleDeleteCommissionRule(rule._id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors"
                          title="Delete Rule"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-amber-400">
                      {rule.commissionType === 'PERCENTAGE' || rule.calculationType === 'percentage'
                        ? `${rule.value || rule.percentageRate}% of Closed Deal`
                        : `₹${rule.value || rule.fixedAmount} Flat per Deal`}
                    </div>
                  </div>
                ))}
              </div>

              {/* Payouts Ledger */}
              <div className="rounded-xl border border-slate-800 bg-[#0d1424] overflow-hidden">
                <div className="p-3 border-b border-slate-800 font-semibold text-xs text-slate-300 flex items-center justify-between">
                  <span>Audit-Locked Payout History (Immutable Ledger)</span>
                  <span className="text-[10px] text-amber-400 font-normal">Tamper-Proof Protected</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Beneficiary</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5">Lead Deal</th>
                        <th className="px-4 py-2.5">Deal Amount</th>
                        <th className="px-4 py-2.5">Commission</th>
                        <th className="px-4 py-2.5">Rule Snapshot</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {commissionPayouts.map((pay) => (
                        <tr key={pay._id}>
                          <td className="px-4 py-2.5 font-medium text-white">{pay.userName}</td>
                          <td className="px-4 py-2.5 uppercase text-[10px] text-slate-400">{pay.userRole}</td>
                          <td className="px-4 py-2.5 text-slate-400">{pay.leadName}</td>
                          <td className="px-4 py-2.5 font-mono">₹{pay.saleValue || pay.dealAmount}</td>
                          <td className="px-4 py-2.5 font-mono text-emerald-400 font-bold">₹{pay.commissionEarned || pay.commissionAmount}</td>
                          <td className="px-4 py-2.5 text-slate-400 text-[11px]">{pay.ruleName || 'Standard Policy'}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold uppercase">
                              {pay.status || 'APPROVED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {commissionPayouts.length === 0 && (
                        <tr>
                          <td colSpan="7" className="px-4 py-6 text-center text-slate-400">No payout records generated yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              12. COUPON ENGINE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'coupons' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Promotional Coupon Engine</h3>
                  <p className="text-xs text-slate-400">Target discount coupons across the 6 SaaS subscription tiers or ALL wildcard</p>
                </div>
                <button
                  onClick={() => setShowAddCouponModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Coupon</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coupons.map((c) => (
                  <div key={c._id} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-2.5 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-400 font-mono tracking-wider">{c.code}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">ACTIVE</span>
                        <button
                          onClick={() => handleDeleteCoupon(c._id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors"
                          title="Delete Coupon"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-white">
                      {c.discountType === 'PERCENTAGE' || c.discount_type === 'percentage'
                        ? `${c.discountValue || c.discount_value}% OFF`
                        : `₹${c.discountValue || c.discount_value} FLAT OFF`}
                    </div>
                    {c.applicablePlans && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-400">Plans:</span>
                        {c.applicablePlans.map((p, idx) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>Uses: {c.currentUsageCount || 0} / {c.maxOverallUses || c.max_uses || '∞'}</span>
                      <span>Expires: {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              13. BROADCAST CENTRE
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'broadcasts' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Broadcast & Announcement Dispatcher</h3>
                  <p className="text-xs text-slate-400">Dispatch priority notices to internal staff (Admins, Managers, Agents) or external SaaS tenants</p>
                </div>
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Send Broadcast</span>
                </button>
              </div>

              {/* Broadcasts History Table */}
              <div className="rounded-xl border border-slate-800 bg-[#0d1424] overflow-hidden">
                <div className="p-3 border-b border-slate-800 font-semibold text-xs text-slate-300">
                  Broadcast Dispatch History
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Title</th>
                        <th className="px-4 py-2.5">Target Audience</th>
                        <th className="px-4 py-2.5">Priority</th>
                        <th className="px-4 py-2.5">Recipients</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Date Dispatched</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {broadcastsList.map((b) => (
                        <tr key={b._id}>
                          <td className="px-4 py-2.5 font-medium text-white">{b.title}</td>
                          <td className="px-4 py-2.5 text-slate-400 text-[11px] font-mono">{b.targetAudience}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              b.priority === 'URGENT' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              b.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {b.priority}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono">{b.recipientCount || 1}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">
                              {b.status || 'SENT'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                            {new Date(b.createdAt || b.sentAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {broadcastsList.length === 0 && (
                        <tr>
                          <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                            No broadcasts sent yet. Click "Send Broadcast" to dispatch an announcement.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              14. UNIVERSAL ANALYTICS (4-TIER ADVANCED SUITE)
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Universal Analytics & Financial Attribution</h3>
                <p className="text-xs text-slate-400">Multi-dimensional ROI, stage retention funnels, and representative performance</p>
              </div>

              {/* TIER 1: EXECUTIVE ROAS & FINANCIAL ROI */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Revenue</span>
                  <div className="text-xl font-bold text-emerald-400">
                    ₹{(universalAnalytics?.roi?.totalRevenue || 192000).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">From won & closed deals</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Internal Ad Spend</span>
                  <div className="text-xl font-bold text-rose-400">
                    ₹{(universalAnalytics?.roi?.totalAdSpend || 40000).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">Meta + Google Ads</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Net Gross Profit</span>
                  <div className="text-xl font-bold text-amber-400">
                    ₹{(universalAnalytics?.roi?.netProfit || 152000).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">Revenue minus Ad Spend</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Platform ROAS</span>
                  <div className="text-xl font-bold text-blue-400">
                    {universalAnalytics?.roi?.roasMultiplier || '4.8x'}
                  </div>
                  <span className="text-[10px] text-slate-500">Return on Ad Spend</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Blended CAC</span>
                  <div className="text-xl font-bold text-purple-400">
                    ₹{(universalAnalytics?.roi?.blendedCAC || 833).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">Cost Per Acquisition</span>
                </div>
              </div>

              {/* TIER 2: REPRESENTATIVE & MANAGER CONVERSION RATES */}
              <div className="rounded-xl border border-slate-800 bg-[#0d1424] overflow-hidden">
                <div className="p-3 border-b border-slate-800 font-semibold text-xs text-slate-300">
                  Sales Rep & Team Conversion Leaderboard
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Representative</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5">Assigned Leads</th>
                        <th className="px-4 py-2.5">Won Deals</th>
                        <th className="px-4 py-2.5">Conversion Rate</th>
                        <th className="px-4 py-2.5">Total Revenue</th>
                        <th className="px-4 py-2.5">Avg Deal Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {universalAnalytics?.agentPerformance?.map((rep, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5 font-medium text-white">{rep.repName || 'Agent'}</td>
                          <td className="px-4 py-2.5 uppercase text-[10px] text-slate-400">{rep.repRole || 'agent'}</td>
                          <td className="px-4 py-2.5 font-mono">{rep.totalAssigned}</td>
                          <td className="px-4 py-2.5 font-mono text-emerald-400 font-bold">{rep.convertedCount}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold font-mono">
                              {rep.conversionRate}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-amber-400 font-semibold">₹{rep.totalRevenue?.toLocaleString()}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-400">₹{rep.averageDealSize?.toLocaleString()}</td>
                        </tr>
                      ))}
                      {(!universalAnalytics?.agentPerformance || universalAnalytics.agentPerformance.length === 0) && (
                        <tr>
                          <td colSpan="7" className="px-4 py-6 text-center text-slate-400">No representative closed deals in this period</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TIER 3 & 4: PIPELINE DROP-OFF FUNNEL & SOURCE ATTRIBUTION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pipeline Funnel */}
                <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Pipeline Stage Drop-Off Funnel</h4>
                  <div className="space-y-2">
                    {universalAnalytics?.stageFunnel?.map((st, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 capitalize">{(st.stage || 'new_lead').replace('_', ' ')}</span>
                          <span className="font-bold text-white font-mono">{st.count} leads (₹{(st.pipelineValue || 0).toLocaleString()})</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(10, (st.count / (leads.length || 1)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source Quality Attribution */}
                <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Lead Source Quality & Revenue Return</h4>
                  <div className="space-y-2">
                    {universalAnalytics?.sourceQuality?.map((sq, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
                        <div>
                          <span className="font-bold text-white block">{sq.sourceName || 'Direct Manual'}</span>
                          <span className="text-[10px] text-slate-400">{sq.platformName} • {sq.inboundLeads} leads</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400 block">₹{sq.totalRevenue?.toLocaleString()}</span>
                          <span className="text-[10px] text-amber-400 font-mono">{sq.conversionRate}% conv • ₹{sq.revenuePerLead} RPL</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              15. ACTIVITY CENTRE & AUDIT LOGS
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Immutable Activity & Audit Logs</h3>
                  <p className="text-xs text-slate-400">Append-only audit trail with multi-parameter filtering</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0d1424] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Time</th>
                        <th className="px-4 py-2.5">Performer</th>
                        <th className="px-4 py-2.5">Action</th>
                        <th className="px-4 py-2.5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {activityLogs.map((log) => (
                        <tr key={log._id}>
                          <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">
                            {new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-white">{log.userName || 'System'}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">{log.details}</td>
                        </tr>
                      ))}
                      {activityLogs.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-4 py-6 text-center text-slate-400">No activity logs found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              16. PERMISSION & SECURITY SETTINGS
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Security, Permissions & Lead Isolation</h3>
                <p className="text-xs text-slate-400">Control organizational lead access rules and export gating</p>
              </div>

              <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Lead Visibility Mode</h4>
                    <p className="text-xs text-slate-400">
                      {securitySettings?.leadVisibilityMode === 'common_pool'
                        ? 'Shared Pool Mode: All permitted members see team leads'
                        : 'Isolated Ownership Mode: Agents strictly see their own assigned leads'}
                    </p>
                  </div>
                  <div className="flex border border-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => handleToggleLeadVisibility('common_pool')}
                      className={`px-3 py-1.5 text-xs font-medium ${securitySettings?.leadVisibilityMode === 'common_pool' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400'}`}
                    >
                      Shared Pool
                    </button>
                    <button
                      onClick={() => handleToggleLeadVisibility('assigned')}
                      className={`px-3 py-1.5 text-xs font-medium ${securitySettings?.leadVisibilityMode === 'assigned' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400'}`}
                    >
                      Isolated Mode
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              17. SYSTEM HEALTH
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'health' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Live System Health & Telemetry</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800">
                  <span className="text-xs text-slate-400">MongoDB Database</span>
                  <div className="text-xl font-bold text-emerald-400 mt-1 capitalize">{systemHealth?.database || 'Connected'}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800">
                  <span className="text-xs text-slate-400">API Status</span>
                  <div className="text-xl font-bold text-emerald-400 mt-1 uppercase">{systemHealth?.apiStatus || 'Online'}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800">
                  <span className="text-xs text-slate-400">Memory RSS</span>
                  <div className="text-xl font-bold text-amber-400 mt-1">{systemHealth?.memoryUsageMb || '42.5'} MB</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD LEAD
      ────────────────────────────────────────────────────────────── */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Add New Lead</h3>
              <button onClick={() => setShowAddLeadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400">Full Name *</label>
                <input
                  type="text"
                  required
                  value={leadFormData.name}
                  onChange={(e) => setLeadFormData({ ...leadFormData, name: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={leadFormData.phone}
                  onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Email Address</label>
                <input
                  type="email"
                  value={leadFormData.email}
                  onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD AGENT / MANAGER
      ────────────────────────────────────────────────────────────── */}
      {showAddAgentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Add Team Member</h3>
              <button onClick={() => setShowAddAgentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAgent} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400">Role *</label>
                <select
                  value={agentFormData.role}
                  onChange={(e) => setAgentFormData({ ...agentFormData, role: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="agent">Agent (Execution Rep)</option>
                  <option value="manager">Manager (Team Supervisor)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Full Name *</label>
                <input
                  type="text"
                  required
                  value={agentFormData.name}
                  onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Email Address *</label>
                <input
                  type="email"
                  required
                  value={agentFormData.email}
                  onChange={(e) => setAgentFormData({ ...agentFormData, email: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Password *</label>
                <input
                  type="password"
                  required
                  value={agentFormData.password}
                  onChange={(e) => setAgentFormData({ ...agentFormData, password: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              {agentFormData.role === 'agent' && (
                <div>
                  <label className="text-[11px] font-medium text-slate-400">Assign to Manager</label>
                  <select
                    value={agentFormData.managerId}
                    onChange={(e) => setAgentFormData({ ...agentFormData, managerId: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="">Direct to Admin (No Manager)</option>
                    {hierarchy.managers?.map(m => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAgentModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Create Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SEND BROADCAST
      ────────────────────────────────────────────────────────────── */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Broadcast Announcement</h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400">Target Audience</label>
                <select
                  value={broadcastFormData.targetRole}
                  onChange={(e) => setBroadcastFormData({ ...broadcastFormData, targetRole: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="all">Entire Organization</option>
                  <option value="managers_only">Managers Only</option>
                  <option value="agents_only">Agents Only</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Title *</label>
                <input
                  type="text"
                  required
                  value={broadcastFormData.title}
                  onChange={(e) => setBroadcastFormData({ ...broadcastFormData, title: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Message Content *</label>
                <textarea
                  required
                  rows={4}
                  value={broadcastFormData.message}
                  onChange={(e) => setBroadcastFormData({ ...broadcastFormData, message: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Send Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE LEAD DISTRIBUTION RULE
      ────────────────────────────────────────────────────────────── */}
      {showAddRuleModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GitFork className="w-4 h-4 text-amber-400" />
                <span>Create Lead Distribution Rule</span>
              </h3>
              <button onClick={() => setShowAddRuleModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Facebook Inbound Round-Robin"
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Routing Strategy *</label>
                  <select
                    value={ruleFormData.strategy}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, strategy: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="ROUND_ROBIN">Round Robin (Equitable)</option>
                    <option value="WEIGHTED">Weighted Distribution</option>
                    <option value="MANAGER_ROUTED">Manager Dispatched</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Rule Priority</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={ruleFormData.priority}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, priority: Number(e.target.value) || 1 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Source Condition</label>
                <select
                  value={ruleFormData.conditions?.sourceType || 'ALL'}
                  onChange={(e) => setRuleFormData({
                    ...ruleFormData,
                    conditions: { ...ruleFormData.conditions, sourceType: e.target.value }
                  })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="ALL">All Sources (Global Rule)</option>
                  <option value="SOURCE_A_MANUAL">Source A — Direct / Manual Entry</option>
                  <option value="SOURCE_B_SIGNUP">Source B — Platform User Signup</option>
                  <option value="SOURCE_C_ADS">Source C — Paid Meta/Google Ads & Webhooks</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 mb-1.5 block">
                  Target Assignees (Select agents to include in routing pool):
                </label>
                <div className="max-h-40 overflow-y-auto bg-slate-950/60 border border-slate-800 rounded-lg p-2 space-y-1.5 custom-scrollbar">
                  {allAgents.map((agent) => {
                    const isSelected = ruleFormData.assignees?.some(a => (a.userId === agent._id || a.agentId === agent._id));
                    const currentWeight = ruleFormData.assignees?.find(a => (a.userId === agent._id || a.agentId === agent._id))?.weight || 10;
                    return (
                      <div key={agent._id} className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRuleFormData({
                                  ...ruleFormData,
                                  assignees: [...(ruleFormData.assignees || []), { userId: agent._id, agentId: agent._id, weight: 10 }]
                                });
                              } else {
                                setRuleFormData({
                                  ...ruleFormData,
                                  assignees: (ruleFormData.assignees || []).filter(a => (a.userId || a.agentId) !== agent._id)
                                });
                              }
                            }}
                            className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                          />
                          <span>{agent.name}</span>
                          <span className="text-[10px] text-slate-400">({agent.email})</span>
                        </label>
                        {isSelected && ruleFormData.strategy === 'WEIGHTED' && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Weight:</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={currentWeight}
                              onChange={(e) => {
                                const w = Number(e.target.value) || 1;
                                setRuleFormData({
                                  ...ruleFormData,
                                  assignees: (ruleFormData.assignees || []).map(a =>
                                    (a.userId === agent._id || a.agentId === agent._id) ? { ...a, weight: w, weightPercentage: w } : a
                                  )
                                });
                              }}
                              className="w-14 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-right text-xs text-amber-300"
                            />
                            <span className="text-[10px] text-slate-400">%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {allAgents.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">No agents found in organization</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ruleIsActive"
                  checked={ruleFormData.isActive}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, isActive: e.target.checked })}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="ruleIsActive" className="text-xs text-slate-300 font-medium cursor-pointer">
                  Activate this rule immediately
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: PIPELINE STAGES & SLAS CONFIGURATOR
      ────────────────────────────────────────────────────────────── */}
      {showAddPipelineModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Workflow className="w-4 h-4 text-amber-400" />
                <span>Configure Pipeline Stages & SLAs</span>
              </h3>
              <button onClick={() => setShowAddPipelineModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePipeline} className="space-y-4">
              <div className="space-y-3">
                {pipelineFormData.map((stage, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-[#111827] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-6 h-6 rounded bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Stage Name (e.g. Qualified Call)"
                        value={stage.name}
                        onChange={(e) => {
                          const updated = [...pipelineFormData];
                          updated[idx].name = e.target.value;
                          setPipelineFormData(updated);
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (pipelineFormData.length <= 1) {
                            toast.error('Pipeline must contain at least one stage');
                            return;
                          }
                          setPipelineFormData(pipelineFormData.filter((_, i) => i !== idx));
                        }}
                        className="text-slate-400 hover:text-rose-400 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Win Probability (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={stage.probability}
                          onChange={(e) => {
                            const updated = [...pipelineFormData];
                            updated[idx].probability = Number(e.target.value) || 0;
                            setPipelineFormData(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">SLA Target (Hours)</label>
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={stage.slaHours}
                          onChange={(e) => {
                            const updated = [...pipelineFormData];
                            updated[idx].slaHours = Number(e.target.value) || 24;
                            setPipelineFormData(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Color Code</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={stage.colorCode || '#3b82f6'}
                            onChange={(e) => {
                              const updated = [...pipelineFormData];
                              updated[idx].colorCode = e.target.value;
                              setPipelineFormData(updated);
                            }}
                            className="w-8 h-7 bg-transparent border-0 cursor-pointer rounded"
                          />
                          <span className="text-[11px] font-mono text-slate-400">{stage.colorCode || '#3b82f6'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPipelineFormData([
                    ...pipelineFormData,
                    { name: `New Stage ${pipelineFormData.length + 1}`, probability: 50, colorCode: '#3b82f6', slaHours: 24 }
                  ]);
                }}
                className="w-full py-2 rounded-lg border border-dashed border-slate-700 text-xs font-semibold text-amber-400 hover:bg-slate-800/40 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Stage</span>
              </button>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPipelineModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors shadow-sm"
                >
                  Save Pipeline Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: FORM FIELD BUILDER
      ────────────────────────────────────────────────────────────── */}
      {showAddFormModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Add Inbound Form Field</span>
              </h3>
              <button onClick={() => setShowAddFormModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newFieldInput.label) return;
                const key = newFieldInput.name || newFieldInput.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
                setFormFieldsData([
                  ...formFieldsData,
                  {
                    label: newFieldInput.label,
                    name: key,
                    type: newFieldInput.type || 'text',
                    isRequired: newFieldInput.isRequired || false,
                    placeholder: newFieldInput.placeholder || `Enter ${newFieldInput.label.toLowerCase()}`
                  }
                ]);
                setNewFieldInput({ label: '', name: '', type: 'text', isRequired: false, placeholder: '' });
                setShowAddFormModal(false);
                toast.success('Field added to schema!');
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Field Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Budget or City"
                  value={newFieldInput.label}
                  onChange={(e) => setNewFieldInput({
                    ...newFieldInput,
                    label: e.target.value,
                    name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')
                  })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Field Key (API Identifier)</label>
                <input
                  type="text"
                  required
                  value={newFieldInput.name}
                  onChange={(e) => setNewFieldInput({ ...newFieldInput, name: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Input Type</label>
                  <select
                    value={newFieldInput.type}
                    onChange={(e) => setNewFieldInput({ ...newFieldInput, type: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="text">Single Line Text</option>
                    <option value="phone">Phone Number</option>
                    <option value="email">Email Address</option>
                    <option value="number">Numeric Value</option>
                    <option value="dropdown">Dropdown Select</option>
                    <option value="textarea">Multi-line Text</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Placeholder</label>
                  <input
                    type="text"
                    placeholder="e.g. Enter details..."
                    value={newFieldInput.placeholder}
                    onChange={(e) => setNewFieldInput({ ...newFieldInput, placeholder: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="fieldIsRequired"
                  checked={newFieldInput.isRequired}
                  onChange={(e) => setNewFieldInput({ ...newFieldInput, isRequired: e.target.checked })}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="fieldIsRequired" className="text-xs text-slate-300 font-medium cursor-pointer">
                  Mark as Mandatory / Required Field
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddFormModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Add Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT TEAM MEMBER (ROLE, MANAGER, CAP, AVAILABILITY)
      ────────────────────────────────────────────────────────────── */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>Edit Team Member: {editingUser.name}</span>
              </h3>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Email Address</label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Phone Number</label>
                  <input
                    type="text"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Role *</label>
                  <select
                    value={editingUser.role || 'agent'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="agent">Agent (Execution Rep)</option>
                    <option value="manager">Manager (Supervisor)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Lead Capacity (Cap)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={editingUser.leadCap !== undefined ? editingUser.leadCap : 50}
                    onChange={(e) => setEditingUser({ ...editingUser, leadCap: Number(e.target.value) || 50 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {editingUser.role === 'agent' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Reporting Manager</label>
                  <select
                    value={editingUser.managerId?._id || editingUser.managerId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, managerId: e.target.value || null })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="">Direct to Admin (No Manager)</option>
                    {hierarchy.managers?.filter(m => m._id !== editingUser._id).map(m => (
                      <option key={m._id} value={m._id}>{m.name} ({m.email})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Commission / Incentive %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editingUser.incentive_pct !== undefined ? editingUser.incentive_pct : 10}
                  onChange={(e) => setEditingUser({ ...editingUser, incentive_pct: Number(e.target.value) || 0 })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-medium">Automatic Lead Routing</span>
                  <input
                    type="checkbox"
                    checked={editingUser.isAvailableForRouting !== false && editingUser.isAvailable !== false}
                    onChange={(e) => setEditingUser({
                      ...editingUser,
                      isAvailableForRouting: e.target.checked,
                      isAvailable: e.target.checked
                    })}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-medium">Account Active Status</span>
                  <input
                    type="checkbox"
                    checked={editingUser.isActive !== false}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: REASSIGN ACTIVE LEADS
      ────────────────────────────────────────────────────────────── */}
      {showReassignModal && reassignFromAgent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Reassign Active Leads</span>
              </h3>
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setReassignFromAgent(null);
                  setReassignToAgentId('');
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignLeads} className="space-y-3.5">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 font-medium">Reassigning all open leads from:</span>
                <p className="font-bold text-white text-sm">{reassignFromAgent.name} ({reassignFromAgent.email})</p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Select Target Assignee (New Owner) *</label>
                <select
                  required
                  value={reassignToAgentId}
                  onChange={(e) => setReassignToAgentId(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="">-- Choose New Representative / Manager --</option>
                  {allTeamMembers.filter(m => m._id !== reassignFromAgent._id).map(m => (
                    <option key={m._id} value={m._id}>{m.name} ({m.role.toUpperCase()} - {m.email})</option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                ⚠️ All unconverted and active open leads belonging to {reassignFromAgent.name} will be transferred immediately. This action is permanently logged in the Universal Audit Log.
              </p>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReassignModal(false);
                    setReassignFromAgent(null);
                    setReassignToAgentId('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reassignToAgentId}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50 transition-colors shadow-sm"
                >
                  Confirm & Reassign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE COMMISSION RULE
      ────────────────────────────────────────────────────────────── */}
      {showAddCommissionModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>Create Commission Policy</span>
              </h3>
              <button onClick={() => setShowAddCommissionModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCommissionRule} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Won Deal 5% Policy"
                  value={commFormData.ruleName}
                  onChange={(e) => setCommFormData({ ...commFormData, ruleName: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Target Role *</label>
                  <select
                    value={commFormData.targetRole}
                    onChange={(e) => setCommFormData({ ...commFormData, targetRole: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="AGENT">Agent (Sales Rep)</option>
                    <option value="MANAGER">Manager (Override)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Commission Type</label>
                  <select
                    value={commFormData.commissionType}
                    onChange={(e) => setCommFormData({ ...commFormData, commissionType: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="PERCENTAGE">Percentage of Deal Value (%)</option>
                    <option value="FLAT">Flat Rate (₹)</option>
                    <option value="STAGE_BASED">Stage-Based Bonus</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">
                  {commFormData.commissionType === 'PERCENTAGE' ? 'Percentage Rate (%) *' : 'Fixed Amount (₹) *'}
                </label>
                <input
                  type="number"
                  min="0"
                  max={commFormData.commissionType === 'PERCENTAGE' ? 100 : 1000000}
                  required
                  value={commFormData.value}
                  onChange={(e) => setCommFormData({ ...commFormData, value: Number(e.target.value) || 0 })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Trigger Pipeline Stage</label>
                <select
                  value={commFormData.stageThreshold}
                  onChange={(e) => setCommFormData({ ...commFormData, stageThreshold: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="payment_done">Payment Done (Deal Won)</option>
                  <option value="converted">Converted Stage</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCommissionModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE COUPON (WITH 6 PLANS SELECTION)
      ────────────────────────────────────────────────────────────── */}
      {showAddCouponModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-amber-400" />
                <span>Create SaaS Promotional Coupon</span>
              </h3>
              <button onClick={() => setShowAddCouponModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Coupon Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SAAS50"
                    value={couponFormData.code}
                    onChange={(e) => setCouponFormData({ ...couponFormData, code: e.target.value.toUpperCase() })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Discount Type</label>
                  <select
                    value={couponFormData.discountType}
                    onChange={(e) => setCouponFormData({ ...couponFormData, discountType: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="PERCENTAGE">Percentage (%) Off</option>
                    <option value="FLAT">Flat (₹) Off</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Discount Value *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={couponFormData.discountValue}
                  onChange={(e) => setCouponFormData({ ...couponFormData, discountValue: Number(e.target.value) || 0 })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">Applicable Subscription Plans</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
                  {['ALL', 'smart_solo', 'power_solo', 'team_starter', 'business', 'enterprise', 'custom_enterprise'].map((p) => {
                    const isChecked = couponFormData.applicablePlans.includes(p);
                    return (
                      <label key={p} className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (p === 'ALL') {
                              setCouponFormData({ ...couponFormData, applicablePlans: e.target.checked ? ['ALL'] : ['smart_solo'] });
                            } else {
                              let current = couponFormData.applicablePlans.filter(item => item !== 'ALL');
                              if (e.target.checked) current.push(p);
                              else current = current.filter(item => item !== p);
                              if (current.length === 0) current = ['ALL'];
                              setCouponFormData({ ...couponFormData, applicablePlans: current });
                            }
                          }}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                        />
                        <span className="font-mono text-[11px]">{p}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Max Overall Uses</label>
                  <input
                    type="number"
                    min="1"
                    value={couponFormData.maxOverallUses}
                    onChange={(e) => setCouponFormData({ ...couponFormData, maxOverallUses: Number(e.target.value) || 100 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Expiry Date (validUntil)</label>
                  <input
                    type="date"
                    value={couponFormData.validUntil}
                    onChange={(e) => setCouponFormData({ ...couponFormData, validUntil: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCouponModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SEND BROADCAST
      ────────────────────────────────────────────────────────────── */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Send Platform & Internal Broadcast</span>
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Broadcast Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Maintenance or Sales Contest"
                  value={broadcastFormData.title}
                  onChange={(e) => setBroadcastFormData({ ...broadcastFormData, title: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Target Audience Scope *</label>
                  <select
                    value={broadcastFormData.targetAudience}
                    onChange={(e) => setBroadcastFormData({ ...broadcastFormData, targetAudience: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="INTERNAL_ALL">Internal Staff (All)</option>
                    <option value="INTERNAL_MANAGERS">Managers Only</option>
                    <option value="INTERNAL_AGENTS">Agents Only</option>
                    <option value="PLATFORM_ALL_ORGS">All Platform Organizations</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Priority Level</label>
                  <select
                    value={broadcastFormData.priority}
                    onChange={(e) => setBroadcastFormData({ ...broadcastFormData, priority: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent (Flash Alert)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Message Content *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type your announcement or alert..."
                  value={broadcastFormData.message}
                  onChange={(e) => setBroadcastFormData({ ...broadcastFormData, message: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Dispatch Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: REGISTER AD CAMPAIGN
      ────────────────────────────────────────────────────────────── */}
      {showAddCampaignModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span>Register Advertising Campaign</span>
              </h3>
              <button onClick={() => setShowAddCampaignModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Campaign Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meta Q3 Scale Campaign"
                  value={campaignFormData.campaignName}
                  onChange={(e) => setCampaignFormData({ ...campaignFormData, campaignName: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Platform *</label>
                  <select
                    value={campaignFormData.platform}
                    onChange={(e) => setCampaignFormData({ ...campaignFormData, platform: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="META">Meta Ads (Facebook & IG)</option>
                    <option value="GOOGLE">Google Ads</option>
                    <option value="OTHER">Other Network</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Status</label>
                  <select
                    value={campaignFormData.status}
                    onChange={(e) => setCampaignFormData({ ...campaignFormData, status: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PAUSED">Paused</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Total Budget (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={campaignFormData.budget}
                    onChange={(e) => setCampaignFormData({ ...campaignFormData, budget: Number(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Amount Spent (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={campaignFormData.amountSpent}
                    onChange={(e) => setCampaignFormData({ ...campaignFormData, amountSpent: Number(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCampaignModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Register Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE MESSAGE TEMPLATE
      ────────────────────────────────────────────────────────────── */}
      {showAddTemplateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>Create Message Template</span>
              </h3>
              <button onClick={() => setShowAddTemplateModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Template Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Initial Welcome Script"
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Channel *</label>
                  <select
                    value={templateFormData.channel}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, channel: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. FOLLOWUP"
                    value={templateFormData.category}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, category: e.target.value.toUpperCase() })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Message Content (use {"{{name}}"}, {"{{deal_value}}"}) *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Hi {{name}}, thank you for your interest in our solution..."
                  value={templateFormData.content}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, content: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none font-sans"
                />
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTemplateModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD CATALOGUE OFFERING
      ────────────────────────────────────────────────────────────── */}
      {showAddCatalogueModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Add Product or Service Offering</span>
              </h3>
              <button onClick={() => setShowAddCatalogueModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCatalogueItem} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Agency License"
                  value={catalogueFormData.itemName}
                  onChange={(e) => setCatalogueFormData({ ...catalogueFormData, itemName: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Base Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={catalogueFormData.price}
                    onChange={(e) => setCatalogueFormData({ ...catalogueFormData, price: Number(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Discounted Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={catalogueFormData.discountedPrice}
                    onChange={(e) => setCatalogueFormData({ ...catalogueFormData, discountedPrice: Number(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Description</label>
                <textarea
                  rows={3}
                  placeholder="Features, deliverables, or specifications..."
                  value={catalogueFormData.description}
                  onChange={(e) => setCatalogueFormData({ ...catalogueFormData, description: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatalogueModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Add to Catalogue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CONFIGURE ENCRYPTED INTEGRATION CREDENTIALS
      ────────────────────────────────────────────────────────────── */}
      {showConfigureIntegrationModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Configure {integrationFormData.provider} Credentials</span>
              </h3>
              <button onClick={() => setShowConfigureIntegrationModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIntegrationCredentials} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Provider</label>
                <input
                  type="text"
                  readOnly
                  value={integrationFormData.provider}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-amber-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Secret Token / API Key / Access Token *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Paste access token or API secret here (encrypted with AES-256-GCM before saving)..."
                  value={integrationFormData.credentials}
                  onChange={(e) => setIntegrationFormData({ ...integrationFormData, credentials: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
                />
              </div>

              {integrationFormData.webhookUrl && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">Webhook Target URL</label>
                  <input
                    type="text"
                    value={integrationFormData.webhookUrl}
                    onChange={(e) => setIntegrationFormData({ ...integrationFormData, webhookUrl: e.target.value })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
                  />
                </div>
              )}

              <p className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800">
                🔒 Plaintext secrets are never stored in the database. All payloads are secured via AES-256-GCM authenticated encryption.
              </p>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigureIntegrationModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors shadow-sm"
                >
                  Encrypt & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: LEAD DETAILS DRAWER / MODAL
      ────────────────────────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Lead Details</span>
              </h3>
              <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                <h4 className="text-sm font-bold text-white">{selectedLead.name}</h4>
                <p className="text-slate-400">{selectedLead.phone} • {selectedLead.email || 'No email provided'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Primary Source</span>
                  <span className="font-semibold text-amber-400">{selectedLead.primarySource || selectedLead.source || 'Manual'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Assigned Rep</span>
                  <span className="font-semibold text-white">{selectedLead.assignedTo?.name || 'Unassigned'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Current Stage</span>
                  <span className="font-semibold text-emerald-400 capitalize">{(selectedLead.status || 'new_lead').replace('_', ' ')}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Deal Amount</span>
                  <span className="font-semibold text-purple-400">₹{selectedLead.deal_value || selectedLead.paid_amount || 0}</span>
                </div>
              </div>

              {selectedLead.notes && (
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block uppercase mb-1">Notes / Remarks</span>
                  <p className="text-slate-300 text-xs">{selectedLead.notes}</p>
                </div>
              )}

              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Quick Stage Move</label>
                <select
                  value={selectedLead.status || 'new_lead'}
                  onChange={(e) => {
                    handleStageChange(selectedLead._id, e.target.value);
                    setSelectedLead({ ...selectedLead, status: e.target.value });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  {KANBAN_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
