/**
 * The tariff editor's team-size slider (`/superadmin/plans` → Landing preview).
 *
 * The preview exists to answer one question before publishing: what does a
 * customer at *this* team size actually pay? The slider is the control that
 * answers it, so these tests pin the arithmetic the card shows — the volume
 * bracket, the per-seat rate it produces, and the monthly total — plus the
 * self-serve cap announcement on plans that cannot serve the chosen team.
 *
 * Mocks: convex/react (query + mutations), react-i18next (a tiny dictionary),
 * useCurrency (USD, rate 1). Money is asserted at whole numbers only, so the
 * result does not depend on the jest process' default locale.
 */

import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { PLAN_SEAT_PRICING } from '@/lib/pricing';

const mockDict: Record<string, string> = {
  'billing.plans.viewPreview': 'Landing preview',
  'billing.plans.viewEditor': 'Editor',
  'billing.plans.monthly': 'Monthly',
  'billing.plans.yearly': 'Yearly',
  'billing.plans.previewSeatsValue': '{{n}} seats',
  'billing.plans.previewTierActive': 'Active bracket',
  'billing.plans.previewOverCap': "Above this plan's self-serve limit ({{seats}} seats)",
  'billing.plans.tierFrom': '{{seats}}+ seats',
  'billing.plans.tierMaxHint': 'Self-serve up to {{seats}} seats.',
  'billing.plans.custom': 'Custom',
  'pricing.forTeam': 'For {{seats}} seats: {{total}}/mo',
  'pricing.perUserMonth': 'per user / month',
  'pricing.billedMonthly': 'Billed monthly',
  'pricing.billedAnnually': 'Billed annually',
  'pricing.mostPopular': 'Most Popular',
  'pricing.custom': 'Custom',
  'pricing.freeTrial': 'free trial',
  'pricing.starter': 'Starter',
  'pricing.professional': 'Pro',
  'pricing.enterprise': 'Enterprise',
  'pricing.starterDesc': 'Starter tagline',
  'pricing.professionalDesc': 'Pro tagline',
  'pricing.enterpriseDesc': 'Enterprise tagline',
};

function mockInterpolate(template: string, options?: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    options && key in options ? String(options[key]) : '',
  );
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, arg2?: unknown, arg3?: unknown) => {
      const fallback = typeof arg2 === 'string' ? arg2 : undefined;
      const options = (typeof arg2 === 'string' ? arg3 : arg2) as
        | Record<string, unknown>
        | undefined;
      return mockInterpolate(mockDict[key] ?? fallback ?? key, options);
    },
  }),
}));

jest.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    loading: false,
    rate: 1,
    symbol: '$',
    starter: { formatted: '$4' },
    professional: { formatted: '$8' },
    enterprise: { formatted: 'Custom' },
  }),
}));

const mockRef = (name: string) => ({ _name: name });

const mockBillingData = {
  plans: [
    {
      _id: 'plan_starter',
      key: 'starter',
      name: 'Starter',
      tagline: 'Starter tagline',
      priceMonthly: 4,
      priceYearly: 3.2,
      currency: 'USD',
      isActive: true,
      isPopular: false,
      isCustom: false,
      ctaLabel: '',
      sortOrder: 1,
      hasDraftChanges: false,
      entitlements: [],
    },
    {
      _id: 'plan_pro',
      key: 'pro',
      name: 'Pro',
      tagline: 'Pro tagline',
      priceMonthly: 8,
      priceYearly: 6.4,
      currency: 'USD',
      isActive: true,
      isPopular: true,
      isCustom: false,
      ctaLabel: '',
      sortOrder: 2,
      hasDraftChanges: false,
      entitlements: [],
    },
    {
      _id: 'plan_enterprise',
      key: 'enterprise',
      name: 'Enterprise',
      tagline: 'Enterprise tagline',
      isActive: true,
      isPopular: false,
      isCustom: true,
      ctaLabel: '',
      sortOrder: 3,
      hasDraftChanges: false,
      entitlements: [],
    },
  ],
  modules: [
    {
      _id: 'module_employees',
      key: 'employees',
      name: 'People',
      category: 'People',
      status: 'active',
      isCore: true,
      sortOrder: 1,
    },
  ],
};

