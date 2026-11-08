import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import OfflineBanner from '../../src/components/common/OfflineBanner';

describe('OfflineBanner Component Unit Tests', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: originalOnLine,
    });
  });

  it('renders nothing when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('displays alert banner with role="status" when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    render(<OfflineBanner />);
    const banner = screen.getByRole('status');
    expect(banner).toBeDefined();
    expect(screen.getByText(/You are offline/i)).toBeDefined();
  });

  it('dynamically appears when offline event is fired and disappears on online event', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();

    // Trigger offline event
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByRole('status')).toBeDefined();

    // Trigger online event
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});
