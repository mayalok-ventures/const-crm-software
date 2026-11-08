import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDirtyFormWarning } from '../../src/lib/useDirtyFormWarning';

function DummyForm() {
  const [dirty, setDirty] = useState(false);
  const { confirmNavigation } = useDirtyFormWarning({ isDirty: dirty, message: 'Unsaved data!' });

  return (
    <div>
      <input
        data-testid="input"
        onChange={() => setDirty(true)}
      />
      <button
        data-testid="cancel-btn"
        onClick={() => {
          if (confirmNavigation()) {
            setDirty(false);
          }
        }}
      >
        Cancel
      </button>
      <span data-testid="dirty-status">{dirty ? 'Dirty' : 'Clean'}</span>
    </div>
  );
}

describe('useDirtyFormWarning Hook Unit Tests (U1)', () => {
  it('allows cancellation directly when form is clean without prompt', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<DummyForm />);

    expect(screen.getByTestId('dirty-status').textContent).toBe('Clean');
    fireEvent.click(screen.getByTestId('cancel-btn'));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('dirty-status').textContent).toBe('Clean');
  });

  it('prompts confirmation when canceling a dirty form', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DummyForm />);

    fireEvent.change(screen.getByTestId('input'), { target: { value: 'New text' } });
    expect(screen.getByTestId('dirty-status').textContent).toBe('Dirty');

    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(confirmSpy).toHaveBeenCalledWith('Unsaved data!');
    expect(screen.getByTestId('dirty-status').textContent).toBe('Clean');
  });
});
