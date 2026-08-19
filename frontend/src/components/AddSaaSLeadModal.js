'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { X, Zap, Phone, Mail, Building2, User, Sparkles, Calendar, Layers, FileText } from 'lucide-react';

export const SUPERADMIN_SAAS_STAGES = [
  'New Lead (From Ads/Calls)',
  'Platform Signup (Auto-generated when a user registers)',
  'Demo Scheduled',
  'Trial Active',
  'Payment/Subscription Won',
  'Closed Lost'
];

export const SAAS_SOURCE_OPTIONS = [
  'Direct Call',
  'Meta Ads',
  'Google Ads',
  'Auto-Signup',
  'Organic Search',
  'Referral'
];

export const SAAS_PLAN_OPTIONS = [
  'Starter Plan',
  'Pro Plan',
  'Enterprise Plan',
  'Not Decided'
];

export default function AddSaaSLeadModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: 'Direct Call',
    interestedPlan: 'Pro Plan',
    status: 'New Lead (From Ads/Calls)',
    followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const setVal = (key) => (e) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Prospect Full Name is required');
    if (!form.phone.trim()) return toast.error('Prospect Phone Number is required');
    if (!form.email.trim()) return toast.error('Prospect Email is required');
    if (!form.company.trim()) return toast.error('Organization / Agency Name is required');

    setLoading(true);
    try {
      const cleanPhone = form.phone.replace(/\D/g, '');
      const payload = {
        name: form.name.trim(),
        email: form.email.toLowerCase().trim(),
        phone: cleanPhone,
        company: form.company.trim(),
        source: form.source,
        status: form.status,
        budget: form.interestedPlan, // Store plan in budget for instant visibility
        propertyType: 'SaaS CRM Subscription',
        followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : new Date().toISOString(),
        tags: ['saas_lead', form.source.toLowerCase().replace(/[^a-z0-9]/g, '_'), form.interestedPlan.toLowerCase().replace(/[^a-z0-9]/g, '_')],
        customData: {
          interestedPlan: form.interestedPlan,
          leadSource: form.source,
        },
      };

      const { data } = await api.post('/leads', payload);

      // If call notes were provided, add them as lead note
      if (form.notes.trim() && data._id) {
        try {
          await api.post(`/leads/${data._id}/notes`, { text: `[Phone Intake]: ${form.notes.trim()}` });
        } catch {}
      }

      toast.success(`⚡ SaaS Prospect "${form.name}" created successfully!`);
      if (onCreated) onCreated(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create SaaS prospect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 560,
          background: '#0f172a',
          border: '1px solid #1e293b',
          color: '#f8fafc',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid #1e293b', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
            }}>
              <Zap size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>
                Quick SaaS Lead Intake Form
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Rapid phone call intake & subscriber opportunity capture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row 1: Name & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 5 }}>
                Full Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  autoFocus
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={form.name}
                  onChange={setVal('name')}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    borderRadius: 8,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 13
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 5 }}>
                Phone Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  required
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={form.phone}
                  onChange={setVal('phone')}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    borderRadius: 8,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 13
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Email & Organization Name */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 5 }}>
                Business Email <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  required
                  type="email"
                  placeholder="e.g. rahul@agency.com"
                  value={form.email}
                  onChange={setVal('email')}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    borderRadius: 8,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 13
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 5 }}>
                Organization / Agency Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Building2 size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  required
                  placeholder="e.g. Apex Realty & Digital"
                  value={form.company}
                  onChange={setVal('company')}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    borderRadius: 8,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 13
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 3: Critical SuperAdmin Fields - Lead Source & Interested Plan */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, background: 'rgba(99,102,241,0.06)', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 5 }}>
                🎯 Inbound Lead Source <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={form.source}
                onChange={setVal('source')}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: '#1e293b',
                  border: '1px solid #4f46e5',
                  color: '#f8fafc',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {SAAS_SOURCE_OPTIONS.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 5 }}>
                💎 Interested SaaS Plan <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={form.interestedPlan}
                onChange={setVal('interestedPlan')}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: '#1e293b',
                  border: '1px solid #4f46e5',
                  color: '#fbbf24',
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                {SAAS_PLAN_OPTIONS.map(plan => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Pipeline Stage & Follow-Up / Demo Date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 5 }}>
                Sales Pipeline Stage
              </label>
              <div style={{ position: 'relative' }}>
                <Layers size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <select
                  value={form.status}
                  onChange={setVal('status')}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    borderRadius: 8,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  {SUPERADMIN_SAAS_STAGES.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 5 }}>
                Demo / Next Follow-up Date
              </label>
              <div style={{ position: 'relative' }}>
                <Calendar size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="datetime-local"
                  value={form.followUpDate}
                  onChange={setVal('followUpDate')}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    borderRadius: 8,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 12
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 5: Call Summary Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 5 }}>
              Phone Call Summary & Feature Requirements (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 15 agents in team, needs WhatsApp bulk broadcast + custom roles..."
              value={form.notes}
              onChange={setVal('notes')}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                fontSize: 13,
                resize: 'none'
              }}
            />
          </div>

          {/* Submit Actions */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              style={{
                height: 42,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                height: 42,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
              }}
            >
              {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <><Sparkles size={16} /> Save SaaS Lead</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
