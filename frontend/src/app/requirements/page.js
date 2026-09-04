'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, isOwner, isManager, isAgent, getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  CheckSquare, Plus, Search, Filter, Sparkles, Building2,
  MapPin, DollarSign, Calendar, ChevronRight, CheckCircle2,
  AlertCircle, RefreshCw, Eye, ArrowRight
} from 'lucide-react';

function RequirementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab') || 'active';
  const activeTab = rawTab;

  const [user, setUser] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Property Matching State
  const [selectedReqForMatching, setSelectedReqForMatching] = useState(null);
  const [matchingResults, setMatchingResults] = useState([]);
  const [isMatching, setIsMatching] = useState(false);

  // Create Requirement Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reqForm, setReqForm] = useState({
    leadId: '',
    title: '',
    propertyType: 'APARTMENT',
    configurations: ['3BHK'],
    preferredLocations: '',
    budgetMin: '',
    budgetMax: '',
    possessionTimeline: 'READY_TO_MOVE',
    purpose: 'END_USE',
    notes: '',
  });

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const formatINR = (val) => {
    if (!val || isNaN(val)) return null;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, leadsRes] = await Promise.all([
        api.get('/real-estate/requirements'),
        api.get('/leads?limit=100').catch(() => ({ data: { leads: [] } })),
      ]);
      setRequirements(reqRes.data?.data || []);
      setLeads(leadsRes.data?.leads || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load requirements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  const handleMatchProperties = async (reqItem) => {
    setSelectedReqForMatching(reqItem);
    setIsMatching(true);
    try {
      const res = await api.post('/real-estate/match-properties', {
        requirementId: reqItem._id,
      });
      setMatchingResults(res.data?.data || []);
      router.push('/requirements?tab=matching');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Property matching failed');
    } finally {
      setIsMatching(false);
    }
  };

  const handleToggleStatus = async (reqId) => {
    try {
      await api.patch(`/real-estate/requirements/${reqId}/status`);
      toast.success('Requirement status updated');
      fetchRequirements();
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  };

  const handleCreateRequirement = async (e) => {
    e.preventDefault();
    if (!reqForm.leadId) {
      toast.error('Please select a lead');
      return;
    }

    try {
      await api.post('/real-estate/requirements', {
        ...reqForm,
        preferredLocations: reqForm.preferredLocations ? reqForm.preferredLocations.split(',').map(s => s.trim()) : [],
        budgetMin: reqForm.budgetMin ? Number(reqForm.budgetMin) : undefined,
        budgetMax: reqForm.budgetMax ? Number(reqForm.budgetMax) : undefined,
      });
      toast.success('Requirement successfully created!');
      setShowCreateModal(false);
      setReqForm({
        leadId: '',
        title: '',
        propertyType: 'APARTMENT',
        configurations: ['3BHK'],
        preferredLocations: '',
        budgetMin: '',
        budgetMax: '',
        possessionTimeline: 'READY_TO_MOVE',
        purpose: 'END_USE',
        notes: '',
      });
      fetchRequirements();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create requirement');
    }
  };

  const filteredRequirements = requirements.filter(r => {
    if (activeTab === 'high_priority') {
      return r.status === 'ACTIVE' && ((r.budgetMax || 0) >= 10000000 || r.possessionTimeline === 'READY_TO_MOVE');
    }
    if (activeTab === 'active') {
      return r.status === 'ACTIVE';
    }
    return true;
  });

  return (
    <div className="app-container">
      <BottomNav active="requirements" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5">
                <CheckSquare size={24} className="text-indigo-600 shrink-0" /> Client Requirements & Property Matcher
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Capture buyer preferences, configurations, budgets and match with available live project inventory.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1 sm:pt-0">
              <button
                onClick={fetchRequirements}
                className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center"
                style={{ gap: 6, fontSize: 13 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center"
                style={{ gap: 6, fontSize: 13 }}
              >
                <Plus size={16} /> New Requirement
              </button>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="no-scrollbar" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 12,
            marginBottom: 20,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            <button
              onClick={() => router.push('/requirements?tab=active')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'active' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'active' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'active' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Active Requirements ({requirements.filter(r => r.status === 'ACTIVE').length})
            </button>

            <button
              onClick={() => router.push('/requirements?tab=high_priority')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'high_priority' ? '#ef4444' : 'var(--surface)',
                color: activeTab === 'high_priority' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'high_priority' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              🔥 High Priority
            </button>

            <button
              onClick={() => router.push('/requirements?tab=matching')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'matching' ? '#0ea5e9' : 'var(--surface)',
                color: activeTab === 'matching' ? '#fff' : 'var(--text)',
                fontWeight: activeTab === 'matching' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              ✨ Property Matcher Results {matchingResults.length > 0 && `(${matchingResults.length})`}
            </button>
          </div>

          {/* TAB: ACTIVE & HIGH PRIORITY */}
          {(activeTab === 'active' || activeTab === 'high_priority') && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading client requirements...</p>
                </div>
              ) : filteredRequirements.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <CheckSquare size={36} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Requirements Found</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
                    Capture preferences from leads to automatically match with inventory projects.
                  </p>
                  <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
                    <Plus size={15} /> Add First Requirement
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                  {filteredRequirements.map(reqItem => (
                    <div
                      key={reqItem._id}
                      style={{
                        background: 'var(--card)',
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                            {reqItem.title || `${reqItem.propertyType} Requirement`}
                          </span>
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: reqItem.status === 'ACTIVE' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                            color: reqItem.status === 'ACTIVE' ? '#10b981' : 'var(--text-muted)'
                          }}>
                            {reqItem.status}
                          </span>
                        </div>

                        {/* Lead Info */}
                        {reqItem.leadId && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
                            <span>👤 Prospect:</span>
                            <Link href={`/leads/${reqItem.leadId._id || reqItem.leadId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                              {reqItem.leadId.name || 'View Lead Profile'}
                            </Link>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            🏠 {reqItem.propertyType}
                          </span>
                          {reqItem.configurations?.map(c => (
                            <span key={c} style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                              📐 {c}
                            </span>
                          ))}
                          {(reqItem.budgetMin || reqItem.budgetMax) && (
                            <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)', fontWeight: 700, color: '#10b981' }}>
                              💰 {formatINR(reqItem.budgetMin)} - {formatINR(reqItem.budgetMax)}
                            </span>
                          )}
                        </div>

                        {reqItem.preferredLocations && reqItem.preferredLocations.length > 0 && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={13} color="var(--accent)" />
                            <span>Locations: {reqItem.preferredLocations.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                        <button
                          onClick={() => handleToggleStatus(reqItem._id)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                        >
                          {reqItem.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          onClick={() => handleMatchProperties(reqItem)}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 12, fontWeight: 700, gap: 6 }}
                        >
                          <Sparkles size={14} /> Match Properties →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PROPERTY MATCHER RESULTS */}
          {activeTab === 'matching' && (
            <div>
              {selectedReqForMatching && (
                <div style={{
                  background: 'rgba(99,102,241,0.06)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 14,
                  padding: '14px 18px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                      Matching Against Requirement:
                    </span>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '2px 0 0' }}>
                      {selectedReqForMatching.title || selectedReqForMatching.propertyType}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 4 }}>
                      <span>Configurations: {selectedReqForMatching.configurations?.join(', ')}</span>
                      <span>Budget: {formatINR(selectedReqForMatching.budgetMin)} - {formatINR(selectedReqForMatching.budgetMax)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleMatchProperties(selectedReqForMatching)}
                    className="btn btn-ghost btn-sm"
                    style={{ gap: 6, fontSize: 12 }}
                  >
                    <RefreshCw size={13} className={isMatching ? 'animate-spin' : ''} /> Rerun Engine
                  </button>
                </div>
              )}

              {isMatching ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Calculating deterministic match scores across projects and inventory...</p>
                </div>
              ) : matchingResults.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <Sparkles size={36} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>No Matches Found</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
                    Select a client requirement to run property matching against your project inventory.
                  </p>
                  <button onClick={() => router.push('/requirements?tab=active')} className="btn btn-primary btn-sm">
                    View Requirements
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                  {matchingResults.map(item => {
                    const proj = item.project;
                    const matchScore = item.matchScore || 0;
                    const scoreColor = matchScore >= 80 ? '#10b981' : matchScore >= 50 ? '#f59e0b' : 'var(--accent)';

                    return (
                      <div
                        key={proj._id}
                        style={{
                          background: 'var(--card)',
                          borderRadius: 16,
                          border: '1px solid var(--border)',
                          padding: '18px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 14
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                              {proj.name}
                            </h3>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: 20,
                              background: `${scoreColor}18`,
                              color: scoreColor,
                              border: `1px solid ${scoreColor}40`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <Sparkles size={13} /> {matchScore}% Match
                            </div>
                          </div>

                          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                            <Building2 size={13} /> {proj.developer || 'Developer'} • <MapPin size={13} /> {proj.location || 'Location'}
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, marginBottom: 12 }}>
                            <span style={{ padding: '3px 8px', borderRadius: 4, background: 'var(--surface)', fontWeight: 700, color: '#10b981' }}>
                              💰 {formatINR(proj.minPrice)} - {formatINR(proj.maxPrice)}
                            </span>
                            <span style={{ padding: '3px 8px', borderRadius: 4, background: 'var(--surface)', fontWeight: 700, color: 'var(--accent)' }}>
                              📦 {item.availableInventoryCount || 0} Units Available
                            </span>
                          </div>

                          {/* Matching Reasons */}
                          {item.reasons && item.reasons.length > 0 && (
                            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', fontSize: 11.5 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                                Match Reasons:
                              </span>
                              <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-muted)' }}>
                                {item.reasons.map((r, idx) => (
                                  <li key={idx}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                          <Link
                            href={`/projects`}
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, textAlign: 'center', fontSize: 12 }}
                          >
                            View Inventory
                          </Link>
                          <Link
                            href={`/site-visits`}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700 }}
                          >
                            Schedule Visit →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Modal: Create Requirement */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 14px' }}>Capture Client Requirement</h3>
            
            <form onSubmit={handleCreateRequirement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Select Lead / Prospect *</label>
                <select
                  className="input"
                  required
                  value={reqForm.leadId}
                  onChange={e => setReqForm({ ...reqForm, leadId: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="">Select prospect...</option>
                  {leads.map(l => (
                    <option key={l._id} value={l._id}>👤 {l.name} ({l.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Requirement Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 3BHK Luxury Highrise in Noida Expressway"
                  value={reqForm.title}
                  onChange={e => setReqForm({ ...reqForm, title: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Property Type</label>
                  <select
                    className="input"
                    value={reqForm.propertyType}
                    onChange={e => setReqForm({ ...reqForm, propertyType: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="APARTMENT">Apartment</option>
                    <option value="VILLA">Villa</option>
                    <option value="PLOT">Plot</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="PENTHOUSE">Penthouse</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Configuration</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 2BHK, 3BHK, 4BHK"
                    value={reqForm.configurations.join(', ')}
                    onChange={e => setReqForm({ ...reqForm, configurations: e.target.value.split(',').map(s => s.trim()) })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Min Budget (₹)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 7500000"
                    value={reqForm.budgetMin}
                    onChange={e => setReqForm({ ...reqForm, budgetMin: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Max Budget (₹)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 15000000"
                    value={reqForm.budgetMax}
                    onChange={e => setReqForm({ ...reqForm, budgetMax: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Preferred Locations (comma separated)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Sector 150, Expressway, Noida Extension"
                  value={reqForm.preferredLocations}
                  onChange={e => setReqForm({ ...reqForm, preferredLocations: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Requirement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequirementsPage() {
  return (
    <Suspense fallback={null}>
      <RequirementsContent />
    </Suspense>
  );
}
