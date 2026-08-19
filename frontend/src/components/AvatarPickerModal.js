'use client';
import { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { AVATAR_ICONS, getAvatarConfig } from '@/lib/avatarIcons';

export default function AvatarPickerModal({ isOpen, currentAvatarId, onClose, onSelect, saving = false }) {
  const [selectedId, setSelectedId] = useState(currentAvatarId || 'avatar-1');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelect(selectedId);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 10050, // Always above fixed bottom navigation
      }}
    >
      <div
        className="modal-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 520,
          background: 'var(--card, #ffffff)',
          borderRadius: 24,
          padding: '24px 20px',
        }}
      >
        <div className="modal-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text, #0f172a)' }}>
                Choose Profile Icon
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                Select your personalized professional avatar (10 presets)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 10 Icons Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
          gap: 12,
          margin: '18px 0 24px',
          maxHeight: '52vh',
          overflowY: 'auto',
          padding: '4px',
        }}>
          {AVATAR_ICONS.map((avatar) => {
            const isSelected = selectedId === avatar.id;
            const IconComponent = avatar.icon;

            return (
              <div
                key={avatar.id}
                onClick={() => setSelectedId(avatar.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '14px 10px',
                  borderRadius: 16,
                  background: isSelected ? avatar.bgLight : 'var(--surface, #f8fafc)',
                  border: `2px solid ${isSelected ? avatar.border : 'var(--border, #e2e8f0)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: isSelected ? `0 6px 20px ${avatar.shadow}` : 'none',
                  position: 'relative',
                  textAlign: 'center',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: avatar.border,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}

                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: avatar.gradient,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                  boxShadow: `0 4px 12px ${avatar.shadow}`,
                }}>
                  <IconComponent size={22} />
                </div>

                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #0f172a)', lineHeight: 1.2 }}>
                  {avatar.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                  {avatar.role}
                </span>
              </div>
            );
          })}
        </div>

        {/* Modal Action CTA Buttons */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
            style={{ height: 44, borderRadius: 12 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={saving}
            style={{
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              fontWeight: 700,
            }}
          >
            {saving ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Set Profile Icon'}
          </button>
        </div>
      </div>
    </div>
  );
}
