'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import {
  Package, Plus, Search, MapPin, Tag, Calendar, ShieldCheck,
  ExternalLink, Edit2, Trash2, X, Check, ArrowRight, Layers,
  Briefcase, CheckCircle2, Sparkles, Building2
} from 'lucide-react';

const STATUS_LABELS = {
  available: '🟢 Active & Available',
  ready_to_move: '🟢 Active & Available',
  under_construction: '🛠️ In Development',
  in_development: '🛠️ In Development',
  upcoming: '🚀 Upcoming Launch',
  sold_out: '🏷️ Sold Out / Closed',
  archived: '📦 Archived'
};

function ProjectModal({ project, onClose, onSaved }) {
  const isEdit = !!project?._id;
  const [form, setForm] = useState({
    name: project?.name || '',
    location: project?.location || '',
    city: project?.city || '',
    vendorOrBrand: project?.vendorOrBrand || project?.developer || '',
    basePrice: project?.basePrice || '',
    productCategory: Array.isArray(project?.productCategory) ? project.productCategory.join(', ') : (Array.isArray(project?.configuration) ? project.configuration.join(', ') : ''),
    amenities: Array.isArray(project?.amenities) ? project.amenities.join(', ') : '',
    deliveryOrCompletionDate: project?.deliveryOrCompletionDate || project?.possessionDate || '',
    referenceId: project?.referenceId || project?.reraNumber || '',
    brochureUrl: project?.brochureUrl || '',
    description: project?.description || '',
    status: project?.status || 'available',
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.location) return toast.error('Package name and location/market are required');

    setLoading(true);
    try {
      const categories = form.productCategory ? form.productCategory.split(',').map(c => c.trim()).filter(Boolean) : [];
      const inclusions = form.amenities ? form.amenities.split(',').map(a => a.trim()).filter(Boolean) : [];

      const payload = {
        ...form,
        productCategory: categories,
        configuration: categories,
        amenities: inclusions,
        developer: form.vendorOrBrand,
        reraNumber: form.referenceId,
        possessionDate: form.deliveryOrCompletionDate,
      };

      let res;
      if (isEdit) {
        res = await api.put(`/projects/${project._id}`, payload);
      } else {
        res = await api.post('/projects', payload);
      }

      toast.success(isEdit ? 'Package updated ✅' : 'Package added to catalog 📦');
      onSaved(res.data, isEdit);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {isEdit ? 'Edit Product / Package' : 'Add Product or Package'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '72dvh', overflowY: 'auto', paddingRight: 4 }}>
          <div>
            <label className="label">Package / Product Name *</label>
            <input className="input" placeholder="e.g. Enterprise Growth Suite" value={form.name} onChange={set('name')} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Market / Region / Location *</label>
              <input className="input" placeholder="e.g. North America or Mumbai" value={form.location} onChange={set('location')} required />
            </div>
            <div>
              <label className="label">City / Territory</label>
              <input className="input" placeholder="e.g. National / Remote" value={form.city} onChange={set('city')} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Vendor / Brand / Provider</label>
              <input className="input" placeholder="e.g. Acme Cloud Corp" value={form.vendorOrBrand} onChange={set('vendorOrBrand')} />
            </div>
            <div>
              <label className="label">Base Pricing / Rate</label>
              <input className="input" placeholder="e.g. $4,500/mo or ₹2.5 Lakhs" value={form.basePrice} onChange={set('basePrice')} />
            </div>
          </div>

          <div>
            <label className="label">Tiers / Variant Categories (comma-separated)</label>
            <input className="input" placeholder="e.g. Starter, Growth, Enterprise, Custom" value={form.productCategory} onChange={set('productCategory')} />
          </div>

          <div>
            <label className="label">Key Features & Inclusions (comma-separated)</label>
            <input className="input" placeholder="e.g. Dedicated Manager, 24/7 SLA, API Access, Custom Setup" value={form.amenities} onChange={set('amenities')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Catalog Status</label>
              <select className="input" value={form.status} onChange={set('status')}>
                <option value="available">Active & Available</option>
                <option value="in_development">In Development</option>
                <option value="upcoming">Upcoming Launch</option>
                <option value="sold_out">Sold Out / Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="label">Delivery / Completion Timeline</label>
              <input className="input" placeholder="e.g. Immediate or 2-4 Weeks" value={form.deliveryOrCompletionDate} onChange={set('deliveryOrCompletionDate')} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Reference ID / SKU / License #</label>
              <input className="input" placeholder="e.g. SKU-849201" value={form.referenceId} onChange={set('referenceId')} />
            </div>
            <div>
              <label className="label">Brochure / Spec Sheet URL</label>
              <input className="input" placeholder="https://..." value={form.brochureUrl} onChange={set('brochureUrl')} />
            </div>
          </div>

          <div>
            <label className="label">Overview / Value Proposition</label>
            <textarea className="input" rows={2} placeholder="Key benefits, deliverables, and selling points..." value={form.description} onChange={set('description')} />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-full" style={{ marginTop: 8, height: 44, borderRadius: 12 }}>
            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : (isEdit ? 'Update Package' : 'Save to Catalog')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeModal, setActiveModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/projects', { params });
      setProjects(data);
    } catch {
      toast.error('Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter]);

  const handleSaved = (proj, isEdit) => {
    if (isEdit) {
      setProjects(prev => prev.map(p => p._id === proj._id ? proj : p));
    } else {
      setProjects(prev => [proj, ...prev]);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this item?')) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects(prev => prev.filter(p => p._id !== id));
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Products & Packages Catalog</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Standard offerings, inventories & pricing packages ({projects.length})
            </p>
          </div>
          <button onClick={() => { setSelectedProject(null); setActiveModal(true); }} className="btn btn-primary btn-sm" style={{ gap: 6, borderRadius: 10 }}>
            <Plus size={16} /> Add Package
          </button>
        </div>

        <div className="page-content">
          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 13 }} />
              <input
                type="text"
                placeholder="Search package name, vendor/brand, market..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchProjects()}
                className="input"
                style={{ paddingLeft: 36, height: 42, fontSize: 13, borderRadius: 10 }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input"
              style={{ width: 160, height: 42, fontSize: 12, borderRadius: 10 }}
            >
              <option value="">All Statuses</option>
              <option value="available">Active / Available</option>
              <option value="in_development">In Development</option>
              <option value="upcoming">Upcoming Launch</option>
              <option value="sold_out">Sold Out / Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spinner" />
            </div>
          ) : projects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-muted)' }}>
              <Package size={44} color="var(--border)" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>No packages in catalog yet</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                Pre-save your standard product packages or services so agents can link them to client leads with 1 tap.
              </p>
              <button onClick={() => { setSelectedProject(null); setActiveModal(true); }} className="btn btn-primary btn-sm" style={{ borderRadius: 10 }}>
                <Plus size={14} /> Add First Package
              </button>
            </div>
          ) : (
            /* Responsive Grid on Desktop */
            <div className="responsive-card-grid">
              {projects.map(p => {
                const categories = (p.productCategory && p.productCategory.length > 0) ? p.productCategory : (p.configuration || []);
                const vendor = p.vendorOrBrand || p.developer;
                const refCode = p.referenceId || p.reraNumber;

                return (
                  <div
                    key={p._id}
                    className="card card-hover"
                    style={{
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: 14,
                    }}
                  >
                    <div>
                      {/* Top Bar: Status + Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <span className="badge badge-tag" style={{ fontSize: 10, padding: '2px 8px' }}>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => { setSelectedProject(p); setActiveModal(true); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(p._id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4 }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Title & Vendor */}
                      <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                        {p.name}
                      </h3>
                      <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} color="var(--accent)" />
                        {p.location}{p.city ? `, ${p.city}` : ''} {vendor ? `• ${vendor}` : ''}
                      </p>

                      {/* Pricing Badge */}
                      {p.basePrice && (
                        <div style={{
                          display: 'inline-block',
                          background: 'rgba(79, 70, 229, 0.08)',
                          border: '1px solid rgba(79, 70, 229, 0.2)',
                          borderRadius: 8,
                          padding: '4px 10px',
                          marginBottom: 12,
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--accent)'
                        }}>
                          💰 {p.basePrice}
                        </div>
                      )}

                      {/* Variants / Categories */}
                      {categories.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {categories.map(c => (
                            <span key={c} style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', color: 'var(--text)' }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Inclusions */}
                      {p.amenities?.length > 0 && (
                        <p style={{ margin: '0 0 10px 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          ✨ {p.amenities.slice(0, 3).join(', ')}{p.amenities.length > 3 ? ` +${p.amenities.length - 3} more` : ''}
                        </p>
                      )}

                      {refCode && (
                        <p style={{ margin: '0 0 10px 0', fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ShieldCheck size={12} color="var(--green)" /> Ref: {refCode}
                        </p>
                      )}
                    </div>

                    {/* Footer Action Links */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <Link
                        href={`/dashboard?projectId=${p._id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, justifyContent: 'center', fontSize: 11, gap: 4, borderRadius: 8 }}
                      >
                        View Leads <ArrowRight size={12} />
                      </Link>
                      {p.brochureUrl && (
                        <a
                          href={p.brochureUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11 }}
                          title="Open Spec Sheet / Brochure"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeModal && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setActiveModal(false)}
          onSaved={handleSaved}
        />
      )}

      <BottomNav active="projects" />
    </div>
  );
}
