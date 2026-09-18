/**
 * Plan tagline resolution — the rule that keeps a superadmin's own copy from
 * being overwritten by translations, without pushing English seed text onto the
 * Russian or Armenian landing page.
 */

import { describe, it, expect } from '@jest/globals';

import {
  PLAN_NAME_KEYS,
  PLAN_TAGLINE_KEYS,
  isAuthoredTagline,
  isDefaultCta,
  isDefaultName,
  isDefaultTagline,
  resolvePlanCta,
  resolvePlanName,
  resolvePlanTagline,
} from '@/lib/planPresentation';
import { DEFAULT_PLANS } from '../../convex/billing/defaults';

/** Stand-in for i18next `t`: returns the localized string when it exists. */
const localized: Record<string, string> = {
  'pricing.starter': 'Ստարտ',
  'pricing.professional': 'Պրո',
  'pricing.enterprise': 'Կորպորատիվ',
  'pricing.starterDesc': 'Փոքր թիմերի համար',
  'pricing.professionalDesc': 'Աճող ընկերությունների համար',
  'pricing.enterpriseDesc': 'Անհատական լուծումներ',
  'pricing.startFreeTrial': 'Սկսել անվճար փորձաշրջանը',
  'pricing.contactSales': 'Կապվել վաճառքի հետ',
};
const t = (key: string, options?: { defaultValue?: string }) =>
  localized[key] ?? options?.defaultValue ?? key;

const seedTagline = DEFAULT_PLANS.find((p) => p.key === 'pro')!.tagline;

describe('isDefaultName', () => {
  it('treats the seeded name as untouched', () => {
    expect(isDefaultName('pro', 'Pro')).toBe(true);
  });

  it('treats a rename as the superadmin’s own', () => {
    expect(isDefaultName('pro', 'Профессиональный')).toBe(false);
    expect(isDefaultName('enterprise', 'Индивидуальная')).toBe(false);
  });
});

describe('resolvePlanName', () => {
  it('translates an untouched plan name', () => {
    expect(resolvePlanName({ planKey: 'starter', name: 'Starter', t })).toBe('Ստարտ');
  });

  it('keeps a renamed plan in its own words', () => {
    expect(resolvePlanName({ planKey: 'enterprise', name: 'Индивидуальная', t })).toBe(
      'Индивидуальная',
    );
  });

  it('keeps the name of a custom plan key', () => {
    expect(resolvePlanName({ planKey: 'custom_2026', name: 'Our deal', t })).toBe('Our deal');
  });

  it('falls back to the locale when no name is stored', () => {
    expect(resolvePlanName({ planKey: 'pro', name: null, t })).toBe('Պրո');
  });
});

describe('isDefaultTagline', () => {
  it('treats the seeded tagline as untouched', () => {
    expect(isDefaultTagline('pro', seedTagline)).toBe(true);
    // Whitespace is not an edit either.
    expect(isDefaultTagline('pro', `  ${seedTagline}  `)).toBe(true);
  });

  it('still matches a row seeded before the seed gained its marketing tail', () => {
    // Regression: the seed tagline gained " — priced per seat", the rows in
    // Convex kept the old wording, and a full-string comparison then classified
    // every one of them as hand-written — which turned translation off for the
    // English copy on the landing page.
    const legacy = seedTagline.split('—')[0]!.trim();
    expect(isDefaultTagline('pro', legacy)).toBe(true);
  });

  it('treats a typed tagline as authored', () => {
    expect(isDefaultTagline('pro', 'Everything your HR team needs')).toBe(false);
    expect(isAuthoredTagline('pro', 'Everything your HR team needs')).toBe(true);
  });

  it('treats a missing tagline as untouched', () => {
    expect(isDefaultTagline('pro', undefined)).toBe(true);
    expect(isDefaultTagline('pro', '   ')).toBe(true);
  });
});

describe('resolvePlanCta', () => {
  it('renders a seeded CTA in the visitor’s language', () => {
    // Regression: the seed stores English `ctaLabel` text, so a Russian or
    // Armenian pricing card showed an English "Start free trial" button.
    expect(resolvePlanCta({ planKey: 'pro', ctaLabel: 'Start free trial', t })).toBe(
      'Սկսել անվճար փորձաշրջանը',
    );
    expect(resolvePlanCta({ planKey: 'enterprise', ctaLabel: 'Contact sales', t })).toBe(
      'Կապվել վաճառքի հետ',
    );
  });

  it('keeps a label the superadmin typed, in every language', () => {
    expect(resolvePlanCta({ planKey: 'pro', ctaLabel: 'Записаться на демо', t })).toBe(
      'Записаться на демо',
    );
  });

  it('defaults to a localized trial CTA, or sales for a custom plan', () => {
    expect(resolvePlanCta({ planKey: 'starter', ctaLabel: null, t })).toBe(
      'Սկսել անվճար փորձաշրջանը',
    );
    expect(resolvePlanCta({ planKey: 'custom_2026', ctaLabel: undefined, isCustom: true, t })).toBe(
      'Կապվել վաճառքի հետ',
    );
  });

  it('detects the seeded labels, case- and whitespace-insensitively', () => {
    expect(isDefaultCta('Start free trial')).toBe(true);
    expect(isDefaultCta('  Contact Sales ')).toBe(true);
    expect(isDefaultCta('Book a demo')).toBe(false);
    expect(isDefaultCta(null)).toBe(true);
  });
});

describe('resolvePlanTagline', () => {
  it('uses the authored tagline, in every language', () => {
    const text = resolvePlanTagline({
      planKey: 'pro',
      tagline: 'Built for Armenian payroll',
      t,
    });
    expect(text).toBe('Built for Armenian payroll');
  });

  it('falls back to the visitor’s language for an untouched seeded plan', () => {
    const text = resolvePlanTagline({ planKey: 'pro', tagline: seedTagline, t });
    expect(text).toBe('Աճող ընկերությունների համար');
  });

  it('falls back to the locale when a seeded plan has no stored tagline', () => {
    const text = resolvePlanTagline({ planKey: 'starter', tagline: null, t });
    expect(text).toBe('Փոքր թիմերի համար');
  });

  it('treats an empty tagline as "no custom copy"', () => {
    const text = resolvePlanTagline({ planKey: 'enterprise', tagline: '   ', t });
    expect(text).toBe('Անհատական լուծումներ');
  });

  it('passes stored text through for a renamed or custom plan key', () => {
    const text = resolvePlanTagline({ planKey: 'custom_2026', tagline: 'Our own deal', t });
    expect(text).toBe('Our own deal');
  });

  it('covers every standard plan key with a locale string', () => {
    for (const plan of DEFAULT_PLANS) {
      expect(PLAN_TAGLINE_KEYS[plan.key]).toBeTruthy();
      expect(PLAN_NAME_KEYS[plan.key]).toBeTruthy();
      const text = resolvePlanTagline({ planKey: plan.key, tagline: plan.tagline, t });
      expect(text).not.toBe(plan.tagline);
      const name = resolvePlanName({ planKey: plan.key, name: plan.name, t });
      expect(name).not.toBe(plan.name);
    }
  });
});
