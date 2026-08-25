'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Flame, Zap, Snowflake, Home, Sparkles, Building, CheckCircle2,
  Calendar, DollarSign, Plus, ChevronDown, ChevronUp, FileText,
  KeyRound, TrendingUp, AlertCircle, RefreshCw, X, Check
} from 'lucide-react';

export default function RealEstateLeadPanel({ lead, onLeadUpdate }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, requirements, matching, deals, eoi_booking
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);

  // Requirements State
  const [requirements, setRequirements] = useState([]);
  const [showAddReqModal, setShowAddReqModal] = useState(false);
  const [reqForm, setReqForm] = useState({
    title: '3BHK Apartment Requirement',
    propertyType: 'Apartment',
    configurations: '3BHK',
    preferredLocations: 'Noida Expressway',
    budgetMin: '7500000',
    budgetMax: '12000000',
    purpose: 'End Use',
    possessionPreference: 'Ready to Move',
  });

  // Matching State
  const [matches, setMatches] = useState([]);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Opportunities / Deals State
  const [opportunities, setOpportunities] = useState([]);
  const [showAddOppModal, setShowAddOppModal] = useState(false);
  const [projectsList, setProjectsList] = useState([]);
  const [oppForm, setOppForm] = useState({
    projectId: '',
    title: '',
    stage: 'Site Visit Scheduled',
    expectedValue: '',
  });

  // EOI & Booking State
  const [eois, setEois] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [showEoiModal, setShowEoiModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedProjectForUnit, setSelectedProjectForUnit] = useState('');
  
  const [eoiForm, setEoiForm] = useState({
    projectId: '',
    inventoryId: '',
    tokenAmount: '100000',
    paymentMode: 'UPI',
    paymentReference: '',
    notes: '',
  });

  const [bookingForm, setBookingForm] = useState({
    projectId: '',
    inventoryId: '',
    bookingAmount: '500000',
    agreementValue: '9500000',
    paymentPlan: 'CLP',
  });

  const leadId = lead?._id;

  // Load Initial Domain Data
  const loadDomainData = async () => {
    if (!leadId) return;
    try {
      const [reqRes, oppRes, eoiRes, bkRes, projRes] = await Promise.all([
        api.get(`/real-estate/requirements?leadId=${leadId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/real-estate/opportunities?leadId=${leadId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/real-estate/eois?leadId=${leadId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/real-estate/bookings?leadId=${leadId}`).catch(() => ({ data: { data: [] } })),
        api.get('/projects').catch(() => ({ data: [] })),
      ]);

      setRequirements(reqRes.data?.data || []);
      setOpportunities(oppRes.data?.data || []);
      setEois(eoiRes.data?.data || []);
      setBookings(bkRes.data?.data || []);
      setProjectsList(projRes.data || []);
    } catch (e) {
      console.error('Failed to load real estate domain data', e);
    }
  };

  useEffect(() => {
    loadDomainData();
  }, [leadId]);

  // Load Inventory for selected project
  useEffect(() => {
    if (selectedProjectForUnit) {
      api.get(`/real-estate/inventory?projectId=${selectedProjectForUnit}&status=AVAILABLE`)
        .then((res) => setInventoryList(res.data?.data || []))
        .catch(() => setInventoryList([]));
    } else {
      setInventoryList([]);
    }
  }, [selectedProjectForUnit]);

  // Handle Recalculate Score
  const handleRecalculateScore = async () => {
    if (!leadId) return;
    setScoring(true);
    try {
      const res = await api.post(`/real-estate/leads/${leadId}/score`);
      if (res.data?.data) {
        toast.success(`Score updated: ${res.data.data.score}/100 (${res.data.data.temperature})`);
        if (onLeadUpdate) {
          onLeadUpdate((prev) => ({
            ...prev,
            score: res.data.data.score,
            temperature: res.data.data.temperature,
            scoringBreakdown: res.data.data.breakdown,
          }));
        }
      }
    } catch (err) {
      toast.error('Failed to calculate score');
    } finally {
      setScoring(false);
    }
  };

  // Handle Match Properties
  const handleFindMatches = async () => {
    if (!leadId) return;
    setMatchingLoading(true);
    try {
      const res = await api.post('/real-estate/match-properties', { leadId });
      setMatches(res.data?.data || []);
      setActiveTab('matching');
      toast.success(`Found ${res.data?.data?.length || 0} matching properties!`);
    } catch (e) {
      toast.error('Property matching failed');
    } finally {
      setMatchingLoading(false);
    }
  };

  // Handle Create Requirement
  const handleCreateRequirement = async (e) => {
    e.preventDefault();
    try {
      await api.post('/real-estate/requirements', {
        leadId,
        title: reqForm.title,
        propertyType: reqForm.propertyType,
        configurations: [reqForm.configurations],
        preferredLocations: reqForm.preferredLocations.split(',').map((s) => s.trim()),
        budgetMin: Number(reqForm.budgetMin),
        budgetMax: Number(reqForm.budgetMax),
        purpose: reqForm.purpose,
        possessionPreference: reqForm.possessionPreference,
      });
      toast.success('Property requirement added');
      setShowAddReqModal(false);
      loadDomainData();
      handleRecalculateScore();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add requirement');
    }
  };

  // Handle Create Opportunity
  const handleCreateOpportunity = async (e) => {
    e.preventDefault();
    if (!oppForm.projectId) return toast.error('Please select a project');
    try {
      await api.post('/real-estate/opportunities', {
        leadId,
        projectId: oppForm.projectId,
        title: oppForm.title,
        stage: oppForm.stage,
        expectedValue: Number(oppForm.expectedValue),
      });
      toast.success('Opportunity created');
      setShowAddOppModal(false);
      loadDomainData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create opportunity');
    }
  };

  // Handle Stage Progression
  const handleStageChange = async (oppId, newStage) => {
    try {
      await api.patch(`/real-estate/opportunities/${oppId}/stage`, { stage: newStage });
      toast.success(`Deal moved to ${newStage}`);
      loadDomainData();
      handleRecalculateScore();
    } catch (err) {
      toast.error('Failed to change stage');
    }
  };

  // Handle Create EOI
  const handleCreateEOI = async (e) => {
    e.preventDefault();
    if (!eoiForm.projectId || !eoiForm.tokenAmount) return toast.error('Project and Token Amount are required');
    try {
      await api.post('/real-estate/eois', {
        leadId,
        projectId: eoiForm.projectId,
        inventoryId: eoiForm.inventoryId || undefined,
        tokenAmount: Number(eoiForm.tokenAmount),
        paymentMode: eoiForm.paymentMode,
        paymentReference: eoiForm.paymentReference,
        notes: eoiForm.notes,
      });
      toast.success('Expression of Interest submitted');
      setShowEoiModal(false);
      loadDomainData();
      handleRecalculateScore();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit EOI');
    }
  };

  // Handle Create Booking
  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!bookingForm.projectId || !bookingForm.inventoryId || !bookingForm.bookingAmount || !bookingForm.agreementValue) {
      return toast.error('Project, Unit, Booking Amount and Agreement Value are mandatory.');
    }
    try {
      await api.post('/real-estate/bookings', {
        leadId,
        projectId: bookingForm.projectId,
        inventoryId: bookingForm.inventoryId,
        bookingAmount: Number(bookingForm.bookingAmount),
        agreementValue: Number(bookingForm.agreementValue),
        paymentPlan: bookingForm.paymentPlan,
      });
      toast.success('Booking confirmed & payment milestones generated!');
      setShowBookingModal(false);
      loadDomainData();
      handleRecalculateScore();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    }
  };

  const temperature = lead?.temperature || 'WARM';
  const score = lead?.score || 0;

  return (
    <div className="card" style={{ marginTop: 16, border: '1px solid #e0e7ff', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Header Bar */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Building size={18} color="#4f46e5" />
          <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>Real Estate Domain Portal</span>
          
          {/* Temperature Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            background: temperature === 'HOT' ? '#fee2e2' : temperature === 'COLD' ? '#e0f2fe' : '#fef3c7',
            color: temperature === 'HOT' ? '#dc2626' : temperature === 'COLD' ? '#0284c7' : '#d97706',
          }}>
            {temperature === 'HOT' ? <Flame size={13} /> : temperature === 'COLD' ? <Snowflake size={13} /> : <Zap size={13} />}
            <span>{temperature}</span>
            <span style={{ opacity: 0.7, fontSize: 11 }}>({score} pts)</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleRecalculateScore}
            disabled={scoring}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12, padding: '4px 10px', height: 32, gap: 5 }}
            title="Recalculate lead temperature and scoring breakdown"
          >
            <RefreshCw size={13} className={scoring ? 'animate-spin' : ''} />
            <span>Score Engine</span>
          </button>

          <button
            onClick={handleFindMatches}
            disabled={matchingLoading}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12, padding: '4px 12px', height: 32, gap: 5, background: '#4f46e5' }}
          >
            <Sparkles size={13} />
            <span>Match Properties</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 12px' }}>
        {[
          { id: 'overview', label: 'Scoring & Overview', icon: TrendingUp },
          { id: 'requirements', label: `Requirements (${requirements.length})`, icon: Home },
          { id: 'matching', label: `Matches (${matches.length})`, icon: Sparkles },
          { id: 'deals', label: `Deals / Opportunities (${opportunities.length})`, icon: KeyRound },
          { id: 'eoi_booking', label: `EOI & Bookings (${eois.length + bookings.length})`, icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#4f46e5' : '#64748b',
                borderBottom: isActive ? '2px solid #4f46e5' : '2px solid transparent',
                background: 'none',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Panels */}
      <div style={{ padding: 18 }}>
        {/* 1. OVERVIEW & SCORING BREAKDOWN */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#ffffff', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Lead Score</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{score} <span style={{ fontSize: 13, color: '#94a3b8' }}>/ 100</span></div>
              </div>
              <div style={{ background: '#ffffff', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Temperature</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: temperature === 'HOT' ? '#dc2626' : temperature === 'COLD' ? '#0284c7' : '#d97706', marginTop: 6 }}>
                  {temperature} LEAD
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Active Requirements</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{requirements.length}</div>
              </div>
              <div style={{ background: '#ffffff', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Open Deals</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{opportunities.length}</div>
              </div>
            </div>

            {/* Explainable Factor Breakdown */}
            <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Explainable Scoring Breakdown</span>
              </div>
              {lead?.scoringBreakdown && lead.scoringBreakdown.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lead.scoringBreakdown.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 10px', background: '#f8fafc', borderRadius: 6 }}>
                      <span style={{ color: '#475569' }}>{item.factor}</span>
                      <span style={{ fontWeight: 600, color: item.points >= 0 ? '#16a34a' : '#dc2626' }}>
                        {item.points > 0 ? `+${item.points}` : item.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Click 'Score Engine' to generate an explainable score breakdown.</p>
              )}
            </div>
          </div>
        )}

        {/* 2. REQUIREMENTS TAB */}
        {activeTab === 'requirements' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Customer Property Requirements</span>
              <button onClick={() => setShowAddReqModal(true)} className="btn btn-secondary btn-sm" style={{ gap: 4, fontSize: 12 }}>
                <Plus size={13} /> Add Requirement
              </button>
            </div>

            {requirements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: 13 }}>
                No requirements recorded yet for this client. Click 'Add Requirement' to capture BHK and budget preferences.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {requirements.map((req) => (
                  <div key={req._id} style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{req.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      <strong>Type:</strong> {req.propertyType} | <strong>Configs:</strong> {req.configurations?.join(', ')}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      <strong>Budget:</strong> ₹{(req.budgetMin / 100000).toFixed(0)}L - ₹{(req.budgetMax / 100000).toFixed(0)}L
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      <strong>Locations:</strong> {req.preferredLocations?.join(', ')}
                    </div>
                    <div style={{ marginTop: 8, display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>
                      {req.possessionPreference} • {req.purpose}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. MATCHING PROPERTIES TAB */}
        {activeTab === 'matching' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Matched Projects & Available Units</span>
              <button onClick={handleFindMatches} disabled={matchingLoading} className="btn btn-secondary btn-sm" style={{ gap: 4, fontSize: 12 }}>
                <RefreshCw size={13} className={matchingLoading ? 'animate-spin' : ''} /> Refresh Matches
              </button>
            </div>

            {matches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: 13 }}>
                Click 'Match Properties' to run the deterministic matching engine against active projects.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {matches.map((item, idx) => (
                  <div key={idx} style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{item.project.name}</div>
                        <div style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
                          {item.matchScore}% Match
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.project.location}, {item.project.city}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#4f46e5', marginTop: 6 }}>
                        {item.project.basePrice || `₹${item.project.minPrice ? (item.project.minPrice / 100000).toFixed(0) + 'L' : 'On Request'}`}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                        {item.matchedFactors.map((mf, i) => (
                          <span key={i} style={{ fontSize: 10, background: '#f8fafc', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: 4, color: '#334155' }}>
                            ✓ {mf}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        <strong>{item.availableInventoryCount}</strong> units available
                      </span>
                      <button
                        onClick={() => {
                          setOppForm((p) => ({ ...p, projectId: item.project._id, title: `${lead.name} - ${item.project.name}`, expectedValue: item.project.minPrice || '' }));
                          setShowAddOppModal(true);
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11, padding: '3px 8px', height: 26 }}
                      >
                        Create Deal
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. OPPORTUNITIES / DEALS TAB */}
        {activeTab === 'deals' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Active Property Deals</span>
              <button onClick={() => setShowAddOppModal(true)} className="btn btn-secondary btn-sm" style={{ gap: 4, fontSize: 12 }}>
                <Plus size={13} /> Add Deal
              </button>
            </div>

            {opportunities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: 13 }}>
                No active deals. Link a project to this lead by creating an Opportunity.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {opportunities.map((opp) => (
                  <div key={opp._id} style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{opp.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          Project: <strong>{opp.projectId?.name}</strong> • Value: <strong>₹{(opp.expectedValue / 100000).toFixed(1)}L</strong> ({opp.probability}% probability)
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <select
                          value={opp.stage}
                          onChange={(e) => handleStageChange(opp._id, e.target.value)}
                          className="input"
                          style={{ fontSize: 12, padding: '4px 8px', height: 32, borderRadius: 6, fontWeight: 600 }}
                        >
                          {['New Inquiry', 'Contacted', 'Requirement Qualified', 'Property Shared', 'Site Visit Scheduled', 'Site Visit Completed', 'Negotiation', 'EOI Submitted', 'Booking Confirmed', 'Closed Lost'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. EOI & BOOKINGS TAB */}
        {activeTab === 'eoi_booking' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setShowEoiModal(true)} className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
                + Submit EOI
              </button>
              <button onClick={() => setShowBookingModal(true)} className="btn btn-primary btn-sm" style={{ fontSize: 12, background: '#10b981' }}>
                + Formal Booking
              </button>
            </div>

            {/* Bookings */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Property Bookings</div>
              {bookings.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No confirmed bookings yet.</div>
              ) : (
                bookings.map((bk) => (
                  <div key={bk._id} style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#065f46' }}>Booking No: {bk.bookingNumber}</div>
                    <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                      Project: {bk.projectId?.name} • Unit: {bk.inventoryId?.unitNumber || 'Assigned'} • Value: ₹{(bk.agreementValue / 100000).toFixed(2)}L
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* EOIs */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Expressions of Interest (EOI)</div>
              {eois.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No active EOIs.</div>
              ) : (
                eois.map((eoi) => (
                  <div key={eoi._id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{eoi.eoiNumber} - Status: {eoi.status}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Project: {eoi.projectId?.name} • Token: ₹{(eoi.tokenAmount / 1000).toFixed(0)}k ({eoi.paymentStatus})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Requirement Modal */}
      {showAddReqModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 450, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>Add Property Requirement</span>
              <button onClick={() => setShowAddReqModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRequirement} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Requirement Title</label>
                <input type="text" className="input" value={reqForm.title} onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Property Type</label>
                  <select className="input" value={reqForm.propertyType} onChange={(e) => setReqForm({ ...reqForm, propertyType: e.target.value })}>
                    {['Apartment', 'Villa', 'Plot', 'Commercial', 'Penthouse'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Configuration</label>
                  <select className="input" value={reqForm.configurations} onChange={(e) => setReqForm({ ...reqForm, configurations: e.target.value })}>
                    {['1BHK', '2BHK', '3BHK', '4BHK', 'Studio', 'Villa', 'Plot'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Min Budget (₹)</label>
                  <input type="number" className="input" value={reqForm.budgetMin} onChange={(e) => setReqForm({ ...reqForm, budgetMin: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Max Budget (₹)</label>
                  <input type="number" className="input" value={reqForm.budgetMax} onChange={(e) => setReqForm({ ...reqForm, budgetMax: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Preferred Locations (comma separated)</label>
                <input type="text" className="input" value={reqForm.preferredLocations} onChange={(e) => setReqForm({ ...reqForm, preferredLocations: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>Save Requirement</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Deal / Opportunity Modal */}
      {showAddOppModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 450, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>Create Property Deal</span>
              <button onClick={() => setShowAddOppModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateOpportunity} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Select Project</label>
                <select
                  className="input"
                  value={oppForm.projectId}
                  onChange={(e) => {
                    const sel = projectsList.find((p) => p._id === e.target.value);
                    setOppForm({
                      ...oppForm,
                      projectId: e.target.value,
                      title: sel ? `${lead.name} - ${sel.name}` : oppForm.title,
                      expectedValue: sel?.minPrice || oppForm.expectedValue,
                    });
                  }}
                  required
                >
                  <option value="">-- Choose Project --</option>
                  {projectsList.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.location})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Deal Title</label>
                <input type="text" className="input" value={oppForm.title} onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Expected Deal Value (₹)</label>
                <input type="number" className="input" value={oppForm.expectedValue} onChange={(e) => setOppForm({ ...oppForm, expectedValue: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>Create Deal</button>
            </form>
          </div>
        </div>
      )}

      {/* Submit EOI Modal */}
      {showEoiModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 450, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>Submit Expression of Interest (EOI)</span>
              <button onClick={() => setShowEoiModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateEOI} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Project</label>
                <select
                  className="input"
                  value={eoiForm.projectId}
                  onChange={(e) => {
                    setEoiForm({ ...eoiForm, projectId: e.target.value });
                    setSelectedProjectForUnit(e.target.value);
                  }}
                  required
                >
                  <option value="">-- Select Project --</option>
                  {projectsList.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Select Unit for Hold (Optional)</label>
                <select
                  className="input"
                  value={eoiForm.inventoryId}
                  onChange={(e) => setEoiForm({ ...eoiForm, inventoryId: e.target.value })}
                >
                  <option value="">-- No specific unit lock --</option>
                  {inventoryList.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.tower} - Unit {u.unitNumber} ({u.configuration}) - ₹{(u.totalPrice / 100000).toFixed(1)}L
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Token Amount (₹)</label>
                <input type="number" className="input" value={eoiForm.tokenAmount} onChange={(e) => setEoiForm({ ...eoiForm, tokenAmount: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Payment Mode</label>
                <select className="input" value={eoiForm.paymentMode} onChange={(e) => setEoiForm({ ...eoiForm, paymentMode: e.target.value })}>
                  {['UPI', 'Cheque', 'Bank Transfer', 'Credit Card', 'Cash'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>Submit EOI</button>
            </form>
          </div>
        </div>
      )}

      {/* Formal Booking Modal */}
      {showBookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 450, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>Confirm Property Booking</span>
              <button onClick={() => setShowBookingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateBooking} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Project</label>
                <select
                  className="input"
                  value={bookingForm.projectId}
                  onChange={(e) => {
                    setBookingForm({ ...bookingForm, projectId: e.target.value });
                    setSelectedProjectForUnit(e.target.value);
                  }}
                  required
                >
                  <option value="">-- Select Project --</option>
                  {projectsList.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Select Inventory Unit (Mandatory)</label>
                <select
                  className="input"
                  value={bookingForm.inventoryId}
                  onChange={(e) => {
                    const selUnit = inventoryList.find((u) => u._id === e.target.value);
                    setBookingForm({
                      ...bookingForm,
                      inventoryId: e.target.value,
                      agreementValue: selUnit?.totalPrice || bookingForm.agreementValue,
                    });
                  }}
                  required
                >
                  <option value="">-- Select Unit to Book --</option>
                  {inventoryList.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.tower} - Unit {u.unitNumber} ({u.configuration}) - ₹{(u.totalPrice / 100000).toFixed(1)}L
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Booking Amount (₹)</label>
                  <input type="number" className="input" value={bookingForm.bookingAmount} onChange={(e) => setBookingForm({ ...bookingForm, bookingAmount: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Agreement Value (₹)</label>
                  <input type="number" className="input" value={bookingForm.agreementValue} onChange={(e) => setBookingForm({ ...bookingForm, agreementValue: e.target.value })} required />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Payment Plan</label>
                <select className="input" value={bookingForm.paymentPlan} onChange={(e) => setBookingForm({ ...bookingForm, paymentPlan: e.target.value })}>
                  <option value="CLP">Construction Linked Plan (CLP)</option>
                  <option value="Down_Payment">Down Payment Plan</option>
                  <option value="Subvention_20_80">20:80 Subvention Scheme</option>
                  <option value="Custom">Custom Milestone Schedule</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 10, background: '#10b981' }}>Confirm Booking & Lock Unit</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
