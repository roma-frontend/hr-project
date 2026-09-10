/**
 * Tests for the /dashboard loading skeletons.
 *
 * The skeletons stand in for `DashboardClient` and `EmployeeDashboard` while
 * the chunk and first queries load, so they must (a) announce themselves as a
 * busy region, (b) stagger their blocks so the page visibly assembles, and
 * (c) use the token-driven `.skeleton` shimmer rather than hard-coded colours.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
        return fallback.defaultValue ?? key;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

import {
  DashboardSkeleton,
  EmployeeDashboardSkeleton,
} from '@/components/dashboard/DashboardSkeleton';

function staggerDelays(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.skeleton-block')).map((el) =>
    parseInt(el.style.getPropertyValue('--stagger'), 10),
  );
}

describe.each([
  ['DashboardSkeleton', DashboardSkeleton],
  ['EmployeeDashboardSkeleton', EmployeeDashboardSkeleton],
])('%s', (_name, Skeleton) => {
  it('is announced as a busy status region with a label', () => {
    const { getByRole } = render(<Skeleton />);
    const region = getByRole('status');
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(region.getAttribute('aria-label')).toBe('Loading…');
  });

  it('staggers its blocks top-to-bottom', () => {
    const { container } = render(<Skeleton />);
    const delays = staggerDelays(container);

    expect(delays.length).toBeGreaterThanOrEqual(5);
    expect(delays[0]).toBe(0);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it('renders shimmer bones that are hidden from assistive tech', () => {
    const { container } = render(<Skeleton />);
    const bones = container.querySelectorAll('.skeleton');

    expect(bones.length).toBeGreaterThan(20);
    bones.forEach((bone) => {
      expect(bone.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('frames blocks with real Card surfaces so the swap to live content is in place', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelectorAll('[data-slot="card"]').length).toBeGreaterThan(3);
  });

  it('contains no visible text (nothing to translate, nothing to flash)', () => {
    const { container } = render(<Skeleton />);
    expect(container.textContent?.trim()).toBe('');
  });
});
