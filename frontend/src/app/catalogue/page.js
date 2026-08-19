'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import {
  GraduationCap, Search, Plus, Building2, MapPin, Globe,
  CheckCircle2, ArrowRight, Layers, Edit3, Trash2, Check,
  Clock, ShieldCheck, Sparkles, Filter, ChevronDown, ChevronUp,
  DollarSign, UserCheck, ExternalLink, RefreshCw, BookOpen, AlertCircle,
  PlusCircle, School, Award, ChevronRight
} from 'lucide-react';
import {
  COMMON_DEGREES,
  ACCREDITATION_TAGS,
  INSTITUTION_TYPES,
  getAccreditationBadgeStyle
} from '@/lib/commonDegrees';

const ADMISSION_STATUS_LABELS = {
  admissions_open: { label: '🟢 Open', bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
  seats_fast_filling: { label: '🔥 Fast Filling', bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  merit_closed_mgmt_open: { label: '⚡ Mgmt Open', bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.25)' },
  admissions_closed: { label: '🔴 Closed', bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
};

export default function CataloguePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('my_catalogue'); // 'my_catalogue' | 'master_explore'
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState(null);

  // Data States
  const [myCatalogue, setMyCatalogue] = useState([]);
  const [masterColleges, setMasterColleges] = useState([]);
  const [masterPagination, setMasterPagination] = useState({ page: 1, total: 0, pages: 1, hasMore: false });
  const [masterLoading, setMasterLoading] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');

  // Custom Institution Modal State
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [submittingCustom, setSubmittingCustom] = useState(false);
  const [customForm, setCustomForm] = useState({
    customCollegeName: '',
    city: '',
    state: '',
    country: 'India',
    collegeType: 'Private University',
    accreditation: ['NAAC A+', 'UGC Approved', 'AICTE Approved'],
    website: '',
    establishedYear: '',
    affiliatedUniversity: '',
    notes: '',
    selectedDegrees: [
      'B.Tech / B.E.',
      'MBA (Master of Business Administration)',
      'BCA (Bachelor of Computer Applications)',
      'BBA (Bachelor of Business Administration)',
    ],
  });

  useEffect(() => {
    loadMyCatalogue();
    loadMasterColleges(1, '');
  }, []);

  const loadMyCatalogue = async () => {
    try {
      const res = await api.get('/catalogue/my-catalogue');
      const items = res.data?.catalogue || [];
      setMyCatalogue(items);
      if (items.length === 0) {
        // If user has no active items yet, switch to explore tab to encourage 1-click import
        setActiveTab('master_explore');
      }
    } catch (err) {
      toast.error('Failed to load active catalogue');
    } finally {
      setLoading(false);
    }
  };

  const loadMasterColleges = async (page = 1, search = '', type = 'all', state = 'all') => {
    setMasterLoading(true);
    try {
      const params = {
        page,
        limit: 50,
      };
      if (search && search.trim()) params.search = search.trim();
      if (type && type !== 'all') params.type = type;
      if (state && state !== 'all') params.state = state;

      const res = await api.get('/catalogue/master-colleges', { params });
      if (res.data?.success) {
        setMasterColleges(res.data.colleges || []);
        setMasterPagination({
          page: res.data.page || 1,
          total: res.data.total || 0,
          pages: res.data.pages || 1,
          hasMore: res.data.hasMore || false,
        });
      }
    } catch (err) {
      console.error('loadMasterColleges error:', err);
    } finally {
      setMasterLoading(false);
    }
  };

  // Debounced search for Master Repository
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'master_explore') {
        loadMasterColleges(1, searchQuery, typeFilter, stateFilter);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, typeFilter, stateFilter, activeTab]);

  // 1-Click Import Handler
  const handleImportCollege = async (college) => {
    setImportingId(college._id);
    try {
      const res = await api.post(`/catalogue/import/${college._id}`, {
        defaultCommissionRate: 12,
        defaultMouStatus: 'direct_tie_up',
      });
      toast.success(res.data?.message || `Imported ${college.name} to active catalogue! 🎉`);

      // Refresh data
      await loadMyCatalogue();
      await loadMasterColleges(masterPagination.page, searchQuery, typeFilter, stateFilter);
      setActiveTab('my_catalogue');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  // Delete College from Active Catalogue
  const handleDeleteCatalogueItem = async (id, name) => {
    if (!confirm(`Are you sure you want to remove "${name}" from your active catalogue?`)) return;
    try {
      await api.delete(`/catalogue/my-catalogue/${id}`);
      toast.success(`"${name}" removed from catalogue ✅`);
      setMyCatalogue(prev => prev.filter(c => c._id !== id));
      loadMasterColleges(masterPagination.page, searchQuery, typeFilter, stateFilter);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove item');
    }
  };

  // Phase 3: Submit Custom Institution
  const handleCreateCustomInstitution = async (e) => {
    e.preventDefault();
    if (!customForm.customCollegeName.trim()) {
      return toast.error('Institution name is required');
    }

    setSubmittingCustom(true);
    try {
      const res = await api.post('/catalogue/custom', {
        customCollegeName: customForm.customCollegeName.trim(),
        location: {
          city: customForm.city.trim(),
          state: customForm.state.trim(),
          country: customForm.country.trim() || 'India',
        },
        collegeType: customForm.collegeType,
        accreditation: customForm.accreditation,
        website: customForm.website.trim(),
        establishedYear: customForm.establishedYear ? Number(customForm.establishedYear) : null,
        affiliatedUniversity: customForm.affiliatedUniversity.trim(),
        notes: customForm.notes.trim(),
        selectedDegrees: customForm.selectedDegrees,
      });

      toast.success(res.data?.message || 'Custom institution created! 🎉');
      setShowAddCustomModal(false);

      // Reset form
      setCustomForm({
        customCollegeName: '',
        city: '',
        state: '',
        country: 'India',
        collegeType: 'Private University',
        accreditation: ['NAAC A+', 'UGC Approved', 'AICTE Approved'],
        website: '',
        establishedYear: '',
        affiliatedUniversity: '',
        notes: '',
        selectedDegrees: [
          'B.Tech / B.E.',
          'MBA (Master of Business Administration)',
          'BCA (Bachelor of Computer Applications)',
          'BBA (Bachelor of Business Administration)',
        ],
      });

      // Navigate straight to detail view to customize fees
      if (res.data?.catalogueItem?._id) {
        router.push(`/colleges/${res.data.catalogueItem._id}`);
      } else {
        await loadMyCatalogue();
        setActiveTab('my_catalogue');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create custom institution');
    } finally {
      setSubmittingCustom(false);
    }
  };

  // Filter My Active Catalogue locally
  const filteredMyCatalogue = useMemo(() => {
    return myCatalogue.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        item.customCollegeName?.toLowerCase().includes(q) ||
        item.location?.city?.toLowerCase().includes(q) ||
        item.location?.state?.toLowerCase().includes(q) ||
        (item.courses || []).some(c => c.degreeName?.toLowerCase().includes(q) || c.specialization?.toLowerCase().includes(q));

      const matchType = typeFilter === 'all' || item.collegeType === typeFilter;
      const matchState = stateFilter === 'all' || item.location?.state?.toLowerCase() === stateFilter.toLowerCase();

      return matchSearch && matchType && matchState;
    });
  }, [myCatalogue, searchQuery, typeFilter, stateFilter]);

  // Aggregate states for filter dropdown
  const allStates = useMemo(() => {
    const set = new Set();
    myCatalogue.forEach(c => {
      if (c.location?.state) set.add(c.location.state);
    });
    masterColleges.forEach(c => {
      if (c.location?.state) set.add(c.location.state);
    });
    return Array.from(set).sort();
  }, [myCatalogue, masterColleges]);

  return (
    <div className="app-shell pb-24">
      {/* ─────────────────────────────────────────────────────────────
          TOP APP BAR & HEADER
         ───────────────────────────────────────────────────────────── */}
      <div className="header-nav sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 flex-shrink-0">
              <GraduationCap size={22} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white m-0 tracking-tight flex items-center gap-2">
                Colleges & Course Catalogue
                <span className="badge bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Education Suite
                </span>
              </h1>
              <p className="text-xs text-slate-400 m-0">
                Institutional tie-ups, custom student fee packages, and 10,000+ university repository.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddCustomModal(true)}
              className="btn btn-primary btn-sm flex items-center gap-2 text-xs py-2 px-4 rounded-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
              <PlusCircle size={15} /> Add Custom Institution
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ─────────────────────────────────────────────────────────────
            DUAL-TAB SWITCHER
           ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('my_catalogue')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition ${
                activeTab === 'my_catalogue'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 size={15} />
              <span>My Active Catalogue</span>
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full ml-0.5">
                {myCatalogue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('master_explore')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition ${
                activeTab === 'master_explore'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe size={15} />
              <span>Explore Master Repository</span>
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] px-2 py-0.5 rounded-full ml-0.5 font-bold">
                10,000+
              </span>
            </button>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            {activeTab === 'my_catalogue' ? (
              <>Showing <strong>{filteredMyCatalogue.length}</strong> active institutions with configured fee structures</>
            ) : (
              <>Browsing <strong>{masterPagination.total || masterColleges.length}</strong> verified master institutions</>
            )}
          </span>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SEARCH & FILTER CONTROL BAR
           ───────────────────────────────────────────────────────────── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 my-5 shadow-lg flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'my_catalogue' ? "Search your active colleges, courses, degrees, or cities..." : "Search 10,000+ universities by name, short code, city, or accreditation..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input pl-10 pr-4 py-2.5 text-xs sm:text-sm w-full bg-slate-950/90 border-slate-800 rounded-xl focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                &times; Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="input py-2.5 text-xs bg-slate-950/90 border-slate-800 rounded-xl flex-1 md:w-44"
            >
              <option value="all">All Institution Types</option>
              {INSTITUTION_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="input py-2.5 text-xs bg-slate-950/90 border-slate-800 rounded-xl flex-1 md:w-40"
            >
              <option value="all">All States</option>
              {allStates.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: MY ACTIVE CATALOGUE
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'my_catalogue' && (
          <div>
            {loading ? (
              <div className="py-16 text-center">
                <div className="spinner mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Loading active catalogue...</p>
              </div>
            ) : filteredMyCatalogue.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center my-6">
                <School size={48} className="mx-auto text-slate-600 mb-3" />
                <h3 className="text-lg font-black text-white">No Institutions in Your Active Catalogue</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
                  {myCatalogue.length === 0
                    ? "Start building your catalogue by exploring the 10,000+ Master Repository with 1-Click Import or manually creating a custom partner institution."
                    : "No colleges match your active search filters. Try clearing your search or location filters."}
                </p>

                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('master_explore')}
                    className="btn btn-primary btn-sm flex items-center gap-2"
                  >
                    <Globe size={14} /> Explore Master Repository
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomModal(true)}
                    className="btn btn-secondary btn-sm flex items-center gap-2"
                  >
                    <PlusCircle size={14} /> Add Custom Institution
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMyCatalogue.map(col => {
                  const name = col.customCollegeName || col.name;
                  const type = col.collegeType || col.type || 'Private University';
                  const loc = `${col.location?.city ? col.location.city + ', ' : ''}${col.location?.state || ''}`;
                  const accreditations = col.accreditation || col.masterCollegeId?.accreditation || [];
                  const courses = col.courses || [];
                  const uniqueDegrees = Array.from(new Set(courses.map(c => c.degreeName))).filter(Boolean);

                  return (
                    <div
                      key={col._id}
                      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/40 transition shadow-lg relative group overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-600/10 transition" />

                      <div>
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-base flex-shrink-0 shadow-inner">
                            {col.masterCollegeId?.shortCode || name.substring(0, 2).toUpperCase()}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {col.isCustomInstitution ? (
                              <span className="badge bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                ✨ Custom Partner
                              </span>
                            ) : (
                              <span className="badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                🏛️ Verified Tie-Up
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Location */}
                        <h3 className="text-base font-black text-white m-0 tracking-tight leading-snug group-hover:text-indigo-300 transition">
                          {name}
                        </h3>
                        <p className="text-xs text-slate-400 m-0 mt-1 flex items-center gap-1">
                          <MapPin size={12} className="text-indigo-400 flex-shrink-0" />
                          {loc || 'Location on file'} • <span className="text-slate-300 font-medium">{type}</span>
                        </p>

                        {/* Accreditations Badges */}
                        {accreditations.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-3">
                            {accreditations.slice(0, 3).map(acc => {
                              const style = getAccreditationBadgeStyle(acc);
                              return (
                                <span
                                  key={acc}
                                  style={{
                                    background: style.bg,
                                    color: style.text,
                                    borderColor: style.border,
                                  }}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold border"
                                >
                                  {acc}
                                </span>
                              );
                            })}
                            {accreditations.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-bold px-1">
                                +{accreditations.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Degree Programs Summary */}
                        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 my-3.5 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">Configured Streams:</span>
                            <span className="text-emerald-400 font-black">{courses.length} Specializations</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {uniqueDegrees.slice(0, 4).map(deg => (
                              <span key={deg} className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                                🎓 {deg}
                              </span>
                            ))}
                            {uniqueDegrees.length > 4 && (
                              <span className="text-[10px] text-slate-500 font-bold">
                                +{uniqueDegrees.length - 4} degrees
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80 mt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteCatalogueItem(col._id, name)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Remove from catalogue"
                        >
                          <Trash2 size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => router.push(`/colleges/${col._id}`)}
                          className="btn btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-bold bg-slate-800 hover:bg-indigo-600 text-white border-slate-700 hover:border-indigo-500 transition"
                        >
                          <span>Drill Down & Customize</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: EXPLORE MASTER REPOSITORY (10,000+ SCALABLE DATABASE)
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'master_explore' && (
          <div>
            {masterLoading ? (
              <div className="py-16 text-center">
                <div className="spinner mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Searching master repository...</p>
              </div>
            ) : masterColleges.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center my-6">
                <Globe size={48} className="mx-auto text-slate-600 mb-3" />
                <h3 className="text-lg font-black text-white">No Universities Found</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
                  No matching institutions found in the master database. You can manually create this institution with 1 click.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(true)}
                  className="btn btn-primary btn-sm flex items-center gap-2 mx-auto"
                >
                  <PlusCircle size={15} /> Add Custom Institution
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {masterColleges.map(col => {
                    const isImported = col.isImported;
                    const loc = `${col.location?.city ? col.location.city + ', ' : ''}${col.location?.state || ''} (${col.location?.country || 'India'})`;
                    const accreditations = col.accreditation || [];
                    const courses = col.courses || [];

                    return (
                      <div
                        key={col._id}
                        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-purple-500/40 transition shadow-lg relative group overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-600/10 transition" />

                        <div>
                          {/* Top Row */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-black text-base flex-shrink-0 shadow-inner">
                              {col.shortCode || col.name.substring(0, 2).toUpperCase()}
                            </div>

                            {isImported ? (
                              <span className="badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Check size={11} /> In Active Catalogue
                              </span>
                            ) : (
                              <span className="badge bg-slate-800 text-slate-400 border border-slate-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                                🌐 Master Verified
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-black text-white m-0 tracking-tight leading-snug group-hover:text-purple-300 transition">
                            {col.name}
                          </h3>
                          <p className="text-xs text-slate-400 m-0 mt-1 flex items-center gap-1">
                            <MapPin size={12} className="text-purple-400 flex-shrink-0" />
                            {loc} • <span className="text-slate-300 font-medium">{col.type}</span>
                          </p>

                          {/* Accreditations */}
                          {accreditations.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-3">
                              {accreditations.slice(0, 3).map(acc => {
                                const style = getAccreditationBadgeStyle(acc);
                                return (
                                  <span
                                    key={acc}
                                    style={{
                                      background: style.bg,
                                      color: style.text,
                                      borderColor: style.border,
                                    }}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold border"
                                  >
                                    {acc}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Programs Overview */}
                          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 my-3.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-medium">Available Programs:</span>
                              <span className="text-indigo-300 font-bold">{courses.length} Degrees</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {courses.slice(0, 4).map(c => (
                                <span key={c._id || c.degreeName} className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                                  🎓 {c.degreeName}
                                </span>
                              ))}
                              {courses.length > 4 && (
                                <span className="text-[10px] text-slate-500 font-bold">
                                  +{courses.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-3 border-t border-slate-800/80 mt-1 flex items-center gap-2">
                          {isImported ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/colleges/${col.tenantCatalogueId || col._id}`)}
                              className="btn btn-secondary btn-sm w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-bold text-emerald-400 border-emerald-500/30"
                            >
                              <span>View in My Active Catalogue</span>
                              <ChevronRight size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleImportCollege(col)}
                              disabled={importingId === col._id}
                              className="btn btn-primary btn-sm w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 shadow-md shadow-emerald-600/30 transition"
                            >
                              {importingId === col._id ? (
                                <div className="spinner w-4 h-4" />
                              ) : (
                                <>
                                  <Plus size={14} />
                                  <span>1-Click Import & Auto-Map</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {masterPagination.pages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      type="button"
                      disabled={masterPagination.page <= 1 || masterLoading}
                      onClick={() => loadMasterColleges(masterPagination.page - 1, searchQuery, typeFilter, stateFilter)}
                      className="btn btn-secondary btn-sm text-xs py-1.5 px-3 rounded-lg"
                    >
                      ← Previous Page
                    </button>
                    <span className="text-xs text-slate-400 font-bold">
                      Page {masterPagination.page} of {masterPagination.pages}
                    </span>
                    <button
                      type="button"
                      disabled={!masterPagination.hasMore || masterLoading}
                      onClick={() => loadMasterColleges(masterPagination.page + 1, searchQuery, typeFilter, stateFilter)}
                      className="btn btn-secondary btn-sm text-xs py-1.5 px-3 rounded-lg"
                    >
                      Next Page →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          PHASE 3 MODAL: ADD CUSTOM INSTITUTION BUILDER
         ───────────────────────────────────────────────────────────── */}
      {showAddCustomModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomModal(false)}>
          <div className="modal-sheet max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
                  <School size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white m-0">Add Custom Partner Institution</h3>
                  <p className="text-xs text-slate-400 m-0">Create an institution not found in the master database.</p>
                </div>
              </div>
              <button onClick={() => setShowAddCustomModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleCreateCustomInstitution} className="space-y-4">
              <div>
                <label className="label">Institution / College Name *</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="e.g. St. Xavier's Institute of Engineering & Technology"
                  value={customForm.customCollegeName}
                  onChange={e => setCustomForm(f => ({ ...f, customCollegeName: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City *</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. Pune"
                    value={customForm.city}
                    onChange={e => setCustomForm(f => ({ ...f, city: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">State *</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. Maharashtra"
                    value={customForm.state}
                    onChange={e => setCustomForm(f => ({ ...f, state: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Institution Type</label>
                  <select
                    className="input text-xs"
                    value={customForm.collegeType}
                    onChange={e => setCustomForm(f => ({ ...f, collegeType: e.target.value }))}
                  >
                    {INSTITUTION_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Established Year</label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="e.g. 2002"
                    value={customForm.establishedYear}
                    onChange={e => setCustomForm(f => ({ ...f, establishedYear: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Official Website Portal</label>
                <input
                  type="url"
                  className="input text-sm"
                  placeholder="https://institution-domain.edu.in"
                  value={customForm.website}
                  onChange={e => setCustomForm(f => ({ ...f, website: e.target.value }))}
                />
              </div>

              {/* Accreditations Multi-select Pills */}
              <div>
                <label className="label">Accreditations & Government Approvals</label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  {ACCREDITATION_TAGS.map(tag => {
                    const isSelected = customForm.accreditation.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setCustomForm(f => ({
                            ...f,
                            accreditation: isSelected
                              ? f.accreditation.filter(t => t !== tag)
                              : [...f.accreditation, tag]
                          }));
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pre-populate Standard Degrees */}
              <div>
                <label className="label">Pre-Populate Common Degrees & Streams (Ready for Fee Entry)</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  {COMMON_DEGREES.map(d => {
                    const isChecked = customForm.selectedDegrees.includes(d.degreeName);
                    return (
                      <label
                        key={d.degreeName}
                        className="flex items-center gap-2 text-xs text-slate-300 hover:text-white p-1 rounded hover:bg-slate-900 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setCustomForm(f => ({
                              ...f,
                              selectedDegrees: isChecked
                                ? f.selectedDegrees.filter(x => x !== d.degreeName)
                                : [...f.selectedDegrees, d.degreeName]
                            }));
                          }}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        <span className="truncate">{d.degreeName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label">Internal Notes / Tie-Up Summary</label>
                <textarea
                  className="input text-xs"
                  rows={2}
                  placeholder="e.g. Exclusive regional admissions consultancy partner MOU."
                  value={customForm.notes}
                  onChange={e => setCustomForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="modal-actions pt-2 flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddCustomModal(false)}>Cancel</button>
                <button type="submit" disabled={submittingCustom} className="btn btn-primary">
                  {submittingCustom ? 'Creating Institution...' : 'Create & Configure Fees 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav active="catalogue" />
    </div>
  );
}
