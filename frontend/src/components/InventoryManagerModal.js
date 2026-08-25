'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Building2, Plus, X, Filter, RefreshCw, KeyRound,
  CheckCircle2, AlertCircle, Clock, DollarSign, Layers,
  ChevronDown, ArrowRight, ShieldCheck, Lock, Unlock
} from 'lucide-react';

const STATUS_CONFIG = {
  AVAILABLE: { label: 'Available', bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  HOLD: { label: 'On Hold', bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  BLOCKED: { label: 'Blocked', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  BOOKED: { label: 'Booked', bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' },
  SOLD: { label: 'Sold Out', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

export default function InventoryManagerModal({ project, onClose, onUpdated }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [towerFilter, setTowerFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [configFilter, setConfigFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Unit Form State
  const [form, setForm] = useState({
    tower: 'Tower A',
    floor: '1',
    unitNumber: '',
    configuration: '3BHK',
    facing: 'East',
    carpetArea: '1250',
    superArea: '1650',
    basePrice: '8500000',
    additionalCharges: '500000',
    totalPrice: '9000000',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchInventory = useCallback(async () => {
    if (!project?._id) return;
    try {
      const res = await api.get(`/real-estate/inventory?projectId=${project._id}`);
      setUnits(res.data?.data || []);
    } catch (err) {
      toast.error('Failed to load inventory units');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [project?._id]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Handle Add Unit
  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!form.unitNumber) return toast.error('Unit number is required');

    setSaving(true);
    try {
      const payload = {
        projectId: project._id,
        tower: form.tower,
        floor: Number(form.floor) || 1,
        unitNumber: form.unitNumber.trim(),
        configuration: form.configuration,
        facing: form.facing,
        carpetArea: Number(form.carpetArea) || 0,
        superArea: Number(form.superArea) || 0,
        basePrice: Number(form.basePrice) || 0,
        additionalCharges: Number(form.additionalCharges) || 0,
        totalPrice: Number(form.totalPrice) || (Number(form.basePrice || 0) + Number(form.additionalCharges || 0)),
        notes: form.notes,
      };

      await api.post('/real-estate/inventory', payload);
      toast.success(`Unit ${form.unitNumber} added to inventory! 🏢`);
      setShowAddModal(false);
      setForm({
        tower: form.tower,
        floor: String(Number(form.floor) + 1),
        unitNumber: '',
        configuration: form.configuration,
        facing: 'East',
        carpetArea: form.carpetArea,
        superArea: form.superArea,
        basePrice: form.basePrice,
        additionalCharges: form.additionalCharges,
        totalPrice: form.totalPrice,
        notes: '',
      });
      fetchInventory();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create inventory unit');
    } finally {
      setSaving(false);
    }
  };

  // Handle Release Hold
  const handleReleaseHold = async (unitId) => {
    try {
      await api.post(`/real-estate/inventory/${unitId}/release`);
      toast.success('Unit released back to AVAILABLE status ✅');
      fetchInventory();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error('Failed to release unit hold');
    }
  };

  // Handle Block / Unblock Unit
  const handleToggleBlock = async (unitId, currentStatus) => {
    const targetStatus = currentStatus === 'BLOCKED' ? 'AVAILABLE' : 'BLOCKED';
    try {
      await api.patch(`/real-estate/inventory/${unitId}/status`, { status: targetStatus });
      toast.success(`Unit status changed to ${targetStatus}`);
      fetchInventory();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Calculate distinct towers and configurations
  const towers = ['ALL', ...new Set(units.map((u) => u.tower || 'Tower A'))];
  const configs = ['ALL', ...new Set(units.map((u) => u.configuration || '3BHK'))];

  // Filter units
  const filteredUnits = units.filter((u) => {
    if (towerFilter !== 'ALL' && (u.tower || 'Tower A') !== towerFilter) return false;
    if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
    if (configFilter !== 'ALL' && u.configuration !== configFilter) return false;
    return true;
  });

  const availableCount = units.filter((u) => u.status === 'AVAILABLE').length;
  const holdCount = units.filter((u) => u.status === 'HOLD').length;
  const bookedCount = units.filter((u) => u.status === 'BOOKED' || u.status === 'SOLD').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 860, width: '95%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-handle" />

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: 8, borderRadius: 10 }}>
              <Building2 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                {project?.name} — Inventory Management
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {project?.location} • {units.length} total units ({availableCount} available, {holdCount} on hold, {bookedCount} booked/sold)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => { setRefreshing(true); fetchInventory(); }}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 10px', height: 34 }}
              title="Refresh units"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm"
              style={{ padding: '6px 14px', height: 34, gap: 5, background: '#4f46e5' }}
            >
              <Plus size={15} /> Add Unit
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 14px', background: 'var(--surface-muted, #f8fafc)', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)', marginBottom: 14 }}>
          {/* Tower Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Tower:</span>
            <select
              value={towerFilter}
              onChange={(e) => setTowerFilter(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              {towers.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Configuration Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Type:</span>
            <select
              value={configFilter}
              onChange={(e) => setConfigFilter(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              {configs.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="HOLD">On Hold</option>
              <option value="BOOKED">Booked</option>
              <option value="SOLD">Sold</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>

        {/* Units Grid / Table */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '60dvh' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : filteredUnits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Building2 size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No inventory units matching current filters</p>
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>Click "+ Add Unit" to add towers, floors, and saleable units.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {filteredUnits.map((u) => {
                const badge = STATUS_CONFIG[u.status] || STATUS_CONFIG.AVAILABLE;
                const isHold = u.status === 'HOLD';
                const isBlocked = u.status === 'BLOCKED';

                return (
                  <div
                    key={u._id}
                    style={{
                      background: 'var(--surface, #ffffff)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                    }}
                  >
                    <div>
                      {/* Top unit banner */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          Unit {u.unitNumber}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* Details */}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                        <div><strong>Tower:</strong> {u.tower} • <strong>Floor:</strong> {u.floor}</div>
                        <div><strong>Config:</strong> {u.configuration} • <strong>Facing:</strong> {u.facing || 'East'}</div>
                        <div><strong>Area:</strong> {u.carpetArea || 0} sq.ft (Carpet) / {u.superArea || 0} (Super)</div>
                        {u.totalPrice > 0 && (
                          <div style={{ color: 'var(--accent, #4f46e5)', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                            ₹{Number(u.totalPrice).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>

                      {/* Hold banner */}
                      {isHold && (
                        <div style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: 6, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          <span>Hold expires: {u.holdExpiresAt ? new Date(u.holdExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '24h'}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border, #f1f5f9)', paddingTop: 8 }}>
                      {isHold && (
                        <button
                          onClick={() => handleReleaseHold(u._id)}
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center', color: '#b45309' }}
                        >
                          Release Hold
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleBlock(u._id, u.status)}
                        className="btn btn-ghost btn-sm"
                        style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
                      >
                        {isBlocked ? <Unlock size={12} /> : <Lock size={12} />}
                        <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Unit Sub-Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)} style={{ zIndex: 1100 }}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add Unit to {project?.name}</h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddUnit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Tower *</label>
                    <input
                      className="input"
                      value={form.tower}
                      onChange={(e) => setForm({ ...form, tower: e.target.value })}
                      placeholder="e.g. Tower A"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Floor Number *</label>
                    <input
                      type="number"
                      className="input"
                      value={form.floor}
                      onChange={(e) => setForm({ ...form, floor: e.target.value })}
                      placeholder="e.g. 5"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Unit Number *</label>
                    <input
                      className="input"
                      value={form.unitNumber}
                      onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                      placeholder="e.g. A-502"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Configuration</label>
                    <select
                      className="input"
                      value={form.configuration}
                      onChange={(e) => setForm({ ...form, configuration: e.target.value })}
                    >
                      <option value="1BHK">1 BHK</option>
                      <option value="2BHK">2 BHK</option>
                      <option value="2.5BHK">2.5 BHK</option>
                      <option value="3BHK">3 BHK</option>
                      <option value="3BHK + Servant">3 BHK + Servant</option>
                      <option value="4BHK">4 BHK</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Villa">Villa</option>
                      <option value="Commercial Office">Commercial Office</option>
                      <option value="Plot">Plot</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Carpet Area (sq.ft)</label>
                    <input
                      type="number"
                      className="input"
                      value={form.carpetArea}
                      onChange={(e) => setForm({ ...form, carpetArea: e.target.value })}
                      placeholder="e.g. 1250"
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Facing</label>
                    <select
                      className="input"
                      value={form.facing}
                      onChange={(e) => setForm({ ...form, facing: e.target.value })}
                    >
                      <option value="East">East</option>
                      <option value="West">West</option>
                      <option value="North">North</option>
                      <option value="South">South</option>
                      <option value="North-East">North-East</option>
                      <option value="Park Facing">Park Facing</option>
                      <option value="Corner">Corner</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Base Price (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={form.basePrice}
                      onChange={(e) => {
                        const bp = Number(e.target.value) || 0;
                        const add = Number(form.additionalCharges) || 0;
                        setForm({ ...form, basePrice: e.target.value, totalPrice: String(bp + add) });
                      }}
                      placeholder="e.g. 8500000"
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>Total Price (₹) *</label>
                    <input
                      type="number"
                      className="input"
                      value={form.totalPrice}
                      onChange={(e) => setForm({ ...form, totalPrice: e.target.value })}
                      placeholder="e.g. 9000000"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-primary btn-sm" style={{ background: '#4f46e5' }}>
                    {saving ? 'Adding...' : 'Save Unit 🏢'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
