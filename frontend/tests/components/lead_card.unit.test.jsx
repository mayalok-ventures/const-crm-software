import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LeadCard, { SERVICE_CATALOG, KANBAN_STAGES } from '../../src/components/LeadCard';

// Mock AlarmContext
vi.mock('@/lib/AlarmContext', () => ({
  useAlarm: () => ({
    activeAlarm: null,
    dismissAlarm: vi.fn(),
  }),
}));

describe('LeadCard Component Unit Tests', () => {
  const mockLead = {
    _id: 'lead_123',
    name: 'Priya Sharma',
    phone: '+919876543210',
    email: 'priya@example.com',
    company: 'Apex Tech',
    serviceRequired: 'smart_solo',
    status: 'new_lead',
    monthlySpend: 15000,
    goalTimeline: 'immediate',
    followUps: [],
  };

  it('renders lead basic info (name, company, phone, service plan)', () => {
    render(
      <LeadCard
        lead={mockLead}
        token="test-token"
        canonicalPlans={[]}
        onLeadUpdated={vi.fn()}
      />
    );

    expect(screen.getByText('Priya Sharma')).toBeDefined();
    expect(screen.getByText(/Apex Tech/)).toBeDefined();
    expect(screen.getByText('+919876543210')).toBeDefined();
  });

  it('renders correct pipeline stage and service catalog indicators', () => {
    render(
      <LeadCard
        lead={mockLead}
        token="test-token"
        canonicalPlans={[]}
      />
    );

    const stage = KANBAN_STAGES.find(s => s.id === mockLead.status);
    expect(stage).toBeDefined();
    expect(stage.label).toBe('New Lead');

    const service = SERVICE_CATALOG[mockLead.serviceRequired];
    expect(service).toBeDefined();
    expect(screen.getByText(service.label)).toBeDefined();
  });

  it('opens edit modal when clicking edit button', async () => {
    render(
      <LeadCard
        lead={mockLead}
        token="test-token"
        canonicalPlans={[]}
      />
    );

    const editBtn = screen.getByTitle('Edit Lead');
    expect(editBtn).toBeDefined();
    fireEvent.click(editBtn);

    // Modal with "Edit Lead Details" heading appears
    expect(screen.getByText('Edit Lead Details')).toBeDefined();
    expect(screen.getByDisplayValue('Priya Sharma')).toBeDefined();
  });
});
