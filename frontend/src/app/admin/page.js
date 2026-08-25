'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { getUser } from '@/lib/auth';

// UI Design System Primitives
import AdminLayout from '@/components/admin/ui/AdminLayout';
import Modal from '@/components/admin/ui/Modal';
import PermissionGate from '@/components/admin/ui/PermissionGate';

// 17 Modular Operational Centres
import OverviewModule from '@/components/admin/modules/OverviewModule';
import LeadsModule from '@/components/admin/modules/LeadsModule';
import DistributionModule from '@/components/admin/modules/DistributionModule';
import PipelinesModule from '@/components/admin/modules/PipelinesModule';
import HierarchyModule from '@/components/admin/modules/HierarchyModule';
import BroadcastsModule from '@/components/admin/modules/BroadcastsModule';
import FormsModule from '@/components/admin/modules/FormsModule';
import TemplatesModule from '@/components/admin/modules/TemplatesModule';
import CampaignsModule from '@/components/admin/modules/CampaignsModule';
import CatalogueModule from '@/components/admin/modules/CatalogueModule';
import CommissionsModule from '@/components/admin/modules/CommissionsModule';
import CouponsModule from '@/components/admin/modules/CouponsModule';
import AnalyticsModule from '@/components/admin/modules/AnalyticsModule';
import ActivityLogsModule from '@/components/admin/modules/ActivityLogsModule';
import IntegrationsModule from '@/components/admin/modules/IntegrationsModule';
import SecurityModule from '@/components/admin/modules/SecurityModule';
import HealthModule from '@/components/admin/modules/HealthModule';
import PlansModule from '@/components/admin/modules/PlansModule';
import ProfileModule from '@/components/admin/modules/ProfileModule';

