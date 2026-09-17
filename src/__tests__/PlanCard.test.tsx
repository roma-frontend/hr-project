/**
 * The shared pricing card.
 *
 * It is rendered by two callers — the public pricing section and the tariff
 * editor's live preview — so what matters is that it shows the per-seat
 * semantics unambiguously and that the CTA stays a slot: the editor passes an
 * inert node and must never get a working checkout button.
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

import { PlanCard, type PlanCardModel } from '@/components/landing/PlanCard';

const base: PlanCardModel = {
  accentFrom: '#3b82f6',
  accentTo: '#2563eb',
  glowColor: 'rgba(59,130,246,0.4)',
  icon: <span data-testid="plan-icon" />,
  name: 'Pro',
  tagline: 'For growing companies',
  priceLabel: '$6',
  priced: true,
  priceSuffix: 'per seat / month',
  seatsLine: 'For 10 seats: $60',
  billingLabel: 'Billed monthly',
  trialLabel: '14-day free trial',
  featureTexts: ['Employees', 'Attendance'],
};

describe('PlanCard', () => {
  it('renders the per-seat price with the entry-team total', () => {
    render(<PlanCard model={base} cta={<button>Checkout</button>} />);

    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('For growing companies')).toBeInTheDocument();
    expect(screen.getByText('$6')).toBeInTheDocument();
    // The suffix is the whole point of the per-seat model: $6 is not the bill.
    expect(screen.getByText('per seat / month')).toBeInTheDocument();
    expect(screen.getByText('For 10 seats: $60')).toBeInTheDocument();
    expect(screen.getByText('Billed monthly')).toBeInTheDocument();
    expect(screen.getByText('14-day free trial')).toBeInTheDocument();
  });

  it('renders the flat feature list when no categories are supplied', () => {
    render(<PlanCard model={base} cta={<button>Checkout</button>} />);
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Attendance')).toBeInTheDocument();
  });

  it('renders the CTA slot verbatim', () => {
    render(<PlanCard model={base} cta={<button>Checkout</button>} />);
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeInTheDocument();
  });

  it('hides the price suffix and team line for a quoted plan', () => {
    render(
      <PlanCard
        model={{ ...base, name: 'Enterprise', priceLabel: 'Custom', priced: false }}
        cta={<button>Contact sales</button>}
      />,
    );

    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.queryByText('per seat / month')).toBeNull();
    expect(screen.queryByText('For 10 seats: $60')).toBeNull();
    expect(screen.queryByText('14-day free trial')).toBeNull();
  });

  it('shows the popular ribbon only for the popular plan', () => {
    const { rerender } = render(<PlanCard model={base} cta={null} />);
    expect(screen.queryByText('pricing.mostPopular')).toBeNull();

    rerender(
      <PlanCard model={{ ...base, popular: true, badgeLabel: 'Most popular' }} cta={null} />,
    );
    expect(screen.getByText('Most popular')).toBeInTheDocument();
  });

  it('collapses the feature list into the category navigator for data-driven plans', () => {
    render(
      <PlanCard
        model={{
          ...base,
          featureTexts: undefined,
          featureGroups: [
            { category: 'people', items: ['Employees', 'Departments'] },
            { category: 'time', items: ['Attendance'] },
          ],
        }}
        cta={<button>Checkout</button>}
      />,
    );

    // Categories are rows; the flat list is not rendered.
    expect(screen.getByRole('button', { name: /people/i })).toBeInTheDocument();
    expect(screen.queryByText('Employees')).toBeNull();

    // Opening a category slides in its features.
    fireEvent.click(screen.getByRole('button', { name: /people/i }));
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Departments')).toBeInTheDocument();
  });
});
