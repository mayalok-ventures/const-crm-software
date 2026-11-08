import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalShell } from '../../src/lib/useModalA11y';

function ModalTestApp() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setOpen(true)} data-testid="open-modal-btn">
        Open Dialog
      </button>
      <ModalShell
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Test Accessible Modal"
        titleId="test-modal-title"
      >
        <h2 id="test-modal-title">Test Accessible Modal</h2>
        <input placeholder="Name input" data-testid="modal-input" />
        <button onClick={() => setOpen(false)} data-testid="modal-close-btn">
          Confirm Action
        </button>
      </ModalShell>
    </div>
  );
}

describe('Modal Accessibility Hook and ModalShell (T3 & U5)', () => {
  it('has role="dialog" and aria-modal="true" when open', () => {
    render(<ModalTestApp />);

    expect(screen.queryByRole('dialog')).toBeNull();

    const openBtn = screen.getByTestId('open-modal-btn');
    fireEvent.click(openBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('test-modal-title');
  });

  it('closes dialog when Escape key is pressed', () => {
    render(<ModalTestApp />);

    const openBtn = screen.getByTestId('open-modal-btn');
    fireEvent.click(openBtn);

    expect(screen.getByRole('dialog')).toBeDefined();

    // Fire Escape key on document
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('traps Tab focus within modal elements', () => {
    render(<ModalTestApp />);

    const openBtn = screen.getByTestId('open-modal-btn');
    fireEvent.click(openBtn);

    const input = screen.getByTestId('modal-input');
    const closeBtn = screen.getByTestId('modal-close-btn');

    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Tab from last element wraps around to first focusable element
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(input);

    // Shift+Tab from first element wraps to last focusable element
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(closeBtn);
  });
});