// New Specialized Workflow Modals
import CancelFollowUpModal from '@/components/admin/ui/CancelFollowUpModal';
import CloseDealModal from '@/components/admin/ui/CloseDealModal';
import AssignPlanModal from '@/components/admin/ui/AssignPlanModal';
import LeadProfileModal from '@/components/admin/ui/LeadProfileModal';
import SendBroadcastModal from '@/components/admin/ui/SendBroadcastModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function AdminControlCenterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auth & State
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(true);

  // Tab Data States
  const [metrics, setMetrics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsPagination, setLeadsPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [distributionRules, setDistributionRules] = useState([]);
  const [hierarchy, setHierarchy] = useState({ managers: [], unassignedAgents: [] });
  const [performanceList, setPerformanceList] = useState([]);
  const [pipelineStages, setPipelineStages] = useState([]);
  const [allPlans, setAllPlans] = useState([]);
  const [planHierarchy, setPlanHierarchy] = useState([]);
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
  const [broadcastsList, setBroadcastsList] = useState([]);

  // Error States per tab
  const [tabErrors, setTabErrors] = useState({});

  // Filter States for Leads & Activity
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('all');
  const [leadStageFilter, setLeadStageFilter] = useState('all');
  const [leadsPage, setLeadsPage] = useState(1);
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');

  // Action Modals State
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showAddCouponModal, setShowAddCouponModal] = useState(false);
  const [showAddCommissionModal, setShowAddCommissionModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showAddCampaignModal, setShowAddCampaignModal] = useState(false);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [showAddCatalogueModal, setShowAddCatalogueModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignFromAgent, setReassignFromAgent] = useState(null);
  const [reassignToAgentId, setReassignToAgentId] = useState('');

  // Specialized CRM Workflow Modals State
  const [selectedLeadProfile, setSelectedLeadProfile] = useState(null);
  const [cancelFollowUpLead, setCancelFollowUpLead] = useState(null);
  const [closeDealLead, setCloseDealLead] = useState(null);
  const [assignPlanLead, setAssignPlanLead] = useState(null);
  const [assignPlanIsFree, setAssignPlanIsFree] = useState(false);

  // Forms Data
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
  const [commFormData, setCommFormData] = useState({
    ruleName: '', targetRole: 'AGENT', commissionType: 'PERCENTAGE', value: 10, stageThreshold: 'payment_done'
  });
  const [couponFormData, setCouponFormData] = useState({
    code: '', description: '', discountType: 'PERCENTAGE', discountValue: 20, applicablePlans: ['ALL'], validUntil: '', maxOverallUses: 100
  });
  const [broadcastFormData, setBroadcastFormData] = useState({
    title: '', message: '', priority: 'NORMAL', targetAudience: 'INTERNAL_ALL', deliveryChannels: ['IN_APP']
  });
  const [campaignFormData, setCampaignFormData] = useState({
    campaignName: '', platform: 'META', campaignId: '', budget: 50000, amountSpent: 12000, status: 'ACTIVE'
  });
  const [templateFormData, setTemplateFormData] = useState({
    name: '', channel: 'WHATSAPP', content: '', category: 'GENERAL', variables: ['name', 'company']
  });
  const [catalogueFormData, setCatalogueFormData] = useState({
    itemName: '', description: '', price: 999, discountedPrice: 499, category: 'GENERAL'
  });

  // Flat Team Members list for assignment dropdowns
  const allTeamMembers = useMemo(() => {
    const list = [...(hierarchy.managers || [])];
    hierarchy.managers?.forEach((m) => {
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
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!storedToken || !user) {
      router.replace('/login');
      return;
    }
    const isProfileTab = searchParams?.get('tab') === 'profile';
    const hasAdminAccess = user.role === 'superadmin' || user.role === 'admin' || user.companyRole === 'owner' || user.workStatus === 'company_owner';
    if (!hasAdminAccess && !isProfileTab) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }
    setCurrentUser(user);
    setToken(storedToken);
    setLoading(false);

    // Sync tab from URL query if present
    const urlTab = searchParams.get('tab');
    if (urlTab) {
      setActiveTab(urlTab);
    }
    const urlStage = searchParams.get('stage');
    if (urlStage) {
      setLeadStageFilter(urlStage);
    }
    const urlSource = searchParams.get('source') || searchParams.get('primarySource');
    if (urlSource) {
      setLeadSourceFilter(urlSource);
    }
  }, [router, searchParams]);

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
      console.warn(`[API] Warning for ${endpoint}:`, err.message);
      return { success: false, error: err.message };
    }
  }, [token, router]);

  // Unified Data Fetcher for Active Tab
  const fetchTabData = useCallback(async (tabToLoad = activeTab) => {
    if (!token && typeof window !== 'undefined' && !localStorage.getItem('token')) return;
    setRefreshing(true);
    setTabErrors((prev) => ({ ...prev, [tabToLoad]: null }));

    try {
      if (tabToLoad === 'overview') {
        const data = await authFetch('/admin/overview');
        if (data?.success) {
          setMetrics(data.data);
        } else {
          setTabErrors((prev) => ({ ...prev, overview: data?.message || 'Failed to load metrics' }));
        }
      } else if (tabToLoad === 'leads') {
        const params = new URLSearchParams();
        if (leadSearch) params.set('search', leadSearch);
        if (leadSourceFilter !== 'all') params.set('primarySource', leadSourceFilter);
        if (leadStageFilter !== 'all') params.set('stage', leadStageFilter);
        params.set('page', String(leadsPage));
        params.set('limit', '50');

        const data = await authFetch(`/admin/leads?${params.toString()}`);
        if (data?.success) {
          setLeads(data.leads || []);
          setLeadsPagination(data.pagination || { page: leadsPage, total: data.leads?.length || 0, pages: 1 });
        } else {
          setTabErrors((prev) => ({ ...prev, leads: data?.message || 'Failed to fetch leads' }));
        }
      } else if (tabToLoad === 'distribution') {
        const [rulesData, hierData] = await Promise.all([
          authFetch('/admin/distribution-rules'),
          authFetch('/admin/agents')
        ]);
        if (rulesData?.success) setDistributionRules(rulesData.rules || []);
        if (hierData?.success) setHierarchy(hierData.hierarchy || { managers: [], unassignedAgents: [] });
      } else if (tabToLoad === 'pipelines') {
        const [pipeData, leadsData] = await Promise.all([
          authFetch('/admin/pipelines/config'),
          authFetch('/admin/leads?limit=200')
        ]);
        if (pipeData?.success) setPipelineStages(pipeData.pipeline?.stages || []);
        if (leadsData?.success) setLeads(leadsData.leads || []);
      } else if (tabToLoad === 'plans') {
        const data = await authFetch('/admin/plans/hierarchy');
        if (data?.success) {
          setPlanHierarchy(data.hierarchy || []);
          setAllPlans(data.allPlans || []);
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
        if (data?.success) setFormSchemas(data.fields || []);
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
      setTabErrors((prev) => ({ ...prev, [tabToLoad]: err.message }));
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, token, authFetch, leadSearch, leadSourceFilter, leadStageFilter, leadsPage, logSearch, logActionFilter]);

  // Initial load of auxiliary datasets (plans and hierarchy) for dropdowns
  useEffect(() => {
    if (token) {
      authFetch('/admin/plans').then((res) => {
        if (res?.success) setAllPlans(res.plans || []);
      });
      authFetch('/admin/agents').then((res) => {
        if (res?.success) setHierarchy(res.hierarchy || { managers: [], unassignedAgents: [] });
      });
    }
  }, [token, authFetch]);

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
        setLeads((prev) => prev.map((l) => (l._id === leadId ? { ...l, status: newStage } : l)));
        // Background refresh metrics
        authFetch('/admin/overview').then((res) => res?.success && setMetrics(res.data));
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
        toast.success('Distribution Rule saved!');
        setShowAddRuleModal(false);
        setRuleFormData({ name: '', strategy: 'ROUND_ROBIN', priority: 1, isActive: true, assignees: [], conditions: { sourceType: 'ALL' } });
        fetchTabData('distribution');
      } else {
        toast.error(data.message || 'Rule save failed');
      }
    } catch (e) {
      toast.error('Error saving rule');
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
        setDistributionRules((prev) => prev.filter((r) => r._id !== ruleId));
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (e) {
      toast.error('Error deleting rule');
    }
  };


  // Save Form Schema Configuration Handler
  const handleSaveFormSchema = async (fields) => {
    try {
      const res = await fetch(`${API_BASE}/admin/form-schemas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields, title: 'Lead Capture Form' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Form schema saved!');
        fetchTabData('forms');
      } else {
        toast.error(data.message || 'Save failed');
      }
    } catch (e) {
      toast.error('Error saving form schema');
    }
  };

  // Save Security Settings Handler
  const handleSaveSecurity = async (settings) => {
    try {
      const res = await fetch(`${API_BASE}/admin/security-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Security policies updated!');
        fetchTabData('security');
      } else {
        toast.error(data.message || 'Security update failed');
      }
    } catch (e) {
      toast.error('Error saving security policies');
    }
  };

  // Save Integration Credentials Handler
  const handleSaveIntegration = async (provider, credentials) => {
    try {
      const res = await fetch(`${API_BASE}/admin/integrations-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, credentials, status: 'CONNECTED' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${provider} integration credentials saved!`);
        fetchTabData('integrations');
      } else {
        toast.error(data.message || 'Failed saving credentials');
      }
    } catch (e) {
      toast.error('Error saving integration');
    }
  };

  // Test Webhook Handler
  const handleTestWebhook = async (provider) => {
    toast.success(`Dispatched simulated test payload for ${provider}`);
  };

  // Create Broadcast Handler
  const handleCreateBroadcast = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(broadcastFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Broadcast dispatched to team!');
        setShowBroadcastModal(false);
        setBroadcastFormData({ title: '', message: '', priority: 'NORMAL', targetAudience: 'INTERNAL_ALL', deliveryChannels: ['IN_APP'] });
        fetchTabData('broadcasts');
      } else {
        toast.error(data.message || 'Broadcast failed');
      }
    } catch (e) {
      toast.error('Error dispatching broadcast');
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
        toast.success('Coupon created successfully!');
        setShowAddCouponModal(false);
        setCouponFormData({ code: '', description: '', discountType: 'PERCENTAGE', discountValue: 20, applicablePlans: ['ALL'], validUntil: '', maxOverallUses: 100 });
        fetchTabData('coupons');
      } else {
        toast.error(data.message || 'Coupon creation failed');
      }
    } catch (e) {
      toast.error('Error creating coupon');
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
        setCommFormData({ ruleName: '', targetRole: 'AGENT', commissionType: 'PERCENTAGE', value: 10, stageThreshold: 'payment_done' });
        fetchTabData('commissions');
      } else {
        toast.error(data.message || 'Commission rule save failed');
      }
    } catch (e) {
      toast.error('Error creating rule');
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
        toast.success('Campaign tracker saved!');
        setShowAddCampaignModal(false);
        setCampaignFormData({ campaignName: '', platform: 'META', campaignId: '', budget: 50000, amountSpent: 12000, status: 'ACTIVE' });
        fetchTabData('campaigns');
      } else {
        toast.error(data.message || 'Campaign save failed');
      }
    } catch (e) {
      toast.error('Error saving campaign');
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
        toast.success('Template saved successfully!');
        setShowAddTemplateModal(false);
        setTemplateFormData({ name: '', channel: 'WHATSAPP', content: '', category: 'GENERAL', variables: ['name', 'company'] });
        fetchTabData('templates');
      } else {
        toast.error(data.message || 'Template creation failed');
      }
    } catch (e) {
      toast.error('Error saving template');
    }
  };

  // Create Catalogue Handler
  const handleCreateCatalogue = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/catalogues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(catalogueFormData)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Catalogue item added!');
        setShowAddCatalogueModal(false);
        setCatalogueFormData({ itemName: '', description: '', price: 999, discountedPrice: 499, category: 'GENERAL' });
        fetchTabData('catalogue');
      } else {
        toast.error(data.message || 'Catalogue item creation failed');
      }
    } catch (e) {
      toast.error('Error adding catalogue item');
    }
  };

  // Follow-up Cancellation Handler
  const handleCancelFollowUp = async (leadId, reason) => {
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${leadId}/follow-up/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Follow-up cancelled & audit recorded');
        setCancelFollowUpLead(null);
        fetchTabData('leads');
        if (selectedLeadProfile && selectedLeadProfile._id === leadId) {
          setSelectedLeadProfile(data.lead);
        }
      } else {
        toast.error(data.message || 'Failed to cancel follow-up');
      }
    } catch (e) {
      toast.error('Network error cancelling follow-up');
    }
  };

  // Close Deal & Commission Ledger Handler
  const handleCloseDeal = async ({ leadId, planId, closingAmount, closingType, closingReason }) => {
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${leadId}/close-deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId, closingAmount, closingType, closingReason })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('🎉 Deal closed! Commission ledger & payment recorded.');
        setCloseDealLead(null);
        fetchTabData('leads');
        authFetch('/admin/overview').then((res) => res?.success && setMetrics(res.data));
        if (selectedLeadProfile && selectedLeadProfile._id === leadId) {
          setSelectedLeadProfile(data.lead);
        }
      } else {
        toast.error(data.message || 'Deal closure failed');
      }
    } catch (e) {
      toast.error('Network error closing deal');
    }
  };

  // Plan Assignment Handler
  const handleAssignPlan = async ({ leadId, planId, isFree, reason }) => {
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${leadId}/assign-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId, isFree, reason })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isFree ? 'Complimentary plan granted and audited' : 'Plan assigned successfully');
        setAssignPlanLead(null);
        fetchTabData('leads');
        if (selectedLeadProfile && selectedLeadProfile._id === leadId) {
          setSelectedLeadProfile(data.lead);
        }
      } else {
        toast.error(data.message || 'Plan assignment failed');
      }
    } catch (e) {
      toast.error('Network error assigning plan');
    }
  };

  // Plan Management Handlers
  const handleCreatePlan = async (planData) => {
    const res = await fetch(`${API_BASE}/admin/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(planData)
    });
    const data = await res.json();
    if (data.success) {
      fetchTabData('plans');
      authFetch('/admin/plans').then((r) => r?.success && setAllPlans(r.plans || []));
    } else {
      throw new Error(data.message || 'Failed creating plan');
    }
  };

  const handleUpdatePlan = async (id, planData) => {
    const res = await fetch(`${API_BASE}/admin/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(planData)
    });
    const data = await res.json();
    if (data.success) {
      fetchTabData('plans');
      authFetch('/admin/plans').then((r) => r?.success && setAllPlans(r.plans || []));
    } else {
      throw new Error(data.message || 'Failed updating plan');
    }
  };

  const handleDeletePlan = async (id) => {
    const res = await fetch(`${API_BASE}/admin/plans/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      toast.success('Plan deactivated');
      fetchTabData('plans');
      authFetch('/admin/plans').then((r) => r?.success && setAllPlans(r.plans || []));
    }
  };

  // Pipeline Config Handler
  const handleSavePipeline = async (stages) => {
    const res = await fetch(`${API_BASE}/admin/pipelines/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stages })
    });
    const data = await res.json();
    if (data.success) {
      setPipelineStages(data.pipeline?.stages || stages);
    } else {
      throw new Error(data.message || 'Failed saving pipeline settings');
    }
  };

  // Add Note to Lead Handler
  const handleAddLeadNote = async (leadId, noteText) => {
    const res = await fetch(`${API_BASE}/admin/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: noteText })
    });
    const data = await res.json();
    if (data.success) {
      toast.success('Note added');
      fetchTabData('leads');
      if (selectedLeadProfile && selectedLeadProfile._id === leadId) {
        setSelectedLeadProfile((prev) => ({
          ...prev,
          notes: [...(prev.notes || []), { text: noteText, createdAt: new Date(), authorName: currentUser?.name || 'Admin' }]
        }));
      }
    }
  };

  const handleSendBroadcast = async (broadcastPayload) => {
    const res = await authFetch('/admin/broadcasts', {
      method: 'POST',
      body: JSON.stringify(broadcastPayload),
    });
    if (res?.success) {
      toast.success(res.message || 'Broadcast dispatched successfully');
      fetchTabData('broadcasts');
    } else {
      throw new Error(res?.message || 'Failed to dispatch broadcast');
    }
  };

  // Drilldown navigations from Overview
  const handleNavigateToLeads = (filter = {}) => {
    setActiveTab('leads');
    if (filter.stage) setLeadStageFilter(filter.stage);
    if (filter.primarySource) setLeadSourceFilter(filter.primarySource);
  };

  const handleNavigateToHierarchy = () => {
    setActiveTab('hierarchy');
  };

  if (!isAuthorized) {
    return <PermissionGate />;
  }

  return (
    <AdminLayout
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setActiveTab(tab);
        // Clean URL state
        router.replace(`/admin?tab=${tab}`, { scroll: false });
      }}
      onRefresh={() => fetchTabData(activeTab)}
      refreshing={refreshing}
      currentUser={currentUser}
      onAddLead={() => setShowAddLeadModal(true)}
      onBroadcast={() => setShowBroadcastModal(true)}
    >
      {/* ─────────────────────────────────────────────────────────────
          ACTIVE MODULE WORKSPACE
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewModule
          metrics={metrics}
          loading={refreshing && !metrics}
          error={tabErrors.overview}
          onRetry={() => fetchTabData('overview')}
          onNavigateToLeads={handleNavigateToLeads}
          onNavigateToHierarchy={handleNavigateToHierarchy}
        />
      )}

      {activeTab === 'leads' && (
        <LeadsModule
          leads={leads}
          pagination={leadsPagination}
          loading={refreshing && leads.length === 0}
          error={tabErrors.leads}
          onRetry={() => fetchTabData('leads')}
          search={leadSearch}
          onSearchChange={setLeadSearch}
          sourceFilter={leadSourceFilter}
          onSourceFilterChange={setLeadSourceFilter}
          stageFilter={leadStageFilter}
          onStageFilterChange={setLeadStageFilter}
          page={leadsPage}
          onPageChange={setLeadsPage}
          onStageChange={handleStageChange}
          onAddLead={() => setShowAddLeadModal(true)}
          onLeadClick={(lead) => setSelectedLeadProfile(lead)}
          onCancelFollowUp={(lead) => setCancelFollowUpLead(lead)}
          onCloseDeal={(lead) => setCloseDealLead(lead)}
        />
      )}

      {activeTab === 'distribution' && (
        <DistributionModule
          rules={distributionRules}
          loading={refreshing && distributionRules.length === 0}
          error={tabErrors.distribution}
          onRetry={() => fetchTabData('distribution')}
          onAddRule={() => setShowAddRuleModal(true)}
          onDeleteRule={handleDeleteRule}
          onReassignLeads={() => setShowReassignModal(true)}
        />
      )}

      {activeTab === 'pipelines' && (
        <PipelinesModule
          leads={leads}
          pipelineStages={pipelineStages}
          loading={refreshing && (pipelineStages.length === 0 && leads.length === 0)}
          error={tabErrors.pipelines}
          onRetry={() => fetchTabData('pipelines')}
          onSavePipeline={handleSavePipeline}
          onLeadClick={(lead) => setSelectedLeadProfile(lead)}
          onStageChange={handleStageChange}
          onCloseDeal={(lead) => setCloseDealLead(lead)}
        />
      )}

      {activeTab === 'hierarchy' && (
        <HierarchyModule
          hierarchy={hierarchy}
          performance={performanceList}
          loading={refreshing && (hierarchy.managers?.length === 0 && hierarchy.unassignedAgents?.length === 0)}
          error={tabErrors.hierarchy}
          onRetry={() => fetchTabData('hierarchy')}
          onAddMember={() => setShowAddAgentModal(true)}
          onEditUser={(user) => {
            setEditingUser(user);
            setShowEditUserModal(true);
          }}
          onReassignLeads={() => setShowReassignModal(true)}
        />
      )}

      {activeTab === 'broadcasts' && (
        <BroadcastsModule
          broadcasts={broadcastsList}
          loading={refreshing && broadcastsList.length === 0}
          error={tabErrors.broadcasts}
          onRetry={() => fetchTabData('broadcasts')}
          onNewBroadcast={() => setShowBroadcastModal(true)}
        />
      )}

      {activeTab === 'forms' && (
        <FormsModule
          formFields={formSchemas}
          loading={refreshing && formSchemas.length === 0}
          error={tabErrors.forms}
          onRetry={() => fetchTabData('forms')}
          onSaveSchema={handleSaveFormSchema}
        />
      )}

      {activeTab === 'templates' && (
        <TemplatesModule
          templates={templates}
          loading={refreshing && templates.length === 0}
          error={tabErrors.templates}
          onRetry={() => fetchTabData('templates')}
          onAddTemplate={() => setShowAddTemplateModal(true)}
          onDeleteTemplate={async (id) => {
            await fetch(`${API_BASE}/admin/templates/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            fetchTabData('templates');
          }}
        />
      )}

      {activeTab === 'campaigns' && (
        <CampaignsModule
          campaigns={campaigns}
          loading={refreshing && campaigns.length === 0}
          error={tabErrors.campaigns}
          isIntegrationConnected={integrationsStatus?.meta?.status === 'CONNECTED'}
          onRetry={() => fetchTabData('campaigns')}
          onAddCampaign={() => setShowAddCampaignModal(true)}
          onNavigateToIntegrations={() => setActiveTab('integrations')}
          onDeleteCampaign={async (id) => {
            await fetch(`${API_BASE}/admin/campaigns/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            fetchTabData('campaigns');
          }}
        />
      )}

      {activeTab === 'plans' && (
        <PlansModule
          plans={allPlans}
          hierarchy={planHierarchy}
          loading={refreshing && allPlans.length === 0}
          error={tabErrors.plans}
          onRetry={() => fetchTabData('plans')}
          onCreatePlan={handleCreatePlan}
          onUpdatePlan={handleUpdatePlan}
          onDeletePlan={handleDeletePlan}
        />
      )}

      {activeTab === 'catalogue' && (
        <CatalogueModule
          catalogues={catalogues}
          loading={refreshing && catalogues.length === 0}
          error={tabErrors.catalogue}
          onRetry={() => fetchTabData('catalogue')}
          onAddCatalogue={() => setShowAddCatalogueModal(true)}
          onDeleteCatalogue={async (id) => {
            await fetch(`${API_BASE}/admin/catalogues/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            fetchTabData('catalogue');
          }}
        />
      )}

      {activeTab === 'commissions' && (
        <CommissionsModule
          rules={commissionRules}
          payouts={commissionPayouts}
          loading={refreshing && commissionRules.length === 0}
          error={tabErrors.commissions}
          onRetry={() => fetchTabData('commissions')}
          onAddRule={() => setShowAddCommissionModal(true)}
          onDeleteRule={async (id) => {
            await fetch(`${API_BASE}/admin/commission-rules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            fetchTabData('commissions');
          }}
        />
      )}

      {activeTab === 'coupons' && (
        <CouponsModule
          coupons={coupons}
          loading={refreshing && coupons.length === 0}
          error={tabErrors.coupons}
          onRetry={() => fetchTabData('coupons')}
          onAddCoupon={() => setShowAddCouponModal(true)}
          onDeleteCoupon={async (id) => {
            await fetch(`${API_BASE}/admin/coupons/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            fetchTabData('coupons');
          }}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsModule
          analytics={universalAnalytics}
          loading={refreshing && !universalAnalytics}
          error={tabErrors.analytics}
          onRetry={() => fetchTabData('analytics')}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityLogsModule
          logs={activityLogs}
          loading={refreshing && activityLogs.length === 0}
          error={tabErrors.activity}
          onRetry={() => fetchTabData('activity')}
          search={logSearch}
          onSearchChange={setLogSearch}
          actionFilter={logActionFilter}
          onActionFilterChange={setLogActionFilter}
        />
      )}

      {activeTab === 'integrations' && (
        <IntegrationsModule
          integrationStatus={integrationsStatus}
          loading={refreshing && !integrationsStatus}
          error={tabErrors.integrations}
          onRetry={() => fetchTabData('integrations')}
          onSaveCredentials={handleSaveIntegration}
          onTestWebhook={handleTestWebhook}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileModule
          currentUser={currentUser}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            if (typeof window !== 'undefined') {
              try {
                const stored = localStorage.getItem('user');
                if (stored) {
                  const parsed = JSON.parse(stored);
                  localStorage.setItem('user', JSON.stringify({ ...parsed, ...updatedUser }));
                }
              } catch (e) {}
            }
          }}
        />
      )}

      {activeTab === 'security' && (
        <SecurityModule
          securitySettings={securitySettings}
          loading={refreshing && !securitySettings}
          error={tabErrors.security}
          onRetry={() => fetchTabData('security')}
          onSaveSecurity={handleSaveSecurity}
        />
      )}

      {activeTab === 'health' && (
        <HealthModule
          health={systemHealth}
          loading={refreshing && !systemHealth}
          error={tabErrors.health}
          onRetry={() => fetchTabData('health')}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          SHARED ACTION MODALS
      ────────────────────────────────────────────────────────────── */}
      {/* 1. Add Lead Modal */}
      <Modal isOpen={showAddLeadModal} onClose={() => setShowAddLeadModal(false)} title="Create New Inbound Lead">
        <form onSubmit={handleCreateLead} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Full Name</label>
            <input
              type="text"
              value={leadFormData.name}
              onChange={(e) => setLeadFormData({ ...leadFormData, name: e.target.value })}
              placeholder="e.g. John Doe"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Phone Number</label>
              <input
                type="text"
                value={leadFormData.phone}
                onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                placeholder="e.g. 9876543210"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Email Address</label>
              <input
                type="email"
                value={leadFormData.email}
                onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                placeholder="e.g. john@acme.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Company / Organization</label>
            <input
              type="text"
              value={leadFormData.company}
              onChange={(e) => setLeadFormData({ ...leadFormData, company: e.target.value })}
              placeholder="e.g. Acme Corp"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Source Category</label>
              <select
                value={leadFormData.primarySource}
                onChange={(e) => setLeadFormData({ ...leadFormData, primarySource: e.target.value, source: e.target.value === 'SOURCE_A_MANUAL' ? 'manual' : e.target.value === 'SOURCE_B_SIGNUP' ? 'signup' : 'ads' })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="SOURCE_A_MANUAL">Source A: Manual Direct</option>
                <option value="SOURCE_B_SIGNUP">Source B: User Signup</option>
                <option value="SOURCE_C_ADS">Source C: Ads / Webhook</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Assign to Representative</label>
              <select
                value={leadFormData.assignedTo}
                onChange={(e) => setLeadFormData({ ...leadFormData, assignedTo: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">Unassigned Pool</option>
                {allTeamMembers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.role || 'Agent'})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddLeadModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Create Lead
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Add Member Modal */}
      <Modal isOpen={showAddAgentModal} onClose={() => setShowAddAgentModal(false)} title="Add Hierarchy Team Member">
        <form onSubmit={handleCreateAgent} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Full Name</label>
            <input
              type="text"
              value={agentFormData.name}
              onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
              placeholder="e.g. Alice Smith"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Email</label>
              <input
                type="email"
                value={agentFormData.email}
                onChange={(e) => setAgentFormData({ ...agentFormData, email: e.target.value })}
                placeholder="e.g. alice@crm.com"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Phone</label>
              <input
                type="text"
                value={agentFormData.phone}
                onChange={(e) => setAgentFormData({ ...agentFormData, phone: e.target.value })}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Initial Password</label>
            <input
              type="password"
              value={agentFormData.password}
              onChange={(e) => setAgentFormData({ ...agentFormData, password: e.target.value })}
              placeholder="••••••••••••"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Role Hierarchy</label>
              <select
                value={agentFormData.role}
                onChange={(e) => setAgentFormData({ ...agentFormData, role: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="agent">Sales Representative (Agent)</option>
                <option value="manager">Team Manager</option>
              </select>
            </div>
            {agentFormData.role === 'agent' && (
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Reporting Manager</label>
                <select
                  value={agentFormData.managerId}
                  onChange={(e) => setAgentFormData({ ...agentFormData, managerId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Unassigned</option>
                  {(hierarchy.managers || []).map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddAgentModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Add Member
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Edit User Modal */}
      {showEditUserModal && editingUser && (
        <Modal isOpen={showEditUserModal} onClose={() => setShowEditUserModal(false)} title={`Edit ${editingUser.name}`}>
          <form onSubmit={handleUpdateUser} className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Full Name</label>
              <input
                type="text"
                value={editingUser.name || ''}
                onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Lead Quota Cap</label>
                <input
                  type="number"
                  value={editingUser.leadCap || 50}
                  onChange={(e) => setEditingUser({ ...editingUser, leadCap: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Commission %</label>
                <input
                  type="number"
                  value={editingUser.incentive_pct || 10}
                  onChange={(e) => setEditingUser({ ...editingUser, incentive_pct: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
            {editingUser.role === 'agent' && (
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Reporting Manager</label>
                <select
                  value={editingUser.managerId?._id || editingUser.managerId || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, managerId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Unassigned</option>
                  {(hierarchy.managers || []).map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editRouting"
                checked={Boolean(editingUser.isAvailableForRouting)}
                onChange={(e) => setEditingUser({ ...editingUser, isAvailableForRouting: e.target.checked })}
                className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900 cursor-pointer"
              />
              <label htmlFor="editRouting" className="text-xs text-slate-300 cursor-pointer">
                Available for Auto Lead Routing
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowEditUserModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Broadcast Modal */}
      <Modal isOpen={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} title="Dispatch Team Broadcast">
        <form onSubmit={handleCreateBroadcast} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Announcement Title</label>
            <input
              type="text"
              value={broadcastFormData.title}
              onChange={(e) => setBroadcastFormData({ ...broadcastFormData, title: e.target.value })}
              placeholder="e.g. Month-End Sales Target Incentive"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Message Content</label>
            <textarea
              value={broadcastFormData.message}
              onChange={(e) => setBroadcastFormData({ ...broadcastFormData, message: e.target.value })}
              placeholder="Enter message visible on all team screens..."
              rows={3}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Priority</label>
              <select
                value={broadcastFormData.priority}
                onChange={(e) => setBroadcastFormData({ ...broadcastFormData, priority: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High Priority</option>
                <option value="URGENT">Urgent Alert</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Target Audience</label>
              <select
                value={broadcastFormData.targetAudience}
                onChange={(e) => setBroadcastFormData({ ...broadcastFormData, targetAudience: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="INTERNAL_ALL">All Staff Members</option>
                <option value="MANAGERS_ONLY">Managers Only</option>
                <option value="AGENTS_ONLY">Sales Reps Only</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowBroadcastModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Dispatch Notice
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Add Rule Modal */}
      <Modal isOpen={showAddRuleModal} onClose={() => setShowAddRuleModal(false)} title="Create Distribution Rule">
        <form onSubmit={handleCreateRule} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Rule Name</label>
            <input
              type="text"
              value={ruleFormData.name}
              onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
              placeholder="e.g. High Priority Inbound Round Robin"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Routing Strategy</label>
              <select
                value={ruleFormData.strategy}
                onChange={(e) => setRuleFormData({ ...ruleFormData, strategy: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="LEAST_LOADED">Least Loaded Rep</option>
                <option value="PRIORITY_WEIGHTED">Priority Weighted</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Priority Order</label>
              <input
                type="number"
                min="1"
                max="10"
                value={ruleFormData.priority}
                onChange={(e) => setRuleFormData({ ...ruleFormData, priority: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddRuleModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Save Rule
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. Add Campaign Modal */}
      <Modal isOpen={showAddCampaignModal} onClose={() => setShowAddCampaignModal(false)} title="Add Ad Campaign Tracker">
        <form onSubmit={handleCreateCampaign} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Campaign Name</label>
            <input
              type="text"
              value={campaignFormData.campaignName}
              onChange={(e) => setCampaignFormData({ ...campaignFormData, campaignName: e.target.value })}
              placeholder="e.g. Q3 Growth Leads - Meta"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Ad Platform</label>
              <select
                value={campaignFormData.platform}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, platform: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="META">Meta / Facebook</option>
                <option value="GOOGLE">Google Ads</option>
                <option value="LINKEDIN">LinkedIn Ads</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Budget Allocated (₹)</label>
              <input
                type="number"
                value={campaignFormData.budget}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, budget: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddCampaignModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Save Campaign
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. Add Template Modal */}
      <Modal isOpen={showAddTemplateModal} onClose={() => setShowAddTemplateModal(false)} title="Create Communication Template">
        <form onSubmit={handleCreateTemplate} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Template Name</label>
            <input
              type="text"
              value={templateFormData.name}
              onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
              placeholder="e.g. Instant Intro Pitch"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Channel</label>
              <select
                value={templateFormData.channel}
                onChange={(e) => setTemplateFormData({ ...templateFormData, channel: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Category</label>
              <select
                value={templateFormData.category}
                onChange={(e) => setTemplateFormData({ ...templateFormData, category: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="GENERAL">General</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="PROMOTIONAL">Promotional</option>
                <option value="CLOSING">Closing Deal</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Template Body (supports {`{{name}}`}, {`{{company}}`})</label>
            <textarea
              value={templateFormData.content}
              onChange={(e) => setTemplateFormData({ ...templateFormData, content: e.target.value })}
              placeholder="Hello {{name}}, thanks for reaching out to CoreSetu..."
              rows={4}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddTemplateModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Save Template
            </button>
          </div>
        </form>
      </Modal>

      {/* 8. Add Catalogue Item Modal */}
      <Modal isOpen={showAddCatalogueModal} onClose={() => setShowAddCatalogueModal(false)} title="Add Product / Package">
        <form onSubmit={handleCreateCatalogue} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Item / Package Name</label>
            <input
              type="text"
              value={catalogueFormData.itemName}
              onChange={(e) => setCatalogueFormData({ ...catalogueFormData, itemName: e.target.value })}
              placeholder="e.g. Enterprise Annual CRM License"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Retail Price (₹)</label>
              <input
                type="number"
                value={catalogueFormData.price}
                onChange={(e) => setCatalogueFormData({ ...catalogueFormData, price: Number(e.target.value) })}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Discounted Price (₹)</label>
              <input
                type="number"
                value={catalogueFormData.discountedPrice}
                onChange={(e) => setCatalogueFormData({ ...catalogueFormData, discountedPrice: Number(e.target.value) })}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Description</label>
            <textarea
              value={catalogueFormData.description}
              onChange={(e) => setCatalogueFormData({ ...catalogueFormData, description: e.target.value })}
              placeholder="Item inclusions and deliverables..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddCatalogueModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Add Item
            </button>
          </div>
        </form>
      </Modal>

      {/* 9. Add Coupon Modal */}
      <Modal isOpen={showAddCouponModal} onClose={() => setShowAddCouponModal(false)} title="Create Discount Coupon">
        <form onSubmit={handleCreateCoupon} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Coupon Code (Uppercase)</label>
            <input
              type="text"
              value={couponFormData.code}
              onChange={(e) => setCouponFormData({ ...couponFormData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. FESTIVE30"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Discount Type</label>
              <select
                value={couponFormData.discountType}
                onChange={(e) => setCouponFormData({ ...couponFormData, discountType: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Discount Value</label>
              <input
                type="number"
                value={couponFormData.discountValue}
                onChange={(e) => setCouponFormData({ ...couponFormData, discountValue: Number(e.target.value) })}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddCouponModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Save Coupon
            </button>
          </div>
        </form>
      </Modal>

      {/* 10. Add Commission Rule Modal */}
      <Modal isOpen={showAddCommissionModal} onClose={() => setShowAddCommissionModal(false)} title="Create Commission Rule">
        <form onSubmit={handleCreateCommissionRule} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Rule Name</label>
            <input
              type="text"
              value={commFormData.ruleName}
              onChange={(e) => setCommFormData({ ...commFormData, ruleName: e.target.value })}
              placeholder="e.g. Standard Rep 10% Closing Bonus"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Target Role</label>
              <select
                value={commFormData.targetRole}
                onChange={(e) => setCommFormData({ ...commFormData, targetRole: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="AGENT">Sales Rep (Agent)</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Incentive %</label>
              <input
                type="number"
                value={commFormData.value}
                onChange={(e) => setCommFormData({ ...commFormData, value: Number(e.target.value) })}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddCommissionModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Save Rule
            </button>
          </div>
        </form>
      </Modal>

      {/* 11. Comprehensive Lead Profile Workspace Modal */}
      <LeadProfileModal
        isOpen={Boolean(selectedLeadProfile)}
        onClose={() => setSelectedLeadProfile(null)}
        lead={selectedLeadProfile}
        plans={allPlans}
        teamMembers={allTeamMembers}
        onStageChange={handleStageChange}
        onOpenCancelFollowUp={(lead) => setCancelFollowUpLead(lead)}
        onOpenCloseDeal={(lead) => setCloseDealLead(lead)}
        onOpenAssignPlan={(lead, isFree) => {
          setAssignPlanLead(lead);
          setAssignPlanIsFree(Boolean(isFree));
        }}
        onReassignAgent={async (leadId, agentId) => {
          const res = await fetch(`${API_BASE}/admin/leads/${leadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ assignedTo: agentId || null }),
          });
          const data = await res.json();
          if (data.success) {
            toast.success('Lead assignee updated');
            fetchTabData('leads');
            if (selectedLeadProfile && selectedLeadProfile._id === leadId) {
              setSelectedLeadProfile(data.lead);
            }
          }
        }}
        onAddNote={handleAddLeadNote}
      />

      {/* 12. Follow-up Cancellation Modal (Mandatory Justification Reason) */}
      <CancelFollowUpModal
        isOpen={Boolean(cancelFollowUpLead)}
        onClose={() => setCancelFollowUpLead(null)}
        lead={cancelFollowUpLead}
        onConfirm={handleCancelFollowUp}
      />

      {/* 13. Deal Closure & Automated Commission Ledger Modal */}
      <CloseDealModal
        isOpen={Boolean(closeDealLead)}
        onClose={() => setCloseDealLead(null)}
        lead={closeDealLead}
        plans={allPlans}
        onConfirm={handleCloseDeal}
      />

      {/* 14. Subscription Plan & Complimentary Access Modal */}
      <AssignPlanModal
        isOpen={Boolean(assignPlanLead)}
        onClose={() => setAssignPlanLead(null)}
        lead={assignPlanLead}
        plans={allPlans}
        onConfirm={handleAssignPlan}
      />

      {/* 15. Dynamic Multi-Scope Broadcast Modal */}
      <SendBroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        onSendBroadcast={handleSendBroadcast}
      />
    </AdminLayout>
  );
}

export default function AdminControlCenter() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#070b14] text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <div className="text-xs font-mono text-slate-400">Loading CoreSetu OS Control Center...</div>
          </div>
        </div>
      }
    >
      <AdminControlCenterContent />
    </Suspense>
  );
}
