'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import InventoryManagerModal from '@/components/InventoryManagerModal';
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

import DynamicFormRenderer from '@/components/common/DynamicFormRenderer';
import { getUser } from '@/lib/auth';

function ProjectModal({ project, onClose, onSaved }) {
  const isEdit = !!project?._id;
  const [schema, setSchema] = useState(() => {
    const u = getUser();
    if (u?.productFormSchema && Array.isArray(u.productFormSchema) && u.productFormSchema.length > 0) {
      return u.productFormSchema;
    }
    return [];
  });
  const [form, setForm] = useState(() => {
    const initial = {
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
    };
    if (project?.customData && typeof project.customData === 'object') {
      Object.assign(initial, project.customData);
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadSchema() {
      try {
        const { data } = await api.get(`/auth/form-schema?type=product&_t=${Date.now()}`);
        if (data?.schema && Array.isArray(data.schema) && data.schema.length > 0) {
          setSchema(data.schema);
        }
      } catch (e) {}
    }
    loadSchema();
  }, []);

  const handleFieldChange = (fieldId, value) => {
    setForm(f => ({ ...f, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(errs => ({ ...errs, [fieldId]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    try {
      const categories = typeof form.productCategory === 'string'
        ? form.productCategory.split(',').map(c => c.trim()).filter(Boolean)
        : (Array.isArray(form.productCategory) ? form.productCategory : []);

      const inclusions = typeof form.amenities === 'string'
        ? form.amenities.split(',').map(a => a.trim()).filter(Boolean)
        : (Array.isArray(form.amenities) ? form.amenities : []);

      const standardKeys = new Set([
        'name', 'location', 'city', 'vendorOrBrand', 'basePrice', 'productCategory',
        'amenities', 'deliveryOrCompletionDate', 'referenceId', 'brochureUrl',
        'description', 'status'
      ]);

      const customData = {};
      Object.keys(form).forEach(k => {
        if (!standardKeys.has(k)) {
          customData[k] = form[k];
        }
      });

      const payload = {
        ...form,
        name: form.name.trim(),
        location: form.location.trim(),
        productCategory: categories,
        configuration: categories,
        amenities: inclusions,
        developer: form.vendorOrBrand,
        reraNumber: form.referenceId,
        possessionDate: form.deliveryOrCompletionDate,
        customData,
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
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
      toast.error(err.response?.data?.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {isEdit ? 'Edit Product / Package' : 'Add Product or Package'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '72dvh', overflowY: 'auto', paddingRight: 4 }}>
          {schema.length > 0 ? (
            <DynamicFormRenderer
              schema={schema}
              values={form}
              onChange={handleFieldChange}
              errors={errors}
              gridCols={2}
            />
          ) : (
            <>
              <div>
                <label className="label">Package / Product Name *</label>
                <input className="input" placeholder="e.g. Enterprise Growth Suite" value={form.name} onChange={e => handleFieldChange('name', e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Market / Region / Location *</label>
                  <input className="input" placeholder="e.g. North America or Mumbai" value={form.location} onChange={e => handleFieldChange('location', e.target.value)} required />
                </div>
                <div>
                  <label className="label">City / Territory</label>
                  <input className="input" placeholder="e.g. National / Remote" value={form.city} onChange={e => handleFieldChange('city', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Vendor / Brand / Provider</label>
                  <input className="input" placeholder="e.g. Acme Cloud Corp" value={form.vendorOrBrand} onChange={e => handleFieldChange('vendorOrBrand', e.target.value)} />
                </div>
                <div>
                  <label className="label">Base Pricing / Rate</label>
                  <input className="input" placeholder="e.g. $4,500/mo or ₹2.5 Lakhs" value={form.basePrice} onChange={e => handleFieldChange('basePrice', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Tiers / Variant Categories (comma-separated)</label>
                <input className="input" placeholder="e.g. Starter, Growth, Enterprise, Custom" value={form.productCategory} onChange={e => handleFieldChange('productCategory', e.target.value)} />
              </div>

              <div>
                <label className="label">Key Features & Inclusions (comma-separated)</label>
                <input className="input" placeholder="e.g. Dedicated Manager, 24/7 SLA, API Access, Custom Setup" value={form.amenities} onChange={e => handleFieldChange('amenities', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Catalog Status</label>
                  <select className="input" value={form.status} onChange={e => handleFieldChange('status', e.target.value)}>
                    <option value="available">Active & Available</option>
                    <option value="in_development">In Development</option>
                    <option value="upcoming">Upcoming Launch</option>
                    <option value="sold_out">Sold Out / Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="label">Delivery / Completion Timeline</label>
                  <input className="input" placeholder="e.g. Immediate or 2-4 Weeks" value={form.deliveryOrCompletionDate} onChange={e => handleFieldChange('deliveryOrCompletionDate', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Reference ID / SKU / License #</label>
                  <input className="input" placeholder="e.g. SKU-849201" value={form.referenceId} onChange={e => handleFieldChange('referenceId', e.target.value)} />
                </div>
                <div>
                  <label className="label">Brochure / Spec Sheet URL</label>
                  <input className="input" placeholder="https://..." value={form.brochureUrl} onChange={e => handleFieldChange('brochureUrl', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Overview / Value Proposition</label>
                <textarea className="input" rows={2} placeholder="Key benefits, deliverables, and selling points..." value={form.description} onChange={e => handleFieldChange('description', e.target.value)} />
              </div>
            </>
          )}

          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ height: 44, borderRadius: 12 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 44, borderRadius: 12 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : (isEdit ? 'Update Package' : 'Save to Catalog')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectsContent() {
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(rawTab === 'availability' ? 'available' : '');
  const [activeModal, setActiveModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedInventoryProject, setSelectedInventoryProject] = useState(null);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'availability') {
      setStatusFilter('available');
    }
  }, [searchParams]);

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
    <div className="app-shell pb-mobile-nav">
      <div className="page-container max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="page-title text-xl sm:text-2xl font-extrabold m-0 text-slate-900">Products & Packages Catalog</h1>
            <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
              Standard offerings, inventories & pricing packages ({projects.length})
            </p>
          </div>
          <button onClick={() => { setSelectedProject(null); setActiveModal(true); }} className="btn btn-primary btn-sm self-start sm:self-auto" style={{ gap: 6, borderRadius: 10 }}>
            <Plus size={16} /> Add Package
          </button>
        </div>

        <div className="page-content" style={{ padding: 0 }}>
          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 13 }} />
              <input
                type="text"
                placeholder="Search package name, vendor/brand, market..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchProjects()}
                className="input w-full"
                style={{ paddingLeft: 36, height: 42, fontSize: 13, borderRadius: 10 }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input w-full sm:w-44"
              style={{ height: 42, fontSize: 12, borderRadius: 10 }}
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <button
                        onClick={() => {
                          setSelectedInventoryProject(p);
                          setShowInventoryModal(true);
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1, minWidth: 120, justifyContent: 'center', fontSize: 11, gap: 4, borderRadius: 8, background: '#4f46e5' }}
                        title="Manage Towers, Floors & Saleable Units"
                      >
                        <Building2 size={12} /> Inventory ({p.availableUnits || 0}/{p.totalUnits || 0})
                      </button>

                      <Link
                        href={`/dashboard?projectId=${p._id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, minWidth: 100, justifyContent: 'center', fontSize: 11, gap: 4, borderRadius: 8 }}
                      >
                        Leads <ArrowRight size={12} />
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

      {showInventoryModal && selectedInventoryProject && (
        <InventoryManagerModal
          project={selectedInventoryProject}
          onClose={() => setShowInventoryModal(false)}
          onUpdated={fetchProjects}
        />
      )}

      <BottomNav active="projects" />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsContent />
    </Suspense>
  );
}
