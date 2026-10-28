'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { cachedGet, getCachedData } from '@/lib/api';
import { pipelineOptions } from '@/lib/queries';
import { waLink, getUser, hasPermission, canAccessRoute } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  TrendingUp, Search, Phone, MessageSquare, Plus, RefreshCw,
  Layers, ArrowRight, CheckCircle2, ChevronRight, LayoutGrid,
  Calendar, Check, Filter, Sparkles, IndianRupee, Percent, PieChart,
  Settings, Sliders, Trash2, ArrowUp, ArrowDown, Copy, X as CloseIcon,
  AlertTriangle, ShieldCheck
} from 'lucide-react';
import { SourcePill } from '@/lib/sourceHelper';
import dynamic from 'next/dynamic';
import { STAGE_LABELS, STATUS_COLORS } from '@/components/LeadModals';
import { formatDisplayDateTime } from '@/lib/dateUtils';

const AddLeadModal = dynamic(() => import('@/components/LeadModals').then(m => m.AddLeadModal), { ssr: false });

function PipelineContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab') || 'kanban';

  const [user, setUser] = useState(null);

  // Frame-0 Cache Initialization: instant render on tab switch from TanStack Query / API cache
  const initialData = queryClient?.getQueryData ? queryClient.getQueryData(pipelineOptions().queryKey) : null;
  const [leads, setLeads] = useState(() => {
    if (initialData?.leads?.length > 0) return initialData.leads;
    const cached = getCachedData('/leads?limit=250') || getCachedData('/leads', { limit: 250 });
    return cached?.leads || [];
  });
  const [pipelines, setPipelines] = useState(() => {
    if (initialData?.pipelines?.length > 0) return initialData.pipelines;
    const cached = getCachedData('/pipelines');
    return Array.isArray(cached?.data) ? cached.data : [];
  });
  const [activePipeline, setActivePipeline] = useState(() => {
    const pList = initialData?.pipelines || (Array.isArray(getCachedData('/pipelines')?.data) ? getCachedData('/pipelines').data : []);
    return pList.find(p => p.isDefault) || pList[0] || null;
  });
  const [loading, setLoading] = useState(() => {
    if (initialData?.leads?.length > 0) return false;
    const cached = getCachedData('/leads?limit=250') || getCachedData('/leads', { limit: 250 });
    return !cached || !cached.leads || cached.leads.length === 0;
  });
  const [search, setSearch] = useState('');
  const [activeStageId, setActiveStageId] = useState('contacted');
  const [viewMode, setViewMode] = useState(rawTab === 'team_pipeline' ? 'stage' : rawTab === 'forecast' ? 'forecast' : 'board');
  const [showAddModal, setShowAddModal] = useState(false);

  // Pipeline Management Modals
  const [showCreatePipelineModal, setShowCreatePipelineModal] = useState(false);
  const [showPipelineSettingsModal, setShowPipelineSettingsModal] = useState(false);
  const [showRemapModal, setShowRemapModal] = useState(false);
  const [stageToDelete, setStageToDelete] = useState(null);
  const [remapTargetStageId, setRemapTargetStageId] = useState('');

  // New Pipeline Form
  const [newPipelineForm, setNewPipelineForm] = useState({
    name: '',
    description: '',
    isDefault: false,
    template: 'undergraduate',
  });
  const [savingPipeline, setSavingPipeline] = useState(false);

  // Pipeline Settings Form (Stages editor)
  const [pipelineSettingsForm, setPipelineSettingsForm] = useState({
    name: '',
    description: '',
    isDefault: false,
    stages: [],
  });

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'team_pipeline') setViewMode('stage');
    else if (tabParam === 'forecast') setViewMode('forecast');
    else if (tabParam === 'kanban') setViewMode('board');
  }, [searchParams]);

  useEffect(() => {
    const checkAuth = () => {
      const u = getUser();
      if (!u) {
        router.replace('/login');
        return;
      }
      if (!canAccessRoute(u, '/pipeline')) {
        router.replace('/leads');
        return;
      }
      setUser(u);
    };

    checkAuth();
    window.addEventListener('user-updated', checkAuth);
    return () => window.removeEventListener('user-updated', checkAuth);
  }, [router]);

  const {
    data: pipelineQueryData,
    isLoading: isPipelineLoading,
    refetch: refetchPipeline,
  } = useQuery(pipelineOptions());

  useEffect(() => {
    if (pipelineQueryData) {
      if (Array.isArray(pipelineQueryData.leads)) {
        setLeads(pipelineQueryData.leads);
      }
      if (Array.isArray(pipelineQueryData.pipelines) && pipelineQueryData.pipelines.length > 0) {
        setPipelines(pipelineQueryData.pipelines);
        setActivePipeline(prev => {
          if (!prev) return pipelineQueryData.pipelines.find(p => p.isDefault) || pipelineQueryData.pipelines[0];
          const found = pipelineQueryData.pipelines.find(p => String(p._id) === String(prev._id));
          return found || pipelineQueryData.pipelines[0];
        });
      }
      setLoading(false);
    }
  }, [pipelineQueryData]);

  const fetchPipelineData = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  }, [queryClient]);

  // Sync settings form when active pipeline changes
  useEffect(() => {
    if (activePipeline) {
      setPipelineSettingsForm({
        name: activePipeline.name || '',
        description: activePipeline.description || '',
        isDefault: !!activePipeline.isDefault,
        stages: (activePipeline.stages || []).map((s, idx) => ({
          stageId: s.stageId || `stage_${idx}`,
          name: s.name,
          category: s.category || 'open',
          order: s.order ?? idx,
          probability: s.probability ?? 50,
          colorCode: s.colorCode || '#6366f1',
          slaHours: s.slaHours || 24,
        })),
      });
    }
  }, [activePipeline]);

  const handleStageChange = async (leadId, newStage) => {
    // Optimistic UI update
    const previousLeads = [...leads];
    setLeads(prev => prev.map(l => (String(l._id) === String(leadId) ? { ...l, pipeline_stage: newStage, status: newStage } : l)));
    try {
      await api.put(`/leads/${leadId}`, {
        pipelineId: activePipeline?._id,
        pipeline_stage: newStage,
        status: newStage,
      });
      toast.success(`Candidate moved to ${STAGE_LABELS[newStage] || newStage}`);
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (err) {
      // Rollback on error
      setLeads(previousLeads);
      toast.error(err.response?.data?.message || 'Failed to update stage');
    }
  };

  const stages = (activePipeline?.stages && activePipeline.stages.length > 0)
    ? activePipeline.stages.map(s => ({
        id: s.stageId || s._id,
        name: s.name,
        color: s.colorCode || '#6366f1',
        icon: s.category === 'won' ? CheckCircle2 : Layers,
        probability: s.probability ?? 50,
        category: s.category || 'open',
      }))
    : [
        { id: 'new_lead', name: 'Lead Received', color: '#6366f1', icon: Sparkles, probability: 15, category: 'open' },
        { id: 'contacted', name: 'Tele-Counselling', color: '#0ea5e9', icon: Phone, probability: 30, category: 'open' },
        { id: 'shortlisted', name: 'Colleges Shortlisted', color: '#8b5cf6', icon: Layers, probability: 50, category: 'open' },
        { id: 'site_visit_scheduled', name: 'Campus Visit Arranged', color: '#f59e0b', icon: Calendar, probability: 70, category: 'open' },
        { id: 'negotiation', name: 'Quota & Seat Booking', color: '#ec4899', icon: IndianRupee, probability: 85, category: 'open' },
        { id: 'converted', name: 'Admission Confirmed', color: '#10b981', icon: CheckCircle2, probability: 100, category: 'won' },
      ];

  const getStageLeads = (stageId) => {
    return leads.filter(l => {
      // First check matching pipeline if set
      if (activePipeline && l.pipelineId && String(l.pipelineId) !== String(activePipeline._id)) {
        return false;
      }

      let matchesStage = false;
      if (l.pipeline_stage === stageId) {
        matchesStage = true;
      } else if (stageId === 'new_lead') {
        matchesStage = l.status === 'new_lead' || l.status === 'new' || l.status === 'Lead Received' || !l.status;
      } else if (stageId === 'contacted') {
        matchesStage = l.status === 'contacted' || l.status === 'Tele-Counselling / Discovery';
      } else if (stageId === 'shortlisted') {
        matchesStage = l.status === 'shortlisted' || l.status === 'College Options Shortlisted' || l.status === 'Budget & Merit Evaluation';
      } else if (stageId === 'site_visit_scheduled') {
        matchesStage = l.status === 'site_visit_scheduled' || l.status === 'Direct Campus Visit Arranged' || l.status === 'campus_visit';
      } else if (stageId === 'negotiation') {
        matchesStage = l.status === 'negotiation' || l.status === 'Seat Block / Token Advance' || l.status === 'Management / Merit Quota Filing' || l.status === 'Offer Letter & Fee Submission';
      } else if (stageId === 'converted') {
        matchesStage = l.status === 'converted' || l.status === 'closed' || l.status === 'payment_done' || l.status === 'Admission Finalized & Invoiced';
      } else {
        matchesStage = l.status === stageId;
      }

      if (!matchesStage) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.targetCourse && l.targetCourse.toLowerCase().includes(q)) ||
        (l.targetStream && l.targetStream.toLowerCase().includes(q))
      );
    });
  };

  const activeStage = stages.find(s => s.id === activeStageId) || stages[0];
  const activeLeads = getStageLeads(activeStageId);

  const formatINR = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  // Forecast Calculations
  const forecastBreakdown = stages.map(st => {
    const stageLeads = getStageLeads(st.id);
    const totalVal = stageLeads.reduce((sum, l) => sum + (Number(l.budget) || 0), 0);
    const weightedVal = (totalVal * st.probability) / 100;
    return {
      ...st,
      count: stageLeads.length,
      totalVal,
      weightedVal,
    };
  });

  const grandTotalValue = forecastBreakdown.reduce((sum, f) => sum + f.totalVal, 0);
  const grandWeightedValue = forecastBreakdown.reduce((sum, f) => sum + f.weightedVal, 0);

  // Create New Pipeline Handler
  const handleCreatePipeline = async (e) => {
    e.preventDefault();
    if (!newPipelineForm.name || !newPipelineForm.name.trim()) {
      toast.error('Pipeline name is required');
      return;
    }

    setSavingPipeline(true);
    try {
      let initialStages = [];
      if (newPipelineForm.template === 'study_abroad') {
        initialStages = [
          { stageId: 'lead_inquiry', name: 'Country & Course Inquiry', category: 'open', order: 0, probability: 15, colorCode: '#6366f1' },
          { stageId: 'profile_evaluation', name: 'IELTS / GRE Profile Evaluation', category: 'open', order: 1, probability: 30, colorCode: '#0ea5e9' },
          { stageId: 'university_application', name: 'University SOP & Filing', category: 'open', order: 2, probability: 55, colorCode: '#8b5cf6' },
          { stageId: 'offer_received', name: 'Offer Letter / I-20 Issued', category: 'open', order: 3, probability: 75, colorCode: '#f59e0b' },
          { stageId: 'visa_filing', name: 'Embassy Visa Interview Filing', category: 'open', order: 4, probability: 90, colorCode: '#ec4899' },
          { stageId: 'enrolled', name: 'Visa Approved & Enrolled', category: 'won', order: 5, probability: 100, colorCode: '#10b981' },
        ];
      } else {
        initialStages = [
          { stageId: 'inquiry', name: 'Candidate Enquiry', category: 'open', order: 0, probability: 20, colorCode: '#6366f1' },
          { stageId: 'counselling', name: 'Tele-Counselling Call', category: 'open', order: 1, probability: 40, colorCode: '#0ea5e9' },
          { stageId: 'college_shortlist', name: 'Colleges Shortlisted', category: 'open', order: 2, probability: 60, colorCode: '#8b5cf6' },
          { stageId: 'seat_booked', name: 'Token Advance / Seat Block', category: 'open', order: 3, probability: 80, colorCode: '#f59e0b' },
          { stageId: 'admitted', name: 'Admission Confirmed & Invoiced', category: 'won', order: 4, probability: 100, colorCode: '#10b981' },
          { stageId: 'lost', name: 'Dropped / Other College', category: 'lost', order: 5, probability: 0, colorCode: '#ef4444' },
        ];
      }

      const res = await api.post('/pipelines', {
        name: newPipelineForm.name.trim(),
        description: newPipelineForm.description?.trim(),
        isDefault: newPipelineForm.isDefault,
        stages: initialStages,
      });

      toast.success(`Pipeline "${res.data?.data?.name}" created successfully!`);
      setShowCreatePipelineModal(false);
      setNewPipelineForm({ name: '', description: '', isDefault: false, template: 'undergraduate' });
      await fetchPipelineData();
      if (res.data?.data) setActivePipeline(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create pipeline');
    } finally {
      setSavingPipeline(false);
    }
  };

  // Save Pipeline Stages & Properties Handler
  const handleSavePipelineSettings = async (e) => {
    e.preventDefault();
    if (!activePipeline) return;

    setSavingPipeline(true);
    try {
      await api.put(`/pipelines/${activePipeline._id}`, {
        name: pipelineSettingsForm.name.trim(),
        description: pipelineSettingsForm.description?.trim(),
        isDefault: pipelineSettingsForm.isDefault,
        stages: pipelineSettingsForm.stages,
      });

      toast.success('Pipeline configuration and stages updated!');
      setShowPipelineSettingsModal(false);
      fetchPipelineData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update pipeline');
    } finally {
      setSavingPipeline(false);
    }
  };

  // Reorder Stages
  const moveStage = (index, direction) => {
    setPipelineSettingsForm(prev => {
      const copy = [...prev.stages];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return {
        ...prev,
        stages: copy.map((st, i) => ({ ...st, order: i })),
      };
    });
  };

  // Add new stage to form
  const handleAddStageToForm = () => {
    setPipelineSettingsForm(prev => {
      const newOrder = prev.stages.length;
      return {
        ...prev,
        stages: [
          ...prev.stages,
          {
            stageId: `stage_${Date.now()}`,
            name: `New Stage ${newOrder + 1}`,
            category: 'open',
            order: newOrder,
            probability: 50,
            colorCode: '#6366f1',
            slaHours: 24,
          },
        ],
      };
    });
  };

  // Request Stage Removal (Checks if leads exist)
  const handleRequestRemoveStage = (stage) => {
    const stageLeadsCount = getStageLeads(stage.stageId || stage.id).length;
    if (stageLeadsCount > 0) {
      setStageToDelete(stage);
      setRemapTargetStageId('');
      setShowRemapModal(true);
    } else {
      setPipelineSettingsForm(prev => ({
        ...prev,
        stages: prev.stages.filter(s => (s.stageId || s.id) !== (stage.stageId || stage.id)),
      }));
      toast.success('Stage removed from pipeline form');
    }
  };

  // Execute Stage Lead Remap & Removal
  const handleExecuteRemapAndRemove = async () => {
    if (!remapTargetStageId) {
      toast.error('Please select target stage to remap leads');
      return;
    }

    try {
      await api.post(`/pipelines/${activePipeline._id}/remap-stage`, {
        fromStageId: stageToDelete.stageId || stageToDelete.id,
        toStageId: remapTargetStageId,
      });

      toast.success('Leads successfully remapped to new stage');
      setPipelineSettingsForm(prev => ({
        ...prev,
        stages: prev.stages.filter(s => (s.stageId || s.id) !== (stageToDelete.stageId || stageToDelete.id)),
      }));
      setShowRemapModal(false);
      setStageToDelete(null);
      fetchPipelineData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remap stage leads');
    }
  };

  // Duplicate Pipeline
  const handleDuplicatePipeline = async () => {
    if (!activePipeline) return;
    try {
      const res = await api.post('/pipelines', {
        name: `${activePipeline.name} (Copy)`,
        description: activePipeline.description,
        isDefault: false,
        stages: activePipeline.stages,
      });
      toast.success('Pipeline duplicated successfully');
      setShowPipelineSettingsModal(false);
      await fetchPipelineData();
      if (res.data?.data) setActivePipeline(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to duplicate pipeline');
    }
  };

  // Delete Pipeline
  const handleDeletePipeline = async () => {
    if (!activePipeline) return;
    if (pipelines.length <= 1) {
      toast.error('Cannot delete the only pipeline in the workspace');
      return;
    }

    const leadsInPipeline = leads.filter(l => String(l.pipelineId) === String(activePipeline._id)).length;
    let reassignId = null;
    if (leadsInPipeline > 0) {
      const other = pipelines.find(p => String(p._id) !== String(activePipeline._id));
      reassignId = prompt(`This pipeline has ${leadsInPipeline} leads. Enter target pipeline ID to migrate them to:`, other?._id);
      if (!reassignId) return;
    }

    if (!confirm(`Are you sure you want to archive/delete pipeline "${activePipeline.name}"?`)) return;

    try {
      await api.delete(`/pipelines/${activePipeline._id}`, {
        data: { reassignPipelineId: reassignId },
      });
      toast.success('Pipeline archived');
      setShowPipelineSettingsModal(false);
      fetchPipelineData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete pipeline');
    }
  };

  return (
    <div className="app-container">
      <BottomNav active="pipeline" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header Top Row: Title, Switcher & Primary Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5">
                  <TrendingUp size={24} className="text-indigo-600 shrink-0" /> Admission Pipeline
                </h1>

                {/* Pipeline Switcher */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <select
                    value={activePipeline?._id || ''}
                    onChange={e => {
                      const sel = pipelines.find(p => String(p._id) === String(e.target.value));
                      if (sel) setActivePipeline(sel);
                    }}
                    className="text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-lg px-2.5 py-1 outline-none cursor-pointer hover:bg-indigo-50 transition"
                    aria-label="Select Pipeline"
                  >
                    {pipelines.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.name} {p.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>

                  {hasPermission(user, 'pipelines.manage') && (
                    <button
                      type="button"
                      onClick={() => setShowPipelineSettingsModal(true)}
                      className="p-1 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white transition"
                      title="Configure Pipeline & Stages"
                    >
                      <Settings size={15} />
                    </button>
                  )}

                  {hasPermission(user, 'pipelines.manage') && (
                    <button
                      type="button"
                      onClick={() => setShowCreatePipelineModal(true)}
                      className="p-1 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-white transition"
                      title="Create New Pipeline"
                    >
                      <Plus size={15} />
                    </button>
                  )}
                </div>
              </div>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Track candidate progression across admission counselling stages, Kanban boards, and weighted fee forecasts.
              </p>
            </div>

            {/* Top Right Primary Action Buttons */}
            <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
              {hasPermission(user, 'leads.create') && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 shadow-sm px-3.5 py-2"
                >
                  <Plus size={15} /> <span>Add Lead</span>
                </button>
              )}

              <button
                type="button"
                onClick={fetchPipelineData}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-semibold shrink-0 px-3 py-2"
                title="Refresh Pipeline"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Controls Sub-Bar: View Switcher (Left) & Pipeline Filter (Right) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-5 border-b border-slate-200">
            {/* View Switcher */}
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
              <button
                type="button"
                onClick={() => {
                  setViewMode('board');
                  router.push('/pipeline?tab=kanban');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('stage');
                  router.push('/pipeline?tab=team_pipeline');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'stage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Stage View
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('forecast');
                  router.push('/pipeline?tab=forecast');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'forecast' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Forecast
              </button>
            </div>

            {/* Pipeline Search Input */}
            <div className="relative w-full sm:w-72 shrink-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                className="input input-search w-full text-xs sm:text-sm pl-10 pr-8 h-9 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 transition"
                placeholder="Filter pipeline leads..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                  title="Clear filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* TOP STAGE KPI CARDS - Responsive horizontal scroll on mobile, grid on desktop */}
          <div className="flex lg:grid lg:grid-cols-6 overflow-x-auto no-scrollbar gap-2.5 sm:gap-3 mb-5 pb-1">
            {stages.map(stage => {
              const stageLeads = getStageLeads(stage.id);
              const totalValue = stageLeads.reduce((acc, curr) => acc + (Number(curr.budget) || 0), 0);

              return (
                <div
                  key={stage.id}
                  onClick={() => {
                    setActiveStageId(stage.id);
                    if (viewMode === 'forecast') setViewMode('stage');
                  }}
                  className={`bg-white rounded-2xl p-3 cursor-pointer transition hover:shadow-sm shrink-0 w-[138px] sm:w-[155px] lg:w-auto border ${
                    activeStageId === stage.id && viewMode === 'stage'
                      ? 'border-indigo-600 ring-2 ring-indigo-50 shadow-sm'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: stage.color,
                        background: `${stage.color}18`,
                        padding: '2px 6px',
                        borderRadius: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {stage.probability}% win
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div
                    className="text-[11px] sm:text-xs font-bold text-slate-800 line-clamp-1 mb-1"
                    title={stage.name}
                  >
                    {stage.name}
                  </div>

                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 truncate">
                    {formatINR(totalValue)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* VIEW 1: KANBAN BOARD */}
          {/* ───────────────────────────────────────────────────────────── */}
          {viewMode === 'board' && (
            <div className="kanban-board-container" style={{ minHeight: '62vh' }}>
              {stages.map(stage => {
                const stageLeads = getStageLeads(stage.id);

                return (
                  <div
                    key={stage.id}
                    className="kanban-column"
                    style={{
                      background: 'var(--card-subtle, #f8fafc)',
                      borderRadius: 16,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: 'calc(100vh - 280px)',
                    }}
                  >
                    {/* Column Header */}
                    <div
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--card)',
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: stage.color,
                            display: 'inline-block'
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                          {stage.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'var(--border)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          color: 'var(--text-muted)'
                        }}
                      >
                        {stageLeads.length}
                      </span>
                    </div>

                    {/* Column Body: Leads Cards */}
                    <div
                      style={{
                        padding: 12,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        flex: 1
                      }}
                    >
                      {stageLeads.length === 0 ? (
                        <div
                          style={{
                            padding: '30px 10px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: 12
                          }}
                        >
                          No candidate leads in this stage
                        </div>
                      ) : (
                        stageLeads.map(lead => (
                          <div
                            key={lead._id}
                            style={{
                              background: 'var(--card)',
                              border: '1px solid var(--border)',
                              borderRadius: 12,
                              padding: 12,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                            }}
                            className="hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <Link
                                href={`/leads/${lead._id}`}
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'var(--text)',
                                  textDecoration: 'none'
                                }}
                                className="hover:text-indigo-600 line-clamp-1"
                              >
                                {lead.name || 'Unnamed Candidate'}
                              </Link>
                              {lead.budget && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
                                  {formatINR(lead.budget)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                              <span>{lead.targetCourse || lead.courseInterest || 'Course TBD'}</span>
                              {lead.targetStream && (
                                <>
                                  <span>•</span>
                                  <span>{lead.targetStream}</span>
                                </>
                              )}
                            </div>

                            {/* Stage Selector on Card for Touch & Keyboard */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                              <select
                                value={lead.pipeline_stage || lead.status || stage.id}
                                onChange={e => handleStageChange(lead._id, e.target.value)}
                                className="text-[11px] font-semibold rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none text-slate-700 cursor-pointer"
                              >
                                {stages.map(st => (
                                  <option key={st.id} value={st.id}>{st.name}</option>
                                ))}
                              </select>

                              <div className="flex items-center gap-1">
                                {lead.phone && (
                                  <a
                                    href={waLink(lead.phone, `Hello ${lead.name}, regarding your admission enquiry`)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                                    title="WhatsApp Chat"
                                  >
                                    <MessageSquare size={13} />
                                  </a>
                                )}
                                {lead.phone && (
                                  <a
                                    href={`tel:${lead.phone}`}
                                    className="p-1 rounded text-blue-600 hover:bg-blue-50"
                                    title="Call Student"
                                  >
                                    <Phone size={13} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* VIEW 2: STAGE LIST VIEW (MOBILE & ACCESSIBLE) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {viewMode === 'stage' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: activeStage.color }} />
                  <h3 className="text-sm font-bold text-slate-900 m-0">
                    {activeStage.name} ({activeLeads.length} Candidates)
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-bold">
                  {formatINR(activeLeads.reduce((s, l) => s + (Number(l.budget) || 0), 0))} Value
                </span>
              </div>

              {activeLeads.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No candidate leads currently in "{activeStage.name}".
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeLeads.map(lead => (
                    <div key={lead._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link href={`/leads/${lead._id}`} className="font-bold text-slate-900 text-sm hover:text-indigo-600">
                            {lead.name}
                          </Link>
                          {lead.budget && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">
                              {formatINR(lead.budget)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span>{lead.phone || 'No phone'}</span>
                          <span>•</span>
                          <span>{lead.targetCourse || 'Course TBD'}</span>
                          <span>•</span>
                          <span>Source: {lead.source || 'Direct'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <select
                          value={lead.pipeline_stage || lead.status || activeStage.id}
                          onChange={e => handleStageChange(lead._id, e.target.value)}
                          className="text-xs font-bold rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none text-slate-800"
                        >
                          {stages.map(st => (
                            <option key={st.id} value={st.id}>Move: {st.name}</option>
                          ))}
                        </select>

                        <Link
                          href={`/leads/${lead._id}`}
                          className="btn btn-outline text-xs px-3 py-1.5 flex items-center gap-1"
                        >
                          <span>Profile</span>
                          <ChevronRight size={13} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* VIEW 3: FORECAST VIEW */}
          {/* ───────────────────────────────────────────────────────────── */}
          {viewMode === 'forecast' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Pipeline Value</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {formatINR(grandTotalValue)}
                  </div>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">Sum of all tuition budgets across pipeline stages</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl border border-indigo-200 p-5 shadow-sm">
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Probability-Weighted Revenue</span>
                  <div className="text-2xl font-black text-indigo-950 mt-1">
                    {formatINR(grandWeightedValue)}
                  </div>
                  <p className="text-xs text-indigo-800 m-0 mt-0.5">Expected real revenue based on stage conversion probabilities</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 m-0">Stage-by-Stage Probability Forecast</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Stage</th>
                        <th className="py-3 px-4">Candidates</th>
                        <th className="py-3 px-4">Win Probability</th>
                        <th className="py-3 px-4">Nominal Value</th>
                        <th className="py-3 px-4 text-right">Weighted Forecast</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {forecastBreakdown.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color }} />
                            <span>{f.name}</span>
                          </td>
                          <td className="py-3 px-4">{f.count} leads</td>
                          <td className="py-3 px-4 font-bold text-indigo-600">{f.probability}%</td>
                          <td className="py-3 px-4 text-slate-600">{formatINR(f.totalVal)}</td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900">{formatINR(f.weightedVal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: CREATE NEW PIPELINE */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCreatePipelineModal && (
        <div
          className="fixed inset-0 z-[9600] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowCreatePipelineModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">Create New Pipeline</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePipelineModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <form onSubmit={handleCreatePipeline} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pipeline Name *
                </label>
                <input
                  type="text"
                  required
                  value={newPipelineForm.name}
                  onChange={e => setNewPipelineForm({ ...newPipelineForm, name: e.target.value })}
                  placeholder="e.g. Study Abroad & Visas 2026"
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newPipelineForm.description}
                  onChange={e => setNewPipelineForm({ ...newPipelineForm, description: e.target.value })}
                  placeholder="e.g. Tracks international university applications and visa filing"
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Stage Template
                </label>
                <select
                  value={newPipelineForm.template}
                  onChange={e => setNewPipelineForm({ ...newPipelineForm, template: e.target.value })}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                >
                  <option value="undergraduate">Standard Admission (Inquiry → Counselling → Admitted)</option>
                  <option value="study_abroad">Study Abroad & Visa (Country Selection → Filing → Visa)</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPipelineForm.isDefault}
                  onChange={e => setNewPipelineForm({ ...newPipelineForm, isDefault: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800">Set as Workspace Default Pipeline</span>
              </label>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePipelineModal(false)}
                  className="btn btn-outline text-xs px-4 py-2"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingPipeline}
                  className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2"
                >
                  {savingPipeline && <RefreshCw size={13} className="animate-spin" />}
                  <span>{savingPipeline ? 'Creating...' : 'Create Pipeline'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: PIPELINE & STAGE SETTINGS MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showPipelineSettingsModal && (
        <div
          className="fixed inset-0 z-[9600] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowPipelineSettingsModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-5 sm:p-6 animate-scale-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-indigo-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                  Configure Pipeline: {activePipeline?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPipelineSettingsModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <form onSubmit={handleSavePipelineSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pipeline Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={pipelineSettingsForm.name}
                    onChange={e => setPipelineSettingsForm({ ...pipelineSettingsForm, name: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={pipelineSettingsForm.description}
                    onChange={e => setPipelineSettingsForm({ ...pipelineSettingsForm, description: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pipelineSettingsForm.isDefault}
                    onChange={e => setPipelineSettingsForm({ ...pipelineSettingsForm, isDefault: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Set as Default Pipeline</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDuplicatePipeline}
                    className="btn btn-outline text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    <Copy size={13} />
                    <span>Duplicate</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeletePipeline}
                    className="btn text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    <span>Delete Pipeline</span>
                  </button>
                </div>
              </div>

              {/* Stages List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Pipeline Stages ({pipelineSettingsForm.stages.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStageToForm}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Add Stage</span>
                  </button>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {pipelineSettingsForm.stages.map((st, idx) => (
                    <div
                      key={st.stageId || idx}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-bold text-slate-400 w-5 text-center">
                          {idx + 1}
                        </span>

                        <input
                          type="color"
                          value={st.colorCode || '#6366f1'}
                          onChange={e => {
                            const val = e.target.value;
                            setPipelineSettingsForm(prev => {
                              const copy = [...prev.stages];
                              copy[idx] = { ...copy[idx], colorCode: val };
                              return { ...prev, stages: copy };
                            });
                          }}
                          className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                          title="Stage Color"
                        />

                        <input
                          type="text"
                          required
                          value={st.name}
                          onChange={e => {
                            const val = e.target.value;
                            setPipelineSettingsForm(prev => {
                              const copy = [...prev.stages];
                              copy[idx] = { ...copy[idx], name: val };
                              return { ...prev, stages: copy };
                            });
                          }}
                          placeholder="Stage Name"
                          className="text-xs font-bold rounded-lg border border-slate-200 px-2 py-1 flex-1 outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <select
                          value={st.category || 'open'}
                          onChange={e => {
                            const val = e.target.value;
                            setPipelineSettingsForm(prev => {
                              const copy = [...prev.stages];
                              copy[idx] = { ...copy[idx], category: val };
                              return { ...prev, stages: copy };
                            });
                          }}
                          className="text-xs font-semibold rounded-lg border border-slate-200 px-2 py-1 outline-none text-slate-700"
                        >
                          <option value="open">Open</option>
                          <option value="won">Won (Admitted)</option>
                          <option value="lost">Lost</option>
                        </select>

                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={st.probability ?? 50}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setPipelineSettingsForm(prev => {
                                const copy = [...prev.stages];
                                copy[idx] = { ...copy[idx], probability: val };
                                return { ...prev, stages: copy };
                              });
                            }}
                            className="w-12 text-xs font-bold text-center rounded-lg border border-slate-200 py-1 outline-none"
                            title="Win Probability %"
                          />
                          <span className="text-[10px] text-slate-400">%</span>
                        </div>

                        {/* Move Up / Down */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveStage(idx, -1)}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === pipelineSettingsForm.stages.length - 1}
                            onClick={() => moveStage(idx, 1)}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        {/* Remove Stage */}
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveStage(st)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Remove Stage"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPipelineSettingsModal(false)}
                  className="btn btn-outline text-xs px-4 py-2"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingPipeline}
                  className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2"
                >
                  {savingPipeline && <RefreshCw size={13} className="animate-spin" />}
                  <span>{savingPipeline ? 'Saving...' : 'Save Pipeline & Stages'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: STAGE LEAD REMAPPING DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showRemapModal && stageToDelete && (
        <div
          className="fixed inset-0 z-[9700] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowRemapModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-amber-600 mb-3">
              <AlertTriangle size={24} />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                Safe Lead Stage Remapping Required
              </h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Stage <strong>"{stageToDelete.name}"</strong> currently contains active candidate leads. To protect data integrity, select a destination stage to remap these leads before removing this stage.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination Stage *
                </label>
                <select
                  value={remapTargetStageId}
                  onChange={e => setRemapTargetStageId(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                >
                  <option value="">Select target stage...</option>
                  {pipelineSettingsForm.stages
                    .filter(s => (s.stageId || s.id) !== (stageToDelete.stageId || stageToDelete.id))
                    .map(st => (
                      <option key={st.stageId || st.id} value={st.stageId || st.id}>
                        {st.name} ({st.category})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRemapModal(false)}
                  className="btn btn-outline text-xs px-4 py-2"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteRemapAndRemove}
                  className="btn btn-primary text-xs px-5 py-2"
                >
                  Remap Leads & Remove Stage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchPipelineData();
          }}
        />
      )}

    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-500" size={24} />
        <p className="text-xs">Loading admission pipeline...</p>
      </div>
    }>
      <PipelineContent />
    </Suspense>
  );
}
