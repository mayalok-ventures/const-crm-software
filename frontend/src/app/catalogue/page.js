'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api, { cachedGet, getCachedData } from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import {
  GraduationCap, Search, Plus, Building2, MapPin, Globe,
  CheckCircle2, ArrowRight, Layers, Edit3, Trash2, Check,
  Clock, ShieldCheck, Sparkles, Filter, ChevronDown, ChevronUp,
  DollarSign, UserCheck, ExternalLink, RefreshCw, BookOpen, AlertCircle,
  PlusCircle, School, Award, ChevronRight, X
} from 'lucide-react';
import { getUser, hasPermission, canViewField } from '@/lib/auth';
import {
  COMMON_DEGREES,
  ACCREDITATION_TAGS,
  INSTITUTION_TYPES,
  getAccreditationBadgeStyle
} from '@/lib/commonDegrees';

const ADMISSION_STATUS_LABELS = {
  admissions_open: { label: '🟢 Open', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  seats_fast_filling: { label: '🔥 Fast Filling', bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  merit_closed_mgmt_open: { label: '⚡ Mgmt Open', bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  admissions_closed: { label: '🔴 Closed', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

export default function CataloguePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('my_catalogue'); // 'my_catalogue' | 'master_explore'

  // Frame-0 Cache Initialization: instant render on tab switch
  const initialCatalogue = typeof window !== 'undefined' ? getCachedData('/catalogue/my-catalogue') : null;
  const initialItems = initialCatalogue?.catalogue || (Array.isArray(initialCatalogue) ? initialCatalogue : []);

  const [loading, setLoading] = useState(() => initialItems.length === 0);
  const [importingId, setImportingId] = useState(null);

  // Data States
  const [myCatalogue, setMyCatalogue] = useState(() => initialItems);
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
    const updateAuth = () => {
      setUser(getUser());
    };
    updateAuth();
    window.addEventListener('user-updated', updateAuth);
    loadMyCatalogue();
    loadMasterColleges(1, '');
    return () => window.removeEventListener('user-updated', updateAuth);
  }, []);

  const loadMyCatalogue = async (isManual = false) => {
    if (myCatalogue.length === 0 && !isManual) setLoading(true);
    try {
      const res = await cachedGet('/catalogue/my-catalogue', { forceRefresh: isManual });
      const items = res.data?.catalogue || [];
      setMyCatalogue(items);
      if (items.length === 0) {
        setActiveTab('master_explore');
      }
    } catch (err) {
      toast.error('Failed to load active catalogue');
    } finally {
      setLoading(false);
    }
  };

  const loadMasterColleges = async (page = 1, search = '', type = 'all', state = 'all', isManual = false) => {
    if (masterColleges.length === 0 && !isManual) setMasterLoading(true);
    try {
      const params = {
        page,
        limit: 50,
      };
      if (search && search.trim()) params.search = search.trim();
      if (type && type !== 'all') params.type = type;
      if (state && state !== 'all') params.state = state;

      const res = await cachedGet('/catalogue/master-colleges', { params, forceRefresh: isManual });
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

  // Focus state for expanding search bar
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Parse comma-separated search tokens
  const searchTokens = useMemo(() => {
    return searchQuery.split(',').map(s => s.trim()).filter(Boolean);
  }, [searchQuery]);

  // Filter My Active Catalogue locally with multi-token comma refinement
  const filteredMyCatalogue = useMemo(() => {
    const tokens = searchQuery.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    return myCatalogue.filter(item => {
      const matchSearch = tokens.length === 0 || tokens.every(token => {
        const matchName = (item.customCollegeName || item.name || '').toLowerCase().includes(token);
        const matchShort = (item.masterCollegeId?.shortCode || '').toLowerCase().includes(token);
        const matchCity = (item.location?.city || '').toLowerCase().includes(token);
        const matchState = (item.location?.state || '').toLowerCase().includes(token);
        const matchCountry = (item.location?.country || '').toLowerCase().includes(token);
        const matchType = (item.collegeType || item.type || '').toLowerCase().includes(token);
        const matchAccreditation = (item.accreditation || item.masterCollegeId?.accreditation || []).some(a => a.toLowerCase().includes(token));
        const matchAffiliation = (item.affiliatedUniversity || '').toLowerCase().includes(token);
        const matchNotes = (item.notes || '').toLowerCase().includes(token);
        const matchCourses = (item.courses || []).some(c => 
          (c.degreeName || '').toLowerCase().includes(token) ||
          (c.specialization || '').toLowerCase().includes(token) ||
          (c.level || '').toLowerCase().includes(token)
        );
        return matchName || matchShort || matchCity || matchState || matchCountry || matchType || matchAccreditation || matchAffiliation || matchNotes || matchCourses;
      });

      const matchType = typeFilter === 'all' || item.collegeType === typeFilter || item.type === typeFilter;
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
    <div className="app-container">
      <BottomNav active="catalogue" />

      <main className="main-content" data-crm-canvas="true">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
        
        {/* ─────────────────────────────────────────────────────────────
            PAGE HEADER & ACTIONS
           ───────────────────────────────────────────────────────────── */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0">
              <GraduationCap size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="page-title text-xl font-bold text-slate-900 m-0">Colleges & Course Catalogue</h1>
                <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Education Suite
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Manage partner tie-ups, customized student fees, and 10,000+ university repository
              </p>
            </div>
          </div>

          {hasPermission(user, 'catalogue.manage_workspace') && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddCustomModal(true)}
                className="btn btn-primary btn-sm flex items-center gap-2 text-xs py-2 px-4 rounded-xl font-semibold shadow-sm"
              >
                <PlusCircle size={16} /> Add Custom Partner
              </button>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            DUAL-TAB SWITCHER
           ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-5">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('my_catalogue')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'my_catalogue'
                  ? 'bg-white text-indigo-600 shadow-sm font-bold border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={15} />
              <span>My Active Catalogue</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'my_catalogue' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                {myCatalogue.length}
              </span>
            </button>

            {hasPermission(user, 'catalogue.view_master') && (
              <button
                type="button"
                onClick={() => setActiveTab('master_explore')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'master_explore'
                    ? 'bg-white text-purple-600 shadow-sm font-bold border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe size={15} />
                <span>Explore Master Repository</span>
                <span className="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  10,000+
                </span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            {activeTab === 'my_catalogue' ? (
              <>Showing <strong>{filteredMyCatalogue.length}</strong> active institutions with custom fee packages</>
            ) : (
              <>Browsing <strong>{masterPagination.total || masterColleges.length}</strong> verified master institutions</>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            EXPANDING SEARCH & SMART MULTI-TOKEN CONTROL BAR
           ───────────────────────────────────────────────────────────── */}
        <div className={`bg-white border rounded-2xl p-3.5 sm:p-4 mb-6 shadow-xs transition-all duration-300 ${
          isSearchFocused || searchQuery
            ? 'border-indigo-300 shadow-md ring-2 ring-indigo-500/10'
            : 'border-slate-200'
        }`}>
          <div className="flex flex-col gap-3">
            {/* Top Row: Search Input & Filters */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3">
              {/* Dynamic Expanding Search Input */}
              <div className="relative flex-1 min-w-0">
                <Search
                  size={18}
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none ${
                    isSearchFocused || searchQuery ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'my_catalogue'
                      ? "Search by College, City, State, Degree, Course (e.g. Amity, Noida, MBA)..."
                      : "Search 10,000+ Universities by Name, City, or Course (e.g. VIT, Vellore, CSE)..."
                  }
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    // Small timeout to allow chip clicks to register before hiding
                    setTimeout(() => setIsSearchFocused(false), 200);
                  }}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`input input-search pl-10 pr-10 py-2 sm:py-2.5 text-xs sm:text-sm w-full rounded-xl transition-all duration-200 ${
                    isSearchFocused || searchQuery
                      ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 focus:bg-white'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-base font-bold transition"
                    title="Clear search query"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Filter Dropdowns & Reset */}
              <div className="flex items-center gap-2 sm:gap-2.5 w-full md:w-auto shrink-0">
                <div className="flex-1 md:w-44 md:flex-none">
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="input py-2 px-3 text-xs bg-slate-50 border-slate-200 rounded-xl w-full focus:bg-white focus:border-indigo-500 cursor-pointer truncate"
                  >
                    <option value="all">All Types</option>
                    {INSTITUTION_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 md:w-40 md:flex-none">
                  <select
                    value={stateFilter}
                    onChange={e => setStateFilter(e.target.value)}
                    className="input py-2 px-3 text-xs bg-slate-50 border-slate-200 rounded-xl w-full focus:bg-white focus:border-indigo-500 cursor-pointer truncate"
                  >
                    <option value="all">All States</option>
                    {allStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {(typeFilter !== 'all' || stateFilter !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setTypeFilter('all');
                      setStateFilter('all');
                    }}
                    className="p-2 sm:px-2.5 h-[38px] rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 transition shrink-0"
                    title="Reset all filters"
                  >
                    <X size={15} />
                    <span className="hidden sm:inline text-xs">Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Search Token Badges & Quick Refinement Hints */}
            {searchTokens.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-slate-100 animate-fade-in">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Filter size={12} className="text-indigo-500" /> Active Filters ({searchTokens.length}):
                </span>
                {searchTokens.map((tok, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                  >
                    <span>{idx === 0 ? '🏛️' : idx === 1 ? '📍' : '🎓'} {tok}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newTokens = searchTokens.filter((_, i) => i !== idx);
                        setSearchQuery(newTokens.join(', '));
                      }}
                      className="hover:text-indigo-950 text-indigo-400 hover:text-indigo-700 font-bold ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Quick Search Suggestions when focused & query empty */}
            {isSearchFocused && searchTokens.length === 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-slate-100 text-xs text-slate-500">
                <span className="font-semibold flex items-center gap-1 text-indigo-600 flex-shrink-0">
                  <Sparkles size={13} /> Quick Multi-Filters:
                </span>
                {[
                  { label: '🏛️ Amity, 📍 Noida, 🎓 MBA', query: 'Amity, Noida, MBA' },
                  { label: '🏛️ VIT, 📍 Vellore, 🎓 B.Tech', query: 'VIT, Vellore, B.Tech' },
                  { label: '🏛️ BITS, 📍 Pilani, 🎓 M.Tech', query: 'BITS, Pilani, M.Tech' },
                  { label: '🏛️ Oxford, 📍 UK, 🎓 MBA', query: 'Oxford, UK, MBA' },
                ].map((item) => (
                  <button
                    key={item.query}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearchQuery(item.query);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 text-[11px] font-medium border border-slate-200/90 transition shadow-2xs"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
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
                <p className="text-xs text-slate-500 mt-2">Loading active catalogue...</p>
              </div>
            ) : filteredMyCatalogue.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center my-6 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
                  <School size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No Institutions Match Your Filter</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6 leading-relaxed">
                  {myCatalogue.length === 0
                    ? "Start building your catalogue by exploring the 10,000+ Master Repository with 1-Click Import or manually creating a custom partner institution."
                    : `No colleges match the criteria "${searchQuery}". Try clearing specific tokens or location filters.`}
                </p>

                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="btn btn-secondary btn-sm flex items-center gap-2"
                    >
                      Clear Search Filter
                    </button>
                  )}
                  {hasPermission(user, 'catalogue.view_master') && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('master_explore')}
                      className="btn btn-primary btn-sm flex items-center gap-2"
                    >
                      <Globe size={14} /> Explore Master Repository
                    </button>
                  )}
                  {hasPermission(user, 'catalogue.manage_workspace') && (
                    <button
                      type="button"
                      onClick={() => setShowAddCustomModal(true)}
                      className="btn btn-secondary btn-sm flex items-center gap-2"
                    >
                      <PlusCircle size={14} /> Add Custom Partner
                    </button>
                  )}
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
                      onClick={() => router.push(`/colleges/${col._id}`)}
                      role="button"
                      tabIndex={0}
                      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500 hover:shadow-lg transition-all duration-200 shadow-xs relative group cursor-pointer overflow-hidden text-left"
                    >
                      <div>
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-base flex-shrink-0 shadow-sm group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-200">
                            {col.masterCollegeId?.shortCode || name.substring(0, 2).toUpperCase()}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {col.isCustomInstitution ? (
                              <span className="badge bg-purple-50 text-purple-700 border border-purple-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                                ✨ Custom Partner
                              </span>
                            ) : (
                              <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                                🏛️ Verified Tie-Up
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Location */}
                        <h3 className="text-base font-bold text-slate-900 m-0 tracking-tight leading-snug group-hover:text-indigo-600 transition">
                          {name}
                        </h3>
                        <p className="text-xs text-slate-500 m-0 mt-1 flex items-center gap-1">
                          <MapPin size={13} className="text-indigo-500 flex-shrink-0" />
                          <span>{loc || 'Location on file'}</span> • <span className="text-slate-700 font-medium">{type}</span>
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
                              <span className="text-[10px] text-slate-500 font-semibold px-1">
                                +{accreditations.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Degree Programs Summary */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 my-3.5 space-y-1.5 group-hover:bg-indigo-50/40 group-hover:border-indigo-200/60 transition-colors">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">Configured Streams:</span>
                            <span className="text-indigo-600 font-bold">{courses.length} Specializations</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {uniqueDegrees.slice(0, 4).map(deg => (
                              <span key={deg} className="bg-white border border-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-medium shadow-2xs">
                                🎓 {deg}
                              </span>
                            ))}
                            {uniqueDegrees.length > 4 && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                +{uniqueDegrees.length - 4} degrees
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-1">
                        {hasPermission(user, 'catalogue.manage_workspace') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCatalogueItem(col._id, name);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Remove from catalogue"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}

                        <div className="flex-1 flex items-center justify-end gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                          <span>View Details & Fees</span>
                          <ChevronRight size={15} />
                        </div>
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
                <p className="text-xs text-slate-500 mt-2">Searching master repository...</p>
              </div>
            ) : masterColleges.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center my-6 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mx-auto mb-4">
                  <Globe size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No Universities Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6 leading-relaxed">
                  No matching institutions found in the master database for &quot;{searchQuery}&quot;. You can manually create this partner institution with 1 click.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(true)}
                  className="btn btn-primary btn-sm flex items-center gap-2 mx-auto"
                >
                  <PlusCircle size={15} /> Add Custom Partner
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
                        onClick={() => router.push(isImported ? `/colleges/${col.tenantCatalogueId || col._id}` : `/colleges/${col._id}`)}
                        role="button"
                        tabIndex={0}
                        className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:border-purple-400 hover:shadow-lg transition-all duration-200 shadow-xs relative group cursor-pointer overflow-hidden text-left"
                      >
                        <div>
                          {/* Top Row */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-extrabold text-base flex-shrink-0 shadow-sm group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white transition-all duration-200">
                              {col.shortCode || col.name.substring(0, 2).toUpperCase()}
                            </div>

                            {isImported ? (
                              <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Check size={12} /> In Active Catalogue
                              </span>
                            ) : (
                              <span className="badge bg-slate-100 text-slate-600 border border-slate-200 text-[11px] px-2 py-0.5 rounded-full font-medium">
                                🌐 Master Verified
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-slate-900 m-0 tracking-tight leading-snug group-hover:text-purple-600 transition">
                            {col.name}
                          </h3>
                          <p className="text-xs text-slate-500 m-0 mt-1 flex items-center gap-1">
                            <MapPin size={13} className="text-purple-500 flex-shrink-0" />
                            <span>{loc}</span> • <span className="text-slate-700 font-medium">{col.type}</span>
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
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 my-3.5 space-y-1.5 group-hover:bg-purple-50/40 group-hover:border-purple-200/60 transition-colors">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">Available Programs:</span>
                              <span className="text-indigo-600 font-bold">{courses.length} Degrees</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {courses.slice(0, 4).map(c => (
                                <span key={c._id || c.degreeName} className="bg-white border border-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-medium shadow-2xs">
                                  🎓 {c.degreeName}
                                </span>
                              ))}
                              {courses.length > 4 && (
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  +{courses.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-3 border-t border-slate-100 mt-1 flex items-center gap-2">
                          {isImported ? (
                            <div className="w-full flex items-center justify-between text-xs font-bold text-emerald-700 py-1.5">
                              <span>Configured in Active Catalogue</span>
                              <ChevronRight size={14} />
                            </div>
                          ) : hasPermission(user, 'catalogue.manage_workspace') ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImportCollege(col);
                              }}
                              disabled={importingId === col._id}
                              className="btn btn-primary btn-sm w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
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
                          ) : (
                            <div className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 py-1.5">
                              <span>Master Institution</span>
                              <ChevronRight size={14} />
                            </div>
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
                    <span className="text-xs text-slate-600 font-semibold">
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
      </main>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD CUSTOM INSTITUTION BUILDER
         ───────────────────────────────────────────────────────────── */}
      {showAddCustomModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomModal(false)}>
          <div className="modal-sheet max-w-2xl bg-white" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <School size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Add Custom Partner Institution</h3>
                  <p className="text-xs text-slate-500 m-0">Create an institution not found in the master database.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomInstitution} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
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
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
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
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {COMMON_DEGREES.map(d => {
                    const isChecked = customForm.selectedDegrees.includes(d.degreeName);
                    return (
                      <label
                        key={d.degreeName}
                        className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 p-1.5 rounded hover:bg-white cursor-pointer transition"
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

              <div className="modal-actions pt-2 flex justify-end gap-2 border-t border-slate-100">
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
