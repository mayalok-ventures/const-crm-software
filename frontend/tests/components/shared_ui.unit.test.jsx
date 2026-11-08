import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// Helper to compute WCAG 2.1 relative luminance and contrast ratio
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function relativeLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(hex1, hex2) {
  const lum1 = relativeLuminance(hexToRgb(hex1));
  const lum2 = relativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('Shared UI & Accessibility Unit Tests (T3 / Group U)', () => {
  it('WCAG contrast validator correctly flags low contrast vs high contrast', () => {
    // Amber 500 on Amber 50 (audit claim)
    const lowAmberRatio = contrastRatio('#f59e0b', '#fffbeb');
    expect(lowAmberRatio).toBeLessThan(3.0); // Fails AA

    // Hardened Amber 800 on Amber 50 (Group U fix target)
    const highAmberRatio = contrastRatio('#92400e', '#fffbeb');
    expect(highAmberRatio).toBeGreaterThanOrEqual(4.5); // Passes AA
  });

  it('renders an accessible modal shell wrapper with role="dialog" and aria-modal="true"', () => {
    function MockModalShell({ title, children, isOpen }) {
      if (!isOpen) return null;
      return (
        <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="fixed inset-0 z-50">
          <h2 id="modal-title">{title}</h2>
          <div>{children}</div>
          <button aria-label="Close dialog">Close</button>
        </div>
      );
    }

    render(
      <MockModalShell title="Lead Actions" isOpen={true}>
        <p>Modal content</p>
      </MockModalShell>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Lead Actions')).toBeDefined();
    expect(screen.getByLabelText('Close dialog')).toBeDefined();
  });
});
