'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, TrendingUp, Activity, Shield, AlertTriangle,
  Plus, Search, Check, X, RefreshCw, ExternalLink,
  Phone, MessageSquare, DollarSign, Clock, Calendar,
  Tag, Layers, Download, ChevronRight, CheckCircle,
  Send, Sliders, FileText, UserCheck, UserX, Eye,
  Edit, Trash2, Share2, Grid, List, Award, ArrowRight,
  Briefcase, AlertCircle, HelpCircle, CheckSquare
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Exact 5 Kanban Stages
const KANBAN_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'border-slate-500/40 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' },
  { id: 'contacted', label: 'Contacted', color: 'border-blue-500/40 bg-blue-500/10 text-blue-300', dot: 'bg-blue-400' },
  { id: 'not_interested', label: 'Not Interested', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
  { id: 'converted', label: 'Converted', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  { id: 'payment_done', label: 'Payment Done', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300', dot: 'bg-purple-400' },
];

// Standardized 6 Subscription Plans Catalog (3 Individual, 3 Organization)
const SERVICE_CATALOG = {
  basic_solo: { label: 'Basic Solo (₹399/mo)', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  smart_solo: { label: 'Smart Solo (₹799/mo)', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  power_solo: { label: 'Power Solo (₹1,299/mo)', color: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  team_starter: { label: 'Team Starter (₹1,499/mo)', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  business: { label: 'Business Agency (₹2,499/mo)', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  enterprise: { label: 'Enterprise Command (₹4,999/mo)', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  // Backward compatibility fallback
  custom_enterprise: { label: 'Custom Enterprise', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  digital_marketing: { label: 'Smart Solo (₹799/mo)', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  web_development: { label: 'Business Agency (₹2,499/mo)', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  crm_automation: { label: 'Enterprise Command (₹4,999/mo)', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
};

// Goal Timelines
const TIMELINE_OPTIONS = [
  { id: 'immediate', label: 'Immediate (< 1 week)' },
  { id: 'within_1_month', label: 'Within 1 Month' },
  { id: '1_to_3_months', label: '1 - 3 Months' },
  { id: '3_to_6_months', label: '3 - 6 Months' },
  { id: 'flexible', label: 'Flexible / Exploring' },
];

export default function SuperAdminDashboard() {
  const router = useRouter();

  // Auth & UI State
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'agents' | 'alerts_queue' | 'offers_payments' | 'activity_logs'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // Data States
  const [metrics, setMetrics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [canonicalPlans, setCanonicalPlans] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState({ flaggedLeads: [], overdueFollowUps: [], totalAlerts: 0 });
  const [activityLogs, setActivityLogs] = useState([]);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all'); // 'all' | 'real' | 'test'
  const [userTypeFilter, setUserTypeFilter] = useState('all'); // 'all' | 'real' | 'test'
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'

  // Drawer & Modals
  const [selectedLead, setSelectedLead] = useState(null); // Slide-Over Drawer
  const [targetLead, setTargetLead] = useState(null);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);

  // Modal Form States
  const [targetFollowUp, setTargetFollowUp] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({ scheduled_at: '', note: '' });
  const [completeForm, setCompleteForm] = useState({ note: '', error: '' });
  const [postponeForm, setPostponeForm] = useState({ new_date: '', postpone_remark: '' });
  const [convertForm, setConvertForm] = useState({
    plan_id: '',
    custom_payment_amount: '',
    custom_price_reason: '',
    payment_method: 'bank_transfer',
    transaction_id: '',
    verify_payment: true,
  });
  const [editLeadForm, setEditLeadForm] = useState({
    name: '', phone: '', email: '', company: '', service_required: 'digital_marketing', monthly_spend: '', goal_timeline: 'immediate', assignedTo: ''
  });
  const [newLeadForm, setNewLeadForm] = useState({
    name: '', phone: '', email: '', company: '', service_required: 'digital_marketing', monthly_spend: '', goal_timeline: 'immediate', assignedTo: '', notes: ''
  });
  const [newAgentForm, setNewAgentForm] = useState({
    name: '', email: '', phone: '', password: 'Password@123', companyRole: 'sales_rep', incentive_pct: 10, whatsapp_connection: 'agent_owned'
  });
  const [reassignForm, setReassignForm] = useState({ fromAgentId: '', toAgentId: '' });

  const showToast = (msg, type = 'success') => {
    setNotification({ show: true, message: msg, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4500);
  };

  // Auth Initialization
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    try {
      const u = JSON.parse(storedUser || '{}');
      if (u.role !== 'superadmin' && !u.isAdmin && u.email !== 'admin@crm.com') {
        router.push('/dashboard');
        return;
      }
    } catch {
      router.push('/login');
      return;
    }
    setToken(storedToken);
  }, [router]);

  // Load All Dashboard Data
  const loadAllData = async (activeAuthToken = token) => {
    if (!activeAuthToken) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${activeAuthToken}` };
      const [mRes, lRes, aRes, uRes, pRes, alRes, actRes] = await Promise.all([
        fetch(`${API_BASE}/admin/metrics`, { headers }),
        fetch(`${API_BASE}/admin/leads?limit=300`, { headers }),
        fetch(`${API_BASE}/admin/agents`, { headers }),
        fetch(`${API_BASE}/admin/users?limit=300`, { headers }),
        fetch(`${API_BASE}/admin/plans`, { headers }),
        fetch(`${API_BASE}/admin/alerts-queue`, { headers }),
        fetch(`${API_BASE}/admin/activity-logs?limit=50`, { headers }),
      ]);

      if (mRes.ok) setMetrics(await mRes.json());
      if (lRes.ok) {
        const lData = await lRes.json();
        setLeads(lData.leads || []);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        setAgents(aData.agents || []);
      }
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsersList(uData.users || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setCanonicalPlans(pData.plans || []);
      }
      if (alRes.ok) {
        const alData = await alRes.json();
        setAdminAlerts(alData);
      }
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivityLogs(actData.logs || []);
      }
    } catch (err) {
      console.error('Data load error:', err);
      showToast('Error syncing dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadAllData(token);
  }, [token]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (leadTypeFilter === 'real' && !lead.isRealData) return false;
      if (leadTypeFilter === 'test' && !lead.isTestData) return false;
      if (agentFilter !== 'all') {
        const assignedId = lead.assignedTo?._id || lead.assignedTo;
        if (assignedId !== agentFilter) return false;
      }
      if (serviceFilter !== 'all') {
        if (lead.service_required !== serviceFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nMatch = lead.name?.toLowerCase().includes(q);
        const pMatch = lead.phone?.toLowerCase().includes(q);
        const eMatch = lead.email?.toLowerCase().includes(q);
        const cMatch = lead.company?.toLowerCase().includes(q);
        if (!nMatch && !pMatch && !eMatch && !cMatch) return false;
      }
      return true;
    });
  }, [leads, leadTypeFilter, agentFilter, serviceFilter, searchQuery]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter((user) => {
      if (userTypeFilter === 'real' && !user.isRealData) return false;
      if (userTypeFilter === 'test' && !user.isTestData) return false;
      if (userPlanFilter !== 'all' && user.plan !== userPlanFilter) return false;
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase().trim();
        const nMatch = user.name?.toLowerCase().includes(q);
        const pMatch = user.phone?.toLowerCase().includes(q);
        const eMatch = user.email?.toLowerCase().includes(q);
        const cMatch = (user.companyInfo?.companyName || user.organizationName)?.toLowerCase().includes(q);
        const uMatch = user.usercode?.toLowerCase().includes(q) || user.username?.toLowerCase().includes(q);
        if (!nMatch && !pMatch && !eMatch && !cMatch && !uMatch) return false;
      }
      return true;
    });
  }, [usersList, userTypeFilter, userPlanFilter, userSearchQuery]);

  // User Actions: Assign Plan, Toggle Status, Delete User, Clean Test Data
  const handleAssignPlan = async (userId, planName) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/users/${userId}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planName }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Plan updated to ${planName.toUpperCase()} ✅`, 'success');
        loadAllData();
      } else {
        showToast(data.message || 'Failed to update plan', 'error');
      }
    } catch (err) {
      showToast('Error updating user plan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'User status updated ✅', 'success');
        loadAllData();
      } else {
        showToast(data.message || 'Failed to toggle status', 'error');
      }
    } catch (err) {
      showToast('Error updating status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to permanently delete user "${userName}"? This cannot be undone.`)) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`User "${userName}" deleted successfully ✅`, 'success');
        loadAllData();
      } else {
        showToast(data.message || 'Failed to delete user', 'error');
      }
    } catch (err) {
      showToast('Error deleting user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeTestData = async () => {
    if (!confirm("⚠️ Are you sure you want to clean all test/fake leads and mock test accounts?\n\n✅ ALL REAL PRODUCTION USERS AND REAL SIGNUPS WILL BE 100% PRESERVED.")) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/purge-test-data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Test data cleaned successfully! ✅', 'success');
        loadAllData();
      } else {
        showToast(data.message || 'Failed to clean test data', 'error');
      }
    } catch (err) {
      showToast('Error cleaning test data', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 1. Create Lead (Strict 6 Fields)
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.name || !newLeadForm.phone) {
      showToast('Name and phone are mandatory', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newLeadForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to create lead', 'error');
        return;
      }
      showToast(`Lead "${data.lead.name}" created! Please schedule a follow-up.`, 'success');
      setShowAddLeadModal(false);
      setNewLeadForm({
        name: '', phone: '', email: '', company: '', service_required: 'digital_marketing', monthly_spend: '', goal_timeline: 'immediate', assignedTo: '', notes: ''
      });
      loadAllData();
      // Auto-open follow-up scheduler for newly created lead
      setTargetLead(data.lead);
      setFollowUpForm({ scheduled_at: '', note: '' });
      setShowFollowUpModal(true);
    } catch (err) {
      showToast('Error creating lead', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Edit Lead (Restricted basic fields)
  const handleOpenEditLead = (lead) => {
    setTargetLead(lead);
    setEditLeadForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      company: lead.company || '',
      service_required: lead.service_required || 'digital_marketing',
      monthly_spend: lead.monthly_spend !== undefined ? lead.monthly_spend : '',
      goal_timeline: lead.goal_timeline || 'immediate',
      assignedTo: lead.assignedTo?._id || lead.assignedTo || '',
    });
    setShowEditLeadModal(true);
  };

  const handleSaveEditLead = async (e) => {
    e.preventDefault();
    if (!targetLead) return;

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/leads/${targetLead._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editLeadForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to update lead', 'error');
        return;
      }
      showToast('Lead details updated successfully', 'success');
      setShowEditLeadModal(false);
      setTargetLead(null);
      loadAllData();
      if (selectedLead && selectedLead._id === targetLead._id) {
        setSelectedLead(data.lead);
      }
    } catch (err) {
      showToast('Error updating lead', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Stage Change (Strict 5 stages)
  const handleStageChange = async (leadId, newStage) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage: newStage }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to update stage', 'error');
        if (data.code === 'PAYMENT_REQUIRED_FOR_CONVERSION') {
          const leadObj = leads.find(l => l._id === leadId);
          if (leadObj) {
            setTargetLead(leadObj);
            setShowConvertModal(true);
          }
        }
        return;
      }
      showToast(`Lead moved to ${newStage.replace('_', ' ').toUpperCase()}`, 'success');
      loadAllData();
      if (selectedLead && selectedLead._id === leadId) {
        setSelectedLead(data.lead);
      }
    } catch (err) {
      showToast('Error updating stage', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Schedule Follow-Up (Mandatory Note)
  const handleScheduleFollowUp = async (e) => {
    e.preventDefault();
    if (!targetLead) return;
    if (!followUpForm.scheduled_at || !followUpForm.note?.trim()) {
      showToast('Scheduled date/time and note are mandatory', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/leads/${targetLead._id}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(followUpForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to schedule follow-up', 'error');
        return;
      }
      showToast('Follow-up scheduled successfully!', 'success');
      setShowFollowUpModal(false);
      setFollowUpForm({ scheduled_at: '', note: '' });
      setTargetLead(null);
      loadAllData();
    } catch (err) {
      showToast('Error scheduling follow-up', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Complete Follow-Up Flow (Mandatory Outcome Note)
  const handleOpenCompleteFollowUp = (fu, lead) => {
    setTargetFollowUp(fu);
    setTargetLead(lead);
    setCompleteForm({ note: '', error: '' });
    setShowCompleteModal(true);
  };

  const handleCompleteFollowUp = async (e) => {
    e.preventDefault();
    if (!completeForm.note?.trim()) {
      setCompleteForm(prev => ({ ...prev, error: 'Outcome note is mandatory to complete follow-up.' }));
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/followups/${targetFollowUp._id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: completeForm.note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to complete follow-up', 'error');
        return;
      }
      showToast('Follow-up completed successfully! You can now schedule next steps.', 'success');
      setShowCompleteModal(false);
      setCompleteForm({ note: '', error: '' });
      setTargetFollowUp(null);
      loadAllData();
    } catch (err) {
      showToast('Error completing follow-up', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Postpone Follow-Up (Mandatory Remark)
  const handleOpenPostpone = (fu, lead) => {
    setTargetFollowUp(fu);
    setTargetLead(lead);
    setPostponeForm({ new_date: '', postpone_remark: '' });
    setShowPostponeModal(true);
  };

  const handlePostponeFollowUp = async (e) => {
    e.preventDefault();
    if (!postponeForm.new_date || !postponeForm.postpone_remark?.trim()) {
      showToast('New date and postpone remark are mandatory', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/followups/${targetFollowUp._id}/postpone`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(postponeForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to postpone follow-up', 'error');
        return;
      }
      showToast('Follow-up postponed with recorded remark', 'success');
      setShowPostponeModal(false);
      setPostponeForm({ new_date: '', postpone_remark: '' });
      setTargetFollowUp(null);
      loadAllData();
    } catch (err) {
      showToast('Error postponing follow-up', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Convert Lead with Plan or Custom Amount
  const handleOpenConvert = (lead) => {
    setTargetLead(lead);
    const defaultPlan = canonicalPlans[0]?.code || 'IND_STARTER_MONTHLY_V1';
    setConvertForm({
      plan_id: defaultPlan,
      custom_payment_amount: '',
      custom_price_reason: '',
      payment_method: 'bank_transfer',
      transaction_id: `TXN-${Date.now()}`,
      verify_payment: true,
    });
    setShowConvertModal(true);
  };

  const handleConvertDeal = async (e) => {
    e.preventDefault();
    if (!targetLead) return;

    if (convertForm.custom_payment_amount && !convertForm.custom_price_reason?.trim()) {
      showToast('Justification reason is mandatory when offering a custom payment amount', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/leads/${targetLead._id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(convertForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to convert lead', 'error');
        return;
      }
      showToast(data.message || 'Lead converted successfully!', 'success');
      setShowConvertModal(false);
      setTargetLead(null);
      loadAllData();
      if (selectedLead && selectedLead._id === targetLead._id) {
        setSelectedLead(data.lead);
      }
    } catch (err) {
      showToast('Error converting lead', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Create Agent
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newAgentForm.name || !newAgentForm.email || !newAgentForm.password) {
      showToast('Name, email and password are required', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newAgentForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to onboard agent', 'error');
        return;
      }
      showToast(`Agent "${data.agent.name}" onboarded successfully!`, 'success');
      setShowAddAgentModal(false);
      setNewAgentForm({ name: '', email: '', phone: '', password: 'Password@123', companyRole: 'sales_rep', incentive_pct: 10, whatsapp_connection: 'agent_owned' });
      loadAllData();
    } catch (err) {
      showToast('Error onboarding agent', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Activity Logs CSV
  const handleExportActivityLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/activity-logs?format=csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm_activity_logs_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Activity logs CSV downloaded successfully', 'success');
    } catch (err) {
      showToast('Failed to export CSV', 'error');
    }
  };

  // WhatsApp 1-Click
  const handleWhatsAppAction = (lead) => {
    const phone = String(lead.phone).replace(/\D/g, '');
    const waUrl = `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodeURIComponent(`Hello ${lead.name}, regarding your requirement for ${SERVICE_CATALOG[lead.service_required]?.label || 'our services'}...`)}`;
    window.open(waUrl, '_blank');
    showToast(`Opening WhatsApp with ${lead.name}`, 'success');
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 font-sans antialiased pb-20 selection:bg-indigo-500 selection:text-white">
      
      {/* ── TOAST NOTIFICATIONS ── */}
      {notification.show && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-3 animate-fade-in border ${
          notification.type === 'error'
            ? 'bg-rose-950/90 text-rose-200 border-rose-600/50 shadow-rose-900/30'
            : 'bg-emerald-950/90 text-emerald-200 border-emerald-600/50 shadow-emerald-900/30'
        }`}>
          {notification.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="border-b border-slate-800/80 bg-[#090d1a]/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm tracking-tight text-white">CRM COMMAND CENTER</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Strict Lifecycle
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Unified Pipeline & Agent Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            <button
              onClick={() => loadAllData()}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition shrink-0"
              title="Refresh CRM Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={handleExportActivityLogs}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Audit</span>
            </button>
            <button
              onClick={handlePurgeTestData}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
              title="Clean all test and fake data generated during tests/demos while permanently preserving real signups"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Clean Test Data</span>
              <span className="sm:hidden">Purge</span>
            </button>
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition transform active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </button>
            <button
              onClick={() => setShowAddAgentModal(true)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Onboard Agent</span>
              <span className="sm:hidden">Agent</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── KPI STATS ── */}
      <section className="max-w-7xl mx-auto px-6 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-[#0f172a]/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Total Pipeline</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white">{leads.length}</div>
            <div className="text-[10px] text-slate-400 mt-1">Active Leads</div>
          </div>

          <div className="bg-[#0f172a]/80 border border-blue-500/20 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-blue-300 text-xs font-medium mb-1">
              <span>Contacted</span>
              <MessageSquare className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400">
              {leads.filter(l => l.status === 'contacted').length}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">In Dialogue</div>
          </div>

          <div className="bg-[#0f172a]/80 border border-emerald-500/20 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-medium mb-1">
              <span>Converted</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {leads.filter(l => l.status === 'converted').length}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Payment verified</div>
          </div>

          <div className="bg-[#0f172a]/80 border border-purple-500/20 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-purple-300 text-xs font-medium mb-1">
              <span>Payment Done</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-400">
              {leads.filter(l => l.status === 'payment_done').length}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Closed Deals</div>
          </div>

          <div className="bg-[#0f172a]/80 border border-amber-500/20 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-amber-300 text-xs font-medium mb-1">
              <span>Admin Alerts</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">
              {adminAlerts.totalAlerts}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Audit Flagged</div>
          </div>

          <div className="bg-[#0f172a]/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Active Agents</span>
              <Award className="w-4 h-4 text-pink-400" />
            </div>
            <div className="text-2xl font-black text-pink-400">{agents.length}</div>
            <div className="text-[10px] text-slate-400 mt-1">Team Roster</div>
          </div>
        </div>
      </section>

      {/* ── TAB NAVIGATION ── */}
      <section className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'pipeline', label: '🎯 Unified 5-Stage Pipeline', count: leads.length },
              { id: 'users', label: '🏢 Platform Signups & Users', count: usersList.length, badgeColor: 'bg-emerald-500 text-slate-950 font-black' },
              { id: 'agents', label: '👥 Team Agents Roster', count: agents.length },
              { id: 'alerts_queue', label: '🚨 Admin Review Alerts', count: adminAlerts.totalAlerts, badgeColor: 'bg-amber-500 text-slate-950 font-black' },
              { id: 'activity_logs', label: '📋 Live Audit Logs', count: activityLogs.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${tab.badgeColor || (activeTab === tab.id ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-400')}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'pipeline' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-1.5 rounded-lg text-xs transition ${viewMode === 'kanban' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Kanban Board View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs transition ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Data Table View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── TAB 1: PIPELINE ── */}
      {activeTab === 'pipeline' && (
        <main className="max-w-7xl mx-auto px-6 pt-6">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search leads by name, phone, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Agents ({agents.length})</option>
                {agents.map((a) => (
                  <option key={a._id} value={a._id}>{a.name} ({a.usercode || 'Agent'})</option>
                ))}
              </select>

              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All 6 Services</option>
                {Object.entries(SERVICE_CATALOG).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Filter: All / Real Signups / Test Data */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filter Pipeline:</span>
            <button
              onClick={() => setLeadTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${leadTypeFilter === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'}`}
            >
              🌟 All Leads ({leads.length})
            </button>
            <button
              onClick={() => setLeadTypeFilter('real')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${leadTypeFilter === 'real' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'bg-slate-900 border border-emerald-500/30 text-emerald-400 hover:text-white'}`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>🟢 Real Production Signups ({leads.filter(l => l.isRealData).length})</span>
            </button>
            <button
              onClick={() => setLeadTypeFilter('test')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${leadTypeFilter === 'test' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'bg-slate-900 border border-amber-500/30 text-amber-400 hover:text-white'}`}
            >
              <span>🧪 Test & Mock Data ({leads.filter(l => l.isTestData).length})</span>
            </button>
          </div>

          {/* 5-STAGE KANBAN BOARD VIEW */}
          {viewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
              {KANBAN_STAGES.map((stage) => {
                const stageLeads = filteredLeads.filter((l) => (l.status === stage.id || (!KANBAN_STAGES.some(ks => ks.id === l.status) && stage.id === 'new_lead')));

                return (
                  <div key={stage.id} className="bg-[#0b1120]/80 border border-slate-800/80 rounded-2xl p-3 flex flex-col min-h-[550px]">
                    {/* Stage Header */}
                    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border mb-3 ${stage.color}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                        <span className="font-bold text-xs uppercase tracking-wider">{stage.label}</span>
                      </div>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-900/60">
                        {stageLeads.length}
                      </span>
                    </div>

                    {/* Cards Container */}
                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[750px] pr-1">
                      {stageLeads.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center text-slate-600 text-xs border border-dashed border-slate-800/60 rounded-xl">
                          <span>No leads in {stage.label}</span>
                        </div>
                      ) : (
                        stageLeads.map((lead) => {
                          const serviceObj = SERVICE_CATALOG[lead.service_required] || SERVICE_CATALOG.digital_marketing;
                          const assigned = agents.find((a) => a._id === (lead.assignedTo?._id || lead.assignedTo));
                          const openFollowUp = lead.followUps?.find(f => f.status === 'open');

                          return (
                            <div
                              key={lead._id}
                              onClick={() => setSelectedLead(lead)}
                              className="group bg-[#0f172a] hover:bg-[#131d35] border border-slate-800 hover:border-indigo-500/50 rounded-xl p-3.5 shadow-sm hover:shadow-lg transition cursor-pointer flex flex-col gap-2 relative"
                            >
                              {/* Service Badge & Real/Test Indicator & Admin Flag */}
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${serviceObj.color}`}>
                                    {serviceObj.label}
                                  </span>
                                  {lead.isRealData ? (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                      REAL
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      TEST
                                    </span>
                                  )}
                                </div>
                                {lead.metadata?.admin_flag && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                    AUDIT FLAG
                                  </span>
                                )}
                              </div>

                              {/* Lead Name & Company */}
                              <div>
                                <h4 className="font-bold text-xs text-white group-hover:text-indigo-300 transition line-clamp-1">
                                  {lead.name}
                                </h4>
                                {lead.company && (
                                  <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                    <Briefcase className="w-3 h-3 text-slate-500" />
                                    <span>{lead.company}</span>
                                  </div>
                                )}
                              </div>

                              {/* Phone */}
                              <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{lead.phone}</span>
                              </div>

                              {/* Spend & Timeline */}
                              <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                                <span>Spend: <strong className="text-emerald-400">₹{(lead.monthly_spend || 0).toLocaleString()}</strong></span>
                                <span className="capitalize">{lead.goal_timeline?.replace(/_/g, ' ') || 'Immediate'}</span>
                              </div>

                              {/* Follow-up Pending Warning Pill */}
                              {openFollowUp ? (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[10px] text-amber-300 flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                                    <span className="truncate font-semibold">{new Date(openFollowUp.scheduled_at || openFollowUp.scheduledAt).toLocaleDateString()}</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenCompleteFollowUp(openFollowUp, lead);
                                    }}
                                    className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded text-[9px] font-bold shrink-0"
                                  >
                                    Done
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTargetLead(lead);
                                    setFollowUpForm({ scheduled_at: '', note: '' });
                                    setShowFollowUpModal(true);
                                  }}
                                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-400 hover:text-indigo-300 text-[10px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
                                >
                                  <Calendar className="w-3 h-3 text-slate-500" />
                                  <span>+ Schedule Follow-up</span>
                                </button>
                              )}

                              {/* Quick Actions & Stage Movers */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-1" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleWhatsAppAction(lead)}
                                    title="Open WhatsApp"
                                    className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                  <a
                                    href={`tel:${lead.phone}`}
                                    title="Call Lead"
                                    className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    onClick={() => handleOpenEditLead(lead)}
                                    title="Edit Lead"
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  {lead.status !== 'converted' && lead.status !== 'payment_done' && (
                                    <button
                                      onClick={() => handleOpenConvert(lead)}
                                      title="Convert Deal"
                                      className="p-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg transition text-[10px] font-bold flex items-center gap-1"
                                    >
                                      <DollarSign className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <select
                                    value={lead.status}
                                    onChange={(e) => handleStageChange(lead._id, e.target.value)}
                                    className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-1 focus:outline-none"
                                  >
                                    {KANBAN_STAGES.map((s) => (
                                      <option key={s.id} value={s.id}>➔ {s.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* DATA TABLE VIEW */
            <div className="bg-[#0b1120] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Lead Details</th>
                      <th className="py-3.5 px-4 font-semibold">Service Required</th>
                      <th className="py-3.5 px-4 font-semibold">Stage</th>
                      <th className="py-3.5 px-4 font-semibold">Spend & Timeline</th>
                      <th className="py-3.5 px-4 font-semibold">Assigned Agent</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLeads.map((lead) => {
                      const stageObj = KANBAN_STAGES.find((s) => s.id === lead.status) || KANBAN_STAGES[0];
                      const serviceObj = SERVICE_CATALOG[lead.service_required] || SERVICE_CATALOG.digital_marketing;

                      return (
                        <tr
                          key={lead._id}
                          onClick={() => setSelectedLead(lead)}
                          className="hover:bg-slate-900/50 transition cursor-pointer"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{lead.name}</span>
                              {lead.isRealData ? (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  REAL
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  TEST
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">{lead.phone}</div>
                            {lead.company && <div className="text-[10px] text-slate-500">{lead.company}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase ${serviceObj.color}`}>
                              {serviceObj.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${stageObj.color}`}>
                              {stageObj.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-emerald-400 font-semibold">₹{(lead.monthly_spend || 0).toLocaleString()}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{lead.goal_timeline?.replace(/_/g, ' ') || 'Immediate'}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {lead.assignedTo?.name || 'Unassigned'}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleWhatsAppAction(lead)}
                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition"
                                title="WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenConvert(lead)}
                                className="px-2 py-1 bg-purple-600/20 text-purple-300 border border-purple-500/40 rounded-lg text-[10px] font-bold hover:bg-purple-600/30"
                              >
                                Convert
                              </button>
                              <button
                                onClick={() => handleOpenEditLead(lead)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── TAB 2: AGENTS ROSTER ── */}
      {activeTab === 'agents' && (
        <main className="max-w-7xl mx-auto px-6 pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">Field Agents Hierarchy</h2>
              <p className="text-xs text-slate-400">Manage sales representatives, team commissions, and performance.</p>
            </div>
            <button
              onClick={() => setShowAddAgentModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              Onboard Agent
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div key={agent._id} className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-white">{agent.name}</h3>
                      <div className="text-xs text-indigo-400 font-mono mt-0.5">{agent.usercode || 'AGT-001'}</div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {agent.incentive_pct || 10}% Commission
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-400">
                    {agent.organizationTag && (
                      <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        <Briefcase className="w-3 h-3 text-indigo-400" />
                        <span>{agent.organizationTag}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{agent.phone || 'No phone'}</span>
                    </div>
                    <div className="truncate text-slate-400">{agent.email}</div>
                    <div className="text-[11px] text-slate-500 capitalize">Role: {agent.companyRole || 'Sales Rep'}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Assigned Leads: <strong className="text-white">{agent.leads_count ?? leads.filter(l => (l.assignedTo?._id || l.assignedTo) === agent._id).length}</strong></span>
                  <button
                    onClick={() => {
                      setReassignForm({ fromAgentId: agent._id, toAgentId: '' });
                      setShowReassignModal(true);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline"
                  >
                    Reassign Portfolio
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ── TAB 3: ADMIN REVIEW ALERTS ── */}
      {activeTab === 'alerts_queue' && (
        <main className="max-w-7xl mx-auto px-6 pt-6">
          <div className="mb-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Admin Audit & Approval Queue
            </h2>
            <p className="text-xs text-slate-400">Review custom pricing overrides, agent commission triggers, and overdue follow-ups (&gt; 48 hours).</p>
          </div>

          <div className="space-y-6">
            {/* Custom Price Overrides */}
            <div className="bg-[#0b1120] border border-amber-500/30 rounded-2xl p-5">
              <h3 className="font-bold text-sm text-amber-300 mb-3 flex items-center justify-between">
                <span>Flagged Custom Price Deals ({adminAlerts.flaggedLeads?.length || 0})</span>
                <span className="text-[10px] font-normal text-slate-400">Agent entered non-catalog pricing</span>
              </h3>

              {adminAlerts.flaggedLeads?.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No pending custom pricing flags. All conversions align with canonical plans.</div>
              ) : (
                <div className="space-y-3">
                  {adminAlerts.flaggedLeads?.map((fl) => (
                    <div key={fl._id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-xs">{fl.name}</h4>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Paid: ₹{(fl.paid_amount || fl.payable_amount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-amber-300/90 mt-1 font-medium">
                          Reason: &ldquo;{fl.metadata?.custom_price_reason || 'No justification entered'}&rdquo;
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Assigned Agent: {fl.assignedTo?.name || 'Unassigned'} • Phone: {fl.phone}
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedLead(fl)}
                        className="px-3 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-lg text-xs font-bold"
                      >
                        Inspect Lead Audit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overdue Follow-ups (>48h) */}
            <div className="bg-[#0b1120] border border-rose-500/30 rounded-2xl p-5">
              <h3 className="font-bold text-sm text-rose-300 mb-3 flex items-center justify-between">
                <span>Overdue Follow-Ups &gt; 48 Hours ({adminAlerts.overdueFollowUps?.length || 0})</span>
                <span className="text-[10px] font-normal text-slate-400">Escalated to SuperAdmin</span>
              </h3>

              {adminAlerts.overdueFollowUps?.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">Zero overdue follow-ups! Follow-up completion SLA is healthy.</div>
              ) : (
                <div className="space-y-3">
                  {adminAlerts.overdueFollowUps?.map((fu) => (
                    <div key={fu._id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-white">{fu.lead_id?.name || 'Lead'}</div>
                        <div className="text-xs text-rose-400 mt-0.5">Scheduled for: {new Date(fu.scheduled_at).toLocaleString()}</div>
                        <div className="text-[11px] text-slate-400 mt-1">&ldquo;{fu.note}&rdquo;</div>
                      </div>
                      <button
                        onClick={() => handleOpenCompleteFollowUp(fu, fu.lead_id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                      >
                        Enforce Completion Note
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── TAB 4: LIVE ACTIVITY AUDIT ── */}
      {activeTab === 'activity_logs' && (
        <main className="max-w-7xl mx-auto px-6 pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">Immutable CRM Audit Trail</h2>
              <p className="text-xs text-slate-400">Real-time log of every lead creation, stage transition, follow-up, and payment.</p>
            </div>
            <button
              onClick={handleExportActivityLogs}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="divide-y divide-slate-800/80">
              {activityLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">No activity logs recorded yet</div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log._id} className="p-4 hover:bg-slate-900/50 transition flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.admin_flag
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-xs text-white font-semibold">{log.userName}</span>
                        <span className="text-[10px] text-slate-500 uppercase">({log.role})</span>
                      </div>
                      <p className="text-xs text-slate-300">{log.details}</p>
                    </div>
                    <div className="text-[10px] text-slate-500 shrink-0 font-mono">
                      {new Date(log.timestamp || log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── TAB: REGISTERED USERS & PLATFORM SIGNUPS ── */}
      {activeTab === 'users' && (
        <main className="max-w-7xl mx-auto px-6 pt-6">
          {/* User Metrics Top Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#0f172a]/80 border border-slate-800 rounded-2xl p-4">
              <div className="text-slate-400 text-xs font-semibold">Total Accounts</div>
              <div className="text-2xl font-black text-white mt-1">{usersList.length}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Platform Registrations</div>
            </div>
            <div className="bg-[#0f172a]/80 border border-emerald-500/30 rounded-2xl p-4">
              <div className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Real Production Signups
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{usersList.filter(u => u.isRealData).length}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Verified organic accounts</div>
            </div>
            <div className="bg-[#0f172a]/80 border border-amber-500/30 rounded-2xl p-4">
              <div className="text-amber-400 text-xs font-semibold">Test / Mock Accounts</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{usersList.filter(u => u.isTestData).length}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Integration & demo tests</div>
            </div>
            <div className="bg-[#0f172a]/80 border border-indigo-500/30 rounded-2xl p-4">
              <div className="text-indigo-400 text-xs font-semibold">Company Organizations</div>
              <div className="text-2xl font-black text-indigo-400 mt-1">{usersList.filter(u => u.workStatus === 'company_owner' || u.isOrgOwner).length}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Agency / Org Owners</div>
            </div>
          </div>

          {/* User Filters Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, phone, code..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
              {/* Type Filter */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
                <button
                  onClick={() => setUserTypeFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${userTypeFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  All ({usersList.length})
                </button>
                <button
                  onClick={() => setUserTypeFilter('real')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${userTypeFilter === 'real' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-white'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Real Signups ({usersList.filter(u => u.isRealData).length})
                </button>
                <button
                  onClick={() => setUserTypeFilter('test')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${userTypeFilter === 'test' ? 'bg-amber-600 text-white' : 'text-amber-400 hover:text-white'}`}
                >
                  Test Data ({usersList.filter(u => u.isTestData).length})
                </button>
              </div>

              {/* Plan Filter */}
              <select
                value={userPlanFilter}
                onChange={(e) => setUserPlanFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Subscription Plans</option>
                <option value="free">Free Tier</option>
                <option value="starter">Starter Plan</option>
                <option value="growth">Growth Plan</option>
                <option value="pro">Pro Plan</option>
                <option value="enterprise">Enterprise Plan</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-[#0b1120] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
                    <th className="py-3.5 px-4">User Details</th>
                    <th className="py-3.5 px-4">Contact Info</th>
                    <th className="py-3.5 px-4">Industry / Vertical</th>
                    <th className="py-3.5 px-4">Account Mode</th>
                    <th className="py-3.5 px-4">Current Plan</th>
                    <th className="py-3.5 px-4">Leads</th>
                    <th className="py-3.5 px-4">Registered Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No registered users matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user._id} className="hover:bg-slate-900/50 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-md">
                              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{user.name || 'Unnamed User'}</span>
                                {user.isRealData ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    REAL USER
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    TEST
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">{user.usercode || user.username || user._id}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col text-slate-300">
                            <span>{user.email || '—'}</span>
                            <span className="text-[11px] text-slate-400">{user.phone || 'No phone'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-200">{user.industryType || 'Agency'}</span>
                            {user.educationSubProfile && (
                              <span className="text-[10px] text-indigo-400 font-medium capitalize">
                                {user.educationSubProfile.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            user.workStatus === 'company_owner' || user.isOrgOwner
                              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {user.workStatus === 'company_owner' || user.isOrgOwner ? '🏢 Organization Owner' : '👤 Single Agent'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={user.plan || 'free'}
                            onChange={(e) => handleAssignPlan(user._id, e.target.value)}
                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="free">Free</option>
                            <option value="starter">Starter</option>
                            <option value="growth">Growth</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-200">
                          {user.leadCount || 0}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleUserStatus(user._id)}
                              className={`p-1.5 rounded-lg border text-xs transition ${
                                user.isActive !== false
                                  ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                  : 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                              }`}
                              title={user.isActive !== false ? 'Active (Click to suspend)' : 'Suspended (Click to activate)'}
                            >
                              {user.isActive !== false ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                            {user.role !== 'superadmin' && user.email !== 'admin@crm.com' && (
                              <button
                                onClick={() => handleDeleteUser(user._id, user.name)}
                                className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* ── MODAL: CREATE LEAD (Strict 6 Fields) ── */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1">Add Lead (Standard 6 Services)</h3>
            <p className="text-xs text-slate-400 mb-4">Ingest lead directly into the pipeline with strict validation.</p>
            <form onSubmit={handleCreateLead} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Lead Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rohan Mehta"
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (E.164) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="rohan@example.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Corporation"
                    value={newLeadForm.company}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Service Required *</label>
                  <select
                    value={newLeadForm.service_required}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, service_required: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {Object.entries(SERVICE_CATALOG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly Spend (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={newLeadForm.monthly_spend}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, monthly_spend: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Goal Timeline</label>
                  <select
                    value={newLeadForm.goal_timeline}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, goal_timeline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {TIMELINE_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assign to Agent</label>
                  <select
                    value={newLeadForm.assignedTo}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, assignedTo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Unassigned Pool</option>
                    {agents.map((a) => (
                      <option key={a._id} value={a._id}>{a.name} ({a.usercode || 'Agent'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Requirement Notes</label>
                <textarea
                  rows={2}
                  placeholder="Requirement details..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30"
                >
                  {actionLoading ? 'Saving...' : 'Save & Schedule Follow-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT LEAD ── */}
      {showEditLeadModal && targetLead && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1">Edit Lead</h3>
            <p className="text-xs text-slate-400 mb-4">Editing is restricted strictly to basic form fields.</p>
            <form onSubmit={handleSaveEditLead} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={editLeadForm.name}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={editLeadForm.phone}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={editLeadForm.email}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company</label>
                  <input
                    type="text"
                    value={editLeadForm.company}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Service Required</label>
                  <select
                    value={editLeadForm.service_required}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, service_required: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {Object.entries(SERVICE_CATALOG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly Spend (₹)</label>
                  <input
                    type="number"
                    value={editLeadForm.monthly_spend}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, monthly_spend: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Goal Timeline</label>
                  <select
                    value={editLeadForm.goal_timeline}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, goal_timeline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {TIMELINE_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Agent</label>
                  <select
                    value={editLeadForm.assignedTo}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, assignedTo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="">Unassigned Pool</option>
                    {agents.map((a) => (
                      <option key={a._id} value={a._id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditLeadModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                >
                  {actionLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SCHEDULE FOLLOW-UP ── */}
      {showFollowUpModal && targetLead && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1">Schedule Follow-Up</h3>
            <p className="text-xs text-slate-400 mb-3">Set target date & mandatory note for {targetLead.name}.</p>
            
            {/* Quick Presets */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Quick Date & Time Presets</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(Date.now() + 15 * 60 * 1000);
                    setFollowUpForm(prev => ({ ...prev, scheduled_at: toLocalDatetimeString(d.toISOString()) }));
                  }}
                  className="py-1 px-2 rounded-lg bg-slate-900 hover:bg-indigo-950 text-indigo-300 border border-slate-800 text-[11px] font-medium transition"
                >
                  ⚡ +15 Mins
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(Date.now() + 60 * 60 * 1000);
                    setFollowUpForm(prev => ({ ...prev, scheduled_at: toLocalDatetimeString(d.toISOString()) }));
                  }}
                  className="py-1 px-2 rounded-lg bg-slate-900 hover:bg-indigo-950 text-indigo-300 border border-slate-800 text-[11px] font-medium transition"
                >
                  ⏳ +1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(10, 0, 0, 0);
                    setFollowUpForm(prev => ({ ...prev, scheduled_at: toLocalDatetimeString(d.toISOString()) }));
                  }}
                  className="py-1 px-2 rounded-lg bg-slate-900 hover:bg-indigo-950 text-indigo-300 border border-slate-800 text-[11px] font-medium transition"
                >
                  🌅 Tomorrow 10 AM
                </button>
              </div>
            </div>

            <form onSubmit={handleScheduleFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Scheduled Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={followUpForm.scheduled_at}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, scheduled_at: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Note *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Discuss custom CRM automation workflow and pricing discount"
                  value={followUpForm.note}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30"
                >
                  {actionLoading ? 'Scheduling...' : 'Save Follow-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: COMPLETE FOLLOW-UP FLOW (Mandatory Outcome Note) ── */}
      {showCompleteModal && targetFollowUp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Complete Follow-Up
            </h3>
            <p className="text-xs text-slate-400 mb-4">Enter a mandatory outcome note to resolve this follow-up.</p>
            
            {completeForm.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{completeForm.error}</span>
              </div>
            )}

            <form onSubmit={handleCompleteFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Outcome Note *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Call connected with decision maker. Sent commercial contract via email."
                  value={completeForm.note}
                  onChange={(e) => setCompleteForm({ note: e.target.value, error: '' })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30"
                >
                  {actionLoading ? 'Completing...' : 'Mark Done'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: POSTPONE FOLLOW-UP ── */}
      {showPostponeModal && targetFollowUp && (() => {
        const delaysUsed = targetFollowUp.delay_count ?? targetFollowUp.delayCount ?? 0;
        const isDelayBlocked = delaysUsed >= 2;

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b1120] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-white">Postpone Follow-Up</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDelayBlocked ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                  Delays: {delaysUsed} / 2 Used
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {isDelayBlocked 
                  ? 'Maximum 2 delays reached. You must add an outcome note to complete this follow-up.'
                  : 'A postpone remark is strictly required explaining the reason (Max 2 delays allowed).'
                }
              </p>

              {isDelayBlocked ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPostponeModal(false);
                      handleOpenCompleteFollowUp(targetFollowUp, targetLead);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                  >
                    Switch to Complete Follow-Up Form
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePostponeFollowUp} className="space-y-4">
                  {/* Quick Delay Presets */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Quick Delay Presets</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[15, 30, 45, 60].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            const d = new Date(Date.now() + m * 60 * 1000);
                            setPostponeForm(prev => ({
                              ...prev,
                              new_date: toLocalDatetimeString(d.toISOString()),
                              postpone_remark: `Delayed by ${m} minutes`,
                            }));
                          }}
                          className="py-1 px-1.5 rounded-lg bg-slate-900 hover:bg-amber-950 text-amber-300 border border-slate-800 text-[11px] font-medium transition text-center"
                        >
                          +{m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">New Postponed Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={postponeForm.new_date}
                      onChange={(e) => setPostponeForm({ ...postponeForm, new_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Postpone Remark *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="e.g. Client requested callback on Monday morning after travel"
                      value={postponeForm.postpone_remark}
                      onChange={(e) => setPostponeForm({ ...postponeForm, postpone_remark: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPostponeModal(false)}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/30"
                    >
                      {actionLoading ? 'Saving...' : 'Confirm Postpone'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: CONVERT DEAL WITH PLANS OR CUSTOM PRICING ── */}
      {showConvertModal && targetLead && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-purple-500/40 rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-400" />
              Convert Deal & Record Payment
            </h3>
            <p className="text-xs text-slate-400 mb-4">Select an authorized plan or enter a justified custom amount.</p>

            <form onSubmit={handleConvertDeal} className="space-y-4">
              {/* Plan Selection Cards */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Available Plans Catalog</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {canonicalPlans.slice(0, 6).map((plan) => (
                    <div
                      key={plan.code}
                      onClick={() => setConvertForm({ ...convertForm, plan_id: plan.code })}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        convertForm.plan_id === plan.code && !convertForm.custom_payment_amount
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/20'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs truncate">{plan.name}</div>
                      <div className="text-sm font-black text-purple-300 mt-1">₹{plan.price.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Payment Amount */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Custom Payment Amount (₹) <span className="text-[10px] text-slate-500 font-normal">(Optional Override)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter custom amount if different from plan"
                    value={convertForm.custom_payment_amount}
                    onChange={(e) => setConvertForm({ ...convertForm, custom_payment_amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {convertForm.custom_payment_amount && (
                  <div className="space-y-3 animate-fade-in">
                    {/* Live Warning Banner */}
                    <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <span>
                        <strong>Admin Review Triggered:</strong> Custom amount of ₹{Number(convertForm.custom_payment_amount).toLocaleString()} will be flagged to SuperAdmin in the audit logs & review queue.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-amber-300 mb-1">Justification Reason *</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Explain why custom price is offered (e.g. Multi-year enterprise prepayment discount)"
                        value={convertForm.custom_price_reason}
                        onChange={(e) => setConvertForm({ ...convertForm, custom_price_reason: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={convertForm.payment_method}
                    onChange={(e) => setConvertForm({ ...convertForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="upi">UPI / QR Payment</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash Receipt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Transaction ID / UTR</label>
                  <input
                    type="text"
                    required
                    value={convertForm.transaction_id}
                    onChange={(e) => setConvertForm({ ...convertForm, transaction_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="verifyPaymentCheck"
                  checked={convertForm.verify_payment}
                  onChange={(e) => setConvertForm({ ...convertForm, verify_payment: e.target.checked })}
                  className="rounded border-slate-700 text-purple-600 focus:ring-0"
                />
                <label htmlFor="verifyPaymentCheck" className="text-xs text-slate-300">
                  Verify and credit agent incentive commission immediately
                </label>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30"
                >
                  {actionLoading ? 'Converting...' : 'Confirm Conversion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ONBOARD AGENT ── */}
      {showAddAgentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1">Onboard Sales Agent</h3>
            <p className="text-xs text-slate-400 mb-4">Create agent account with designation & commission rate.</p>
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Agent Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={newAgentForm.name}
                  onChange={(e) => setNewAgentForm({ ...newAgentForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="vikram@agency.com"
                    value={newAgentForm.email}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="9876500000"
                    value={newAgentForm.phone}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
                  <select
                    value={newAgentForm.companyRole}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, companyRole: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="sales_rep">Sales Representative</option>
                    <option value="manager">Team Manager</option>
                    <option value="telecaller">Telecaller</option>
                    <option value="agent">General Agent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Commission %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newAgentForm.incentive_pct}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, incentive_pct: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={newAgentForm.password}
                  onChange={(e) => setNewAgentForm({ ...newAgentForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAgentModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30"
                >
                  {actionLoading ? 'Onboarding...' : 'Onboard Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REASSIGN LEADS ── */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1">Reassign Agent Portfolio</h3>
            <p className="text-xs text-slate-400 mb-4">Transfer all leads assigned to this agent to a new agent.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Transfer Leads To:</label>
                <select
                  value={reassignForm.toAgentId}
                  onChange={(e) => setReassignForm({ ...reassignForm, toAgentId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">Move to Unassigned Pool</option>
                  {agents.filter(a => a._id !== reassignForm.fromAgentId).map((a) => (
                    <option key={a._id} value={a._id}>{a.name} ({a.usercode || 'Agent'})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setActionLoading(true);
                      const res = await fetch(`${API_BASE}/admin/agents/reassign-leads`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify(reassignForm),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        showToast(data.message || 'Leads reassigned successfully', 'success');
                        setShowReassignModal(false);
                        loadAllData();
                      } else {
                        showToast(data.message || 'Failed to reassign', 'error');
                      }
                    } catch (e) {
                      showToast('Reassign failed', 'error');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                >
                  {actionLoading ? 'Transferring...' : 'Transfer Leads'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SLIDE-OVER DRAWER: LEAD DETAILS ── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="bg-[#0b1120] border-l border-slate-800 w-full max-w-lg h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-lg text-white">{selectedLead.name}</h3>
                    {selectedLead.isRealData ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        REAL PRODUCTION SIGNUP
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        TEST / MOCK DATA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{selectedLead.phone} {selectedLead.email ? `• ${selectedLead.email}` : ''}</p>
                  {selectedLead.company && <p className="text-xs text-indigo-300 mt-0.5">🏢 {selectedLead.company}</p>}
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stage & Details Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Lifecycle Stage</span>
                  <div className="mt-1">
                    <select
                      value={selectedLead.status}
                      onChange={(e) => {
                        handleStageChange(selectedLead._id, e.target.value);
                        setSelectedLead({ ...selectedLead, status: e.target.value });
                      }}
                      className="w-full text-xs bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      {KANBAN_STAGES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Assigned Agent</span>
                  <p className="text-xs font-semibold text-white mt-1.5">
                    {selectedLead.assignedTo?.name || 'Unassigned Pool'}
                  </p>
                </div>
              </div>

              {/* Requirement & Source */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Industry / Service:</span>
                  <span className="font-bold text-indigo-300">{selectedLead.propertyType || selectedLead.service_required || 'Standard'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Lead Source:</span>
                  <span className="font-semibold text-slate-200 uppercase">{selectedLead.source || 'Platform Signup'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Registered On:</span>
                  <span className="text-slate-300 font-mono">{new Date(selectedLead.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Quick Communication Actions */}
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${selectedLead.phone}`}
                  className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </a>
                <button
                  onClick={() => handleWhatsAppAction(selectedLead)}
                  className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
                <button
                  onClick={() => {
                    handleOpenConvert(selectedLead);
                  }}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30 transition"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Convert
                </button>
              </div>

              {/* Activity Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Lead History & Activities</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(!selectedLead.leadActivities || selectedLead.leadActivities.length === 0) ? (
                    <div className="text-[11px] text-slate-500 py-3 text-center border border-dashed border-slate-800 rounded-xl">
                      No activity logs recorded yet.
                    </div>
                  ) : (
                    selectedLead.leadActivities.slice().reverse().map((act, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-xl text-xs space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-indigo-300 uppercase">{act.action?.replace(/_/g, ' ')}</span>
                          <span className="text-slate-500 font-mono">{new Date(act.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{act.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedLead(null);
                  handleOpenEditLead(selectedLead);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit Info
              </button>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