jest.mock('convex/react', () => ({
  // Every query in this file resolves by name: the versions sheet is mounted
  // alongside the cards and would otherwise receive the billing payload.
  useQuery: (ref?: { _name?: string }) => {
    if (ref?._name === 'listBillingData') return mockBillingData;
    if (ref?._name === 'listPlanVersions') return [];
    return undefined;
  },
  useMutation: () => jest.fn(async () => ({})),
}));

jest.mock('@/convex/_generated/api', () => ({
  api: {
    billing: {
      plans: {
        listBillingData: mockRef('listBillingData'),
        listPlanVersions: mockRef('listPlanVersions'),
        savePlanDraft: mockRef('savePlanDraft'),
        saveEntitlementDraft: mockRef('saveEntitlementDraft'),
        publishBillingPlans: mockRef('publishBillingPlans'),
      },
      seed: { seedBillingCatalog: mockRef('seedBillingCatalog') },
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PlansClient } = require('@/components/superadmin/PlansClient') as {
  PlansClient: React.ComponentType;
};

/** Open the editor and switch to the landing preview. */
function openPreview() {
  render(<PlansClient />);
  fireEvent.click(screen.getByText('Landing preview'));
}

function seatsLine(): string {
  const lines = screen
    .getAllByText(/^For \d+ seats:/)
    .map((el) => el.textContent ?? '')
    .sort();
  // Pro is the only plan whose Team Size line is affordable at every tested
  // size; assert against the whole set so a broken card cannot pass silently.
  return lines.join(' | ');
}

describe('tariff editor team-size slider', () => {
  it('quotes the entry bracket at the default team size', () => {
    openPreview();

    expect(screen.getByText('50 seats')).toBeInTheDocument();

    // Pro: 50 seats lands in the 50+ bracket → $7/seat → $350/mo.
    expect(seatsLine()).toContain('For 50 seats: $350/mo');
    // The slider is bounded by the self-serve range of the model.
    const slider = screen.getByLabelText('Team size') as HTMLInputElement;
    expect(Number(slider.min)).toBe(5);
    expect(Number(slider.max)).toBe(PLAN_SEAT_PRICING.pro.maxSeats);
    expect(Number(slider.value)).toBe(50);
  });

  it('moves the bracket and the total when the team grows', () => {
    openPreview();

    fireEvent.click(screen.getByText('100+'));
    expect(screen.getByText('100 seats')).toBeInTheDocument();
    expect(seatsLine()).toContain('For 100 seats: $550/mo'); // 100+ bracket → $5.50/seat

    fireEvent.click(screen.getByText('250+'));
    expect(screen.getByText('250 seats')).toBeInTheDocument();
    expect(seatsLine()).toContain('For 250 seats: $1,125/mo'); // 250+ bracket → $4.50/seat

    fireEvent.click(screen.getByText('10+'));
    expect(screen.getByText('10 seats')).toBeInTheDocument();
    expect(seatsLine()).toContain('For 10 seats: $80/mo'); // entry bracket → $8/seat
  });

  it('highlights the bracket the chosen team size lands in', () => {
    openPreview();

    fireEvent.click(screen.getByText('250+'));
    const active = screen
      .getAllByTitle('Active bracket')
      .map((el) => el.textContent ?? '')
      .join(' | ');
    expect(active).toContain('250+ seats');
    // Starter tops out long before 250 seats, so nothing on its row is active.
    expect(active).not.toContain('15+ seats');
  });

  it('says so when the team is bigger than the plan self-serves', () => {
    openPreview();

    // Starter self-serves to 25 seats; the default 50 is past it, so the card
    // announces the cap instead of quoting a total Starter cannot sell.
    expect(screen.getByText("Above this plan's self-serve limit (25 seats)")).toBeInTheDocument();
    expect(seatsLine()).not.toContain('For 50 seats: $175/mo');

    fireEvent.click(screen.getByText('10+'));
    expect(
      screen.queryByText("Above this plan's self-serve limit (25 seats)"),
    ).not.toBeInTheDocument();
    expect(seatsLine()).toContain('For 10 seats: $40/mo'); // Starter, 5+ bracket → $4/seat
  });
});
