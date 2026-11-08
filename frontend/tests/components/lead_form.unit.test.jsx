import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LeadCreateModal from '../../src/components/LeadCreateModal';

describe('LeadCreateModal / LeadForm Unit Tests', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <LeadCreateModal
        isOpen={false}
        onClose={vi.fn()}
        token="test-token"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with required inputs when isOpen is true', () => {
    render(
      <LeadCreateModal
        isOpen={true}
        onClose={vi.fn()}
        token="test-token"
      />
    );

    expect(screen.getByText(/Add New Lead/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Rohan Mehta/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/9876543210/i)).toBeDefined();
  });

  it('validates mandatory fields and displays error message if submitted empty', async () => {
    const { container } = render(
      <LeadCreateModal
        isOpen={true}
        onClose={vi.fn()}
        token="test-token"
      />
    );

    const form = container.querySelector('form');
    fireEvent.submit(form);

    expect(screen.getByText('Lead Name and Phone Number are mandatory')).toBeDefined();
  });

  it('calls onClose when close or cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <LeadCreateModal
        isOpen={true}
        onClose={handleClose}
        token="test-token"
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
