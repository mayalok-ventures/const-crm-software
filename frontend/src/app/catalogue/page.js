'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import {
  GraduationCap, Search, Plus, Building2, MapPin, Globe,
  CheckCircle2, ArrowRight, Layers, Edit3, Trash2, Check,
  Clock, ShieldCheck, Sparkles, Filter, ChevronDown, ChevronUp,
  DollarSign, UserCheck, ExternalLink, RefreshCw, BookOpen, AlertCircle
} from 'lucide-react';

const ADMISSION_STATUS_LABELS = {
  admissions_open: { label: '🟢 Admissions Open', bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
  seats_fast_filling: { label: '🔥 Seats Fast Filling', bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  merit_closed_mgmt_open: { label: '⚡ Merit Closed (Mgmt Open)', bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.25)' },
  admissions_closed: { label: '🔴 Closed for Intake', bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' },
};

const MOU_STATUS_LABELS = {
  direct_tie_up: { label: '🤝 Direct University Tie-up', color: '#10b981' },
  sub_agent_mou: { label: '📑 Sub-Agent MOU', color: '#6366f1' },
  informal_tie_up: { label: '📞 Direct Campus Contact', color: '#f59e0b' },
  none: { label: '⭕ No Formal Tie-up', color: '#94a3b8' },
};

export default function CataloguePage() {
  const [activeTab, setActiveTab] = useState('my_catalogue'); // 'my_catalogue' | 'master_explore'
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState(null);

  // Data States
  const [masterColleges, setMasterColleges] = useState([]);
  const [myCatalogue, setMyCatalogue] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [expandedCollegeId, setExpandedCollegeId] = useState(null);

  // Edit / Custom Modal States
  const [editingItem, setEditingItem] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCourseIndex, setEditCourseIndex] = useState(null);
  const [editCourseForm, setEditCourseForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAllCatalogueData();
  }, []);

  const loadAllCatalogueData = async () => {
    setLoading(true);
    try {
      const [myRes, masterRes] = await Promise.all([
        api.get('/catalogue/my-catalogue'),
        api.get('/catalogue/master-colleges'),
      ]);
      setMyCatalogue(myRes.data?.catalogue || []);
      setMasterColleges(masterRes.data?.colleges || []);
      if ((myRes.data?.catalogue || []).length === 0 && (masterRes.data?.colleges || []).length > 0) {
        setActiveTab('master_explore');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load catalogue data');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Import Handler
  const handleImportCollege = async (college) => {
    setImportingId(college._id);
    try {
      const res = await api.post(`/catalogue/import/${college._id}`, {
        defaultCommissionRate: 12,
        defaultMouStatus: 'direct_tie_up',
      });
      toast.success(res.data?.message || `Imported ${college.name} to your catalogue! 🎉`);

      // Refresh data
      await loadAllCatalogueData();
      setActiveTab('my_catalogue');
      setExpandedCollegeId(res.data?.catalogueItem?._id || college._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  // Delete College from Catalogue
  const handleDeleteCatalogueItem = async (id, name) => {
    if (!confirm(`Are you sure you want to remove "${name}" from your active catalogue?`)) return;
    try {
      await api.delete(`/catalogue/my-catalogue/${id}`);
      toast.success(`${name} removed from catalogue ✅`);
      setMyCatalogue(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove item');
    }
  };

  // Open Edit Modal for a specific Course
  const handleOpenCourseEditor = (college, course, idx) => {
    setEditingItem(college);
    setEditCourseIndex(idx);
    setEditCourseForm({
      degreeName: course.degreeName,
      specialization: course.specialization,
      annualTuitionFee: course.customFeeStructure?.annualTuitionFee || 0,
      packageFee: course.customFeeStructure?.packageFee || 0,
      hostelFeePerYear: course.customFeeStructure?.hostelFeePerYear || 0,
      oneTimeAdmissionFee: course.customFeeStructure?.oneTimeAdmissionFee || 0,
      currency: course.customFeeStructure?.currency || 'INR',
      feeNotes: course.customFeeStructure?.feeNotes || '',
      commissionRate: course.customTieUpDetails?.commissionRate || 10,
      commissionType: course.customTieUpDetails?.commissionType || 'percentage',
      mouStatus: course.customTieUpDetails?.mouStatus || 'direct_tie_up',
      contactPersonName: course.customTieUpDetails?.contactPersonName || '',
      contactPersonPhone: course.customTieUpDetails?.contactPersonPhone || '',
      admissionStatus: course.admissionStatus || 'admissions_open',
      quotaType: course.quotaType || 'management_quota',
    });
    setShowEditModal(true);
  };

  // Save Course Fee & Tie-Up Customization
  const handleSaveCourseCustomization = async (e) => {
    e.preventDefault();
    if (!editingItem || editCourseIndex === null) return;

    setSubmitting(true);
    try {
      const updatedCourses = [...editingItem.courses];
      updatedCourses[editCourseIndex] = {
        ...updatedCourses[editCourseIndex],
        customFeeStructure: {
          annualTuitionFee: Number(editCourseForm.annualTuitionFee) || 0,
          packageFee: Number(editCourseForm.packageFee) || 0,
          hostelFeePerYear: Number(editCourseForm.hostelFeePerYear) || 0,
          oneTimeAdmissionFee: Number(editCourseForm.oneTimeAdmissionFee) || 0,
          currency: editCourseForm.currency,
          feeNotes: editCourseForm.feeNotes,
        },
        customTieUpDetails: {
          commissionType: editCourseForm.commissionType,
          commissionRate: Number(editCourseForm.commissionRate) || 0,
          mouStatus: editCourseForm.mouStatus,
          contactPersonName: editCourseForm.contactPersonName,
          contactPersonPhone: editCourseForm.contactPersonPhone,
        },
        admissionStatus: editCourseForm.admissionStatus,
        quotaType: editCourseForm.quotaType,
      };

      const res = await api.put(`/catalogue/my-catalogue/${editingItem._id}`, {
        courses: updatedCourses,
      });

      toast.success('Fee structure & tie-up details saved! ✅');
      setMyCatalogue(prev => prev.map(item => (item._id === editingItem._id ? res.data.catalogueItem : item)));
      setShowEditModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update course');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered lists
  const filteredMaster = useMemo(() => {
    return masterColleges.filter(col => {
      const matchesSearch = !searchQuery.trim() || [
        col.name,
        col.shortCode,
        col.location?.city,
        col.location?.state,
        col.location?.country,
        ...(col.availableDegrees || []),
      ].some(str => str && String(str).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCountry = countryFilter === 'all' || (col.location?.country || 'India').toLowerCase() === countryFilter.toLowerCase();
      return matchesSearch && matchesCountry;
    });
  }, [masterColleges, searchQuery, countryFilter]);

  const filteredMyCatalogue = useMemo(() => {
    return myCatalogue.filter(item => {
      const matchesSearch = !searchQuery.trim() || [
        item.customCollegeName,
        item.location?.city,
        item.location?.state,
        item.location?.country,
        ...(item.courses || []).map(c => `${c.degreeName} ${c.specialization}`),
      ].some(str => str && String(str).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCountry = countryFilter === 'all' || (item.location?.country || 'India').toLowerCase() === countryFilter.toLowerCase();
      return matchesSearch && matchesCountry;
    });
  }, [myCatalogue, searchQuery, countryFilter]);

  return (
    <div className="page-container" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
            }}>
              <GraduationCap size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                Education Hybrid Catalogue
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                1-Click College Import & Dynamic Fee Structure Management
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => loadAllCatalogueData()}
            disabled={loading}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Refresh Catalogue"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        background: 'var(--surface-sunken, rgba(255,255,255,0.03))',
        padding: 4,
        borderRadius: 14,
        border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        <button
          onClick={() => setActiveTab('my_catalogue')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: activeTab === 'my_catalogue' ? 'var(--surface, #1e293b)' : 'transparent',
            color: activeTab === 'my_catalogue' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: activeTab === 'my_catalogue' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Building2 size={16} />
          <span>My Active Catalogue</span>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 20,
            background: activeTab === 'my_catalogue' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255,255,255,0.06)',
            color: activeTab === 'my_catalogue' ? 'var(--accent)' : 'var(--text-muted)',
          }}>
            {myCatalogue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('master_explore')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: activeTab === 'master_explore' ? 'var(--surface, #1e293b)' : 'transparent',
            color: activeTab === 'master_explore' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: activeTab === 'master_explore' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Sparkles size={16} />
          <span>Explore Master Repository</span>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 20,
            background: activeTab === 'master_explore' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255,255,255,0.06)',
            color: activeTab === 'master_explore' ? 'var(--accent)' : 'var(--text-muted)',
          }}>
            {masterColleges.length}
          </span>
        </button>
      </div>

      {/* Search & Country Filter Bar */}
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder={activeTab === 'my_catalogue' ? 'Search in your catalogue (e.g. VIT, MBA, B.Tech, Boston)...' : 'Search Master Repository for colleges, specializations, degrees...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 38, height: 42, borderRadius: 12 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Regions' },
            { id: 'india', label: '🇮🇳 India' },
            { id: 'usa', label: '🇺🇸 USA' },
            { id: 'united kingdom', label: '🇬🇧 UK' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setCountryFilter(c.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: countryFilter === c.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: countryFilter === c.id ? 'rgba(79, 70, 229, 0.12)' : 'var(--surface)',
                color: countryFilter === c.id ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MY ACTIVE CUSTOM CATALOGUE
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'my_catalogue' && (
        <div>
          {filteredMyCatalogue.length === 0 ? (
            <div style={{
              background: 'var(--surface)',
              border: '1px dashed var(--border)',
              borderRadius: 16,
              padding: '40px 20px',
              textAlign: 'center',
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(79, 70, 229, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                marginBottom: 14,
              }}>
                <Building2 size={28} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px', color: 'var(--text)' }}>
                Your Custom Catalogue is Empty
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto 18px', lineHeight: 1.4 }}>
                Explore the global Master Repository and 1-click import universities with pre-built course specializations and customizable fee models.
              </p>
              <button
                onClick={() => setActiveTab('master_explore')}
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Sparkles size={16} />
                <span>Explore Master Repository</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredMyCatalogue.map((college) => {
                const isExpanded = expandedCollegeId === college._id;
                return (
                  <div
                    key={college._id}
                    style={{
                      background: 'var(--surface)',
                      border: isExpanded ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 16,
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.2)' : 'none',
                    }}
                  >
                    {/* Header Card */}
                    <div
                      onClick={() => setExpandedCollegeId(isExpanded ? null : college._id)}
                      style={{
                        padding: '16px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                        background: isExpanded ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent)',
                          fontWeight: 800,
                          fontSize: 16,
                          flexShrink: 0,
                          border: '1px solid var(--border)',
                        }}>
                          {college.customCollegeName.charAt(0)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                              {college.customCollegeName}
                            </h3>
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(79, 70, 229, 0.15)',
                              color: 'var(--accent)',
                              border: '1px solid rgba(79, 70, 229, 0.3)',
                            }}>
                              {college.collegeType}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={13} color="var(--text-muted)" />
                              {college.location?.city ? `${college.location.city}, ${college.location.state || college.location.country}` : (college.location?.country || 'India')}
                            </span>
                            <span>•</span>
                            <span><strong>{college.courses?.length || 0}</strong> Course Streams Configured</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCatalogueItem(college._id, college.customCollegeName);
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Remove from Catalogue"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                        }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Accordion Content: Courses & Custom Fees */}
                    {isExpanded && (
                      <div style={{
                        padding: '16px 18px',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--surface-sunken, rgba(0,0,0,0.15))',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Course Specializations & Fee Setup
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Click &ldquo;Configure Fees&rdquo; on any course to adjust package pricing or commission tie-ups
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {(college.courses || []).map((course, cIdx) => {
                            const statusObj = ADMISSION_STATUS_LABELS[course.admissionStatus] || ADMISSION_STATUS_LABELS.admissions_open;
                            const mouObj = MOU_STATUS_LABELS[course.customTieUpDetails?.mouStatus] || MOU_STATUS_LABELS.direct_tie_up;

                            return (
                              <div
                                key={course._id || cIdx}
                                style={{
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 12,
                                  padding: '12px 16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 12,
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                                      {course.degreeName}
                                    </h4>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>
                                      {course.specialization || 'General'}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, marginTop: 6, flexWrap: 'wrap' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                      Tuition: <strong style={{ color: '#10b981' }}>₹{(course.customFeeStructure?.annualTuitionFee || 0).toLocaleString()}</strong>/yr
                                    </span>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                      Package: <strong style={{ color: 'var(--text)' }}>₹{(course.customFeeStructure?.packageFee || 0).toLocaleString()}</strong>
                                    </span>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      background: statusObj.bg,
                                      color: statusObj.text,
                                      border: `1px solid ${statusObj.border}`,
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                    }}>
                                      {statusObj.label}
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: mouObj.color }}>
                                      {mouObj.label} ({course.customTieUpDetails?.commissionRate || 10}% Payout)
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleOpenCourseEditor(college, course, cIdx)}
                                  className="btn btn-secondary"
                                  style={{
                                    fontSize: 11.5,
                                    padding: '7px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    borderRadius: 8,
                                    fontWeight: 700,
                                  }}
                                >
                                  <Edit3 size={13} color="var(--accent)" />
                                  <span>Configure Fees & Tie-up</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: EXPLORE MASTER REPOSITORY (GLOBAL DATABASE)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'master_explore' && (
        <div>
          <div style={{
            background: 'rgba(79, 70, 229, 0.05)',
            border: '1px solid rgba(79, 70, 229, 0.25)',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div>
              <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: '0 0 2px', color: 'var(--text)' }}>
                Global Master College Repository (Read-Only Structure)
              </h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                Click &ldquo;Add to My Catalogue&rdquo; to import any college. All degrees & specializations will be automatically mapped into your CRM.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {filteredMaster.map((college) => {
              const isAlreadyInCatalogue = myCatalogue.some(mc => String(mc.masterCollegeId?._id || mc.masterCollegeId) === String(college._id));
              const isImporting = importingId === college._id;

              return (
                <div
                  key={college._id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: 'rgba(79, 70, 229, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent)',
                          fontWeight: 800,
                          fontSize: 14,
                          border: '1px solid rgba(79, 70, 229, 0.2)',
                        }}>
                          {college.name.charAt(0)}
                        </div>
                        <div>
                          <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                            {college.name}
                          </h4>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {college.shortCode && `${college.shortCode} • `}{college.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={13} color="var(--text-muted)" />
                        <span>{college.location?.city ? `${college.location.city}, ${college.location.state || college.location.country}` : college.location?.country}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BookOpen size={13} color="var(--text-muted)" />
                        <span><strong>{college.coursesCount || college.courses?.length || 0}</strong> Degree Offerings Available</span>
                      </div>
                    </div>

                    {/* Accreditations & Degrees tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                      {(college.accreditation || []).slice(0, 3).map((acc, i) => (
                        <span key={i} style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,0.05)',
                          color: 'var(--text-muted)',
                        }}>
                          {acc}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    {isAlreadyInCatalogue ? (
                      <button
                        onClick={() => {
                          setActiveTab('my_catalogue');
                          setExpandedCollegeId(myCatalogue.find(mc => String(mc.masterCollegeId?._id || mc.masterCollegeId) === String(college._id))?._id);
                        }}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>In My Catalogue (Click to View)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleImportCollege(college)}
                        disabled={isImporting}
                        className="btn btn-primary"
                        style={{
                          width: '100%',
                          fontSize: 12,
                          padding: '9px 12px',
                          borderRadius: 10,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        {isImporting ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Auto-mapping courses...</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>1-Click Import to My Catalogue</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CONFIGURE FEE STRUCTURE & COMMERCIAL TIE-UP
          ───────────────────────────────────────────────────────────── */}
      {showEditModal && editCourseForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            width: '100%',
            maxWidth: 520,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                  Configure Course & Fee Model
                </h3>
                <p style={{ fontSize: 12, color: 'var(--accent)', margin: '2px 0 0', fontWeight: 600 }}>
                  {editingItem?.customCollegeName} • {editCourseForm.degreeName} ({editCourseForm.specialization})
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCourseCustomization} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Fee Pricing */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                <label className="label" style={{ fontWeight: 700, marginBottom: 8, color: 'var(--accent)' }}>
                  💰 Fee Structure (User Controlled)
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Annual Tuition Fee (₹ / $)</label>
                    <input
                      type="number"
                      className="input"
                      value={editCourseForm.annualTuitionFee}
                      onChange={(e) => setEditCourseForm(f => ({ ...f, annualTuitionFee: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Total Package Fee (₹ / $)</label>
                    <input
                      type="number"
                      className="input"
                      value={editCourseForm.packageFee}
                      onChange={(e) => setEditCourseForm(f => ({ ...f, packageFee: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Hostel / Year (₹ / $)</label>
                    <input
                      type="number"
                      className="input"
                      value={editCourseForm.hostelFeePerYear}
                      onChange={(e) => setEditCourseForm(f => ({ ...f, hostelFeePerYear: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Currency</label>
                    <select
                      className="input"
                      value={editCourseForm.currency}
                      onChange={(e) => setEditCourseForm(f => ({ ...f, currency: e.target.value }))}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Commercial Tie-Up & Commission */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                <label className="label" style={{ fontWeight: 700, marginBottom: 8, color: 'var(--accent)' }}>
                  🤝 Commercial Tie-Up & Payout
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>MOU / Partnership Status</label>
                    <select
                      className="input"
                      value={editCourseForm.mouStatus}
                      onChange={(e) => setEditCourseForm(f => ({ ...f, mouStatus: e.target.value }))}
                    >
                      <option value="direct_tie_up">Direct Tie-up</option>
                      <option value="sub_agent_mou">Sub-Agent MOU</option>
                      <option value="informal_tie_up">Informal Campus Contact</option>
                      <option value="none">No Tie-up</option>
                    </select>
                  </div>

                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Commission Rate (%)</label>
                    <input
                      type="number"
                      className="input"
                      value={editCourseForm.commissionRate}
                      onChange={(e) => setEditCourseForm(f => ({ ...f, commissionRate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Campus Contact Person</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Dr. Sharma (Admissions)"
                      value={editCourseForm.contactPersonName}
                      onChange={(e) => setEditCourseForm(f => ({ ...f, contactPersonName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Contact Phone</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="+91 9876543210"
                      value={editCourseForm.contactPersonPhone}
                      onChange={(e) => setEditCourseForm(f => ({ ...f, contactPersonPhone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Admission Status & Quota */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Live Admission Status</label>
                  <select
                    className="input"
                    value={editCourseForm.admissionStatus}
                    onChange={(e) => setEditCourseForm(f => ({ ...f, admissionStatus: e.target.value }))}
                  >
                    <option value="admissions_open">Admissions Open</option>
                    <option value="seats_fast_filling">Seats Fast Filling</option>
                    <option value="merit_closed_mgmt_open">Merit Closed (Mgmt Open)</option>
                    <option value="admissions_closed">Admissions Closed</option>
                  </select>
                </div>

                <div>
                  <label className="label">Quota Category</label>
                  <select
                    className="input"
                    value={editCourseForm.quotaType}
                    onChange={(e) => setEditCourseForm(f => ({ ...f, quotaType: e.target.value }))}
                  >
                    <option value="management_quota">Management Quota</option>
                    <option value="merit_counselling">Merit Counselling</option>
                    <option value="nri_quota">NRI / Foreign Quota</option>
                    <option value="institutional_direct">Institutional Direct</option>
                    <option value="scholarship_seat">Scholarship Seat</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: 42, borderRadius: 10 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 42, borderRadius: 10 }}
                >
                  {submitting ? 'Saving...' : 'Save Fee & Tie-Up Details ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Navigation */}
      <BottomNav active="catalogue" />
    </div>
  );
}
