'use client';
import { useState } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const LOST_REASON_OPTIONS = [
  'Price / Budget Constraint',
  'Competitor Chosen',
  'No Response / Ghosted',
  'Timing / Project Delayed',
  'Product / Service Not a Fit',
  'Authority / Decision Maker Block',
  'Features / Requirements Missing',
  'Other',
];

export const isLostStage = (stageName) => {
  if (!stageName) return false;
  const s = String(stageName).toLowerCase();
  return (
    s.includes('lost') ||
    s.includes('not converted') ||
    s.includes('dropped') ||
    s.includes('inactive') ||
    s.includes('unqualified')
  );
};

export default function LostReasonModal({ isOpen, targetStage, leadName, onConfirm, onCancel }) {
  const [lostReason, setLostReason] = useState('');
  const [lostReasonDetail, setLostReasonDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lostReason.trim()) {
      return toast.error('Please select the primary reason why this lead was lost');
    }

    setSubmitting(true);
    try {
      await onConfirm({
        lostReason: lostReason.trim(),
        lostReasonDetail: lostReasonDetail.trim(),
        targetStage,
      });
    } catch {
      toast.error('Failed to update stage');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 10000 }}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, borderTop: '4px solid var(--red)' }}
      >
        <div className="modal-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0,
              }}
            >
              <AlertCircle size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Move to "{targetStage}"
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {leadName ? `Prospect: ${leadName}` : 'Select mandatory lost reason for analytics'}
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label" style={{ fontWeight: 600 }}>
              Primary Lost Reason *
            </label>
            <select
              className="input"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              required
              style={{ height: 42, fontSize: 14 }}
              autoFocus
            >
              <option value="">-- Select Primary Reason --</option>
              {LOST_REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" style={{ fontWeight: 600 }}>
              Detailed Feedback / Notes (Optional)
            </label>
            <textarea
              className="input"
              rows={3}
              placeholder="e.g. Client went with competitor X due to 15% lower price; follow up next quarter."
              value={lostReasonDetail}
              onChange={(e) => setLostReasonDetail(e.target.value)}
              style={{ fontSize: 13, resize: 'vertical' }}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-ghost"
              style={{ height: 42, borderRadius: 10 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn"
              style={{
                background: 'var(--red)',
                color: '#fff',
                borderColor: 'var(--red)',
                height: 42,
                borderRadius: 10,
                fontWeight: 600,
                gap: 6,
              }}
            >
              {submitting ? 'Saving...' : 'Confirm Stage Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
